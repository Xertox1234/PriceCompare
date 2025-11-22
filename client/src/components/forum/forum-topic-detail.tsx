import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { MessageSquare, Pin, Eye, Clock, Heart, Reply, Award } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const postSchema = z.object({
  content: z.string().min(3, 'Post must be at least 3 characters')
});

type PostFormData = z.infer<typeof postSchema>;

interface Category {
  id: number;
  name: string;
  description: string;
  color: string;
  topicCount: number;
  postCount: number;
  icon: string;
}

interface Topic {
  id: number;
  title: string;
  content: string;
  slug: string;
  views: number;
  likes: number;
  isPinned: boolean;
  isLocked: boolean;
  postCount: number;
  createdAt: string;
  updatedAt: string;
  author: {
    id: number;
    username: string;
    avatar?: string;
    trustLevel: number;
    badges: string[];
  };
  category: Category;
  tags: string[];
  lastPost?: {
    author: string;
    createdAt: string;
  };
}

interface Post {
  id: number;
  content: string;
  likes: number;
  isLiked: boolean;
  postNumber: number;
  createdAt: string;
  author: {
    id: number;
    username: string;
    avatar?: string;
    trustLevel: number;
    badges: string[];
    postCount: number;
    joinedAt: string;
  };
  replies: Post[];
}

interface User {
  id: number;
  username: string;
  [key: string]: unknown;
}

interface ForumTopicDetailProps {
  topic: Topic;
  posts: Post[];
  user: User | null | undefined;
  onBack: () => void;
  redirectToLogin: () => void;
}

const getTrustLevelColor = (level: number) => {
  switch (level) {
    case 0: return 'bg-muted';
    case 1: return 'bg-primary';
    case 2: return 'bg-success';
    case 3: return 'bg-secondary';
    case 4: return 'bg-warning';
    default: return 'bg-muted';
  }
};

const getTrustLevelName = (level: number) => {
  switch (level) {
    case 0: return 'New User';
    case 1: return 'Basic User';
    case 2: return 'Member';
    case 3: return 'Regular';
    case 4: return 'Leader';
    default: return 'User';
  }
};

export function ForumTopicDetail({ topic, posts, user, onBack, redirectToLogin }: ForumTopicDetailProps) {
  const queryClient = useQueryClient();

  const postForm = useForm<PostFormData>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      content: ''
    }
  });

  const createPostMutation = useMutation({
    mutationFn: async (data: PostFormData) => {
      const response = await fetch('/api/forum/posts/enhanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...data,
          topicId: topic.id
        })
      });
      if (!response.ok) throw new Error('Failed to create post');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/forum/topics', topic.id, 'posts'] });
      postForm.reset();
    }
  });

  const likePostMutation = useMutation({
    mutationFn: async (postId: number) => {
      const response = await fetch(`/api/forum/posts/${postId}/like`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to like post');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/forum/topics', topic.id, 'posts'] });
    }
  });

  return (
    <div className="space-y-6">
      {/* Topic Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={onBack}
          className="mb-4"
        >
          ← Back to Topics
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {topic.isPinned && (
                  <Pin className="h-4 w-4 text-primary" />
                )}
                <Badge
                  variant="secondary"
                  style={{ backgroundColor: topic.category.color + '20', color: topic.category.color }}
                >
                  {topic.category.name}
                </Badge>
              </div>
              <CardTitle className="text-2xl">{topic.title}</CardTitle>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-xs">
                      {topic.author.username[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span>{topic.author.username}</span>
                  <div className={`w-2 h-2 rounded-full ${getTrustLevelColor(topic.author.trustLevel)}`}
                       title={getTrustLevelName(topic.author.trustLevel)} />
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {formatDistanceToNow(new Date(topic.createdAt))} ago
                </div>
                <div className="flex items-center gap-1">
                  <Eye className="h-4 w-4" />
                  {topic.views} views
                </div>
                <div className="flex items-center gap-1">
                  <MessageSquare className="h-4 w-4" />
                  {topic.postCount} replies
                </div>
              </div>
            </div>
          </div>
          {topic.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {topic.tags.map(tag => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="prose max-w-none">
            {topic.content}
          </div>
        </CardContent>
      </Card>

      {/* Posts */}
      <div className="space-y-4">
        {posts.map((post) => (
          <Card key={post.id} id={`post-${post.id}`}>
            <CardContent className="pt-4">
              <div className="flex gap-4">
                <div className="flex flex-col items-center space-y-2 min-w-[120px]">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      {post.author.username[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-center">
                    <div className="font-medium text-sm">{post.author.username}</div>
                    <div className={`text-xs px-2 py-1 rounded-full text-white ${getTrustLevelColor(post.author.trustLevel)}`}>
                      {getTrustLevelName(post.author.trustLevel)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {post.author.postCount} posts
                    </div>
                  </div>
                  {post.author.badges.length > 0 && (
                    <div className="flex flex-wrap gap-1 justify-center">
                      {post.author.badges.map(badge => (
                        <Award key={badge} className="h-3 w-3 text-warning" />
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">
                      #{post.postNumber} · {formatDistanceToNow(new Date(post.createdAt))} ago
                    </span>
                  </div>

                  <div className="prose max-w-none mb-4">
                    {post.content}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => likePostMutation.mutate(post.id)}
                      className={post.isLiked ? 'text-destructive' : ''}
                    >
                      <Heart className={`h-4 w-4 mr-1 ${post.isLiked ? 'fill-current' : ''}`} />
                      {post.likes}
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Reply className="h-4 w-4 mr-1" />
                      Reply
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Reply Form */}
      <Card>
        <CardContent className="pt-4">
          {user ? (
            <Form {...postForm}>
              <form onSubmit={postForm.handleSubmit(data => createPostMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={postForm.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Your Reply</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Write your reply..."
                          rows={4}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={createPostMutation.isPending}>
                  {createPostMutation.isPending ? 'Posting...' : 'Post Reply'}
                </Button>
              </form>
            </Form>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">Sign in to join the conversation</p>
              <Button onClick={redirectToLogin}>
                Sign In to Reply
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
