/**
 * Export Command
 * Export records from DEVONthink
 */

import { runJxa, requireDevonthink } from '../jxa-runner.js';
import { print, printError } from '../output.js';

export function registerExportCommand(program) {
  const exportCmd = program
    .command('export <uuid>')
    .description('Export a record (and its children) to a directory')
    .requiredOption('-o, --to <path>', 'Destination directory (POSIX path)')
    .option('--no-metadata', 'Skip DEVONtech_Storage metadata files')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output the exported path')
    .addHelpText('after', `
Examples:
  dt export ABCD-1234 -o "/tmp/export"
  dt export ABCD-1234 -o "/tmp/export" --no-metadata
`)
    .action(async (uuid, options) => {
      try {
        await requireDevonthink();

        const params = {
          uuid,
          destination: options.to,
          includeMetadata: options.metadata !== false
        };

        const result = await runJxa('write', 'exportRecord', [JSON.stringify(params)]);

        if (options.quiet && result.success) {
          console.log(result.exportedPath || '');
        } else {
          print(result, options);
        }

        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt deconsolidate <uuid> - Move record to external folder
  program
    .command('deconsolidate <uuid>')
    .alias('externalize')
    .description('Move an internal record to an external folder in the filesystem')
    .option('-o, --to <path>', 'Destination folder (POSIX path, optional for documents)')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Minimal output')
    .addHelpText('after', `
Examples:
  dt deconsolidate ABCD-1234 -o "/tmp/external"
  dt externalize ABCD-1234
`)
    .action(async (uuid, options) => {
      try {
        await requireDevonthink();

        const params = { uuid };
        if (options.to) params.destination = options.to;

        const result = await runJxa('write', 'deconsolidateRecord', [JSON.stringify(params)]);
        print(result, options);

        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });
}
