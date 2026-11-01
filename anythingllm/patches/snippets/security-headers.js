  // Home Assistant add-on: enforce a Content-Security-Policy for the SPA.
  // The JWT lives in localStorage, so a successful XSS would otherwise be
  // able to read and exfiltrate it. 'wasm-unsafe-eval' is required by the
  // browser-side piper TTS worker (WebAssembly), and the data:/blob:/ws:
  // sources cover attachments, generated media and the agent WebSocket.
  // It is intentionally NOT 'unsafe-eval': no frontend code uses eval/new
  // Function. frame-ancestors 'none' matches the existing X-Frame-Options.
  app.use((request, response, next) => {
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: wss:; media-src 'self' data: blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
    );
    next();
  });
