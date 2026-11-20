              // The add-on keeps every result that has a URL and sends the
              // model-oriented `summary` (600-800 chars per DeepSeek's docs)
              // instead of the 100-200 char UI `snippet`. Upstream 1.20 drops
              // results below a rerank_score of 1.5 and cuts the text at 500
              // chars; the agent then spends its tool-call budget on extra
              // searches and page fetches. The 1.19 add-on patch used the
              // summary and kept every result.
              const text = String(summary || snippet || "")
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 2000);
