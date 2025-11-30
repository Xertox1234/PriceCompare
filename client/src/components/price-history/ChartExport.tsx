import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, Image, FileText, Copy, Share2, Check } from 'lucide-react';
import { useChartExport } from '@/hooks/useChartExport';
import { useToast } from '@/hooks/use-toast';

interface PriceHistoryData {
  retailerName: string;
  price: string;
  recordedAt: Date | string;
}

interface ChartExportProps {
  chartElementId: string;
  data: PriceHistoryData[];
  productName: string;
  productId: number;
  timeRange?: number;
}

export function ChartExport({
  chartElementId,
  data,
  productName,
  productId,
  timeRange,
}: ChartExportProps) {
  const { exportAsPNG, exportAsCSV, copyToClipboard, generateShareLink, isExporting } =
    useChartExport();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleExportPNG = async () => {
    const success = await exportAsPNG(chartElementId);
    if (success) {
      toast({
        title: 'Chart Exported',
        description: 'Price history chart saved as PNG image',
      });
    } else {
      toast({
        title: 'Export Failed',
        description: 'Failed to export chart. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleExportCSV = () => {
    const success = exportAsCSV(data, productName);
    if (success) {
      toast({
        title: 'Data Exported',
        description: 'Price history data saved as CSV file',
      });
    } else {
      toast({
        title: 'Export Failed',
        description: 'Failed to export data. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleCopyImage = async () => {
    const success = await copyToClipboard(chartElementId);
    if (success) {
      setCopied(true);
      toast({
        title: 'Copied to Clipboard',
        description: 'Chart image copied. You can paste it anywhere!',
      });
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast({
        title: 'Copy Failed',
        description: 'Failed to copy chart. Your browser may not support this feature.',
        variant: 'destructive',
      });
    }
  };

  const handleCopyLink = () => {
    const link = generateShareLink(productId, timeRange);
    void navigator.clipboard.writeText(link);
    setCopied(true);
    toast({
      title: 'Link Copied',
      description: 'Shareable link copied to clipboard',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isExporting}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleExportPNG} disabled={isExporting}>
          <Image className="h-4 w-4 mr-2" />
          Export as PNG
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportCSV} disabled={isExporting}>
          <FileText className="h-4 w-4 mr-2" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void handleCopyImage()} disabled={isExporting}>
          {copied ? (
            <Check className="h-4 w-4 mr-2 text-green-600" />
          ) : (
            <Copy className="h-4 w-4 mr-2" />
          )}
          Copy Chart Image
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyLink}>
          {copied ? (
            <Check className="h-4 w-4 mr-2 text-green-600" />
          ) : (
            <Share2 className="h-4 w-4 mr-2" />
          )}
          Copy Share Link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
