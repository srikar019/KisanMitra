import { describe, it, expect } from 'vitest';
import {
  validateRequired,
  validateNumber,
  validateEmail,
  validatePhone,
  sanitizeInput,
  validateAll,
  validateImageFile,
} from '../services/validationService';

describe('validateRequired', () => {
  it('should reject empty strings', () => {
    expect(validateRequired('', 'Name').isValid).toBe(false);
  });

  it('should reject whitespace-only strings', () => {
    expect(validateRequired('   ', 'Name').isValid).toBe(false);
  });

  it('should accept valid strings', () => {
    expect(validateRequired('John', 'Name').isValid).toBe(true);
  });

  it('should reject strings exceeding maxLength', () => {
    const result = validateRequired('A very long string', 'Name', 5);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('5');
  });

  it('should accept strings within maxLength', () => {
    expect(validateRequired('Hi', 'Name', 10).isValid).toBe(true);
  });
});

describe('validateNumber', () => {
  it('should reject NaN', () => {
    expect(validateNumber(NaN, 'Price').isValid).toBe(false);
  });

  it('should reject values below min', () => {
    const result = validateNumber(-1, 'Price', 0);
    expect(result.isValid).toBe(false);
  });

  it('should reject values above max', () => {
    const result = validateNumber(200, 'Quantity', 0, 100);
    expect(result.isValid).toBe(false);
  });

  it('should accept valid numbers', () => {
    expect(validateNumber(50, 'Price', 0, 100).isValid).toBe(true);
  });

  it('should accept boundary values', () => {
    expect(validateNumber(0, 'Price', 0, 100).isValid).toBe(true);
    expect(validateNumber(100, 'Price', 0, 100).isValid).toBe(true);
  });

  it('should work without min/max constraints', () => {
    expect(validateNumber(999999, 'Value').isValid).toBe(true);
  });
});

describe('validateEmail', () => {
  it('should accept valid emails', () => {
    expect(validateEmail('user@example.com').isValid).toBe(true);
    expect(validateEmail('test.name@domain.co.in').isValid).toBe(true);
  });

  it('should reject invalid emails', () => {
    expect(validateEmail('invalid').isValid).toBe(false);
    expect(validateEmail('missing@').isValid).toBe(false);
    expect(validateEmail('@nodomain.com').isValid).toBe(false);
    expect(validateEmail('').isValid).toBe(false);
  });
});

describe('validatePhone', () => {
  it('should accept valid Indian phone numbers', () => {
    expect(validatePhone('9876543210').isValid).toBe(true);
    expect(validatePhone('+919876543210').isValid).toBe(true);
  });

  it('should reject invalid phone numbers', () => {
    expect(validatePhone('123').isValid).toBe(false);
    expect(validatePhone('abcdefghij').isValid).toBe(false);
  });

  it('should reject empty phone numbers', () => {
    expect(validatePhone('').isValid).toBe(false);
  });
});

describe('sanitizeInput', () => {
  it('should escape HTML entities', () => {
    const result = sanitizeInput('<script>alert("xss")</script>');
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('should escape ampersands', () => {
    expect(sanitizeInput('AT&T')).toContain('&amp;');
  });

  it('should escape quotes', () => {
    expect(sanitizeInput('"hello"')).toContain('&quot;');
  });

  it('should handle plain text without changes', () => {
    expect(sanitizeInput('Hello World')).toBe('Hello World');
  });

  it('should preserve whitespace (sanitize only, no trim)', () => {
    expect(sanitizeInput('  hello  ')).toBe('  hello  ');
  });
});

describe('validateAll', () => {
  it('should return valid when all validations pass', () => {
    const result = validateAll(
      validateRequired('John', 'Name'),
      validateEmail('john@example.com'),
      validateNumber(100, 'Price', 0, 1000),
    );
    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should return the first error when a validation fails', () => {
    const result = validateAll(
      validateRequired('John', 'Name'),
      validateEmail('invalid-email'),
      validateNumber(100, 'Price', 0, 1000),
    );
    expect(result.isValid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should handle empty validations', () => {
    const result = validateAll();
    expect(result.isValid).toBe(true);
  });
});

describe('validateImageFile', () => {
  it('should accept valid image files', () => {
    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });
    expect(validateImageFile(file).isValid).toBe(true);
  });

  it('should accept PNG files', () => {
    const file = new File(['data'], 'image.png', { type: 'image/png' });
    expect(validateImageFile(file).isValid).toBe(true);
  });

  it('should reject non-image files', () => {
    const file = new File(['data'], 'document.pdf', { type: 'application/pdf' });
    expect(validateImageFile(file).isValid).toBe(false);
  });

  it('should reject files over 4MB', () => {
    // Create a file-like object > 4MB
    const largeData = new Array(5 * 1024 * 1024).fill('a').join('');
    const file = new File([largeData], 'large.jpg', { type: 'image/jpeg' });
    expect(validateImageFile(file).isValid).toBe(false);
  });
});
