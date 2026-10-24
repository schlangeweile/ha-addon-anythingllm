#!/usr/bin/env node
"use strict";

/**
 * Fail-fast patch layer for the experimental DeepSeek Search/Fetch support.
 *
 * The add-on is normally a thin image on top of the official AnythingLLM
 * image. This patch deliberately adds three small changes to the server code
 * because upstream 1.18.0 has no DeepSeek web-search provider:
 *
 *   1. server/utils/agents/aibitat/plugins/helpers/deepseek.js (new helper)
 *   2. server/utils/agents/aibitat/plugins/web-browsing.js (provider)
 *   3. server/models/systemSettings.js (allowed provider value)
 *   4. server/utils/collectorApi/index.js (Fetch fallback for agent scraping)
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

console.log("[deepseek-patch] done");
