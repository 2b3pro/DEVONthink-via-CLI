#!/usr/bin/env osascript -l JavaScript
// Download HTML/XML markup via DEVONthink
// Usage: osascript -l JavaScript downloadMarkup.js '<json>'
// JSON format: {"url":"...","agent":"...","encoding":"UTF-8","method":"GET","user":"...","password":"...","referrer":"...","post":{}}
// Required: url
// Optional: agent, encoding, method, user, password, referrer, post, outputFile
//
// Supports HTML, XML, RSS, RDF, and Atom feeds
//
// Examples:
//   osascript -l JavaScript downloadMarkup.js '{"url":"https://example.com/page.html"}'
//   osascript -l JavaScript downloadMarkup.js '{"url":"https://example.com/feed.xml","encoding":"UTF-8"}'

ObjC.import("Foundation");

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({
    success: false,
    error: 'Usage: downloadMarkup.js \'{"url":"https://example.com/page.html"}\''
  });
} else {
  try {
    const params = JSON.parse(jsonArg);
    const { url, agent, encoding, method, user, password, referrer, post, outputFile } = params;

    if (!url) throw new Error("Missing required field: url");

    const app = Application("DEVONthink");

    // Build options object
    const options = {};

    if (agent && agent.length > 0) {
      options.agent = agent;
    }

    if (encoding && encoding.length > 0) {
      options.encoding = encoding;
    }

    if (method && method.length > 0) {
      options.method = method;
    }

    if (user && user.length > 0) {
      options.user = user;
    }

    if (password && password.length > 0) {
      options.password = password;
    }

    if (referrer && referrer.length > 0) {
      options.referrer = referrer;
    }

    if (post && typeof post === "object") {
      options.post = post;
    }

    // Download the markup
    const markup = app.downloadMarkupFrom(url, options);

    if (!markup) {
      JSON.stringify({
        success: false,
        url: url,
        error: "Download failed or returned no markup"
      }, null, 2);
    } else {
      // If outputFile specified, write to file
      if (outputFile) {
        const nsString = $(markup);
        const path = $(outputFile).stringByExpandingTildeInPath;
        nsString.writeToFileAtomicallyEncodingError(path, true, $.NSUTF8StringEncoding, null);

        JSON.stringify({
          success: true,
          url: url,
          savedTo: ObjC.unwrap(path),
          length: markup.length
        }, null, 2);
      } else {
        JSON.stringify({
          success: true,
          url: url,
          length: markup.length,
          markup: markup
        }, null, 2);
      }
    }

  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
