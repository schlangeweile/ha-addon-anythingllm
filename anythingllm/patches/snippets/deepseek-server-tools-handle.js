  handleStream(response, stream, responseProps) {
    if (!this.#serverToolsEnabled())
      return handleDefaultStreamResponseV2(response, stream, responseProps);

    const sources = responseProps?.sources || [];
    const observed = this.#observeServerToolSources(stream, sources);
    observed.endMeasurement = (usage) => stream.endMeasurement?.(usage);
    return handleDefaultStreamResponseV2(response, observed, {
      ...responseProps,
      sources,
    });
  }
