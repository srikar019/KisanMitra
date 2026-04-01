import React, { useState } from 'react';
import AgriSwap from './BarterExchange';
import LivestockManagement from './LivestockManagement';
// FIX: Changed to a named import to match the updated export in FarmMachinerySharing.tsx.
import { FarmMachinerySharing } from './FarmMachinerySharing';
import Icon from './common/Icon';
import { useLanguage } from '../contexts/LanguageContext';

type AssetView = 'exchange' | 'livestock' | 'machinery';

interface FarmAssetsExchangeProps {
}

const FarmAssetsExchange: React.FC<FarmAssetsExchangeProps> = () => {
    const { translate } = useLanguage();
    const [activeView, setActiveView] = useState<AssetView>('exchange');

    return (
        <div>
            <div className="mb-6 bg-white p-2 rounded-lg shadow-sm border inline-block">
                <div className="flex items-center space-x-1">
                    <button
                        onClick={() => setActiveView('exchange')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
                            activeView === 'exchange'
                                ? 'bg-green-600 text-white shadow'
                                : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        <Icon name="arrows-right-left" className="h-5 w-5" />
                        {translate('assets.tabs.exchange')}
                    </button>
                     <button
                        onClick={() => setActiveView('livestock')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
                            activeView === 'livestock'
                                ? 'bg-green-600 text-white shadow'
                                : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        <Icon name="livestock" className="h-5 w-5" />
                        {translate('assets.tabs.livestock')}
                    </button>
                    <button
                        onClick={() => setActiveView('machinery')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
                            activeView === 'machinery'
                                ? 'bg-green-600 text-white shadow'
                                : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        <Icon name="truck" className="h-5 w-5" />
                        {translate('assets.tabs.machinery')}
                    </button>
                </div>
            </div>

            <div className="animate-fade-in">
                {activeView === 'exchange' ? <AgriSwap /> : activeView === 'livestock' ? <LivestockManagement /> : <FarmMachinerySharing />}
            </div>
        </div>
    );
};

export default FarmAssetsExchange;
