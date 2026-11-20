# Add-on patches (AnythingLLM 1.20.0-ha3)

This add-on is a thin layer on the pinned upstream image
`mintplexlabs/anythingllm:1.20.0`, plus the build-time patch layer in
[`patches/`](patches/) and a frontend overlay built from the public UI fork.
This file is the central inventory of every server patch, the exact upstream
anchors it relies on, the UI-fork delivery model, and the checklist for an
upstream bump.

The authoritative implementation of the server patches is
[`patches/apply.js`](patches/apply.js). Patches are applied at image build
time, not at runtime. Frontend changes do **not** go through this layer; they
live in the UI fork (see "UI fork overlay" below).

The anchors were re-checked against AnythingLLM 1.20.0. 1.20.0-ha2 added the
normal-chat DeepSeek server-tools patch (#3); 1.20.0-ha3 adds the DeepSeek
agent-search result patch (#8), which restores the long `summary` and all hits
that the removed 1.19 search patch used to send.
Upstream 1.20.0 took over several former add-on patches: DeepSeek vision (#6910), the DeepSeek
agent search provider (#6911), the dynamic PWA manifest route (#6944), the
mobile drawer search (#7007), the Agent Skills settings button on mobile
(#7089), the live thinking timer (#7091), the agent close-notice cleanup
(#6966), responsive workspace settings (#6891) and the markdown-table scroll
wrapper (#6859). Those patches/commits were removed in 1.20.0-ha1, so the
patch layer is smaller than in 1.19.0.

## Patch inventory

| # | Patch | Upstream target | Purpose | Add-on option | Remove when |
|---|-------|-----------------|---------|---------------|-------------|
| 1 | [`patches/deepseek.js`](patches/deepseek.js) | `server/utils/agents/aibitat/plugins/helpers/deepseek.js` (new file) | DeepSeek Fetch client | `deepseek_fetch` | Upstream has native Fetch/scrape support |
| 2 | [`snippets/collector-fetch.js`](patches/snippets/collector-fetch.js) | `server/utils/collectorApi/index.js` | DeepSeek Fetch for the agent's "Scrape websites" skill | `deepseek_fetch` | Same as #1 |
| 3 | [`snippets/deepseek-server-tools-*.js`](patches/snippets/) plus inline anchors | `server/utils/AiProviders/deepseek/index.js` | DeepSeek's free server-side `deepseek_web_search`/`deepseek_read_url` tools in **normal chat**, with sources mapping | `deepseek_server_tools` | Upstream supports DeepSeek server tools in chat |
| 4 | [`snippets/security-headers.js`](patches/snippets/security-headers.js) | `server/index.js` | Content-Security-Policy for the production SPA | none | Upstream ships a suitable CSP |
| 5 | [`snippets/thread-activity.js`](patches/snippets/thread-activity.js) | `server/models/workspaceChats.js` | Bump the thread's `lastUpdatedAt` when a chat is saved | none | Upstream bumps thread activity itself |
| 6 | Inline anchors in `apply.js` | `server/models/workspaceThread.js`, `server/endpoints/workspaces.js` | Store auto-generated thread names up to 64 characters instead of 22, so the UI truncates by width | none | Upstream stores longer names |
| 7 | Inline anchor in `apply.js`, [`snippets/manifest.js`](patches/snippets/manifest.js) | `server/utils/boot/MetaGenerator.js` | Emit the fork's 192/512/maskable PWA icons in the dynamic manifest | none | Upstream's generator emits a full icon set |
| 8 | [`snippets/web-browsing-deepseek-results.js`](patches/snippets/web-browsing-deepseek-results.js) plus an inline comment anchor | `server/utils/agents/aibitat/plugins/web-browsing.js` | Send DeepSeek's long search `summary` and keep every result with a URL instead of upstream's short `snippet` and `rerank_score >= 1.5` cut-off | none | Upstream forwards the summary/all hits itself |
| 9 | [`snippets/collector-fetch-status.js`](patches/snippets/collector-fetch-status.js) plus an inline anchor | `collector/processLink/convert/generic.js` | Fail the plain-HTTP fallback on non-2xx instead of ingesting 404/410 error pages | none | Upstream checks the response status |

The Fetch patch (#1/#2) and the server-tools patch (#3) are option-controlled.
The server-tools patch only touches the normal-chat provider; the agent uses
`aibitat/providers/deepseek.js` and is unchanged. The CSP (#4),
thread-activity (#5), thread-name (#6), manifest-icon (#7), DeepSeek-search
(#8) and collector-status (#9) patches are always applied.

### UI fork overlay

The frontend is **not** patched with `replaceOnce`. It is built from the
public fork `schlangeweile/anything-llm`, branch `ha-ui/v1.20.0` (upstream tag
`v1.20.0` plus the remaining UI commits), in a native `node:24-slim` stage of
[`Dockerfile`](Dockerfile). The stage:

1. downloads the tarball for the pinned commit SHA,
2. verifies the pinned SHA-256,
3. asserts that the fork's `server/package.json` version equals
   `ANYTHINGLLM_VERSION`,
4. runs `yarn install --frozen-lockfile --production=false` and builds with
   `NODE_ENV=production`,
5. copies only `frontend/dist` over `/app/server/public` of the upstream
   image.

Server, collector, Prisma engines, Chromium and the entrypoint still come
from upstream; the patch layer below only edits individual server/collector
files. The overlay runs before `apply.js`, so the server patches always see
the upstream server files. The frontend build is pure JS and is not part of the
ARMv8.0 binary scan.

UI changes carried in the fork as of 1.20.0-ha1:

| Commit theme | What it changes |
|---|---|
| Thread list (R1–R4) | New `ThreadList` component: configurable limit with "Show older threads", newest-first order (by activity), no connector lines, New Thread at the top |
| Phantom row (ha5) | Upstream's virtual `*New Thread` row removed: it duplicated the New Thread button and appeared on every bare workspace route (after deleting the active thread, on a new workspace) |
| Search dismissal (ha5) | Results close on Escape, outside click and navigation; always-visible clear button; reopen on focus/click. Upstream 1.20's SearchBox only has the results/sequence logic |
| Width truncation (ha5) | Full-width search result rows and flexible workspace names; auto thread names up to 64 chars (patch #6) instead of 22 |
| Settings type (ha5) | Sub-items 14 px instead of 12 px; main entries semibold at 14 px |
| Chat metrics (ha6) | Token usage in the per-message metrics line; UI preference to pin the line, also on mobile |
| Chat context label (ha6) | Desktop picker and mobile bar show `model · workspace` |
| Favicon/PWA icons (ha6) | Stanley mark as favicon, apple-touch and PWA icons (incl. maskable) with manifest declarations |
| Workspace collapse (R6a) | Chevron toggles the active workspace's list without navigating; clicking the open workspace's name toggles too, other names navigate and open; `localStorage` per slug |
| Line breaks (R7A) | A second markdown-it instance with `breaks: true` for user messages only; keeps upstream's table scroll renderers on both instances |
| Message actions (R8A) | Actions are always visible at `opacity-60`, fully opaque on hover/focus |
| Wake lock (R9A) | Opt-in Screen Wake Lock while a response streams, off by default, secure-context only |
| Activity sort (R5 client) | `THREAD_ACTIVITY_EVENT` from both composer paths; local reorder plus the server bump from patch #5 |
| Agent chain icon/label (ha9) | Brain glyph instead of the `agent-static.png` bitmap and a localized finished-chain label |

The UI fork is rebased per upstream tag (never merged). See
[`AGENTS.md`](../AGENTS.md) decision 12 and `DOCS.md` for the user-visible
differences.

## Anchor map

Most edits use `replaceOnce(content, needle, replacement, label)`:

- the anchor must occur **exactly once** in the upstream file, otherwise
  the build fails with
  `[addon-patch] ERROR: expected exactly one anchor for <label>, found N`;
- `EXPECTED_VERSION = "1.20.0"` is checked against the upstream image's
  `DEPLOYMENT_VERSION` before any file is touched;
- the labels below are the third argument passed to `replaceOnce`.

The new helper (#1) is a whole-file copy; everything else uses
`replaceOnce`. The CSP (#4) is a middleware insertion and the thread-activity
patch (#5) runs after the chat upsert; both are called out separately below.

### 1. New helper file

- Source: `patches/deepseek.js`
- Target: `server/utils/agents/aibitat/plugins/helpers/deepseek.js`
- Applied with `fs.copyFileSync`; there is no anchor.
- Because this is a whole-file copy, verify on every bump that upstream
  does not already ship the same path - otherwise our copy would replace
  it without triggering the anchor check.
- Upstream 1.20.0 does not ship this file or directory (its DeepSeek search
  client is inline in `web-browsing.js`).

### 2. `collectorApi/index.js`

- Label `collectorApi helper import`
  - Anchor: `const { Agent } = require("undici");`
  - Replacement adds `fetchDeepSeek` and `getAddonOption` imports.

- Label `collectorApi DeepSeek Fetch`
  - Anchor:
    ```js
      async getLinkContent(link = "", captureAs = "text") {
        if (!link) return false;
    ```
  - Replacement prepends
    [`snippets/collector-fetch.js`](patches/snippets/collector-fetch.js),
    which runs only when `deepseek_fetch` is true and `DEEPSEEK_API_KEY` is
    set; on failure the collector path continues.

### 3. `AiProviders/deepseek/index.js` (server tools, normal chat)

Only the normal-chat provider is patched; the agent's
`aibitat/providers/deepseek.js` is separate and keeps its Search/Fetch
provider (DeepSeek does not allow server tools together with function tools).

- Label `deepseek server-tools import`
  - Anchor: `} = require("../../helpers/reasoningEffort");`
  - Adds `getAddonOption` from the installed Fetch helper.

- Label `deepseek server-tools methods`
  - Anchor: the JSDoc above `#generateContent`.
  - Adds `#serverToolsEnabled`, `#serverToolsRequest`, `#serverToolSources`
    and the streaming observer. Enabled only for `deepseek_server_tools` and
    `^deepseek(-v[\d.]+)?-flash` models.

- Labels `deepseek server-tools non-stream request` and
  `deepseek server-tools stream request`
  - Anchors: the two `chat.completions.create({ model, messages, ... })`
    blocks.
  - Adds `...this.#serverToolsRequest(),` (empty object when disabled).

- Label `deepseek server-tools non-stream sources`
  - Anchor: the `textResponse: this.#parseReasoningFromResponse(...)` return.
  - Adds `sources: this.#serverToolSources(...)`.

- Label `deepseek server-tools stream handler`
  - Anchor: `handleStream(response, stream, responseProps)`.
  - Replaces the default handler with a wrapper that observes
    `delta.annotations`/`delta.server_tool_calls` and appends mapped sources
    to the shared `sources` array used by the final stream chunk and the saved
    chat.

### 4. `server/index.js` (CSP)

- Label `server CSP header`
  - Anchor: `  const IndexPage = new MetaGenerator();\n`
  - Replacement appends
    [`snippets/security-headers.js`](patches/snippets/security-headers.js),
    a middleware registered before `express.static` and the SPA catch-all.

### 5. `workspaceChats.js` (thread activity)

- Label `workspaceChats thread activity bump`
  - Anchor:
    ```js
            // On creates, we need to set the prompt or else record will fail.
            create: { ...payload, prompt: data.prompt },
          });
          return { chat, message: null };
    ```
  - Replacement inserts
    [`snippets/thread-activity.js`](patches/snippets/thread-activity.js)
    after the upsert. Upstream 1.20.0 replaced `WorkspaceChats.new` with
    `upsert`, so both creates and updates pass through this point; the
    snippet uses `data.threadId`.

### 6. Thread name length

- Label `workspaceThread auto-name length`
  - Anchor: `      name: truncate(prompt, 22),`
  - Replacement: `      name: truncate(prompt, 64),`

- Label `forked thread auto-name length`
  - Anchor: `            ? truncate(lastMessageText, 22)`
  - Replacement: `            ? truncate(lastMessageText, 64)`

The UI truncates by rendered width, so a 64-character name is not displayed
in full on narrow sidebars.

### 7. `MetaGenerator.js` (manifest icons)

- Label `MetaGenerator manifest output`
  - Anchor: the `const manifest = { ... }` block ending with
    `response.type("application/json").status(200).send(manifest).end();`
  - Replacement: [`snippets/manifest.js`](patches/snippets/manifest.js).
    It keeps the configured name and adds `pwa-192x192.png`,
    `pwa-512x512.png` and `pwa-maskable-512x512.png` from the fork, plus
    `Cache-Control: no-store`.
  - Upstream 1.20.0 already registers the manifest route before
    `express.static`, so the former route-order hunks are gone.

### 8. `web-browsing.js` (DeepSeek search payload)

- Label `web-browsing DeepSeek result comment`
  - Anchor: `* Only results with a rerank_score of 1.5 or above are returned.`
  - Replacement updates the doc comment above `_deepSeekSearch`.

- Label `web-browsing DeepSeek result payload`
  - Anchor: the `if (!(rerank_score >= 1.5)) return;` line plus the
    `String(snippet || summary || "") ... .slice(0, 500);` block inside
    `_deepSeekSearch`.
  - Replacement:
    [`snippets/web-browsing-deepseek-results.js`](patches/snippets/web-browsing-deepseek-results.js):
    `summary || snippet` with a 2000-character cap and no `rerank_score`
    filter (every result with a URL is kept).
  - Why: DeepSeek's Search API documents `summary` (600-800 characters) as
    "intended to be read by a model" and `snippet` (100-200 characters) as
    the UI form. Upstream 1.20 sends the short snippet cut to 500 characters
    and drops results below a rerank score of 1.5, so the agent got too little
    content per search, needed extra searches/page fetches and exhausted its
    tool-call budget. The removed 1.19 add-on search patch sent the summary
    and kept all results.
  - The `deepseek_fetch` patch (#1/#2) is separate; this patch only changes
    the search payload, not the Fetch path.

### 9. `collector/processLink/convert/generic.js` (fetch fallback status)

- Label `collector fetch fallback response`
  - Anchor: `const pageText = await fetch(link, {`
  - Replacement renames it to `const response = await fetch(link, {`.

- Label `collector fetch fallback status`
  - Anchor: `}).then((res) => res.text());` plus the following
    `if (captureAs === "html") return pageText;` line.
  - Replacement:
    [`snippets/collector-fetch-status.js`](patches/snippets/collector-fetch-status.js):
    check `response.ok` first and throw a status error, otherwise read the
    body. `scrapeGenericUrl` then returns `success: false` / "No URL content
    found" instead of the site's 404 page.
  - Why: upstream (checked in 1.19.0 and 1.20.0) ignores the HTTP status in
    the fallback, so a dead link is treated as a real page - the agent keeps
    guessing variants and workspace URL imports can store the error page.
    The HEAD probe above stays non-fatal: 403/405 on HEAD is often legitimate
    while GET works.
  - Tested with a local HTTP server in the 1.20.0 image: 404 -> `success:false`,
    200 -> Markdown.

## Upstream-bump checklist

1. Pin the new plain version tag in `Dockerfile` (`ANYTHINGLLM_VERSION`) and
   `config.yaml` (`version`), and bump `-haN` for add-on-only changes.
2. Check Docker Hub for `linux/arm64` and `linux/amd64` on the tag.
3. Diff `docker/Dockerfile`, `docker/docker-entrypoint.sh`,
   `server/prisma/schema.prisma` and `server/utils/files/index.js` against the
   previous tag. The storage contract (STORAGE_DIR, SQLite path, runtime
   `.env`, collector hotdir) must be unchanged; otherwise adapt the
   Dockerfile symlinks.
4. Re-check every anchor above and set `EXPECTED_VERSION` in `apply.js`.
   The build fails on a moved anchor by design.
5. Diff the `*.node` list and rebuild/re-scan the arm64 image for ARMv8.0
   (LSE) instructions - especially Node, LanceDB and Prisma. Runtime-test
   `.node` modules under `qemu-aarch64 -cpu cortex-a53`.
6. Check the release notes for upstreamed add-on work and drop the matching
   patch/fork commit instead of keeping two solutions.
7. Rebase the UI fork onto the new tag (never merge), drop upstreamed
   commits, push the branch, and re-pin `UI_FORK_SHA` + `UI_FORK_SHA256`.
8. Build both architectures, run the amd64 smoke test (boot, onboarding,
   chat, RAG, persistence) and the desktop/mobile UI smoke (light/dark).
9. Update `CHANGELOG.md`, `DOCS.md`, this file and `README.md`; mention any
   removed add-on option in the changelog.

## History

- 1.19.0-ha1…ha10: initial image, storage/telemetry fixes, DeepSeek
  Search/Fetch and vision patches, CSP, thread activity, thread names, PWA
  manifest, and the UI fork (R1–R9 plus ha5–ha10 changes).
- 1.20.0-ha3: DeepSeek agent-search payload patch (#8) - long `summary`
  instead of the short `snippet`, no `rerank_score` cut-off, so a search no
  longer burns the agent's tool-call budget; collector fallback patch (#9)
  rejects non-2xx pages instead of ingesting error pages.
- 1.20.0-ha2: normal-chat DeepSeek server-tools option
  (`deepseek_server_tools`) with source mapping; agent unchanged.
- 1.20.0-ha1: base bump to 1.20.0; removed the DeepSeek vision and search
  patches/options and the manifest route-order patch (all upstream);
  rebased the fork and dropped mobile drawer search, Agent Skills mobile,
  the live timer, the agent close-notice half, and the table/settings CSS;
  kept the Fetch patch, CSP, thread activity/name, PWA icon override and the
  remaining UI improvements.
