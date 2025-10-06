# Security & safety hardening

- **Renderer sandboxed**: `contextIsolation: true`, `nodeIntegration: false`, and a strict preload bridge.
- **No remote code**: all external links open in the system browser; no remote content is loaded into the app.
- **Local storage**: data is stored locally via `electron-store` (JSON). No cloud sync.
- **Privacy**: no telemetry.
- **Harm reduction**:
  - Weekly/monthly budgets with prominent remaining amounts.
  - **Commitment mode**: when budgets are hit, adding more spending requires a typed reason and a short cooldown timer.
  - Session timer in the footer to encourage breaks.
  - Quick access to help/self-exclusion resources.
