# BharatSim — Performance & Bundle Optimization Report

**Build Environment:** Vite 8.3.5 / Rollup  
**Target:** Client-Side Single Page Application (`frontend/dist`)  
**Backend:** FastAPI Asynchronous API Engine  

---

## 1. Frontend Bundle Analysis

Executed production build `npm run build` with full minification and gzip compression analysis:

| Asset | Type | Raw Size | Gzip Size | Status | Notes |
|---|---|---|---|---|---|
| `dist/index.html` | HTML Entrypoint | 1.08 kB | 0.58 kB | Optimal | Minimal root entrypoint |
| `dist/assets/index-AFSs7jIJ.css` | Stylesheet | 104.44 kB | 22.37 kB | Optimal | Tailwind/custom CSS tokens, theme variables |
| `dist/assets/index-B5k3cIJ2.js` | JS Bundle | 405.32 kB | 120.00 kB | Optimal | Complete SPA with Lucide icons, React 19, audio player |

### Optimization Highlights:
- **Zero Heavy Native Dependencies:** Frontend avoids heavy Canvas charting libraries; uses clean SVG progress rings and responsive CSS grid meters.
- **Tree-Shaking:** Eliminated unused Lucide icon imports (`Gauge`, `Layers3`, `Play`, `Zap`, `Moon`, `Sun`, etc.), saving ~18 kB in bundle size.
- **Fast Build Time:** Production client builds in 2.93 seconds.

---

## 2. Backend Latency & Throughput Profile

Measured locally against FastAPI TestClient & in-memory SQLite:

| Endpoint | Average Response Time | P95 Latency | Memory Footprint |
|---|---|---|---|
| `GET /health/live` | 1.2 ms | 2.5 ms | Negligible |
| `GET /api/v1/personas` | 1.8 ms | 3.1 ms | In-memory lookup |
| `POST /api/v1/analyze/logs` (ML Inference) | 4.6 ms | 8.2 ms | ~5 MB memory |
| `POST /api/v1/plan` | 3.4 ms | 5.8 ms | Fast preflight |
| `GET /api/v1/runs` (20 items) | 6.1 ms | 11.4 ms | SQLite indexed query |

---

## 3. Serverless Compatibility (Vercel)
- Vercel Function payload size limit: **4.5 MB**.
- For APKs larger than 4.5 MB, BharatSim automatically switches to the direct Supabase Storage signed TUS resumable upload path (`/api/v1/uploads/sign`), bypassing Vercel body limits completely.
