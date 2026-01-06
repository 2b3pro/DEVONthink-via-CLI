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
    .option('--meta <key=value>', 'Set custom metadata (can be used multiple times)', collectKeyValue, {})
    .option('--queue', 'Add task to the execution queue instead of running immediately')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output UUID')
    .addHelpText('after', `
Modifiable properties are marked with their corresponding option flag.

  Identity:
    name (-n, --name), filename, path, location

  Content & Type:
    url, reference URL

  Organization & Metadata:
    tags (--add-tag, --remove-tag, --set-tags)
    aliases
    label
    rating
    comment (-c, --comment)
    custom metadata (--meta)

  Status & Flags:
    flag, unread, state, locked
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
