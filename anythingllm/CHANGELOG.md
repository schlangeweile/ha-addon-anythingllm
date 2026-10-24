# Changelog

## 1.18.0-ha2

- Add-on config and documentation update only - the bundled AnythingLLM
  image stays at 1.18.0 (the 1.18.0-ha1 ARMv8.0 scan and smoke-test results
  still apply).
- Backups: set `backup: cold`. The current Supervisor defaults to hot
  backups, which would copy the live SQLite database and LanceDB store
  while the app is writing. Cold mode stops the add-on briefly and keeps
  the backup consistent.
- Web UI: added `webui` so Home Assistant shows the **Open Web UI** button
  instead of requiring the URL to be typed manually.
- Removed `init: false`: the upstream image has no init of its own (no S6),
  so the Supervisor default (`init: true`, Docker tini as PID 1) is correct.
- Web scraping / URL ingestion: deliberately left on the safe path
  (Variant B - no `--no-sandbox`, no `SYS_ADMIN`). The bundled Chromium
  is from the Chrome 119 era (late 2023) and cannot run sandboxed as
  root. Static HTML URLs keep working through the collector's HTTP
  fallback; JavaScript-heavy pages and "Website Depth" are not supported.
  The SERP-based agent "Web Search" is unaffected. Documented in
  `DOCS.md`, including the recommendation to disable the built-in
  "Scrape websites" skill when it is not used.
- Docs: corrected the telemetry note (the container environment variable
  cannot be overridden from the web UI), the SYS_ADMIN/Chromium statement,
  and the Raspberry Pi 3/RAM claim; added image/disk requirements, the
  cold-backup note and troubleshooting entries for the expected Puppeteer
  errors.
- README: fixed the one-click install badge - the my-link redirect expects
  `repository_url`, not `repository`; added requirements and the web
  search/web pages distinction.
- CI: the build now fails if the add-on version in `config.yaml` (without
  the `-haN` suffix) and the `ANYTHINGLLM_VERSION` Dockerfile ARG drift
  apart. Linter is clean.

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
