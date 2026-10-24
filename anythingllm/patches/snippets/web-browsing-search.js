          _deepSeekSearch: async function (query) {
            if (!process.env.DEEPSEEK_API_KEY) {
              this.super.introspect(
                `${this.caller}: I can't use DeepSeek Search because the DeepSeek API key is not set.`
              );
              return `Search is disabled and no content was found. This functionality is disabled because the user has not set it up yet.`;
            }

            this.super.introspect(
              `${this.caller}: Using DeepSeek Search for "${
                query.length > 100 ? `${query.slice(0, 100)}...` : query
              }"`
            );

            try {
              const results = await searchDeepSeek(query);
              if (results.length === 0)
                return `No information was found online for the search query.`;

              this.reportSearchResultsCitations(results);
              const result = JSON.stringify(results);
              this.super.introspect(
                `${this.caller}: I found ${results.length} results - reviewing the results now. (~${this.countTokens(result)} tokens)`
              );
              return result;
            } catch (e) {
              this.super.handlerProps.log(`DeepSeek Search Error: ${e.message}`);
              return `There was an error searching for content. ${e.message}`;
            }
          },
