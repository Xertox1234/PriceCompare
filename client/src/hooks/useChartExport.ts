import { useCallback, useState } from 'react';
import html2canvas from 'html2canvas';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';

interface PriceHistoryData {
  retailerName: string;
  price: string;
  recordedAt: Date | string;
}

export function useChartExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Export chart as PNG image
   */
  const exportAsPNG = useCallback(async (
    elementId: string,
    filename?: string
  ): Promise<boolean> => {
    setIsExporting(true);
    setError(null);

    try {
      const element = document.getElementById(elementId);
      if (!element) {
        throw new Error('Chart element not found');
      }

      // Generate canvas from element
      const canvas = await html2canvas(element, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher quality
        logging: false,
        useCORS: true,
      });

      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (blob) {
          const defaultFilename = `price-history-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.png`;
          saveAs(blob, filename || defaultFilename);
        }
      });

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to export chart';
      setError(errorMessage);
      console.error('Export PNG error:', err);
      return false;
    } finally {
      setIsExporting(false);
    }
  }, []);

  /**
   * Export price history data as CSV
   */
  const exportAsCSV = useCallback((
    data: PriceHistoryData[],
    productName: string,
    filename?: string
  ): boolean => {
    setIsExporting(true);
    setError(null);

    try {
      if (!data || data.length === 0) {
        throw new Error('No data to export');
      }

      // Create CSV content
      const headers = ['Date', 'Retailer', 'Price'];
      const rows = data.map((item) => {
        const date = typeof item.recordedAt === 'string'
          ? new Date(item.recordedAt)
          : item.recordedAt;
        return [
          format(date, 'yyyy-MM-dd HH:mm:ss'),
          item.retailerName,
          item.price,
        ];
      });

      // Combine headers and rows
      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.join(',')),
      ].join('\n');

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const defaultFilename = `${productName.replace(/[^a-z0-9]/gi, '-')}-price-history-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      saveAs(blob, filename || defaultFilename);

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to export CSV';
      setError(errorMessage);
      console.error('Export CSV error:', err);
      return false;
    } finally {
      setIsExporting(false);
    }
  }, []);

  /**
   * Copy chart as image to clipboard
   */
  const copyToClipboard = useCallback(async (
    elementId: string
  ): Promise<boolean> => {
    setIsExporting(true);
    setError(null);

    try {
      const element = document.getElementById(elementId);
      if (!element) {
        throw new Error('Chart element not found');
      }

      // Generate canvas
      const canvas = await html2canvas(element, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
      });

      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Failed to create blob'));
        });
      });

      // Copy to clipboard
      if (navigator.clipboard && ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        return true;
      } else {
        throw new Error('Clipboard API not supported');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to copy to clipboard';
      setError(errorMessage);
      console.error('Copy to clipboard error:', err);
      return false;
    } finally {
      setIsExporting(false);
    }
  }, []);

  /**
   * Generate shareable link
   */
  const generateShareLink = useCallback((
    productId: number,
    timeRange?: number
  ): string => {
    const baseUrl = window.location.origin;
    const params = new URLSearchParams();

    if (timeRange) {
      params.append('days', timeRange.toString());
    }

    const queryString = params.toString();
    return `${baseUrl}/products/${productId}/price-history${queryString ? `?${queryString}` : ''}`;
  }, []);

  return {
    exportAsPNG,
    exportAsCSV,
    copyToClipboard,
    generateShareLink,
    isExporting,
    error,
  };
}
