/**
 * Convert Command
 * Convert DEVONthink records to different formats
 * @version 1.0.0
 * @tested 2026-01-05
 */

import { runJxa, requireDevonthink } from '../jxa-runner.js';
import { print, printError } from '../output.js';

const VALID_FORMATS = [
  'simple', 'plain', 'text',
  'rich', 'rtf',
  'note', 'formatted',
  'html',
  'markdown', 'md',
  'pdf', 'pdf-annotated', 'pdf-no-annotations', 'pdf-single',
  'webarchive',
  'bookmark'
];

export function registerConvertCommand(program) {
  program
    .command('convert <uuid>')
    .description('Convert a record to another format')
    .option('-t, --to <format>', `Target format: ${VALID_FORMATS.join(', ')}`, 'simple')
    .option('-g, --group <pathOrUuid>', 'Destination group (path or UUID)')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output converted record UUID')
    .action(async (uuid, options) => {
      try {
        await requireDevonthink();

        const params = {
          uuid: uuid,
          to: options.to || 'simple'
        };

        if (options.group) {
          params.destGroupUuid = options.group;
        }

        const result = await runJxa('write', 'convertRecord', [JSON.stringify(params)]);
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
