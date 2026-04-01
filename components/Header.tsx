import React, { useState, useRef, useEffect, useMemo } from 'react';
import Icon from './common/Icon';
import { useAuth } from '../contexts/AuthContext';
import NotificationBell from './common/NotificationBell';
import { FarmerProfile, ActiveView } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { availableLanguages, Language } from '../translations';
import LanguageSwitcher from './common/LanguageSwitcher';

interface HeaderProps {
  toggleSidebar: () => void;
  onProfileClick: () => void;
  onNavigateToChat: (recipient: FarmerProfile) => void;
  onNavigate: (view: ActiveView) => void;
  onLogout: () => void;
}

const UserProfile: React.FC<{
    onProfileClick: () => void;
    onLogout: () => void;
    onNavigate: (view: ActiveView) => void;
}> = ({ onProfileClick, onLogout, onNavigate }) => {
    const { currentUser } = useAuth();
    const { translate } = useLanguage();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [dropdownRef]);

    if (!currentUser) return null;

    const userName = currentUser.email?.split('@')[0] || 'Farmer';
    const farmName = translate('header.farmName', { userName });

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsDropdownOpen(prev => !prev)}
                className="flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 transition-colors rounded-full py-1 pl-1 pr-3"
                aria-label="Open user menu"
                aria-haspopup="true"
                aria-expanded={isDropdownOpen}
            >
                <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center p-0.5 border-2 border-green-500">
                    <div className="w-full h-full bg-yellow-400 rounded-full flex flex-col items-center justify-center gap-0.5 p-1">
                        <div className="w-4/5 h-1/4 bg-red-600 rounded-sm"></div>
                        <div className="w-1/2 h-px bg-gray-800"></div>
                    </div>
                </div>
                <div>
                    <div className="font-semibold text-sm text-gray-900 text-left">{userName}</div>
                    <div className="text-xs text-gray-600 text-left">{farmName}</div>
                </div>
            </button>
            {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200 animate-fade-in-up">
                    <button
                        onClick={() => { onNavigate(ActiveView.MyFarm); setIsDropdownOpen(false); }}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                        <Icon name="clipboard-list" className="h-5 w-5 mr-2 text-gray-500" />
                        {translate('header.myFarm')}
                    </button>
                    <button
                        onClick={() => { onNavigate(ActiveView.MyDeals); setIsDropdownOpen(false); }}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                        <Icon name="tag" className="h-5 w-5 mr-2 text-gray-500" />
                        {translate('header.myDeals')}
                    </button>
                    <button
                        onClick={() => { onProfileClick(); setIsDropdownOpen(false); }}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                        <Icon name="user-circle" className="h-5 w-5 mr-2 text-gray-500" />
                        {translate('header.myProfile')}
                    </button>
                    <button
                        onClick={onLogout}
                        className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                        <Icon name="logout" className="h-5 w-5 mr-2" />
                        {translate('header.logout')}
                    </button>
                </div>
            )}
        </div>
    );
};


const Header: React.FC<HeaderProps> = ({ toggleSidebar, onProfileClick, onNavigateToChat, onNavigate, onLogout }) => {
  const { currentUser } = useAuth();
  const { translate } = useLanguage();

  return (
    <header className="bg-white shadow-md sticky top-0 z-20">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <button 
          onClick={toggleSidebar} 
          className="flex items-center space-x-3 p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Toggle navigation menu"
        >
          <img src="/logo.png" alt="AgriGenius Logo" className="h-10 w-10 object-contain rounded-full overflow-hidden" />
          <h1 className="text-2xl font-bold text-green-800">KisanMitra</h1>
        </button>

        {currentUser && (
          <div className="flex items-center space-x-2 sm:space-x-4">
             <button
                onClick={() => onNavigate(ActiveView.IndianAgriNews)}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                aria-label={translate(ActiveView.IndianAgriNews)}
                title={translate(ActiveView.IndianAgriNews)}
            >
                <Icon name="newspaper" className="h-6 w-6 text-gray-600" />
            </button>
            <NotificationBell onNavigateToChat={onNavigateToChat} onNavigate={onNavigate} />
            <div className="flex items-center gap-2">
                <LanguageSwitcher variant="dark" />
            </div>
            <UserProfile onProfileClick={onProfileClick} onLogout={onLogout} onNavigate={onNavigate} />
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
