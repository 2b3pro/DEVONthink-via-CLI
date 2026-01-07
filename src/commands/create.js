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
import { readStdin, isStdinMarker, isUuid } from '../utils.js';
import { addTasks } from '../queue.js';

export function registerCreateCommand(program) {
  const create = program
    .command('create')
    .description('Create new records in DEVONthink');

  // dt create record - Create a new record with properties
  create
    .command('record')
    .alias('new')
    .alias('note')
    .description('Create a new record with properties')
    .requiredOption('-n, --name <title>', 'Record name/title')
    .option('-T, --type <type>', 'Record type: markdown, txt, rtf, bookmark, html, group', 'markdown')
    .option('-d, --database <nameOrUuid>', 'Target database (name or UUID, required unless -g is a UUID)')
    .option('-g, --group <pathOrUuid>', 'Destination group (path or UUID)', '/')
    .option('-c, --content <text>', 'Content for text-based records (use - for stdin)')
    .option('-f, --file <path>', 'Read content from file')
    .option('-u, --url <url>', 'URL for bookmark records')
    .option('--query <query>', 'Search query (smart group)')
    .option('--search-group <pathOrUuid>', 'Search scope group (smart group)')
    .option('-t, --tag <tag>', 'Add tag (can be used multiple times)', collectTags, [])
    .option('--queue', 'Add task to the execution queue instead of running immediately')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output UUID of created record')
    .addHelpText('after', `
Examples:
  dt create record -n "Note" -T markdown -d "Inbox" -c "# Title"
  echo "# Note" | dt create record -n "My Note" -d "Inbox" -c -
  dt create record -n "Bookmark" -T bookmark -d "Inbox" -u "https://example.com"
  dt create record -n "SG Tag Test" -T "smart group" -d "Test_Database" --query "tags:*"
`)
    .action(async (options) => {
      try {
        const groupRef = options.group || '/';
        if (!options.database && !isUuid(groupRef)) {
          throw new Error('Database (-d) is required unless group (-g) is a UUID');
        }

        const params = {
          name: options.name,
          type: options.type,
          database: options.database,
          groupPath: groupRef
        };

        if (options.type === 'smart group' && !options.query) {
          throw new Error('Query is required for smart group type');
        }

        if (options.file) {
          try {
            params.content = readFileSync(options.file, 'utf-8');
          } catch (err) {
            throw new Error(`Cannot read file: ${options.file} - ${err.message}`);
          }
        } else if (options.content) {
          if (isStdinMarker(options.content)) {
            params.content = await readStdin();
            if (!params.content) {
              throw new Error('No content received from stdin');
            }
          } else {
            params.content = options.content;
          }
        }

        if (options.url) {
          params.url = options.url;
        }

        if (options.query) {
          params.query = options.query;
        }
        if (options.searchGroup) {
          params.searchGroup = options.searchGroup;
        }

        if (options.tag && options.tag.length > 0) {
          params.tags = options.tag;
        }

        if (options.queue) {
          const result = await addTasks([{ action: 'create', params }]);
          print(result, options);
          return;
        }

        await requireDevonthink();

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
    .option('--queue', 'Add task to the execution queue instead of running immediately')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output UUID of created record')
    .addHelpText('after', `
Examples:
  dt create markdown "https://example.com" -d "Research"
  dt create md "https://example.com" -r -t "clipped"
`)
    .action(async (url, options) => {
      try {
        const params = { url };

        if (options.name) params.name = options.name;
        if (options.database) params.database = options.database;
        if (options.group) params.groupPath = options.group;
        if (options.readability) params.readability = true;
        if (options.agent) params.agent = options.agent;
        if (options.referrer) params.referrer = options.referrer;
        if (options.tag && options.tag.length > 0) params.tags = options.tag;

        if (options.queue) {
          const result = await addTasks([{ action: 'create', params: { ...params, type: 'markdown' } }]);
          print(result, options);
          return;
        }

        await requireDevonthink();

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
    .option('--queue', 'Add task to the execution queue instead of running immediately')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output UUID of created record')
    .addHelpText('after', `
Examples:
  dt create pdf "https://example.com" -d "Research"
  dt create pdf "https://example.com" -p -w 1024
`)
    .action(async (url, options) => {
      try {
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

        if (options.queue) {
          const result = await addTasks([{ action: 'create', params: { ...params, type: 'pdf' } }]);
          print(result, options);
          return;
        }

        await requireDevonthink();

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
    .option('--queue', 'Add task to the execution queue instead of running immediately')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output UUID of created record')
    .addHelpText('after', `
Examples:
  dt create web "https://example.com" -d "Research"
  dt create clip "https://example.com" -r -t "web"
`)
    .action(async (url, options) => {
      try {
        const params = { url };

        if (options.name) params.name = options.name;
        if (options.database) params.database = options.database;
        if (options.group) params.groupPath = options.group;
        if (options.readability) params.readability = true;
        if (options.agent) params.agent = options.agent;
        if (options.referrer) params.referrer = options.referrer;
        if (options.tag && options.tag.length > 0) params.tags = options.tag;

        if (options.queue) {
          const result = await addTasks([{ action: 'create', params: { ...params, type: 'webarchive' } }]);
          print(result, options);
          return;
        }

        await requireDevonthink();

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
    .option('--queue', 'Add task to the execution queue instead of running immediately')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output UUID of created record')
    .addHelpText('after', `
Examples:
  dt create bookmark "https://example.com" -n "Example" -d "Inbox"
  dt create bm "/Users/me/file.pdf" -n "File Link" -d "Inbox"
`)
    .action(async (url, options) => {
      try {
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

        if (options.queue) {
          const result = await addTasks([{ action: 'create', params }]);
          print(result, options);
          return;
        }

        await requireDevonthink();

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
    .option('-g, --group <pathOrUuid>', 'Destination group (pathOrUuid)', '/')
    .option('-e, --engine <engine>', 'AI engine: dalle3, gpt-image-1, flux-schnell, flux-pro, flux-pro-ultra, stable-diffusion, recraft3, imagen')
    .option('-s, --size <size>', 'Image size (e.g., 1024x1024, 1344x768)')
    .option('--style <style>', 'Image style (engine-specific: natural, vivid, creative, raw, realistic_image, digital_illustration)')
    .option('--quality <quality>', 'Image quality: standard, hd')
    .option('--seed <number>', 'Seed for reproducible generation (Flux/Stable Diffusion)', parseInt)
    .option('-i, --image <path>', 'Reference image for img2img (file path or URL)')
    .option('--prompt-strength <value>', 'Prompt vs image balance: 0.0 (image only) to 1.0 (prompt only)', parseFloat)
    .option('-t, --tag <tag>', 'Add tag (can be used multiple times)', collectTags, [])
    .option('--queue', 'Add task to the execution queue instead of running immediately')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output UUID of created record')
    .addHelpText('after', `
Examples:
  dt create image "surreal landscape" -n "Concept Art" -d "Inbox"
  dt create ai-image "city skyline" -n "Skyline" -d "Inbox" -s 1024x1024
`)
    .action(async (prompt, options) => {
      try {
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

        if (options.queue) {
          const result = await addTasks([{ action: 'create', params: { ...params, type: 'image' } }]);
          print(result, options);
          return;
        }

        await requireDevonthink();

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
