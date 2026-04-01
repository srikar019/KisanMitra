import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { ToastProvider, useToast, ToastType } from '../contexts/ToastContext';

// Helper to render the hook within the provider
function renderToastHook() {
  return renderHook(() => useToast(), {
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(ToastProvider, null, children),
  });
}

describe('ToastContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should start with no toasts', () => {
    const { result } = renderToastHook();
    expect(result.current.toasts).toHaveLength(0);
  });

  it('should add a toast via showToast', () => {
    const { result } = renderToastHook();

    act(() => {
      result.current.showToast('Hello World');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Hello World');
    expect(result.current.toasts[0].type).toBe('info'); // default type
  });

  it('should support different toast types', () => {
    const { result } = renderToastHook();
    const types: ToastType[] = ['success', 'error', 'warning', 'info'];

    act(() => {
      types.forEach((type) => {
        result.current.showToast(`Test ${type}`, type);
      });
    });

    expect(result.current.toasts).toHaveLength(4);
    types.forEach((type, index) => {
      expect(result.current.toasts[index].type).toBe(type);
    });
  });

  it('should auto-remove toasts after duration', () => {
    const { result } = renderToastHook();

    act(() => {
      result.current.showToast('Temporary', 'info', 2000);
    });
    expect(result.current.toasts).toHaveLength(1);

    // Advance timer past the duration
    act(() => {
      vi.advanceTimersByTime(2100);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('should manually remove a toast via removeToast', () => {
    const { result } = renderToastHook();

    act(() => {
      result.current.showToast('Removable', 'info', 0); // duration 0 = no auto-remove
    });
    expect(result.current.toasts).toHaveLength(1);

    const toastId = result.current.toasts[0].id;
    act(() => {
      result.current.removeToast(toastId);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('should handle multiple toasts simultaneously', () => {
    const { result } = renderToastHook();

    act(() => {
      result.current.showToast('First');
      result.current.showToast('Second');
      result.current.showToast('Third');
    });

    expect(result.current.toasts).toHaveLength(3);
    expect(result.current.toasts.map((t) => t.message)).toEqual([
      'First',
      'Second',
      'Third',
    ]);
  });

  it('should generate unique IDs for each toast', () => {
    const { result } = renderToastHook();

    act(() => {
      result.current.showToast('A');
      result.current.showToast('B');
    });

    const ids = result.current.toasts.map((t) => t.id);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('should throw when useToast is used outside provider', () => {
    // This test verifies the error boundary in the hook
    expect(() => {
      renderHook(() => useToast());
    }).toThrow('useToast must be used within a ToastProvider');
  });

  it('should use default duration of 4000ms', () => {
    const { result } = renderToastHook();

    act(() => {
      result.current.showToast('Default duration');
    });

    // Should still be there before 4s
    act(() => {
      vi.advanceTimersByTime(3900);
    });
    expect(result.current.toasts).toHaveLength(1);

    // Should be gone after 4s
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.toasts).toHaveLength(0);
  });
});
