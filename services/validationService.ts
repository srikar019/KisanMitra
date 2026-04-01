/**
 * Input Validation Utilities
 * Centralized validation helpers to ensure data integrity across the application.
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates that a required string field is non-empty and within length limits.
 */
export const validateRequired = (value: string | undefined | null, fieldName: string, maxLength = 500): ValidationResult => {
  if (!value || value.trim().length === 0) {
    return { isValid: false, error: `${fieldName} is required.` };
  }
  if (value.trim().length > maxLength) {
    return { isValid: false, error: `${fieldName} must be ${maxLength} characters or less.` };
  }
  return { isValid: true };
};

/**
 * Validates a numeric input is within acceptable range.
 */
export const validateNumber = (value: number | undefined | null, fieldName: string, min = 0, max = 1_000_000): ValidationResult => {
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
 * Validates an email format.
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
 * Validates phone number (Indian format support).
 */
export const validatePhone = (phone: string | undefined | null): ValidationResult => {
  if (!phone || phone.trim().length === 0) {
    return { isValid: false, error: 'Phone number is required.' };
  }
  // Supports: +91XXXXXXXXXX, 91XXXXXXXXXX, 0XXXXXXXXXX, XXXXXXXXXX
  const phoneRegex = /^(\+?91|0)?\d{10}$/;
  if (!phoneRegex.test(phone.replace(/[\s-]/g, ''))) {
    return { isValid: false, error: 'Please enter a valid 10-digit phone number.' };
  }
  return { isValid: true };
};

/**
 * Validates image file (type and size).
 */
export const validateImageFile = (file: File | null, maxSizeMB = 4): ValidationResult => {
  if (!file) {
    return { isValid: false, error: 'Please select an image file.' };
  }
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    return { isValid: false, error: 'Invalid file type. Please use JPG, PNG, WebP, or GIF.' };
  }
  if (file.size > maxSizeMB * 1024 * 1024) {
    return { isValid: false, error: `File size must be under ${maxSizeMB}MB.` };
  }
  return { isValid: true };
};

/**
 * Validates a price value.
 */
export const validatePrice = (price: number | undefined | null, currency = 'INR'): ValidationResult => {
  const result = validateNumber(price, 'Price', 0.01, 10_000_000);
  if (!result.isValid) return result;
  return { isValid: true };
};

/**
 * Validates a location string.
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
 * Runs multiple validations and returns the first error, or a success result.
 */
export const validateAll = (...results: ValidationResult[]): ValidationResult => {
  for (const result of results) {
    if (!result.isValid) return result;
  }
  return { isValid: true };
};

/**
 * Sanitizes a string to prevent basic XSS in user-supplied content.
 */
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};
