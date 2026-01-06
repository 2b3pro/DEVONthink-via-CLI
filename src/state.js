import fs from 'fs/promises';
import path from 'path';
import YAML from 'yaml';
import { getConfigDir, ensureConfigDir } from './cache.js';

const STATE_FILE = path.join(getConfigDir(), 'state.yaml');

const LIMITS = {
  recent: {
    databases: 10,
    groups: 20,
    records: 30
  },
  history: 100
};

/**
 * Load the current state
 * @returns {Promise<Object>}
 */
async function loadState() {
  try {
    const content = await fs.readFile(STATE_FILE, 'utf-8');
    const state = YAML.parse(content);
    
    // Ensure structure exists
    return {
      version: 1,
      lastUpdated: new Date().toISOString(),
      recent: {
        databases: [],
        groups: [],
        records: [],
        ...state?.recent
      },
      history: state?.history || []
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        version: 1,
        recent: { databases: [], groups: [], records: [] },
        history: []
      };
    }
    throw error;
  }
}

/**
 * Save the state
 * @param {Object} state 
 */
async function saveState(state) {
  await ensureConfigDir();
  state.lastUpdated = new Date().toISOString();
  await fs.writeFile(STATE_FILE, YAML.stringify(state), 'utf-8');
}

/**
 * Update a recent list (ring buffer)
 * @param {Array} list 
 * @param {Object} item 
 * @param {number} limit 
 * @param {Function} compareFn 
 */
function updateRecentList(list, item, limit, compareFn) {
  // Remove existing entry if match
  const index = list.findIndex(existing => compareFn(existing, item));
  if (index !== -1) {
    list.splice(index, 1);
  }
  
  // Add to top
  list.unshift({
    ...item,
    accessedAt: new Date().toISOString()
  });
  
  // Trim
  if (list.length > limit) {
    list.length = limit;
  }
  
  // Update access count if it was existing? 
  // Spec says "accessCount: 42". Let's implement that if we found it.
  // Actually, I removed it above. Let's find it, get count, then remove.
  // Re-implementing:
  
  /* 
     Better logic:
     1. Find existing.
     2. Get old count (default 0).
     3. Remove existing.
     4. Add new with count + 1.
  */
}

/**
 * Helper to update state with proper locking (simulated via load-save)
 * @param {Function} updater - (state) => modifiedState
 */
async function updateState(updater) {
  // TODO: Add file locking here for concurrency safety
  const state = await loadState();
  updater(state);
  await saveState(state);
}

// --- Recent Access Tracking ---

export async function trackDatabaseAccess(db) {
  await updateState(state => {
    const list = state.recent.databases;
    const limit = LIMITS.recent.databases;
    const uuid = db.uuid;
    
    const existingIndex = list.findIndex(d => d.uuid === uuid);
    let count = 0;
    
    if (existingIndex !== -1) {
      count = list[existingIndex].accessCount || 0;
      list.splice(existingIndex, 1);
    }
    
    list.unshift({
      uuid: db.uuid,
      name: db.name,
      path: db.path, // Optional but useful if available
      accessedAt: new Date().toISOString(),
      accessCount: count + 1
    });
    
    if (list.length > limit) list.length = limit;
  });
}

export async function trackGroupAccess(group) {
  await updateState(state => {
    const list = state.recent.groups;
    const limit = LIMITS.recent.groups;
    const uuid = group.uuid;
    
    const existingIndex = list.findIndex(g => g.uuid === uuid);
    if (existingIndex !== -1) list.splice(existingIndex, 1);
    
    list.unshift({
      uuid: group.uuid,
      name: group.name,
      path: group.path, // location path
      database: group.databaseName, // helper name
      databaseUuid: group.databaseUuid,
      accessedAt: new Date().toISOString()
    });
    
    if (list.length > limit) list.length = limit;
  });
}

export async function trackRecordAccess(record) {
  await updateState(state => {
    const list = state.recent.records;
    const limit = LIMITS.recent.records;
    const uuid = record.uuid;
    
    const existingIndex = list.findIndex(r => r.uuid === uuid);
    if (existingIndex !== -1) list.splice(existingIndex, 1);
    
    list.unshift({
      uuid: record.uuid,
      name: record.name,
      type: record.type,
      database: record.databaseName,
      databaseUuid: record.databaseUuid,
      accessedAt: new Date().toISOString()
    });
    
    if (list.length > limit) list.length = limit;
  });
}

export async function getRecentDatabases(limit = LIMITS.recent.databases) {
  const state = await loadState();
  return state.recent.databases.slice(0, limit);
}

export async function getRecentGroups(limit = LIMITS.recent.groups) {
  const state = await loadState();
  return state.recent.groups.slice(0, limit);
}

export async function getRecentRecords(limit = LIMITS.recent.records) {
  const state = await loadState();
  return state.recent.records.slice(0, limit);
}

// --- History & Undo ---

export async function logAction(action, params, result, reverseAction = null) {
  await updateState(state => {
    const entry = {
      id: `h_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      action,
      timestamp: new Date().toISOString(),
      params,
      result,
      reversible: !!reverseAction,
      reverseAction
    };
    
    state.history.unshift(entry);
    
    if (state.history.length > LIMITS.history) {
      state.history.length = LIMITS.history;
    }
  });
}

export async function getHistory(options = {}) {
  const { limit = 20, action, since, reversibleOnly } = options;
  const state = await loadState();
  
  let history = state.history;
  
  if (action) {
    history = history.filter(h => h.action === action);
  }
  
  if (since) {
    const sinceTime = new Date(since).getTime();
    history = history.filter(h => new Date(h.timestamp).getTime() >= sinceTime);
  }
  
  if (reversibleOnly) {
    history = history.filter(h => h.reversible);
  }
  
  return history.slice(0, limit);
}

export async function getLastReversibleAction() {
  const state = await loadState();
  return state.history.find(h => h.reversible) || null;
}

export async function markActionReversed(actionId) {
  await updateState(state => {
    const entry = state.history.find(h => h.id === actionId);
    if (entry) {
      entry.reversible = false; // It's already reversed, can't reverse again
      entry.reversedAt = new Date().toISOString();
    }
  });
}
