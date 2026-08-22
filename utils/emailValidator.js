import { config } from '../config/env.js';

/**
 * Validates if an email address belongs to a recognized university domain.
 * Mitigates Spoofing (STRIDE) by preventing registration with arbitrary email domains.
 * @param {string} email
 * @returns {boolean}
 */
export function isUniversityEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return config.universityEmailRegex.test(email.trim());
}

/**
 * Validates a general email address format for non-student operational accounts.
 * @param {string} email
 * @returns {boolean}
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
