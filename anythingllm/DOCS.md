# AnythingLLM

All-in-one, open-source AI chat application by Mintplex Labs with a
built-in document pipeline (RAG), embedded storage and native
multi-user administration. Runs fully local; bring your own model
endpoints (OpenAI, Anthropic, Google, any OpenAI-compatible server such
as DashScope/Ollama, and more).

## How it works

The add-on is a single service based on the official multi-arch
AnythingLLM image, plus an experimental local patch for DeepSeek: the
optional Search/Fetch APIs (off by default) and image attachments for the
native provider's `deepseek-flash` vision model. Inside the container the
upstream entrypoint runs the web app and its document collector; the
embedded SQLite database and the LanceDB vector store require no external
services.

| Aspect   | Detail                                                      |
| -------- | ----------------------------------------------------------- |
| Web UI   | port 3001 (mapped to 3001 by default)                       |
| Storage  | everything persists on the add-on `/data` volume            |
| Database | embedded SQLite + LanceDB (no external DB)                  |
| Config   | web UI, plus two optional DeepSeek toggles in the add-on config |

## Requirements

- aarch64 (ARMv8.0) or amd64, Home Assistant OS or Supervised.
- ~1 GB download and ~4.4 GiB free disk for the image, plus space for
  documents, the vector cache and LanceDB under `/data`.
- ~0.5 GB RAM (measured ~310 MiB idle on amd64). 2 GB total is enough
  for chat and RAG; 4 GB is comfortable. A Raspberry Pi 3 (1 GB) is
  instruction-set compatible but too small for this add-on.

Anonymous telemetry is disabled in the add-on image
(`DISABLE_TELEMETRY=true`). The in-app setting under Admin Tools →
**Privacy & Data Handling** cannot re-enable it while the container
environment variable is set; removing the variable requires rebuilding
the image. The log confirms the opt-out with `[TELEMETRY DISABLED]`.

## Capabilities

The add-on needs no extra capabilities (`full_access`, `SYS_ADMIN`,
devices or host network are NOT required) for chat, document RAG and
multi-user operation. The upstream entrypoint only runs Node processes
and Prisma migrations - nothing touches the host.

Upstream's `--cap-add SYS_ADMIN` is for the Chromium sandbox used by web
scraping, not for the optional local LLM alone. This add-on deliberately
does not add it: the app runs as root so it can write the root-owned
`/data` volume, and Chromium refuses to run as root without `--no-sandbox`
even when `SYS_ADMIN` is present. The unsandboxed mode is not enabled -
see the next section.

## Web search and web pages

Two different features are easy to confuse:

- **Web Search** (agent skill) uses a web-search (SERP) provider
  configured under Agent Skills, e.g. Serper, SerpAPI, Brave, Bing,
  SearXNG, Tavily or DuckDuckGo. This is a plain HTTP API call and works
  in the add-on. Alternatively, the optional `deepseek_search` toggle
  uses DeepSeek's own Search API (see below).
- **Scrape websites / URL ingestion** renders the page with the Chromium
  bundled in the upstream image. This add-on intentionally does not
  enable Chromium: the bundled browser is from the Chrome 119 era (late
  2023) and the container cannot provide its sandbox. Static HTML pages
  are still fetched through the collector's HTTP fallback, but
  JavaScript-heavy pages and the "Website Depth" crawler do not work.
  Those attempts show a Puppeteer error in the collector log. The
  optional `deepseek_fetch` toggle lets the agent's "Scrape websites"
  skill fetch single URLs through DeepSeek's Fetch API instead.

The reduced feature set is deliberate: the alternative would be running an
outdated Chromium without a sandbox as root. The SERP-based Web Search
skill, model providers with server-side search (for example Perplexity or
OpenRouter `:online` models) and search MCP servers are unaffected. The
optional DeepSeek patch below is the one exception: it uses DeepSeek's
HTTP APIs, not the local browser. If you don't need browser-based URL
scraping, disable the built-in "Scrape websites" skill (unless you use
`deepseek_fetch`).

### Optional: DeepSeek Search and Fetch (experimental local patch)

Upstream AnythingLLM 1.18.0 has no DeepSeek web-search provider, so this
add-on image contains a small local patch (the image is therefore no
longer purely "thin" for this feature). Both toggles are **off by
default** and live in the add-on's **Configuration** tab:

- `deepseek_search` - the agent's **Web Search** skill uses DeepSeek's
  in-house Search API instead of the built-in SERP provider. It works
  with `deepseek-flash` (the Search API is model-independent), but only
  in agent mode.
- `deepseek_fetch` - the agent's **"Scrape websites"** skill fetches a
  single URL through DeepSeek's Fetch API (Markdown) instead of the local
  Chromium. This is a per-URL fetch, not a crawler. The workspace's
  "Add URL" data source and "Website Depth" still use the collector, and
  if the Fetch call fails the collector path is tried.

Prerequisites and notes:

1. Configure DeepSeek as an LLM provider (at least once) so
   `DEEPSEEK_API_KEY` is written to `/data/.env`; use `deepseek-flash` or
   `deepseek-v4-pro` as the model. The Search/Fetch calls reuse this key.
   For advanced setups the key can also be added to `/data/.env` manually.
2. Enable the desired toggles, save the add-on configuration, and restart
   the add-on if the toggles do not take effect immediately.
3. Enable the relevant agent skill (Web Search and/or Scrape websites).
   While `deepseek_search` is enabled, the built-in provider dropdown
   (which may still show You.com) is bypassed; disable the toggle to use
   the built-in provider again.
4. Agent mode only: normal chat without the agent has no DeepSeek search.
5. Billing and privacy: DeepSeek charges **$0.75 per 1,000 successful
   Search/Fetch requests** (plus model tokens); search queries and fetched
   URLs are sent to DeepSeek.

This is a local stopgap until upstream adds a DeepSeek search provider.
The patch script fails the image build if the pinned upstream version or
one of its anchors changes; when upstream supports DeepSeek Search
natively, the Search/Fetch patch and its two options can be removed.

### DeepSeek images (native provider, experimental patch)

Upstream AnythingLLM 1.18.0 hard-codes the native DeepSeek provider as
text-only and silently drops chat images. That is out of date: DeepSeek's
`deepseek-flash` accepts JPEG/PNG/GIF/WebP images as OpenAI-compatible
`image_url` blocks (base64, external URL, or Files API). The add-on patch
therefore forwards image attachments in both normal chat and agent mode
for:

- `deepseek-flash`
- `deepseek-v4-flash-vision-exp` (legacy alias, served by the latest Flash
  model)

`deepseek-v4-pro` and the other text-only models keep the old behavior -
images are stripped, so the request does not fail. No add-on option is
needed: select the native **DeepSeek** provider and `deepseek-flash`, then
attach the image in the chat. This also works in agent mode.

PDFs are not images: DeepSeek's API accepts text and images, not PDFs
(the Files API is image-only as well). Attach PDFs as workspace documents
(the UI uploads non-image files this way) or send them through the API
with `mime: application/anythingllm-document`; the collector extracts the
text first. See "Knowledge base (RAG)".

The image patch is pinned to 1.18.0 as well and fails the image build if
an anchor changes; it can be removed once upstream stops treating all
DeepSeek models as text-only.

### Build-time patch inventory

A maintainer-facing inventory of all build-time patches, their exact
upstream anchors and the upstream-bump checklist is in
[PATCHES.md](https://github.com/schlangeweile/ha-addon-anythingllm/blob/master/anythingllm/PATCHES.md).

## Where your data lives

Everything persists on the add-on's `/data` volume: the SQLite database
(`anythingllm.db`), the LanceDB vector store (`lancedb/`), uploaded and
processed documents (`documents/`), and the runtime configuration file
(`.env`, holds your provider keys and the JWT secret). A Home Assistant
backup of the add-on includes all of it. Internally the add-on redirects
the app's default storage paths to `/data` via symlinks - if you build a
custom image from this repository, keep those `RUN` lines in the
Dockerfile.

## First start

1. Open the add-on and click **Open Web UI** (or open
   `http://<home-assistant>:3001`).
2. The onboarding wizard asks for your name, username and password -
   this first account becomes the **administrator**.
3. In the wizard (or later under the gear icon → **LLM Preference**),
   configure a provider:
   - **AnythingLLM** (OpenAI-compatible custom endpoint) covers most
     cases: set the base URL and API key of your provider
     (e.g. a DashScope OpenAI-compatible endpoint, an Ollama server, …).
   - Native provider presets are also available.
4. Optional: configure **Embedding Preferences** for the knowledge base
   (RAG). Without embeddings, plain chat still works.
5. Optional: configure DeepSeek as an LLM provider once, then enable
   `deepseek_search` and/or `deepseek_fetch` in the add-on's
   **Configuration** tab (see "Optional: DeepSeek Search and Fetch").

## Multiple users (household setup)

1. Gear icon → **Admin Tools** → enable **Multi-User Mode**.
2. Create accounts in the admin panel and assign roles:
   - **admin** - full control, manages users and settings
   - **manager** - manages workspaces/documents, not admin settings
   - **default** - sees only workspaces explicitly assigned to them
3. Users can be deleted (and passwords reset) by admins at any time -
   user administration is built in, no external tools required.

## Knowledge base (RAG)

Upload documents (PDF, Word, CSV, text, …) into a workspace and embed
them. Embeddings run through the provider configured under Embedding
Preferences; vectors are stored locally in LanceDB on `/data`.

URLs as data sources (workspace "Add URL") are limited to static HTML
pages (see "Web search and web pages"); use document upload for
JavaScript-heavy sites. The optional DeepSeek Fetch toggle applies to the
agent's "Scrape websites" skill, not to workspace URL ingestion or
"Website Depth".

## Local models / built-in LLM

The add-on supports remote endpoints only in practice. The optional
built-in local LLM engine (Lemonade/llama.cpp) downloads large model
runtimes at first use and is not suited for low-RAM ARM devices such as
the Odroid N2+ - use remote API endpoints instead, or a separate
Ollama server on capable hardware.

## Backups & updates

- A Home Assistant add-on backup includes the `/data` volume and with
  it the complete state (accounts, chats, documents, vectors, settings).
- Backups run in cold mode: the add-on is stopped briefly while `/data`
  is copied. That keeps the live SQLite database and the LanceDB store
  consistent (the Supervisor defaults to hot backups).
- On every start the app applies pending database migrations
  automatically. Add-on updates simply pin a newer AnythingLLM version;
  your data survives.

## Troubleshooting

- **Container restarts immediately / log shows `Illegal instruction`**:
  this indicates a binary that requires ARMv8.2+ (LSE) CPU features on
  an ARMv8.0 device (e.g. Odroid N2+ or Raspberry Pi 4/5; a Raspberry
  Pi 3 is instruction-set compatible but has too little RAM). The arm64
  image was statically scanned and runtime-tested on an ARMv8.0-emulated
  CPU for the 1.18.0 image, so this should not happen - if it does,
  please open an issue in the add-on repository with the log excerpt.
- **Adding a URL fails / log shows `Could not find Chrome`, `No usable
  sandbox` or `Running as root without --no-sandbox`**: expected for the
  workspace URL data source and "Website Depth" - the browser is
  intentionally disabled (see "Web search and web pages"). Static pages
  may still work through the HTTP fallback. If `deepseek_fetch` is
  enabled, the agent's "Scrape websites" skill uses DeepSeek Fetch for
  single URLs instead; the workspace URL ingestion and Website Depth
  still use the collector and show the Puppeteer error.
- **DeepSeek Search/Fetch is not used**: enable the matching toggle in the
  add-on's Configuration tab, make sure `DEEPSEEK_API_KEY` is in the
  runtime `.env` (configure DeepSeek as an LLM provider once; restart the
  add-on if the key was just added), and use the agent mode. While
  `deepseek_search` is enabled, the built-in Web Search provider dropdown
  is bypassed.
- **DeepSeek still says it received no image**: make sure the workspace
  uses the native **DeepSeek** provider with `deepseek-flash` (not
  `deepseek-v4-pro`, which is text-only), attach a JPEG/PNG/GIF/WebP image
  (not a PDF), and restart the add-on after the update so the patched
  provider is loaded. PDFs go through the document/OCR path, not the
  vision path.
- **Cannot write to /data**: the add-on runs the app as root inside the
  container on purpose (the persistent volume is root-owned); if you
  changed the image, keep the `USER root` directive.
- Logs: add-on page → **Log** tab. The entrypoint prints Prisma
  migration output, then server and collector logs.
