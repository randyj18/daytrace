// Local storage utilities for persistent Q&A sessions
import type { Question, AllQuestionStates } from '@/types';

export interface SavedSession {
  id: string;
  timestamp: number;
  questions: Question[];
  questionStates: AllQuestionStates;
  currentQuestionIndex: number;
  isQnAActive: boolean;
  title?: string;
}

const STORAGE_KEY = 'daytrace_sessions';
const CURRENT_SESSION_KEY = 'daytrace_current_session';

export class SessionStorage {
  static generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static saveCurrentSession(
    questions: Question[],
    questionStates: AllQuestionStates,
    currentQuestionIndex: number,
    isQnAActive: boolean,
    sessionId?: string
  ): string {
    if (typeof window === 'undefined') return '';
    
    const id = sessionId || this.generateSessionId();
    const session: SavedSession = {
      id,
      timestamp: Date.now(),
      questions,
      questionStates,
      currentQuestionIndex,
      isQnAActive,
      title: questions.length > 0 ? `Session ${new Date().toLocaleDateString()} - ${questions.length} questions` : undefined
    };

    try {
      // Save current active session
      localStorage.setItem(CURRENT_SESSION_KEY, JSON.stringify(session));
      
      // Also save to sessions history
      this.saveToHistory(session);
      
      console.log('Session saved:', id);
      return id;
    } catch (error) {
      console.error('Failed to save session:', error);
      return '';
    }
  }

  static saveToHistory(session: SavedSession): void {
    if (typeof window === 'undefined') return;
    
    try {
      const existingSessions = this.getAllSessions();
      const updatedSessions = existingSessions.filter(s => s.id !== session.id);
      updatedSessions.unshift(session); // Add to beginning
      
      // Keep only last 10 sessions
      if (updatedSessions.length > 10) {
        updatedSessions.splice(10);
      }
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSessions));
    } catch (error) {
      console.error('Failed to save to history:', error);
    }
  }

  static getCurrentSession(): SavedSession | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const sessionData = localStorage.getItem(CURRENT_SESSION_KEY);
      if (!sessionData) return null;
      
      return JSON.parse(sessionData) as SavedSession;
    } catch (error) {
      console.error('Failed to load current session:', error);
      return null;
    }
  }

  static getAllSessions(): SavedSession[] {
    if (typeof window === 'undefined') return [];
    
    try {
      const sessionsData = localStorage.getItem(STORAGE_KEY);
      if (!sessionsData) return [];
      
      return JSON.parse(sessionsData) as SavedSession[];
    } catch (error) {
      console.error('Failed to load sessions:', error);
      return [];
    }
  }

  static deleteSession(sessionId: string): boolean {
    if (typeof window === 'undefined') return false;
    
    try {
      const sessions = this.getAllSessions();
      const updatedSessions = sessions.filter(s => s.id !== sessionId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSessions));
      
      // If deleting current session, clear it
      const currentSession = this.getCurrentSession();
      if (currentSession?.id === sessionId) {
        localStorage.removeItem(CURRENT_SESSION_KEY);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to delete session:', error);
      return false;
    }
  }

  static clearCurrentSession(): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.removeItem(CURRENT_SESSION_KEY);
    } catch (error) {
      console.error('Failed to clear current session:', error);
    }
  }

  static clearAllSessions(): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(CURRENT_SESSION_KEY);
    } catch (error) {
      console.error('Failed to clear all sessions:', error);
    }
  }

  static exportSessionAsJSON(session: SavedSession): string {
    const exportData = {
      exportedAt: new Date().toISOString(),
      sessionInfo: {
        id: session.id,
        timestamp: session.timestamp,
        title: session.title,
        date: new Date(session.timestamp).toLocaleString()
      },
      questions: session.questions.map(q => ({
        id: q.id,
        question: q.text,
        answer: session.questionStates[q.id]?.answer || '',
        status: session.questionStates[q.id]?.status || 'pending',
        ...(q.context || {})
      })),
      summary: {
        totalQuestions: session.questions.length,
        answered: Object.values(session.questionStates).filter(s => s.status === 'answered').length,
        skipped: Object.values(session.questionStates).filter(s => s.status === 'skipped').length,
        pending: Object.values(session.questionStates).filter(s => s.status === 'pending').length
      }
    };
    
    return JSON.stringify(exportData, null, 2);
  }
}