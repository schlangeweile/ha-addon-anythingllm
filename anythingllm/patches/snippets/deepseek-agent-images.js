  /**
   * Whether the selected DeepSeek model accepts image inputs.
   * @returns {boolean}
   */
  get #supportsVision() {
    return ["deepseek-flash", "deepseek-v4-flash-vision-exp"].includes(
      this.model
    );
  }

  /**
   * DeepSeek's vision model accepts OpenAI-style image_url content blocks.
   * Text-only models keep the previous behavior of stripping attachments so
   * the request does not fail with an unsupported content type.
   * @param {Object} message - Message with potential attachments
   * @returns {Object} Message formatted for the API
   */
  formatMessageWithAttachments(message) {
    if (!message.attachments || message.attachments.length === 0) {
      return message;
    }

    if (!this.#supportsVision) {
      const { attachments: _, ...rest } = message;
      return rest;
    }

    const content = [{ type: "text", text: message.content }];
    for (const attachment of message.attachments) {
      content.push(
        attachmentToContentBlock(attachment, { imageDetail: "high" })
      );
    }

    const { attachments: _, ...rest } = message;
    return { ...rest, content };
  }
