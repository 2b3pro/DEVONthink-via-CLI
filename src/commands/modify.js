/**
 * Modify Command
 * Modify record properties (rename, tags, move, comment, metadata)
 * @version 1.0.0
 * @tested 2026-01-05
 */

import { runJxa, requireDevonthink } from '../jxa-runner.js';
import { print, printError } from '../output.js';
import { addTasks } from '../queue.js';

export function registerModifyCommand(program) {
  program
    .command('modify <uuid>')
    .alias('mod')
    .description('Set properties (metadata and attributes) of a record. The counterpart to "get props".')
    .option('-n, --name <newName>', 'Rename the record')
    .option('--add-tag <tag>', 'Add tag (can be used multiple times)', collectValues, [])
    .option('--remove-tag <tag>', 'Remove tag (can be used multiple times)', collectValues, [])
    .option('--set-tags <tags...>', 'Replace all tags with these')
    .option('-m, --move-to <pathOrUuid>', 'Move to destination group (path or UUID)')
    .option('-c, --comment <text>', 'Set comment')
    .option('--label <number>', 'Set label index (0-7)', parseLabel)
    .option('--rating <number>', 'Set rating (0-5)', parseRating)
    .option('--flag', 'Set flagged status to true')
    .option('--no-flag', 'Set flagged status to false')
    .option('--aliases <text>', 'Set wiki aliases (comma or semicolon separated)')
    .option('--url <url>', 'Set URL')
    .option('--unread', 'Mark as unread')
    .option('--no-unread', 'Mark as read')
    .option('--meta <key=value>', 'Set custom metadata (can be used multiple times)', collectKeyValue, {})
    .option('--queue', 'Add task to the execution queue instead of running immediately')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output UUID')
    .addHelpText('after', `
Modifiable properties and their corresponding option flags:

  Identity:
    name (-n, --name)

  Content & Type:
    url (--url)

  Organization & Metadata:
    tags (--add-tag, --remove-tag, --set-tags)
    aliases (--aliases)
    label (--label 0-7)
    rating (--rating 0-5)
    comment (-c, --comment)
    custom metadata (--meta)

  Status & Flags:
    flag (--flag / --no-flag)
    unread (--unread / --no-unread)
    `)
    .addHelpText('after', `
JSON Output:
  {
    "success": true,
    "uuid": "string",
    "operations": {
      "renamed": boolean,
      "tagsModified": boolean,
      "commentModified": boolean,
      "customMetadataModified": boolean,
      "moved": boolean
    },
    "newName": "string",
    "newTags": ["string"],
    "newComment": "string",
    "newLocation": "string"
  }

Examples:
  dt modify ABCD-1234 --name "New Title"
  dt modify ABCD-1234 --add-tag urgent --comment "Review next week"
`)
    .action(async (uuid, options) => {
      try {
        // Build params
        const params = { uuid };

        if (options.name) {
          params.newName = options.name;
        }

        if (options.addTag && options.addTag.length > 0) {
          params.tagsAdd = options.addTag;
        }

        if (options.removeTag && options.removeTag.length > 0) {
          params.tagsRemove = options.removeTag;
        }

        if (options.setTags && options.setTags.length > 0) {
          params.tagsReplace = options.setTags;
        }

        if (options.moveTo) {
          params.destGroupUuid = options.moveTo;
        }

        if (options.comment !== undefined) {
          params.comment = options.comment;
        }

        if (options.meta && Object.keys(options.meta).length > 0) {
          params.customMetadata = options.meta;
        }

        if (options.label !== undefined) {
          params.label = options.label;
        }

        if (options.rating !== undefined) {
          params.rating = options.rating;
        }

        // --flag and --no-flag are handled by Commander as options.flag (true/false/undefined)
        if (options.flag !== undefined) {
          params.flag = options.flag;
        }

        if (options.aliases !== undefined) {
          params.aliases = options.aliases;
        }

        if (options.url !== undefined) {
          params.url = options.url;
        }

        // --unread and --no-unread are handled by Commander as options.unread (true/false/undefined)
        if (options.unread !== undefined) {
          params.unread = options.unread;
        }

        // Check if any modifications were specified
        const hasModifications = Object.keys(params).length > 1;
        if (!hasModifications) {
          throw new Error('No modifications specified. Use --help to see available options.');
        }

        if (options.queue) {
          const result = await addTasks([{ action: 'modify', params }]);
          print(result, options);
          return;
        }

        await requireDevonthink();

        const result = await runJxa('write', 'modifyRecordProperties', [JSON.stringify(params)]);
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

function collectValues(value, previous) {
  return previous.concat([value]);
}

function collectKeyValue(value, previous) {
  const [key, ...rest] = value.split('=');
  if (key && rest.length > 0) {
    previous[key] = rest.join('=');
  }
  return previous;
}

function parseLabel(value) {
  const num = parseInt(value, 10);
  if (isNaN(num) || num < 0 || num > 7) {
    throw new Error('Label must be an integer between 0 and 7');
  }
  return num;
}

function parseRating(value) {
  const num = parseInt(value, 10);
  if (isNaN(num) || num < 0 || num > 5) {
    throw new Error('Rating must be an integer between 0 and 5');
  }
  return num;
}
