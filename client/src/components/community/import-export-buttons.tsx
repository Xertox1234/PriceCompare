import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useExportWatchLists, useImportWatchLists } from '@/hooks/use-community';
import { Download, Upload, FileJson } from 'lucide-react';

export function ImportExportButtons() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportLists = useExportWatchLists();
  const importLists = useImportWatchLists();
  const { toast } = useToast();

  const handleExport = async () => {
    try {
      await exportLists.mutateAsync();
      toast({
        title: 'Export successful',
        description: 'Your watch lists have been downloaded as JSON',
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Failed to export watch lists',
        variant: 'destructive',
      });
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Validate the import data structure
      if (!data.watchLists || !Array.isArray(data.watchLists)) {
        throw new Error('Invalid watch list file format');
      }

      const result = await importLists.mutateAsync(data);

      toast({
        title: 'Import successful',
        description: `Created ${result.data.created} list(s), skipped ${result.data.skipped} duplicate(s)`,
      });

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Failed to import watch lists',
        variant: 'destructive',
      });

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileSelect}
        className="hidden"
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <FileJson className="w-4 h-4 mr-2" />
            Import/Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleExport} disabled={exportLists.isPending}>
            <Download className="w-4 h-4 mr-2" />
            Export to JSON
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleImportClick} disabled={importLists.isPending}>
            <Upload className="w-4 h-4 mr-2" />
            Import from JSON
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
