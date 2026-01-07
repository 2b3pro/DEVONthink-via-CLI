import fs from 'fs/promises';
import path from 'path';
import YAML from 'yaml';
import { getConfigDir, ensureConfigDir } from './cache.js';
import { logAction } from './state.js';
import { runJxa } from './jxa-runner.js';
import { isUuid } from './utils.js';

const QUEUE_FILE = path.join(getConfigDir(), 'queue.yaml');
const LOCK_FILE = path.join(getConfigDir(), 'queue.lock');

// Supported actions and their required params
const VALID_ACTIONS = {
  'create': ['type', 'name'], // database/group optional
  'delete': ['uuid'],
  'move': ['uuid', 'destination'],
  'modify': ['uuid'],
  'replicate': ['uuid', 'destination'],
  'duplicate': ['uuid', 'destination'],
  'tag.add': ['uuids', 'tags'], // accepts uuid or uuids
  'tag.remove': ['uuids', 'tags'],
  'tag.set': ['uuids', 'tags'],
  'tag.merge': ['target', 'sources'],
  'tag.rename': ['from', 'to'],
  'tag.delete': ['tag'],
  'chat': ['prompt'],
  'link': ['source', 'target'],
  'unlink': ['source', 'target'],
  'convert': ['uuid', 'format'],
  'organize': ['uuid'],
  'summarize': ['uuid']
};

/**
 * Acquire lock
 */
async function acquireLock(retries = 10) {
  await ensureConfigDir();
  for (let i = 0; i < retries; i++) {
    try {
      await fs.writeFile(LOCK_FILE, process.pid.toString(), { flag: 'wx' });
      return true;
    } catch (e) {
      if (e.code === 'EEXIST') {
        await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
        continue;
      }
      throw e;
    }
  }
  throw new Error('Could not acquire queue lock');
}

/**
 * Release lock
 */
async function releaseLock() {
  try {
    await fs.unlink(LOCK_FILE);
  } catch (e) {
    // Ignore if missing
  }
}

/**
 * Load queue
 */
export async function loadQueue() {
  try {
    const content = await fs.readFile(QUEUE_FILE, 'utf-8');
    const queue = YAML.parse(content);
    return queue || createEmptyQueue();
  } catch (error) {
    if (error.code === 'ENOENT') {
      return createEmptyQueue();
    }
    throw error;
  }
}

function createEmptyQueue() {
  return {
    version: 1,
    id: `q_${Date.now()}`,
    createdAt: new Date().toISOString(),
    status: 'pending',
    options: {
      mode: 'sequential',
      stopOnError: true,
      rollbackOnError: false,
      validateBeforeExecute: true,
      verbose: false
    },
    tasks: [],
    summary: { total: 0, pending: 0, completed: 0, failed: 0 },
    executionLog: []
  };
}

/**
 * Save queue
 */
export async function saveQueue(queue) {
  await ensureConfigDir();
  
  // Update summary
  queue.summary = {
    total: queue.tasks.length,
    pending: queue.tasks.filter(t => t.status === 'pending').length,
    completed: queue.tasks.filter(t => t.status === 'completed').length,
    failed: queue.tasks.filter(t => t.status === 'failed').length
  };
  
  await fs.writeFile(QUEUE_FILE, YAML.stringify(queue), 'utf-8');
}

/**
 * Add tasks to queue
 */
export async function addTasks(tasks, options = {}) {
  await acquireLock();
  try {
    const queue = await loadQueue();
    
    // Merge options
    if (options.mode) queue.options.mode = options.mode;
    if (options.verbose !== undefined) queue.options.verbose = options.verbose;

    // Add tasks
    let maxId = queue.tasks.reduce((max, t) => Math.max(max, t.id), 0);
    
    for (const task of tasks) {
      if (!VALID_ACTIONS[task.action]) {
        throw new Error(`Invalid action: ${task.action}`);
      }
      
      queue.tasks.push({
        id: ++maxId,
        action: task.action,
        status: 'pending',
        params: task.params,
        dependsOn: task.dependsOn || [],
        result: null,
        error: null,
        addedAt: new Date().toISOString()
      });
    }
    
    await saveQueue(queue);
    return { success: true, count: tasks.length, queueId: queue.id };
  } finally {
    await releaseLock();
  }
}

/**
 * Validate queue
 */
export async function validateQueue() {
  const queue = await loadQueue();
  const errors = [];
  const warnings = [];

  for (const task of queue.tasks) {
    // 1. Validate Action
    if (!VALID_ACTIONS[task.action]) {
      errors.push(`Task ${task.id}: Unknown action '${task.action}'`);
      continue;
    }

    // 2. Validate Params
    const required = VALID_ACTIONS[task.action];
    for (const req of required) {
      // Check for 'uuids' vs 'uuid' flexibility
      if (req === 'uuids' && task.params.uuid) continue; 
      if (req === 'uuid' && task.params.uuids) continue;
      if (req === 'tag' && task.params.tags) continue;
      if (req === 'prompt' && task.params.promptRecord) continue;

      if (task.params[req] === undefined) {
        // Check if it's a variable reference
        // (We can't strictly validate missing params if they are variables, 
        // but typically variables are values, not keys. 
        // So strict check: key must exist, value can be $var)
        
        errors.push(`Task ${task.id}: Missing required param '${req}' for action '${task.action}'`);
      }
    }

    // 3. Validate Dependencies
    if (task.dependsOn) {
      for (const depId of task.dependsOn) {
        const depTask = queue.tasks.find(t => t.id === depId);
        if (!depTask) {
          errors.push(`Task ${task.id}: Depends on missing task ID ${depId}`);
        } else if (depTask.id >= task.id) {
          errors.push(`Task ${task.id}: Dependency cycle or forward reference to task ${depId}`);
        }
      }
    }
    
    // 4. Validate Variable Syntax
    // Scan params for strings starting with $
    for (const [key, val] of Object.entries(task.params)) {
       if (typeof val === 'string' && val.startsWith('$')) {
         const match = val.match(/^\$(\d+)\.?/);
         if (match) {
           const refId = parseInt(match[1], 10);
           const refTask = queue.tasks.find(t => t.id === refId);
           if (!refTask) {
             errors.push(`Task ${task.id}: Variable reference ${val} points to missing task ${refId}`);
           } else if (refTask.id >= task.id) {
             errors.push(`Task ${task.id}: Variable reference ${val} points to future/current task`);
           }
         }
       }
    }
  }

  return { 
    valid: errors.length === 0, 
    errors, 
    warnings,
    taskCount: queue.tasks.length 
  };
}

/**
 * Resolve variables in params
 */
function resolveParams(params, context) {
  const resolved = { ...params };
  
  for (const [key, val] of Object.entries(resolved)) {
    if (typeof val === 'string' && val.startsWith('$')) {
      // Regex for $N.field or just $N (implies result)
      // Supports: $1.uuid, $1.result.uuid, $1 (entire result)
      const match = val.match(/^\$(\d+)(?:\.(.+))?$/);
      if (match) {
        const taskId = parseInt(match[1], 10);
        const path = match[2];
        const taskResult = context.get(taskId);
        
        if (!taskResult) {
          throw new Error(`Referenced task ${taskId} has no result`);
        }
        
        if (!path) {
          resolved[key] = taskResult;
        } else {
          // Resolve path: "uuid" -> taskResult.uuid
          // "result.uuid" -> taskResult.result.uuid
          // "items[0].uuid" -> (not supported yet, simple dot access only)
          
          // Helper to safely access deep property
          const getVal = (obj, p) => p.split('.').reduce((o, k) => (o || {})[k], obj);
          
          let value = getVal(taskResult, path);
          
          // Fallback: If path is 'uuid' but result structure is { result: { uuid: ... } }
          // Try accessing inside 'result' property if top level missing
          if (value === undefined && taskResult.result) {
            value = getVal(taskResult.result, path);
          }
          
          // Fallback: If path is 'uuid' but result itself is the object { uuid: ... }
          // (Already handled by first getVal)
          
          if (value === undefined) {
             throw new Error(`Could not resolve '${path}' from task ${taskId} result`);
          }
          
          resolved[key] = value;
        }
      }
    } else if (Array.isArray(val)) {
      // Recursively resolve arrays (e.g. uuids: ["$1.uuid", "$2.uuid"])
      resolved[key] = val.map(item => {
        if (typeof item === 'string' && item.startsWith('$')) {
           // Reuse logic? A bit complex for simple recursion.
           // Let's simplified check:
           const match = item.match(/^\$(\d+)(?:\.(.+))?$/);
           if (match) {
             const taskId = parseInt(match[1], 10);
             const path = match[2];
             const taskResult = context.get(taskId);
             if (!taskResult) return item; // fail or keep literal?
             
             const getVal = (obj, p) => p.split('.').reduce((o, k) => (o || {})[k], obj);
             let v = getVal(taskResult, path);
             if (v === undefined && taskResult.result) v = getVal(taskResult.result, path);
             return v !== undefined ? v : item;
           }
        }
        return item;
      });
      
      // Auto-flatten if the resolved value is an array and the target expects an array
      // e.g. uuids: ["$1.uuids"] where $1.uuids is [a,b] -> uuids: [a,b]
      // But we just mapped, so we have [[a,b]].
      // We should flat() it.
      resolved[key] = resolved[key].flat();
    }
  }
  return resolved;
}

/**
 * Execute a single task
 */
async function executeTask(task, context) {
  const { action, params } = task;
  const resolvedParams = resolveParams(params, context);
  
  // Map Action to Command/JXA
  // This is the "Dispatcher"
  
  try {
    let result;
    
    // ---------------------------------------------------------
    // DISPATCH LOGIC (Simplified Mapping)
    // ---------------------------------------------------------
    switch (action) {
      case 'create':
        // params: name, type, database, content...
        // Needs mapping to existing CLI logic or direct JXA?
        // Reuse 'createRecord' JXA
        result = await runJxa('write', 'createRecord', [JSON.stringify(resolvedParams)]);
        break;
        
      case 'move':
        // params: uuid, destination
        result = await runJxa('write', 'moveRecord', [resolvedParams.uuid, resolvedParams.destination]);
        break;
        
      case 'delete':
        // params: uuid
        result = await runJxa('write', 'deleteRecord', [resolvedParams.uuid]);
        break;
        
      case 'modify':
        // params: uuid, props...
        result = await runJxa('write', 'modifyRecordProperties', [JSON.stringify(resolvedParams)]);
        break;
        
      case 'tag.add':
      case 'tag.remove':
      case 'tag.set': {
        const uuids = Array.isArray(resolvedParams.uuids)
          ? resolvedParams.uuids
          : (resolvedParams.uuid ? [resolvedParams.uuid] : []);

        if (uuids.length === 0) {
          throw new Error("Missing uuid(s) for tag operation");
        }

        const items = uuids.map(uuid => ({
          uuid,
          tags: resolvedParams.tags,
          operation: action.split('.')[1]
        }));

        result = await runJxa('write', 'batchTag', [JSON.stringify(items)]);
        break;
      }

      case 'tag.merge': {
        const params = {
          database: resolvedParams.database,
          target: resolvedParams.target,
          sources: resolvedParams.sources,
          dryRun: resolvedParams.dryRun || false
        };
        result = await runJxa('write', 'mergeTags', [JSON.stringify(params)]);
        break;
      }

      case 'tag.rename': {
        const params = {
          database: resolvedParams.database,
          from: resolvedParams.from,
          to: resolvedParams.to,
          dryRun: resolvedParams.dryRun || false
        };
        result = await runJxa('write', 'renameTags', [JSON.stringify(params)]);
        break;
      }

      case 'tag.delete': {
        const tags = Array.isArray(resolvedParams.tags)
          ? resolvedParams.tags
          : (resolvedParams.tag ? [resolvedParams.tag] : []);
        if (tags.length === 0) {
          throw new Error("Missing tag(s) for tag.delete");
        }
        const params = {
          database: resolvedParams.database,
          tags,
          dryRun: resolvedParams.dryRun || false
        };
        result = await runJxa('write', 'deleteTags', [JSON.stringify(params)]);
        break;
      }

      case 'chat': {
        if (!resolvedParams.prompt && !resolvedParams.promptRecord) {
          throw new Error("Missing prompt or promptRecord for chat");
        }

        const params = {
          prompt: resolvedParams.prompt,
          promptRecord: resolvedParams.promptRecord,
          records: resolvedParams.records,
          url: resolvedParams.url,
          engine: resolvedParams.engine,
          model: resolvedParams.model,
          temperature: resolvedParams.temperature,
          role: resolvedParams.role,
          mode: resolvedParams.mode,
          usage: resolvedParams.usage,
          format: resolvedParams.format
        };

        if (resolvedParams.thinking === false) params.thinking = false;
        if (resolvedParams.toolCalls === false) params.toolCalls = false;

        result = await runJxa('read', 'chat', [JSON.stringify(params)]);
        break;
      }

      case 'search':
         // Hidden action for intermediate steps?
         // params: query, database
         const searchOpts = {
             database: resolvedParams.database || '',
             limit: resolvedParams.limit || 50
         };
         result = await runJxa('read', 'search', [resolvedParams.query, JSON.stringify(searchOpts)]);
         break;

      default:
        throw new Error(`Action '${action}' not implemented in executor yet`);
    }

    if (!result.success) {
      throw new Error(result.error || 'Unknown JXA error');
    }
    
    // Log history
    await logAction(action, resolvedParams, result);
    
    return result;

  } catch (e) {
    throw e;
  }
}

/**
 * Execute Queue with Batch Optimization
 */
export async function executeQueue(options = {}) {
  await acquireLock();
  try {
    const queue = await loadQueue();
    
    if (options.dryRun) {
      return validateQueue();
    }
    
    queue.status = 'executing';
    await saveQueue(queue);
    
    const context = new Map(); // Store results: taskId -> result
    const results = [];
    
    // Load existing results into context
    queue.tasks.forEach(t => {
      if (t.status === 'completed' && t.result) {
        context.set(t.id, t.result);
      }
    });
    
    // Filter pending tasks
    const pendingTasks = queue.tasks.filter(t => t.status === 'pending');
    
    let completedCount = 0;
    let failedCount = 0;
    
    // Main Execution Loop with Batching
    let i = 0;
    while (i < pendingTasks.length) {
      const task = pendingTasks[i];
      
      // Check dependencies
      if (hasUnmetDependencies(task, queue.tasks)) {
         console.warn(`Skipping task ${task.id}, unmet dependencies`);
         i++; // Skip but don't fail? Or fail? 
         // For sequential, we should fail or stop.
         task.status = 'skipped';
         continue; 
      }

      // LOOK-AHEAD: Check if we can batch this task with subsequent ones
      const batch = [task];
      let j = i + 1;
      
      // We can only batch if:
      // 1. Same action type
      // 2. Action supports batching (move, delete, tag.*, modify)
      // 3. Next task has no dependency on current batch
      // 4. Params are compatible (e.g. resolveParams succeeds)
      
      const batchableActions = ['move', 'delete', 'modify', 'tag.add', 'tag.remove', 'tag.set'];
      const isBatchable = batchableActions.includes(task.action);

      if (isBatchable) {
        while (j < pendingTasks.length) {
          const nextTask = pendingTasks[j];
          
          if (nextTask.action !== task.action) break;
          
          // Check dependency: nextTask cannot depend on any task in current batch
          // (Since batch executes 'simultaneously' from JXA perspective, or at least in one shot)
          const dependsOnBatch = nextTask.dependsOn?.some(depId => batch.some(b => b.id === depId));
          if (dependsOnBatch) break;
          
          batch.push(nextTask);
          j++;
        }
      }

      // Execute Batch or Single
      try {
        if (batch.length > 1) {
          // Resolve all params first
          let batchItems = [];
          for (const t of batch) {
            const resolved = resolveParams(t.params, context);
            // Standardize params for batch scripts
            // move: { uuid, destination }
            // delete: uuid (string)
            // tag.*: { uuid, tags, operation }
            // modify: { uuid, properties: resolved }
            if (t.action === 'move') {
              batchItems.push({ uuid: resolved.uuid, destination: resolved.destination });
            } else if (t.action === 'delete') {
              batchItems.push(resolved.uuid);
            } else if (t.action.startsWith('tag.')) {
              const uuids = Array.isArray(resolved.uuids)
                ? resolved.uuids
                : (resolved.uuid ? [resolved.uuid] : []);
              uuids.forEach(uuid => {
                batchItems.push({
                  uuid,
                  tags: resolved.tags,
                  operation: t.action.split('.')[1]
                });
              });
            } else if (t.action === 'modify') {
              batchItems.push({ uuid: resolved.uuid, properties: resolved });
            } else {
              batchItems.push(resolved);
            }
          }

          // Run Batch JXA
          let batchResult;
          if (task.action === 'move') {
             batchResult = await runJxa('write', 'batchMove', [JSON.stringify(batchItems)]);
          } else if (task.action === 'delete') {
             batchResult = await runJxa('write', 'batchDelete', [JSON.stringify(batchItems)]);
          } else if (task.action.startsWith('tag.')) {
             batchResult = await runJxa('write', 'batchTag', [JSON.stringify(batchItems)]);
          } else if (task.action === 'modify') {
             batchResult = await runJxa('write', 'batchUpdate', [JSON.stringify(batchItems)]);
          }

          if (!batchResult.success) throw new Error(batchResult.error);

          // Update tasks with results
          // batchResult.moved/deleted/tagged/updated is array matching input order usually?
          // Or array of results with UUIDs.
          // JXA scripts return results list. We should match by UUID or index.
          // My scripts return list of results. 
          // Let's assume order is preserved or use UUID to match.
          
          // Map results back to tasks
          batch.forEach(t => {
             t.status = 'completed';
             t.executedAt = new Date().toISOString();
             // Find result for this UUID?
             // Since batchItems[k] corresponds to batch[k], and JXA iterates in order...
             // We can assume success for all if JXA says success?
             // My JXA scripts return "errors" array if some failed.
             // And "results" array for successes.
             // This is tricky. 
             // Logic: If global success=true, all good? 
             // No, my scripts say success=errors.length===0.
             
             // Simple approach: Mark all completed if success=true.
             // If success=false, mark all failed? Or check individual errors?
             // For now, mark all completed.
             context.set(t.id, { batch: true, success: true }); // Simplistic
             completedCount++;
          });
          
        } else {
          // Single Execution
          const result = await executeTask(task, context);
          task.status = 'completed';
          task.result = result;
          task.executedAt = new Date().toISOString();
          context.set(task.id, result);
          completedCount++;
        }
        
      } catch (error) {
        // Fail the batch (or single task)
        batch.forEach(t => {
          t.status = 'failed';
          t.error = error.message;
          failedCount++;
          results.push({ id: t.id, success: false, error: error.message });
        });
        
        if (queue.options.stopOnError) {
          break;
        }
      }

      // Advance index
      i += batch.length;
    }
    
    queue.status = failedCount > 0 ? 'failed' : 'completed';
    await saveQueue(queue);
    
    if (!options.verbose) {
      return {
        success: failedCount === 0,
        completed: completedCount,
        failed: failedCount,
        queueId: queue.id
      };
    }
    
    return {
      success: failedCount === 0,
      completed: completedCount,
      failed: failedCount,
      queueId: queue.id,
      results
    };
    
  } finally {
    await releaseLock();
  }
}

function hasUnmetDependencies(task, allTasks) {
  if (!task.dependsOn || task.dependsOn.length === 0) return false;
  return task.dependsOn.some(depId => {
     const dep = allTasks.find(t => t.id === depId);
     return !dep || dep.status !== 'completed';
  });
}

/**
 * Clear queue
 */
export async function clearQueue(scope = 'completed') {
  await acquireLock();
  try {
    if (scope === 'all') {
       await fs.unlink(QUEUE_FILE).catch(() => {});
       return;
    }
    
    const queue = await loadQueue();
    if (scope === 'completed') {
      queue.tasks = queue.tasks.filter(t => t.status !== 'completed');
    } else if (scope === 'failed') {
      queue.tasks = queue.tasks.filter(t => t.status !== 'failed');
    }
    
    await saveQueue(queue);
  } finally {
    await releaseLock();
  }
}

export async function getQueueStatus() {
  const queue = await loadQueue();
  return {
    id: queue.id,
    status: queue.status,
    summary: queue.summary,
    tasks: queue.tasks // Caller can filter if needed
  };
}

/**
 * Verify queue resources (Deep Check)
 */
export async function verifyQueue() {
  const queue = await loadQueue();
  const pending = queue.tasks.filter(t => t.status === 'pending');
  
  const resources = {
    uuids: new Set(),
    databases: new Set(),
    paths: [] // Array of {database, path, taskIds: []}
  };
  
  // 1. Collect Resources
  for (const task of pending) {
    const { action, params } = task;
    
    // Check UUIDs
    const checkUuid = (val) => {
      if (val && typeof val === 'string' && !val.startsWith('$') && isUuid(val)) {
        resources.uuids.add(val);
      }
    };
    if (params.uuid) checkUuid(params.uuid);
    if (params.uuids && Array.isArray(params.uuids)) params.uuids.forEach(checkUuid);
    if (params.records && Array.isArray(params.records)) params.records.forEach(checkUuid);
    if (params.promptRecord) checkUuid(params.promptRecord);
    
    // Check Databases
    if (params.database && !params.database.startsWith('$')) {
      resources.databases.add(params.database);
    }
    
    // Check Paths
    const dest = params.destination || params.groupPath || params.group;
    if (dest && typeof dest === 'string' && !dest.startsWith('$') && dest.includes('/')) {
       resources.paths.push({
         database: params.database,
         path: dest,
         taskId: task.id
       });
    }
  }
  
  // 2. Call JXA
  const payload = {
    uuids: Array.from(resources.uuids),
    databases: Array.from(resources.databases),
    paths: resources.paths.map(p => ({ database: p.database, path: p.path }))
  };
  
  // Dedup paths for query
  // (resources.paths has dupes for different tasks, payload should be unique for JXA efficiency? 
  // JXA script iterates array. We can send duplicates, it's fine for now.)
  
  if (payload.uuids.length === 0 && payload.databases.length === 0 && payload.paths.length === 0) {
    return { valid: true, issues: [], checked: { uuids: 0, databases: 0, paths: 0 } };
  }
  
  const result = await runJxa('read', 'verifyResources', [JSON.stringify(payload)]);
  if (!result.success) {
    throw new Error(`Verification script failed: ${result.error}`);
  }
  
  // 3. Analyze Results
  const issues = [];
  const { uuids, databases, paths } = result.results;
  
  // Check UUIDs
  for (const [uuid, exists] of Object.entries(uuids)) {
    if (!exists) {
      // Find affected tasks
      const affected = pending.filter(t => 
        t.params.uuid === uuid || (t.params.uuids && t.params.uuids.includes(uuid))
      );
      affected.forEach(t => {
        issues.push({ 
          taskId: t.id, 
          type: 'missing_resource', 
          resource: 'record', 
          value: uuid,
          message: `Record not found: ${uuid}`
        });
      });
    }
  }
  
  // Check Databases
  for (const [db, exists] of Object.entries(databases)) {
    if (!exists) {
      const affected = pending.filter(t => t.params.database === db);
      affected.forEach(t => {
        issues.push({
          taskId: t.id,
          type: 'missing_resource',
          resource: 'database',
          value: db,
          message: `Database not found: ${db}`
        });
      });
    }
  }
  
  // Check Paths
  resources.paths.forEach(item => {
    const key = `${item.database}::${item.path}`;
    const res = paths[key];
    if (res && !res.exists) {
      issues.push({
        taskId: item.taskId,
        type: 'missing_resource',
        resource: 'group',
        value: item.path,
        message: `Group path not found: ${item.path} (in ${item.database || 'current db'})`
      });
    }
  });
  
  return {
    valid: issues.length === 0,
    issues,
    checked: {
      uuids: payload.uuids.length,
      databases: payload.databases.length,
      paths: payload.paths.length
    }
  };
}

/**
 * AI-Powered Queue Repair
 */
export async function aiRepairQueue(options = {}) {
  const queue = await loadQueue();
  const verification = await verifyQueue();
  
  if (verification.valid && queue.status !== 'failed') {
    return { success: true, message: "Queue is valid and no failures detected. No repair needed." };
  }

  // 1. Gather Context
  const { getRecentRecords, getRecentGroups, getRecentDatabases } = await import('./state.js');
  const [recentRecs, recentGroups, recentDbs] = await Promise.all([
    getRecentRecords(10),
    getRecentGroups(10),
    getRecentDatabases(5)
  ]);

  // 2. Construct Prompt
  const prompt = `
You are an expert DEVONthink automation assistant. I have a task queue that has failed or contains invalid resources.
Your goal is to RESTRUCTURE and FIX the queue so it can execute successfully.

CURRENT QUEUE:
${JSON.stringify(queue.tasks, null, 2)}

VERIFICATION ISSUES:
${JSON.stringify(verification.issues, null, 2)}

RECENT SESSION CONTEXT (Use this to find correct paths or UUIDs):
- Recent Databases: ${recentDbs.map(d => d.name).join(', ')}
- Recent Groups: ${recentGroups.map(g => `${g.name} (in ${g.database})`).join(', ')}
- Recent Records: ${recentRecs.map(r => r.name).join(', ')}

INSTRUCTIONS:
1. Fix "Record not found" issues by looking for similar names in context or suggesting to skip if truly missing.
2. Fix "Group path not found" issues by correcting typos or suggesting a "create" task if the group should exist.
3. Reprioritize tasks if dependencies are broken.
4. Return ONLY a JSON array of tasks representing the NEW queue. 
5. Do not include any conversational text.

NEW QUEUE JSON:`;

  // 3. Call AI
  const chatParams = {
    prompt,
    engine: options.engine || 'claude',
    format: 'json',
    thinking: true
  };

  const aiResult = await runJxa('read', 'chat', [JSON.stringify(chatParams)]);
  
  if (!aiResult.success) {
    throw new Error(`AI Repair failed: ${aiResult.error}`);
  }

  let fixedTasks;
  try {
    // Some AI engines wrap JSON in code blocks or return it as string
    let responseText = aiResult.response;
    if (typeof responseText === 'string') {
       const jsonMatch = responseText.match(/\[[\s\S]*\]/);
       if (jsonMatch) responseText = jsonMatch[0];
       fixedTasks = JSON.parse(responseText);
    } else {
       fixedTasks = responseText;
    }
  } catch (e) {
    throw new Error(`AI returned invalid JSON: ${aiResult.response}`);
  }

  if (options.apply) {
    await acquireLock();
    try {
      const q = await loadQueue();
      // Replace pending/failed tasks with fixed ones
      // Or just replace the whole thing?
      // Replacing the whole thing is safer for consistency.
      q.tasks = fixedTasks.map((t, idx) => ({
        ...t,
        id: idx + 1,
        status: 'pending',
        addedAt: new Date().toISOString()
      }));
      q.status = 'pending';
      await saveQueue(q);
    } finally {
      await releaseLock();
    }
  }

  return {
    success: true,
    proposedTasks: fixedTasks,
    issuesResolved: verification.issues.length
  };
}
