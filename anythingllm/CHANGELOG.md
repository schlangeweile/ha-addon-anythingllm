# Changelog

## 1.19.0-ha2

- Narrow-screen workspace settings: upstream 1.19.0 pins every settings
  form to `w-1/2` and pads the page with a fixed `px-16` (64 px per side),
  so on a phone the form is only half of an already narrow content column
  and labels/descriptions wrap word by word. The image now appends a CSS
  override: below the xl breakpoint (1280 px) the forms use the full
  content width, and below md (768 px) the page padding drops to 16 px.
  At 390 px the chat-settings form grows from 131 px to 358 px (the first
  description shrinks from 144 px to 48 px tall); at a 696 px desktop
  window it grows from 141 px to 377 px. Screens at 1280 px and wider keep
  the upstream 50 % width (verified 539.5 of 1079 px at 1512 px).
  Display-only: no option, API or data change.
- Patch layer: new `patches/snippets/workspace-settings-responsive.css`
  and step 7 in `patches/apply.js`. `apply.js` verifies that the `.w-1/2`
  and `.px-16` rules exist, appends the override once (marker
  `anythingllm-ha: workspace-settings-responsive`) and fails the build if
  either upstream class is gone.
- Tests: amd64 image rebuilt; add-on linter clean; the marker is present
  exactly once. Headless Chromium at 390x844 (mobile UA) and 696x1074
  (desktop UA) shows the fixed layout; the general-appearance,
  vector-database and agent-config forms are also full width at 390 px,
  and there is no horizontal body overflow. Restarting the container kept
  the login, workspace and SQLite state.
- Docs: README, DOCS and PATCHES.md describe the narrow-screen behaviour,
  the new patch and its removal condition. Upstream `master` still uses
  the fixed `w-1/2` form width (checked 2026-10-29).

## 1.19.0-ha1

- Bump the pinned upstream image to **AnythingLLM 1.19.0** (plain
  multi-arch tag, linux/amd64 + linux/arm64). The add-on layer is
  otherwise unchanged; the build-time patch layer runs again on top of
  the new upstream files.
- Patch inventory re-checked against v1.19.0: upstream still has no
  native DeepSeek Search/Fetch provider, still treats the native DeepSeek
  provider as text-only, and still clips wide markdown tables. All four
  add-on patches remain necessary. `EXPECTED_VERSION` in
  `patches/apply.js` is now `1.19.0`; every server anchor and the
  `.markdown table` CSS anchor still match, so the snippets are
  unchanged.
- Integration points re-checked: the upstream entrypoint, the SQLite
  datasource in `schema.prisma`, the runtime `.env` path, the collector
  hotdir and the `DISABLE_TELEMETRY` opt-out are unchanged from 1.18.0.
  The three storage symlinks and the telemetry default stay as they were.
- Upstream 1.19.0 adds an optional built-in local LLM (Lemonade /
  llama.cpp) and color palettes. The built-in engine is off by default
  and is not enabled by this add-on; remote OpenAI-compatible endpoints
  remain the recommended path, especially on the 4 GB Odroid N2+.
- Tests: amd64 image built (4.89 GB uncompressed) and smoke-tested. The
  container booted, `/api/ping` returned `{"online":true}`, all patched
  files and the table-scroll marker are present, telemetry is disabled,
  the storage symlinks point into `/data`, and a restart kept the SQLite
  DB. Idle RAM: ~290 MiB.
- ARMv8.0: the 1.19.0 arm64 image was re-scanned statically. `node`,
  `canvas`, LanceDB, Prisma, ONNX Runtime and sharp are clean; the only
  LSE hits are the known outline-atomics dispatch tables in the Chromium
  1088 helpers and `mdpdf` 0.1.10. Both versions are unchanged from
  1.18.0, where the LL/SC fallback was runtime-proven under QEMU
  cortex-a53. The built-in LLM adds no native binaries to the image
  (models/runtimes download at first use).
- Docs: README, DOCS and PATCHES.md updated for 1.19.0.

## 1.18.0-ha5

- Mobile tables: wide markdown tables are now horizontally scrollable on
  screens up to 600 px. Upstream 1.18.0 clips them with
  `.markdown table { width: 100%; overflow: hidden; }` and has no scroll
  wrapper; the add-on appends a small CSS override
  (`.markdown table { display: block; overflow-x: auto; ... }`) at build
  time. No add-on option is needed and wider screens keep the normal
  table layout.
- Patch layer: new `patches/snippets/markdown-table-scroll.css` and step 6
  in `patches/apply.js`. The step verifies the upstream `.markdown table`
  rule exists, appends the override once (marker
  `anythingllm-ha: markdown-table-scroll`) and fails the build if the CSS
  anchor moved.
- `PATCHES.md` now lists the table-scroll patch, its append guard, the
  removal condition and the updated upstream-bump checklist.
- Tests: patched image built; the marker/CSS is present in the built
  `index.css`; the override was rendered at 390 px in a headless browser
  and all table columns were reachable by horizontal scrolling. No real
  DeepSeek key was used.
- Docs: README and DOCS describe the mobile-table behaviour and the
  troubleshooting note.

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
