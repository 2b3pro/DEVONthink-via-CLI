#!/usr/bin/env osascript -l JavaScript
// Download URL content via DEVONthink
// Usage: osascript -l JavaScript downloadUrl.js '<json>'
// JSON format: {"url":"...","agent":"...","method":"GET","user":"...","password":"...","referrer":"...","post":{}}
// Required: url
// Optional: agent, method, user, password, referrer, post, outputFile
//
// Examples:
//   osascript -l JavaScript downloadUrl.js '{"url":"https://example.com/image.png"}'
//   osascript -l JavaScript downloadUrl.js '{"url":"https://api.example.com/data","method":"POST","post":{"key":"value"}}'

ObjC.import("Foundation");

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({
    success: false,
    error: 'Usage: downloadUrl.js \'{"url":"https://example.com/file"}\''
  });
} else {
  try {
    const params = JSON.parse(jsonArg);
    const { url, agent, method, user, password, referrer, post, outputFile } = params;

    if (!url) throw new Error("Missing required field: url");

    const app = Application("DEVONthink");

    // Build options object
    const options = {};

    if (agent && agent.length > 0) {
      options.agent = agent;
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

    // Download the URL
    const data = app.downloadURL(url, options);

    if (!data) {
      JSON.stringify({
        success: false,
        url: url,
        error: "Download failed or returned no data"
      }, null, 2);
    } else {
      // If outputFile specified, write to file
      if (outputFile) {
        const nsData = $.NSData.alloc.initWithData(data);
        const path = $(outputFile).stringByExpandingTildeInPath;
        nsData.writeToFileAtomically(path, true);

        JSON.stringify({
          success: true,
          url: url,
          savedTo: ObjC.unwrap(path),
          size: nsData.length
        }, null, 2);
      } else {
        // Try to convert to string if possible
        let content;
        let isText = false;

        try {
          const nsData = $.NSData.alloc.initWithData(data);
          const nsString = $.NSString.alloc.initWithDataEncoding(nsData, $.NSUTF8StringEncoding);
          if (nsString) {
            content = ObjC.unwrap(nsString);
            isText = true;
          }
        } catch (e) {
          // Not text data
        }

        if (isText) {
          JSON.stringify({
            success: true,
            url: url,
            contentType: "text",
            content: content
          }, null, 2);
        } else {
          // Binary data - report size
          const nsData = $.NSData.alloc.initWithData(data);
          JSON.stringify({
            success: true,
            url: url,
            contentType: "binary",
            size: nsData.length,
            note: "Binary data downloaded. Use --output to save to file."
          }, null, 2);
        }
      }
    }

  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
