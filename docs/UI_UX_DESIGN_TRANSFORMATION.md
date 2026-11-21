# BharatSim — UI/UX Design Transformation & Design System Report

## 1. Executive Summary

This document details the complete design overhaul and performance engineering of BharatSim, transitioning from inconsistent prototype styling into a cohesive, commercial-grade **Midnight Indigo** design system tailored for Android resilience and developer infrastructure.

All changes preserve 100% of the underlying API contracts, authentication workflows, test execution runners, and data integrity:
- **Frontend Test Suite:** 55 passed (vitest run)
- **Backend Test Suite:** 203 passed, 2 skipped, 1 deselected (pytest)
- **Worker Test Suite:** 111 passed (pytest)
- **TypeScript Static Verification:** 0 errors (`tsc -b --noEmit`)
- **Production Bundle:** Clean Vite build with full 8-route route-level code splitting & lazy loading

---

## 2. Design System Architecture: Midnight Indigo

The design system establishes a single, cohesive visual hierarchy inspired by the best engineering design patterns across developer infrastructure tools (Linear, Vercel, Satark, GenomeGuard).

### 2.1 Color Tokens

| Token | Hex / Value | Semantic Role |
|---|---|---|
| `--bg-base` | `#080B14` | Root viewport canvas background |
| `--bg-surface` | `#0D1220` | Primary panel, cards, and sidebar background |
| `--bg-surface-elevated` | `#121A2B` | Modals, active states, and elevated cards |
| `--bg-surface-hover` | `#172238` | Interactive hover surface tint |
| `--border-subtle` | `#1A2540` | Subtle divider and structural borders |
| `--border-default` | `#263149` | Card and input default borders |
| `--border-strong` | `#344468` | Emphasized structural elements |
| `--border-focus` | `#7667F8` | Keyboard focus ring and active inputs |
| `--accent-primary` | `#7667F8` | Primary technical brand accent (Midnight Indigo) |
| `--accent-hover` | `#9A8BFF` | Interactive state hover accent |
| `--accent-light` | `#C4BAFF` | High-contrast chips and typography gradients |
| `--accent-surface` | `rgba(118, 103, 248, 0.1)` | Subtle accent backgrounds |
| `--accent-border` | `rgba(118, 103, 248, 0.3)` | Subtle accent border highlights |
| `--accent-glow` | `0 0 24px rgba(118, 103, 248, 0.25)` | Ambient glowing indicators |
| `--success` | `#36C995` | Healthy status, passing tests, online workers |
| `--warning` | `#F4B85C` | Jitter warnings, degraded latency, medium severity |
| `--danger` | `#F16D78` | Crashes, ANRs, packet loss, offline alerts |

### 2.2 Typography Hierarchy

- **Display & Headings:** `Manrope`, 700/800 weight, tight line-heights (`1.15` - `1.25`)
- **Body & UI Controls:** `Inter`, 400/500/600 weight, legible letter-spacing
- **Telemetry & Code:** `JetBrains Mono` / `DM Mono`, monospace formatting for memory sizes, hex hashes, log lines, and latency numbers.

---

## 3. Reusable UI Component Library

Located in `frontend/src/components/ui/`:

1. **`Button` (`Button.tsx`):**
   - Variants: `primary`, `secondary`, `ghost`, `danger`, `outline`
   - Sizes: `sm`, `md`, `lg`
   - States: Loading spinner (via Lucide `Loader2`), disabled, icon slots
2. **`Card` (`Card.tsx`):**
   - Variants: `default`, `elevated`, `interactive` (with hover-lift), `accent`
   - Responsive padding options (`none`, `sm`, `md`, `lg`)
3. **`Badge` (`Badge.tsx`):**
   - Semantic variants: `neutral`, `accent`, `success`, `warning`, `danger`
   - Dot indicators for heartbeat and online states
4. **`Modal` (`Modal.tsx`):**
   - Backdrop blur, ESC key listener, focus lock, animated entrance
5. **`Skeleton` (`Skeleton.tsx`):**
   - Variants: `text`, `card`, `circle`, `rect` with pulse animation
6. **`EmptyState` (`EmptyState.tsx`):**
   - Reusable empty state view with icon, title, description, and action button slot
7. **`ProgressBar` (`ProgressBar.tsx`):**
   - Gradient fill matching semantic status, clamped percentage display

---

## 4. Key Page & Interface Redesigns

### A. Landing Page (`LandingPage.tsx`)
1. **Hero Section:** Midnight Indigo ambient spotlight (`#7667F8`), restrained headline *"Test Android Apps Under Real-World Indian Conditions."*, dual CTAs, subtle badge with flag indicator.
2. **Dynamic Specs Marquee:** Hardware, network profiles, and ML classifier inference metrics continuously scrolling.
3. **Key Stats Strip:** 5+ Personas, 4 Network Profiles, <1ms ML inference, 100% evidence-backed.
4. **Evaluator Quick Tour Integration:** Direct one-click access to preloaded demonstration scenarios.
5. **Platform Capabilities Grid:** 6 structured cards with custom icon slots, elevated hover transitions.
6. **Workflow Steps:** Staggered visual progression from APK upload to readiness score.
7. **Device Persona Showcase:** Interactive cards demonstrating hardware parameters (RAM, storage, network profile).
8. **Technical FAQ Accordion:** Expandable accordion addressing network simulation, readiness score heuristic, ML classifier centroid methodology, and Sarvam AI integration.
9. **Conversion CTA Section:** Radial gradient backdrop with direct test triggering.
10. **Engineering Footer:** 3-column navigation with repository, documentation, and issue tracker links.

### B. Workspace Sidebar (`Sidebar.tsx`)
- Linear-style collapsible navigation rail.
- Midnight Indigo active item highlight (`rgba(118, 103, 248, 0.12)` background + 2px left border).
- Responsive worker heartbeat card: pulsing emerald/teal dot (`#36C995`) for active workers, muted indicator for offline.
- Dual theme toggle (Light / Midnight Indigo) with persistent storage.

### C. Top Navigation Bar (`Topbar.tsx`)
- Breadcrumb tracking with route hierarchy.
- Live API connectivity status pill with glowing state indicator.
- Instant access button to Evaluator Quick Tour.
- High-contrast avatar badge with Midnight Indigo gradient.

### D. Dashboard & Metrics (`DashboardOverview.tsx`)
- Staggered entry animation (`stagger-child`).
- Monospace KPI cards displaying Persona count, Worker health, Run count, and Bharat Readiness Score.
- Evidence-linked recent run listings.

### E. Test Configuration Wizard (`NewTestWizard.tsx`)
- Progressively stepped workflow with smooth transition animations (`page-enter`).
- High-contrast form controls and file drag-and-drop zones.

---

## 5. Performance & Lazy Loading Verification

All major views are split using `React.lazy` and `Suspense`:
```
dist/assets/CompareRunsView-LUtTvNst.js      4.73 kB │ gzip:   1.71 kB
dist/assets/FixProofView-Cb8Yjg4c.js         5.44 kB │ gzip:   1.98 kB
dist/assets/SettingsView-DBLMfm_J.js         6.02 kB │ gzip:   1.98 kB
dist/assets/DashboardOverview-Bs4s2ljm.js    7.31 kB │ gzip:   2.13 kB
dist/assets/NewTestWizard-oT00sD12.js        9.11 kB │ gzip:   3.26 kB
dist/assets/SpeakToTestView-D2ybli_d.js     13.31 kB │ gzip:   4.61 kB
dist/assets/LandingPage-DuAajaYB.js         13.42 kB │ gzip:   4.57 kB
dist/assets/RunDetailView-BgAX1rAr.js       44.96 kB │ gzip:  11.99 kB
dist/assets/index-qiMuOU0E.js              365.60 kB │ gzip: 113.53 kB
```

Initial bundle footprint is kept minimal, allowing instant first contentful paint.

---

## 6. Accessibility & Reduced Motion

- Focus states adhere to `:focus-visible` with a 2px outline in `#7667F8`.
- Media query `@media (prefers-reduced-motion: reduce)` zeroes animation and transition durations across all components, preventing vestibular discomfort.
- Minimum WCAG AA contrast compliance across all text and border pairings in both dark and light modes.
