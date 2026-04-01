import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock all heavy dependencies before importing components
vi.mock('../services/firebase', () => ({
  firestore: {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ exists: false }),
        set: vi.fn().mockResolvedValue(undefined),
        onSnapshot: vi.fn(() => vi.fn()),
      }),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      onSnapshot: vi.fn(() => vi.fn()),
      add: vi.fn().mockResolvedValue({ id: 'mock-id' }),
    }),
  },
  auth: {
    currentUser: null,
    onAuthStateChanged: vi.fn((callback: Function) => {
      callback(null);
      return vi.fn();
    }),
  },
}));

vi.mock('../services/authService', () => ({
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(),
  loginWithGoogle: vi.fn(),
}));

// ─── ErrorBoundary Tests ─────────────────────────────────────────────

describe('ErrorBoundary', () => {
  it('should render children when no error', async () => {
    const { default: ErrorBoundary } = await import('../components/common/ErrorBoundary');
    
    render(
      <ErrorBoundary>
        <div data-testid="child">Safe Content</div>
      </ErrorBoundary>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Safe Content')).toBeInTheDocument();
  });

  it('should catch errors and display fallback UI', async () => {
    const { default: ErrorBoundary } = await import('../components/common/ErrorBoundary');

    const ThrowingComponent = () => {
      throw new Error('Test crash');
    };

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    consoleSpy.mockRestore();
  });
});

// ─── Common UI Component Tests ───────────────────────────────────────

describe('Spinner', () => {
  it('should render without crashing', async () => {
    const { default: Spinner } = await import('../components/common/Spinner');
    const { container } = render(<Spinner />);
    expect(container.firstChild).toBeInTheDocument();
  });
});

describe('Card', () => {
  it('should render children', async () => {
    const { default: Card } = await import('../components/common/Card');
    render(
      <Card>
        <p data-testid="card-child">Card Content</p>
      </Card>
    );
    expect(screen.getByTestId('card-child')).toBeInTheDocument();
  });
});

describe('Button', () => {
  it('should render with text and be clickable', async () => {
    const { default: Button } = await import('../components/common/Button');
    const onClick = vi.fn();
    
    render(<Button onClick={onClick}>Click Me</Button>);

    const button = screen.getByText('Click Me');
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('should respect disabled state', async () => {
    const { default: Button } = await import('../components/common/Button');
    const onClick = vi.fn();
    
    render(<Button onClick={onClick} disabled>Disabled</Button>);

    const button = screen.getByText('Disabled');
    expect(button).toBeDisabled();
  });
});

describe('Icon', () => {
  it('should render an icon element', async () => {
    const { default: Icon } = await import('../components/common/Icon');
    const { container } = render(<Icon name="check" className="test-icon" />);
    expect(container.firstChild).toBeInTheDocument();
  });
});

// ─── Modal Tests ─────────────────────────────────────────────────────

describe('Modal', () => {
  it('should render when isOpen is true', async () => {
    const { default: Modal } = await import('../components/common/Modal');
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
        <p>Modal Body</p>
      </Modal>
    );

    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('Modal Body')).toBeInTheDocument();
  });

  it('should not render when isOpen is false', async () => {
    const { default: Modal } = await import('../components/common/Modal');
    render(
      <Modal isOpen={false} onClose={vi.fn()} title="Hidden">
        <p>Invisible</p>
      </Modal>
    );

    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  });
});
