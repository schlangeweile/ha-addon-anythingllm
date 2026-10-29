# Add-on patches (AnythingLLM 1.19.0-ha2)

This add-on is a thin layer on the pinned upstream image
`mintplexlabs/anythingllm:1.19.0`, plus the build-time patch layer in
[`patches/`](patches/). This file is the central inventory of every
patch, the exact upstream anchors it relies on, and the checklist for an
upstream bump.

The authoritative implementation is [`patches/apply.js`](patches/apply.js).
Patches are applied at image build time, not at runtime.

The anchors were re-checked against AnythingLLM 1.19.0. The server snippets are
unchanged from the 1.18.0-ha5 patch layer; 1.19.0-ha2 adds the second CSS
snippet (#8) for narrow workspace-settings screens.

## Patch inventory

| # | Patch | Upstream target | Purpose | Add-on option | Remove when |
|---|-------|-----------------|---------|---------------|-------------|
| 1 | [`patches/deepseek.js`](patches/deepseek.js) | `server/utils/agents/aibitat/plugins/helpers/deepseek.js` (new file) | DeepSeek Search/Fetch clients | `deepseek_search`, `deepseek_fetch` | Upstream has native DeepSeek Search/Fetch |
| 2 | [`snippets/provider-override.js`](patches/snippets/provider-override.js), [`snippets/web-browsing-search.js`](patches/snippets/web-browsing-search.js) plus inline anchors | `server/utils/agents/aibitat/plugins/web-browsing.js` | DeepSeek Search provider and forced provider selection | `deepseek_search` | Same as #1 |
| 3 | Inline anchors in `apply.js` | `server/models/systemSettings.js` | Allow `deepseek-search` in the provider validator | `deepseek_search` | Same as #1 |
| 4 | [`snippets/collector-fetch.js`](patches/snippets/collector-fetch.js) | `server/utils/collectorApi/index.js` | DeepSeek Fetch for the agent's "Scrape websites" skill | `deepseek_fetch` | Upstream has native Fetch/scrape support |
| 5 | [`snippets/deepseek-chat-images.js`](patches/snippets/deepseek-chat-images.js) | `server/utils/AiProviders/deepseek/index.js` | Image attachments in normal chat for `deepseek-flash` | none | Upstream treats DeepSeek as vision-capable |
| 6 | [`snippets/deepseek-agent-images.js`](patches/snippets/deepseek-agent-images.js) | `server/utils/agents/aibitat/providers/deepseek.js` | Image attachments in agent mode plus `#stripAttachments` guard | none | Same as #5 |
| 7 | [`snippets/markdown-table-scroll.css`](patches/snippets/markdown-table-scroll.css) | `server/public/index.css` | Horizontal scrolling for wide markdown tables on screens up to 600 px | none | Upstream makes markdown tables scrollable itself |
| 8 | [`snippets/workspace-settings-responsive.css`](patches/snippets/workspace-settings-responsive.css) | `server/public/index.css` | Full-width workspace-settings forms below 1280 px and 16 px page padding below 768 px | none | Upstream makes its workspace-settings layout responsive |

The image patch (#5/#6) is always applied; it only affects the native
DeepSeek provider. The two CSS patches (#7/#8) are also always applied: #7
only affects chat markdown tables below the 600 px breakpoint, and #8 only
affects the workspace-settings page below the Tailwind xl/md breakpoints.
Only the Search/Fetch behaviour is controlled by the two add-on options.

## Anchor map

Most edits use `replaceOnce(content, needle, replacement, label)`:

- the anchor must occur **exactly once** in the upstream file, otherwise
  the build fails with
  `[deepseek-patch] ERROR: expected exactly one anchor for <label>, found N`;
- `EXPECTED_VERSION = "1.19.0"` is checked against the upstream image's
  `DEPLOYMENT_VERSION` before any file is touched;
- the labels below are the third argument passed to `replaceOnce`.

The new helper (#1) is a whole-file copy; the two CSS patches (#7/#8) are
guarded appends. All three are called out separately below.

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

### 7. `server/public/index.css` (mobile markdown tables)

- No `replaceOnce` anchor. `apply.js` verifies that `.markdown table`
  exists in the built stylesheet, then appends
  [`snippets/markdown-table-scroll.css`](patches/snippets/markdown-table-scroll.css)
  once. The `anythingllm-ha: markdown-table-scroll` marker keeps the CSS
  append itself idempotent.
- If `.markdown table` is missing, the build fails with
  `[deepseek-patch] ERROR: could not find the .markdown table rule in
  server/public/index.css`.
- The override is appended at the end of the stylesheet, so it wins over
  the upstream `.markdown table { overflow: hidden; }` rule:

  ```css
  /* anythingllm-ha: markdown-table-scroll
   * Keep in sync with anythingllm/PATCHES.md.
   * Upstream clips wide markdown tables with `.markdown table { overflow: hidden; }`
   * and has no scroll wrapper. On narrow screens, make the table itself a
   * horizontal scroll container so all columns stay reachable.
   */
  @media (max-width: 600px) {
    .markdown table {
      display: block;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      max-width: 100%;
    }
  }
  ```

- This is a display-only workaround. It does not change model output, the
  API, or tables on wider screens; it only makes the table swipeable on
  phones.

### 8. `server/public/index.css` (workspace settings on narrow screens)

- No `replaceOnce` anchor. `apply.js` verifies that `.w-1\/2` and `.px-16`
  exist in the built stylesheet, then appends
  [`snippets/workspace-settings-responsive.css`](patches/snippets/workspace-settings-responsive.css)
  once. The `anythingllm-ha: workspace-settings-responsive` marker keeps
  the CSS append itself idempotent.
- If either class is missing, the build fails with
  `[deepseek-patch] ERROR: could not find the .w-1/2 rule ...` or
  `could not find the .px-16 rule ...`.
- Upstream builds every workspace-settings form with `w-1/2` and wraps the
  page content in `px-16 py-6`. On a narrow window the form is only half of
  an already narrow content column, so the labels and descriptions wrap
  every few words. The override uses the full content width below the xl
  breakpoint and reduces the page padding on phones:

  ```css
  /* anythingllm-ha: workspace-settings-responsive
   * Keep in sync with anythingllm/PATCHES.md.
   * Upstream pins every workspace-settings form to `w-1/2` and pads the page
   * with a fixed `px-16` (64 px per side). On a narrow window that leaves only
   * a fraction of an already narrow column, so labels wrap word by word.
   * Below the xl breakpoint (1280 px) the form uses the full content width;
   * on phones the page padding shrinks to 16 px as well. Only the workspace
   * settings page uses `form.w-1/2` and `div.px-16.py-6`, so this is scoped.
   */
  @media (max-width: 1279px) {
    form.w-1\/2 {
      width: 100%;
    }
  }

  @media (max-width: 767px) {
    div.px-16.py-6 {
      padding-left: 1rem;
      padding-right: 1rem;
    }
  }
  ```

- This is also display-only. It does not change the form fields, the save
  behaviour or the API, and it leaves the desktop layout (>= 1280 px) at
  the upstream 50 % width. The selectors are safe because only the
  workspace-settings pages use `form.w-1/2` and `div.px-16.py-6` in
  1.19.0.

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
FROM mintplexlabs/anythingllm:${ANYTHINGLLM_VERSION}
...
COPY patches /opt/anythingllm-patches
RUN node /opt/anythingllm-patches/apply.js \
 && rm -rf /opt/anythingllm-patches
```

Consequences:

- A new upstream release replaces the target files with the new upstream
  versions; the patch layer runs again on top of them. The patches are
  not silently overwritten by the release.
- If an anchor moved, `apply.js` fails the image build before the image
  is published. That is intentional: no patch silently stops applying.
- The new helper (#1) and the CSS appends (#7/#8) do not use `replaceOnce`:
  #1 is a whole-file copy (watch for a path collision on bump); #7 checks
  for the `.markdown table` rule, #8 for `.w-1\/2` + `.px-16`, and both
  append once via their markers.
- If upstream already implements one of the patched features, the patch
  becomes redundant or conflicts with the new implementation. Remove it
  and its options instead of forcing the old anchor.

## Upstream bump checklist

1. Bump `ANYTHINGLLM_VERSION` in `anythingllm/Dockerfile` and `version:`
   in `anythingllm/config.yaml` (bump `-haN` for add-on-only changes; CI
   validates that the base versions match).
2. Update `EXPECTED_VERSION` in `patches/apply.js`.
3. Re-check every anchor and snippet against the new upstream files:
   - `server/utils/agents/aibitat/plugins/web-browsing.js`
   - `server/models/systemSettings.js`
   - `server/utils/collectorApi/index.js`
   - `server/utils/AiProviders/deepseek/index.js`
   - `server/utils/agents/aibitat/providers/deepseek.js`
   - `server/public/index.css`
4. Check whether upstream now supports DeepSeek Search/Fetch, DeepSeek
   vision, scrollable markdown tables or a responsive workspace-settings
   layout; remove the corresponding patch(es) and options instead of
   carrying a redundant patch.
5. Re-verify the add-on integration points: the three storage symlinks
   (`/app/server/storage`, `/app/server/.env`, `/collector/hotdir`), the
   entrypoint contract, and ARMv8.0 if native binaries changed.
6. Update `CHANGELOG.md`, `DOCS.md`, `README.md` and this file; build the
   amd64 image, run the add-on linter, and smoke-test the relevant path.
7. Commit and push; CI builds the aarch64/amd64 images for the new
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
- Keep the Search/Fetch, table-scroll and responsive-settings patches if
  they are still needed.
- Update `DOCS.md` and `README.md` to describe the upstream behaviour.

### When upstream makes markdown tables scrollable

- Remove step 6 from `apply.js` and delete
  `patches/snippets/markdown-table-scroll.css`.
- Remove the mobile-table notes from `DOCS.md` and `README.md`.
- Remove the patch row and anchor section from this file.

### When upstream makes workspace settings responsive

- Remove step 7 from `apply.js` and delete
  `patches/snippets/workspace-settings-responsive.css`.
- Remove the narrow-screen notes from `DOCS.md` and `README.md`.
- Remove the patch row and anchor section from this file.

## Verification after changing this layer

```sh
node --check anythingllm/patches/apply.js
cd anythingllm
docker build -t anythingllm-ha:test .
docker run --rm --entrypoint sh anythingllm-ha:test -c '
  grep -n "markdown-table-scroll" /app/server/public/index.css
  grep -n "workspace-settings-responsive" /app/server/public/index.css
  grep -R "supportsVision" /app/server/utils/AiProviders/deepseek \
    /app/server/utils/agents/aibitat/providers/deepseek.js
'
```

The build log must include `[deepseek-patch] done` and list every patched
file. For a full prompt-level check, see the 1.18.0-ha4, 1.18.0-ha5 and
1.19.0-ha2 changelog entries.
