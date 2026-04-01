import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const Footer: React.FC = () => {
  const { translate } = useLanguage();
  return (
    <footer className="bg-white mt-8">
      <div className="container mx-auto px-4 py-6 text-center text-gray-500">
        <p>{translate('footer.copyright', { year: new Date().getFullYear() })}</p>
      </div>
    </footer>
  );
};

export default Footer;
