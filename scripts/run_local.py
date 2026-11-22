#!/usr/bin/env python3
"""BharatSim Local Development Runner.

Starts both the FastAPI backend (port 8000) and the Vite frontend (port 5173),
verifies health endpoints, and monitors both processes.
Press Ctrl+C to terminate both cleanly.
"""
from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIR = ROOT_DIR / "frontend"


def find_python() -> str:
    candidates = [
        sys.executable,
        r"C:\Users\kaust\AppData\Local\Python\bin\python.exe",
        "python",
        "python3",
    ]
    for c in candidates:
        if os.path.isfile(c) or (os.name != "nt" and subprocess.call(["which", c], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) == 0):
            return c
    return "python"


def find_npm() -> str:
    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
    return npm_cmd


def main() -> int:
    print("=" * 60)
    print("  BharatSim - The Cheap Phone Test (Local Runner)")
    print("=" * 60)

    py_exe = find_python()
    npm_exe = find_npm()

    print(f"[*] Python:   {py_exe}")
    print(f"[*] Root Dir: {ROOT_DIR}")
    print(f"[*] Starting FastAPI backend on http://127.0.0.1:8000 ...")

    # Start FastAPI backend
    backend_env = os.environ.copy()
    backend_env["BHARATSIM_DEV_MODE"] = "true"
    backend_env["APP_ENV"] = "development"

    backend_proc = subprocess.Popen(
        [py_exe, "-m", "uvicorn", "backend.app.main:app", "--host", "127.0.0.1", "--port", "8000"],
        cwd=str(ROOT_DIR),
        env=backend_env,
    )

    # Probe backend health
    print("[*] Waiting for backend to become ready...")
    backend_ready = False
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    for _ in range(30):
        time.sleep(0.5)
        try:
            with opener.open("http://127.0.0.1:8000/health/live", timeout=2) as resp:
                if resp.status == 200:
                    backend_ready = True
                    break
        except Exception:
            pass

    if not backend_ready:
        print("[!] Backend failed to start. Terminating...")
        backend_proc.terminate()
        return 1

    print("[+] Backend is LIVE and healthy on http://127.0.0.1:8000")
    print(f"[*] Starting Vite frontend on http://localhost:5173 ...")

    frontend_proc = subprocess.Popen(
        [npm_exe, "run", "dev"],
        cwd=str(FRONTEND_DIR),
    )

    print("\n" + "=" * 60)
    print("  BharatSim is running locally!")
    print("  - Frontend UI:  http://localhost:5173")
    print("  - Backend API:  http://127.0.0.1:8000")
    print("  - API Health:   http://127.0.0.1:8000/health/live")
    print("  - Personas:     http://127.0.0.1:8000/api/v1/personas")
    print("=" * 60)
    print("  Press Ctrl+C to stop both servers cleanly.\n")

    def handle_sig(sig, frame):
        print("\n[*] Stopping BharatSim servers...")
        try:
            frontend_proc.terminate()
        except Exception:
            pass
        try:
            backend_proc.terminate()
        except Exception:
            pass
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_sig)
    signal.signal(signal.SIGTERM, handle_sig)

    try:
        while True:
            time.sleep(1)
            if backend_proc.poll() is not None:
                print("[!] Backend process exited.")
                break
            if frontend_proc.poll() is not None:
                print("[!] Frontend process exited.")
                break
    except KeyboardInterrupt:
        handle_sig(None, None)

    return 0


if __name__ == "__main__":
    sys.exit(main())
