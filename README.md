# AnythingLLM for Home Assistant (arm64 & amd64)

A Home Assistant add-on running [AnythingLLM](https://anythingllm.com) by
Mintplex Labs - the all-in-one, open-source AI chat application with a
built-in document pipeline (RAG), embedded storage and native multi-user
administration. Everything runs locally in a single container; you supply
the model endpoints (OpenAI, Anthropic, any OpenAI-compatible server such as
DashScope or Ollama, ...).

It targets devices like the **Hardkernel Odroid N2+** and Raspberry Pi 4/5
(aarch64) as well as x86-64 machines. The add-on is a thin layer on the
official multi-arch AnythingLLM image: no external database, no object
storage, no extra services - SQLite and the LanceDB vector store are
embedded, and all state persists on the add-on's data volume. The image also
contains an experimental local patch for DeepSeek: optional Search/Fetch APIs
(off by default), image attachments for the native provider's vision model
(`deepseek-flash`), and small CSS overrides for wide markdown tables and the
workspace-settings layout on phones; see below.

> **Status:** experimental, but verified. The 1.18.0 arm64 image passed a
> static LSE-atomics scan and ARMv8.0 runtime emulation; the 1.19.0 arm64
> binaries were re-scanned statically (same `mdpdf` 0.1.10 and Chromium
> 1088 as 1.18.0, whose QEMU cortex-a53 run proved the outline-atomics
> fallback). The 1.18.0 amd64 build passed the full smoke test (onboarding,
> chat, RAG with citations, multi-user isolation, persistence); 1.19.0-ha2
> passed a boot/API/persistence smoke test. Measured RAM: ~290 MiB idle on
> amd64 (1.19.0-ha1). Final confirmation on real Odroid N2+ hardware is
> still pending - see the add-on changelog for details.
> The add-on layer is at **1.19.0-ha2** (consistent cold backups, Open Web
> UI button, documentation fixes, an optional experimental DeepSeek
> Search/Fetch patch, native DeepSeek image support for `deepseek-flash`,
> and mobile CSS fixes for tables and workspace settings); the bundled
> AnythingLLM image is **1.19.0**.

| Architecture | Status |
| ------------ | ------ |
| aarch64 (ARMv8.0) | 1.18.0 statically + emulated verified; 1.19.0 re-scanned statically; on-device test pending |
| amd64        | 1.18.0 full smoke test; 1.19.0-ha2 boot/API/persistence smoke test passed |

## Requirements

- Home Assistant OS or Supervised, aarch64 or amd64.
- ~1.1 GB download and ~4.9 GiB free disk for the image, plus room for
  documents, the vector cache and LanceDB under `/data`.
- ~0.5 GB RAM (measured ~290 MiB idle on amd64 with 1.19.0-ha1).
  2 GB total is enough for chat and RAG; 4 GB is comfortable. A Raspberry
  Pi 3 (1 GB) is instruction-set compatible but too small to run this add-on.

## Features

- **Document RAG with citations:** upload documents to a workspace and chat
  with them; answers cite the matching chunks.
- **Workspaces:** separate document sets, settings and chats per workspace.
- **Embedded storage:** SQLite for application data and LanceDB for vectors,
  both on the add-on's `/data` volume - no external database or object
  storage.
- **Multi-user administration** built in: accounts, admin/manager/default
  roles and per-workspace access are managed from the admin dashboard.
- **Local-first:** only the model endpoints (and optional search providers)
  you configure are contacted.
- **Experimental DeepSeek support:** optional Search/Fetch APIs, image
  attachments for `deepseek-flash`, and mobile layout fixes (see below).

### Web search vs. web pages

- The agent's **Web Search** skill uses a web-search (SERP) provider over
  HTTP (Serper, SerpAPI, Brave, Bing, SearXNG, Tavily, ...). It works in
  this add-on.
- **Optional, experimental:** enable `deepseek_search` in the add-on
  configuration to use DeepSeek's in-house Search API for the agent's Web
  Search (works with `deepseek-flash`; requires `DEEPSEEK_API_KEY`).
  `deepseek_fetch` uses DeepSeek's Fetch API for the agent's "Scrape
  websites" skill instead of the local Chromium. Both are off by default;
  see the add-on documentation for limits and the upstream status.
- Browser-based **URL ingestion** and **Website Depth** are intentionally
  not enabled: the bundled Chromium is old and cannot run sandboxed in
  this container. Static HTML pages still work through the collector's
  HTTP fallback; JavaScript-heavy pages and crawling do not. See the
  add-on documentation, and disable the "Scrape websites" agent skill if
  you don't use it.

### DeepSeek images

The add-on patches the native DeepSeek provider so chat images are
forwarded to `deepseek-flash` (normal chat and agent mode). `deepseek-v4-pro`
remains text-only and still gets images stripped. No add-on option is
needed - select the native DeepSeek provider with `deepseek-flash` and
attach JPEG/PNG/GIF/WebP images as usual. PDFs are not accepted by
DeepSeek's API; they still go through the document/OCR pipeline (upload
them as workspace documents, or send them through the API with the
`application/anythingllm-document` MIME type).

A complete inventory of the build-time patches, their exact upstream
anchors and the upstream-bump checklist is in
[anythingllm/PATCHES.md](anythingllm/PATCHES.md).

### Mobile layout fixes

- On screens up to 600 px, wide markdown tables are horizontally scrollable
  instead of being clipped, so all columns stay reachable.
- In the workspace settings (gear icon in a workspace row), the forms use
  the full content width below 1280 px and the page padding drops to 16 px
  on phones. Labels and descriptions therefore no longer wrap word by word;
  at 390 px the chat-settings form grows from 131 px to 358 px. Wider
  screens keep the upstream 50 % form width.

Both are display-only CSS patches in the add-on image; no add-on option is
needed.

## How it works

| Aspect   | Detail                                                        |
| -------- | ------------------------------------------------------------- |
| Web UI   | port 3001 (mapped to 3001 by default)                         |
| Storage  | everything persists on the add-on `/data` volume              |
| Database | embedded SQLite + LanceDB (no external DB)                    |
| Services | upstream entrypoint runs the app and its document collector    |
| Config   | web UI, plus two optional DeepSeek toggles                    |

One container, one exposed port; no Redis, PostgreSQL, Meilisearch or object
storage is involved. The upstream entrypoint runs the web app and the
document collector, and the embedded database keeps all state on `/data`.

## Configuration

Configuration happens entirely in the web UI (stored in the embedded
database), apart from the two optional DeepSeek feature toggles in the
add-on's Configuration tab. See the add-on's **Documentation** tab for
details (RAG setup, providers, web search vs. web pages, the DeepSeek patch,
backups, troubleshooting).

## Installation

[![Open your Home Assistant instance and show the add-on repository dialog.](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fschlangeweile%2Fha-addon-anythingllm)

1. In Home Assistant, go to **Settings → Add-ons → Add-on Store**.
2. Open the **⋮ menu → Repositories**, add
   `https://github.com/schlangeweile/ha-addon-anythingllm`.
3. Refresh, open **AnythingLLM** from the store and click **Install**
   (the finished image is pulled for your device's architecture).
4. Start the add-on and click **Open Web UI** (or open
   `http://<home-assistant>:3001`). Complete the onboarding wizard - the
   first account becomes the administrator. For household sharing, enable
   **Multi-User Mode** under Admin Tools and create accounts with the
   **default** role.

## Backups and updates

- A Home Assistant add-on backup includes the `/data` volume with the
  SQLite database, LanceDB vectors, documents and settings.
- Backups run in cold mode: the add-on is stopped briefly while `/data` is
  copied, keeping the live SQLite database and LanceDB store consistent
  (the Supervisor defaults to hot backups).
- On every start the app applies pending database migrations automatically.
  Add-on updates simply pin a newer AnythingLLM version; your data survives.

## Updating to a newer AnythingLLM

The add-on version tracks the bundled AnythingLLM version. To move to a
newer release, bump the `ANYTHINGLLM_VERSION` default in
`anythingllm/Dockerfile` and the add-on `version` in
`anythingllm/config.yaml` - GitHub Actions builds the new images and the
supervisor offers the add-on update in the store. CI fails the build if
those two versions drift apart.

The experimental DeepSeek patches are pinned to AnythingLLM 1.19.0; on an
upstream bump the patcher must be re-checked (the image build fails if an
anchor moved). Remove the Search/Fetch patch and its two options once
upstream supports DeepSeek Search natively; the image patch can be dropped
once upstream stops treating all DeepSeek models as text-only. The full
inventory and the bump checklist are in
[anythingllm/PATCHES.md](anythingllm/PATCHES.md).

## Why this exists

Compared to the sibling
[LibreChat add-on](https://github.com/schlangeweile/ha-addon-librechat),
which ships FerretDB + PostgreSQL + Meilisearch and an admin panel,
AnythingLLM needs no external services, runs with roughly half the memory
footprint (documented ~300 MB typical / ~500 MB peak) and has user
administration built in: accounts, roles (admin/manager/default) and
per-workspace access are managed from the admin dashboard - no extra
tooling.

## Credits

- [AnythingLLM](https://github.com/Mintplex-Labs/anything-llm) by
  Mintplex Labs and contributors (MIT)

Licensed under Apache 2.0 - see [LICENSE](LICENSE).
