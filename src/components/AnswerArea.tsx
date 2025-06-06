import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Eraser } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface AnswerAreaProps {
  answer: string;
  onAnswerChange: (answer: string) => void;
  onClearAnswer: () => void;
  isReadOnly: boolean;
}

export function AnswerArea({ answer, onAnswerChange, onClearAnswer, isReadOnly }: AnswerAreaProps) {
  return (
    <Card className="shadow-md">
      <CardContent className="p-6 space-y-4">
        <Textarea
          placeholder={isReadOnly ? "Import questions to start answering." : "Your answer will appear here... or type if you prefer."}
          value={answer}
          onChange={(e) => onAnswerChange(e.target.value)}
          rows={5}
          className="resize-none text-base"
          readOnly={isReadOnly}
          aria-label="Answer area"
        />
        {!isReadOnly && (
          <Button variant="outline" size="sm" onClick={onClearAnswer} className="flex items-center gap-2">
            <Eraser className="h-4 w-4" /> Clear Answer
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
