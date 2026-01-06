/**
 * Queue Command
 * Manage the task queue
 * @version 1.0.0
 * @tested 2026-01-06
 */

import { 
  addTasks, 
  executeQueue, 
  validateQueue, 
  verifyQueue,
  aiRepairQueue,
  getQueueStatus, 
  clearQueue,
  loadQueue
} from '../queue.js';
import { print, printError } from '../output.js';
import { readStdin, isStdinMarker } from '../utils.js';
import fs from 'fs/promises';
import YAML from 'yaml';

export function registerQueueCommand(program) {
  const queue = program
    .command('queue')
    .alias('q')
    .description('Manage the task queue');

  // dt queue status (default)
  queue
    .command('status', { isDefault: true })
    .description('Show queue status')
    .option('--json', 'Output raw JSON')
    .option('--all', 'Include completed tasks')
    .action(async (options) => {
      try {
        const status = await getQueueStatus();
        if (!options.all) {
          status.tasks = status.tasks.filter(t => t.status !== 'completed');
        }
        print(status, options);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt queue list
  queue
    .command('list')
    .alias('ls')
    .description('List all tasks')
    .option('--json', 'Output raw JSON')
    .action(async (options) => {
      try {
        const status = await getQueueStatus();
        print(status.tasks, options);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt queue add <action> [params...]
  queue
    .command('add <action>')
    .description('Add a task to the queue')
    .option('--name <name>', 'Name (create)')
    .option('--type <type>', 'Type (create)')
    .option('--content <content>', 'Content (create)')
    .option('--database <db>', 'Database (create/tag/search)')
    .option('--uuid <uuid>', 'Target UUID')
    .option('--uuids <uuids...>', 'Target UUIDs')
    .option('--destination <dest>', 'Destination (move/duplicate)')
    .option('--tags <tags...>', 'Tags (create/tag.add)')
    .option('--source <src>', 'Source (link)')
    .option('--target <target>', 'Target (link/tag.merge)')
    .option('--json', 'Output raw JSON response')
    .action(async (action, options) => {
      try {
        // Construct params object from options
        const params = {};
        if (options.name) params.name = options.name;
        if (options.type) params.type = options.type;
        if (options.content) params.content = options.content;
        if (options.database) params.database = options.database;
        if (options.uuid) params.uuid = options.uuid;
        if (options.uuids) params.uuids = options.uuids;
        if (options.destination) params.destination = options.destination;
        if (options.tags) params.tags = options.tags;
        if (options.source) params.source = options.source;
        if (options.target) params.target = options.target;

        const task = { action, params };
        const result = await addTasks([task]);
        
        print(result, options);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt queue load <file>
  queue
    .command('load <file>')
    .description('Load tasks from a YAML/JSON file')
    .action(async (file, options) => {
      try {
        let content;
        if (isStdinMarker(file)) {
          content = await readStdin();
        } else {
          content = await fs.readFile(file, 'utf-8');
        }
        
        // Try YAML then JSON
        let tasks;
        try {
          tasks = YAML.parse(content);
        } catch {
          tasks = JSON.parse(content);
        }
        
        // Support wrapping in { tasks: [...] } or just array
        if (tasks.tasks && Array.isArray(tasks.tasks)) {
           tasks = tasks.tasks;
        } else if (!Array.isArray(tasks)) {
           throw new Error('Input must be an array of tasks or object with "tasks" array');
        }

        const result = await addTasks(tasks);
        print(result, options);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt queue validate
  queue
    .command('validate')
    .description('Validate the queue')
    .option('--json', 'Output raw JSON')
    .action(async (options) => {
      try {
        const result = await validateQueue();
        if (!result.valid) {
          printError(new Error('Queue validation failed'), options);
          if (options.json) print(result, options);
          else console.error(result.errors.join('\n'));
          process.exit(1);
        } else {
          print(result, options);
        }
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt queue verify
  queue
    .command('verify')
    .description('Deep verify resources in the queue (checks against DEVONthink)')
    .option('--json', 'Output raw JSON')
    .action(async (options) => {
      try {
        const result = await verifyQueue();
        if (!result.valid) {
          printError(new Error(`Queue verification failed: ${result.issues.length} issues found`), options);
          if (options.json) {
            print(result, options);
          } else {
            console.error('\nIssues:');
            result.issues.forEach(i => {
              console.error(`- Task ${i.taskId}: ${i.message}`);
            });
          }
          process.exit(1);
        } else {
          if (options.json) {
            print(result, options);
          } else {
            console.log('Queue verification passed.');
            console.log(`Checked: ${result.checked.uuids} records, ${result.checked.paths} paths, ${result.checked.databases} databases.`);
          }
        }
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt queue repair
  queue
    .command('repair')
    .description('Use AI to smartly restructure and fix the task queue')
    .option('--apply', 'Actually apply the proposed fixes')
    .option('--engine <engine>', 'AI engine to use (default: claude)')
    .option('--json', 'Output raw JSON')
    .action(async (options) => {
      try {
        console.log('Analyzing queue and consulting AI...');
        const result = await aiRepairQueue(options);
        
        if (options.json) {
          print(result, options);
        } else {
          if (result.proposedTasks) {
            console.log('\nAI Proposed Fixes:');
            print(result.proposedTasks, { pretty: true });
            
            if (options.apply) {
              console.log('\nFixes applied to queue.');
            } else {
              console.log('\nTo apply these fixes, run: dt queue repair --apply');
            }
          } else {
            console.log(result.message);
          }
        }
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt queue execute
  queue
    .command('execute')
    .alias('run')
    .description('Execute pending tasks')
    .option('--dry-run', 'Validate only')
    .option('--verbose', 'Show detailed results')
    .option('--json', 'Output raw JSON')
    .action(async (options) => {
      try {
        const result = await executeQueue(options);
        print(result, options);
        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt queue clear
  queue
    .command('clear')
    .description('Clear tasks')
    .option('--scope <scope>', 'completed, failed, or all', 'completed')
    .option('--all', 'Alias for --scope all')
    .action(async (options) => {
      try {
        const scope = options.all ? 'all' : (options.scope || 'completed');
        await clearQueue(scope);
        console.log('Queue cleared (scope: ' + scope + ')');
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });
}
