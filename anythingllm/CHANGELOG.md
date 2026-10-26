# Changelog

## 1.18.0-ha4

- Experimental local patch (not upstream): the native DeepSeek provider now
  forwards image attachments to vision-capable models. Upstream 1.18.0
  hard-codes DeepSeek as text-only and drops images in both the normal chat
  prompt builder (`AiProviders/deepseek`) and the agent provider
  (`aibitat/providers/deepseek`). Both are patched to send OpenAI-style
  `image_url` blocks for `deepseek-flash` (and the legacy
  `deepseek-v4-flash-vision-exp` alias); `deepseek-v4-pro` and other
  text-only models still have images stripped so requests do not fail.
- No new add-on options: select the native DeepSeek provider with
  `deepseek-flash` and attach JPEG/PNG/GIF/WebP images. PDFs are not
  accepted by DeepSeek's API and still go through the document/OCR path.
- Patcher: two new snippets (`deepseek-chat-images.js`,
  `deepseek-agent-images.js`) and anchors in `apply.js`; the build fails if
  the upstream code moves. The patch is still pinned to AnythingLLM 1.18.0.
- Tests: patched image built; prompt construction verified for normal chat
  and agent mode (an image becomes an `image_url` block for
  `deepseek-flash`), while `deepseek-v4-pro` still strips images. No real
  DeepSeek key was used.
- Docs: README and DOCS describe the image support, the model requirement
  and the PDF distinction.

## 1.18.0-ha3

- Experimental local patch (not upstream): optional **DeepSeek Search and
  Fetch** support. Upstream AnythingLLM 1.18.0 has no DeepSeek web-search
  provider, so the image now patches the server at build time
  (`patches/`):
  - `deepseek-search` calls DeepSeek's in-house Search API
    (`POST /v1/tools/search`), maps the results to the provider format and
    reports citations. It works with `deepseek-flash` because the Search
    API is model-independent, and reuses `DEEPSEEK_API_KEY`.
  - an optional DeepSeek Fetch path (`POST /v1/tools/fetch`) lets the
    agent's "Scrape websites" skill read a single URL as Markdown instead
    of using the local Chromium. It is not a crawler; workspace URL
    ingestion and "Website Depth" still use the collector.
- New add-on options `deepseek_search` and `deepseek_fetch` (both default
  off) plus translations. While `deepseek_search` is enabled it overrides
  the built-in Web Search provider (the agent-skill UI may still show
  You.com). The feature is agent-mode only.
- The patcher fails the build if the pinned upstream version (`1.18.0`)
  or one of its anchors changes. The image is therefore no longer purely
  "thin" for this feature; an upstream provider is the clean long-term
  path and the patch can be removed when it lands.
- Tests: patched image built successfully; a mock DeepSeek API exercised
  the Search helper, the Fetch helper, `CollectorApi#getLinkContent` and
  the `web-browsing` provider override; the app booted with `/api/ping`
  200. No real DeepSeek key was used for the test.
- Docs: README and DOCS describe the options, prerequisites, limits,
  billing/privacy and the upstream status.

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
