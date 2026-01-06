#!/usr/bin/env osascript -l JavaScript
// Download JSON via DEVONthink
// Usage: osascript -l JavaScript downloadJson.js '<json>'
// JSON format: {"url":"...","agent":"...","method":"GET","user":"...","password":"...","referrer":"...","post":{}}
// Required: url
// Optional: agent, method, user, password, referrer, post, outputFile
//
// Examples:
//   osascript -l JavaScript downloadJson.js '{"url":"https://api.example.com/data.json"}'
//   osascript -l JavaScript downloadJson.js '{"url":"https://api.example.com/data","method":"POST","post":{"query":"test"}}'

ObjC.import("Foundation");

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({
    success: false,
    error: 'Usage: downloadJson.js \'{"url":"https://api.example.com/data.json"}\''
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

    // Download the JSON
    const data = app.downloadJSONFrom(url, options);

    if (!data) {
      JSON.stringify({
        success: false,
        url: url,
        error: "Download failed or returned no JSON data"
      }, null, 2);
    } else {
      // If outputFile specified, write to file
      if (outputFile) {
        const jsonString = JSON.stringify(data, null, 2);
        const nsString = $(jsonString);
        const path = $(outputFile).stringByExpandingTildeInPath;
        nsString.writeToFileAtomicallyEncodingError(path, true, $.NSUTF8StringEncoding, null);

        JSON.stringify({
          success: true,
          url: url,
          savedTo: ObjC.unwrap(path)
        }, null, 2);
      } else {
        JSON.stringify({
          success: true,
          url: url,
          data: data
        }, null, 2);
      }
    }

  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
