"""APKs above the storage per-file cap are stored and served as ordered parts."""
import io

import pytest

from app import main
from tests.test_signed_uploads import configure_upload_test

MB = 1024 * 1024
RUN = "12345678-1234-1234-1234-123456789abc"


def test_part_paths():
    base = f"runs/{RUN}/input.apk"
    assert main.apk_parts_path(base, 10 * MB) == base
    assert main.apk_parts_path(base, 45 * MB) == base
    assert main.apk_parts_path(base, 45 * MB + 1) == base + "~parts=2"
    assert main.apk_parts_path(base, 500 * MB) == base + "~parts=12"
    assert main.apk_part_objects(base) == [base]
    assert main.apk_part_objects(base + "~parts=3") == [base + ".part000", base + ".part001", base + ".part002"]
    # Anything not matching the strict server-generated pattern is treated as a single object.
    assert main.apk_part_objects("runs/x/input.apk~parts=3") == ["runs/x/input.apk~parts=3"]


def test_large_signed_upload_gets_one_url_per_part(monkeypatch, tmp_path):
    client = configure_upload_test(monkeypatch, tmp_path, actual_size=120 * MB)
    monkeypatch.setattr(main, "MAX_UPLOAD_BYTES", 500 * MB)
    res = client.post("/api/v1/uploads/sign", json={
        "persona_id": "budget-android", "filename": "big.apk", "size_bytes": 120 * MB, "sha256": "b" * 64})
    assert res.status_code == 200
    ticket = res.json()
    assert ticket["object_path"].endswith("~parts=3")
    assert len(ticket["signed_upload_urls"]) == 3
    assert ticket["signed_upload_urls"][2].split("?")[0].endswith("input.apk.part002")
    assert ticket["part_size_bytes"] == 45 * MB
    assert client.post(f"/api/v1/runs/{ticket['run_id']}/upload-complete").status_code == 200


def test_over_limit_is_rejected(monkeypatch, tmp_path):
    client = configure_upload_test(monkeypatch, tmp_path)
    res = client.post("/api/v1/uploads/sign", json={
        "persona_id": "budget-android", "filename": "huge.apk", "size_bytes": 600 * MB, "sha256": "c" * 64})
    assert res.status_code == 422


def test_size_sums_parts_and_missing_part_is_none(monkeypatch):
    sizes = {".part000": 45 * MB, ".part001": 45 * MB, ".part002": 30 * MB}
    monkeypatch.setattr(main, "_single_object_size", lambda path: sizes.get(path[-8:]))
    assert main.private_object_size(f"runs/{RUN}/input.apk~parts=3") == 120 * MB
    sizes.pop(".part001")
    assert main.private_object_size(f"runs/{RUN}/input.apk~parts=3") is None


class FakeResponse:
    def __init__(self, data):
        self.stream = io.BytesIO(data)

    def read(self, n=-1):
        return self.stream.read(n)

    def close(self):
        pass


def test_download_chains_parts_in_order(monkeypatch):
    data = {f"runs/{RUN}/input.apk.part00{i}": bytes([65 + i]) * (3 + i) for i in range(3)}
    monkeypatch.setattr(main, "_open_single_object", lambda path: (FakeResponse(b""), FakeResponse(data[path])))
    monkeypatch.setattr(main, "private_object_size", lambda path: 12)
    conn, resp = main.open_private_object(f"runs/{RUN}/input.apk~parts=3")
    out = b""
    while chunk := resp.read(4):
        out += chunk
    assert out == b"AAA" + b"BBBB" + b"CCCCC"
    assert resp.getheader("Content-Length") == "12"


def test_upload_splits_local_file(monkeypatch, tmp_path):
    monkeypatch.setattr(main, "APK_PART_BYTES", 4)
    sent = {}
    monkeypatch.setattr(main, "_upload_stream_part", lambda stream, length, path: sent.__setitem__(path, stream.read(length)))
    src = tmp_path / "a.apk"
    src.write_bytes(b"0123456789")
    main.upload_private_object(src, f"runs/{RUN}/input.apk~parts=3")
    assert list(sent.values()) == [b"0123", b"4567", b"89"]


@pytest.mark.parametrize("path,expected", [
    (f"runs/{RUN}/input.apk", [f"runs/{RUN}/input.apk"]),
    (f"runs/{RUN}/input.apk~parts=2", [f"runs/{RUN}/input.apk.part000", f"runs/{RUN}/input.apk.part001"]),
])
def test_delete_removes_every_part(monkeypatch, path, expected):
    captured = {}

    class Conn:
        def request(self, method, endpoint, body=None, headers=None):
            captured["body"] = body

        def getresponse(self):
            class R:
                status = 200

                def read(self, n=-1):
                    return b"[]"
            return R()

        def close(self):
            pass

    monkeypatch.setattr(main, "STORAGE_ENABLED", True)
    monkeypatch.setattr(main, "SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setattr(main.http.client, "HTTPSConnection", lambda *a, **k: Conn())
    main.delete_private_object(path)
    assert main.json.loads(captured["body"])["prefixes"] == expected
