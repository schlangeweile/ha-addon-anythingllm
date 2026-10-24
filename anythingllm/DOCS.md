# AnythingLLM

All-in-one, open-source AI chat application by Mintplex Labs with a
built-in document pipeline (RAG), embedded storage and native
multi-user administration. Runs fully local; bring your own model
endpoints (OpenAI, Anthropic, Google, any OpenAI-compatible server such
as DashScope/Ollama, and more).

## How it works

The add-on is a single service based on the official multi-arch
AnythingLLM image. Inside the container the upstream entrypoint runs
the web app and its document collector; the embedded SQLite database
and the LanceDB vector store require no external services.

| Aspect   | Detail                                           |
| -------- | ------------------------------------------------ |
| Web UI   | port 3001 (mapped to 3001 by default)            |
| Storage  | everything persists on the add-on `/data` volume |
| Database | embedded SQLite + LanceDB (no external DB)       |
| Config   | in the web UI only (stored in the database)      |

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
  in the add-on.
- **Scrape websites / URL ingestion** renders the page with the Chromium
  bundled in the upstream image. This add-on intentionally does not
  enable Chromium: the bundled browser is from the Chrome 119 era (late
  2023) and the container cannot provide its sandbox. Static HTML pages
  are still fetched through the collector's HTTP fallback, but
  JavaScript-heavy pages and the "Website Depth" crawler do not work.
  Those attempts show a Puppeteer error in the collector log.

The reduced feature set is deliberate: the alternative would be running an
outdated Chromium without a sandbox as root. The SERP-based Web Search
skill, model providers with server-side search (for example Perplexity or
OpenRouter `:online` models) and search MCP servers are unaffected. If you
don't need URL scraping, disable the built-in "Scrape websites" skill in
the agent settings so the agent does not select the limited browser path.

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

URLs as data sources are limited to static HTML pages (see "Web search
and web pages"); use document upload for JavaScript-heavy sites.

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
  sandbox` or `Running as root without --no-sandbox`**: expected - the
  browser is intentionally disabled (see "Web search and web pages").
  Static pages may still work through the HTTP fallback. Use document
  upload, the Web Search skill, a model with server-side search or a
  search MCP server; disable the "Scrape websites" agent skill.
- **Cannot write to /data**: the add-on runs the app as root inside the
  container on purpose (the persistent volume is root-owned); if you
  changed the image, keep the `USER root` directive.
- Logs: add-on page → **Log** tab. The entrypoint prints Prisma
  migration output, then server and collector logs.
