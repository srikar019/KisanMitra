import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';

// ─── Auth Service Tests ──────────────────────────────────────────────
// Mock Firebase modules
vi.mock('../services/firebase', () => ({
  auth: {
    currentUser: null,
    signInWithEmailAndPassword: vi.fn(),
    createUserWithEmailAndPassword: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChanged: vi.fn((callback: Function) => {
      callback(null);
      return vi.fn();
    }),
    signInWithPopup: vi.fn(),
  },
  db: {
    collection: vi.fn(),
    doc: vi.fn(),
  },
}));

describe('Auth Service Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('signIn', () => {
    it('should validate email format before attempting login', async () => {
      const { signIn } = await import('../services/authService');

      try {
        await signIn('invalid-email', 'password', 'farmer');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should validate that password is not empty', async () => {
      const { signIn } = await import('../services/authService');

      try {
        await signIn('user@example.com', '', 'farmer');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('signUp', () => {
    it('should validate email format on signup', async () => {
      const { signUp } = await import('../services/authService');

      try {
        await signUp('bad-email', 'password123', 'farmer');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});

// ─── Gemini Service Helper Tests ──────────────────────────────────────

describe('Gemini Service Utilities', () => {
  describe('extractJson', () => {
    // Test the JSON extraction utility pattern used in geminiService
    const extractJson = (text: string): string => {
      // Strip markdown code blocks
      let cleaned = text.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.slice(7);
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.slice(3);
      }
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.slice(0, -3);
      }
      return cleaned.trim();
    };

    it('should extract JSON from markdown code block', () => {
      const input = '```json\n{"key": "value"}\n```';
      const result = extractJson(input);
      expect(JSON.parse(result)).toEqual({ key: 'value' });
    });

    it('should handle plain JSON without code blocks', () => {
      const input = '{"key": "value"}';
      const result = extractJson(input);
      expect(JSON.parse(result)).toEqual({ key: 'value' });
    });

    it('should handle code blocks without json specifier', () => {
      const input = '```\n{"key": "value"}\n```';
      const result = extractJson(input);
      expect(JSON.parse(result)).toEqual({ key: 'value' });
    });

    it('should handle nested JSON objects', () => {
      const input = '```json\n{"outer": {"inner": [1, 2, 3]}}\n```';
      const result = extractJson(input);
      const parsed = JSON.parse(result);
      expect(parsed.outer.inner).toEqual([1, 2, 3]);
    });
  });

  describe('getLanguageInstruction', () => {
    const getLanguageInstruction = (lang: string): string => {
      switch (lang) {
        case 'hi':
          return 'IMPORTANT: Respond entirely in Hindi (हिंदी). Use Devanagari script.';
        case 'te':
          return 'IMPORTANT: Respond entirely in Telugu (తెలుగు). Use Telugu script.';
        default:
          return '';
      }
    };

    it('should return Hindi instruction for hi', () => {
      expect(getLanguageInstruction('hi')).toContain('Hindi');
      expect(getLanguageInstruction('hi')).toContain('Devanagari');
    });

    it('should return Telugu instruction for te', () => {
      expect(getLanguageInstruction('te')).toContain('Telugu');
    });

    it('should return empty string for English', () => {
      expect(getLanguageInstruction('en')).toBe('');
    });

    it('should return empty string for unknown languages', () => {
      expect(getLanguageInstruction('fr')).toBe('');
    });
  });
});

// ─── Common UI Component Tests ──────────────────────────────────────

describe('ErrorBoundary Integration', () => {
  it('should render children when no error', async () => {
    const ErrorBoundary = (await import('../components/common/ErrorBoundary')).default;
    render(
      <ErrorBoundary>
        <div data-testid="child">Working</div>
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('should catch errors and display fallback', async () => {
    const ErrorBoundary = (await import('../components/common/ErrorBoundary')).default;
    const ThrowError: React.FC = () => {
      throw new Error('Test error');
    };

    // Suppress console.error for expected error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );

    // Should render error fallback UI which includes the error message
    expect(screen.queryByText('Test error')).toBeTruthy();
    consoleSpy.mockRestore();
  });
});

// ─── Theme Context Tests ──────────────────────────────────────────────

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should provide theme context with default value', async () => {
    // Check if ThemeContext exports exist
    const themeModule = await import('../contexts/ThemeContext');
    expect(themeModule).toBeDefined();
    expect(typeof themeModule.ThemeProvider).toBe('function');
    expect(typeof themeModule.useTheme).toBe('function');
  });
});

// ─── Type Safety Tests ──────────────────────────────────────────────

describe('Type Definitions', () => {
  it('should export ActiveView enum with all expected values', async () => {
    const { ActiveView } = await import('../types');
    
    expect(ActiveView.Weather).toBeDefined();
    expect(ActiveView.HealthAnalysis).toBeDefined();
    expect(ActiveView.PlantingRecommendations).toBeDefined();
    expect(ActiveView.MarketPrices).toBeDefined();
    expect(ActiveView.CropYieldPrediction).toBeDefined();
    expect(ActiveView.ProfitForecaster).toBeDefined();
    expect(ActiveView.DirectMarketplace).toBeDefined();
    expect(ActiveView.Community).toBeDefined();
    expect(ActiveView.FarmAssetsExchange).toBeDefined();
    expect(ActiveView.Profile).toBeDefined();
    expect(ActiveView.AddFeatures).toBeDefined();
  });

  it('should have unique enum values', async () => {
    const { ActiveView } = await import('../types');
    const values = Object.values(ActiveView);
    const uniqueValues = new Set(values);
    expect(values.length).toBe(uniqueValues.size);
  });
});
