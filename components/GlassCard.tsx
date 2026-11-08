
import React from 'react';

// Extend standard div attributes to support event handlers like drag and drop
interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', onClick, ...props }) => {
  return (
    <div 
      onClick={onClick}
      {...props}
      className={`glass rounded-2xl p-6 transition-all duration-300 ${onClick ? 'cursor-pointer hover:bg-white/5' : ''} ${className}`}
    >
      {children}
    </div>
  );
};
