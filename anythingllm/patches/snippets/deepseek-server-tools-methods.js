  /**
   * Home Assistant add-on: use DeepSeek's free server-side web tools in the
   * normal chat provider. DeepSeek executes `deepseek_web_search` and
   * `deepseek_read_url` itself, so no Search/Fetch API request is billed.
   *
   * These tools cannot be combined with function tools. This class is only
   * used for normal chat; the agent uses aibitat/providers/deepseek.js, so
   * the agent keeps its Search/Fetch provider unchanged.
   * @returns {boolean}
   */
  #serverToolsEnabled() {
    if (!getAddonOption("deepseek_server_tools", false)) return false;
    return /^deepseek(-v[\d.]+)?-flash/.test(this.model);
  }

  /**
   * Request fields for the server tools. Empty object when disabled so the
   * create() calls stay unchanged.
   * @returns {{tools?: Array<{type: string}>}}
   */
  #serverToolsRequest() {
    if (!this.#serverToolsEnabled()) return {};
    return {
      tools: [
        { type: "deepseek_web_search" },
        { type: "deepseek_read_url" },
      ],
    };
  }

  /**
   * Map DeepSeek's annotations/server_tool_calls to AnythingLLM's source
   * shape. `annotations` carry the cited URLs, `server_tool_calls` also carry
   * the snippets and pages that were read.
   * @param {Object} message
   * @returns {Array<{id: string, title: string, text: string, chunkSource: string, score: null}>}
   */
  #serverToolSources(message = {}) {
    const sources = [];
    const seen = new Set();
    const add = (url, title, text = "") => {
      if (!url || seen.has(url)) return;
      seen.add(url);
      sources.push({
        id: url,
        title: title || url,
        text,
        chunkSource: `link://${url}`,
        score: null,
      });
    };

    for (const annotation of message?.annotations || []) {
      const citation = annotation?.url_citation || annotation;
      add(citation?.url, citation?.title);
    }

    for (const step of message?.server_tool_calls || []) {
      for (const call of step?.calls || []) {
        for (const source of call?.sources || [])
          add(source?.url, source?.title, source?.snippet);
        if (call?.page?.url) add(call.page.url, call.page.title);
      }
    }
    return sources;
  }

  /**
   * Observe the provider stream and append any server-tool sources to the
   * shared sources array before the default handler writes its final chunk.
   * @param {AsyncIterable} stream
   * @param {Array} sources
   */
  async *#observeServerToolSources(stream, sources) {
    const seen = new Set((sources || []).map((source) => source.id));
    for await (const chunk of stream) {
      const delta = chunk?.choices?.[0]?.delta;
      for (const source of this.#serverToolSources(delta)) {
        if (seen.has(source.id)) continue;
        seen.add(source.id);
        sources.push(source);
      }
      yield chunk;
    }
  }
