"""Mock payment gateway and scenario guardrails (no emulator needed)."""
import json
import unittest
import urllib.request

from worker.scenarios import SCENARIOS, MockGateway, run_scenario


direct_opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def post(port, body):
    req = urllib.request.Request(f"http://127.0.0.1:{port}/pay", data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"}, method="POST")
    with direct_opener.open(req, timeout=5) as r:
        return json.loads(r.read())


def status(port, order):
    req = urllib.request.Request(f"http://127.0.0.1:{port}/status?order_id={order}")
    with direct_opener.open(req, timeout=5) as r:
        return json.loads(r.read())


class MockGatewayTests(unittest.TestCase):
    def test_new_key_charges_again_same_key_does_not(self):
        with MockGateway(confirmation_delay_s=0) as gw:
            post(gw.port, {"order_id": "ORD-1", "idempotency_key": "k1", "amount": 499})
            post(gw.port, {"order_id": "ORD-1", "idempotency_key": "k1", "amount": 499})
            self.assertEqual(len(gw.charges), 1)
            post(gw.port, {"order_id": "ORD-1", "idempotency_key": "k2", "amount": 499})
            self.assertEqual(len(gw.charges), 2)
            self.assertEqual(status(gw.port, "ORD-1"), {"order_id": "ORD-1", "charged": True})
            self.assertEqual(status(gw.port, "ORD-9"), {"order_id": "ORD-9", "charged": False})
            self.assertEqual(len(gw.requests), 5)

    def test_first_attempt_is_committed_before_the_delayed_reply(self):
        with MockGateway(confirmation_delay_s=2) as gw:
            req = urllib.request.Request(f"http://127.0.0.1:{gw.port}/pay",
                                         data=json.dumps({"order_id": "ORD-2", "idempotency_key": "a"}).encode(), method="POST")
            with self.assertRaises(Exception):
                direct_opener.open(req, timeout=0.5)  # the app's timeout fires first
            self.assertTrue(status(gw.port, "ORD-2")["charged"])  # but the bank already took the money

    def test_gateway_binds_loopback_only(self):
        with MockGateway(confirmation_delay_s=0) as gw:
            self.assertEqual(gw.server.server_address[0], "127.0.0.1")


class ScenarioGuardrailTests(unittest.TestCase):
    def test_unknown_scenario_is_unsupported(self):
        result = run_scenario("rm -rf /", None, "x", ".Main", lambda s: None)
        self.assertEqual(result["status"], "unsupported")

    def test_other_apps_are_blocked_not_faked(self):
        result = run_scenario("upi-pending-retry", None, "com.example.other", ".Main", lambda s: None)
        self.assertEqual(result["status"], "blocked")
        self.assertIn("in.bharatsim.paymock", result["reason"])
        self.assertNotIn("assertions", result)

    def test_catalog_states_fault_injection_honestly(self):
        self.assertIn("not involved", SCENARIOS["upi-pending-retry"]["fault_injection"])


if __name__ == "__main__":
    unittest.main()
