      // Fall back to the login-page app name when no page title is set, so
      // both branding settings reach the installed PWA.
      const customAppName = await SystemSettings.getValueOrFallback(
        { label: "custom_app_name" },
        null
      );
      const appName = manifestName || customAppName || "AnythingLLM";

      // Keep the UI fork's PWA icon set. Upstream only emits a single
      // "any" favicon entry here; the fork ships 192/512/maskable PNGs,
      // which Chrome needs for installability.
      const manifest = {
        name: appName,
        short_name: appName,
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        background_color: "#ffffff",
        theme_color: "#ffffff",
        icons: [
          { src: iconUrl, sizes: "any" },
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      };

      // Chrome caches manifests aggressively; do not let a renamed instance
      // keep serving the old name from the browser cache.
      response.set("Cache-Control", "no-store");
      response.type("application/json").status(200).send(manifest).end();
