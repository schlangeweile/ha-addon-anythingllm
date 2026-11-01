# Add-on patches (AnythingLLM 1.19.0-ha4)

This add-on is a thin layer on the pinned upstream image
`mintplexlabs/anythingllm:1.19.0`, plus the build-time patch layer in
[`patches/`](patches/) and a frontend overlay built from the public UI fork.
This file is the central inventory of every server patch, the exact upstream
anchors it relies on, the UI-fork delivery model, and the checklist for an
upstream bump.

The authoritative implementation of the server patches is
[`patches/apply.js`](patches/apply.js). Patches are applied at image build
time, not at runtime. Frontend changes do **not** go through this layer; they
live in the UI fork (see "UI fork overlay" below).

The anchors were re-checked against AnythingLLM 1.19.0. 1.19.0-ha3 adds the
CSP and thread-activity patches and moves the two former CSS snippets into the
fork.

## Patch inventory

| # | Patch | Upstream target | Purpose | Add-on option | Remove when |
|---|-------|-----------------|---------|---------------|-------------|
| 1 | [`patches/deepseek.js`](patches/deepseek.js) | `server/utils/agents/aibitat/plugins/helpers/deepseek.js` (new file) | DeepSeek Search/Fetch clients | `deepseek_search`, `deepseek_fetch` | Upstream has native DeepSeek Search/Fetch |
| 2 | [`snippets/provider-override.js`](patches/snippets/provider-override.js), [`snippets/web-browsing-search.js`](patches/snippets/web-browsing-search.js) plus inline anchors | `server/utils/agents/aibitat/plugins/web-browsing.js` | DeepSeek Search provider and forced provider selection | `deepseek_search` | Same as #1 |
| 3 | Inline anchors in `apply.js` | `server/models/systemSettings.js` | Allow `deepseek-search` in the provider validator | `deepseek_search` | Same as #1 |
| 4 | [`snippets/collector-fetch.js`](patches/snippets/collector-fetch.js) | `server/utils/collectorApi/index.js` | DeepSeek Fetch for the agent's "Scrape websites" skill | `deepseek_fetch` | Upstream has native Fetch/scrape support |
| 5 | [`snippets/deepseek-chat-images.js`](patches/snippets/deepseek-chat-images.js) | `server/utils/AiProviders/deepseek/index.js` | Image attachments in normal chat for `deepseek-flash` | none | Upstream treats DeepSeek as vision-capable |
| 6 | [`snippets/deepseek-agent-images.js`](patches/snippets/deepseek-agent-images.js) | `server/utils/agents/aibitat/providers/deepseek.js` | Image attachments in agent mode plus `#stripAttachments` guard | none | Same as #5 |
| 7 | [`snippets/security-headers.js`](patches/snippets/security-headers.js) | `server/index.js` | Content-Security-Policy for the production SPA | none | Upstream ships a suitable CSP |
| 8 | [`snippets/thread-activity.js`](patches/snippets/thread-activity.js) | `server/models/workspaceChats.js` | Bump the thread's `lastUpdatedAt` when a chat is saved | none | Upstream bumps thread activity itself |

The image patch (#5/#6) is always applied; it only affects the native
DeepSeek provider. The CSP (#7) and thread-activity (#8) patches are also
always applied. Only the Search/Fetch behaviour is controlled by the two
add-on options.

### UI fork overlay

The frontend is **not** patched with `replaceOnce`. It is built from the
public fork `schlangeweile/anything-llm`, branch `ha-ui/v1.19.0` (upstream tag
`v1.19.0` plus the UI commits), in a native `node:18-slim` stage of
[`Dockerfile`](Dockerfile). The stage:

1. downloads the tarball for the pinned commit SHA,
2. verifies the pinned SHA-256,
3. asserts that the fork's `server/package.json` version equals
   `ANYTHINGLLM_VERSION`,
4. runs `yarn install --frozen-lockfile --production=false` and builds with
   `NODE_ENV=production`,
5. copies only `frontend/dist` over `/app/server/public` of the upstream
   image.

Server, collector, Prisma engines, Chromium and the entrypoint stay upstream.
The overlay runs before `apply.js`, so the server patches always see the
upstream server files. The frontend build is pure JS and is not part of the
ARMv8.0 binary scan.

UI changes carried in the fork as of 1.19.0-ha4:

| Commit theme | What it changes |
|---|---|
| Thread list (R1–R4) | New `ThreadList` component: configurable limit with "Show older threads", newest-first order (by activity), no connector lines, New Thread at the top |
| Phantom row (ha4) | Upstream's virtual `*New Thread` row removed: it duplicated the New Thread button and appeared on every bare workspace route (after deleting the active thread, on a new workspace) |
| Workspace collapse (R6a) | Chevron toggles the active workspace's list without navigating; `localStorage` per slug; the name click navigates and opens |
| Line breaks (R7A) | A second markdown-it instance with `breaks: true` for user messages only |
| Message actions (R8A) | Actions are always visible at `opacity-60`, fully opaque on hover/focus |
| Wake lock (R9A) | Opt-in Screen Wake Lock while a response streams, off by default, secure-context only |
| Activity sort (R5 client) | `THREAD_ACTIVITY_EVENT` from both composer paths; local reorder plus the server bump from patch #8 |
| CSS #7/#8 | Mobile markdown-table scrolling and responsive workspace settings moved from the patch layer into `frontend/src/index.css` |

The UI fork is rebased per upstream tag (never merged). See
[`AGENTS.md`](../AGENTS.md) decision 12 and `DOCS.md` for the user-visible
differences.

## Anchor map

Most edits use `replaceOnce(content, needle, replacement, label)`:

- the anchor must occur **exactly once** in the upstream file, otherwise
  the build fails with
  `[deepseek-patch] ERROR: expected exactly one anchor for <label>, found N`;
- `EXPECTED_VERSION = "1.19.0"` is checked against the upstream image's
  `DEPLOYMENT_VERSION` before any file is touched;
- the labels below are the third argument passed to `replaceOnce`.

The new helper (#1) is a whole-file copy; everything else uses
`replaceOnce`. The CSP (#7) is a middleware insertion and the thread-activity
patch (#8) is a post-create `update`; both are called out separately below.

### 1. New helper file

- Source: `patches/deepseek.js`
- Target: `server/utils/agents/aibitat/plugins/helpers/deepseek.js`
- Applied with `fs.copyFileSync`; there is no anchor.
- Because this is a whole-file copy, verify on every bump that upstream
  does not already ship the same path - otherwise our copy would replace
  it without triggering the anchor check.

### 2. `web-browsing.js`

- Label `web-browsing helper import`
  - Anchor:
    ```js
    const { getAnythingLLMUserAgent } = require("../../../../endpoints/utils");
    ```
  - Replacement adds `searchDeepSeek` and `getAddonOption` imports.

- Label `web-browsing provider override`
  - Anchor:
    ```js
                const provider =
                  (await SystemSettings.get({ label: "agent_search_provider" }))
                    ?.value ?? "unknown";
    ```
  - Replacement: [`snippets/provider-override.js`](patches/snippets/provider-override.js).

- Label `web-browsing provider case`
  - Anchor:
    ```js
                  case "you-search":
                    engine = "_youSearch";
                    break;
    ```
  - Replacement adds the `deepseek-search` case.

- Label `web-browsing DeepSeek provider`
  - Anchor: `          _tavilySearch: async function (query) {`
  - Replacement prepends
    [`snippets/web-browsing-search.js`](patches/snippets/web-browsing-search.js).

### 3. `systemSettings.js`

- Label `systemSettings provider allowlist`
  - Anchor: `            "you-search",\n`
  - Replacement adds `            "deepseek-search",\n` after it.

### 4. `collectorApi/index.js`

- Label `collectorApi helper import`
  - Anchor: `const { Agent } = require("undici");`
  - Replacement adds the `fetchDeepSeek` / `getAddonOption` import.

- Label `collectorApi DeepSeek Fetch`
  - Anchor:
    ```js
      async getLinkContent(link = "", captureAs = "text") {
        if (!link) return false;

    ```
  - Replacement prepends
    [`snippets/collector-fetch.js`](patches/snippets/collector-fetch.js).

### 5. `AiProviders/deepseek/index.js` (normal chat)

- Label `deepseek chat attachment helper import`
  - Anchor:
    ```js
    const {
      handleDefaultStreamResponseV2,
      formatChatHistory,
    } = require("../../helpers/chat/responses");
    ```
  - Replacement adds
    `const { attachmentToContentBlock } = require("../../helpers/attachments");`.

- Label `deepseek chat image prompt`
  - Anchor: the old `constructPrompt` block:
    ```js
      constructPrompt({
        systemPrompt = "",
        contextTexts = [],
        chatHistory = [],
        userPrompt = "",
      }) {
        const prompt = {
          role: "system",
          content: `${systemPrompt}${this.#appendContext(contextTexts)}`,
        };
        return [
          prompt,
          ...formatChatHistory(chatHistory, ({ userPrompt }) => userPrompt),
          { role: "user", content: userPrompt },
        ];
      }
    ```
  - Replacement:
    [`snippets/deepseek-chat-images.js`](patches/snippets/deepseek-chat-images.js)
    (adds `#supportsVision`, `#generateContent` and the attachment-aware
    `constructPrompt`).

### 6. `agents/aibitat/providers/deepseek.js` (agent mode)

- Label `deepseek agent attachment helper import`
  - Anchor: `const { toValidNumber } = require("../../../http/index.js");`
  - Replacement adds the `attachmentToContentBlock` import.

- Label `deepseek agent attachment formatting`
  - Anchor:
    ```js
      /**
       * DeepSeek models do not support vision/image inputs.
       * Strip attachments from messages to prevent API errors.
       * @param {Object} message - Message with potential attachments
       * @returns {Object} Message without attachments
       */
      formatMessageWithAttachments(message) {
        const { attachments: _, ...rest } = message;
        return rest;
      }
    ```
  - Replacement:
    [`snippets/deepseek-agent-images.js`](patches/snippets/deepseek-agent-images.js)
    (adds the `#supportsVision` getter and the multimodal formatter).

- Label `deepseek agent stripAttachments guard`
  - Anchor:
    ```js
      /**
       * Strip attachments from all messages since DeepSeek doesn't support vision.
       * @param {Array} messages - Array of messages
       * @returns {Array} Messages with attachments removed
       */
      #stripAttachments(messages) {
        let hasAttachments = false;
    ```
  - Replacement inserts `if (this.#supportsVision) return messages;`
    before `let hasAttachments`.

### 7. `server/index.js` (Content-Security-Policy)

- Label `server CSP header`
  - Anchor: `  const IndexPage = new MetaGenerator();` (plus its newline).
  - Replacement appends
    [`snippets/security-headers.js`](patches/snippets/security-headers.js),
    an Express middleware that sets the `Content-Security-Policy` header on
    every production HTML response before `express.static` and the SPA
    catch-all.
- The policy is:
  `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src
  'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:;
  connect-src 'self' ws: wss:; media-src 'self' data: blob:; worker-src
  'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`.
- `style-src 'unsafe-inline'` is required by the app's inline style
  attributes. `'wasm-unsafe-eval'` is required by the browser-side piper TTS
  worker. `data:`/`blob:` cover image attachments and generated media, and
  `ws:`/`wss:` cover the agent WebSocket. The policy deliberately does not
  allow `'unsafe-eval'`; no frontend code uses `eval`/`new Function`.
- The middleware is inside the existing `NODE_ENV !== "development"` block,
  so it only applies to the production image.

### 8. `workspaceChats.js` (thread activity)

- Label `workspaceChats thread activity bump`
  - Anchor: the `api_session_id: apiSessionId, include, }, });` block in
    `WorkspaceChats.new`, immediately before `return { chat, message: null };`.
  - Replacement inserts
    [`snippets/thread-activity.js`](patches/snippets/thread-activity.js)
    after the `create` and before the return.
- The snippet updates `workspace_threads.lastUpdatedAt` for the new chat's
  `threadId`. The column is `@default(now())`, not `@updatedAt`, so Prisma
  does not maintain it. The update is best-effort (`.catch(...)`): if the
  thread disappeared concurrently, the already-created chat is still
  returned instead of failing.
- The client sorts by `lastUpdatedAt ?? createdAt` and emits
  `THREAD_ACTIVITY_EVENT` immediately after sending; this patch is the
  cross-device source of truth for the next fetch.

## Vision behaviour

- Vision-capable model names in the patch:
  - `deepseek-flash`
  - `deepseek-v4-flash-vision-exp` (legacy alias, served by the latest
    Flash model)
- Text-only model names keep the old behaviour: images are stripped so
  the request does not fail. This includes `deepseek-v4-pro` and
  `deepseek-reasoner`.
- PDFs are not images. They still go through the document/OCR path (or
  the API's `application/anythingllm-document` attachment MIME) and are
  unaffected by this patch.

## Upstream build model

The image is built in this order:

```dockerfile
FROM --platform=$BUILDPLATFORM node:18-slim AS ui
# download UI_FORK_SHA (+ SHA-256), version assertion, yarn build
...
FROM mintplexlabs/anythingllm:${ANYTHINGLLM_VERSION}
...
COPY --from=ui /src/frontend/dist /app/server/public
COPY patches /opt/anythingllm-patches
RUN node /opt/anythingllm-patches/apply.js \
 && rm -rf /opt/anythingllm-patches
```

Consequences:

- The UI overlay replaces only `server/public`. The patch layer then runs on
  the unchanged upstream server files. UI changes must go into the fork, not
  into a new `replaceOnce` anchor; server changes must go into `apply.js`, not
  into the fork's server tree.
- A new upstream release replaces the target files with the new upstream
  versions; the patch layer runs again on top of them. The patches are
  not silently overwritten by the release.
- If an anchor moved, `apply.js` fails the image build before the image
  is published. That is intentional: no patch silently stops applying.
- The new helper (#1) is a whole-file copy (watch for a path collision on
  bump). Everything else uses `replaceOnce`.
- If upstream already implements one of the patched features, the patch
  becomes redundant or conflicts with the new implementation. Remove it
  and its options instead of forcing the old anchor.

## Upstream bump checklist

1. Rebase the UI fork branch on the new upstream tag (never merge):
   `git switch -c ha-ui/vX.Y.Z vX.Y.Z`, then
   `git rebase --onto vX.Y.Z <old-tag> ha-ui/vX.Y.Z`; check
   `yarn.lock` drift and run `git range-diff`.
2. Bump `ANYTHINGLLM_VERSION` in `anythingllm/Dockerfile` and `version:`
   in `anythingllm/config.yaml` (bump `-haN` for add-on-only changes; CI
   validates that the base versions match).
3. Pin the new fork commit in `UI_FORK_SHA` and its codeload tarball
   SHA-256 in `UI_FORK_SHA256` (download the tarball and run `sha256sum`).
   The build's version assertion must still match `ANYTHINGLLM_VERSION`.
4. Update `EXPECTED_VERSION` in `patches/apply.js`.
5. Re-check every anchor and snippet against the new upstream files:
   - `server/utils/agents/aibitat/plugins/web-browsing.js`
   - `server/models/systemSettings.js`
   - `server/utils/collectorApi/index.js`
   - `server/utils/AiProviders/deepseek/index.js`
   - `server/utils/agents/aibitat/providers/deepseek.js`
   - `server/index.js`
   - `server/models/workspaceChats.js`
6. Check whether upstream now supports DeepSeek Search/Fetch, DeepSeek
   vision, a suitable CSP or thread-activity timestamps; remove the
   corresponding patch(es) and options instead of carrying a redundant
   patch.
7. Re-verify the add-on integration points: the three storage symlinks
   (`/app/server/storage`, `/app/server/.env`, `/collector/hotdir`), the
   entrypoint contract, and ARMv8.0 if native binaries changed. The UI
   overlay is pure JS and does not change the binary scan.
8. Update `CHANGELOG.md`, `DOCS.md`, `README.md` and this file; build the
   amd64 image, run the add-on linter, and smoke-test the relevant path.
9. UI smoke on desktop + phone, light + dark: login, sidebar, thread
   limit/show-older, workspace collapse, line breaks in a user message,
   visible message actions, wake-lock preference, and thread activity
   ordering after reload.
10. Commit and push; CI builds the aarch64/amd64 images for the new
    version.

## Removing the patches

### When upstream adds DeepSeek Search/Fetch

- Remove steps 1–4 from `apply.js` and delete:
  - `patches/deepseek.js`
  - `patches/snippets/provider-override.js`
  - `patches/snippets/web-browsing-search.js`
  - `patches/snippets/collector-fetch.js`
- Remove `deepseek_search` and `deepseek_fetch` from `config.yaml` and
  `translations/en.yaml`.
- Remove the Search/Fetch sections from `DOCS.md` and `README.md`.
- Remove the `COPY patches` / `RUN apply.js` layer only if no patch
  remains.

### When upstream treats DeepSeek as vision-capable

- Remove step 5 from `apply.js` and delete:
  - `patches/snippets/deepseek-chat-images.js`
  - `patches/snippets/deepseek-agent-images.js`
- Keep the Search/Fetch, CSP and thread-activity patches if they are still
  needed.
- Update `DOCS.md` and `README.md` to describe the upstream behaviour.

### When upstream ships a suitable CSP

- Remove step 6 from `apply.js` and delete
  `patches/snippets/security-headers.js`; drop `server/index.js` from the
  anchor map.
- Compare the upstream policy with ours before removing it: the JWT stays in
  localStorage, so a missing `script-src` is still a real gap even if a
  header exists.

### When upstream bumps thread activity itself

- Remove step 7 from `apply.js` and delete
  `patches/snippets/thread-activity.js`; drop `workspaceChats.js` from the
  anchor map.
- Keep the client-side `THREAD_ACTIVITY_EVENT` only if it still improves the
  immediate reorder; the server value is the source of truth.

### When upstream fixes the migrated CSS

- The mobile markdown-table and responsive workspace-settings rules now live
  in the UI fork (`frontend/src/index.css`). Remove them there when upstream
  fixes the layouts, and drop the corresponding DOCS.md notes.

## Verification after changing this layer

```sh
node --check anythingllm/patches/apply.js
cd anythingllm
docker build -t anythingllm-ha:test .
docker run --rm --entrypoint sh anythingllm-ha:test -c '
  grep -n "Content-Security-Policy" /app/server/index.js
  grep -n "lastUpdatedAt: new Date()" /app/server/models/workspaceChats.js
  grep -R "supportsVision" /app/server/utils/AiProviders/deepseek \
    /app/server/utils/agents/aibitat/providers/deepseek.js
  grep -n "form.w-1" /app/server/public/index.css
'
```

The build log must include `[deepseek-patch] done` and list every patched
file. The build also verifies the fork tarball SHA-256 and the fork/base
version assertion; a wrong `UI_FORK_SHA`/`UI_FORK_SHA256` fails before the
final image is assembled. For a full prompt-level check, see the 1.18.0-ha4,
1.18.0-ha5 and 1.19.0-ha3 changelog entries.
