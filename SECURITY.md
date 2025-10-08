# Security & safety hardening

- Renderer sandboxed (`contextIsolation: true`, `nodeIntegration: false`) with a strict preload bridge.
- No remote code; all external links open in the system browser.
- Local storage via `electron-store` (JSON). No telemetry.
- Harm reduction features:
  - Weekly/monthly budgets with remaining amounts.
  - Per‑casino weekly/monthly limits with alerts.
  - Commitment mode + cooldown gate when a limit/budget is reached.
  - Session timer and quick links to help/self‑exclusion resources.
