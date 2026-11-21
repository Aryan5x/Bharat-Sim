"""BharatSim laptop lab: keeps an Android emulator and the worker running on any Windows, macOS or Linux machine.

    python -m worker.lab            # uses $BHARATSIM_HOME/worker.env (default ~/.bharatsim or %LOCALAPPDATA%\\BharatSim)

Installed and started by the BharatSim installer (bharatsim.onrender.com/connect). Every 20 s it checks that the
emulator is running and booted, and that the worker process is alive, restarting whichever stopped. The worker
uses the personal key from worker.env, so it only ever runs the signed-in owner's own tests.
"""
from __future__ import annotations

import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

EXE = ".exe" if os.name == "nt" else ""


def default_home() -> Path:
    if os.name == "nt":
        return Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "BharatSim"
    return Path.home() / ".bharatsim"


HOME = Path(os.environ.get("BHARATSIM_HOME") or default_home())
LOGS = HOME / "logs"


def log(message: str) -> None:
    LOGS.mkdir(parents=True, exist_ok=True)
    line = f"[{datetime.now().isoformat(timespec='seconds')}] {message}"
    print(line, flush=True)
    with (LOGS / "lab.log").open("a", encoding="utf-8") as f:
        f.write(line + "\n")


def load_env() -> None:
    env_file = HOME / "worker.env"
    if not env_file.exists():
        sys.exit(f"Missing {env_file}. Run the BharatSim installer first.")
    for raw in env_file.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ[key.strip()] = value.strip()
    os.environ.setdefault("ANDROID_SERIAL", "emulator-5554")
    os.environ.setdefault("BHARATSIM_AVD", "bharat_low")
    os.environ.setdefault("BHARATSIM_WORKER_ENGINE", "engine")
    os.environ.setdefault("BHARATSIM_ENABLE_LOCAL_APK_EXECUTION", "true")


def sdk() -> Path:
    return Path(os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT") or HOME / "android-sdk")


def adb(*args: str, timeout: float = 20) -> str:
    try:
        return subprocess.run([str(sdk() / "platform-tools" / f"adb{EXE}"), *args], capture_output=True,
                              text=True, timeout=timeout, errors="replace").stdout
    except (OSError, subprocess.TimeoutExpired):
        return ""


def emulator_booted(serial: str) -> bool:
    if f"{serial}\tdevice" not in adb("devices"):
        return False
    return adb("-s", serial, "shell", "getprop", "sys.boot_completed").strip() == "1"


def emulator_process_running() -> bool:
    try:
        if os.name == "nt":
            out = subprocess.run(["tasklist", "/FI", "IMAGENAME eq qemu-system-x86_64.exe"], capture_output=True, text=True).stdout
            out += subprocess.run(["tasklist", "/FI", "IMAGENAME eq qemu-system-aarch64.exe"], capture_output=True, text=True).stdout
            return "qemu-system" in out
        return subprocess.run(["pgrep", "-f", "qemu-system"], capture_output=True).returncode == 0
    except OSError:
        return False


def start_emulator(avd: str, serial: str) -> bool:
    if not emulator_process_running():
        log(f"starting emulator {avd}")
        flags = (subprocess.CREATE_NEW_PROCESS_GROUP | 0x00000008) if os.name == "nt" else 0  # DETACHED_PROCESS
        with (LOGS / "emulator.log").open("ab") as out:
            subprocess.Popen(
                [str(sdk() / "emulator" / f"emulator{EXE}"), "-avd", avd, "-no-snapshot-save", "-no-boot-anim",
                 "-no-audio", "-gpu", "swiftshader_indirect"],
                stdout=out, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL,
                creationflags=flags, start_new_session=os.name != "nt",
            )
    for _ in range(72):  # up to 6 minutes for a cold boot
        time.sleep(5)
        if emulator_booted(serial):
            log("emulator booted")
            return True
    log("emulator did not boot in 6 minutes; see logs/emulator.log")
    return False


def start_worker() -> subprocess.Popen:
    log(f"starting worker {os.environ.get('BHARATSIM_WORKER_ID')} against {os.environ.get('BHARATSIM_API_URL')}")
    app_dir = Path(__file__).resolve().parent.parent
    out = (LOGS / "worker.log").open("ab")
    return subprocess.Popen([sys.executable, "-u", "-c", "from worker.agent import main; raise SystemExit(main())"],
                            cwd=str(app_dir), stdout=out, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL)


def main() -> int:
    load_env()
    LOGS.mkdir(parents=True, exist_ok=True)
    serial, avd = os.environ["ANDROID_SERIAL"], os.environ["BHARATSIM_AVD"]
    log(f"lab supervisor started (home {HOME})")
    adb("start-server", timeout=30)
    worker: subprocess.Popen | None = None
    missing = 0
    while True:
        try:
            # The engine itself restarts the emulator for 3-4 GB personas: only step in when the emulator
            # process has been gone for two checks in a row.
            missing = 0 if emulator_process_running() else missing + 1
            if missing >= 2 or (missing >= 1 and (worker is None or worker.poll() is not None)):
                start_emulator(avd, serial)
                missing = 0
            if (worker is None or worker.poll() is not None) and emulator_booted(serial):
                if worker is not None:
                    log(f"worker exited with code {worker.returncode}; restarting")
                worker = start_worker()
        except Exception as exc:  # keep supervising whatever happens
            log(f"error: {exc}")
        time.sleep(20)


if __name__ == "__main__":
    raise SystemExit(main())
