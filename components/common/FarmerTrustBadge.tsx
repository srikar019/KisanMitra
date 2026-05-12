import React from 'react';
import type { VerificationLevel } from '../../types';

interface FarmerTrustBadgeProps {
    level: VerificationLevel;
    size?: 'sm' | 'md';
    className?: string;
}

const badgeConfig: Record<VerificationLevel, { icon: string; label: string; colors: string }> = {
    basic: {
        icon: '👤',
        label: 'REGISTERED',
        colors: 'bg-gray-100 text-gray-500 border-gray-200',
    },
    verified: {
        icon: '✅',
        label: 'VERIFIED',
        colors: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    certified: {
        icon: '🌿',
        label: 'CERTIFIED ORGANIC',
        colors: 'bg-green-50 text-green-700 border-green-200',
    },
    premium: {
        icon: '💎',
        label: 'PREMIUM GROWER',
        colors: 'bg-amber-50 text-amber-700 border-amber-200',
    },
};

const FarmerTrustBadge: React.FC<FarmerTrustBadgeProps> = ({ level, size = 'sm', className = '' }) => {
    const config = badgeConfig[level] || badgeConfig.basic;
    const sizeClasses = size === 'sm'
        ? 'text-[9px] px-2 py-0.5 gap-1'
        : 'text-[11px] px-3 py-1 gap-1.5';

    return (
        <span
            className={`inline-flex items-center font-black tracking-wider uppercase rounded-full border ${config.colors} ${sizeClasses} ${className}`}
        >
            <span>{config.icon}</span>
            {config.label}
        </span>
    );
};

export default FarmerTrustBadge;
