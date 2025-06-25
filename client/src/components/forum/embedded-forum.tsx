import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MessageSquare, Plus, Clock, User, Pin, Lock } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { formatDistanceToNow } from 'date-fns';
import type { ForumTopicWithDetails, ForumPostWithAuthor } from '@/shared/schema';

interface EmbeddedForumProps {
  productId?: number;
  categoryId?: number;
  title?: string;
}

export function EmbeddedForum({ productId, categoryId, title = "Community Discussion" }: EmbeddedForumProps) {
  const [showNewTopic, setShowNewTopic] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<number | null>(null);
  const queryClient = useQueryClient();

  // Fetch topics
  const { data: topics, isLoading: topicsLoading } = useQuery({
    queryKey: ['forum-topics', { categoryId, productId }],
    queryFn: async (): Promise<ForumTopicWithDetails[]> => {
      const params = new URLSearchParams();
      if (categoryId) params.append('categoryId', categoryId.toString());
      if (productId) params.append('productId', productId.toString());
      
      const response = await apiRequest(`/api/forum/topics?${params}`);
      return response || [];
    },
  });

  // Fetch posts for selected topic
  const { data: posts, isLoading: postsLoading } = useQuery({
    queryKey: ['forum-posts', selectedTopic],
    queryFn: async (): Promise<ForumPostWithAuthor[]> => {
      if (!selectedTopic) return [];
      const response = await apiRequest(`/api/forum/topics/${selectedTopic}/posts`);
      return response || [];
    },
    enabled: !!selectedTopic,
  });

  // Create topic mutation
  const createTopicMutation = useMutation({
    mutationFn: async (data: { title: string; content: string }) => {
      return apiRequest('/api/forum/topics', {
        method: 'POST',
        body: JSON.stringify({
          title: data.title,
          content: data.content,
          categoryId,
          productId,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-topics'] });
      setShowNewTopic(false);
    },
  });

  // Create post mutation
  const createPostMutation = useMutation({
    mutationFn: async (data: { content: string; topicId: number }) => {
      return apiRequest('/api/forum/posts', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-posts'] });
      queryClient.invalidateQueries({ queryKey: ['forum-topics'] });
    },
  });

  if (selectedTopic) {
    const topic = topics?.find(t => t.id === selectedTopic);
    
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTopic(null)}
                className="mb-2"
              >
                ← Back to topics
              </Button>
              <CardTitle className="flex items-center gap-2">
                {topic?.isPinned && <Pin className="h-4 w-4 text-yellow-500" />}
                {topic?.isLocked && <Lock className="h-4 w-4 text-red-500" />}
                {topic?.title}
              </CardTitle>
            </div>
            <Badge variant="secondary">
              {topic?.postCount || 0} posts
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <TopicPosts 
            posts={posts || []} 
            loading={postsLoading}
            onCreatePost={(content) => 
              createPostMutation.mutate({ content, topicId: selectedTopic })
            }
            isLocked={topic?.isLocked}
            isCreating={createPostMutation.isPending}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {title}
          </CardTitle>
          <Button
            onClick={() => setShowNewTopic(true)}
            size="sm"
            disabled={showNewTopic}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Topic
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {showNewTopic && (
          <NewTopicForm
            onSubmit={(data) => createTopicMutation.mutate(data)}
            onCancel={() => setShowNewTopic(false)}
            isCreating={createTopicMutation.isPending}
          />
        )}
        
        <TopicList 
          topics={topics || []} 
          loading={topicsLoading}
          onSelectTopic={setSelectedTopic}
        />
      </CardContent>
    </Card>
  );
}

function TopicList({ 
  topics, 
  loading, 
  onSelectTopic 
}: { 
  topics: ForumTopicWithDetails[];
  loading: boolean;
  onSelectTopic: (id: number) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!topics.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No discussions yet. Be the first to start a conversation!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {topics.map((topic) => (
        <div
          key={topic.id}
          className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer"
          onClick={() => onSelectTopic(topic.id)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {topic.isPinned && <Pin className="h-4 w-4 text-yellow-500" />}
                {topic.isLocked && <Lock className="h-4 w-4 text-red-500" />}
                <h3 className="font-medium">{topic.title}</h3>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {topic.author.username}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(topic.createdAt), { addSuffix: true })}
                </div>
                {topic.category && (
                  <Badge variant="outline" style={{ color: topic.category.color }}>
                    {topic.category.name}
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-right">
              <Badge variant="secondary">{topic.postCount} posts</Badge>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TopicPosts({ 
  posts, 
  loading, 
  onCreatePost, 
  isLocked,
  isCreating 
}: { 
  posts: ForumPostWithAuthor[];
  loading: boolean;
  onCreatePost: (content: string) => void;
  isLocked?: boolean;
  isCreating: boolean;
}) {
  const [newPost, setNewPost] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPost.trim()) {
      onCreatePost(newPost.trim());
      setNewPost('');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
              <div className="h-4 bg-gray-200 rounded w-24"></div>
            </div>
            <div className="h-16 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <div key={post.id} className="border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback>
                {post.author.username.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">{post.author.username}</div>
              <div className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
              </div>
            </div>
            {post.isFirstPost && (
              <Badge variant="outline" className="ml-auto">
                Original Post
              </Badge>
            )}
          </div>
          <div className="prose prose-sm max-w-none">
            <p className="whitespace-pre-wrap">{post.content}</p>
          </div>
        </div>
      ))}

      {!isLocked && (
        <form onSubmit={handleSubmit} className="border rounded-lg p-4 bg-muted/20">
          <Textarea
            placeholder="Share your thoughts..."
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            className="mb-3"
            rows={3}
          />
          <Button type="submit" disabled={!newPost.trim() || isCreating}>
            {isCreating ? 'Posting...' : 'Post Reply'}
          </Button>
        </form>
      )}
    </div>
  );
}

function NewTopicForm({ 
  onSubmit, 
  onCancel, 
  isCreating 
}: { 
  onSubmit: (data: { title: string; content: string }) => void;
  onCancel: () => void;
  isCreating: boolean;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim() && content.trim()) {
      onSubmit({ title: title.trim(), content: content.trim() });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border rounded-lg p-4 mb-6 bg-muted/20">
      <div className="space-y-4">
        <div>
          <Input
            placeholder="Topic title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="font-medium"
          />
        </div>
        <div>
          <Textarea
            placeholder="Start the discussion..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={!title.trim() || !content.trim() || isCreating}>
            {isCreating ? 'Creating...' : 'Create Topic'}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </form>
  );
}