    if (getAddonOption("deepseek_fetch", false) && process.env.DEEPSEEK_API_KEY) {
      try {
        const page = await fetchDeepSeek(link);
        if (page?.content) return { success: true, content: page.content };
      } catch (e) {
        this.log?.(`DeepSeek Fetch failed for ${link}: ${e.message}`);
      }
    }

