"""Build the two sample APKs with the plain Android SDK tools (no Gradle).

    python fixtures/build.py

Needs JDK 17+ on PATH and Android SDK build-tools + a platform jar. Outputs
fixtures/out/fragile-news.apk and fixtures/out/steady-notes.apk, signed with a
local debug key (fixtures/out/debug.keystore, never committed).
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
SDK = Path(os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT") or Path(os.environ["LOCALAPPDATA"]) / "Android" / "Sdk")
BUILD_TOOLS = sorted((SDK / "build-tools").iterdir())[-1]
PLATFORM_JAR = sorted((SDK / "platforms").iterdir())[-1] / "android.jar"
EXE = ".exe" if os.name == "nt" else ""
BAT = ".bat" if os.name == "nt" else ""

APPS = {
    "fragile-news": {"package": "in.bharatsim.fragile", "label": "Fragile News", "version": "1.0"},
    "steady-notes": {"package": "in.bharatsim.steady", "label": "Steady Notes", "version": "1.0"},
}

MANIFEST = """<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="{package}" android:versionCode="1" android:versionName="{version}">
    <uses-sdk android:minSdkVersion="24" android:targetSdkVersion="34" />
    <uses-permission android:name="android.permission.INTERNET" />
    <application android:label="{label}" android:allowBackup="false">
        <activity android:name=".MainActivity" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
"""


def run(cmd: list[str], **kw) -> None:
    print("  $", " ".join(str(c) for c in cmd[:3]), "...")
    subprocess.run([str(c) for c in cmd], check=True, **kw)


def keystore() -> Path:
    ks = OUT / "debug.keystore"
    if not ks.exists():
        run(["keytool", "-genkeypair", "-keystore", ks, "-storepass", "android", "-keypass", "android",
             "-alias", "bharatsim", "-keyalg", "RSA", "-keysize", "2048", "-validity", "3650",
             "-dname", "CN=BharatSim Samples,O=Team Deccans,C=IN"])
    return ks


def build(name: str, meta: dict) -> Path:
    print(f"Building {name}")
    src = HERE / name / "src"
    work = OUT / f"{name}-build"
    shutil.rmtree(work, ignore_errors=True)
    (work / "classes").mkdir(parents=True)
    manifest = work / "AndroidManifest.xml"
    manifest.write_text(MANIFEST.format(**meta), encoding="utf-8")
    sources = [str(p) for p in src.rglob("*.java")]
    run(["javac", "--release", "11", "-classpath", PLATFORM_JAR, "-d", work / "classes", *sources])
    classes = [str(p) for p in (work / "classes").rglob("*.class")]
    run([BUILD_TOOLS / f"d8{BAT}", "--release", "--min-api", "24", "--lib", PLATFORM_JAR, "--output", work, *classes])
    unsigned = work / "unsigned.apk"
    run([BUILD_TOOLS / f"aapt2{EXE}", "link", "-I", PLATFORM_JAR, "--manifest", manifest, "-o", unsigned])
    with zipfile.ZipFile(unsigned, "a", zipfile.ZIP_DEFLATED) as z:
        z.write(work / "classes.dex", "classes.dex")
    aligned = work / "aligned.apk"
    run([BUILD_TOOLS / f"zipalign{EXE}", "-f", "-p", "4", unsigned, aligned])
    final = OUT / f"{name}.apk"
    run([BUILD_TOOLS / f"apksigner{BAT}", "sign", "--ks", keystore(), "--ks-pass", "pass:android",
         "--key-pass", "pass:android", "--ks-key-alias", "bharatsim", "--out", final, aligned], shell=os.name == "nt")
    shutil.rmtree(work, ignore_errors=True)
    print(f"  -> {final} ({final.stat().st_size // 1024} KB)")
    return final


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    targets = sys.argv[1:] or list(APPS)
    for t in targets:
        build(t, APPS[t])
