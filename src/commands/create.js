/**
 * Create Command
 * Create new records in DEVONthink
 * @version 1.1.0
 * @tested 2026-01-05
 */

import { runJxa, requireDevonthink } from '../jxa-runner.js';
import { print, printError } from '../output.js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export function registerCreateCommand(program) {
  const create = program
    .command('create')
    .description('Create new records in DEVONthink');

  // dt create record - Create a new record with properties
  create
    .command('record')
    .alias('new')
    .description('Create a new record with properties')
    .requiredOption('-n, --name <title>', 'Record name/title')
    .requiredOption('-T, --type <type>', 'Record type: markdown, txt, rtf, bookmark, html, group')
    .requiredOption('-d, --database <nameOrUuid>', 'Target database (name or UUID)')
    .option('-g, --group <pathOrUuid>', 'Destination group (path or UUID)', '/')
    .option('-c, --content <text>', 'Content for text-based records')
    .option('-f, --file <path>', 'Read content from file')
    .option('-u, --url <url>', 'URL for bookmark records')
    .option('-t, --tag <tag>', 'Add tag (can be used multiple times)', collectTags, [])
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output UUID of created record')
    .action(async (options) => {
      try {
        await requireDevonthink();

        const params = {
          name: options.name,
          type: options.type,
          database: options.database,
          groupPath: options.group || '/'
        };

        if (options.file) {
          try {
            params.content = readFileSync(options.file, 'utf-8');
          } catch (err) {
            throw new Error(`Cannot read file: ${options.file} - ${err.message}`);
          }
        } else if (options.content) {
          params.content = options.content;
        }

        if (options.url) {
          params.url = options.url;
        }

        if (options.tag && options.tag.length > 0) {
          params.tags = options.tag;
        }

        const result = await runJxa('write', 'createRecord', [JSON.stringify(params)]);
        print(result, options);

        if (!result.success) {
          process.exit(1);
        }
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt create markdown <url> - Create Markdown from web URL
  create
    .command('markdown <url>')
    .alias('md')
    .description('Create a Markdown document from a web URL')
    .option('-n, --name <title>', 'Record name (defaults to page title)')
    .option('-d, --database <nameOrUuid>', 'Target database (name or UUID)')
    .option('-g, --group <pathOrUuid>', 'Destination group (path or UUID)', '/')
    .option('-r, --readability', 'Declutter page layout (reader mode)')
    .option('--agent <userAgent>', 'Custom user agent string')
    .option('--referrer <url>', 'HTTP referrer URL')
    .option('-t, --tag <tag>', 'Add tag (can be used multiple times)', collectTags, [])
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output UUID of created record')
    .action(async (url, options) => {
      try {
        await requireDevonthink();

        const params = { url };

        if (options.name) params.name = options.name;
        if (options.database) params.database = options.database;
        if (options.group) params.groupPath = options.group;
        if (options.readability) params.readability = true;
        if (options.agent) params.agent = options.agent;
        if (options.referrer) params.referrer = options.referrer;
        if (options.tag && options.tag.length > 0) params.tags = options.tag;

        const result = await runJxa('write', 'createMarkdownFrom', [JSON.stringify(params)]);
        print(result, options);

        if (!result.success) {
          process.exit(1);
        }
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt create pdf <url> - Create PDF from web URL
  create
    .command('pdf <url>')
    .description('Create a PDF document from a web URL')
    .option('-n, --name <title>', 'Record name (defaults to page title)')
    .option('-d, --database <nameOrUuid>', 'Target database (name or UUID)')
    .option('-g, --group <pathOrUuid>', 'Destination group (path or UUID)', '/')
    .option('-p, --paginate', 'Create paginated PDF')
    .option('-r, --readability', 'Declutter page layout (reader mode)')
    .option('-w, --width <points>', 'PDF width in points', parseInt)
    .option('--agent <userAgent>', 'Custom user agent string')
    .option('--referrer <url>', 'HTTP referrer URL')
    .option('-t, --tag <tag>', 'Add tag (can be used multiple times)', collectTags, [])
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output UUID of created record')
    .action(async (url, options) => {
      try {
        await requireDevonthink();

        const params = { url };

        if (options.name) params.name = options.name;
        if (options.database) params.database = options.database;
        if (options.group) params.groupPath = options.group;
        if (options.paginate) params.pagination = true;
        if (options.readability) params.readability = true;
        if (options.width) params.width = options.width;
        if (options.agent) params.agent = options.agent;
        if (options.referrer) params.referrer = options.referrer;
        if (options.tag && options.tag.length > 0) params.tags = options.tag;

        const result = await runJxa('write', 'createPdfFrom', [JSON.stringify(params)]);
        print(result, options);

        if (!result.success) {
          process.exit(1);
        }
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt create web <url> - Create web document (picture, PDF, or web archive) from URL
  create
    .command('web <url>')
    .alias('clip')
    .description('Create a web document (picture, PDF, or web archive) from a URL')
    .option('-n, --name <title>', 'Record name (defaults to page title)')
    .option('-d, --database <nameOrUuid>', 'Target database (name or UUID)')
    .option('-g, --group <pathOrUuid>', 'Destination group (path or UUID)', '/')
    .option('-r, --readability', 'Declutter page layout (reader mode)')
    .option('--agent <userAgent>', 'Custom user agent string')
    .option('--referrer <url>', 'HTTP referrer URL')
    .option('-t, --tag <tag>', 'Add tag (can be used multiple times)', collectTags, [])
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output UUID of created record')
    .action(async (url, options) => {
      try {
        await requireDevonthink();

        const params = { url };

        if (options.name) params.name = options.name;
        if (options.database) params.database = options.database;
        if (options.group) params.groupPath = options.group;
        if (options.readability) params.readability = true;
        if (options.agent) params.agent = options.agent;
        if (options.referrer) params.referrer = options.referrer;
        if (options.tag && options.tag.length > 0) params.tags = options.tag;

        const result = await runJxa('write', 'createWebDocFrom', [JSON.stringify(params)]);
        print(result, options);

        if (!result.success) {
          process.exit(1);
        }
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt create bookmark <url> - Create a bookmark to an internet or filesystem location
  create
    .command('bookmark <url>')
    .alias('bm')
    .description('Create a bookmark to an internet URL or filesystem path')
    .requiredOption('-n, --name <title>', 'Bookmark name/title')
    .requiredOption('-d, --database <nameOrUuid>', 'Target database (name or UUID)')
    .option('-g, --group <pathOrUuid>', 'Destination group (path or UUID)', '/')
    .option('-t, --tag <tag>', 'Add tag (can be used multiple times)', collectTags, [])
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output UUID of created record')
    .action(async (url, options) => {
      try {
        await requireDevonthink();

        const params = {
          name: options.name,
          type: 'bookmark',
          database: options.database,
          groupPath: options.group || '/',
          url: url
        };

        if (options.tag && options.tag.length > 0) {
          params.tags = options.tag;
        }

        const result = await runJxa('write', 'createRecord', [JSON.stringify(params)]);
        print(result, options);

        if (!result.success) {
          process.exit(1);
        }
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt create image <prompt> - Generate AI image from prompt
  create
    .command('image <prompt>')
    .alias('ai-image')
    .description('Generate an AI image from a text prompt')
    .requiredOption('-n, --name <title>', 'Record name for the image')
    .requiredOption('-d, --database <nameOrUuid>', 'Target database (name or UUID)')
    .option('-g, --group <pathOrUuid>', 'Destination group (path or UUID)', '/')
    .option('-e, --engine <engine>', 'AI engine: dalle3, gpt-image-1, flux-schnell, flux-pro, flux-pro-ultra, stable-diffusion, recraft3, imagen')
    .option('-s, --size <size>', 'Image size (e.g., 1024x1024, 1344x768)')
    .option('--style <style>', 'Image style (engine-specific: natural, vivid, creative, raw, realistic_image, digital_illustration)')
    .option('--quality <quality>', 'Image quality: standard, hd')
    .option('--seed <number>', 'Seed for reproducible generation (Flux/Stable Diffusion)', parseInt)
    .option('-i, --image <path>', 'Reference image for img2img (file path or URL)')
    .option('--prompt-strength <value>', 'Prompt vs image balance: 0.0 (image only) to 1.0 (prompt only)', parseFloat)
    .option('-t, --tag <tag>', 'Add tag (can be used multiple times)', collectTags, [])
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output UUID of created record')
    .action(async (prompt, options) => {
      try {
        await requireDevonthink();

        const params = {
          prompt,
          name: options.name,
          database: options.database,
          groupPath: options.group || '/'
        };

        if (options.engine) params.engine = options.engine;
        if (options.size) params.size = options.size;
        if (options.style) params.style = options.style;
        if (options.quality) params.quality = options.quality;
        if (options.seed !== undefined) params.seed = options.seed;
        if (options.promptStrength !== undefined) params.promptStrength = options.promptStrength;
        if (options.tag && options.tag.length > 0) params.tags = options.tag;

        // Handle reference image (file path or URL)
        if (options.image) {
          if (options.image.startsWith('http://') || options.image.startsWith('https://')) {
            params.imageUrl = options.image;
          } else {
            const imagePath = resolve(options.image);
            if (!existsSync(imagePath)) {
              throw new Error(`Reference image not found: ${imagePath}`);
            }
            params.imagePath = imagePath;
          }
        }

        const result = await runJxa('write', 'createAiImage', [JSON.stringify(params)]);
        print(result, options);

        if (!result.success) {
          process.exit(1);
        }
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });
}

function collectTags(value, previous) {
  return previous.concat([value]);
}
