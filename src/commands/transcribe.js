/**
 * Transcribe Command
 * Transcribe speech/text from DEVONthink records
 * @version 1.0.0
 * @tested 2026-01-05
 */

import { runJxa, requireDevonthink } from '../jxa-runner.js';
import { print, printError } from '../output.js';

function collectTags(value, previous) {
  return previous.concat([value]);
}

export function registerTranscribeCommand(program) {
  program
    .command('transcribe <uuid>')
    .alias('tr')
    .description('Transcribe speech/text from audio, video, PDF, or image')
    .option('-l, --language <code>', 'ISO language code (e.g., en, de)')
    .option('--timestamps', 'Include timestamps in transcription')
    .option('--no-timestamps', 'Exclude timestamps from transcription')
    .option('-a, --ai-cleanup', 'Use AI to clean up transcription (fix grammar, formatting)')
    .option('--ai-prompt <prompt>', 'Custom AI prompt for cleanup (implies --ai-cleanup)')
    .option('--no-raw', 'Exclude raw transcription from output when using AI cleanup')
    .option('-s, --save', 'Save transcription as a markdown document')
    .option('-d, --database <name>', 'Target database for saved document (default: source record\'s database)')
    .option('-g, --group <path>', 'Destination group path or UUID (default: source record\'s location)')
    .option('-n, --name <name>', 'Document name (default: "Original Name - Transcription")')
    .option('-t, --tag <tag>', 'Add tag to saved document (repeatable)', collectTags, [])
    .option('-u, --update-record', 'Save transcription to the original record\'s plain text (makes it searchable)')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output the transcription text')
    .addHelpText('after', `
Examples:
  dt transcribe ABCD-1234 --language en
  dt tr ABCD-1234 --ai-cleanup --save -d "Inbox"
`)
    .action(async (uuid, options) => {
      try {
        await requireDevonthink();

        const params = { uuid };
        if (options.language) params.language = options.language;
        if (options.timestamps !== undefined) params.timestamps = options.timestamps;

        // AI cleanup options
        if (options.aiCleanup || options.aiPrompt) {
          params.aiCleanup = true;
          if (options.aiPrompt) params.aiPrompt = options.aiPrompt;
          if (options.raw === false) params.includeRaw = false;
        }

        // Save options
        if (options.save) {
          params.save = true;
          if (options.database) params.database = options.database;
          if (options.group) params.groupPath = options.group;
          if (options.name) params.docName = options.name;
          if (options.tag && options.tag.length > 0) params.tags = options.tag;
        }

        // Update original record option
        if (options.updateRecord) {
          params.updateRecord = true;
        }

        const result = await runJxa('read', 'transcribe', [JSON.stringify(params)]);

        if (options.quiet && result.success) {
          console.log(result.transcription || '');
        } else {
          print(result, options);
        }

        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });
}
