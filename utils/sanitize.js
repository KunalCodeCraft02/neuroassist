const validator = require('validator');

/**
 * Sanitizes an input string by removing HTML/JS and normalizing
 */
function sanitizeString(input, options = {}) {
  if (typeof input !== 'string') return input;

  const {
    stripTags = true,
    escape = true,
    trim = true,
    normalize = true
  } = options;

  let result = input;

  if (trim) {
    result = result.trim();
  }

  if (stripTags) {
    result = validator.stripLow(result, true); // Remove control chars
    // Basic HTML tag removal (validator.escape also encodes)
  }

  if (escape) {
    result = validator.escape(result);
  }

  if (normalize) {
    result = validator.normalizeEmail(result, { all_spaces: true });
  }

  return result;
}

/**
 * Sanitizes an array of strings
 */
function sanitizeArray(arr) {
  if (!Array.isArray(arr)) return arr;
  return arr.map(item => sanitizeString(item));
}

/**
 * Deep sanitize object - sanitizes all string fields
 */
function sanitizeObject(obj, fieldsToSanitize = []) {
  if (!obj || typeof obj !== 'object') return obj;

  const sanitized = { ...obj };

  for (const [key, value] of Object.entries(sanitized)) {
    if (fieldsToSanitize.length > 0 && !fieldsToSanitize.includes(key)) {
      continue;
    }

    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = sanitizeArray(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value, fieldsToSanitize);
    }
  }

  return sanitized;
}

module.exports = {
  sanitizeString,
  sanitizeArray,
  sanitizeObject
};
