import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import Icon from './Icon';

const ThemeSwitcher: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center justify-center w-12 h-6 rounded-full bg-gray-200 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 dark:focus:ring-offset-gray-800 transition-colors"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      <div
        className="w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ease-in-out flex items-center justify-center"
        style={{ transform: theme === 'light' ? 'translateX(-0.25rem)' : 'translateX(0.25rem)' }}
      >
        {theme === 'light' ? (
          <Icon name="sun" className="h-4 w-4 text-yellow-500" />
        ) : (
          <Icon name="moon" className="h-4 w-4 text-blue-400" />
        )}
      </div>
    </button>
  );
};

export default ThemeSwitcher;
