# BharatSim — Network Simulation Verification Report

**Module:** `worker/network_shaper.py`, `worker/condition_planner.py`, `worker/condition_applicator.py`  
**Test Suite:** `worker/tests/test_network_shaper.py` (10 passed), `worker/tests/test_condition_applicator.py` (20 passed)  

---

## 1. Network Simulation Profiles

BharatSim accurately models the degradation modes of Tier-2/3 Indian cellular networks:

| Persona ID | Network Mode | Downlink Bandwidth | Uplink Bandwidth | Added Latency | Packet Loss Rate | Typical Target Condition |
|---|---|---|---|---|---|---|
| `baseline` | High-speed 4G | 12.0 Mbps | 3.0 Mbps | 35 ms | 0% | Benchmark control run |
| `congested-urban-4g` | Congested 4G | 1.8 Mbps | 400 kbps | 140 ms | 2% | Peak evening peak traffic |
| `budget-android` | Unstable 4G | 1.0 Mbps | 300 kbps | 180 ms | 2% | Weak coverage / low-cost carrier |
| `crowded-station` | Congested 3G | 750 kbps | 200 kbps | 320 ms | 4% | Railway station transit hub |
| `edge-village` | Rural 2G / Edge | 256 kbps | 96 kbps | 450 ms | 8% | Remote rural connectivity |

---

## 2. Traffic Shaping Implementation & Verification

### 2.1 Linux Kernel Traffic Control (`tc` / `netem`)
On Linux worker hosts, traffic shaping is applied to the emulator bridge interface:
```bash
# Example generated tc command for budget-android:
tc qdisc add dev eth0 root handle 1: netem delay 180ms loss 2%
tc qdisc add dev eth0 parent 1: handle 2: tbf rate 1000kbit burst 32kbit latency 400ms
```

### 2.2 Android Emulator Control Plane (`gsm speed` / `gsm delay`)
When running on emulators where root raw socket shaping is unavailable or unsupported, BharatSim applies shaping via the emulator control socket or ADB:
- `network delay <latency_ms>`
- `network speed <down_kbps>:<up_kbps>`

### 2.3 Verification & Teardown Guarantees
- **Verified Teardown:** Every test execution guarantees a reset command is issued in `finally` blocks:
  ```bash
  tc qdisc del dev eth0 root
  network delay none
  network speed full
  ```
- **Readback Verification:** The worker queries readback state (`network status` or `tc qdisc show`) to verify that the shaping parameters were actually received and active before initiating the APK test journey.
