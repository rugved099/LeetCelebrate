/**
 * Helper to update the solutions.json database and generate the README.md content.
 * 
 * @param {Array} existingSolutions - Array of existing solution objects from solutions.json
 * @param {Object} newSubmission - The new submission metadata to sync
 * @returns {Object} { updatedSolutions, readmeContent }
 */
export function updateSolutionsAndGenerateReadme(existingSolutions = [], newSubmission) {
  const solutions = [...existingSolutions];

  // 1. Update or append the new submission in solutions.json
  // We identify a unique solution by problemId AND language.
  const existingIdx = solutions.findIndex(
    s => String(s.problemId) === String(newSubmission.problemId) && 
         s.language.toLowerCase() === newSubmission.language.toLowerCase()
  );

  // Parse problem ID as number for sorting
  const numericId = parseInt(newSubmission.problemId, 10) || 9999;

  const entry = {
    problemId: String(newSubmission.problemId),
    problemTitle: newSubmission.problemTitle,
    problemSlug: newSubmission.problemSlug,
    difficulty: newSubmission.difficulty,
    language: newSubmission.language,
    extension: newSubmission.extension,
    runtime: newSubmission.runtime,
    memory: newSubmission.memory,
    submissionId: newSubmission.submissionId,
    timestamp: newSubmission.timestamp || String(Date.now()),
    path: `${newSubmission.difficulty}/${String(newSubmission.problemId).padStart(4, '0')}_${newSubmission.problemTitle.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9__-]/g, '')}.${newSubmission.extension}`,
    numericId
  };

  if (existingIdx >= 0) {
    // Update stats for the existing language solution
    solutions[existingIdx] = { ...solutions[existingIdx], ...entry };
  } else {
    // Add new solution language
    solutions.push(entry);
  }

  // 2. Sort solutions by numericId ascending, then by language
  solutions.sort((a, b) => {
    if (a.numericId !== b.numericId) {
      return a.numericId - b.numericId;
    }
    return a.language.localeCompare(b.language);
  });

  // 3. Group solutions by problemId to calculate unique solved problems and render lists
  const groupedProblems = {};
  solutions.forEach(s => {
    if (!groupedProblems[s.problemId]) {
      groupedProblems[s.problemId] = {
        problemId: s.problemId,
        problemTitle: s.problemTitle,
        difficulty: s.difficulty,
        numericId: s.numericId,
        solutions: []
      };
    }
    groupedProblems[s.problemId].solutions.push(s);
  });

  // Count by difficulty
  let easyCount = 0;
  let mediumCount = 0;
  let hardCount = 0;

  const easyList = [];
  const mediumList = [];
  const hardList = [];

  // Sort grouped problems by ID
  const sortedGrouped = Object.values(groupedProblems).sort((a, b) => a.numericId - b.numericId);

  sortedGrouped.forEach(prob => {
    const diff = prob.difficulty;
    const linksStr = prob.solutions
      .map(sol => `[${sol.language}](${encodeURI(sol.path)})`)
      .join(', ');

    const line = `- ${prob.problemTitle} (${linksStr})`;

    if (diff === 'Easy') {
      easyCount++;
      easyList.push(line);
    } else if (diff === 'Hard') {
      hardCount++;
      hardList.push(line);
    } else {
      mediumCount++;
      mediumList.push(line);
    }
  });

  const totalSolved = sortedGrouped.length;

  // 4. Generate README Markdown content
  const readmeContent = `# LeetCode Solutions

Total Solved: ${totalSolved}

## Easy

${easyList.length > 0 ? easyList.join('\n') : '*No easy problems solved yet.*'}

## Medium

${mediumList.length > 0 ? mediumList.join('\n') : '*No medium problems solved yet.*'}

## Hard

${hardList.length > 0 ? hardList.join('\n') : '*No hard problems solved yet.*'}

## Statistics

| Difficulty | Count |
|------------|--------|
| Easy | ${easyCount} |
| Medium | ${mediumCount} |
| Hard | ${hardCount} |

---
*README.md automatically updated by [LeetCelebrate](https://github.com/)*
`;

  // Strip numericId from the solutions.json storage to keep it clean
  const cleanedSolutions = solutions.map(({ numericId, ...rest }) => rest);

  return {
    updatedSolutions: cleanedSolutions,
    readmeContent
  };
}
