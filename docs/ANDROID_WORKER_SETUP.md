# Android Worker & ADB Execution Pipeline

## Architecture Overview

The BharatSim Android Worker (`worker/runner.py`) is an autonomous agent responsible for executing APK smoke tests under simulated Indian hardware and network constraints.

```
+-------------------------------------------------------------+
|                     BharatSim Control API                   |
+-------------------------------------------------------------+
                              | Poll Leased Runs
                              v
+-------------------------------------------------------------+
|                 Autonomous Worker Runner                    |
|                    (worker/runner.py)                       |
+-------------------------------------------------------------+
        |                 |                      |
        v                 v                      v
+---------------+  +---------------+  +-----------------------+
|  ADB Control  |  | Network Shape |  | Telemetry Extraction  |
| - Install APK |  | - QEMU Latency|  | - gfxinfo (Jank %)    |
| - Launch Main |  | - Bandwidth   |  | - dumpsys meminfo     |
| - Monkey UI   |  | - CONNECT Pxy |  | - Logcat Streams      |
+---------------+  +---------------+  +-----------------------+
```

---

## 1. Prerequisites

- Python 3.10+
- Android SDK (`adb`, `emulator`, `aapt` or `apkanalyzer`)
- Hardware virtualization enabled (KVM on Linux, HAXM/AEHD on Windows)
- Configured AVD (Android Virtual Device), e.g. `Pixel_3a_API_30` or `Budget_Android_2GB`

---

## 2. Worker Configuration

Set the following environment variables:

```bash
export BHARATSIM_API_URL="https://bharat-sim-81g2.vercel.app"
export BHARATSIM_WORKER_SECRET="your-worker-secret"
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
```

---

## 3. Running the Worker

To launch the worker in autonomous polling mode:

```bash
python worker/runner.py --worker-id worker-alpha-01
```

### Self-Test Mode
To verify ADB connectivity and device state without leasing runs:

```bash
python worker/runner.py --self-test
```

---

## 4. Bounded UI Exploration with `adb monkey`

The worker automatically discovers the application package and default launchable Activity. To simulate real-world human interaction without escaping the application sandbox, it executes bounded `monkey` events:

```bash
adb shell monkey -p <package_name> \
  --throttle 250 \
  --pct-touch 70 \
  --pct-motion 20 \
  --pct-syskeys 0 \
  --pct-appswitch 0 \
  100
```

- **`--pct-syskeys 0`**: Prevents monkey from pressing Home, Back, or Volume keys to exit the application.
- **`--pct-appswitch 0`**: Prevents switching to external applications or opening the settings panel.
- **`--throttle 250`**: Inserts a 250ms pause between actions, reflecting realistic interaction speeds.

---

## 5. Telemetry Capture: Gfxinfo & Meminfo

After the exploration sequence completes, the worker queries Android subsystems:

1. **Jank Frames Analysis (`dumpsys gfxinfo <package>`)**:
   - Parses total frames rendered.
   - Calculates percentage of janky frames exceeding the 16.6ms frame deadline (60 FPS budget).
2. **Memory Analysis (`dumpsys meminfo <package>`)**:
   - Parses Native Heap, Dalvik Heap, Total PSS, and Private Dirty pages.
   - Flags potential memory leaks and near-OOM conditions under 2GB RAM limits.
