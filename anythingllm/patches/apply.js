#!/usr/bin/env node
"use strict";

/**
 * Fail-fast server patch layer: DeepSeek Fetch, a Content-Security-Policy,
 * thread-activity bookkeeping, longer auto-generated thread names and the
 * PWA manifest icon set.
 *
 * The add-on is normally a thin image on top of the official AnythingLLM
 * image. This patch deliberately changes the upstream server code for five
 * reasons: upstream 1.20.0 has no DeepSeek Fetch path for the agent's scrape
 * skill, the SPA has no CSP despite storing its JWT in localStorage, Prisma
 * never bumps a thread's lastUpdatedAt when a chat is saved, auto-generated
 * thread names are cut to 22 characters so the UI can never use the available
 * width, and the generated PWA manifest only lists the favicon although the
 * UI fork ships a 192/512/maskable icon set. The changes are:
 *
 *   1. server/utils/agents/aibitat/plugins/helpers/deepseek.js (new helper)
 *   2. server/utils/collectorApi/index.js (Fetch fallback for agent scraping)
 *   3. server/utils/AiProviders/deepseek/index.js (DeepSeek's free
 *      server-side web tools in normal chat, optional)
 *   4. server/index.js (Content-Security-Policy for the production SPA)
 *   5. server/models/workspaceChats.js (bump a thread's lastUpdatedAt when a
 *      chat is saved, so the sidebar can sort by activity)
 *   6. server/models/workspaceThread.js and server/endpoints/workspaces.js
 *      (store up to 64 characters of an auto-generated thread name and let
 *      the UI truncate by rendered width)
 *   7. server/utils/boot/MetaGenerator.js (emit the UI fork's PWA icon set)
 *
 * Upstream 1.20.0 now ships the DeepSeek vision support and the DeepSeek
 * agent search provider that earlier add-on versions patched in; those
 * patches were removed. The PWA manifest route order is upstream too now, so
 * only the generator output is overridden.
 *
 * Frontend changes live in the UI fork (public branch ha-ui/v1.20.0) and are
 * copied in as a built overlay.
 *
 * The script asserts the pinned upstream version and fails the image build if
 * an anchor is no longer present. That is intentional: on every upstream
 * bump the anchors and the snippets must be re-checked.
 */

const fs = require("fs");
const path = require("path");

const APP_DIR = "/app";
const EXPECTED_VERSION = "1.20.0";

function fail(message) {
  console.error(`[addon-patch] ERROR: ${message}`);
  process.exit(1);
}

function readApp(relativePath) {
  const file = path.join(APP_DIR, relativePath);
  if (!fs.existsSync(file)) fail(`missing file: ${file}`);
  return fs.readFileSync(file, "utf8");
}

function writeApp(relativePath, content) {
  const file = path.join(APP_DIR, relativePath);
  fs.writeFileSync(file, content);
  console.log(`[addon-patch] patched ${relativePath}`);
}

function readSnippet(name) {
  const file = path.join(__dirname, "snippets", name);
  if (!fs.existsSync(file)) fail(`missing snippet: ${file}`);
  return fs.readFileSync(file, "utf8");
}

function replaceOnce(content, needle, replacement, label) {
  const count = content.split(needle).length - 1;
  if (count !== 1) {
    fail(`expected exactly one anchor for ${label}, found ${count}`);
  }
  return content.replace(needle, replacement);
}

if (process.env.DEPLOYMENT_VERSION !== EXPECTED_VERSION) {
  fail(
    `expected AnythingLLM ${EXPECTED_VERSION}, got ${
      process.env.DEPLOYMENT_VERSION || "<unset>"
    } - update patches/apply.js and the snippets before bumping the image`
  );
}

// 1. Install the DeepSeek Fetch helper next to the other plugin helpers.
const helperTarget =
  "server/utils/agents/aibitat/plugins/helpers/deepseek.js";
fs.mkdirSync(path.dirname(path.join(APP_DIR, helperTarget)), {
  recursive: true,
});
fs.copyFileSync(path.join(__dirname, "deepseek.js"), path.join(APP_DIR, helperTarget));
console.log(`[addon-patch] installed ${helperTarget}`);

// 2. Use DeepSeek Fetch for the agent's scrape skill when enabled. Upstream
//    only routes through the collector, which cannot run Chromium as root;
//    DeepSeek Fetch is the add-on's non-Chromium path for single URLs.
let collectorApi = readApp("server/utils/collectorApi/index.js");
collectorApi = replaceOnce(
  collectorApi,
  'const { Agent } = require("undici");',
  'const { Agent } = require("undici");\n' +
    'const {\n  fetchDeepSeek,\n  getAddonOption,\n} = require("../agents/aibitat/plugins/helpers/deepseek");',
  "collectorApi helper import"
);
collectorApi = replaceOnce(
  collectorApi,
  `  async getLinkContent(link = "", captureAs = "text") {
    if (!link) return false;

`,
  `  async getLinkContent(link = "", captureAs = "text") {
    if (!link) return false;

` + readSnippet("collector-fetch.js"),
  "collectorApi DeepSeek Fetch"
);
writeApp("server/utils/collectorApi/index.js", collectorApi);

// 3. Use DeepSeek's free server-side web tools in normal chat when the
//    add-on option deepseek_server_tools is enabled. Upstream 1.20.0 has no
//    support for them; the agent's Search/Fetch provider is separate and
//    keeps using the paid APIs because DeepSeek does not allow server tools
//    together with function tools. Only flash models support these tools.
let deepseekChat = readApp("server/utils/AiProviders/deepseek/index.js");
deepseekChat = replaceOnce(
  deepseekChat,
  `} = require("../../helpers/reasoningEffort");`,
  `} = require("../../helpers/reasoningEffort");\n` +
    readSnippet("deepseek-server-tools-import.js"),
  "deepseek server-tools import"
);
deepseekChat = replaceOnce(
  deepseekChat,
  `  /**
   * Generates appropriate content array for a message + attachments.`,
  readSnippet("deepseek-server-tools-methods.js") +
    `\n  /**
   * Generates appropriate content array for a message + attachments.`,
  "deepseek server-tools methods"
);
deepseekChat = replaceOnce(
  deepseekChat,
  `        .create({
          model: this.model,
          messages,
          ...temperatureParam(temperature),`,
  `        .create({
          model: this.model,
          messages,
          ...this.#serverToolsRequest(),
          ...temperatureParam(temperature),`,
  "deepseek server-tools non-stream request"
);
deepseekChat = replaceOnce(
  deepseekChat,
  `        model: this.model,
        stream: true,
        messages,
        ...temperatureParam(temperature),`,
  `        model: this.model,
        stream: true,
        messages,
        ...this.#serverToolsRequest(),
        ...temperatureParam(temperature),`,
  "deepseek server-tools stream request"
);
deepseekChat = replaceOnce(
  deepseekChat,
  `    return {
      textResponse: this.#parseReasoningFromResponse(result.output.choices[0]),
      metrics: {`,
  `    return {
      textResponse: this.#parseReasoningFromResponse(result.output.choices[0]),
      sources: this.#serverToolSources(
        result.output.choices[0]?.message
      ),
      metrics: {`,
  "deepseek server-tools non-stream sources"
);
deepseekChat = replaceOnce(
  deepseekChat,
  `  handleStream(response, stream, responseProps) {
    return handleDefaultStreamResponseV2(response, stream, responseProps);
  }`,
  readSnippet("deepseek-server-tools-handle.js").trimEnd(),
  "deepseek server-tools stream handler"
);
writeApp("server/utils/AiProviders/deepseek/index.js", deepseekChat);

// 4. Enforce a Content-Security-Policy on the production SPA. The JWT is kept
//    in localStorage, so without a CSP a single successful XSS can read and
//    exfiltrate it. Add the header before express.static and the SPA
//    catch-all, which are the only production routes that serve HTML.
let serverIndex = readApp("server/index.js");
serverIndex = replaceOnce(
  serverIndex,
  "  const IndexPage = new MetaGenerator();\n",
  "  const IndexPage = new MetaGenerator();\n\n" +
    readSnippet("security-headers.js"),
  "server CSP header"
);
writeApp("server/index.js", serverIndex);

// 5. Bump the thread's lastUpdatedAt whenever a chat is saved. The UI sorts
//    threads by lastUpdatedAt (falling back to createdAt); Prisma does not
//    maintain that column automatically because it is @default(now()), not
//    @updatedAt. Upstream 1.20.0 replaced WorkspaceChats.new with upsert, so
//    the bump happens after both creates and updates. It is best-effort so a
//    deleted thread cannot fail a chat that was already created.
let workspaceChats = readApp("server/models/workspaceChats.js");
workspaceChats = replaceOnce(
  workspaceChats,
  `        // On creates, we need to set the prompt or else record will fail.
        create: { ...payload, prompt: data.prompt },
      });
      return { chat, message: null };`,
  `        // On creates, we need to set the prompt or else record will fail.
        create: { ...payload, prompt: data.prompt },
      });
` +
    readSnippet("thread-activity.js") +
    `      return { chat, message: null };`,
  "workspaceChats thread activity bump"
);
writeApp("server/models/workspaceChats.js", workspaceChats);

// 6. Store longer auto-generated thread names. Upstream cuts the first prompt
//    (and a forked thread's last answer) to 22 characters at creation time, so
//    the sidebar and search can never show more even when the row has room.
//    Store up to 64 characters; every surface already truncates by CSS width.
let workspaceThread = readApp("server/models/workspaceThread.js");
workspaceThread = replaceOnce(
  workspaceThread,
  "      name: truncate(prompt, 22),",
  "      name: truncate(prompt, 64),",
  "workspaceThread auto-name length"
);
writeApp("server/models/workspaceThread.js", workspaceThread);

let workspacesEndpoint = readApp("server/endpoints/workspaces.js");
workspacesEndpoint = replaceOnce(
  workspacesEndpoint,
  "            ? truncate(lastMessageText, 22)",
  "            ? truncate(lastMessageText, 64)",
  "forked thread auto-name length"
);
writeApp("server/endpoints/workspaces.js", workspacesEndpoint);

// 7. Emit the UI fork's PWA icon set. Upstream 1.20.0 already serves the
//    dynamic manifest before express.static (our former route-order patch is
//    gone), but its generator only lists the favicon, which Chrome does not
//    accept for installability. Keep the configured name and add the
//    192/512/maskable PNGs that the fork ships in frontend/public.
let metaGenerator = readApp("server/utils/boot/MetaGenerator.js");
metaGenerator = replaceOnce(
  metaGenerator,
  `      const manifest = {
        name: manifestName,
        short_name: manifestName,
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          {
            src: iconUrl,
            sizes: "any",
          },
        ],
      };

      response.type("application/json").status(200).send(manifest).end();`,
  readSnippet("manifest.js"),
  "MetaGenerator manifest output"
);
writeApp("server/utils/boot/MetaGenerator.js", metaGenerator);

console.log("[addon-patch] done");
