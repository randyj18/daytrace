
import React from 'react';
import { Button } from '@/components/ui/button';
import { Volume2, Mic, MicOff, Pause, Play } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface AudioControlsProps {
  onReadAloud: () => void;
  onToggleTranscription: () => void;
  onPause: () => void;
  onResume: () => void;
  isTranscribing: boolean;
  isPaused: boolean;
  isAudioDisabled: boolean; // General disable for audio features (e.g., no question loaded)
  isSttDisabled: boolean; // Specific disable for STT (e.g., whisper module not loaded)
}

export function AudioControls({ onReadAloud, onToggleTranscription, onPause, onResume, isTranscribing, isPaused, isAudioDisabled, isSttDisabled }: AudioControlsProps) {
  return (
    <TooltipProvider>
      <div className="flex gap-2 sm:gap-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" onClick={onReadAloud} disabled={isAudioDisabled} aria-label="Read question aloud">
              <Volume2 className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Read Aloud</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={isPaused ? onResume : onPause} 
              disabled={isAudioDisabled}
              aria-label={isPaused ? "Resume" : "Pause"}
            >
              {isPaused ? <Play className="h-5 w-5 text-green-600" /> : <Pause className="h-5 w-5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isPaused ? 'Resume' : 'Pause'}</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            {/* STT button now uses isSttDisabled */}
            <Button variant="outline" size="icon" onClick={onToggleTranscription} disabled={isSttDisabled} aria-label={isTranscribing ? "Stop transcription" : "Start transcription"}>
              {isTranscribing ? <MicOff className="h-5 w-5 text-destructive" /> : <Mic className="h-5 w-5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isTranscribing ? 'Stop Transcription' : 'Start Transcription'}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
