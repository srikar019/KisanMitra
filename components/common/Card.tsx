

import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, className = '' }) => {
  return (
    <div className={`bg-white rounded-xl shadow-lg p-6 sm:p-8 w-full max-w-5xl mx-auto ${className}`}>
      {children}
    </div>
  );
};

export default Card;
