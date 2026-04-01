import React from 'react';

interface SkeletonProps {
  /** Width of the skeleton. Accepts any CSS width value. */
  width?: string;
  /** Height of the skeleton. Accepts any CSS height value. */
  height?: string;
  /** Makes the skeleton a circle (for avatars). */
  circle?: boolean;
  /** Number of skeleton lines to render. */
  count?: number;
  /** Additional CSS classes. */
  className?: string;
}

/**
 * Skeleton placeholder component for content-aware loading states.
 * Replaces generic spinners with layout-matching placeholders.
 *
 * Usage:
 *   <Skeleton width="200px" height="20px" />
 *   <Skeleton circle width="48px" height="48px" />
 *   <Skeleton count={3} height="16px" />
 */
const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '16px',
  circle = false,
  count = 1,
  className = '',
}) => {
  const baseClasses = `animate-pulse bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 bg-[length:200%_100%] ${className}`;

  const style: React.CSSProperties = {
    width,
    height,
    borderRadius: circle ? '50%' : '8px',
  };

  if (count === 1) {
    return <div className={baseClasses} style={style} aria-hidden="true" />;
  }

  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={baseClasses}
          style={{
            ...style,
            // Last line is shorter for a natural look
            width: i === count - 1 ? '75%' : width,
          }}
        />
      ))}
    </div>
  );
};

/** Pre-built skeleton for card layouts */
export const CardSkeleton: React.FC = () => (
  <div className="bg-white rounded-lg border border-gray-200 shadow-md overflow-hidden p-4 space-y-4">
    <Skeleton height="180px" />
    <Skeleton width="60%" height="24px" />
    <Skeleton count={2} height="14px" />
    <div className="flex justify-between items-center pt-2">
      <Skeleton width="80px" height="28px" />
      <Skeleton width="100px" height="36px" />
    </div>
  </div>
);

/** Pre-built skeleton for list item rows */
export const ListSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 p-3 bg-white rounded-lg border">
        <Skeleton circle width="40px" height="40px" />
        <div className="flex-1 space-y-2">
          <Skeleton width="40%" height="16px" />
          <Skeleton width="70%" height="12px" />
        </div>
      </div>
    ))}
  </div>
);

export default Skeleton;
