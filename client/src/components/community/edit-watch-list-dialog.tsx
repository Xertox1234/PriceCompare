import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useUpdateWatchList, type WatchListWithStats } from '@/hooks/use-community';

interface EditWatchListDialogProps {
  watchList: WatchListWithStats;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EMOJI_PRESETS = ['📱', '💻', '🎮', '📚', '🎁', '🏠', '👕', '🍔', '✈️', '🎵'];
const COLOR_PRESETS = [
  '#ef4444', // red
  '#f59e0b', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#64748b', // gray
];

export function EditWatchListDialog({
  watchList,
  open,
  onOpenChange,
}: EditWatchListDialogProps) {
  const [name, setName] = useState(watchList.name);
  const [description, setDescription] = useState(watchList.description || '');
  const [icon, setIcon] = useState(watchList.icon || '');
  const [color, setColor] = useState(watchList.color || '');

  const updateList = useUpdateWatchList();
  const { toast } = useToast();

  // Reset form when watchList changes
  useEffect(() => {
    setName(watchList.name);
    setDescription(watchList.description || '');
    setIcon(watchList.icon || '');
    setColor(watchList.color || '');
  }, [watchList, open]);

  const hasChanges =
    name !== watchList.name ||
    description !== (watchList.description || '') ||
    icon !== (watchList.icon || '') ||
    color !== (watchList.color || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a name for your watch list',
        variant: 'destructive',
      });
      return;
    }

    if (!hasChanges) {
      onOpenChange(false);
      return;
    }

    try {
      await updateList.mutateAsync({
        listId: watchList.id,
        updates: {
          name: name.trim(),
          description: description.trim() || null,
          icon: icon || null,
          color: color || null,
        },
      });

      toast({
        title: 'Watch list updated',
        description: `"${name}" has been updated successfully`,
      });

      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update watch list',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle>Edit Watch List</DialogTitle>
            <DialogDescription>
              Update your watch list details
              {watchList.isDefault && ' (Default list cannot be deleted)'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="edit-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-name"
                placeholder="e.g., Tech Deals, Holiday Shopping"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                placeholder="Optional description for this list"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            {/* Icon */}
            <div className="space-y-2">
              <Label>Icon (Optional)</Label>
              <div className="flex gap-2 flex-wrap">
                {EMOJI_PRESETS.map((emoji) => (
                  <Button
                    key={emoji}
                    type="button"
                    variant={icon === emoji ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setIcon(icon === emoji ? '' : emoji)}
                    className="text-lg"
                  >
                    {emoji}
                  </Button>
                ))}
                <Input
                  placeholder="Or type emoji"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value.slice(0, 2))}
                  className="w-24 text-center text-lg"
                  maxLength={2}
                />
              </div>
            </div>

            {/* Color */}
            <div className="space-y-2">
              <Label>Color (Optional)</Label>
              <div className="flex gap-2 flex-wrap">
                {COLOR_PRESETS.map((colorPreset) => (
                  <button
                    key={colorPreset}
                    type="button"
                    onClick={() => setColor(color === colorPreset ? '' : colorPreset)}
                    className={`w-8 h-8 rounded-full border-2 ${
                      color === colorPreset ? 'border-primary ring-2 ring-primary/50' : 'border-border'
                    }`}
                    style={{ backgroundColor: colorPreset }}
                  />
                ))}
                <Input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-16 h-8"
                />
              </div>
            </div>

            {/* Preview */}
            {(name || icon || color) && (
              <div className="space-y-2">
                <Label>Preview</Label>
                <div className="flex items-center gap-2 p-3 border rounded-lg">
                  {color && (
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                  )}
                  {icon && <span className="text-base">{icon}</span>}
                  <span className="font-medium">{name || 'Your List Name'}</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateList.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateList.isPending || !name.trim() || !hasChanges}
            >
              {updateList.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
