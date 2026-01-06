/**
 * Tag Blocklists
 * Pre-defined lists of tags that are typically noise or artifacts
 */

/**
 * ML-generated image recognition artifacts
 * These tags typically come from automatic image tagging and are rarely useful
 */
export const ML_ARTIFACT_BLOCKLIST = [
  // Physical objects (random detection)
  'hockey puck',
  'puck',
  'loupe',
  "jeweler's loupe",
  'oscilloscope',
  'magnetic compass',
  'ruler',
  'scoreboard',
  'envelope',
  'menu',
  'staircase',

  // Clothing items
  'bow tie',
  'bow-tie',
  'bowtie',
  'Windsor tie',

  // Locations/scenes (generic)
  'airport terminal',
  'runway',
  'art gallery',
  'art studio',
  'bridge',
  'gas station',
  'hospital',
  'motel',
  'eating house',
  'eating place',
  'eatery',
  'restaurant',
  'farmers markets',
  'stream',

  // Nature scenes
  'cherry blossoms',
  'Japanese landscape',

  // Clocks
  'analog clock',
  'digital clock',
  'wall clock',

  // Document parts (from scanning)
  'dust cover',
  'dust jacket',
  'dust wrapper',
  'book jacket',

  // Random objects commonly misdetected
  'coloring book',
  'jeweler',
  'Telluride'
];

/**
 * Scanner/OCR processing artifacts
 * These tags indicate processing state, not content
 */
export const SCANNER_BLOCKLIST = [
  'CamScanner',
  'Scanner',
  'OCR',
  'converted-to-pdf',
  'Watermark',
  'scanned',
  'scan'
];

/**
 * Generic noise tags that add no semantic value
 */
export const NOISE_BLOCKLIST = [
  // Pure noise
  'No',
  'other',
  'site',
  'web site',
  'website',
  'internet site',

  // Generic document types (often not useful as tags)
  'book',
  'article',
  'Article',
  'report',
  'document',
  'file',
  'page',
  'pages',

  // Generic actions
  'review',
  'action:review',
  'action:extract',
  'recommended',
  'summarized',

  // AI chat artifacts
  '@Gemini',
  '@ChatGPT',
  '@Claude',

  // Generic descriptors
  'important',
  'misc',
  'miscellaneous',
  'general',
  'various',
  'unknown',
  'untitled',
  'new',
  'old',
  'draft'
];

/**
 * All blocklists combined for convenience
 */
export const ALL_BLOCKLISTS = [
  ...ML_ARTIFACT_BLOCKLIST,
  ...SCANNER_BLOCKLIST,
  ...NOISE_BLOCKLIST
];
