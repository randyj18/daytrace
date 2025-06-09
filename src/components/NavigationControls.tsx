
import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, SkipForward } from 'lucide-react';

interface NavigationControlsProps {
  onPrevious: () => void;
  onNext: () => void;
  onSkip: () => void;
  canPrevious: boolean;
  canNext: boolean; // True if there are questions and Q&A is active
}

export function NavigationControls({ onPrevious, onNext, onSkip, canPrevious, canNext }: NavigationControlsProps) {
  return (
    <div className="flex justify-between items-center gap-2 sm:gap-4">
      <Button variant="outline" onClick={onPrevious} disabled={!canPrevious} aria-label="Previous question">
        <ChevronLeft className="h-5 w-5 sm:mr-2" />
        <span className="hidden sm:inline">Previous</span>
      </Button>
      <Button variant="outline" onClick={onSkip} disabled={!canNext} aria-label="Skip question">
        <SkipForward className="h-5 w-5 sm:mr-2" />
         <span className="hidden sm:inline">Skip</span>
      </Button>
      <Button onClick={onNext} disabled={!canNext} aria-label="Next question" className="bg-primary hover:bg-primary/90 text-primary-foreground">
         <span className="hidden sm:inline">Next</span>
        <ChevronRight className="h-5 w-5 sm:ml-2" />
      </Button>
    </div>
  );
}
