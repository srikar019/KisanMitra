import React from 'react';
import type { PesticideRiskLevel } from '../../types';

interface PesticideRiskBadgeProps {
    level: PesticideRiskLevel;
    className?: string;
}

const riskConfig: Record<PesticideRiskLevel, { icon: string; label: string; color: string; textColor: string }> = {
    minimal: { icon: '🟢', label: 'MINIMAL', color: 'bg-emerald-50', textColor: 'text-emerald-700' },
    low: { icon: '🟡', label: 'LOW', color: 'bg-lime-50', textColor: 'text-lime-700' },
    moderate: { icon: '🟠', label: 'MODERATE', color: 'bg-amber-50', textColor: 'text-amber-700' },
    high: { icon: '🔴', label: 'HIGH', color: 'bg-red-50', textColor: 'text-red-700' },
};

const PesticideRiskBadge: React.FC<PesticideRiskBadgeProps> = ({ level, className = '' }) => {
    const config = riskConfig[level];

    return (
        <div className={`flex items-center gap-1.5 ${className}`}>
            <span className="text-xs">{config.icon}</span>
            <span className={`text-[10px] font-black tracking-wide ${config.textColor}`}>
                Pesticide Risk: {config.label}
            </span>
        </div>
    );
};

export default PesticideRiskBadge;
