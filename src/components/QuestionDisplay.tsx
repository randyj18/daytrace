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
      <CardContent>
        <p className="text-2xl leading-relaxed">{question.text}</p>
      </CardContent>
    </Card>
  );
}
