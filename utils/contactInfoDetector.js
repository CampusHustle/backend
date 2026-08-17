/**
 * Detects contact information in a message string (FR-8).
 * Flags phone numbers, Telegram handles, and email addresses.
 * Used for audit logging — admins can review flagged messages (NFR-9).
 *
 * Mitigates Repudiation (STRIDE): users cannot deny sharing contact info
 * since all flagged messages are timestamped and persisted.
 *
 * @param {string} content - Raw message text
 * @returns {boolean} true if any contact info pattern is detected
 */
export function containsContactInfo(content) {
  if (typeof content !== 'string' || !content.trim()) return false;

  const patterns = [
    // Ethiopian & international phone numbers (7–15 digits, optional + or 00 prefix, optional spaces/dashes)
    /(?:\+|00)?[\d][\d\s\-]{6,14}\d/,

    // Telegram handles: @username (3–32 chars, letters/digits/underscores)
    /@[a-zA-Z0-9_]{3,32}/,

    // Email addresses
    /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/,

    // Telegram links
    /t(?:elegram)?\.me\/[a-zA-Z0-9_]{3,}/i,

    // WhatsApp mentions
    /whatsapp/i
  ];

  return patterns.some((pattern) => pattern.test(content));
}
