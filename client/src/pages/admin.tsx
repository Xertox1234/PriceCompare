import { useQuery } from '@tanstack/react-query';
import type { AnalyticsOverview, UserGrowthData, ForumActivityData, TopCategoryData } from '@shared/types';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SharedNavigation } from '@/components/shared-navigation';
import { ProductManagement } from '@/components/product-management';
import { RetailerManagement } from '@/components/retailer-management';
import { AdminDashboard } from '@/components/admin/admin-dashboard';
import { AdminCategoryManagement } from '@/components/admin/admin-category-management';
import { AdminUserManagement } from '@/components/admin/admin-user-management';
import { AdminSettings } from '@/components/admin/admin-settings';
import { Settings, BarChart3, Package, Store, MessageSquare } from 'lucide-react';

interface ForumCategory {
  id: number;
  name: string;
  slug: string;
  description?: string;
  color: string;
  icon?: string;
  isActive: boolean;
  sortOrder: number;
}

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  isActive: boolean;
  reputation: number;
  createdAt: string;
}

export default function AdminPage() {
  // Fetch categories
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['/api/admin/categories'],
  });

  // Fetch users
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['/api/admin/users'],
  });

  // Analytics data
  const { data: overviewData } = useQuery<AnalyticsOverview>({
    queryKey: ['/api/admin/analytics/overview'],
  });

  const { data: userGrowthData = [] } = useQuery<UserGrowthData[]>({
    queryKey: ['/api/admin/analytics/user-growth'],
  });

  const { data: forumActivityData = [] } = useQuery<ForumActivityData[]>({
    queryKey: ['/api/admin/analytics/forum-activity'],
  });

  const { data: topCategoriesData = [] } = useQuery<TopCategoryData[]>({
    queryKey: ['/api/admin/analytics/top-categories'],
  });

  return (
    <div className="min-h-screen bg-background">
      <SharedNavigation currentPage="admin" />
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-8">
          <Settings className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Administration Panel</h1>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="dashboard" className="flex items-center gap-1">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="retailers">Retailers</TabsTrigger>
            <TabsTrigger value="categories">Forum Categories</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <AdminDashboard
              overviewData={overviewData}
              userGrowthData={userGrowthData}
              forumActivityData={forumActivityData}
              topCategoriesData={topCategoriesData}
            />
          </TabsContent>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardContent className="flex items-center p-6">
                  <BarChart3 className="h-8 w-8 text-primary" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                    <p className="text-2xl font-bold">{users.length}</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="flex items-center p-6">
                  <MessageSquare className="h-8 w-8 text-success" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Forum Categories</p>
                    <p className="text-2xl font-bold">{categories.length}</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="flex items-center p-6">
                  <Package className="h-8 w-8 text-secondary" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Products</p>
                    <p className="text-2xl font-bold">-</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="flex items-center p-6">
                  <Store className="h-8 w-8 text-warning" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Retailers</p>
                    <p className="text-2xl font-bold">-</p>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Latest forum and platform activity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No recent activity to display</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products" className="space-y-6">
            <ProductManagement />
          </TabsContent>

          <TabsContent value="retailers" className="space-y-6">
            <RetailerManagement />
          </TabsContent>

          <TabsContent value="categories" className="space-y-6">
            <AdminCategoryManagement categories={categories} isLoading={categoriesLoading} />
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <AdminUserManagement users={users} isLoading={usersLoading} />
          </TabsContent>



          <TabsContent value="settings" className="space-y-6">
            <AdminSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}