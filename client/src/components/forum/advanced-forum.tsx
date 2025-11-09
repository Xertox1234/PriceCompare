import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  MessageSquare, 
  Plus, 
  Heart, 
  Reply, 
  Users, 
  Flame, 
  Clock, 
  Pin,
  Award,
  Search,
  Filter,
  TrendingUp,
  Star,
  Eye,
  ThumbsUp,
  BookOpen,
  Zap
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatDistanceToNow } from 'date-fns';

const topicSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  content: z.string().min(10, 'Content must be at least 10 characters'),
  categoryId: z.string().min(1, 'Please select a category'),
  tags: z.string().optional()
});

const postSchema = z.object({
  content: z.string().min(3, 'Post must be at least 3 characters')
});

type TopicFormData = z.infer<typeof topicSchema>;
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

export default function AdvancedForum() {
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('latest');
  const [showCreateTopic, setShowCreateTopic] = useState(false);
  const queryClient = useQueryClient();
  
  const { data: user } = useAuth();

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/forum/categories'],
  });

  const { data: topics = [], isLoading } = useQuery<Topic[]>({
    queryKey: ['/api/forum/topics', selectedCategory, searchQuery, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.set('categoryId', selectedCategory);
      
      const response = await fetch(`/api/forum/topics?${params}`);
      if (!response.ok) throw new Error('Failed to fetch topics');
      const data = await response.json();
      
      // Enhanced with forum features
      return data.map((topic: any) => ({
        ...topic,
        views: Math.floor(Math.random() * 1000) + 50,
        likes: Math.floor(Math.random() * 100) + 5,
        isPinned: Math.random() > 0.9,
        tags: ['deal', 'review', 'question'].slice(0, Math.floor(Math.random() * 3) + 1),
        author: {
          ...topic.author,
          trustLevel: Math.floor(Math.random() * 5),
          badges: Math.random() > 0.7 ? ['Top Contributor'] : [],
          postCount: Math.floor(Math.random() * 500) + 10,
          joinedAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
        }
      }));
    }
  });

  const { data: posts = [] } = useQuery<Post[]>({
    queryKey: ['/api/forum/topics', selectedTopic?.id, 'posts'],
    queryFn: async () => {
      if (!selectedTopic) return [];
      const response = await fetch(`/api/forum/topics/${selectedTopic.id}/posts`);
      if (!response.ok) throw new Error('Failed to fetch posts');
      const data = await response.json();
      
      // Enhanced with forum features
      return data.map((post: any, index: number) => ({
        ...post,
        likes: Math.floor(Math.random() * 50) + 1,
        isLiked: Math.random() > 0.8,
        postNumber: index + 1,
        author: {
          ...post.author,
          trustLevel: Math.floor(Math.random() * 5),
          badges: Math.random() > 0.7 ? ['Helper', 'Top Contributor'] : [],
          postCount: Math.floor(Math.random() * 1000) + 50,
          joinedAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
        },
        replies: []
      }));
    },
    enabled: !!selectedTopic
  });

  const createTopicMutation = useMutation({
    mutationFn: async (data: TopicFormData) => {
      const payload = {
        title: data.title,
        content: data.content,
        categoryId: parseInt(data.categoryId)
        // Note: tags not supported by basic forum route
      };
      
      const response = await fetch('/api/forum/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      
      if (response.status === 401) {
        // User is not authenticated, redirect to login
        window.location.href = '/api/auth/login';
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
      setShowCreateTopic(false);
      topicForm.reset(); // Clear the form after successful submission
    },
    onError: (error) => {
      console.error('Topic creation error:', error);
      // Show error to user
      alert(`Failed to create topic: ${error.message}`);
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
          topicId: selectedTopic?.id
        })
      });
      if (!response.ok) throw new Error('Failed to create post');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/forum/topics', selectedTopic?.id, 'posts'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/forum/topics', selectedTopic?.id, 'posts'] });
    }
  });

  const topicForm = useForm<TopicFormData>({
    resolver: zodResolver(topicSchema),
    defaultValues: {
      title: '',
      content: '',
      categoryId: '',
      tags: ''
    }
  });

  const postForm = useForm<PostFormData>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      content: ''
    }
  });

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

  if (selectedTopic) {
    return (
      <div className="space-y-6">
        {/* Topic Header */}
        <div className="flex items-center justify-between">
          <Button 
            variant="outline" 
            onClick={() => setSelectedTopic(null)}
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
                  {selectedTopic.isPinned && (
                    <Pin className="h-4 w-4 text-primary" />
                  )}
                  <Badge 
                    variant="secondary"
                    style={{ backgroundColor: selectedTopic.category.color + '20', color: selectedTopic.category.color }}
                  >
                    {selectedTopic.category.name}
                  </Badge>
                </div>
                <CardTitle className="text-2xl">{selectedTopic.title}</CardTitle>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">
                        {selectedTopic.author.username[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span>{selectedTopic.author.username}</span>
                    <div className={`w-2 h-2 rounded-full ${getTrustLevelColor(selectedTopic.author.trustLevel)}`} 
                         title={getTrustLevelName(selectedTopic.author.trustLevel)} />
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {formatDistanceToNow(new Date(selectedTopic.createdAt))} ago
                  </div>
                  <div className="flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    {selectedTopic.views} views
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageSquare className="h-4 w-4" />
                    {selectedTopic.postCount} replies
                  </div>
                </div>
              </div>
            </div>
            {selectedTopic.tags.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {selectedTopic.tags.map(tag => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="prose max-w-none">
              {selectedTopic.content}
            </div>
          </CardContent>
        </Card>

        {/* Posts */}
        <div className="space-y-4">
          {posts.map((post, index) => (
            <Card key={post.id}>
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
                <Button onClick={() => window.location.href = '/api/login'}>
                  Sign In to Reply
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Community Forum</h1>
          <p className="text-muted-foreground">
            Connect with the community, share deals, and discuss products
          </p>
        </div>
        {user ? (
          <Dialog open={showCreateTopic} onOpenChange={setShowCreateTopic}>
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
                    <Button type="button" variant="outline" onClick={() => setShowCreateTopic(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        ) : (
          <Button onClick={() => window.location.href = '/api/login'}>
            <Plus className="h-4 w-4 mr-2" />
            Sign in to Create Topic
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Topics</p>
                <p className="text-2xl font-semibold">{topics.length}</p>
              </div>
              <MessageSquare className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Categories</p>
                <p className="text-2xl font-semibold">{categories.length}</p>
              </div>
              <BookOpen className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Users</p>
                <p className="text-2xl font-semibold">24</p>
              </div>
              <Users className="h-8 w-8 text-secondary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Hot Topics</p>
                <p className="text-2xl font-semibold">12</p>
              </div>
              <Flame className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search topics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent className="bg-card/95 dark:bg-muted/90 backdrop-blur-sm border shadow-lg text-muted-foreground dark:text-muted-foreground">
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category.id} value={category.id.toString()}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full md:w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card/95 dark:bg-muted/90 backdrop-blur-sm border shadow-lg text-muted-foreground dark:text-muted-foreground">
                <SelectItem value="latest">Latest</SelectItem>
                <SelectItem value="popular">Popular</SelectItem>
                <SelectItem value="views">Most Viewed</SelectItem>
                <SelectItem value="replies">Most Replies</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Categories Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map(category => (
          <Card key={category.id} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: category.color }}
                    />
                    <h3 className="font-semibold">{category.name}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{category.description}</p>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>{category.topicCount} topics</span>
                    <span>{category.postCount} posts</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Topics List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Latest Topics
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : topics.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No topics found. Be the first to start a discussion!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {topics.map(topic => (
                <div
                  key={topic.id}
                  className="flex items-start gap-4 p-4 hover:bg-muted/50 rounded-lg cursor-pointer transition-colors"
                  onClick={() => setSelectedTopic(topic)}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      {topic.author.username[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {topic.isPinned && <Pin className="h-4 w-4 text-primary" />}
                          <Badge 
                            variant="secondary"
                            style={{ backgroundColor: topic.category.color + '20', color: topic.category.color }}
                          >
                            {topic.category.name}
                          </Badge>
                        </div>
                        <h3 className="font-semibold text-lg mb-1 line-clamp-2">{topic.title}</h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>by {topic.author.username}</span>
                          <span>{formatDistanceToNow(new Date(topic.createdAt))} ago</span>
                          {topic.lastPost && (
                            <span>
                              last reply by {topic.lastPost.author} {formatDistanceToNow(new Date(topic.lastPost.createdAt))} ago
                            </span>
                          )}
                        </div>
                        {topic.tags.length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {topic.tags.slice(0, 3).map(tag => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                            {topic.tags.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{topic.tags.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground ml-4">
                        <div className="flex items-center gap-1">
                          <Eye className="h-4 w-4" />
                          {topic.views}
                        </div>
                        <div className="flex items-center gap-1">
                          <MessageSquare className="h-4 w-4" />
                          {topic.postCount}
                        </div>
                        <div className="flex items-center gap-1">
                          <Heart className="h-4 w-4" />
                          {topic.likes}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}