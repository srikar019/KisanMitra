/**
 * Server-side Validation Middleware
 * Validates all incoming requests to Cloud Functions before processing
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates that a required string field is non-empty and within length limits
 */
export const validateRequired = (
  value: string | undefined | null,
  fieldName: string,
  maxLength = 500
): ValidationResult => {
  if (!value || value.trim().length === 0) {
    return { isValid: false, error: `${fieldName} is required.` };
  }
  if (value.trim().length > maxLength) {
    return { isValid: false, error: `${fieldName} must be ${maxLength} characters or less.` };
  }
  return { isValid: true };
};

/**
 * Validates a numeric input is within acceptable range
 */
export const validateNumber = (
  value: number | undefined | null,
  fieldName: string,
  min = 0,
  max = 1_000_000
): ValidationResult => {
  if (value === undefined || value === null || isNaN(value)) {
    return { isValid: false, error: `${fieldName} must be a valid number.` };
  }
  if (value < min) {
    return { isValid: false, error: `${fieldName} must be at least ${min}.` };
  }
  if (value > max) {
    return { isValid: false, error: `${fieldName} must be no more than ${max}.` };
  }
  return { isValid: true };
};

/**
 * Validates an email format
 */
export const validateEmail = (email: string | undefined | null): ValidationResult => {
  if (!email || email.trim().length === 0) {
    return { isValid: false, error: 'Email is required.' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return { isValid: false, error: 'Please enter a valid email address.' };
  }
  return { isValid: true };
};

/**
 * Validates location string
 */
export const validateLocation = (location: string | undefined | null): ValidationResult => {
  if (!location || location.trim().length < 2) {
    return { isValid: false, error: 'Please enter a valid location (at least 2 characters).' };
  }
  if (location.trim().length > 200) {
    return { isValid: false, error: 'Location must be 200 characters or less.' };
  }
  return { isValid: true };
};

/**
 * Validates image data (base64)
 */
export const validateImageData = (imageData: string | undefined | null): ValidationResult => {
  if (!imageData || imageData.length === 0) {
    return { isValid: false, error: 'Image data is required.' };
  }
  
  // Check if it's valid base64
  const base64Regex = /^[A-Za-z0-9+/=]+$/;
  if (!base64Regex.test(imageData)) {
    return { isValid: false, error: 'Invalid image data format.' };
  }
  
  // Check size (max 4MB in base64)
  const sizeInBytes = (imageData.length * 3) / 4;
  const maxSize = 4 * 1024 * 1024; // 4MB
  if (sizeInBytes > maxSize) {
    return { isValid: false, error: 'Image size exceeds 4MB limit.' };
  }
  
  return { isValid: true };
};

/**
 * Validates MIME type
 */
export const validateMimeType = (mimeType: string | undefined | null): ValidationResult => {
  if (!mimeType) {
    return { isValid: false, error: 'MIME type is required.' };
  }
  
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(mimeType)) {
    return { isValid: false, error: 'Invalid image type. Only JPEG, PNG, WebP, and GIF are allowed.' };
  }
  
  return { isValid: true };
};

/**
 * Validates language code
 */
export const validateLanguage = (language: string | undefined | null): ValidationResult => {
  if (!language) {
    return { isValid: true }; // Optional, defaults to 'en'
  }
  
  const allowedLanguages = ['en', 'hi', 'te'];
  if (!allowedLanguages.includes(language)) {
    return { isValid: false, error: 'Invalid language code. Must be one of: en, hi, te.' };
  }
  
  return { isValid: true };
};

/**
 * Runs multiple validations and returns the first error, or success
 */
export const validateAll = (...results: ValidationResult[]): ValidationResult => {
  for (const result of results) {
    if (!result.isValid) return result;
  }
  return { isValid: true };
};

/**
 * Sanitizes string input to prevent XSS
 */
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};

/**
 * Rate limiting helper - checks if user has exceeded rate limit
 */
export const checkRateLimit = (
  userCalls: Map<string, number[]>,
  userId: string,
  maxCallsPerMinute: number = 20
): ValidationResult => {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;
  
  // Get user's recent calls
  const calls = userCalls.get(userId) || [];
  
  // Filter to only calls in last minute
  const recentCalls = calls.filter(timestamp => timestamp > oneMinuteAgo);
  
  // Update stored calls
  userCalls.set(userId, [...recentCalls, now]);
  
  // Check if exceeded
  if (recentCalls.length >= maxCallsPerMinute) {
    return { isValid: false, error: 'Rate limit exceeded. Please try again in a minute.' };
  }
  
  return { isValid: true };
};
