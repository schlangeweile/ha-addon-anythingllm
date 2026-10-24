            const provider = getAddonOption("deepseek_search", false)
              ? "deepseek-search"
              : (await SystemSettings.get({ label: "agent_search_provider" }))
                  ?.value ?? "unknown";
