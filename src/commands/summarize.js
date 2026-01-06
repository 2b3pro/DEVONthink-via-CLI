/**
 * Summarize Command
 * AI-powered summarization of records
 * @version 1.0.0
 */

import { runJxa, requireDevonthink } from '../jxa-runner.js';
import { print, printError } from '../output.js';
import { readUuidsFromStdin, isStdinMarker } from '../utils.js';
import { addTasks } from '../queue.js';

export function registerSummarizeCommand(program) {
  program
    .command('summarize <uuid...>')
    .alias('sum')
    .description('Generate a summary of record(s)')
    .option('--prompt <uuid>', 'Use a custom summarization prompt from a record')
    .option('--print', 'Just print the summary, do not save to record (AI mode only)')
    .option('--native', 'Use DEVONthink native summarization (e.g. highlights)')
    .option('--type <type>', 'Native summary type: annotations, content, mentions', 'annotations')
    .option('--format <format>', 'Native output format: markdown, rich, sheet', 'markdown')
    .option('--queue', 'Add task to the execution queue instead of running immediately')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output the summary text or UUID')
    .action(async (uuids, options) => {
      try {
        let recordUuids = uuids;
        if (uuids.length === 1 && isStdinMarker(uuids[0])) {
          recordUuids = await readUuidsFromStdin();
        }

        if (options.queue) {
          const tasks = recordUuids.map(uuid => ({
            action: 'summarize',
            params: {
              uuid,
              prompt: options.prompt,
              native: options.native,
              type: options.type,
              format: options.format,
              save: !options.print
            }
          }));
          const result = await addTasks(tasks);
          print(result, options);
          return;
        }

        await requireDevonthink();

        const results = [];

        // Pre-fetch custom instruction if in AI mode and needed
        let customInstruction = "";
        const promptUuid = options.prompt || process.env.DT_SUMMARIZE_PROMPT;
        
        if (!options.native && promptUuid) {
           const pRec = await runJxa('read', 'getRecordPreview', [promptUuid, '5000']);
           if (pRec.success) customInstruction = pRec.preview;
        }

        for (const uuid of recordUuids) {
          
          // --- NATIVE MODE ---
          if (options.native) {
             const result = await runJxa('write', 'summarizeNative', [JSON.stringify({
                 uuid,
                 type: options.type,
                 format: options.format
             })]);
             
             if (result.success) {
                 results.push({ 
                     uuid, 
                     success: true, 
                     summaryUuid: result.summaryUuid, 
                     summaryName: result.summaryName 
                 });
                 if (options.quiet) {
                     console.log(result.summaryUuid);
                 } else if (!options.json) {
                     console.log(`Created summary: ${result.summaryName} (${result.summaryUuid})`);
                 }
             } else {
                 results.push({ uuid, success: false, error: result.error });
                 if (!options.json && !options.quiet) console.error(`Failed to summarize ${uuid}: ${result.error}`);
             }
             continue; // Skip AI logic
          }

          // --- AI MODE ---
          const preview = await runJxa('read', 'getRecordPreview', [uuid, '10000']);
          if (!preview.success) {
            results.push({ uuid, success: false, error: preview.error });
            continue;
          }

          const prompt = `You are an expert at summarizing information. 
          ${customInstruction ? `Follow these specific instructions: ${customInstruction}` : "Provide a concise 1-2 sentence summary of the following text."}
          
          Text:
          ${preview.preview.substring(0, 8000)}`;

          const chatResult = await runJxa('read', 'chat', [JSON.stringify({ 
            prompt, 
            thinking: false,
            format: 'text' 
          })]);

          if (chatResult.success) {
            const summary = chatResult.response.trim();
            
            if (!options.print) {
              await runJxa('write', 'modifyRecordProperties', [JSON.stringify({
                uuid,
                comment: summary
              })]);
            }

            results.push({ uuid, success: true, summary });
            
            if (options.quiet) {
              console.log(summary);
            } else if (!options.json) {
              console.log(`Summary for ${uuid}:`);
              console.log(summary);
              console.log('---');
            }
          } else {
            results.push({ uuid, success: false, error: chatResult.error });
          }
        }

        if (options.json) {
          print(results, options);
        }

      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });
}