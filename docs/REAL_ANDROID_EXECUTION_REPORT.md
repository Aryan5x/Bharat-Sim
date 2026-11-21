# BharatSim — Real Android Execution & Controlled APK Verification

**Execution Engine:** `worker/runner.py` · `scripts/ci/android-emulator-e2e.sh`  
**Test Application:** `org.bharatsim.smokeapp` (`smoke-android/app`)  
**Target Environment:** Headless Android Emulator API 35 (Pixel 2 Profile, x86_64, SwiftShader)  

---

## 1. Controlled Test APK Specifications

To verify execution without relying on unverified external third-party applications, BharatSim includes an authored, controlled test application:

- **Package Name:** `org.bharatsim.smokeapp`
- **Source Code:** `smoke-android/app/src/main/java/org/bharatsim/smokeapp/MainActivity.java`
- **Launcher Activity:** `org.bharatsim.smokeapp.MainActivity`
- **Target SDK:** Android 35
- **Engineered Test Behaviors:**
  1. **UI Exploration:** Renders title, details, and an interactive button (`primary-action`) accessible via UIAutomator2 / Appium.
  2. **Controlled Network Probe:** Initiates a chunked HTTP range request (`256 kB` binary probe) to a known target, logging diagnostic markers (`BHARATSIM_NETWORK_PROBE status=HTTP_200 duration_ms=... transport=...`).
  3. **Controlled Crash Signal Extraction:** Verified through negative tests producing `FATAL EXCEPTION` signals captured in Logcat.

---

## 2. End-to-End Execution Flow (Four Verified Scenarios)

The test journey defined in `scripts/ci/android-emulator-e2e.sh` executes 4 distinct real scenarios:

### Scenario 1: Normal Execution & Telemetry Collection
1. **Upload:** Client uploads `app-debug.apk` with persona `budget-android`.
2. **Claim:** Worker leases the run, extracts APK checksum, and downloads binary to temporary sandbox.
3. **Condition Enforcement:** Applies network delay (`180ms`), download speed (`1000 kbps`), and upload speed (`300 kbps`) to emulator control plane.
4. **Installation:** Executes `adb install -r <apk>`.
5. **Launch & Exploration:** Launches `MainActivity` via `monkey` / `am start`.
6. **Telemetry Sampling:** Collects `dumpsys gfxinfo` (frames, jank percentage) and `dumpsys meminfo` (PSS, Java heap, Native heap).
7. **Cleanup:** Uninstalls `org.bharatsim.smokeapp` and resets network shaping to `none` / `full`.
8. **Result:** Report generated with status `completed`.

### Scenario 2: Signature Conflict Install Failure
- **Test:** Re-signs `app-debug.apk` with an alternate generated keypair and uploads to an emulator where the original package is already installed.
- **Verification:** Android OS rejects installation (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`). Worker catches failure return code, cleans up, and records a truthful `failed` run with the Android OS error message.

### Scenario 3: Corrupted Manifest Failure
- **Test:** Uploads an archive with malformed XML manifest.
- **Verification:** Worker identifies installation rejection, reports `status: failed`, and preserves runner stderr.

### Scenario 4: Appium UIAutomator2 End-to-End Automation
- **Test:** Appium server connects to `emulator-5554`, finds `primary-action`, triggers button click, verifies UI status change to `"Primary action completed"`, and records HTTPS transfer times under shaped network conditions.

