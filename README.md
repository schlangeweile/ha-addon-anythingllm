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
embedded, and all state persists on the add-on's data volume. DeepSeek web
search and image attachments are built in since 1.20; the image adds an
optional free DeepSeek server-side search mode for normal chat and an optional
Fetch patch for the agent's scrape skill (both off by default). See below.

> **Status:** experimental, but verified on amd64. The 1.20.0-ha2 image
> passes a 14/14 API smoke test (boot, multi-user bootstrap, provider config,
> document upload + embedding, streaming chat, automatic thread names, thread
> activity, PWA manifest and CSP) and a 24/24 UI smoke on desktop 1440x900
> (dark) and mobile 390x844 (light): context label, token metrics, no phantom
> thread row, show-older limit, preserved line breaks, always-visible
> actions, workspace collapse/expand, search dismissal and no page errors.
> Container recreation keeps the database, runtime `.env`/JWT, workspaces and
> chats; the DeepSeek Fetch and server-tools patches were exercised through
> mock APIs (server tools 8/8: request tools on/off, image still sent, sources
> in stream, saved chat and UI). The 1.20.0-ha3 image only changes the
> agent's DeepSeek search payload and the collector's HTTP fallback status
> handling (see below); the UI is unchanged, so the ha2 UI smoke still
> applies.
> The arm64 base image was re-scanned statically for ARMv8.0 and Node 24.22.2,
> LanceDB 0.30 (including a real table create), the Prisma query engine,
> canvas, sharp, onnxruntime, mdpdf and the bundled Chromium 119 run under
> `qemu-aarch64 -cpu cortex-a53`. Final confirmation on real Odroid N2+
> hardware is still pending - see the add-on changelog for details.
> RAM: the last measurement was ~290 MiB idle on amd64 (1.19.0-ha1); no new
> measurement was taken for 1.20.0 because the embedded stack is unchanged.
> The add-on layer is at **1.20.0-ha3** (AnythingLLM **1.20.0**): upstream
> now ships the DeepSeek vision and web-search work, the dynamic PWA
> manifest, the mobile sidebar search, the live thinking timer and the
> responsive table/settings CSS, so the add-on patch/fork surface is smaller
> than in 1.19.0. The add-on keeps the optional DeepSeek server-tools and
> Fetch patches, restores DeepSeek's long search summary for the agent and
> rejects HTTP error pages in the scraper fallback (both ha3), the CSP,
> thread activity/name handling, the PWA icon set and
> the remaining UI fork improvements (thread limit, collapse, search
> dismissal, token metrics, context label, line breaks, wake lock).

| Architecture | Status |
| ------------ | ------ |
| aarch64 (ARMv8.0) | 1.20.0 base statically scanned; native modules emulated on cortex-a53; on-device test pending |
| amd64        | 1.20.0-ha1 API 14/14, UI 24/24 (desktop/mobile), persistence; 1.20.0-ha2 server-tools 8/8 and UI sources passed; 1.20.0-ha3 patch anchors re-verified |

## Requirements

- Home Assistant OS or Supervised, aarch64 or amd64.
- ~1.2 GB download and ~4.9 GiB free disk for the image, plus room for
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
- **DeepSeek:** built-in agent web search and image attachments for
  `deepseek-flash` since 1.20; the add-on adds an optional **free
  server-side search/URL reading in normal chat** and an optional Fetch path
  for the agent's scrape skill.
- **UI refinements from the add-on fork:** configurable thread limit with
  "show older", newest-first order by activity, collapsible workspaces,
  dismissible sidebar search, token usage and `model · workspace` context
  labels, preserved line breaks in your own messages, always-reachable
  message actions (edit/resend) and an optional screen wake lock. All are
  client-side preferences; no new add-on options.

### Web search vs. web pages

- The agent's **Web Search** skill uses a web-search (SERP) provider over
  HTTP (Serper, SerpAPI, Brave, Bing, SearXNG, Tavily, DeepSeek, ...). It
  works in this add-on. DeepSeek is built in since 1.20: select it under
  *Agent Skills -> Web Search* and set its own `AGENT_DEEPSEEK_API_KEY`.
- **Optional, experimental:** enable `deepseek_server_tools` to let DeepSeek
  search the web and read URLs **inside normal chat**; those server-side
  searches are not billed, only model tokens. It needs a DeepSeek flash model
  and does not apply to the agent (DeepSeek cannot combine the server tools
  with function tools).
- **Optional, experimental:** enable `deepseek_fetch` in the add-on
  configuration to let the agent's "Scrape websites" skill fetch single
  URLs through DeepSeek's Fetch API instead of the local Chromium. It is
  off by default and reuses `DEEPSEEK_API_KEY`.
- Browser-based **URL ingestion** and **Website Depth** are intentionally
  not enabled: the bundled Chromium is old and cannot run sandboxed in
  this container. Static HTML pages still work through the collector's
  HTTP fallback; JavaScript-heavy pages and crawling do not. See the
  add-on documentation, and disable the "Scrape websites" agent skill if
  you don't use it.

### DeepSeek images

Since AnythingLLM 1.20 the native DeepSeek provider forwards chat images
itself, so the earlier add-on patch is gone. Select the native DeepSeek
provider with `deepseek-flash` and attach JPEG/PNG/GIF/WebP images as usual
(normal chat and agent mode); `deepseek-v4-pro` remains text-only. PDFs are
not accepted by DeepSeek's API; they still go through the document/OCR
pipeline (upload them as workspace documents, or send them through the API
with the `application/anythingllm-document` MIME type).

A complete inventory of the build-time patches, their exact upstream
anchors and the upstream-bump checklist is in
[anythingllm/PATCHES.md](anythingllm/PATCHES.md).

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
database), apart from the optional `deepseek_fetch` toggle in the add-on's
Configuration tab. See the add-on's **Documentation** tab for
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

The add-on patches are pinned to AnythingLLM 1.20.0; on an upstream bump the
patcher must be re-checked (the image build fails if an anchor moved). The
DeepSeek Search and vision patches are gone because upstream implements
them; the optional Fetch and normal-chat server-tools patches remain. The
full inventory and the bump checklist are in
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
