import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Download } from 'lucide-react';

interface FileControlsProps {
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onExport: () => void;
  isExportDisabled: boolean;
}

export function FileControls({ onImport, onExport, isExportDisabled }: FileControlsProps) {
  const importInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="flex-1">
        <Label htmlFor="jsonImport" className="sr-only">Import JSON</Label>
        <Button
            variant="outline"
            className="w-full"
            onClick={() => importInputRef.current?.click()}
        >
          <Upload className="mr-2 h-4 w-4" /> Import Questions (JSON)
        </Button>
        <Input
          id="jsonImport"
          type="file"
          accept=".json"
          onChange={onImport}
          className="hidden"
          ref={importInputRef}
        />
      </div>
      <Button
        variant="outline"
        onClick={onExport}
        disabled={isExportDisabled}
        className="flex-1"
      >
        <Download className="mr-2 h-4 w-4" /> Export Data (JSON)
      </Button>
    </div>
  );
}
