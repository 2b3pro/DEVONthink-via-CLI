/**
 * Get Command
 * Get record properties, preview, or content
 * @version 1.0.0
 * @tested 2026-01-05
 */

import { runJxa, requireDevonthink } from '../jxa-runner.js';
import { print, printError } from '../output.js';

function collectTags(value, previous) {
  return previous.concat([value]);
}

export function registerGetCommand(program) {
  const get = program
    .command('get')
    .description('Get record information');

  // dt get props <uuid>
  get
    .command('props <uuid>')
    .alias('properties')
    .description('Get all properties of a record')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output UUID')
    .action(async (uuid, options) => {
      try {
        await requireDevonthink();
        const result = await runJxa('read', 'getRecordProperties', [uuid]);
        print(result, options);
        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt get preview <uuid>
  get
    .command('preview <uuid>')
    .alias('content')
    .description('Get plain text preview of a record')
    .option('-l, --length <chars>', 'Maximum characters to return', '3000')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output the preview text')
    .action(async (uuid, options) => {
      try {
        await requireDevonthink();
        const maxChars = options.length || '3000';
        const result = await runJxa('read', 'getRecordPreview', [uuid, maxChars]);

        if (options.quiet && result.success) {
          console.log(result.preview || '');
        } else {
          print(result, options);
        }

        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt get selection
  get
    .command('selection')
    .alias('selected')
    .description('Get currently selected records in DEVONthink')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output UUIDs')
    .action(async (options) => {
      try {
        await requireDevonthink();
        const result = await runJxa('read', 'getSelection', []);
        print(result, options);
        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt get concordance <uuid>
  get
    .command('concordance <uuid>')
    .alias('words')
    .description('Get word list (concordance) of a record')
    .option('-s, --sort <method>', 'Sort by: weight (default), frequency, name', 'weight')
    .option('-l, --limit <n>', 'Limit number of words returned', parseInt)
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output words (one per line)')
    .action(async (uuid, options) => {
      try {
        await requireDevonthink();
        const sortBy = options.sort || 'weight';
        const result = await runJxa('read', 'getConcordance', [uuid, sortBy]);

        if (options.limit && result.success && result.words) {
          result.words = result.words.slice(0, options.limit);
          result.wordCount = result.words.length;
        }

        if (options.quiet && result.success) {
          // Output just the words, one per line
          console.log(result.words.join('\n'));
        } else {
          print(result, options);
        }

        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt get metadata <uuid> <field>
  get
    .command('metadata <uuid> <field>')
    .description('Get a specific custom metadata field value')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output the value')
    .action(async (uuid, field, options) => {
      try {
        await requireDevonthink();
        const params = { uuid, field };
        const result = await runJxa('read', 'getCustomMetadata', [JSON.stringify(params)]);

        if (options.quiet && result.success) {
          console.log(result.value ?? '');
        } else {
          print(result, options);
        }

        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt get metadata-list <uuid>
  get
    .command('metadata-list <uuid>')
    .alias('metadata-all')
    .description('List all custom metadata fields for a record')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output field names (one per line)')
    .action(async (uuid, options) => {
      try {
        await requireDevonthink();
        const params = { uuid, all: true };
        const result = await runJxa('read', 'getCustomMetadata', [JSON.stringify(params)]);

        if (options.quiet && result.success) {
          console.log(result.metadata.map(m => m.field).join('\n'));
        } else {
          print(result, options);
        }

        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt get transcribe <uuid>
  get
    .command('transcribe <uuid>')
    .alias('transcript')
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
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output the transcription text')
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

  // dt get related <uuid>
  get
    .command('related <uuid>')
    .alias('links')
    .description('Get related records (backlinks, wikilinks, AI suggestions, or classification)')
    .option('-t, --type <type>', 'Type of relation: incoming, outgoing, similar, all', 'all')
    .option('--by-data', 'Find related by data comparison (text & metadata)')
    .option('--by-tags', 'Find related by tags comparison')
    .option('-d, --database <name>', 'Limit classification scope to database')
    .option('-l, --limit <n>', 'Limit number of results', parseInt, 20)
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output UUIDs')
    .action(async (uuid, options) => {
      try {
        await requireDevonthink();

        // Determine type based on flags
        let type = options.type;
        if (options.byData) type = 'byData';
        if (options.byTags) type = 'byTags';

        const params = {
          uuid,
          type,
          limit: options.limit
        };

        if (options.database) params.database = options.database;

        const result = await runJxa('read', 'getRelated', [JSON.stringify(params)]);

        if (options.quiet && result.success) {
          console.log(result.relations.map(r => r.uuid).join('\n'));
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
