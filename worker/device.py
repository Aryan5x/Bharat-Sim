"""ADB + emulator console helpers, APK metadata and condition control."""
from __future__ import annotations

import os
import re
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path

SDK = Path(os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT") or Path(os.environ.get("LOCALAPPDATA", "")) / "Android" / "Sdk")
EXE = ".exe" if os.name == "nt" else ""
ADB = str(SDK / "platform-tools" / f"adb{EXE}")
_bt = sorted((SDK / "build-tools").iterdir()) if (SDK / "build-tools").exists() else []
AAPT2 = str(_bt[-1] / f"aapt2{EXE}") if _bt else "aapt2"

PACKAGE_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$")


class DeviceError(Exception):
    pass


@dataclass
class ApkInfo:
    package: str
    version_name: str | None
    launch_activity: str | None
    min_sdk: int | None
    target_sdk: int | None
    native_code: list[str]
    label: str | None


def apk_info(path: str) -> ApkInfo:
    out = subprocess.run([AAPT2, "dump", "badging", path], capture_output=True, text=True, timeout=60, errors="replace")
    if out.returncode != 0:
        raise DeviceError("This file is not a valid APK")
    text = out.stdout
    pkg = re.search(r"package: name='([^']+)'", text)
    if not pkg or not PACKAGE_RE.match(pkg.group(1)):
        raise DeviceError("Could not read the package name from the APK")
    ver = re.search(r"versionName='([^']*)'", text)
    act = re.search(r"launchable-activity: name='([^']+)'", text)
    sdk = re.search(r"sdkVersion:'(\d+)'", text)
    tsdk = re.search(r"targetSdkVersion:'(\d+)'", text)
    native = re.search(r"native-code: (.+)", text)
    label = re.search(r"application-label:'([^']*)'", text)
    activity = act.group(1) if act and re.match(r"^[A-Za-z0-9_.$]+$", act.group(1)) else None
    return ApkInfo(
        package=pkg.group(1),
        version_name=ver.group(1)[:80] if ver else None,
        launch_activity=activity,
        min_sdk=int(sdk.group(1)) if sdk else None,
        target_sdk=int(tsdk.group(1)) if tsdk else None,
        native_code=re.findall(r"'([^']+)'", native.group(1)) if native else [],
        label=label.group(1)[:120] if label else None,
    )


class Device:
    def __init__(self, serial: str):
        self.serial = serial

    def adb(self, *args: str, timeout: float = 60, check: bool = False) -> str:
        try:
            out = subprocess.run([ADB, "-s", self.serial, *args], capture_output=True, text=True, timeout=timeout, errors="replace")
        except subprocess.TimeoutExpired as exc:
            raise DeviceError(f"adb {' '.join(args[:2])} timed out") from exc
        if check and out.returncode != 0:
            raise DeviceError((out.stderr or out.stdout).strip()[:300] or f"adb {args[0]} failed")
        return out.stdout

    def shell(self, cmd: str, timeout: float = 90) -> str:
        return self.adb("shell", cmd, timeout=timeout)

    def emu(self, cmd: str) -> str:
        return self.adb("emu", *cmd.split(), timeout=15)

    # ---- state ----
    def online(self) -> bool:
        return self.adb("get-state", timeout=10).strip() == "device" and self.shell("getprop sys.boot_completed", 10).strip() == "1"

    def wait_ready(self, timeout: float = 180) -> None:
        end = time.time() + timeout
        self.adb("wait-for-device", timeout=timeout)
        while time.time() < end:
            try:
                if self.shell("getprop sys.boot_completed", 30).strip() == "1":
                    return
            except DeviceError:
                pass  # slow (1-core) emulators can stall a single adb call; keep waiting
            time.sleep(2)
        raise DeviceError("Emulator did not finish booting")

    def props(self) -> dict:
        return {
            "android": self.shell("getprop ro.build.version.release").strip(),
            "sdk": self.shell("getprop ro.build.version.sdk").strip(),
            "abis": self.shell("getprop ro.product.cpu.abilist").strip(),
            "ram_kb": (re.search(r"MemTotal:\s+(\d+)", self.shell("cat /proc/meminfo")) or [None, None])[1],
        }

    # ---- apps ----
    def install(self, apk: str) -> None:
        out = self.adb("install", "-r", "-g", "-t", apk, timeout=240)
        if "Success" not in out:
            reason = re.search(r"Failure \[([^\]]+)\]", out)
            raise DeviceError(f"Install failed: {reason.group(1) if reason else out.strip()[:200]}")

    def uninstall(self, package: str) -> None:
        if PACKAGE_RE.match(package):
            self.adb("uninstall", package, timeout=60)

    def pid(self, package: str) -> int | None:
        out = self.shell(f"pidof {package}", 10).strip().split()
        return int(out[0]) if out and out[0].isdigit() else None

    def uid(self, package: str) -> int | None:
        m = re.search(r"userId=(\d+)", self.shell(f"dumpsys package {package} | grep userId=", 20))
        return int(m.group(1)) if m else None

    def resolve_activity(self, package: str) -> str | None:
        out = self.shell(f"cmd package resolve-activity --brief -c android.intent.category.LAUNCHER {package}", 20)
        lines = [l.strip() for l in out.splitlines() if "/" in l]
        return lines[-1].split("/", 1)[1] if lines else None

    def focused_package(self) -> str | None:
        """Package of the resumed (focused) activity; windows such as the
        notification shade are ignored."""
        out = self.shell("dumpsys window | grep mFocusedApp", 20)
        m = re.search(r"ActivityRecord\{\S+ \S+ ([A-Za-z0-9_.]+)/", out)
        return m.group(1) if m else None

    def collapse_overlays(self) -> None:
        self.shell("cmd statusbar collapse", 10)

    # ---- system proxy (points the emulator at the host shaper) ----
    def set_proxy(self, port: int | None) -> None:
        self.shell(f"settings put global http_proxy {'10.0.2.2:%d' % port if port else ':0'}")

    # ---- conditions ----
    def console_network(self, speed: str, delay: str) -> dict:
        self.emu(f"network speed {speed}")
        self.emu(f"network delay {delay}")
        status = self.emu("network status")
        down = re.search(r"download speed:\s+(\d+)", status)
        lat = re.search(r"minimum latency:\s+(\d+).*?maximum latency:\s+(\d+)", status, re.S)
        return {
            "console_down_bps": int(down.group(1)) if down else None,
            "console_latency_ms": f"{lat.group(1)}-{lat.group(2)}" if lat else None,
        }

    def battery_saver(self, on: bool) -> bool:
        self.shell(f"settings put global low_power {1 if on else 0}")
        return self.shell("settings get global low_power").strip() == ("1" if on else "0")

    def free_data_mb(self) -> int | None:
        out = self.shell("df -k /data | tail -1")
        parts = out.split()
        return int(parts[3]) // 1024 if len(parts) >= 4 and parts[3].isdigit() else None

    def fill_storage(self, leave_mb: int) -> int | None:
        free = self.free_data_mb()
        if free is None:
            return None
        fill = free - leave_mb
        if fill > 50:
            self.shell(f"fallocate -l {fill}M /data/local/tmp/bharatsim_fill || dd if=/dev/zero of=/data/local/tmp/bharatsim_fill bs=1048576 count={fill}", 300)
        return self.free_data_mb()

    def airplane(self, on: bool) -> None:
        self.shell(f"cmd connectivity airplane-mode {'enable' if on else 'disable'}")

    # ---- hardware: RAM / cores need an emulator restart; screen is live ----
    def hardware(self) -> dict:
        ram_kb = re.search(r"MemTotal:\s+(\d+)", self.shell("cat /proc/meminfo"))
        cores = self.shell("nproc").strip()
        return {"ram_mb": int(ram_kb.group(1)) // 1024 if ram_kb else None, "cores": int(cores) if cores.isdigit() else None}

    def ensure_hardware(self, ram_mb: int, cores: int, log=print) -> dict:
        """Restart the emulator with -memory/-cores when the running one differs."""
        hw = self.hardware()
        # MemTotal is below the configured RAM (kernel reservations), so allow 20%.
        # Below 2 GB the image ignores hw.ramSize; limit_ram() handles that inside the guest.
        boot_ram = max(int(ram_mb), 2048)
        ram_mb = boot_ram
        ram_ok = hw["ram_mb"] is not None and abs(hw["ram_mb"] - ram_mb * 0.97) <= ram_mb * 0.2
        if ram_ok and hw["cores"] == cores:
            return {**hw, "restarted": False}
        if not self.serial.startswith("emulator-"):
            raise DeviceError("RAM and CPU changes need an emulator target")
        port = self.serial.split("-", 1)[1]
        avd = os.environ.get("BHARATSIM_AVD", "bharat_low")
        log(f"Restarting emulator with {ram_mb} MB RAM and {cores} cores")
        self.adb("emu", "kill", timeout=20)
        for _ in range(60):
            time.sleep(1)
            if self.serial not in subprocess.run([ADB, "devices"], capture_output=True, text=True).stdout:
                break
        # The emulator ignores -memory when the AVD sets hw.ramSize, so write the
        # requested hardware into the AVD config before booting.
        avd_home = Path(os.environ.get("ANDROID_AVD_HOME") or Path.home() / ".android" / "avd")
        cfg = avd_home / f"{avd}.avd" / "config.ini"
        if cfg.exists():
            lines = [l for l in cfg.read_text(encoding="utf-8").splitlines() if not l.startswith(("hw.ramSize=", "hw.cpu.ncore="))]
            lines += [f"hw.ramSize={int(ram_mb)}", f"hw.cpu.ncore={int(cores)}"]
            cfg.write_text("\n".join(lines) + "\n", encoding="utf-8")
        emulator = str(SDK / "emulator" / f"emulator{EXE}")
        flags = subprocess.CREATE_NEW_PROCESS_GROUP | 0x00000008 if os.name == "nt" else 0  # DETACHED_PROCESS
        subprocess.Popen(
            [emulator, "-avd", avd, "-port", port, "-no-window", "-no-audio", "-no-boot-anim", "-no-snapshot",
             "-memory", str(ram_mb), "-cores", str(cores), "-netdelay", "none", "-netspeed", "full"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, stdin=subprocess.DEVNULL,
            creationflags=flags, start_new_session=os.name != "nt",
        )
        time.sleep(5)
        self.wait_ready(300)
        time.sleep(5)
        return {**self.hardware(), "restarted": True}

    def mem_available_mb(self) -> int | None:
        m = re.search(r"MemAvailable:\s+(\d+)", self.shell("cat /proc/meminfo"))
        return int(m.group(1)) // 1024 if m else None

    def limit_ram(self, target_mb: int) -> dict:
        """Emulate a smaller phone on the 2 GB minimum image: pin (total - target) MB
        in a tmpfs balloon so apps see genuinely less available memory. Needs a
        rootable (Google APIs) image."""
        total = self.hardware()["ram_mb"] or 0
        reserve = total - int(target_mb)
        if reserve < 64:
            return {"balloon_mb": 0, "mem_available_mb": self.mem_available_mb()}
        self.adb("root", timeout=30)
        self.adb("wait-for-device", timeout=60)
        self.shell("mkdir -p /data/local/tmp/bs_balloon && mount -t tmpfs -o size=%dM tmpfs /data/local/tmp/bs_balloon" % (reserve + 16), 30)
        self.shell("dd if=/dev/zero of=/data/local/tmp/bs_balloon/fill bs=1048576 count=%d" % reserve, 180)
        return {"balloon_mb": reserve, "target_ram_mb": int(target_mb), "physical_ram_mb": total,
                "mem_available_mb": self.mem_available_mb(), "method": "tmpfs memory balloon (root)"}

    def release_ram(self) -> None:
        self.shell("rm -f /data/local/tmp/bs_balloon/fill; umount /data/local/tmp/bs_balloon 2>/dev/null; rmdir /data/local/tmp/bs_balloon 2>/dev/null", 60)

    def set_screen(self, width: int, height: int, density: int) -> dict:
        self.shell(f"wm size {int(width)}x{int(height)}")
        self.shell(f"wm density {int(density)}")
        size = self.shell("wm size").strip().splitlines()[-1:]
        dens = self.shell("wm density").strip().splitlines()[-1:]
        return {"size": size[0] if size else None, "density": dens[0] if dens else None}

    def reset_conditions(self) -> None:
        self.release_ram()
        self.shell("wm size reset")
        self.shell("wm density reset")
        self.airplane(False)
        self.battery_saver(False)
        self.shell("rm -f /data/local/tmp/bharatsim_fill")
        try:
            self.console_network("full", "none")
        except DeviceError:
            pass
