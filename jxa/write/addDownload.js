#!/usr/bin/env osascript -l JavaScript
// Add a URL to DEVONthink's download manager
// Usage: osascript -l JavaScript addDownload.js '<json>'
// JSON format: {"url":"...","automatic":false,"user":"...","password":"...","referrer":"..."}
// Required: url
// Optional: automatic (default: false), user, password, referrer
//
// Examples:
//   osascript -l JavaScript addDownload.js '{"url":"https://example.com/file.pdf"}'
//   osascript -l JavaScript addDownload.js '{"url":"https://example.com/doc.pdf","automatic":true}'
//   osascript -l JavaScript addDownload.js '{"url":"https://protected.com/file.pdf","user":"admin","password":"secret"}'

ObjC.import("Foundation");

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({
    success: false,
    error: 'Usage: addDownload.js \'{"url":"https://example.com/file.pdf"}\''
  });
} else {
  try {
    const params = JSON.parse(jsonArg);
    const { url, automatic, user, password, referrer } = params;

    if (!url) throw new Error("Missing required field: url");

    // Validate URL format
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      throw new Error("Invalid URL: must start with http:// or https://");
    }

    const app = Application("DEVONthink");

    // Build options object
    const options = {};

    if (automatic !== undefined) {
      options.automatic = automatic === true;
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

    // Call add download
    const success = app.addDownload(url, options);

    JSON.stringify({
      success: success,
      url: url,
      automatic: options.automatic || false,
      hasCredentials: !!(user && password),
      hasReferrer: !!referrer
    }, null, 2);

  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
