import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';

interface ProgressIndicatorProps {
  current: number;
  total: number;
  answered: number;
  skipped: number;
}

export function ProgressIndicator({ current, total, answered, skipped }: ProgressIndicatorProps) {
  const progressPercentage = total > 0 ? (answered / total) * 100 : 0;

  if (total === 0) {
    return (
       <Card className="shadow-sm">
        <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Load questions to see progress.</p>
        </CardContent>
       </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 space-y-2">
        <div className="flex justify-between text-sm font-medium">
          <span>Progress</span>
          <span>{current > total ? total : current} / {total}</span>
        </div>
        <Progress value={progressPercentage} aria-label={`Progress: ${answered} of ${total} questions answered`} />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Answered: {answered}</span>
          <span>Skipped: {skipped}</span>
        </div>
      </CardContent>
    </Card>
  );
}
