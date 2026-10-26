#!/usr/bin/env node
"use strict";

/**
 * Fail-fast patch layer for DeepSeek Search/Fetch and native image support.
 *
 * The add-on is normally a thin image on top of the official AnythingLLM
 * image. This patch deliberately changes the server code for two reasons:
 * upstream 1.18.0 has no DeepSeek web-search provider, and its native
 * DeepSeek provider hard-codes the model as text-only even though
 * deepseek-flash accepts images. The changes are:
 *
 *   1. server/utils/agents/aibitat/plugins/helpers/deepseek.js (new helper)
 *   2. server/utils/agents/aibitat/plugins/web-browsing.js (provider)
 *   3. server/models/systemSettings.js (allowed provider value)
 *   4. server/utils/collectorApi/index.js (Fetch fallback for agent scraping)
 *   5. server/utils/AiProviders/deepseek/index.js and
 *      server/utils/agents/aibitat/providers/deepseek.js (image attachments
 *      for vision-capable DeepSeek models)
 *
 * The script asserts the pinned upstream version and fails the image build if
 * an anchor is no longer present. That is intentional: on every upstream
 * bump the anchors and the snippets must be re-checked.
 */

const fs = require("fs");
const path = require("path");

const APP_DIR = "/app";
const EXPECTED_VERSION = "1.18.0";

function fail(message) {
  console.error(`[deepseek-patch] ERROR: ${message}`);
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
  console.log(`[deepseek-patch] patched ${relativePath}`);
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

// 1. Install the DeepSeek API helper next to the other plugin helpers.
const helperTarget =
  "server/utils/agents/aibitat/plugins/helpers/deepseek.js";
fs.mkdirSync(path.dirname(path.join(APP_DIR, helperTarget)), {
  recursive: true,
});
fs.copyFileSync(path.join(__dirname, "deepseek.js"), path.join(APP_DIR, helperTarget));
console.log(`[deepseek-patch] installed ${helperTarget}`);

// 2. Patch the web-browsing plugin: import the helper, allow the provider,
//    force it when the add-on option is enabled, and add the provider itself.
let webBrowsing = readApp(
  "server/utils/agents/aibitat/plugins/web-browsing.js"
);

webBrowsing = replaceOnce(
  webBrowsing,
  'const { getAnythingLLMUserAgent } = require("../../../../endpoints/utils");',
  'const { getAnythingLLMUserAgent } = require("../../../../endpoints/utils");\n' +
    'const { searchDeepSeek, getAddonOption } = require("./helpers/deepseek");',
  "web-browsing helper import"
);

webBrowsing = replaceOnce(
  webBrowsing,
  `            const provider =
              (await SystemSettings.get({ label: "agent_search_provider" }))
                ?.value ?? "unknown";`,
  readSnippet("provider-override.js"),
  "web-browsing provider override"
);

webBrowsing = replaceOnce(
  webBrowsing,
  `              case "you-search":
                engine = "_youSearch";
                break;`,
  `              case "you-search":
                engine = "_youSearch";
                break;
              case "deepseek-search":
                engine = "_deepSeekSearch";
                break;`,
  "web-browsing provider case"
);

webBrowsing = replaceOnce(
  webBrowsing,
  "          _tavilySearch: async function (query) {",
  readSnippet("web-browsing-search.js") +
    "          _tavilySearch: async function (query) {",
  "web-browsing DeepSeek provider"
);

writeApp("server/utils/agents/aibitat/plugins/web-browsing.js", webBrowsing);

// 3. Allow the new provider value in the system-settings validator.
let systemSettings = readApp("server/models/systemSettings.js");
systemSettings = replaceOnce(
  systemSettings,
  '            "you-search",\n',
  '            "you-search",\n            "deepseek-search",\n',
  "systemSettings provider allowlist"
);
writeApp("server/models/systemSettings.js", systemSettings);

// 4. Use DeepSeek Fetch for the agent's scrape skill when enabled.
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

// 5. Native DeepSeek provider: pass image attachments through to
//    vision-capable models (deepseek-flash). Upstream 1.18.0 treats every
//    DeepSeek model as text-only and drops images in both chat and agent mode.
let deepseekChat = readApp("server/utils/AiProviders/deepseek/index.js");
deepseekChat = replaceOnce(
  deepseekChat,
  `const {
  handleDefaultStreamResponseV2,
  formatChatHistory,
} = require("../../helpers/chat/responses");`,
  `const {
  handleDefaultStreamResponseV2,
  formatChatHistory,
} = require("../../helpers/chat/responses");
const { attachmentToContentBlock } = require("../../helpers/attachments");`,
  "deepseek chat attachment helper import"
);
deepseekChat = replaceOnce(
  deepseekChat,
  `  constructPrompt({
    systemPrompt = "",
    contextTexts = [],
    chatHistory = [],
    userPrompt = "",
  }) {
    const prompt = {
      role: "system",
      content: \`\${systemPrompt}\${this.#appendContext(contextTexts)}\`,
    };
    return [
      prompt,
      ...formatChatHistory(chatHistory, ({ userPrompt }) => userPrompt),
      { role: "user", content: userPrompt },
    ];
  }`,
  readSnippet("deepseek-chat-images.js"),
  "deepseek chat image prompt"
);
writeApp("server/utils/AiProviders/deepseek/index.js", deepseekChat);

let deepseekAgent = readApp(
  "server/utils/agents/aibitat/providers/deepseek.js"
);
deepseekAgent = replaceOnce(
  deepseekAgent,
  'const { toValidNumber } = require("../../../http/index.js");',
  'const { toValidNumber } = require("../../../http/index.js");\n' +
    'const {\n  attachmentToContentBlock,\n} = require("../../../helpers/attachments");',
  "deepseek agent attachment helper import"
);
deepseekAgent = replaceOnce(
  deepseekAgent,
  `  /**
   * DeepSeek models do not support vision/image inputs.
   * Strip attachments from messages to prevent API errors.
   * @param {Object} message - Message with potential attachments
   * @returns {Object} Message without attachments
   */
  formatMessageWithAttachments(message) {
    const { attachments: _, ...rest } = message;
    return rest;
  }`,
  readSnippet("deepseek-agent-images.js"),
  "deepseek agent attachment formatting"
);
deepseekAgent = replaceOnce(
  deepseekAgent,
  `  /**
   * Strip attachments from all messages since DeepSeek doesn't support vision.
   * @param {Array} messages - Array of messages
   * @returns {Array} Messages with attachments removed
   */
  #stripAttachments(messages) {
    let hasAttachments = false;`,
  `  /**
   * Strip attachments from messages for text-only DeepSeek models. Vision
   * models (deepseek-flash) keep them so formatMessageWithAttachments can
   * build image_url blocks.
   * @param {Array} messages - Array of messages
   * @returns {Array} Messages with attachments removed when unsupported
   */
  #stripAttachments(messages) {
    if (this.#supportsVision) return messages;
    let hasAttachments = false;`,
  "deepseek agent stripAttachments guard"
);
writeApp("server/utils/agents/aibitat/providers/deepseek.js", deepseekAgent);

console.log("[deepseek-patch] done");
