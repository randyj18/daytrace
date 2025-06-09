
import React from 'react';
import { Button } from '@/components/ui/button';
import { Volume2, Mic, MicOff } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface AudioControlsProps {
  onReadAloud: () => void;
  onToggleTranscription: () => void;
  isTranscribing: boolean;
  isAudioDisabled: boolean; // General disable for audio features (e.g., no question loaded)
  isSttDisabled: boolean; // Specific disable for STT (e.g., whisper module not loaded)
}

export function AudioControls({ onReadAloud, onToggleTranscription, isTranscribing, isAudioDisabled, isSttDisabled }: AudioControlsProps) {
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
            {/* STT button now uses isSttDisabled */}
            <Button variant="outline" size="icon" onClick={onToggleTranscription} disabled={isSttDisabled} aria-label={isTranscribing ? "Stop transcription" : "Start transcription"}>
              {isTranscribing ? <MicOff className="h-5 w-5 text-destructive" /> : <Mic className="h-5 w-5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isTranscribing ? 'Stop Transcription (Whisper)' : 'Start Transcription (Whisper)'}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
