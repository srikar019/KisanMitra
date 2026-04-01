import React, { useState, useRef, useEffect } from 'react';
import Icon from './Icon';
import { useLanguage } from '../../contexts/LanguageContext';
import { availableLanguages, Language } from '../../translations';

interface LanguageSwitcherProps {
    variant?: 'light' | 'dark';
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ variant = 'light' }) => {
    const { language, setLanguage } = useLanguage();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelectLanguage = (langCode: Language) => {
        setLanguage(langCode);
        setIsDropdownOpen(false);
    };

    const iconColor = variant === 'light' ? 'text-white' : 'text-gray-600';
    const buttonBg = variant === 'light' ? 'hover:bg-white/10 border-white/20' : 'hover:bg-gray-100 border-gray-200';

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsDropdownOpen(prev => !prev)}
                className={`p-2 rounded-full transition-colors flex items-center justify-center border backdrop-blur-sm ${buttonBg}`}
                aria-label="Change language"
                aria-haspopup="true"
                aria-expanded={isDropdownOpen}
            >
                <Icon name="globe" className={`h-6 w-6 ${iconColor}`} />
            </button>
            {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-2xl py-2 z-50 border border-gray-100 animate-fade-in-up">
                    {availableLanguages.map(lang => (
                        <button
                            key={lang.code}
                            onClick={() => handleSelectLanguage(lang.code)}
                            className={`flex items-center w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-green-50 transition-colors ${language === lang.code ? 'font-bold text-green-700 bg-green-50/50' : ''}`}
                        >
                            {lang.name}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default LanguageSwitcher;
