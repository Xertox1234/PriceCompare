import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmbeddedForum } from '@/components/forum/embedded-forum';
import { NotificationBell } from '@/components/forum/notification-bell';
import { ForumSearch } from '@/components/forum/forum-search';
import { apiRequest } from '@/lib/queryClient';
import { Search, Users, TrendingUp } from 'lucide-react';
import type { ForumCategory } from '@shared/schema';

function ForumPage() {
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>();

  const { data: categories, isLoading } = useQuery({
    queryKey: ['forum-categories'],
    queryFn: async (): Promise<ForumCategory[]> => {
      const response = await apiRequest('/api/forum/categories');
      return response || [];
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Header with Light Blue Theme */}
      <div className="relative bg-muted/50 rounded-xl p-6 md:p-8 text-foreground border border-border overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-2xl md:text-4xl font-bold mb-2 text-foreground">Community Forum</h1>
          <p className="text-muted-foreground text-base md:text-lg">
            Discuss products, share reviews, and connect with other shoppers
          </p>
        </div>
        <div className="absolute top-0 right-0 w-20 h-20 md:w-32 md:h-32 bg-primary/5 rounded-full -translate-y-10 translate-x-10 md:-translate-y-16 md:translate-x-16"></div>
        <div className="absolute bottom-0 left-0 w-16 h-16 md:w-24 md:h-24 bg-primary/5 rounded-full translate-y-8 -translate-x-8 md:translate-y-12 md:-translate-x-12"></div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 gap-1">
          <TabsTrigger value="all" className="text-xs md:text-sm px-2 md:px-4">
            All Discussions
          </TabsTrigger>
          <TabsTrigger value="search" className="flex items-center space-x-1 text-xs md:text-sm px-2 md:px-4">
            <Search className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Search</span>
            <span className="sm:hidden">🔍</span>
          </TabsTrigger>
          {categories?.slice(0, 4).map((category) => (
            <TabsTrigger 
              key={category.id} 
              value={category.slug}
              className="text-xs md:text-sm px-2 md:px-4 hidden md:flex"
            >
              {category.name}
            </TabsTrigger>
          ))}
        </TabsList>
        
        <TabsContent value="search" className="mt-6">
          <ForumSearch />
        </TabsContent>
        
        <TabsContent value="all" className="mt-6">
          <EmbeddedForum title="All Community Discussions" />
        </TabsContent>
        
        {categories?.map((category) => (
          <TabsContent key={category.id} value={category.slug} className="mt-6">
            <EmbeddedForum 
              categoryId={category.id} 
              title={category.name}
            />
          </TabsContent>
        ))}
      </Tabs>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        {/* Forum Guidelines Card */}
        <Card className="hover:shadow-lg transition-shadow bg-card border-border">
          <CardHeader className="bg-card">
            <CardTitle className="text-primary flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              Forum Guidelines
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 bg-card">
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 bg-success rounded-full mt-2 flex-shrink-0"></div>
                <span className="text-foreground">Be respectful to other community members</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                <span className="text-foreground">Share honest product experiences</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 bg-warning rounded-full mt-2 flex-shrink-0"></div>
                <span className="text-foreground">No spam or promotional content</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full mt-2 flex-shrink-0"></div>
                <span className="text-foreground">Keep discussions relevant to products</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Popular Topics Card */}
        <Card className="hover:shadow-lg transition-shadow bg-card border-border">
          <CardHeader className="bg-card">
            <CardTitle className="text-primary flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              Popular Topics
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 bg-card">
            <div className="space-y-3">
              <Badge className="gradient-brand text-white border-0">
                Electronics Reviews
              </Badge>
              <Badge className="gradient-deal text-white border-0">
                Price Drop Alerts
              </Badge>
              <Badge className="gradient-success text-white border-0">
                Shopping Tips
              </Badge>
              <Badge className="gradient-deal text-white border-0">
                Deal Discussions
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Community Stats Card */}
        <Card className="hover:shadow-lg transition-shadow bg-card border-border">
          <CardHeader className="bg-card">
            <CardTitle className="text-primary flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              Community Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 bg-card">
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center p-3 bg-muted border-border rounded-lg">
                <span className="text-muted-foreground">Active Discussions:</span>
                <span className="font-bold text-primary text-lg">24</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted border-border rounded-lg">
                <span className="text-muted-foreground">Community Members:</span>
                <span className="font-bold text-primary text-lg">156</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted border-border rounded-lg">
                <span className="text-muted-foreground">Products Discussed:</span>
                <span className="font-bold text-primary text-lg">89</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ForumPage;