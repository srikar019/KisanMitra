import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import SafeHTML from '../components/common/SafeHTML';
import Skeleton, { CardSkeleton, ListSkeleton } from '../components/common/Skeleton';

// ─── SafeHTML Tests ──────────────────────────────────────────────────

describe('SafeHTML', () => {
  it('should render plain text', () => {
    render(<SafeHTML html="Hello World" />);
    expect(screen.getByText('Hello World')).toBeTruthy();
  });

  it('should render allowed HTML tags (strong, em)', () => {
    const { container } = render(<SafeHTML html="<strong>Bold</strong> and <em>italic</em>" />);
    const strong = container.querySelector('strong');
    const em = container.querySelector('em');
    expect(strong).toBeTruthy();
    expect(strong?.textContent).toBe('Bold');
    expect(em).toBeTruthy();
    expect(em?.textContent).toBe('italic');
  });

  it('should strip disallowed HTML tags (script, img, iframe)', () => {
    const { container } = render(
      <SafeHTML html='Hello <script>alert("xss")</script> <img src="x" onerror="alert(1)"> <iframe src="evil.com"></iframe> World' />,
    );
    expect(container.innerHTML).not.toContain('<script');
    expect(container.innerHTML).not.toContain('<img');
    expect(container.innerHTML).not.toContain('<iframe');
    expect(container.textContent).toContain('Hello');
    expect(container.textContent).toContain('World');
  });

  it('should strip disallowed attributes', () => {
    const { container } = render(
      <SafeHTML html='<strong onclick="alert(1)" style="color:red" class="text-bold">Test</strong>' />,
    );
    const strong = container.querySelector('strong');
    expect(strong).toBeTruthy();
    expect(strong?.getAttribute('onclick')).toBeNull();
    expect(strong?.getAttribute('style')).toBeNull();
    expect(strong?.getAttribute('class')).toBe('text-bold');
  });

  it('should prevent javascript: URLs in href attributes', () => {
    const { container } = render(
      <SafeHTML html='<a href="javascript:alert(1)">Click</a>' />,
    );
    const link = container.querySelector('a');
    expect(link).toBeTruthy();
    expect(link?.getAttribute('href')).toBeNull();
  });

  it('should allow safe href attributes', () => {
    const { container } = render(
      <SafeHTML html='<a href="https://example.com" target="_blank">Safe Link</a>' />,
    );
    const link = container.querySelector('a');
    expect(link).toBeTruthy();
    expect(link?.getAttribute('href')).toBe('https://example.com');
  });

  it('should render with custom element type', () => {
    const { container } = render(<SafeHTML html="Paragraph" as="p" />);
    expect(container.querySelector('p')).toBeTruthy();
  });

  it('should apply className', () => {
    const { container } = render(<SafeHTML html="Styled" className="text-red-500" />);
    expect(container.firstElementChild?.classList.contains('text-red-500')).toBe(true);
  });

  it('should default to span element', () => {
    const { container } = render(<SafeHTML html="Default" />);
    expect(container.querySelector('span')).toBeTruthy();
  });
});

// ─── Skeleton Tests ──────────────────────────────────────────────────

describe('Skeleton', () => {
  it('should render a single skeleton by default', () => {
    const { container } = render(<Skeleton />);
    const skeleton = container.firstElementChild as HTMLElement;
    expect(skeleton).toBeTruthy();
    expect(skeleton.getAttribute('aria-hidden')).toBe('true');
  });

  it('should render multiple lines with count prop', () => {
    const { container } = render(<Skeleton count={3} />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    // 3 skeleton lines
    expect(skeletons.length).toBe(3);
  });

  it('should apply circle style', () => {
    const { container } = render(<Skeleton circle width="48px" height="48px" />);
    const skeleton = container.firstElementChild as HTMLElement;
    expect(skeleton.style.borderRadius).toBe('50%');
  });

  it('should apply custom width and height', () => {
    const { container } = render(<Skeleton width="200px" height="32px" />);
    const skeleton = container.firstElementChild as HTMLElement;
    expect(skeleton.style.width).toBe('200px');
    expect(skeleton.style.height).toBe('32px');
  });

  it('should apply custom className', () => {
    const { container } = render(<Skeleton className="custom-class" />);
    expect(container.firstElementChild?.classList.contains('custom-class')).toBe(true);
  });
});

describe('CardSkeleton', () => {
  it('should render a card-shaped skeleton', () => {
    const { container } = render(<CardSkeleton />);
    expect(container.firstElementChild).toBeTruthy();
    expect(container.querySelector('.bg-white')).toBeTruthy();
  });
});

describe('ListSkeleton', () => {
  it('should render default 5 rows', () => {
    const { container } = render(<ListSkeleton />);
    const rows = container.querySelectorAll('.flex.items-center');
    expect(rows.length).toBe(5);
  });

  it('should render custom number of rows', () => {
    const { container } = render(<ListSkeleton rows={3} />);
    const rows = container.querySelectorAll('.flex.items-center');
    expect(rows.length).toBe(3);
  });
});
