/**
 * Language mappings from LeetCode to file extensions.
 */
export const LANGUAGE_EXTENSIONS = {
  'C++': 'cpp',
  'Java': 'java',
  'Python3': 'py',
  'Python': 'py',
  'JavaScript': 'js',
  'TypeScript': 'ts',
  'Go': 'go',
  'Rust': 'rs',
  'Kotlin': 'kt',
  'C': 'c',
  'C#': 'cs',
  'Swift': 'swift',
  'PHP': 'php',
  'Ruby': 'rb',
  'Dart': 'dart',
  'Scala': 'scala',
  'MySQL': 'sql',
  'MS SQL Server': 'sql',
  'Oracle': 'sql',
  'PostgreSQL': 'sql'
};

/**
 * Returns the file extension for a LeetCode language.
 * Falls back to 'txt' if unknown.
 */
export function getFileExtension(language) {
  if (!language) return 'txt';
  
  // Clean up language names (e.g. "C++ (G++ 11)" -> "C++")
  let cleanLang = language.trim();
  
  // Exact match
  if (LANGUAGE_EXTENSIONS[cleanLang]) {
    return LANGUAGE_EXTENSIONS[cleanLang];
  }
  
  // Partial match checks
  for (const [lang, ext] of Object.entries(LANGUAGE_EXTENSIONS)) {
    if (cleanLang.toLowerCase().startsWith(lang.toLowerCase())) {
      return ext;
    }
  }
  
  return 'txt';
}

/**
 * Generates the header comment containing submission metadata.
 */
export function generateHeaderComment(metadata) {
  const { problemTitle, problemId, difficulty, language, runtime, memory, date } = metadata;
  
  const commentLines = [
    `Problem: ${problemTitle || 'Unknown'}`,
    `Problem ID: ${problemId || 'Unknown'}`,
    `Difficulty: ${difficulty || 'Unknown'}`,
    `Language: ${language || 'Unknown'}`,
    `Runtime: ${runtime || 'N/A'}`,
    `Memory: ${memory || 'N/A'}`,
    `Synced From: LeetCode`,
    `Date: ${date || new Date().toISOString().split('T')[0]}`
  ];

  const ext = getFileExtension(language);

  // Determine comment style based on file extension
  if (['py', 'rb'].includes(ext)) {
    // Hash-style comment
    return commentLines.map(line => `# ${line}`).join('\n') + '\n\n';
  } else if (['sql'].includes(ext)) {
    // SQL-style comment
    return commentLines.map(line => `-- ${line}`).join('\n') + '\n\n';
  } else {
    // Multi-line C-style comment (/* ... */) or single line double slashes (//)
    // The prompt demonstrates multi-line for C++:
    // /*
    // Problem: Two Sum
    // ...
    // */
    return `/*\n${commentLines.map(line => ` * ${line}`).join('\n')}\n */\n\n`;
  }
}
