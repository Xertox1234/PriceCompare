import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useLocation } from 'wouter';
import type {
  AnalyticsOverview,
  UserGrowthData,
  ProductActivityData,
  TopCategoryData,
} from '@shared/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SharedNavigation } from '@/components/shared-navigation';
import { ProductManagement } from '@/components/product-management';
import { RetailerManagement } from '@/components/retailer-management';
import { AdminDashboard } from '@/components/admin/admin-dashboard';
import { AdminUserManagement } from '@/components/admin/admin-user-management';
import { AdminSettings } from '@/components/admin/admin-settings';
import { Settings, BarChart3, Package, Store, Bell } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';

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
  const { data: currentUser, isLoading: authLoading } = useAuth();
  const [location, setLocation] = useLocation();

  // FIXED: Move ALL useQuery hooks to top (before any conditional returns)
  // React Rules of Hooks: Hooks must be called in the same order on every render
  const isAdmin = !authLoading && currentUser?.role === 'admin';

  // Fetch users - only when user is authenticated as admin
  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/admin/users'],
    enabled: isAdmin, // Only fetch when user is admin
  });

  // Analytics data - only when user is authenticated as admin
  const { data: overviewData } = useQuery<AnalyticsOverview>({
    queryKey: ['/api/admin/analytics/overview'],
    enabled: isAdmin, // Only fetch when user is admin
  });

  const { data: userGrowthData = [] } = useQuery<UserGrowthData[]>({
    queryKey: ['/api/admin/analytics/user-growth'],
    enabled: isAdmin, // Only fetch when user is admin
  });

  const { data: productActivityData = [] } = useQuery<ProductActivityData[]>({
    queryKey: ['/api/admin/analytics/product-activity'],
    enabled: isAdmin, // Only fetch when user is admin
  });

  const { data: topCategoriesData = [] } = useQuery<TopCategoryData[]>({
    queryKey: ['/api/admin/analytics/top-categories'],
    enabled: isAdmin, // Only fetch when user is admin
  });

  // Redirect non-admin users to home page
  useEffect(() => {
    if (!authLoading && (!currentUser || currentUser.role !== 'admin')) {
      setLocation('/');
    }
  }, [currentUser, authLoading, setLocation]);

  const activeTab = (() => {
    const match = location.match(/^\/admin(?:\/([^/]+))?$/);
    const tab = match?.[1];
    switch (tab) {
      case undefined:
      case 'dashboard':
        return 'dashboard';
      case 'overview':
      case 'products':
      case 'retailers':
      case 'users':
      case 'settings':
        return tab;
      default:
        return 'dashboard';
    }
  })();

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="bg-background min-h-screen">
        <SharedNavigation currentPage="admin" />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show access denied if not admin (before redirect kicks in)
  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="bg-background min-h-screen">
        <SharedNavigation currentPage="admin" />
        <div className="container mx-auto px-4 py-8">
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>
              You do not have permission to access the administration panel. Admin privileges are
              required.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      <SharedNavigation currentPage="admin" />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center gap-2">
          <Settings className="text-primary h-8 w-8" />
          <h1 className="text-3xl font-bold">Administration Panel</h1>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(next) => {
            setLocation(next === 'dashboard' ? '/admin' : `/admin/${next}`);
          }}
          className="space-y-6"
        >
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
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="flex items-center p-6">
                  <BarChart3 className="text-primary h-8 w-8" />
                  <div className="ml-4">
                    <p className="text-muted-foreground text-sm font-medium">Total Users</p>
                    <p className="text-2xl font-bold">{users.length}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex items-center p-6">
                  <Package className="text-success h-8 w-8" />
                  <div className="ml-4">
                    <p className="text-muted-foreground text-sm font-medium">Products</p>
                    <p className="text-2xl font-bold">{overviewData?.totalProducts || '-'}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex items-center p-6">
                  <Store className="text-secondary h-8 w-8" />
                  <div className="ml-4">
                    <p className="text-muted-foreground text-sm font-medium">Retailers</p>
                    <p className="text-2xl font-bold">{overviewData?.totalRetailers || '-'}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex items-center p-6">
                  <Bell className="text-warning h-8 w-8" />
                  <div className="ml-4">
                    <p className="text-muted-foreground text-sm font-medium">Price Alerts</p>
                    <p className="text-2xl font-bold">{overviewData?.totalAlerts || '-'}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest platform activity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-muted-foreground py-8 text-center">
                  <Package className="mx-auto mb-4 h-12 w-12 opacity-50" />
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
      </main>
    </div>
  );
}
