# Changelog

## 1.18.0-ha1

- Initial add-on build, pinning AnythingLLM **1.18.0** (plain upstream
  multi-arch image for amd64 + arm64).
- Thin add-on layer: `USER root` so the app can write the root-owned
  `/data` volume, `STORAGE_DIR=/data` for persistence and
  `DISABLE_TELEMETRY=true` as a privacy default.
- Storage fix (found during the amd64 smoke test): upstream 1.18.0 does
  NOT honor `STORAGE_DIR` for the SQLite database (`schema.prisma` uses a
  literal `file:../storage/anythingllm.db`), the runtime `.env`
  (provider keys, JWT secret) or the document-upload hotdir. The add-on
  image redirects all three into `/data` via symlinks, so accounts,
  chats, vectors, documents and logins survive add-on
  updates/reinstalls (verified by recreating the container).
- Telemetry fix (also from the smoke test): 1.18.0 evaluates
  `DISABLE_TELEMETRY`; the previously set
  `DISABLE_ANONYMOUS_TELEMETRY` was silently ignored and telemetry was
  actually sent. Now disabled for real (`[TELEMETRY DISABLED]` in the
  log).
- Multi-user support is native: finish the onboarding wizard (first
  account becomes admin), then manage users/roles/workspaces from the
  built-in admin dashboard - no external tooling needed.
- Icon/logo replaced with the official AnythingLLM mark (MIT-licensed
  upstream assets).
- Verification status:
  - **arm64/ARMv8.0**: all native binaries of the 1.18.0 arm64 image
    (node, LanceDB gnu+musl, Prisma engines, sharp, canvas, onnxruntime,
    Chromium helpers, mdpdf) were statically scanned for LSE atomics and
    runtime-tested under `qemu-aarch64 -cpu cortex-a53`. The few LSE
    occurrences (mdpdf, Chromium helpers) are outline-atomics dispatch
    tables with LL/SC fallbacks - safe on ARMv8.0 devices such as the
    Odroid N2+ / Raspberry Pi 3/4. On-device confirmation on a real
    Odroid N2+ is still pending.
  - **amd64 smoke test passed**: onboarding (incl. multi-user bootstrap
    via API), streaming chat against an OpenAI-compatible endpoint, RAG
    upload → embed → LanceDB → citation, multi-user isolation for
    `default` users and admin user deletion, state persistence across
    container recreation.
  - **RAM (amd64 host, mock LLM, indicative)**: ~310 MiB idle, ~315 MiB
    during chat and embedding - in line with the documented ~300 MB
    profile and well below the ~1.1 GB LibreChat add-on stack baseline.
