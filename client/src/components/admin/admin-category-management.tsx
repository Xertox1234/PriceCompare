import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Plus, Edit, Trash2 } from 'lucide-react';

interface ForumCategory {
  id: number;
  name: string;
  slug: string;
  description?: string;
  color: string;
  icon?: string;
  isActive: boolean;
  sortOrder: number;
}

interface AdminCategoryManagementProps {
  categories: ForumCategory[];
  isLoading: boolean;
}

export function AdminCategoryManagement({ categories, isLoading }: AdminCategoryManagementProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [newCategory, setNewCategory] = useState({
    name: '',
    description: '',
    color: '#3b82f6',
    icon: 'MessageSquare'
  });

  const [editingCategory, setEditingCategory] = useState<ForumCategory | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    color: '#3b82f6',
  });

  const [deletingCategoryId, setDeletingCategoryId] = useState<number | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const createCategoryMutation = useMutation({
    mutationFn: async (data: Omit<ForumCategory, 'id' | 'isActive' | 'sortOrder'>) => {
      return apiRequest('/api/admin/categories', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/categories'] });
      setNewCategory({ name: '', description: '', color: '#3b82f6', icon: 'MessageSquare' });
      toast({ title: 'Category created successfully!' });
    },
    onError: () => {
      toast({ title: 'Failed to create category', variant: 'destructive' });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ForumCategory> }) => {
      return apiRequest(`/api/admin/categories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/categories'] });
      setShowEditDialog(false);
      setEditingCategory(null);
      toast({ title: 'Category updated successfully!' });
    },
    onError: () => {
      toast({ title: 'Failed to update category', variant: 'destructive' });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/admin/categories/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/categories'] });
      setShowDeleteDialog(false);
      setDeletingCategoryId(null);
      toast({ title: 'Category deleted successfully!' });
    },
    onError: () => {
      toast({ title: 'Failed to delete category', variant: 'destructive' });
    },
  });

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.name.trim()) return;

    createCategoryMutation.mutate({
      ...newCategory,
      slug: newCategory.name.toLowerCase().replace(/\s+/g, '-'),
    });
  };

  const handleEditCategory = (category: ForumCategory) => {
    setEditingCategory(category);
    setEditForm({
      name: category.name,
      description: category.description || '',
      color: category.color,
    });
    setShowEditDialog(true);
  };

  const handleUpdateCategory = () => {
    if (!editingCategory || !editForm.name.trim()) return;

    updateCategoryMutation.mutate({
      id: editingCategory.id,
      data: {
        name: editForm.name,
        description: editForm.description,
        color: editForm.color,
        slug: editForm.name.toLowerCase().replace(/\s+/g, '-'),
      },
    });
  };

  const handleDeleteCategory = (categoryId: number) => {
    setDeletingCategoryId(categoryId);
    setShowDeleteDialog(true);
  };

  const confirmDeleteCategory = () => {
    if (deletingCategoryId !== null) {
      deleteCategoryMutation.mutate(deletingCategoryId);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create New Category
          </CardTitle>
          <CardDescription>
            Add a new forum category to organize discussions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateCategory} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category-name">Name</Label>
                <Input
                  id="category-name"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Product Reviews"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category-color">Color</Label>
                <Input
                  id="category-color"
                  type="color"
                  value={newCategory.color}
                  onChange={(e) => setNewCategory(prev => ({ ...prev, color: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category-description">Description</Label>
              <Textarea
                id="category-description"
                value={newCategory.description}
                onChange={(e) => setNewCategory(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what this category is for..."
              />
            </div>
            <Button type="submit" disabled={createCategoryMutation.isPending}>
              {createCategoryMutation.isPending ? 'Creating...' : 'Create Category'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Forum Categories</CardTitle>
          <CardDescription>
            Manage your forum categories
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isLoading ? (
              <div>Loading categories...</div>
            ) : Array.isArray(categories) && categories.length > 0 ? (
              categories.map((category: ForumCategory) => (
                <div key={category.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    <div>
                      <h3 className="font-medium">{category.name}</h3>
                      <p className="text-sm text-muted-foreground">{category.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={category.isActive ? "default" : "secondary"}>
                      {category.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditCategory(category)}
                      aria-label={`Edit ${category.name}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteCategory(category.id)}
                      aria-label={`Delete ${category.name}`}
                      className="text-destructive hover:text-destructive/90"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-muted-foreground">No categories found</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Category Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>
              Update the category details below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-category-name">Name</Label>
              <Input
                id="edit-category-name"
                value={editForm.name}
                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Product Reviews"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-category-color">Color</Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="edit-category-color"
                  type="color"
                  value={editForm.color}
                  onChange={(e) => setEditForm(prev => ({ ...prev, color: e.target.value }))}
                  className="w-20 h-10"
                />
                <Input
                  value={editForm.color}
                  onChange={(e) => setEditForm(prev => ({ ...prev, color: e.target.value }))}
                  placeholder="#3b82f6"
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-category-description">Description</Label>
              <Textarea
                id="edit-category-description"
                value={editForm.description}
                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what this category is for..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              disabled={updateCategoryMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateCategory}
              disabled={!editForm.name.trim() || updateCategoryMutation.isPending}
            >
              {updateCategoryMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Category Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this category. All topics and posts in this category will need to be reassigned. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteCategoryMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteCategory}
              disabled={deleteCategoryMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCategoryMutation.isPending ? 'Deleting...' : 'Delete Category'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
