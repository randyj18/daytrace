import React from 'react';

export function DaytraceLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
    >
      <path d="M20 80 Q25 70 35 60 Q50 45 65 60 Q75 70 80 80 L80 90 L20 90 Z" />
      <path d="M30 50 Q40 30 50 20 Q60 30 70 50 Q60 55 50 60 Q40 55 30 50 Z" />
      <circle cx="50" cy="15" r="5" />
    </svg>
  );
}
