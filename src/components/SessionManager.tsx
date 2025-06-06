import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Trash2, Clock, FileText, AlertCircle } from 'lucide-react';
import { SessionStorage, type SavedSession } from '@/lib/storage';
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface SessionManagerProps {
  savedSessions: SavedSession[];
  onSessionsUpdate: () => void;
  className?: string;
}

export function SessionManager({ savedSessions, onSessionsUpdate, className }: SessionManagerProps) {
  const { toast } = useToast();

  const handleDownloadSession = (session: SavedSession) => {
    try {
      const jsonString = SessionStorage.exportSessionAsJSON(session);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `daytrace_session_${new Date(session.timestamp).toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({ title: "Downloaded", description: "Session exported successfully." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to export session.", variant: "destructive" });
    }
  };

  const handleDeleteSession = (sessionId: string) => {
    const success = SessionStorage.deleteSession(sessionId);
    if (success) {
      onSessionsUpdate();
      toast({ title: "Deleted", description: "Session deleted successfully." });
    } else {
      toast({ title: "Error", description: "Failed to delete session.", variant: "destructive" });
    }
  };

  const formatSessionInfo = (session: SavedSession) => {
    const answered = Object.values(session.questionStates).filter(s => s.status === 'answered').length;
    const total = session.questions.length;
    const date = new Date(session.timestamp).toLocaleString();
    return { answered, total, date };
  };

  if (savedSessions.length === 0) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Saved Sessions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {savedSessions.map((session) => {
          const { answered, total, date } = formatSessionInfo(session);
          
          return (
            <div key={session.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">
                    {session.title || `Session ${date.split(',')[0]}`}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>📅 {date}</div>
                  <div>📊 {answered}/{total} questions answered</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDownloadSession(session)}
                  className="h-8 px-2"
                >
                  <Download className="h-3 w-3" />
                </Button>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-destructive" />
                        Delete Session
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this session? This action cannot be undone.
                        <br /><br />
                        <strong>Session:</strong> {session.title || date}
                        <br />
                        <strong>Progress:</strong> {answered}/{total} questions answered
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDeleteSession(session.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete Session
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          );
        })}
        
        <div className="pt-2 border-t">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="w-full text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All Sessions
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  Clear All Sessions
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete all saved sessions? This will permanently remove all {savedSessions.length} saved sessions and cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    SessionStorage.clearAllSessions();
                    onSessionsUpdate();
                    toast({ title: "Cleared", description: "All sessions have been deleted." });
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Clear All Sessions
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}