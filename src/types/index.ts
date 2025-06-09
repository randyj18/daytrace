export interface Question {
  id: string;
  text: string;
  context?: Record<string, any>;
}

export type QuestionStatus = "pending" | "answered" | "skipped";

export interface QuestionInteractionState {
  answer: string;
  status: QuestionStatus;
}

export type AllQuestionStates = Record<string, QuestionInteractionState>;
