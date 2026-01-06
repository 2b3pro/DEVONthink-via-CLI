/**
 * Organize Command
 * Intelligent enrichment of records (OCR, Tagging, Renaming, Summarizing)
 * @version 1.0.0
 */

import { runJxa, requireDevonthink } from '../jxa-runner.js';
import { print, printError } from '../output.js';
import { readUuidsFromStdin, isStdinMarker } from '../utils.js';

export function registerOrganizeCommand(program) {
  program
    .command('organize <uuid...>')
    .alias('tidy')
    .description('Intelligently organize records (OCR, Rename, Tag, Summarize)')
    .option('--ocr', 'Perform OCR if text is missing')
    .option('--rename', 'Rename based on content')
    .option('--tag', 'Apply AI tags')
    .option('--summarize', 'Add summary to comments')
    .option('--prompt <uuid>', 'Use custom organization SOP/instructions from a record (for naming, tagging, etc.)')
    .option('--auto', 'Enable all enrichment features')
    .option('--no-confirm', 'Skip confirmation for renaming')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Minimal output')
    .action(async (uuids, options) => {
      try {
        await requireDevonthink();

        // Handle stdin
        let recordUuids = uuids;
        if (uuids.length === 1 && isStdinMarker(uuids[0])) {
          recordUuids = await readUuidsFromStdin();
          if (recordUuids.length === 0) throw new Error('No UUIDs from stdin');
        }

        const results = [];
        
        // Use environment variable as default for prompt if not specified
        if (!options.prompt && process.env.DT_ORGANIZE_PROMPT) {
          options.prompt = process.env.DT_ORGANIZE_PROMPT;
        }

        for (const uuid of recordUuids) {
          try {
            const result = await processRecord(uuid, options);
            results.push(result);
          } catch (err) {
            results.push({ uuid, success: false, error: err.message });
          }
        }

        // Print results
        if (options.json) {
          console.log(JSON.stringify(options.pretty ? results : { results }, null, options.pretty ? 2 : 0));
        } else if (options.quiet) {
           // Output UUIDs of successfully processed records
           results.filter(r => r.success).forEach(r => console.log(r.uuid));
        } else {
           // Human readable report
           results.forEach(r => {
             if (r.success) {
               console.log(`✓ ${r.name} (${r.uuid})`);
               if (r.ocrPerformed) console.log(`  - OCR: Performed (New UUID: ${r.uuid})`);
               if (r.renamed) console.log(`  - Renamed: ${r.oldName} -> ${r.name}`);
               if (r.tagged) console.log(`  - Tags: ${r.tags.join(', ')}`);
               if (r.summarized) console.log(`  - Summary: ${r.summary}`);
             } else {
               console.error(`✗ ${uuid}: ${r.error}`);
             }
           });
        }

      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });
}

export async function processRecord(originalUuid, options) {
  let currentUuid = originalUuid;
  let ocrPerformed = false;
  let recordProps = await runJxa('read', 'getRecordProperties', [currentUuid]);

  if (!recordProps.success) throw new Error(recordProps.error);

  // 1. OCR
  // Check if OCR is needed: count is 0, type is PDF or Image
  const needsOcr = (recordProps.wordCount === 0 || recordProps.wordCount === undefined) && 
                   (recordProps.kind === 'PDF' || recordProps.kind === 'Image' || recordProps.recordType === 'PDF document');

  if ((options.ocr || options.auto) && needsOcr) {
     const ocrResult = await runJxa('write', 'ocrRecord', [JSON.stringify({ uuid: currentUuid })]);
     if (ocrResult.success) {
       currentUuid = ocrResult.newUuid;
       ocrPerformed = true;
       // Refresh props for the new record
       recordProps = await runJxa('read', 'getRecordProperties', [currentUuid]);
     } else {
       throw new Error(`OCR Failed: ${ocrResult.error}`);
     }
  }

  // 2. AI Enrichment (Rename, Tag, Summarize)
  if (options.rename || options.tag || options.summarize || options.auto) {
     // Get content
     const preview = await runJxa('read', 'getRecordPreview', [currentUuid, '10000']); // Get up to 10k chars
     const text = preview.preview;

     if (!text || text.length < 50) {
       return { 
         uuid: currentUuid, 
         success: true, 
         ocrPerformed,
         warning: "Not enough text for AI analysis" 
       };
     }

     // Build Prompt
     let instruction = `Analyze the following text and return a purely valid JSON object (no markdown formatting) with these keys:
     ${(options.rename || options.auto) ? '"title": "A short, descriptive, professional title (no file extension)",' : ''}
     ${(options.tag || options.auto) ? '"tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],' : ''}
     ${(options.summarize || options.auto) ? '"summary": "A concise one-sentence summary.",' : ''}`;

     // If custom prompt is provided, override or prepend the instruction
     if (options.prompt) {
       // Read the custom prompt record
       const promptRecord = await runJxa('read', 'getRecordPreview', [options.prompt, '5000']);
       if (promptRecord.success && promptRecord.preview) {
         instruction = `You are a helpful assistant. Please follow these custom instructions to analyze the text below:
         
         ${promptRecord.preview}
         
         IMPORTANT: Regardless of the custom instructions above, your final output MUST be a valid JSON object with the following keys if applicable: title, tags, summary.`;
       } else {
         console.warn(`Warning: Could not read custom prompt from record ${options.prompt}`);
       }
     }
     
     const prompt = `${instruction}
     
     Text to Analyze:
     ${text.substring(0, 8000).replace(/\n/g, ' ')}`;

     // Call Chat
     // We use 'json' format to ensure structured output
     const chatParams = {
       prompt: prompt,
       format: 'json',
       thinking: false // Speed up
     };
     
     const chatResult = await runJxa('read', 'chat', [JSON.stringify(chatParams)]);
     
     if (chatResult.success && chatResult.response) {
       let aiData;
       try {
         // Parse response (handle if it's string or object)
         if (typeof chatResult.response === 'object') {
           aiData = chatResult.response;
         } else {
           // Strip markdown code blocks if present
           const cleanJson = chatResult.response.replace(/```json/g, '').replace(/```/g, '').trim();
           aiData = JSON.parse(cleanJson);
         }
       } catch (e) {
         console.warn("Failed to parse AI response:", chatResult.response);
       }

       if (aiData) {
         const updates = { uuid: currentUuid };
         let modified = false;

         if ((options.rename || options.auto) && aiData.title) {
            updates.newName = aiData.title;
            modified = true;
         }
         
         if ((options.tag || options.auto) && aiData.tags && Array.isArray(aiData.tags)) {
            updates.tagsReplace = aiData.tags;
            modified = true;
         }

         if ((options.summarize || options.auto) && aiData.summary) {
            updates.comment = aiData.summary;
            modified = true;
         }

         if (modified) {
           await runJxa('write', 'modifyRecordProperties', [JSON.stringify(updates)]);
         }

         return {
           uuid: currentUuid,
           success: true,
           name: updates.name || recordProps.name,
           oldName: recordProps.name,
           tags: updates.tags || recordProps.tags,
           summary: updates.comment || recordProps.comment,
           ocrPerformed,
           renamed: !!updates.name,
           tagged: !!updates.tags,
           summarized: !!updates.comment
         };
       }
     }
  }

  return { uuid: currentUuid, success: true, name: recordProps.name, ocrPerformed };
}
