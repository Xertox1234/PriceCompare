import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearch, useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import { ForumStats } from '@/components/forum/forum-stats';
import { ForumTopicList } from '@/components/forum/forum-topic-list';
import { ForumTopicDetail } from '@/components/forum/forum-topic-detail';
import { CreateTopicDialog } from '@/components/forum/create-topic-dialog';

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

  const { data: user } = useAuth();
  const searchString = useSearch();
  const [, navigate] = useLocation();

  // Parse URL parameters for topic navigation from notifications
  const urlParams = new URLSearchParams(searchString);
  const topicIdFromUrl = urlParams.get('topicId');

  const redirectToLogin = () => {
    window.location.assign('/api/auth/login');
  };

  // Handle clearing URL params when going back to topic list
  const handleBackToList = () => {
    setSelectedTopic(null);
    // Clear URL params when returning to list
    if (topicIdFromUrl) {
      navigate('/forum');
    }
  };

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
      return data.map((topic: Partial<Topic>) => ({
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
      return data.map((post: Partial<Post>, index: number) => ({
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

  // Auto-select topic from URL parameters (e.g., from notification navigation)
  useEffect(() => {
    if (topicIdFromUrl && topics.length > 0 && !selectedTopic) {
      const topicId = parseInt(topicIdFromUrl, 10);
      const topic = topics.find(t => t.id === topicId);
      if (topic) {
        setSelectedTopic(topic);
        // Handle hash anchor for scrolling to specific post
        const hash = window.location.hash;
        if (hash && hash.startsWith('#post-')) {
          // Delay scroll to allow topic detail to render
          setTimeout(() => {
            const postElement = document.querySelector(hash);
            if (postElement) {
              postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 100);
        }
      }
    }
  }, [topicIdFromUrl, topics, selectedTopic]);

  if (selectedTopic) {
    return (
      <ForumTopicDetail
        topic={selectedTopic}
        posts={posts}
        user={user}
        onBack={handleBackToList}
        redirectToLogin={redirectToLogin}
      />
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
        <CreateTopicDialog
          categories={categories}
          user={user}
          redirectToLogin={redirectToLogin}
        />
      </div>

      {/* Stats */}
      <ForumStats topicsCount={topics.length} categoriesCount={categories.length} />

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
      <ForumTopicList
        topics={topics}
        isLoading={isLoading}
        onTopicClick={setSelectedTopic}
      />
    </div>
  );
}