import React from 'react';
import Image from 'next/image';

export function DaytraceLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/daytrace.png?v=5"
      alt="Daytrace Logo"
      width={80}
      height={80}
      className={`${className} object-contain`}
      priority
      unoptimized
      style={{ background: 'transparent' }}
    />
  );
}
