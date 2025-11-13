import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';

const topicSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  content: z.string().min(10, 'Content must be at least 10 characters'),
  categoryId: z.string().min(1, 'Please select a category'),
  tags: z.string().optional()
});

type TopicFormData = z.infer<typeof topicSchema>;

interface Category {
  id: number;
  name: string;
  description: string;
  color: string;
  topicCount: number;
  postCount: number;
  icon: string;
}

interface CreateTopicDialogProps {
  categories: Category[];
  user: any;
  redirectToLogin: () => void;
}

export function CreateTopicDialog({ categories, user, redirectToLogin }: CreateTopicDialogProps) {
  const queryClient = useQueryClient();

  const topicForm = useForm<TopicFormData>({
    resolver: zodResolver(topicSchema),
    defaultValues: {
      title: '',
      content: '',
      categoryId: '',
      tags: ''
    }
  });

  const createTopicMutation = useMutation({
    mutationFn: async (data: TopicFormData) => {
      const payload = {
        title: data.title,
        content: data.content,
        categoryId: parseInt(data.categoryId)
      };

      const response = await fetch('/api/forum/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (response.status === 401) {
        redirectToLogin();
        throw new Error('Please log in to create topics');
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create topic');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/forum/topics'] });
      topicForm.reset();
    },
    onError: (error) => {
      alert(`Failed to create topic: ${error.message}`);
    }
  });

  if (!user) {
    return (
      <Button onClick={redirectToLogin}>
        <Plus className="h-4 w-4 mr-2" />
        Sign in to Create Topic
      </Button>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Topic
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Topic</DialogTitle>
        </DialogHeader>
        <Form {...topicForm}>
          <form onSubmit={topicForm.handleSubmit(data => createTopicMutation.mutate(data))} className="space-y-4">
            <FormField
              control={topicForm.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-card/95 dark:bg-muted/90 backdrop-blur-sm border shadow-lg text-muted-foreground dark:text-muted-foreground">
                      {categories.map(category => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={topicForm.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter topic title..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={topicForm.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter tags separated by commas..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={topicForm.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Write your topic content..." rows={6} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={createTopicMutation.isPending}>
                {createTopicMutation.isPending ? 'Creating...' : 'Create Topic'}
              </Button>
              <Button type="button" variant="outline" onClick={() => topicForm.reset()}>
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
