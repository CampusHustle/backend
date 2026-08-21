/**
 * Canonical list of allowed subject/skill tags for CampusHustle (FR-3).
 * Tags are used for both skillsTeaching and skillsLearning.
 * All comparisons are case-insensitive; values stored in lowercase.
 */
export const ALLOWED_SKILL_TAGS = [
  // Mathematics & Statistics
  'mathematics',
  'calculus',
  'linear algebra',
  'statistics',
  'probability',
  'discrete mathematics',
  'numerical methods',

  // Computer Science & Engineering
  'programming',
  'python',
  'java',
  'javascript',
  'c',
  'c++',
  'c#',
  'data structures',
  'algorithms',
  'operating systems',
  'computer networks',
  'database systems',
  'software engineering',
  'web development',
  'mobile development',
  'devops',
  'cloud computing',
  'machine learning',
  'artificial intelligence',
  'cybersecurity',
  'computer architecture',
  'compiler design',

  // Electrical & Electronics
  'circuit analysis',
  'digital electronics',
  'analog electronics',
  'signal processing',
  'control systems',
  'power systems',
  'electromagnetics',

  // Physics & Chemistry
  'physics',
  'chemistry',
  'thermodynamics',
  'fluid mechanics',
  'mechanics',

  // Civil & Mechanical Engineering
  'structural analysis',
  'engineering drawing',
  'material science',
  'mechanics of materials',
  'engineering',

  // Business & Economics
  'economics',
  'accounting',
  'business management',
  'marketing',
  'finance',
  'entrepreneurship',

  // Natural & Social Sciences
  'biology',
  'environmental science',
  'sociology',
  'psychology',
  'political science',
  'history',
  'geography',

  // Language & Communication
  'english',
  'amharic',
  'communication skills',
  'academic writing',
  'research methods',

  // Extracurricular, Campus & Practical Skills
  'chess',
  'graphic design',
  'public speaking',
  'music',
  'guitar',
  'piano',
  'photography',
  'video editing',
  'tutoring',
  'general',
];

/**
 * Common abbreviations and shorthand mapped to canonical tags.
 */
export const SKILL_TAG_ALIASES = {
  math: 'mathematics',
  maths: 'mathematics',
  calc: 'calculus',
  'calculus 101': 'calculus',
  stats: 'statistics',
  eng: 'english',
  psych: 'psychology',
  cs: 'programming',
  coding: 'programming',
  dsa: 'data structures',
  ai: 'artificial intelligence',
  ml: 'machine learning',
  se: 'software engineering',
  'web dev': 'web development',
  'app dev': 'mobile development',
  db: 'database systems',
  os: 'operating systems',
  cn: 'computer networks',
  bio: 'biology',
  chem: 'chemistry',
  phys: 'physics',
  econ: 'economics',
  mgmt: 'business management',
};

/**
 * Validates and normalizes an array of skill tags against the allowed list and aliases.
 * Returns lowercase, deduplicated, valid tags.
 *
 * @param {any} tags - Raw input from the request body
 * @param {string} fieldName - Field name for error messages ('skillsTeaching' | 'skillsLearning')
 * @param {Function} AppError - AppError class for throwing
 * @returns {string[]} Validated, normalized tag array
 */
export function validateSkillTags(tags, fieldName, AppError) {
  if (!Array.isArray(tags)) {
    throw new AppError(`${fieldName} must be an array of strings.`, 400, 'VALIDATION_ERROR');
  }

  if (tags.length > 15) {
    throw new AppError(`${fieldName} cannot contain more than 15 tags.`, 400, 'VALIDATION_ERROR');
  }

  const normalized = tags.map((t) => {
    if (typeof t !== 'string') {
      throw new AppError(`Each tag in ${fieldName} must be a string.`, 400, 'VALIDATION_ERROR');
    }
    const clean = t.trim().toLowerCase();
    return SKILL_TAG_ALIASES[clean] || clean;
  });

  const invalid = normalized.filter((t) => {
    if (!t || t.length < 2 || t.length > 40) return true;
    if (ALLOWED_SKILL_TAGS.includes(t)) return false;
    // Allow custom campus/extracurricular skills with letters, numbers, spaces, +, #, -
    return !/^[a-z0-9+#\-\s]{2,40}$/.test(t);
  });

  if (invalid.length > 0) {
    throw new AppError(
      `Invalid skill tags in ${fieldName}: ${invalid.join(', ')}. Use GET /api/users/skills to see allowed tags.`,
      400,
      'INVALID_SKILL_TAG'
    );
  }

  // Deduplicate
  return [...new Set(normalized)];
}
