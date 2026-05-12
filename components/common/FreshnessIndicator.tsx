import React from 'react';

interface FreshnessIndicatorProps {
    createdAt?: Date;
    className?: string;
}

const FreshnessIndicator: React.FC<FreshnessIndicatorProps> = ({ createdAt, className = '' }) => {
    if (!createdAt) return null;

    const now = new Date();
    const daysSinceHarvest = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

    let fillPercent: number;
    let label: string;
    let colorClass: string;

    if (daysSinceHarvest <= 2) {
        fillPercent = 90;
        label = `Listed ${daysSinceHarvest || '<1'} day${daysSinceHarvest !== 1 ? 's' : ''} ago — RECENT`;
        colorClass = 'bg-emerald-500';
    } else if (daysSinceHarvest <= 5) {
        fillPercent = 65;
        label = `Listed ${daysSinceHarvest} days ago`;
        colorClass = 'bg-green-400';
    } else if (daysSinceHarvest <= 8) {
        fillPercent = 40;
        label = `Listed ${daysSinceHarvest} days ago`;
        colorClass = 'bg-yellow-400';
    } else {
        fillPercent = 20;
        label = `Listed ${daysSinceHarvest}+ days ago`;
        colorClass = 'bg-orange-400';
    }

    return (
        <div className={`${className}`}>
            <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Listing Age</span>
            </div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-700 ${colorClass}`}
                    style={{ width: `${fillPercent}%` }}
                />
            </div>
            <p className="text-[10px] font-bold text-gray-500 mt-1">{label}</p>
        </div>
    );
};

export default FreshnessIndicator;
