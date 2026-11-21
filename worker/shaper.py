"""Host-side network shaper.

The emulator's console throttling did not measurably slow TCP traffic in our
tests, so the worker routes the emulator's traffic through this proxy instead
(Android system proxy -> 10.0.2.2:<port>). It supports HTTPS CONNECT tunnels
(no TLS interception) and plain HTTP forwarding, and enforces per-profile:

- bandwidth: a token bucket per direction, in kilobits per second
- latency: a random setup delay per connection between min and max ms,
  applied twice (TCP + TLS handshakes) for tunnels
- offline: new connections are refused and open tunnels are cut

It also counts bytes in each direction, which becomes the "mobile data used"
metric. Apps that ignore the system proxy bypass it; the report says so when
no traffic was seen.
"""
from __future__ import annotations

import asyncio
import ipaddress
import random
import socket
import threading
import time
from dataclasses import dataclass, field


@dataclass
class Shape:
    down_kbps: float | None = None   # None = unlimited
    up_kbps: float | None = None
    delay_ms: tuple[int, int] = (0, 0)
    offline: bool = False
    # TCP sees loss as retransmission stalls; very lossy links also drop connections.
    loss_pct: float = 0.0
    reset_pct: float = 0.0


@dataclass
class Counters:
    bytes_down: int = 0
    bytes_up: int = 0
    connections: int = 0
    refused: int = 0
    blocked_private: int = 0
    loss_stalls: int = 0
    resets: int = 0
    hosts: set[str] = field(default_factory=set)


class Bucket:
    def __init__(self, kbps: float | None):
        self.rate = kbps * 1000 / 8 if kbps else None  # bytes per second
        # Small burst allowance so the measured rate stays close to the target.
        self.burst = min(self.rate, 16384) if self.rate else 0
        self.tokens = self.burst
        self.last = time.monotonic()

    async def take(self, n: int) -> None:
        if not self.rate:
            return
        remaining = n
        while remaining > 0:
            piece = min(remaining, self.burst)
            now = time.monotonic()
            self.tokens = min(self.burst, self.tokens + (now - self.last) * self.rate)
            self.last = now
            if self.tokens >= piece:
                self.tokens -= piece
                remaining -= piece
                continue
            await asyncio.sleep(max(0.005, (piece - self.tokens) / self.rate))


class EgressDenied(Exception):
    pass


async def resolve_public(host: str, port: int) -> str:
    """Resolve a host and refuse private, loopback, link-local, multicast and
    reserved targets, so an app under test cannot reach the worker's LAN, the
    host machine or cloud metadata endpoints through the proxy (SSRF guard)."""
    loop = asyncio.get_running_loop()
    infos = await loop.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    for _family, _, _, _, addr in infos:
        ip = ipaddress.ip_address(addr[0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved or ip.is_unspecified:
            raise EgressDenied(f"blocked non-public address for {host}")
    return infos[0][4][0]


class Shaper:
    def __init__(self, host: str = "127.0.0.1", port: int = 8899):
        self.host = host
        self.port = port
        self.shape = Shape()
        self.counters = Counters()
        self.allow_private = False  # tests may enable this to reach a local API
        self._loop: asyncio.AbstractEventLoop | None = None
        self._writers: set[asyncio.StreamWriter] = set()
        self._down = Bucket(None)
        self._up = Bucket(None)
        self._ready = threading.Event()

    # ---- control (called from the worker thread) ----
    def start(self) -> None:
        threading.Thread(target=self._run, name="shaper", daemon=True).start()
        if not self._ready.wait(10):
            raise RuntimeError("shaping proxy did not start")

    def set_shape(self, shape: Shape) -> None:
        self.shape = shape
        # Shared buckets: the profile's bandwidth is the whole "phone's" bandwidth.
        self._down = Bucket(shape.down_kbps)
        self._up = Bucket(shape.up_kbps)
        if shape.offline and self._loop:
            self._loop.call_soon_threadsafe(self._cut_all)

    def reset_counters(self) -> Counters:
        old, self.counters = self.counters, Counters()
        return old

    # ---- proxy ----
    def _run(self) -> None:
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        server = self._loop.run_until_complete(asyncio.start_server(self._handle, self.host, self.port))
        self._ready.set()
        try:
            self._loop.run_forever()
        finally:
            server.close()

    def _cut_all(self) -> None:
        for w in list(self._writers):
            try:
                w.close()
            except Exception:
                pass
        self._writers.clear()

    async def _delay(self, rounds: int = 1) -> None:
        lo, hi = self.shape.delay_ms
        if hi > 0:
            await asyncio.sleep(sum(random.uniform(lo, hi) for _ in range(rounds)) / 1000)

    async def _handle(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        try:
            head = await asyncio.wait_for(reader.readuntil(b"\r\n\r\n"), timeout=15)
        except Exception:
            writer.close()
            return
        if self.shape.offline:
            self.counters.refused += 1
            writer.close()
            return
        line = head.split(b"\r\n", 1)[0].decode("latin-1")
        try:
            method, target, _ = line.split(" ", 2)
        except ValueError:
            writer.close()
            return
        self.counters.connections += 1
        try:
            if method.upper() == "CONNECT":
                host, _, port = target.rpartition(":")
                self.counters.hosts.add(host)
                await self._delay(2)  # TCP + TLS handshakes
                target_ip = host if self.allow_private else await resolve_public(host, int(port or 443))
                up_r, up_w = await asyncio.wait_for(asyncio.open_connection(target_ip, int(port or 443)), timeout=20)
                writer.write(b"HTTP/1.1 200 Connection Established\r\n\r\n")
                await writer.drain()
                await self._pipe_both(reader, writer, up_r, up_w)
            else:
                await self._forward_http(method, target, head, reader, writer)
        except EgressDenied:
            self.counters.blocked_private += 1
            try:
                writer.write(b"HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n")
                await writer.drain()
            except Exception:
                pass
        except Exception:
            try:
                writer.write(b"HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\n\r\n")
                await writer.drain()
            except Exception:
                pass
        finally:
            try:
                writer.close()
            except Exception:
                pass

    async def _forward_http(self, method, target, head, reader, writer) -> None:
        if not target.startswith("http://"):
            raise ValueError("unsupported")
        rest = target[len("http://"):]
        hostport, _, path = rest.partition("/")
        host, _, port = hostport.partition(":")
        self.counters.hosts.add(host)
        await self._delay(1)
        target_ip = host if self.allow_private else await resolve_public(host, int(port or 80))
        up_r, up_w = await asyncio.wait_for(asyncio.open_connection(target_ip, int(port or 80)), timeout=20)
        lines = head.decode("latin-1").split("\r\n")
        lines[0] = f"{method} /{path} HTTP/1.0"
        kept = [l for l in lines[1:] if l and not l.lower().startswith(("proxy-", "connection:"))]
        request = "\r\n".join([lines[0], *kept, "Connection: close", "", ""]).encode("latin-1")
        await self._up.take(len(request))
        self.counters.bytes_up += len(request)
        up_w.write(request)
        await up_w.drain()
        await self._pipe_both(reader, writer, up_r, up_w)

    async def _pipe_both(self, c_r, c_w, u_r, u_w) -> None:
        self._writers.update({c_w, u_w})

        async def pipe(src, dst, bucket_attr: str, counter: str):
            try:
                while True:
                    chunk = await src.read(16384)
                    if not chunk or self.shape.offline:
                        break
                    await getattr(self, bucket_attr).take(len(chunk))
                    if self.shape.loss_pct and random.random() < self.shape.loss_pct / 100:
                        # One lost segment: wait a retransmission timeout before continuing.
                        self.counters.loss_stalls += 1
                        lo, hi = self.shape.delay_ms
                        await asyncio.sleep(max(0.2, random.uniform(lo, hi) / 1000 * 2))
                    if self.shape.reset_pct and random.random() < self.shape.reset_pct / 100:
                        self.counters.resets += 1
                        break
                    setattr(self.counters, counter, getattr(self.counters, counter) + len(chunk))
                    dst.write(chunk)
                    await dst.drain()
            except Exception:
                pass
            finally:
                try:
                    dst.close()
                except Exception:
                    pass

        await asyncio.gather(pipe(c_r, u_w, "_up", "bytes_up"), pipe(u_r, c_w, "_down", "bytes_down"))
        self._writers.discard(c_w)
        self._writers.discard(u_w)


# Emulator console presets, expressed for the proxy (kbps down, kbps up, delay ms).
PRESETS = {
    "full": (None, None),
    "lte": (58000, 58000),
    "hsdpa": (13980, 5760),
    "umts": (384, 384),
    "edge": (473.6, 473.6),
    "gprs": (40, 40),
    "gsm": (14.4, 14.4),
}
DELAYS = {"none": (0, 0), "umts": (35, 200), "edge": (80, 400), "gprs": (150, 550)}


def shape_for(params: dict) -> Shape:
    speed = str(params.get("network_speed", "full"))
    if ":" in speed:
        up, down = speed.split(":", 1)
        down_kbps, up_kbps = float(down), float(up)
    else:
        down_kbps, up_kbps = PRESETS.get(speed, (None, None))
    delay = str(params.get("network_delay", "none"))
    if ":" in delay:
        lo, hi = delay.split(":", 1)
        delay_ms = (int(lo), int(hi))
    else:
        delay_ms = DELAYS.get(delay, (0, 0))
    return Shape(
        down_kbps=down_kbps,
        up_kbps=up_kbps,
        delay_ms=delay_ms,
        loss_pct=float(params.get("packet_loss_pct", 0) or 0),
        reset_pct=float(params.get("reset_pct", 0) or 0),
    )
