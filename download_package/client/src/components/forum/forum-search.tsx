import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, MessageSquare, Hash, User, Clock, Heart, 
  Filter, SortAsc, X
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { formatDistanceToNow } from 'date-fns';

interface SearchResult {
  posts: Array<{
    id: number;
    content: string;
    topicTitle: string;
    topicId: number;
    author: {
      username: string;
      avatarUrl?: string;
      trustLevel: number;
    };
    likeCount: number;
    createdAt: string;
  }>;
  topics: Array<{
    id: number;
    title: string;
    content: string;
    postCount: number;
    author: {
      username: string;
      avatarUrl?: string;
    };
    category?: {
      name: string;
      color: string;
    };
    tags?: Array<{
      name: string;
      color: string;
    }>;
    createdAt: string;
  }>;
  users: Array<{
    id: number;
    username: string;
    bio?: string;
    avatarUrl?: string;
    trustLevel: number;
    reputation: number;
    postCount: number;
  }>;
}

interface ForumCategory {
  id: number;
  name: string;
  slug: string;
  color: string;
}

export function ForumSearch() {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('relevance');
  const [activeTab, setActiveTab] = useState('posts');
  const [showFilters, setShowFilters] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const { data: categories = [] } = useQuery({
    queryKey: ['forum-categories'],
    queryFn: async (): Promise<ForumCategory[]> => {
      const response = await apiRequest('/api/forum/categories');
      return response || [];
    },
  });

  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['forum-search', debouncedQuery, selectedCategory, sortBy],
    queryFn: async (): Promise<SearchResult> => {
      if (!debouncedQuery.trim()) {
        return { posts: [], topics: [], users: [] };
      }

      const params = new URLSearchParams();
      params.append('q', debouncedQuery);
      if (selectedCategory) params.append('categoryId', selectedCategory);
      if (sortBy !== 'relevance') params.append('sortBy', sortBy);

      const response = await apiRequest(`/api/forum/search?${params}`);
      return response || { posts: [], topics: [], users: [] };
    },
    enabled: debouncedQuery.trim().length > 0,
  });

  const { data: popularTags = [] } = useQuery({
    queryKey: ['forum-tags'],
    queryFn: async (): Promise<Array<{ name: string; usageCount: number; color: string }>> => {
      const response = await apiRequest('/api/forum/tags?limit=10');
      return response || [];
    },
  });

  const clearSearch = () => {
    setQuery('');
    setSelectedCategory('');
    setSortBy('relevance');
  };

  const getTrustLevelColor = (level: number) => {
    const colors = ['gray', 'blue', 'green', 'yellow', 'purple'];
    return colors[level] || 'gray';
  };

  const highlightText = (text: string, searchQuery: string) => {
    if (!searchQuery.trim()) return text;
    
    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200 px-1 rounded">$1</mark>');
  };

  const renderPostResult = (post: any) => (
    <Card key={post.id} className="hover:shadow-md transition-shadow cursor-pointer">
      <CardContent className="p-4">
        <div className="flex space-x-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={post.author.avatarUrl} alt={post.author.username} />
            <AvatarFallback className={`bg-${getTrustLevelColor(post.author.trustLevel)}-500 text-white`}>
              {post.author.username.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-blue-600 hover:underline">
                {post.topicTitle}
              </h4>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <Heart className="h-3 w-3" />
                <span>{post.likeCount}</span>
                <Clock className="h-3 w-3" />
                <span>{formatDistanceToNow(new Date(post.createdAt))} ago</span>
              </div>
            </div>
            
            <p className="text-sm text-gray-600 mb-2">
              by <span className="font-medium">{post.author.username}</span>
            </p>
            
            <div 
              className="text-sm text-gray-700 line-clamp-2"
              dangerouslySetInnerHTML={{ 
                __html: highlightText(post.content.substring(0, 200), debouncedQuery) 
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderTopicResult = (topic: any) => (
    <Card key={topic.id} className="hover:shadow-md transition-shadow cursor-pointer">
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <h4 
            className="font-semibold text-lg text-blue-600 hover:underline"
            dangerouslySetInnerHTML={{ 
              __html: highlightText(topic.title, debouncedQuery) 
            }}
          />
          <Badge variant="outline" className="ml-2">
            {topic.postCount} posts
          </Badge>
        </div>
        
        <div className="flex items-center space-x-4 mb-3">
          <div className="flex items-center space-x-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={topic.author.avatarUrl} alt={topic.author.username} />
              <AvatarFallback className="text-xs">
                {topic.author.username.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-gray-600">{topic.author.username}</span>
          </div>
          
          {topic.category && (
            <Badge style={{ backgroundColor: topic.category.color + '20', color: topic.category.color }}>
              {topic.category.name}
            </Badge>
          )}
          
          <span className="text-sm text-gray-500">
            {formatDistanceToNow(new Date(topic.createdAt))} ago
          </span>
        </div>
        
        {topic.content && (
          <div 
            className="text-sm text-gray-700 line-clamp-2 mb-3"
            dangerouslySetInnerHTML={{ 
              __html: highlightText(topic.content.substring(0, 150), debouncedQuery) 
            }}
          />
        )}
        
        {topic.tags && topic.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {topic.tags.map((tag: any, index: number) => (
              <Badge 
                key={index} 
                variant="outline" 
                className="text-xs"
                style={{ borderColor: tag.color, color: tag.color }}
              >
                <Hash className="h-2 w-2 mr-1" />
                {tag.name}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderUserResult = (user: any) => (
    <Card key={user.id} className="hover:shadow-md transition-shadow cursor-pointer">
      <CardContent className="p-4">
        <div className="flex items-center space-x-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={user.avatarUrl} alt={user.username} />
            <AvatarFallback className={`bg-${getTrustLevelColor(user.trustLevel)}-500 text-white font-bold`}>
              {user.username.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1">
            <h4 
              className="font-semibold text-gray-900"
              dangerouslySetInnerHTML={{ 
                __html: highlightText(user.username, debouncedQuery) 
              }}
            />
            
            {user.bio && (
              <p 
                className="text-sm text-gray-600 line-clamp-1 mt-1"
                dangerouslySetInnerHTML={{ 
                  __html: highlightText(user.bio, debouncedQuery) 
                }}
              />
            )}
            
            <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
              <span>{user.reputation} reputation</span>
              <span>{user.postCount} posts</span>
              <Badge 
                variant="outline" 
                className={`text-${getTrustLevelColor(user.trustLevel)}-600 border-${getTrustLevelColor(user.trustLevel)}-200`}
              >
                Trust Level {user.trustLevel}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Search className="h-5 w-5" />
            <span>Search Forum</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Main Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search posts, topics, and users..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 pr-10"
            />
            {query && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSearch}
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Filters Toggle */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center space-x-2"
            >
              <Filter className="h-4 w-4" />
              <span>Filters</span>
            </Button>

            <div className="flex items-center space-x-2">
              <SortAsc className="h-4 w-4 text-gray-500" />
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">Relevance</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                  <SelectItem value="most_liked">Most Liked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="p-4 bg-gray-50 rounded-lg space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Category</label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        <div className="flex items-center space-x-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: category.color }}
                          />
                          <span>{category.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {popularTags.length > 0 && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Popular Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {popularTags.map((tag) => (
                      <Badge
                        key={tag.name}
                        variant="outline"
                        className="cursor-pointer hover:bg-gray-100"
                        style={{ borderColor: tag.color, color: tag.color }}
                        onClick={() => setQuery(prev => prev + ` #${tag.name}`)}
                      >
                        <Hash className="h-2 w-2 mr-1" />
                        {tag.name}
                        <span className="ml-1 text-xs">({tag.usageCount})</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search Results */}
      {debouncedQuery && (
        <Card>
          <CardHeader>
            <CardTitle>
              Search Results for "{debouncedQuery}"
              {isLoading && <span className="ml-2 text-sm font-normal text-gray-500">Searching...</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="posts" className="flex items-center space-x-2">
                  <MessageSquare className="h-4 w-4" />
                  <span>Posts ({searchResults?.posts?.length || 0})</span>
                </TabsTrigger>
                <TabsTrigger value="topics" className="flex items-center space-x-2">
                  <Hash className="h-4 w-4" />
                  <span>Topics ({searchResults?.topics?.length || 0})</span>
                </TabsTrigger>
                <TabsTrigger value="users" className="flex items-center space-x-2">
                  <User className="h-4 w-4" />
                  <span>Users ({searchResults?.users?.length || 0})</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="posts" className="space-y-4 mt-6">
                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-24 bg-gray-200 rounded-lg"></div>
                      </div>
                    ))}
                  </div>
                ) : searchResults?.posts?.length ? (
                  searchResults.posts.map(renderPostResult)
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquare className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>No posts found matching your search</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="topics" className="space-y-4 mt-6">
                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-32 bg-gray-200 rounded-lg"></div>
                      </div>
                    ))}
                  </div>
                ) : searchResults?.topics?.length ? (
                  searchResults.topics.map(renderTopicResult)
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Hash className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>No topics found matching your search</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="users" className="space-y-4 mt-6">
                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-20 bg-gray-200 rounded-lg"></div>
                      </div>
                    ))}
                  </div>
                ) : searchResults?.users?.length ? (
                  searchResults.users.map(renderUserResult)
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <User className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>No users found matching your search</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Search Tips */}
      {!debouncedQuery && (
        <Card>
          <CardHeader>
            <CardTitle>Search Tips</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium mb-2">Basic Search</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• Use keywords to find relevant content</li>
                  <li>• Search across posts, topics, and users</li>
                  <li>• Results are ranked by relevance</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Advanced Search</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• Use <code className="bg-gray-100 px-1 rounded">#tag</code> to find tagged content</li>
                  <li>• Use <code className="bg-gray-100 px-1 rounded">@username</code> to find user mentions</li>
                  <li>• Filter by category for specific topics</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}