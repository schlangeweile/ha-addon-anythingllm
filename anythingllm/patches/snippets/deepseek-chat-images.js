  /**
   * Whether the selected DeepSeek model accepts image inputs.
   * @returns {boolean}
   */
  #supportsVision() {
    return ["deepseek-flash", "deepseek-v4-flash-vision-exp"].includes(
      this.model
    );
  }

  /**
   * Build the OpenAI-compatible content for a user message. DeepSeek's
   * vision model accepts image_url blocks; text-only models keep the
   * previous plain-string prompt so requests do not fail.
   * @param {{userPrompt: string, attachments?: import("../../helpers").Attachment[]}} props
   * @returns {string|object[]}
   */
  #generateContent({ userPrompt, attachments = [] }) {
    if (!attachments.length || !this.#supportsVision()) return userPrompt;
    return [
      { type: "text", text: userPrompt },
      ...attachments.map((attachment) =>
        attachmentToContentBlock(attachment, { imageDetail: "high" })
      ),
    ];
  }

  constructPrompt({
    systemPrompt = "",
    contextTexts = [],
    chatHistory = [],
    userPrompt = "",
    attachments = [],
  }) {
    const prompt = {
      role: "system",
      content: `${systemPrompt}${this.#appendContext(contextTexts)}`,
    };
    return [
      prompt,
      ...formatChatHistory(chatHistory, (args) => this.#generateContent(args)),
      {
        role: "user",
        content: this.#generateContent({ userPrompt, attachments }),
      },
    ];
  }
