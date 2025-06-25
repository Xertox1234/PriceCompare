import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmbeddedForum } from '@/components/forum/embedded-forum';
import { apiRequest } from '@/lib/queryClient';
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
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Community Forum</h1>
        <p className="text-muted-foreground mt-2">
          Discuss products, share reviews, and connect with other shoppers
        </p>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">All Discussions</TabsTrigger>
          {categories?.slice(0, 4).map((category) => (
            <TabsTrigger key={category.id} value={category.slug}>
              {category.name}
            </TabsTrigger>
          ))}
        </TabsList>
        
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
        <Card>
          <CardHeader>
            <CardTitle>Forum Guidelines</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li>• Be respectful to other community members</li>
              <li>• Share honest product experiences</li>
              <li>• No spam or promotional content</li>
              <li>• Keep discussions relevant to products</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Popular Topics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Badge variant="secondary">Electronics Reviews</Badge>
              <Badge variant="secondary">Price Drop Alerts</Badge>
              <Badge variant="secondary">Shopping Tips</Badge>
              <Badge variant="secondary">Deal Discussions</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Community Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Active Discussions:</span>
                <span className="font-medium">24</span>
              </div>
              <div className="flex justify-between">
                <span>Community Members:</span>
                <span className="font-medium">156</span>
              </div>
              <div className="flex justify-between">
                <span>Products Discussed:</span>
                <span className="font-medium">89</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ForumPage;