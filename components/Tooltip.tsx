
import React, { useState } from 'react';

interface Props {
  text: string;
  children: React.ReactNode;
}

export const Tooltip: React.FC<Props> = ({ text, children }) => {
  const [show, setShow] = useState(false);

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        className="cursor-help"
      >
        {children}
      </div>
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-xl glass-dark text-[11px] leading-relaxed text-zinc-300 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-zinc-800/50"></div>
        </div>
      )}
    </div>
  );
};
