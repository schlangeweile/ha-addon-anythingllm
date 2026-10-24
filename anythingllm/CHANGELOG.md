# Changelog

## 1.18.0-ha1

- Initial add-on build, pinning AnythingLLM **1.18.0** (plain upstream
  multi-arch image for amd64 + arm64).
- Thin add-on layer only: `USER root` so the app can write the
  root-owned `/data` volume, `STORAGE_DIR=/data` for full persistence
  (SQLite, LanceDB vectors, documents, in-app `.env`) and
  `DISABLE_ANONYMOUS_TELEMETRY=true` as a privacy default.
- Multi-user support is native: finish the onboarding wizard (first
  account becomes admin), then enable **Multi-User Mode** in the admin
  settings and manage users/roles/workspaces from the built-in admin
  dashboard - no external tooling needed.
- Status: scaffolded from research only; on-device verification on the
  Odroid N2+ (ARMv8.0, no LSE) is still pending before this version
  should be considered trusted.
