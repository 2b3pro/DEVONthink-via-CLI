#!/usr/bin/env osascript -l JavaScript
// Generate AI image and create a record in DEVONthink
// Usage: osascript -l JavaScript createAiImage.js '<json>'
// JSON format: {"prompt":"...","name":"...","database":"...","groupPath":"/",...}
// Required: prompt, name, database (database optional if groupPath is a UUID)
// Optional: groupPath, engine, size, style, quality, seed, imageUrl, imagePath, promptStrength
//
// Engines: DallE3, GPTImage1, FluxSchnell, FluxPro, FluxProUltra, StableDiffusion, Recraft3, Imagen
//
// Sizes by engine:
//   DALL-E 3:         1024x1024, 1792x1024, 1024x1792
//   GPT-Image-1:      1024x1024, 1536x1024, 1024x1536
//   Flux Schnell/Pro: 1024x1024, 1344x768, 768x1344
//   Flux Pro Ultra:   2048x2048, 2752x1536, 1536x2752
//   Stable Diffusion: 1024x1024, 1344x768, 768x1344
//   Recraft 3:        1024x1024, 1820x1024, 1024x1820
//   Imagen:           1024x1024, 1408x768, 768x1408
//
// Styles by engine:
//   DALL-E 3:       natural, vivid
//   Flux Pro:       creative, raw
//   Flux Pro Ultra: processed, raw
//   Recraft 3:      any, realistic_image, digital_illustration
//
// Examples:
//   osascript -l JavaScript createAiImage.js '{"prompt":"A sunset over mountains","name":"Sunset","database":"Images"}'
//   osascript -l JavaScript createAiImage.js '{"prompt":"A cat","name":"Cat","database":"Images","engine":"flux-pro","size":"1344x768"}'

ObjC.import("Foundation");

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({
    success: false,
    error: 'Usage: createAiImage.js \'{"prompt":"...","name":"...","database":"..."}\''
  });
} else {
  try {
    const params = JSON.parse(jsonArg);
    const { prompt, name, database, groupPath, engine, size, style, quality, seed, imageUrl, imagePath, promptStrength, tags } = params;

    if (!prompt) throw new Error("Missing required field: prompt");
    if (!name) throw new Error("Missing required field: name");

    const app = Application("DEVONthink");

    // Map CLI engine names to DEVONthink engine constants
    const engineMap = {
      "dalle3": "DallE3",
      "dall-e-3": "DallE3",
      "gpt-image-1": "GPTImage1",
      "gptimage1": "GPTImage1",
      "flux-schnell": "FluxSchnell",
      "fluxschnell": "FluxSchnell",
      "flux-pro": "FluxPro",
      "fluxpro": "FluxPro",
      "flux-pro-ultra": "FluxProUltra",
      "fluxproultra": "FluxProUltra",
      "stable-diffusion": "StableDiffusion",
      "stablediffusion": "StableDiffusion",
      "recraft3": "Recraft3",
      "recraft-3": "Recraft3",
      "imagen": "Imagen"
    };

    // Build download image options
    const imageOptions = {};

    if (engine) {
      const mappedEngine = engineMap[engine.toLowerCase()];
      if (!mappedEngine) {
        throw new Error("Invalid engine: " + engine + ". Valid: dalle3, gpt-image-1, flux-schnell, flux-pro, flux-pro-ultra, stable-diffusion, recraft3, imagen");
      }
      imageOptions.engine = mappedEngine;
    }

    if (size && size.length > 0) {
      imageOptions.size = size;
    }

    if (style && style.length > 0) {
      imageOptions.style = style;
    }

    if (quality && quality.length > 0) {
      imageOptions.quality = quality;
    }

    if (seed !== undefined && seed !== null) {
      imageOptions.seed = seed;
    }

    if (promptStrength !== undefined && promptStrength !== null) {
      imageOptions.promptStrength = promptStrength;
    }

    // Handle reference image
    if (imageUrl && imageUrl.length > 0) {
      imageOptions.image = imageUrl;
    } else if (imagePath && imagePath.length > 0) {
      // Read image file as data
      const fm = $.NSFileManager.defaultManager;
      const path = $(imagePath);
      if (!fm.fileExistsAtPath(path)) {
        throw new Error("Image file not found: " + imagePath);
      }
      const imageData = $.NSData.dataWithContentsOfFile(path);
      if (!imageData) {
        throw new Error("Failed to read image file: " + imagePath);
      }
      imageOptions.image = imageData;
    }

    // Download/generate the image
    const imageData = app.downloadImageForPrompt(prompt, imageOptions);

    if (!imageData) {
      throw new Error("Image generation failed or returned no data");
    }

    // Find database and destination group
    let db;
    let destination;

    if (groupPath && isUuid(groupPath)) {
      // Group UUID provided - get database from the group itself
      destination = app.getRecordWithUuid(extractUuid(groupPath));
      if (!destination) throw new Error("Group not found with UUID: " + groupPath);
      const groupType = destination.recordType();
      if (groupType !== "group" && groupType !== "smart group") {
        throw new Error("UUID does not point to a group: " + groupType);
      }
      db = destination.database();
    } else {
      // Need database for path resolution
      if (!database) throw new Error("Missing required field: database (required when groupPath is not a UUID)");
      db = getDatabase(app, database);
      if (!db) throw new Error("Database not found: " + database);
      destination = resolveGroup(app, db, groupPath || "/", true);
    }

    // Create the record with the image
    const record = app.createRecordWith({
      name: name,
      type: "picture",
      data: imageData
    }, { in: destination });

    if (!record) {
      throw new Error("Failed to create image record");
    }

    // Apply tags if specified
    if (tags && Array.isArray(tags) && tags.length > 0) {
      record.tags = tags;
    }

    JSON.stringify({
      success: true,
      uuid: record.uuid(),
      name: record.name(),
      location: record.location(),
      database: db.name(),
      recordType: record.recordType(),
      path: record.path(),
      engine: engine || "default",
      size: size || "default"
    }, null, 2);

  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
