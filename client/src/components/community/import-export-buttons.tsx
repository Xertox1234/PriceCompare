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

// Type for imported watch list data
// Must match WatchListImportData in use-community.ts
interface WatchListImportFile {
  watchLists?: Array<{
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    products?: Array<{
      productId: number;
      notes?: string;
      priority?: number;
      targetPrice?: string;
    }>;
  }>;
  [key: string]: unknown;
}

export function ImportExportButtons() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportLists = useExportWatchLists();
  const importLists = useImportWatchLists();
  const { toast } = useToast();

  const handleExport = async () => {
    try {
      await exportLists.refetch();
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
      const data: unknown = JSON.parse(text);

      // Validate the import data structure with type guard
      if (typeof data !== 'object' || data === null) {
        throw new Error('Invalid watch list file format');
      }
      const typedData = data as WatchListImportFile;
      if (!typedData.watchLists || !Array.isArray(typedData.watchLists)) {
        throw new Error('Invalid watch list file format');
      }

      const result = await importLists.mutateAsync(typedData);

      toast({
        title: 'Import successful',
        description: `Created ${result.created} list(s), skipped ${result.skipped} duplicate(s)`,
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
        onChange={(e) => void handleFileSelect(e)}
        className="hidden"
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <FileJson className="mr-2 h-4 w-4" />
            Import/Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => void handleExport()} disabled={exportLists.isFetching}>
            <Download className="mr-2 h-4 w-4" />
            Export to JSON
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => void handleImportClick()}
            disabled={importLists.isPending}
          >
            <Upload className="mr-2 h-4 w-4" />
            Import from JSON
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
