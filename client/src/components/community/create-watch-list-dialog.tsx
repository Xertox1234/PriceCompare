import { useState } from 'react';
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
import { useCreateWatchList } from '@/hooks/use-community';

interface CreateWatchListDialogProps {
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

export function CreateWatchListDialog({ open, onOpenChange }: CreateWatchListDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState('');

  const createList = useCreateWatchList();
  const { toast } = useToast();

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

    try {
      await createList.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        icon: icon || undefined,
        color: color || undefined,
      });

      toast({
        title: 'Watch list created',
        description: `"${name}" has been added to your watch lists`,
      });

      // Reset form
      setName('');
      setDescription('');
      setIcon('');
      setColor('');
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create watch list',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle>Create Watch List</DialogTitle>
            <DialogDescription>
              Create a new list to organize your watched products
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g., Tech Deals, Holiday Shopping"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Optional description for this list"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            {/* Icon */}
            <div className="space-y-2">
              <Label>Icon (Optional)</Label>
              <div className="flex flex-wrap gap-2">
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
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((colorPreset) => (
                  <button
                    key={colorPreset}
                    type="button"
                    onClick={() => setColor(color === colorPreset ? '' : colorPreset)}
                    className={`h-8 w-8 rounded-full border-2 ${
                      color === colorPreset
                        ? 'border-primary ring-primary/50 ring-2'
                        : 'border-border'
                    }`}
                    style={{ backgroundColor: colorPreset }}
                  />
                ))}
                <Input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-8 w-16"
                />
              </div>
            </div>

            {/* Preview */}
            {(name || icon || color) && (
              <div className="space-y-2">
                <Label>Preview</Label>
                <div className="flex items-center gap-2 rounded-lg border p-3">
                  {color && (
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
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
              disabled={createList.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createList.isPending || !name.trim()}>
              {createList.isPending ? 'Creating...' : 'Create List'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
