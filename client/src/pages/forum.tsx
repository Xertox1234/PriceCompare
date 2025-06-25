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
      {/* Hero Header with Gradient */}
      <div className="relative bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-2xl p-8 text-white overflow-hidden">
        <div className="absolute inset-0 bg-black/10 rounded-2xl"></div>
        <div className="relative z-10">
          <h1 className="text-4xl font-bold mb-2">Community Forum</h1>
          <p className="text-blue-100 text-lg">
            Discuss products, share reviews, and connect with other shoppers
          </p>
        </div>
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
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
        {/* Forum Guidelines Card */}
        <Card className="border-l-4 border-l-blue-500 hover:shadow-lg transition-shadow">
          <CardHeader className="bg-white dark:bg-gray-900">
            <CardTitle className="text-blue-700 dark:text-blue-300 flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              Forum Guidelines
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                <span>Be respectful to other community members</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                <span>Share honest product experiences</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 bg-orange-500 rounded-full mt-2 flex-shrink-0"></div>
                <span>No spam or promotional content</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                <span>Keep discussions relevant to products</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Popular Topics Card */}
        <Card className="border-l-4 border-l-purple-500 hover:shadow-lg transition-shadow">
          <CardHeader className="bg-white dark:bg-gray-900">
            <CardTitle className="text-purple-700 dark:text-purple-300 flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              Popular Topics
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <Badge className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white border-0">
                Electronics Reviews
              </Badge>
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0">
                Price Drop Alerts
              </Badge>
              <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white border-0">
                Shopping Tips
              </Badge>
              <Badge className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white border-0">
                Deal Discussions
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Community Stats Card */}
        <Card className="border-l-4 border-l-green-500 hover:shadow-lg transition-shadow">
          <CardHeader className="bg-white dark:bg-gray-900">
            <CardTitle className="text-green-700 dark:text-green-300 flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Community Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 border rounded-lg">
                <span className="text-gray-600 dark:text-gray-300">Active Discussions:</span>
                <span className="font-bold text-blue-600 dark:text-blue-400 text-lg">24</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 border rounded-lg">
                <span className="text-gray-600 dark:text-gray-300">Community Members:</span>
                <span className="font-bold text-purple-600 dark:text-purple-400 text-lg">156</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 border rounded-lg">
                <span className="text-gray-600 dark:text-gray-300">Products Discussed:</span>
                <span className="font-bold text-green-600 dark:text-green-400 text-lg">89</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ForumPage;