import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// Textarea import removed - not currently used
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Store,
  Plus,
  Edit,
  Search,
  Globe,
  Key,
  Activity,
  Settings,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Zap
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { apiRequest } from "@/lib/queryClient";
import { DEBOUNCE_DELAY } from "@/lib/constants";

interface Retailer {
  id: number;
  name: string;
  website: string;
  logo: string;
  isActive: boolean;
  hasAPI: boolean;
  apiKey?: string;
  affiliateId?: string;
  affiliateTag?: string;
  primarySource: 'api' | 'scraping';
  healthStatus: 'healthy' | 'degraded' | 'down';
  lastSync: string;
  totalProducts: number;
  avgResponseTime: number;
  successRate: number;
  dailyRequests: number;
  rateLimitRemaining: number;
  costPerRequest: number;
}

interface CreateRetailerForm {
  name: string;
  website: string;
  logo: string;
  hasAPI: boolean;
  apiKey: string;
  affiliateId: string;
  affiliateTag: string;
}

interface HybridSystemStatus {
  totalRetailers: number;
  apiRetailers: number;
  scrapingRetailers: number;
  healthyAPIs: number;
  totalCost: number;
  totalRequests: number;
}

export function RetailerManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [_selectedRetailer, _setSelectedRetailer] = useState<Retailer | null>(null);

  // Debounce search query for better performance
  const debouncedSearchQuery = useDebounce(searchQuery, DEBOUNCE_DELAY.STANDARD);
  const [newRetailer, setNewRetailer] = useState<CreateRetailerForm>({
    name: "",
    website: "",
    logo: "",
    hasAPI: false,
    apiKey: "",
    affiliateId: "",
    affiliateTag: ""
  });

  // Fetch retailers
  const { data: retailers = [], isLoading: retailersLoading } = useQuery({
    queryKey: ['/api/admin/retailers'],
    enabled: true
  });

  // Fetch hybrid system status
  const { data: hybridStatus, isLoading: statusLoading } = useQuery<HybridSystemStatus>({
    queryKey: ['/api/hybrid/status'],
    enabled: true
  });

  // Fetch retailer capabilities
  const { data: _capabilities = [], isLoading: _capabilitiesLoading } = useQuery({
    queryKey: ['/api/hybrid/retailers/capabilities'],
    enabled: true
  });

  // Create retailer mutation
  const createRetailerMutation = useMutation({
    mutationFn: async (retailerData: CreateRetailerForm) => {
      return apiRequest('/api/admin/retailers', {
        method: 'POST',
        body: JSON.stringify(retailerData)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/retailers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/hybrid/status'] });
      setShowCreateForm(false);
      setNewRetailer({
        name: "",
        website: "",
        logo: "",
        hasAPI: false,
        apiKey: "",
        affiliateId: "",
        affiliateTag: ""
      });
      toast({
        title: "Retailer Added",
        description: "Retailer has been successfully added to the system.",
      });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to create retailer.";
      toast({
        title: "Creation Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  // Test retailer connection mutation
  const testConnectionMutation = useMutation<{ productCount?: number; responseTime?: number }, Error, number>({
    mutationFn: async (retailerId: number): Promise<{ productCount?: number; responseTime?: number }> => {
      return apiRequest<{ productCount?: number; responseTime?: number }>(`/api/hybrid/test/${retailerId}`, {
        method: 'POST',
        body: JSON.stringify({ query: 'test product' })
      });
    },
    onSuccess: (data: { productCount?: number; responseTime?: number }) => {
      toast({
        title: "Connection Test Successful",
        description: `Retrieved ${data.productCount ?? 0} products in ${data.responseTime ?? 0}ms`,
      });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to connect to retailer.";
      toast({
        title: "Connection Test Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  // Switch data source mutation
  const switchSourceMutation = useMutation({
    mutationFn: async ({ retailerId, source }: { retailerId: number; source: string }) => {
      return apiRequest(`/api/hybrid/retailer/${retailerId}/switch-source`, {
        method: 'POST',
        body: JSON.stringify({ source })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/retailers'] });
      toast({
        title: "Data Source Updated",
        description: "Retailer data source has been switched successfully.",
      });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to switch data source.";
      toast({
        title: "Switch Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  const handleCreateRetailer = (e: React.FormEvent) => {
    e.preventDefault();
    createRetailerMutation.mutate(newRetailer);
  };

  const handleTestConnection = (retailerId: number) => {
    testConnectionMutation.mutate(retailerId);
  };

  const _handleSwitchSource = (retailerId: number, source: string) => {
    switchSourceMutation.mutate({ retailerId, source });
  };

  const filteredRetailers = (retailers as Retailer[]).filter((retailer: Retailer) => {
    const matchesSearch = debouncedSearchQuery === "" ||
      retailer.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
      retailer.website.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
    
    let matchesFilter = true;
    switch (selectedFilter) {
      case "api":
        matchesFilter = retailer.hasAPI;
        break;
      case "scraping":
        matchesFilter = !retailer.hasAPI;
        break;
      case "healthy":
        matchesFilter = retailer.healthStatus === "healthy";
        break;
      case "issues":
        matchesFilter = retailer.healthStatus !== "healthy";
        break;
    }
    
    return matchesSearch && matchesFilter;
  });

  const getHealthIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "degraded":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case "down":
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getHealthBadgeVariant = (status: string) => {
    switch (status) {
      case "healthy":
        return "default";
      case "degraded":
        return "secondary";
      case "down":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="retailers" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="retailers">Retailer Management</TabsTrigger>
          <TabsTrigger value="hybrid">Hybrid System</TabsTrigger>
          <TabsTrigger value="performance">Performance Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="retailers" className="space-y-6">
          {/* Header Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" />
                Retailer Partnership Management
              </CardTitle>
              <CardDescription>
                Manage retail partners, configure API integrations, and monitor data source performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                <div className="flex flex-col sm:flex-row gap-4 flex-1">
                  {/* Search Input */}
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Search retailers..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  {/* Filter */}
                  <Select value={selectedFilter} onValueChange={setSelectedFilter}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="All Retailers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Retailers</SelectItem>
                      <SelectItem value="api">API Enabled</SelectItem>
                      <SelectItem value="scraping">Scraping Only</SelectItem>
                      <SelectItem value="healthy">Healthy</SelectItem>
                      <SelectItem value="issues">Has Issues</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Activity className="h-4 w-4 mr-2" />
                    Refresh Status
                  </Button>
                  <Button onClick={() => setShowCreateForm(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Retailer
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Create Retailer Form */}
          {showCreateForm && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Add New Retailer
                </CardTitle>
                <CardDescription>
                  Configure a new retail partner for price monitoring
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateRetailer} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="retailer-name">Retailer Name</Label>
                      <Input
                        id="retailer-name"
                        value={newRetailer.name}
                        onChange={(e) => setNewRetailer(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g., Amazon"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="retailer-website">Website URL</Label>
                      <Input
                        id="retailer-website"
                        type="url"
                        value={newRetailer.website}
                        onChange={(e) => setNewRetailer(prev => ({ ...prev, website: e.target.value }))}
                        placeholder="https://www.example.com"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="retailer-logo">Logo URL</Label>
                      <Input
                        id="retailer-logo"
                        type="url"
                        value={newRetailer.logo}
                        onChange={(e) => setNewRetailer(prev => ({ ...prev, logo: e.target.value }))}
                        placeholder="https://www.example.com/logo.png"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="has-api">API Integration</Label>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="has-api"
                          checked={newRetailer.hasAPI}
                          onCheckedChange={(checked: boolean) => setNewRetailer(prev => ({ ...prev, hasAPI: checked }))}
                        />
                        <Label htmlFor="has-api" className="text-sm text-muted-foreground">
                          Enable API integration
                        </Label>
                      </div>
                    </div>
                  </div>
                  
                  {newRetailer.hasAPI && (
                    <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                      <h4 className="font-medium">API Configuration</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="api-key">API Key</Label>
                          <Input
                            id="api-key"
                            type="password"
                            value={newRetailer.apiKey}
                            onChange={(e) => setNewRetailer(prev => ({ ...prev, apiKey: e.target.value }))}
                            placeholder="Enter API key"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="affiliate-id">Affiliate ID</Label>
                          <Input
                            id="affiliate-id"
                            value={newRetailer.affiliateId}
                            onChange={(e) => setNewRetailer(prev => ({ ...prev, affiliateId: e.target.value }))}
                            placeholder="Enter affiliate ID"
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="affiliate-tag">Affiliate Tag</Label>
                          <Input
                            id="affiliate-tag"
                            value={newRetailer.affiliateTag}
                            onChange={(e) => setNewRetailer(prev => ({ ...prev, affiliateTag: e.target.value }))}
                            placeholder="Enter affiliate tracking tag"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex gap-2 pt-4">
                    <Button type="submit" disabled={createRetailerMutation.isPending}>
                      {createRetailerMutation.isPending ? 'Creating...' : 'Create Retailer'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Retailers List */}
          <Card>
            <CardHeader>
              <CardTitle>Active Retailers ({filteredRetailers.length})</CardTitle>
              <CardDescription>
                Monitor and manage your retail partner integrations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {retailersLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading retailers...</p>
                </div>
              ) : filteredRetailers.length > 0 ? (
                <div className="space-y-4">
                  {filteredRetailers.map((retailer: Retailer) => (
                    <div key={retailer.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex gap-4 flex-1">
                          <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                            {retailer.logo ? (
                              <img 
                                src={retailer.logo} 
                                alt={retailer.name}
                                className="w-full h-full object-contain rounded-lg"
                              />
                            ) : (
                              <Store className="h-8 w-8 text-muted-foreground" />
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold">{retailer.name}</h3>
                              <Badge variant={retailer.isActive ? "default" : "secondary"}>
                                {retailer.isActive ? "Active" : "Inactive"}
                              </Badge>
                              <Badge variant={retailer.hasAPI ? "default" : "outline"}>
                                {retailer.hasAPI ? "API" : "Scraping"}
                              </Badge>
                              <Badge variant={getHealthBadgeVariant(retailer.healthStatus)}>
                                {getHealthIcon(retailer.healthStatus)}
                                <span className="ml-1 capitalize">{retailer.healthStatus}</span>
                              </Badge>
                            </div>
                            
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                              <span className="flex items-center gap-1">
                                <Globe className="h-3 w-3" />
                                {new URL(retailer.website).hostname}
                              </span>
                              <span>{retailer.totalProducts} products</span>
                              <span>{retailer.avgResponseTime}ms avg response</span>
                              <span>{retailer.successRate}% success rate</span>
                            </div>
                            
                            {retailer.hasAPI && (
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div className="bg-background border rounded p-2">
                                  <p className="text-muted-foreground">Daily Requests</p>
                                  <p className="font-medium">{retailer.dailyRequests}</p>
                                </div>
                                <div className="bg-background border rounded p-2">
                                  <p className="text-muted-foreground">Rate Limit</p>
                                  <p className="font-medium">{retailer.rateLimitRemaining} remaining</p>
                                </div>
                                <div className="bg-background border rounded p-2">
                                  <p className="text-muted-foreground">Cost/Request</p>
                                  <p className="font-medium">${retailer.costPerRequest}</p>
                                </div>
                                <div className="bg-background border rounded p-2">
                                  <p className="text-muted-foreground">Last Sync</p>
                                  <p className="font-medium">{new Date(retailer.lastSync).toLocaleDateString()}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex items-center gap-1 ml-4">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleTestConnection(retailer.id)}
                            disabled={testConnectionMutation.isPending}
                          >
                            <Zap className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Store className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">No Retailers Found</p>
                  <p className="text-sm">
                    {searchQuery || selectedFilter !== "all" 
                      ? "Try adjusting your search or filters" 
                      : "Get started by adding your first retail partner"
                    }
                  </p>
                  {(!searchQuery && selectedFilter === "all") && (
                    <Button 
                      onClick={() => setShowCreateForm(true)} 
                      className="mt-4"
                      variant="outline"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Retailer
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hybrid" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Hybrid Data Collection System
              </CardTitle>
              <CardDescription>
                Monitor the intelligent routing between API and scraping data sources
              </CardDescription>
            </CardHeader>
            <CardContent>
              {statusLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading system status...</p>
                </div>
              ) : hybridStatus ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Store className="h-5 w-5 text-blue-600" />
                        <span className="text-sm font-medium">Total Retailers</span>
                      </div>
                      <p className="text-2xl font-bold">{hybridStatus.totalRetailers}</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Key className="h-5 w-5 text-green-600" />
                        <span className="text-sm font-medium">API Enabled</span>
                      </div>
                      <p className="text-2xl font-bold">{hybridStatus.apiRetailers}</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-5 w-5 text-emerald-600" />
                        <span className="text-sm font-medium">Healthy APIs</span>
                      </div>
                      <p className="text-2xl font-bold">{hybridStatus.healthyAPIs}</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="h-5 w-5 text-orange-600" />
                        <span className="text-sm font-medium">Daily Cost</span>
                      </div>
                      <p className="text-2xl font-bold">${hybridStatus.totalCost}</p>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Unable to load system status</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Performance Analytics
              </CardTitle>
              <CardDescription>
                Monitor data source performance, costs, and optimization opportunities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">Performance Metrics</p>
                <p className="text-sm">Detailed analytics and optimization insights coming soon</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}