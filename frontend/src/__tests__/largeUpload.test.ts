import { describe, it, expect, vi, afterEach } from "vitest";
import { uploadApkSigned, type SignedApkUploadTicket } from "../storageUpload";

const sent: { url: string; size: number }[] = [];

class FakeXHR {
  status = 200;
  timeout = 0;
  url = "";
  upload: { onprogress: ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  open(_method: string, url: string) { this.url = url; }
  setRequestHeader() {}
  send(body: Blob) {
    sent.push({ url: this.url, size: body.size });
    this.upload.onprogress?.({ lengthComputable: true, loaded: body.size, total: body.size });
    setTimeout(() => this.onload?.(), 0);
  }
}

const host = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "") ||"https://proj.storage.supabase.co";
const url = (i: number) => `${host}/storage/v1/object/upload/sign/bucket/runs/x/input.apk.part00${i}?token=t`;

afterEach(() => {
  sent.length = 0;
  vi.unstubAllGlobals();
});

describe("large APK upload", () => {
  it("uploads consecutive slices, one per signed URL, in order", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXHR);
    const file = new File([new Uint8Array(10)], "big.apk");
    const ticket = {
      run_id: "x", upload_token: "t", tus_endpoint: "", object_path: "runs/x/input.apk~parts=3", expires_in_seconds: 60,
      signed_upload_url: url(0), signed_upload_urls: [url(0), url(1), url(2)], part_size_bytes: 4
    } as SignedApkUploadTicket;
    const progress: number[] = [];
    await uploadApkSigned(file, ticket, (p) => progress.push(p));
    expect(sent).toEqual([{ url: url(0), size: 4 }, { url: url(1), size: 4 }, { url: url(2), size: 2 }]);
    expect(progress[progress.length - 1]).toBe(100);
    expect(progress).toEqual([...progress].sort((a, b) => a - b));
  });

  it("refuses untrusted upload hosts", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXHR);
    const ticket = { run_id: "x", upload_token: "t", tus_endpoint: "", object_path: "runs/x/input.apk", expires_in_seconds: 60,
      signed_upload_urls: ["https://evil.example.com/storage/v1/object/upload/sign/a"] } as SignedApkUploadTicket;
    await expect(uploadApkSigned(new File(["a"], "a.apk"), ticket, () => undefined)).rejects.toThrow("untrusted");
    expect(sent).toHaveLength(0);
  });
});
