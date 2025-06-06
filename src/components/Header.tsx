import Link from 'next/link';
import { DaytraceLogo } from '@/components/icons/DaytraceLogo';

export function AppHeader() {
  return (
    <header className="py-6 px-4 md:px-6 border-b border-border/50 shadow-sm sticky top-0 bg-background/80 backdrop-blur-md z-50">
      <div className="container mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-primary hover:opacity-80 transition-opacity">
          <DaytraceLogo className="w-8 h-8" />
          <h1 className="text-2xl font-headline font-semibold">Daytrace</h1>
        </Link>
      </div>
    </header>
  );
}
