    });
    // A 404/410 or any other error status still has a body: the site's error
    // page. Returning it as page content makes the model believe the URL
    // exists, so fail here and let the caller report "no content" instead.
    if (!response.ok)
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    const pageText = await response.text();
    if (captureAs === "html") return pageText;
