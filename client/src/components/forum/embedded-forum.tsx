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
    <Card className="border-0 shadow-lg">
      <CardHeader className="bg-white dark:bg-white">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-black dark:text-black">
            <div className="p-2 bg-white dark:bg-white rounded-lg border border-gray-200">
              <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-600" />
            </div>
            {title}
          </CardTitle>
          <Button
            onClick={() => setShowNewTopic(true)}
            size="sm"
            disabled={showNewTopic}
            className="bg-blue-600 hover:bg-blue-700 text-white border-0"
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
    <div className="space-y-3">
      {topics.map((topic, index) => (
        <div
          key={topic.id}
          className="bg-white dark:bg-gray-800 rounded-lg p-4 hover:shadow-md cursor-pointer transition-all duration-200 border border-gray-200 dark:border-gray-700"
          onClick={() => onSelectTopic(topic.id)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {topic.isPinned && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-full text-xs font-medium">
                    <Pin className="h-3 w-3" />
                    Pinned
                  </div>
                )}
                {topic.isLocked && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full text-xs font-medium">
                    <Lock className="h-3 w-3" />
                    Locked
                  </div>
                )}
                <h3 className="font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  {topic.title}
                </h3>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1 text-gray-700 dark:text-gray-300">
                  <div className="w-6 h-6 bg-gray-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {topic.author.username.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium">{topic.author.username}</span>
                </div>
                <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(topic.createdAt), { addSuffix: true })}
                </div>
                {topic.category && (
                  <Badge 
                    className="border-0 text-white font-medium"
                    style={{ 
                      backgroundColor: topic.category.color,
                      boxShadow: `0 2px 8px ${topic.category.color}30`
                    }}
                  >
                    {topic.category.name}
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-right">
              <Badge className="bg-gray-600 dark:bg-gray-700 text-white border-0 font-medium">
                {topic.postCount} replies
              </Badge>
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
      {posts.map((post, index) => (
        <div 
          key={post.id} 
          className="bg-white dark:bg-gray-800 rounded-lg p-4 transition-all duration-200 hover:shadow-md border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="h-10 w-10 ring-2 ring-indigo-200 dark:ring-indigo-800">
              <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-purple-500 text-white font-bold">
                {post.author.username.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="font-semibold text-gray-900 dark:text-gray-100">
                  {post.author.username}
                </div>
                {post.isFirstPost && (
                  <Badge className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0 text-xs">
                    Original Post
                  </Badge>
                )}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
              </div>
            </div>
          </div>
          <div className="ml-13 prose prose-sm max-w-none">
            <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300 leading-relaxed">
              {post.content}
            </p>
          </div>
        </div>
      ))}

      {!isLocked && (
        <form onSubmit={handleSubmit} className="rounded-lg p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-full flex items-center justify-center">
              <User className="h-4 w-4 text-white" />
            </div>
            <span className="font-medium text-gray-700 dark:text-gray-300">Add your reply</span>
          </div>
          <Textarea
            placeholder="Share your thoughts..."
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            className="mb-3 border-purple-200 dark:border-purple-800 focus:border-purple-400 dark:focus:border-purple-600"
            rows={3}
          />
          <Button 
            type="submit" 
            disabled={!newPost.trim() || isCreating}
            className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white border-0"
          >
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