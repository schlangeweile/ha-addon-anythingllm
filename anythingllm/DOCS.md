# AnythingLLM

All-in-one, open-source AI chat application by Mintplex Labs with a
built-in document pipeline (RAG), embedded storage and native
multi-user administration. Runs fully local; bring your own model
endpoints (OpenAI, Anthropic, Google, any OpenAI-compatible server such
as DashScope/Ollama, and more).

## How it works

The add-on is a single service based on the official multi-arch
AnythingLLM image, plus two experimental DeepSeek patches: an optional
server-side search/URL-reading mode for normal chat and an optional Fetch API
for the agent's scrape skill (both off by default). DeepSeek web search in
agent mode and image attachments are built in since AnythingLLM 1.20.
Inside the container the upstream entrypoint runs the web app and its
document collector; the embedded SQLite database and the LanceDB vector
store require no external services.

| Aspect   | Detail                                                      |
| -------- | ----------------------------------------------------------- |
| Web UI   | port 3001 (mapped to 3001 by default)                       |
| Storage  | everything persists on the add-on `/data` volume            |
| Database | embedded SQLite + LanceDB (no external DB)                  |
| Config   | web UI, plus two optional DeepSeek toggles                    |

## Requirements

- aarch64 (ARMv8.0) or amd64, Home Assistant OS or Supervised.
- ~1.2 GB download and ~4.9 GiB free disk for the image, plus space for
  documents, the vector cache and LanceDB under `/data`.
- ~0.5 GB RAM (measured ~290 MiB idle on amd64 with 1.19.0-ha1).
  2 GB total is enough for chat and RAG; 4 GB is comfortable. A Raspberry
  Pi 3 (1 GB) is instruction-set compatible but too small for this add-on.

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
  SearXNG, Tavily, DuckDuckGo or - since AnythingLLM 1.20 - DeepSeek.
  This is a plain HTTP API call and works in the add-on.
- **Scrape websites / URL ingestion** renders the page with the Chromium
  bundled in the upstream image. This add-on intentionally does not
  enable Chromium: the bundled browser is from the Chrome 119 era (late
  2023) and the container cannot provide its sandbox. Static HTML pages
  are still fetched through the collector's HTTP fallback, but
  JavaScript-heavy pages and the "Website Depth" crawler do not work.
  Those attempts show a Puppeteer error in the collector log. The
  optional `deepseek_fetch` toggle lets the agent's "Scrape websites"
  skill fetch single URLs through DeepSeek's Fetch API instead. A page that
  answers with an HTTP error status (404, 410, ...) is reported as
  "No URL content found" instead of being read or stored as the error page
  (patch #9 in the image; this also covers workspace URL imports).

The reduced feature set is deliberate: the alternative would be running an
outdated Chromium without a sandbox as root. The SERP-based Web Search
skill, model providers with server-side search (for example Perplexity or
OpenRouter `:online` models) and search MCP servers are unaffected. The
optional DeepSeek Fetch patch below uses DeepSeek's HTTP API, not the local
browser. If you don't need browser-based URL scraping, disable the built-in
"Scrape websites" skill (unless you use `deepseek_fetch`).

### DeepSeek web search in agent mode (built in since 1.20)

AnythingLLM 1.20 added DeepSeek as an agent web-search provider. Select
**DeepSeek** under *Agent Skills -> Web Search* and enter a DeepSeek API key
in that provider's settings (the key is stored as
`AGENT_DEEPSEEK_API_KEY`, separately from the LLM key). It works with
`deepseek-flash` and any other model, in agent mode. DeepSeek bills the
Search API per successful request (see their pricing page); search queries
are sent to DeepSeek.

The add-on image patches this provider so the model receives DeepSeek's long
`summary` (up to 2000 characters per result) and every result that has a URL;
upstream 1.20 only forwards the short UI `snippet` and silently drops results
below a `rerank_score` of 1.5. Without the patch the agent received so little
content per search that it needed extra searches and page fetches, which
exhausted its tool-call budget and ended research runs early. This is a local
patch (#8, see PATCHES.md), not upstream behaviour.

### Free DeepSeek server-side web tools in normal chat (experimental)

DeepSeek's [web tools](https://api-docs.deepseek.com/guides/web_tools) let the
model search the web and read URLs itself; those server-side searches are not
billed, only model tokens. DeepSeek does **not** allow these tools together
with function tools, so this add-on uses them only in the **normal chat**,
never in the agent.

- Enable **`deepseek_server_tools`** in the add-on's Configuration tab.
- The workspace must use a **DeepSeek flash model** (`deepseek-flash` or a
  dated flash alias) with the native DeepSeek provider.
- The request then declares `deepseek_web_search` and `deepseek_read_url`.
  The model decides whether to search or read links; the answer cites pages
  under **Sources**. Image attachments still work in the same message.
- The agent keeps its existing Search/Fetch provider (and the optional
  `deepseek_fetch` patch); the agent path is not changed by this option.
- `deepseek_read_url` reads URLs in the **last** user message. AnythingLLM
  does not replay DeepSeek's encrypted `signature` in later turns yet, so a
  follow-up about that page may not see its content; use workspace documents
  for persistent page context.
- If a dated model name is rejected by the API, select `deepseek-flash` (the
  alias to the current Flash model).

This mode is independent of the agent Search/Fetch provider. You can keep
DeepSeek as the agent provider, or ignore agent mode entirely and use normal
chat with server-side search.

### Optional: DeepSeek Fetch (experimental local patch)

AnythingLLM 1.20 has no DeepSeek Fetch path, so the add-on image contains a
small local patch for the agent's **"Scrape websites"** skill. The toggle
`deepseek_fetch` is **off by default** and lives in the add-on's
**Configuration** tab. When enabled, the skill fetches a single URL through
DeepSeek's Fetch API (Markdown) instead of the local Chromium. This is a
per-URL fetch, not a crawler. The workspace's "Add URL" data source and
"Website Depth" still use the collector, and if the Fetch call fails the
collector path is tried.

Prerequisites and notes:

1. Configure DeepSeek as an LLM provider (at least once) so
   `DEEPSEEK_API_KEY` is written to `/data/.env`; use `deepseek-flash` or
   `deepseek-v4-pro` as the model. The Fetch calls reuse this key.
   For advanced setups the key can also be added to `/data/.env` manually.
2. Enable `deepseek_fetch`, save the add-on configuration, and restart the
   add-on if the toggle does not take effect immediately.
3. Enable the agent's "Scrape websites" skill.
4. Agent mode only: normal chat without the agent has no DeepSeek Fetch.
5. Billing and privacy: DeepSeek charges **$0.75 per 1,000 successful
   Fetch requests** (plus model tokens); fetched URLs are sent to DeepSeek.

The patch script fails the image build if the pinned upstream version or
one of its anchors changes; when upstream supports DeepSeek Fetch natively,
the patch and its option can be removed.

### DeepSeek images

Since AnythingLLM 1.20 the native DeepSeek provider forwards image
attachments itself (the earlier add-on patch is gone). Select the native
**DeepSeek** provider with `deepseek-flash` and attach the image in the
chat; this also works in agent mode. `deepseek-v4-pro` is text-only.

PDFs are not images: DeepSeek's API accepts text and images, not PDFs.
Attach PDFs as workspace documents (the UI uploads non-image files this
way) or send them through the API with
`mime: application/anythingllm-document`; the collector extracts the text
first. See "Knowledge base (RAG)".

## UI differences from upstream (UI fork)

Since 1.19.0-ha3 the frontend is built from the public UI fork
[`schlangeweile/anything-llm`](https://github.com/schlangeweile/anything-llm),
branch `ha-ui/v1.20.0` (upstream `v1.20.0` plus the remaining UI commits), and
copied over the upstream image's `server/public`. Server, collector and the
entrypoint remain upstream. This section lists the user-visible differences;
all are client-side preferences stored in the browser's `localStorage`,
except the activity ordering, which the server also persists.

### Thread list

- **UI Preferences → Thread list** limits how many threads are shown. It is
  off by default; when enabled, the default is 8 (1–100 is accepted). The
  newest threads stay visible, older ones collapse behind **Show N older
  threads** / **Show less**.
- The **active thread is always visible**: if it is older than the limit,
  the list expands automatically instead of hiding it.
- **Newest first**, and **New Thread is at the top** of the list.
- The old connector lines are gone; the list uses one subtle left border.
- Upstream's virtual `*New Thread` placeholder row is gone. It duplicated the
  button and reappeared as a phantom entry whenever the workspace route had
  no thread slug (after deleting the active thread, or on a newly created
  workspace); the button is now the only way to start a chat. Named threads
  and the `default` row (shown when the default thread has chats) still
  behave as before.
- Threads are ordered by **activity**, not creation: sending a message moves
  the thread to the top immediately, and after a reload (or on a second
  device) the server-side `lastUpdatedAt` bump keeps it there.
- Auto-generated thread names are stored up to **64 characters**; the list
  and the search truncate them by rendered width. Threads created before
  this change keep their 22-character names.

### Collapsing a workspace

The active workspace row has a chevron. Clicking its **workspace name**
toggles the thread list too, without leaving the current thread. Clicking a
different workspace name still navigates there and opens its list; on the
home page and in workspace settings the name keeps navigating. The collapsed
state is remembered per workspace slug in the browser. Only the active
workspace ever shows a thread list, as before.

### Sidebar search

The search box matches workspace and thread **names** (at least 3
characters; no chat contents or documents). Results close on Escape, on a
click outside the search area or on navigation, and the clear button in the
field empties it. Focusing or clicking the field shows the last results
again. Result rows and workspace/thread labels truncate by the available
width, not by a fixed character count.

On phones the sidebar drawer has the same search row since 1.20; that part
is upstream now. The dismissal, clear-button and width behaviour above are
still add-on-side.

### Settings menu

Menu entries use the same 14 px type scale as the rest of the UI. Main
entries are semibold so they stay distinguishable from their sub-entries.

### Chat metrics

The small metrics line under an assistant answer shows the model, duration,
tokens/s, date and the token usage (`total tok (prompt · completion)`). It is
hidden until hovered by default; **UI Preferences → Chat metrics** pins it
permanently, and clicking the line in a chat toggles the same preference. On
mobile the line is shown when the preference is on. Token values depend on
the provider: exact usage is used when the provider reports it, otherwise the
prompt is estimated with the model tokenizer and the completion is counted
per streamed chunk.

### Chat context label

The top-left chat label shows `model · workspace`, both on desktop (inside
the existing model picker) and on mobile (in a slim bar below the fixed app
header). The workspace is the one a new message/thread would be created in.
On desktop the label stays the admin-only picker; on mobile it is display
only.

### Favicon and PWA icons

The default AnythingLLM favicon and PWA icons are replaced by the Stanley
tuxedo mark on a white background: multi-size `favicon.ico`, 512 px
`favicon.png`, 180 px `apple-touch-icon.png`, 192/512 px PWA icons and a
512 px maskable icon. The web manifest declares the `any` and `maskable`
purposes. Hard-refresh the browser after an update; an already installed PWA
must be removed and re-added to pick up the new icon.

### App name in the installed PWA

The name in the browser's install prompt and on the installed app comes from
the web manifest. AnythingLLM 1.20 serves the manifest dynamically and takes
the name from *Settings → Customization → Browser Appearance → Title*,
falling back to *Customization → Name* and then "AnythingLLM"; the former
route-order patch is gone. The add-on still overrides the generator's icon
list (server patch #6), because the fork ships 192/512/maskable PWA icons
while upstream's generator emits a single favicon entry. An already installed
PWA may keep its old name; remove it and add it again to pick up the new one.

### Line breaks in your own messages

Newlines and pasted console output in user messages are preserved (one line
per line) while Markdown lists, links and code fences still render. Assistant
messages keep the upstream rendering unchanged.

### Message actions

Copy, edit, regenerate, feedback and the kebab menu are always visible at
60 % opacity and become fully opaque on hover or keyboard focus. Edit and
resend already existed upstream; this change makes the pencil reachable on
touch tablets and discoverable on desktop. See the upstream caveats in the
edit dialog: hidden chats still count against the daily limit and workspace
memory may already contain the old exchange.

### Agent status block

Upstream 1.20 no longer appends the synthetic "Agent session complete."
status that used to leave a stray "Thoughts" row below a finished answer
([Mintplex-Labs/anything-llm#6959](https://github.com/Mintplex-Labs/anything-llm/issues/6959));
that half of the add-on fix is gone. The UI fork still uses the brain glyph
for a finished activity chain instead of the 1805x1805 "agent done" PNG,
whose alt text ("Agent complete") leaked into the row as "Ag" when it loaded
slowly or failed, and it localizes the finished-chain label ("Thought for
12.3s" / "Nachgedacht für 12.3s").

### Keep the screen awake

**UI Preferences → Keep the screen awake** is off by default. While a reply
is streaming, the app requests a Screen Wake Lock. The API only exists in a
secure context, so it works through the documented HTTPS reverse proxy; on a
plain `http://...:3001` URL it silently does nothing. A wake lock does not
survive tab switches or phone calls, and the server still aborts generation
when the client disconnects - partial-answer saving (R9/C2) is not
implemented.

### Content Security Policy

The server sends a `Content-Security-Policy` on production HTML responses:
`default-src 'self'` with same-origin scripts, inline styles (required by the
app), `data:`/`blob:` images and media, same-origin WebSockets and
`'wasm-unsafe-eval'` for the browser TTS worker. `'unsafe-eval'` is not
allowed. This closes the JWT-in-localStorage XSS gap; if a future UI feature
uses another origin or an eval-based library, the policy must be extended
deliberately.

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
   `deepseek_fetch` in the add-on's **Configuration** tab for the agent's
   scrape skill. DeepSeek web search is built in: select DeepSeek under
   *Agent Skills -> Web Search* and set its `AGENT_DEEPSEEK_API_KEY` there.

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

The add-on supports remote endpoints only in practice. Upstream 1.20.0
bundles an optional built-in local LLM engine (Lemonade/llama.cpp) for
Docker, but it is off by default and this add-on does not enable it. It
downloads large model runtimes at first use and is not suited for
low-RAM ARM devices such as the Odroid N2+ - use remote API endpoints
instead, or a separate Ollama server on capable hardware.

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
  image was re-scanned statically for 1.20.0 and the native modules were
  runtime-tested on an ARMv8.0-emulated CPU, so this
  should not happen - if it does, please open an issue in the add-on
  repository with the log excerpt.
- **Adding a URL fails / log shows `Could not find Chrome`, `No usable
  sandbox` or `Running as root without --no-sandbox`**: expected for the
  workspace URL data source and "Website Depth" - the browser is
  intentionally disabled (see "Web search and web pages"). Static pages
  may still work through the HTTP fallback. If `deepseek_fetch` is
  enabled, the agent's "Scrape websites" skill uses DeepSeek Fetch for
  single URLs instead; the workspace URL ingestion and Website Depth
  still use the collector and show the Puppeteer error.
- **DeepSeek Fetch is not used**: enable `deepseek_fetch` in the add-on's
  Configuration tab, make sure `DEEPSEEK_API_KEY` is in the runtime `.env`
  (configure DeepSeek as an LLM provider once; restart the add-on if the key
  was just added), and use agent mode.
- **DeepSeek web search is not used**: in agent mode, select **DeepSeek**
  under *Agent Skills -> Web Search* and enter the key in that provider's
  settings (stored as `AGENT_DEEPSEEK_API_KEY`). This is separate from the
  DeepSeek LLM key. In normal chat, enable `deepseek_server_tools` and use a
  DeepSeek flash model; the option does nothing in agent mode or for
  non-flash models.
- **Agent search stops early or burns many tool calls**: the agent may chain
  at most *Admin -> Agents -> Max Tool Calls* tool calls per answer (default
  10). DeepSeek's search is patched to send long summaries and all hits, so a
  normal search should not need many follow-up fetches; if a task still needs
  more steps, raise the limit deliberately instead of setting it very high.
  Extremely long runs also accumulate a large prompt (the DeepSeek provider
  advertises a 1M-token context window, so nothing is truncated); split big
  research tasks into several threads.
- **DeepSeek server tools are rejected**: use the model alias
  `deepseek-flash` instead of a dated snapshot, or disable
  `deepseek_server_tools` and keep the agent's Search/Fetch provider.
- **DeepSeek still says it received no image**: make sure the workspace
  uses the native **DeepSeek** provider with `deepseek-flash` (not
  `deepseek-v4-pro`, which is text-only), attach a JPEG/PNG/GIF/WebP image
  (not a PDF), and hard-refresh the page so the 1.20 frontend is loaded.
  PDFs go through the document/OCR path, not the vision path.
- **Cannot write to /data**: the add-on runs the app as root inside the
  container on purpose (the persistent volume is root-owned); if you
  changed the image, keep the `USER root` directive.
- Logs: add-on page → **Log** tab. The entrypoint prints Prisma
  migration output, then server and collector logs.
