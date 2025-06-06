export interface Question {
  id: string;
  text: string;
}

export type QuestionStatus = "pending" | "answered" | "skipped";

export interface QuestionInteractionState {
  answer: string;
  status: QuestionStatus;
}

export type AllQuestionStates = Record<string, QuestionInteractionState>;
