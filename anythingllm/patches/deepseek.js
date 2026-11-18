"use strict";

/**
 * Local DeepSeek Fetch helper for the AnythingLLM add-on patch.
 *
 * This file is copied into the image by patches/apply.js. It is not part of
 * the upstream AnythingLLM source tree.
 *
 * Fetch: POST https://api.deepseek.com/v1/tools/fetch
 *
 * It uses the same Bearer key as the DeepSeek LLM API. The API base can be
 * overridden with DEEPSEEK_API_BASE for local testing.
 *
 * DeepSeek Search is no longer patched in: upstream 1.20.0 ships its own
 * DeepSeek search provider (configured with AGENT_DEEPSEEK_API_KEY in the
 * agent web-search settings). Only the Fetch path is still add-on-only.
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

/**
 * Fetch a single page through DeepSeek's Fetch API. Returns Markdown.
 *
 * @param {string} url
 * @returns {Promise<{title: string, content: string}>}
 */
async function fetchDeepSeek(url) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not set");

  const response = await fetch(`${apiBaseUrl()}/v1/tools/fetch`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `DeepSeek /v1/tools/fetch failed: ${response.status} ${response.statusText}${
        detail ? ` - ${detail.slice(0, 200)}` : ""
      }`
    );
  }

  const data = await response.json();
  return { title: data.title || "", content: data.content || "" };
}

module.exports = { getAddonOption, fetchDeepSeek };
