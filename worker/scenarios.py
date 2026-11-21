"""Controlled scenario packs with machine-checked assertions.

A scenario runs a scripted user journey on the emulator against a mock backend that
the worker hosts, then checks assertions against what was actually observed: the
text on screen (uiautomator) and the requests the mock backend received.

Only allowlisted scenario ids run here. Nothing from a language model reaches this
module except an id that the API has already validated against SCENARIOS.

Scenario "upi-pending-retry" (Janjeevan pack A):
  The user pays Rs 499 in BharatPay Mock (a test fixture, no real money). The mock
  gateway commits the charge but holds the bank confirmation for 9 s, longer than the
  app's 5 s timeout. The user then taps Retry. We check that the app did not tell the
  user the payment failed while it was in fact pending, that the retry did not charge
  twice, and that the final screen matches what the bank recorded.
  Fault injection is done by the mock gateway (delayed confirmation), NOT by network
  shaping; the fixture talks to the gateway directly, bypassing the shaping proxy.
"""
from __future__ import annotations

import json
import re
import threading
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Callable
from urllib.parse import parse_qs, urlparse

from .device import Device

FIXTURE_PACKAGE = "in.bharatsim.paymock"
CONFIRMATION_DELAY_S = 9.0


def utc() -> str:
    return datetime.now(timezone.utc).isoformat()


class MockGateway:
    """A tiny payment gateway on 127.0.0.1 (the emulator reaches it as 10.0.2.2)."""

    def __init__(self, confirmation_delay_s: float = CONFIRMATION_DELAY_S):
        self.delay = confirmation_delay_s
        self.charges: list[dict[str, Any]] = []
        self.requests: list[dict[str, Any]] = []
        self.results: dict[str, dict[str, Any]] = {}
        self.lock = threading.Lock()
        gateway = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):  # keep worker logs clean
                return

            def _send(self, code: int, payload: dict[str, Any]) -> None:
                body = json.dumps(payload).encode()
                try:
                    self.send_response(code)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
                except OSError:
                    pass  # the app already gave up on this request

            def do_GET(self):
                url = urlparse(self.path)
                order = (parse_qs(url.query).get("order_id") or [""])[0]
                with gateway.lock:
                    gateway.requests.append({"at": utc(), "method": "GET", "path": url.path, "order_id": order})
                    charged = any(c["order_id"] == order for c in gateway.charges)
                if url.path == "/status":
                    self._send(200, {"order_id": order, "charged": charged})
                else:
                    self._send(404, {"error": "not found"})

            def do_POST(self):
                length = min(int(self.headers.get("Content-Length") or 0), 4096)
                try:
                    data = json.loads(self.rfile.read(length) or b"{}")
                except ValueError:
                    data = {}
                order = str(data.get("order_id", ""))[:64]
                key = str(data.get("idempotency_key", ""))[:64]
                first_for_order = False
                with gateway.lock:
                    gateway.requests.append({"at": utc(), "method": "POST", "path": self.path, "order_id": order,
                                             "idempotency_key": key})
                    if key in gateway.results:
                        result = gateway.results[key]  # idempotent replay: no new charge
                    else:
                        first_for_order = not any(c["order_id"] == order for c in gateway.charges)
                        charge = {"at": utc(), "order_id": order, "idempotency_key": key, "amount": data.get("amount")}
                        gateway.charges.append(charge)
                        result = {"status": "SUCCESS", "order_id": order, "charge_no": len(gateway.charges)}
                        gateway.results[key] = result
                if first_for_order:
                    time.sleep(gateway.delay)  # the bank is slow to confirm the first attempt
                self._send(200, result)

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.port = self.server.server_address[1]
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)

    def __enter__(self) -> "MockGateway":
        self.thread.start()
        return self

    def __exit__(self, *exc) -> None:
        self.server.shutdown()
        self.server.server_close()


def ui_nodes(dev: Device) -> list[dict[str, str]]:
    """Dump the current screen with uiautomator and return its nodes."""
    for _ in range(4):
        dev.shell("uiautomator dump /sdcard/bsim_ui.xml", 30)
        xml = dev.shell("cat /sdcard/bsim_ui.xml", 15)
        start = xml.find("<?xml")
        if start >= 0:
            try:
                root = ET.fromstring(xml[start:])
                return [dict(n.attrib) for n in root.iter("node")]
            except ET.ParseError:
                pass
        time.sleep(1)
    return []


def find(nodes: list[dict[str, str]], desc: str) -> dict[str, str] | None:
    return next((n for n in nodes if n.get("content-desc") == desc), None)


def tap(dev: Device, node: dict[str, str]) -> None:
    nums = [int(v) for v in re.findall(r"\d+", node.get("bounds", ""))]
    if len(nums) == 4:
        dev.shell(f"input tap {(nums[0] + nums[2]) // 2} {(nums[1] + nums[3]) // 2}", 15)


def screen_text(dev: Device, desc: str = "status_text") -> str:
    node = find(ui_nodes(dev), desc)
    return (node or {}).get("text", "")


def wait_for_text(dev: Device, predicate: Callable[[str], bool], timeout: float) -> str:
    deadline = time.monotonic() + timeout
    text = ""
    while time.monotonic() < deadline:
        text = screen_text(dev)
        if predicate(text):
            return text
        time.sleep(1)
    return text


def run_upi_pending_retry(dev: Device, activity: str, stage: Callable[[str], None]) -> dict[str, Any]:
    pkg = FIXTURE_PACKAGE
    steps: list[dict[str, Any]] = []

    def step(name: str, **detail: Any) -> None:
        steps.append({"at": utc(), "step": name, **detail})
        stage(f"Scenario: {name}")

    dev.set_proxy(None)
    dev.reset_conditions()
    dev.shell(f"pm clear {pkg}", 30)
    dev.shell("logcat -c", 15)
    with MockGateway() as gw:
        url = f"http://10.0.2.2:{gw.port}"
        dev.shell(f"am start -W -n {pkg}/{activity} --es gateway {url}", 60)
        time.sleep(2)
        nodes = ui_nodes(dev)
        pay = find(nodes, "pay_button")
        if not pay:
            return {"status": "blocked", "reason": "Pay button not found on screen; is this the BharatPay Mock fixture?",
                    "steps": steps}
        step("tap Pay")
        tap(dev, pay)
        # The app times out at 5 s; the gateway confirms at 9 s.
        after_timeout = wait_for_text(dev, lambda t: bool(t) and "Processing" not in t, 12)
        step("state after the app's timeout", screen=after_timeout)
        retry = find(ui_nodes(dev), "retry_button")
        retry_offered = retry is not None
        if retry:
            time.sleep(1)
            step("tap Retry")
            tap(dev, retry)
        final = wait_for_text(dev, lambda t: bool(t) and "Processing" not in t, 15)
        time.sleep(CONFIRMATION_DELAY_S)  # let any in-flight first attempt finish at the gateway
        final = screen_text(dev) or final
        step("final state", screen=final)
        with gw.lock:
            charges = list(gw.charges)
            requests = list(gw.requests)

    log = dev.shell("logcat -d -v brief BSIM:V *:S", 30)
    bsim_lines = [ln.strip() for ln in log.splitlines() if "BSIM" in ln][-20:]
    order_ids = sorted({c["order_id"] for c in charges})
    lowered = after_timeout.lower()
    told_failed = "fail" in lowered
    final_low = final.lower()
    final_success = "success" in final_low
    assertions = [
        {
            "id": "no_duplicate_charge",
            "label": "A retry never charges the user twice",
            "passed": len(charges) <= 1,
            "observed": f"{len(charges)} charge(s) recorded by the gateway for order(s) {', '.join(order_ids) or 'none'}",
        },
        {
            "id": "honest_pending_state",
            "label": "While the bank has not confirmed, the app does not say the payment failed",
            "passed": bool(after_timeout) and not told_failed,
            "observed": f'Screen after the app timed out: "{after_timeout or "(no status text)"}"',
        },
        {
            "id": "final_state_matches_bank",
            "label": "The final screen matches what the bank recorded",
            "passed": bool(final) and (final_success == (len(charges) >= 1)),
            "observed": f'Final screen: "{final or "(no status text)"}"; gateway charges: {len(charges)}',
        },
    ]
    passed = all(a["passed"] for a in assertions)
    return {
        "status": "completed",
        "verdict": "pass" if passed else "fail",
        "retry_offered": retry_offered,
        "assertions": assertions,
        "steps": steps,
        "gateway": {
            "charges": charges,
            "requests": requests[-20:],
            "confirmation_delay_s": CONFIRMATION_DELAY_S,
            "app_timeout_s": 5,
        },
        "app_log": bsim_lines,
    }


SCENARIOS: dict[str, dict[str, Any]] = {
    "upi-pending-retry": {
        "title": "UPI-style payment pending + retry",
        "pack": "Janjeevan A: payments",
        "fixture_package": FIXTURE_PACKAGE,
        "fault_injection": (
            "The mock gateway on the worker host commits the charge but holds the bank confirmation for "
            f"{CONFIRMATION_DELAY_S:.0f} s (the app times out at 5 s). Network shaping is not involved; the fixture "
            "talks to the gateway directly."
        ),
        "runner": run_upi_pending_retry,
    },
}


def run_scenario(scenario_id: str, dev: Device, package: str, activity: str, stage: Callable[[str], None]) -> dict[str, Any]:
    spec = SCENARIOS.get(scenario_id)
    base = {"id": scenario_id, "started_at": utc()}
    if not spec:
        return {**base, "status": "unsupported", "reason": "Unknown scenario id", "finished_at": utc()}
    base.update({"title": spec["title"], "pack": spec["pack"], "fault_injection": spec["fault_injection"]})
    if package != spec["fixture_package"]:
        return {**base, "status": "blocked", "finished_at": utc(),
                "reason": (f"This scenario's assertions need the {spec['fixture_package']} test fixture; the uploaded "
                           f"APK is {package}. The generic baseline vs persona run still ran.")}
    try:
        result = spec["runner"](dev, activity, stage)
    except Exception as exc:  # never let a scenario failure lose the whole report
        result = {"status": "blocked", "reason": f"Scenario driver error: {str(exc)[:300]}"}
    return {**base, **result, "finished_at": utc()}
