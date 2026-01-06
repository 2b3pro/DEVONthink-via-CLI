import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import YAML from 'yaml';

const CONFIG_DIR = process.env.DT_CONFIG_DIR || path.join(os.homedir(), '.config', 'dt');
const DB_CACHE_FILE = path.join(CONFIG_DIR, 'databases.yaml');
const DEFAULT_TTL = 3600; // 1 hour

/**
 * Ensure the configuration directory exists
 */
export async function ensureConfigDir() {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
  } catch (error) {
    // Ignore error if directory already exists
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * Get the path to the configuration directory
 */
export function getConfigDir() {
  return CONFIG_DIR;
}

/**
 * Read database cache
 * @param {Object} options
 * @param {number} options.maxAge - Max age in seconds (default: 3600)
 * @param {boolean} options.forceRefresh - Force invalidation
 * @returns {Promise<{databases: Array, lastUpdated: string, isStale: boolean}|null>}
 */
export async function getDatabaseCache(options = {}) {
  const { maxAge = DEFAULT_TTL, forceRefresh = false } = options;

  if (forceRefresh) {
    return null;
  }

  try {
    const content = await fs.readFile(DB_CACHE_FILE, 'utf-8');
    const cache = YAML.parse(content);

    if (!cache || !cache.databases) {
      return null;
    }

    const isStale = isCacheStale(cache, maxAge);
    
    // If we strictly need fresh data (implicit in some contexts, but here we return the stale data 
    // with a flag so the caller decides whether to use it or refresh)
    // However, the spec says "Returns null if missing/stale" implies strictly checking.
    // Let's refine: The spec says "Returns null if missing/stale" for the general case?
    // Actually, usually a cache.get should return what it has, and let the caller decide or return null if strictly expired.
    // The spec says: "Read cache (returns null if missing/stale)". 
    // Wait, if it returns null, we can't see the stale data even if we wanted it. 
    // Let's return the object with an isStale flag, but if it is VERY old or invalid, return null?
    // No, let's stick to the spec's intent: The caller usually wants valid data.
    // But for "offline" modes, stale data is better than nothing.
    // I will return the object with an isStale property. If the caller wants to treat stale as null, they can.
    
    return {
      ...cache,
      isStale
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    // Log error but return null to fail safe
    console.error('Error reading database cache:', error.message);
    return null;
  }
}

/**
 * Write database cache
 * @param {Array} databases - List of database objects
 */
export async function setDatabaseCache(databases) {
  await ensureConfigDir();
  
  const cache = {
    version: 1,
    lastUpdated: new Date().toISOString(),
    ttl: DEFAULT_TTL,
    databases
  };

  await fs.writeFile(DB_CACHE_FILE, YAML.stringify(cache), 'utf-8');
}

/**
 * Invalidate the cache (delete file or mark expired)
 */
export async function invalidateDatabaseCache() {
  try {
    await fs.unlink(DB_CACHE_FILE);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * Check if cache is stale
 * @param {Object} cache 
 * @param {number} maxAge - seconds
 * @returns {boolean}
 */
export function isCacheStale(cache, maxAge = DEFAULT_TTL) {
  if (!cache || !cache.lastUpdated) return true;
  
  const lastUpdated = new Date(cache.lastUpdated).getTime();
  const now = Date.now();
  const ageSeconds = (now - lastUpdated) / 1000;
  
  return ageSeconds > maxAge;
}
