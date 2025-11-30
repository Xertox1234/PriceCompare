import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Activity, AlertCircle, CheckCircle2, Database, Server, AlertTriangle } from "lucide-react";
import { io, Socket } from "socket.io-client";
import { createLogger } from "@/utils/logger";

const log = createLogger('Monitoring');

interface AgentSession {
  id: string;
  status: string;
  startedAt: string;
  [key: string]: unknown;
}

interface RecentJob {
  id: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  [key: string]: unknown;
}

interface DashboardMetrics {
  timestamp: string;
  agents: {
    total: number;
    active: number;
    inactive: number;
    sessions: AgentSession[];
  };
  jobs: {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    successRate: number;
    avgDuration: number | null;
    recentJobs: RecentJob[];
  };
  cache: {
    queryCache: {
      hits: number;
      misses: number;
      hitRate: number;
      hitRatePercent: number;
      connected: boolean;
    };
    generalCache: {
      hits: number;
      misses: number;
      hitRate: number;
      hitRatePercent: number;
      connected: boolean;
    };
    overall: {
      totalHits: number;
      totalMisses: number;
      combinedHitRate: number;
    };
  };
  products: {
    totalProducts: number;
    totalOffers: number;
    trendingDiscovered: number;
    trendingProcessed: number;
    trendingFailed: number;
  };
  locks: {
    successRate: number;
    activeLocks: number;
    avgAcquisitionTime: number;
    contentionRate: number;
  };
  health: {
    overall: "healthy" | "degraded" | "unhealthy";
    services: {
      database: boolean;
      redis: boolean;
      agents: boolean;
    };
    issues: string[];
  };
}

interface Alert {
  id: string;
  level: "info" | "warning" | "critical";
  title: string;
  message: string;
  timestamp: string;
}

export default function MonitoringDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [_socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    // Fetch initial metrics
    fetchMetrics();

    // Connect to WebSocket
    const socketInstance = io(window.location.origin, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
    });

    socketInstance.on("connect", () => {
      setConnected(true);
      log.info("✅ WebSocket connected");
    });

    socketInstance.on("disconnect", () => {
      setConnected(false);
      log.info("❌ WebSocket disconnected");
    });

    socketInstance.on("metrics:update", (data: { metrics: DashboardMetrics; timestamp: string }) => {
      setMetrics(data.metrics);
      setLastUpdate(new Date(data.timestamp).toLocaleTimeString());
    });

    socketInstance.on("alert:triggered", (alert: Alert) => {
      setAlerts((prev) => [alert, ...prev].slice(0, 10));

      // Show toast notification
      toast({
        title: alert.title,
        description: alert.message,
        variant: alert.level === "critical" ? "destructive" : "default",
      });
    });

    setSocket(socketInstance);

    // Cleanup
    return () => {
      socketInstance.disconnect();
    };
  }, [toast]);

  const fetchMetrics = async () => {
    try {
      const response = await fetch("/api/monitoring/dashboard");
      if (response.ok) {
        const result = await response.json();
        setMetrics(result.data);
        setLastUpdate(new Date().toLocaleTimeString());
      }
    } catch (error) {
      log.error("Failed to fetch metrics:", { error });
    }
  };

  if (!metrics) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Activity className="h-12 w-12 animate-spin mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  const getHealthColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "text-green-600";
      case "degraded":
        return "text-yellow-600";
      case "unhealthy":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const getHealthBadge = (status: string) => {
    switch (status) {
      case "healthy":
        return <Badge className="bg-green-600">Healthy</Badge>;
      case "degraded":
        return <Badge className="bg-yellow-600">Degraded</Badge>;
      case "unhealthy":
        return <Badge className="bg-red-600">Unhealthy</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Agent Monitoring</h1>
          <p className="text-gray-500 mt-1">Real-time system metrics and health status</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500">
            Last update: {lastUpdate}
          </div>
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} />
            <span className="text-sm">{connected ? "Connected" : "Disconnected"}</span>
          </div>
        </div>
      </div>

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className={`h-5 w-5 ${getHealthColor(metrics.health.overall)}`} />
            System Health
            {getHealthBadge(metrics.health.overall)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <Database className={`h-8 w-8 ${metrics.health.services.database ? "text-green-600" : "text-red-600"}`} />
              <div>
                <div className="font-medium">Database</div>
                <div className="text-sm text-gray-500">
                  {metrics.health.services.database ? "Connected" : "Disconnected"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Server className={`h-8 w-8 ${metrics.health.services.redis ? "text-green-600" : "text-red-600"}`} />
              <div>
                <div className="font-medium">Redis Cache</div>
                <div className="text-sm text-gray-500">
                  {metrics.health.services.redis ? "Connected" : "Disconnected"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Activity className={`h-8 w-8 ${metrics.health.services.agents ? "text-green-600" : "text-red-600"}`} />
              <div>
                <div className="font-medium">AI Agents</div>
                <div className="text-sm text-gray-500">
                  {metrics.health.services.agents ? "Active" : "Inactive"}
                </div>
              </div>
            </div>
          </div>
          {metrics.health.issues.length > 0 && (
            <div className="mt-4 p-3 bg-red-50 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <div className="font-medium text-red-900">Issues Detected</div>
                  <ul className="mt-1 text-sm text-red-700 space-y-1">
                    {metrics.health.issues.map((issue, i) => (
                      <li key={i}>• {issue}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Agents */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Active Agents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.agents.active}</div>
            <p className="text-sm text-gray-500 mt-1">
              {metrics.agents.total} total sessions
            </p>
          </CardContent>
        </Card>

        {/* Pending Jobs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Pending Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics.jobs.pending}</div>
            <p className="text-sm text-gray-500 mt-1">
              {metrics.jobs.running} running
            </p>
          </CardContent>
        </Card>

        {/* Success Rate */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {Math.round(metrics.jobs.successRate * 100)}%
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {metrics.jobs.completed} completed
            </p>
          </CardContent>
        </Card>

        {/* Cache Hit Rate */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Cache Hit Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {Math.round(metrics.cache.overall.combinedHitRate * 100)}%
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {metrics.cache.overall.totalHits} hits
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Job Queue Details */}
      <Card>
        <CardHeader>
          <CardTitle>Job Queue Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <div className="text-sm text-gray-500">Total</div>
              <div className="text-2xl font-bold mt-1">{metrics.jobs.total}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Pending</div>
              <div className="text-2xl font-bold mt-1 text-yellow-600">{metrics.jobs.pending}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Running</div>
              <div className="text-2xl font-bold mt-1 text-blue-600">{metrics.jobs.running}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Completed</div>
              <div className="text-2xl font-bold mt-1 text-green-600">{metrics.jobs.completed}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Failed</div>
              <div className="text-2xl font-bold mt-1 text-red-600">{metrics.jobs.failed}</div>
            </div>
          </div>
          {metrics.jobs.avgDuration && (
            <div className="mt-4 text-sm text-gray-500">
              Average duration: {Math.round(metrics.jobs.avgDuration / 1000)}s
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Alerts */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Recent Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.slice(0, 5).map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border ${
                    alert.level === "critical"
                      ? "bg-red-50 border-red-200"
                      : alert.level === "warning"
                      ? "bg-yellow-50 border-yellow-200"
                      : "bg-blue-50 border-blue-200"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{alert.title}</div>
                      <div className="text-sm mt-1">{alert.message}</div>
                    </div>
                    <Badge
                      className={
                        alert.level === "critical"
                          ? "bg-red-600"
                          : alert.level === "warning"
                          ? "bg-yellow-600"
                          : "bg-blue-600"
                      }
                    >
                      {alert.level}
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    {new Date(alert.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cache & Lock Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Query Cache</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Hit Rate</span>
                <span className="font-medium">{metrics.cache.queryCache.hitRatePercent}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Hits</span>
                <span className="font-medium">{metrics.cache.queryCache.hits}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Misses</span>
                <span className="font-medium">{metrics.cache.queryCache.misses}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Status</span>
                <Badge className={metrics.cache.queryCache.connected ? "bg-green-600" : "bg-red-600"}>
                  {metrics.cache.queryCache.connected ? "Connected" : "Disconnected"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distributed Locks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Success Rate</span>
                <span className="font-medium text-green-600">{metrics.locks.successRate}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Active Locks</span>
                <span className="font-medium">{metrics.locks.activeLocks}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Avg Acquisition</span>
                <span className="font-medium">{metrics.locks.avgAcquisitionTime}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Contention</span>
                <Badge className={metrics.locks.contentionRate > 0.1 ? "bg-yellow-600" : "bg-green-600"}>
                  {Math.round(metrics.locks.contentionRate * 100)}%
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Products Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trending Products</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-500">Discovered</div>
              <div className="text-2xl font-bold mt-1">{metrics.products.trendingDiscovered}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Processed</div>
              <div className="text-2xl font-bold mt-1 text-green-600">{metrics.products.trendingProcessed}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Failed</div>
              <div className="text-2xl font-bold mt-1 text-red-600">{metrics.products.trendingFailed}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Total Offers</div>
              <div className="text-2xl font-bold mt-1">{metrics.products.totalOffers}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
