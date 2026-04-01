import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { LanguageProvider, useLanguage } from '../contexts/LanguageContext';

// Test component that uses the language context
const TestConsumer: React.FC = () => {
  const { language, setLanguage, translate } = useLanguage();
  return (
    <div>
      <span data-testid="language">{language}</span>
      <span data-testid="translated">{translate('weather.title')}</span>
      <span data-testid="missing-key">{translate('nonexistent.key')}</span>
      <span data-testid="with-params">{translate('weather.currentConditions', { location: 'Delhi' })}</span>
      <button data-testid="switch-hi" onClick={() => setLanguage('hi')}>Hindi</button>
      <button data-testid="switch-te" onClick={() => setLanguage('te')}>Telugu</button>
      <button data-testid="switch-en" onClick={() => setLanguage('en')}>English</button>
    </div>
  );
};

describe('LanguageContext', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = 'en';
  });

  it('should default to English', () => {
    render(
      <LanguageProvider>
        <TestConsumer />
      </LanguageProvider>,
    );
    expect(screen.getByTestId('language').textContent).toBe('en');
  });

  it('should translate known keys', () => {
    render(
      <LanguageProvider>
        <TestConsumer />
      </LanguageProvider>,
    );
    expect(screen.getByTestId('translated').textContent).toBe('AI Weather Forecast');
  });

  it('should return the key itself for unknown translation keys', () => {
    render(
      <LanguageProvider>
        <TestConsumer />
      </LanguageProvider>,
    );
    expect(screen.getByTestId('missing-key').textContent).toBe('nonexistent.key');
  });

  it('should interpolate parameters in translations', () => {
    render(
      <LanguageProvider>
        <TestConsumer />
      </LanguageProvider>,
    );
    expect(screen.getByTestId('with-params').textContent).toContain('Delhi');
  });

  it('should switch language to Hindi', () => {
    render(
      <LanguageProvider>
        <TestConsumer />
      </LanguageProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByTestId('switch-hi'));
    });

    expect(screen.getByTestId('language').textContent).toBe('hi');
    expect(screen.getByTestId('translated').textContent).not.toBe('AI Weather Forecast');
  });

  it('should switch language to Telugu', () => {
    render(
      <LanguageProvider>
        <TestConsumer />
      </LanguageProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByTestId('switch-te'));
    });

    expect(screen.getByTestId('language').textContent).toBe('te');
  });

  it('should persist language preference to localStorage', () => {
    render(
      <LanguageProvider>
        <TestConsumer />
      </LanguageProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByTestId('switch-hi'));
    });

    expect(localStorage.getItem('language')).toBe('hi');
  });

  it('should update document lang attribute', () => {
    render(
      <LanguageProvider>
        <TestConsumer />
      </LanguageProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByTestId('switch-te'));
    });

    expect(document.documentElement.lang).toBe('te');
  });

  it('should switch back to English', () => {
    render(
      <LanguageProvider>
        <TestConsumer />
      </LanguageProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByTestId('switch-hi'));
    });
    act(() => {
      fireEvent.click(screen.getByTestId('switch-en'));
    });

    expect(screen.getByTestId('language').textContent).toBe('en');
    expect(screen.getByTestId('translated').textContent).toBe('AI Weather Forecast');
  });
});
