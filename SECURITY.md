# Security & safety hardening

- Renderer sandboxed: `contextIsolation: true`, `nodeIntegration: false`, and a strict preload bridge.
- No remote code: all external links open in the system browser; no remote content is loaded into the app.
- Local storage: data is stored locally via `electron-store` (JSON). No cloud sync.
- Privacy: no telemetry.
- Harm reduction:
  - Weekly/monthly budgets with remaining amounts.
  - Per‑casino weekly/monthly limits with alerts.
  - Commitment mode + cooldown gate when a limit/budget is reached.
  - Session timer and quick links to help/self‑exclusion resources.
