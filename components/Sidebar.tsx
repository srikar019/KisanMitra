import React from 'react';
import { ActiveView } from '../types';
import Icon from './common/Icon';
import { useLanguage } from '../contexts/LanguageContext';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  enabledFeatures: ActiveView[];
}

const navIcons: { [key in ActiveView]?: string } = {
  [ActiveView.Weather]: 'sun',
  [ActiveView.HealthAnalysis]: 'shield-check',
  [ActiveView.PlantingRecommendations]: 'light-bulb',
  [ActiveView.MarketPrices]: 'chart-bar',
  [ActiveView.CropYieldPrediction]: 'trending-up',
  [ActiveView.ProfitForecaster]: 'calculator',
  [ActiveView.DirectMarketplace]: 'shopping-bag',
  [ActiveView.Community]: 'users',
  [ActiveView.FarmAssetsExchange]: 'collection',
  [ActiveView.Profile]: 'user-circle',
  [ActiveView.AddFeatures]: 'sparkles',
  [ActiveView.IndianAgriNews]: 'newspaper',
  [ActiveView.CSAManagement]: 'collection',
  [ActiveView.MyDeals]: 'tag',
  [ActiveView.MyFarm]: 'clipboard-list',
};


const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen, activeView, setActiveView, enabledFeatures }) => {
   const { translate } = useLanguage();
   const navItems = (enabledFeatures || [])
    .filter(view => view !== ActiveView.Profile && view !== ActiveView.AddFeatures && view !== ActiveView.IndianAgriNews && view !== ActiveView.MyDeals && view !== ActiveView.MyFarm)
    .sort((a, b) => {
        if (a === ActiveView.Weather) return -1;
        if (b === ActiveView.Weather) return 1;
        return a.localeCompare(b);
    });


  const handleItemClick = (view: ActiveView) => {
    setActiveView(view);
    setIsOpen(false); // Close sidebar on selection
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/60 z-30 transition-opacity ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />
      
      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full bg-gray-800 shadow-lg z-40 transition-transform duration-300 ease-in-out transform w-64
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sidebar-title"
      >
        <div className="flex flex-col h-full">
            {/* Header section of sidebar */}
            <div className="p-4 flex items-center justify-between border-b border-gray-700 flex-shrink-0">
                <h2 id="sidebar-title" className="text-lg font-semibold text-white">
                    {translate('sidebar.navigation')}
                </h2>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => handleItemClick(ActiveView.Profile)}
                        className={`p-2 rounded-full transition-colors ${
                            activeView === ActiveView.Profile
                            ? 'bg-green-600 text-white'
                            : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                        }`}
                        aria-label={translate(ActiveView.Profile)}
                        title={translate(ActiveView.Profile)}
                    >
                        <Icon name="user-circle" className="h-6 w-6" />
                    </button>
                    <button onClick={() => setIsOpen(false)} className="p-1 rounded-full hover:bg-gray-700" aria-label="Close menu">
                        <Icon name="x-mark" className="h-6 w-6 text-gray-400" />
                    </button>
                </div>
            </div>

            {/* Scrollable Navigation links */}
            <nav className="flex-grow overflow-y-auto p-4 no-scrollbar">
                <ul className="space-y-2">
                    {navItems.map((view) => (
                        <li key={view}>
                            <button
                                onClick={() => handleItemClick(view)}
                                className={`flex items-center w-full p-3 rounded-lg text-left transition-colors duration-200 ${
                                    activeView === view
                                    ? 'bg-green-600 text-white font-semibold'
                                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                }`}
                                title={translate(view)}
                            >
                                <Icon name={navIcons[view]!} className="h-6 w-6 flex-shrink-0" />
                                <span className="ml-4 text-sm font-medium">{translate(view)}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>
            
            {/* Bottom Fixed Section */}
            <div className="p-4 border-t border-gray-700 flex-shrink-0">
                 <ul>
                    <li>
                        <button
                            onClick={() => handleItemClick(ActiveView.AddFeatures)}
                            className={`flex items-center w-full p-3 rounded-lg text-left transition-colors duration-200 ${
                                activeView === ActiveView.AddFeatures
                                ? 'bg-purple-600 text-white font-semibold'
                                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                            }`}
                            title={translate(ActiveView.AddFeatures)}
                        >
                            <Icon name={navIcons[ActiveView.AddFeatures]!} className="h-6 w-6 flex-shrink-0" />
                            <span className="ml-4 text-sm font-medium">{translate(ActiveView.AddFeatures)}</span>
                        </button>
                    </li>
                </ul>
            </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
