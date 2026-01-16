/**
 * Modify Command
 * Modify record properties (rename, tags, move, comment, metadata)
 * Supports multiple UUIDs and stdin input
 * @version 1.1.0
 * @tested 2026-01-11
 */

import { runJxa, requireDevonthink } from '../jxa-runner.js';
import { print, printError } from '../output.js';
import { readUuidsFromStdin, isStdinMarker } from '../utils.js';
import { addTasks } from '../queue.js';

export function registerModifyCommand(program) {
  program
    .command('modify <uuid...>')
    .alias('mod')
    .description('Set properties of record(s). Use - to read UUIDs from stdin. Counterpart to "get props". To modify content, use `update`.')
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
JSON Output (single record):
  {
    "success": true,
    "uuid": "string",
    "operations": { "renamed": bool, "tagsModified": bool, ... },
    "newName": "string",
    "newTags": ["string"],
    ...
  }

JSON Output (multiple records):
  {
    "success": true,
    "modified": [ { uuid, operations, ... }, ... ],
    "count": number,
    "errors": [ { "uuid": "string", "error": "string" } ]
  }

Examples:
  dt modify ABCD-1234 --name "New Title"
  dt modify ABCD-1234 --add-tag urgent --comment "Review next week"
  dt modify UUID1 UUID2 UUID3 --flag --add-tag "processed"
  printf "UUID1\\nUUID2\\n" | dt modify - --add-tag "batch-tagged"
`)
    .action(async (uuids, options) => {
      try {
        // Read UUIDs from stdin if first arg is "-"
        let recordUuids = uuids;
        if (uuids.length === 1 && isStdinMarker(uuids[0])) {
          recordUuids = await readUuidsFromStdin();
          if (recordUuids.length === 0) {
            throw new Error('No UUIDs received from stdin');
          }
        }

        // Build base params (without uuid - will be added per record)
        const baseParams = {};

        if (options.name) {
          baseParams.newName = options.name;
        }

        if (options.addTag && options.addTag.length > 0) {
          baseParams.tagsAdd = options.addTag;
        }

        if (options.removeTag && options.removeTag.length > 0) {
          baseParams.tagsRemove = options.removeTag;
        }

        if (options.setTags && options.setTags.length > 0) {
          baseParams.tagsReplace = options.setTags;
        }

        if (options.moveTo) {
          baseParams.destGroupUuid = options.moveTo;
        }

        if (options.comment !== undefined) {
          baseParams.comment = options.comment;
        }

        if (options.meta && Object.keys(options.meta).length > 0) {
          baseParams.customMetadata = options.meta;
        }

        if (options.label !== undefined) {
          baseParams.label = options.label;
        }

        if (options.rating !== undefined) {
          baseParams.rating = options.rating;
        }

        // --flag and --no-flag are handled by Commander as options.flag (true/false/undefined)
        if (options.flag !== undefined) {
          baseParams.flag = options.flag;
        }

        if (options.aliases !== undefined) {
          baseParams.aliases = options.aliases;
        }

        if (options.url !== undefined) {
          baseParams.url = options.url;
        }

        // --unread and --no-unread are handled by Commander as options.unread (true/false/undefined)
        if (options.unread !== undefined) {
          baseParams.unread = options.unread;
        }

        // Check if any modifications were specified
        const hasModifications = Object.keys(baseParams).length > 0;
        if (!hasModifications) {
          throw new Error('No modifications specified. Use --help to see available options.');
        }

        if (options.queue) {
          const tasks = recordUuids.map(uuid => ({
            action: 'modify',
            params: { uuid, ...baseParams }
          }));
          const result = await addTasks(tasks);
          print(result, options);
          return;
        }

        await requireDevonthink();

        // Process records
        const results = [];
        const errors = [];

        for (const uuid of recordUuids) {
          const params = { uuid, ...baseParams };
          const result = await runJxa('write', 'modifyRecordProperties', [JSON.stringify(params)]);

          if (result.success) {
            results.push(result);
          } else {
            errors.push({ uuid, error: result.error });
          }
        }

        // Format output based on single vs multiple records
        if (recordUuids.length === 1) {
          // Single record - return result directly (backwards compatible)
          print(results[0] || { success: false, error: errors[0]?.error }, options);
          if (errors.length > 0) process.exit(1);
        } else {
          // Multiple records - return aggregate result
          const output = {
            success: errors.length === 0,
            modified: results,
            count: results.length,
            ...(errors.length > 0 && { errors })
          };
          print(output, options);
          if (errors.length > 0) process.exit(1);
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
