import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Question } from '@/types';

interface QuestionDisplayProps {
  question?: Question;
  currentQuestionNumber: number;
  totalQuestions: number;
}

export function QuestionDisplay({ question, currentQuestionNumber, totalQuestions }: QuestionDisplayProps) {
  if (!question) {
    return (
      <Card className="min-h-[150px] flex items-center justify-center animate-fade-in">
        <CardContent className="p-6 text-center">
          <p className="text-lg text-muted-foreground">
            No questions loaded. Please import a JSON file.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="animate-fade-in shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-xl text-primary">
          Question {currentQuestionNumber} of {totalQuestions}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-2xl leading-relaxed">{question.text}</p>
        {question.context && Object.keys(question.context).length > 0 && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold text-muted-foreground mb-2">Additional Context:</h4>
            <div className="space-y-2 text-sm">
              {Object.entries(question.context).map(([key, value]) => (
                <div key={key} className="flex flex-col sm:flex-row sm:gap-2">
                  <span className="font-medium text-muted-foreground capitalize">{key}:</span>
                  <span className="text-foreground">{typeof value === 'string' ? value : JSON.stringify(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
