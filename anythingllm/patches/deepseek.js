"use strict";

/**
 * Local DeepSeek Search/Fetch helpers for the AnythingLLM add-on patch.
 *
 * This file is copied into the image by patches/apply.js. It is not part of
 * the upstream AnythingLLM source tree.
 *
 * Search: POST https://api.deepseek.com/v1/tools/search
 * Fetch:  POST https://api.deepseek.com/v1/tools/fetch
 *
 * Both use the same Bearer key as the DeepSeek LLM API. The API base can be
 * overridden with DEEPSEEK_API_BASE for local testing.
 */

const fs = require("fs");

const OPTIONS_FILE = "/data/options.json";
const DEFAULT_BASE_URL = "https://api.deepseek.com";
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Read a feature toggle from the Home Assistant add-on options file.
 * The Supervisor writes it to /data/options.json.
 *
 * @param {string} name
 * @param {boolean} fallback
 * @returns {boolean}
 */
function getAddonOption(name, fallback = false) {
  try {
    const options = JSON.parse(fs.readFileSync(OPTIONS_FILE, "utf8"));
    if (!Object.prototype.hasOwnProperty.call(options, name)) return fallback;
    return options[name] === true || options[name] === "true";
  } catch {
    return fallback;
  }
}

function apiBaseUrl() {
  return (process.env.DEEPSEEK_API_BASE || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

async function post(path, body) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not set");

  const response = await fetch(`${apiBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `DeepSeek ${path} failed: ${response.status} ${response.statusText}${
        detail ? ` - ${detail.slice(0, 200)}` : ""
      }`
    );
  }

  return await response.json();
}

/**
 * Search with DeepSeek's in-house search engine and map the results to the
 * shape AnythingLLM's web-search providers use for citations.
 *
 * @param {string} query
 * @param {{count?: number, needContent?: boolean}} [options]
 * @returns {Promise<Array<{title: string, link: string, snippet: string}>>}
 */
async function searchDeepSeek(query, { count = 10, needContent = false } = {}) {
  const data = await post("/v1/tools/search", {
    query,
    count,
    need_content: needContent,
  });

  return (data.results || []).map((result) => ({
    title: result.title || result.url || "Untitled result",
    link: result.url,
    // summary is the model-oriented long form (600-800 chars), snippet is
    // the short UI form. Prefer the summary for the agent.
    snippet: result.summary || result.snippet || "",
  }));
}

/**
 * Fetch a single page through DeepSeek's Fetch API. Returns Markdown.
 *
 * @param {string} url
 * @returns {Promise<{title: string, content: string}>}
 */
async function fetchDeepSeek(url) {
  const data = await post("/v1/tools/fetch", { url });
  return { title: data.title || "", content: data.content || "" };
}

module.exports = { getAddonOption, searchDeepSeek, fetchDeepSeek };
