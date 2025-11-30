import { useQuery } from '@tanstack/react-query';
import type { AnalyticsOverview, UserGrowthData, ProductActivityData, TopCategoryData } from '@shared/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SharedNavigation } from '@/components/shared-navigation';
import { ProductManagement } from '@/components/product-management';
import { RetailerManagement } from '@/components/retailer-management';
import { AdminDashboard } from '@/components/admin/admin-dashboard';
import { AdminUserManagement } from '@/components/admin/admin-user-management';
import { AdminSettings } from '@/components/admin/admin-settings';
import { Settings, BarChart3, Package, Store, Bell } from 'lucide-react';

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
  // Fetch users
  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/admin/users'],
  });

  // Analytics data
  const { data: overviewData } = useQuery<AnalyticsOverview>({
    queryKey: ['/api/admin/analytics/overview'],
  });

  const { data: userGrowthData = [] } = useQuery<UserGrowthData[]>({
    queryKey: ['/api/admin/analytics/user-growth'],
  });

  const { data: productActivityData = [] } = useQuery<ProductActivityData[]>({
    queryKey: ['/api/admin/analytics/product-activity'],
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
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="dashboard" className="flex items-center gap-1">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="retailers">Retailers</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <AdminDashboard
              overviewData={overviewData}
              userGrowthData={userGrowthData}
              productActivityData={productActivityData}
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
                  <Package className="h-8 w-8 text-success" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Products</p>
                    <p className="text-2xl font-bold">{overviewData?.totalProducts || '-'}</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="flex items-center p-6">
                  <Store className="h-8 w-8 text-secondary" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Retailers</p>
                    <p className="text-2xl font-bold">{overviewData?.totalRetailers || '-'}</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="flex items-center p-6">
                  <Bell className="h-8 w-8 text-warning" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Price Alerts</p>
                    <p className="text-2xl font-bold">{overviewData?.totalAlerts || '-'}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Latest platform activity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
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