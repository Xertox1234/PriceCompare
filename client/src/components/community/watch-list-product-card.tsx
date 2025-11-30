import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import {
  useUpdateProductWatch,
  type WatchListProduct,
  type WatchListWithStats,
} from '@/hooks/use-community';
import {
  ChevronDown,
  ChevronUp,
  Save,
  Star,
  Tag,
  FileText,
  DollarSign,
  List,
} from 'lucide-react';

interface WatchListProductCardProps {
  product: WatchListProduct;
  isSelected: boolean;
  onToggleSelect: () => void;
  watchLists: WatchListWithStats[];
}

export function WatchListProductCard({
  product,
  isSelected,
  onToggleSelect,
  watchLists,
}: WatchListProductCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [category, setCategory] = useState(product.category || '');
  const [notes, setNotes] = useState(product.notes || '');
  const [priority, setPriority] = useState(product.priority?.toString() || '3');
  const [targetPrice, setTargetPrice] = useState(product.targetPrice || '');
  const [watchListId, setWatchListId] = useState(product.watchListId?.toString() || '');

  const updateWatch = useUpdateProductWatch();
  const { toast } = useToast();

  const hasChanges =
    category !== (product.category || '') ||
    notes !== (product.notes || '') ||
    priority !== (product.priority?.toString() || '3') ||
    targetPrice !== (product.targetPrice || '') ||
    watchListId !== (product.watchListId?.toString() || '');

  const handleSave = async () => {
    try {
      await updateWatch.mutateAsync({
        watchId: product.id,
        updates: {
          category: category || null,
          notes: notes || null,
          priority: parseInt(priority),
          targetPrice: targetPrice || null,
          watchListId: watchListId ? parseInt(watchListId) : null,
        },
      });
      toast({
        title: 'Changes saved',
        description: 'Product watch details updated successfully',
      });
      setIsExpanded(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update product watch',
        variant: 'destructive',
      });
    }
  };

  const getPriorityBadge = (pri: number) => {
    if (pri >= 5) return <Badge variant="destructive">High</Badge>;
    if (pri >= 4) return <Badge variant="default">Medium-High</Badge>;
    if (pri >= 3) return <Badge variant="secondary">Medium</Badge>;
    if (pri >= 2) return <Badge variant="outline">Low-Medium</Badge>;
    return <Badge variant="outline">Low</Badge>;
  };

  return (
    <Card className={isSelected ? 'ring-2 ring-primary' : ''}>
      <CardContent className="p-4">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <div className="flex items-start gap-4">
            <Checkbox
              checked={isSelected}
              onCheckedChange={onToggleSelect}
              className="mt-1"
            />

            {product.productImage && (
              <img
                src={product.productImage}
                alt={product.productName || 'Product'}
                className="w-20 h-20 object-cover rounded"
              />
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-lg truncate">
                    {product.productName || `Product #${product.productId}`}
                  </h3>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {product.priority && getPriorityBadge(product.priority)}
                    {product.category && (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {product.category}
                      </Badge>
                    )}
                    {product.targetPrice && (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        Target: ${product.targetPrice}
                      </Badge>
                    )}
                  </div>
                  {product.notes && !isExpanded && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                      {product.notes}
                    </p>
                  )}
                </div>

                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>
          </div>

          <CollapsibleContent className="mt-4 space-y-4 pt-4 border-t">
            <div className="grid grid-cols-2 gap-4">
              {/* Priority */}
              <div className="space-y-2">
                <Label htmlFor={`priority-${product.id}`} className="flex items-center gap-2">
                  <Star className="w-4 h-4" />
                  Priority
                </Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger id={`priority-${product.id}`}>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">High (5)</SelectItem>
                    <SelectItem value="4">Medium-High (4)</SelectItem>
                    <SelectItem value="3">Medium (3)</SelectItem>
                    <SelectItem value="2">Low-Medium (2)</SelectItem>
                    <SelectItem value="1">Low (1)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Target Price */}
              <div className="space-y-2">
                <Label htmlFor={`target-${product.id}`} className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Target Price
                </Label>
                <Input
                  id={`target-${product.id}`}
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor={`category-${product.id}`} className="flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  Category
                </Label>
                <Input
                  id={`category-${product.id}`}
                  placeholder="e.g., Electronics, Gifts"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>

              {/* Watch List */}
              <div className="space-y-2">
                <Label htmlFor={`list-${product.id}`} className="flex items-center gap-2">
                  <List className="w-4 h-4" />
                  Watch List
                </Label>
                <Select value={watchListId} onValueChange={setWatchListId}>
                  <SelectTrigger id={`list-${product.id}`}>
                    <SelectValue placeholder="Select list" />
                  </SelectTrigger>
                  <SelectContent>
                    {watchLists.map((list) => (
                      <SelectItem key={list.id} value={list.id.toString()}>
                        {list.icon && `${list.icon} `}
                        {list.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor={`notes-${product.id}`} className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Notes
              </Label>
              <Textarea
                id={`notes-${product.id}`}
                placeholder="Add personal notes about this product..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCategory(product.category || '');
                  setNotes(product.notes || '');
                  setPriority(product.priority?.toString() || '3');
                  setTargetPrice(product.targetPrice || '');
                  setWatchListId(product.watchListId?.toString() || '');
                  setIsExpanded(false);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => void handleSave()}
                disabled={!hasChanges || updateWatch.isPending}
              >
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
