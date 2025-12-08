# Prometheus Monitoring - Quick Start

## 1. Start Monitoring Stack (30 seconds)

```bash
cd /Users/williamtower/projects/PriceCompare

# Start all services (app + monitoring)
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d

# Verify services are running
docker-compose -f docker-compose.monitoring.yml ps
```

Expected output:

```
NAME                       STATUS    PORTS
pricecompare-prometheus    Up        0.0.0.0:9090->9090/tcp
pricecompare-alertmanager  Up        0.0.0.0:9093->9093/tcp
pricecompare-grafana       Up        0.0.0.0:3001->3000/tcp
```

## 2. Access Dashboards

| Service          | URL                   | Credentials   |
| ---------------- | --------------------- | ------------- |
| **Prometheus**   | http://localhost:9090 | None          |
| **AlertManager** | http://localhost:9093 | None          |
| **Grafana**      | http://localhost:3001 | admin / admin |

## 3. Verify Metrics Collection

Open Prometheus: http://localhost:9090

Click **Status > Targets** - You should see:

- ✅ `price-aggregation` (1/1 up)
- ✅ `prometheus` (1/1 up)
- ✅ `alertmanager` (1/1 up)

## 4. View Current Metrics

In Prometheus, click **Graph** and try these queries:

```promql
# Success rate by operation
sum(rate(aggregation_success_total[5m])) by (operation)

# Average duration
aggregation_duration_seconds{quantile="avg"}

# Records processed in last hour
increase(aggregation_records_total[1h])
```

## 5. Check Alert Rules

Click **Alerts** in Prometheus to see:

- AggregationSuccessRateLow
- AggregationStalled
- AggregationOperationsSlow
- And 9 more...

## 6. Configure Notifications (REQUIRED for Production)

Edit `/Users/williamtower/projects/PriceCompare/monitoring/alertmanager.yml`:

```yaml
global:
  # EMAIL
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@yourdomain.com'
  smtp_auth_username: 'your-email@gmail.com'
  smtp_auth_password: 'your-app-password'

  # SLACK
  slack_api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK'
```

Restart AlertManager:

```bash
docker-compose -f docker-compose.monitoring.yml restart alertmanager
```

## 7. Test Notifications

Send a test alert:

```bash
curl -X POST http://localhost:9093/api/v1/alerts \
  -H 'Content-Type: application/json' \
  -d '[{
    "labels": {
      "alertname": "TestAlert",
      "severity": "warning",
      "component": "aggregation"
    },
    "annotations": {
      "summary": "Test notification - ignore",
      "description": "Testing alert delivery"
    }
  }]'
```

Check your email/Slack in ~30 seconds.

## 8. Create Grafana Dashboard (Optional)

1. Open http://localhost:3001
2. Login with `admin` / `admin` (change password when prompted)
3. Click **+ > Dashboard > Add visualization**
4. Select **Prometheus** datasource
5. Enter query: `aggregation_duration_seconds{quantile="avg"}`
6. Click **Apply** and **Save dashboard**

## Common Commands

```bash
# View Prometheus logs
docker logs pricecompare-prometheus

# View AlertManager logs
docker logs pricecompare-alertmanager

# Reload Prometheus config (after changes)
curl -X POST http://localhost:9090/-/reload

# Stop monitoring stack
docker-compose -f docker-compose.monitoring.yml down

# Restart monitoring stack
docker-compose -f docker-compose.monitoring.yml restart
```

## Alert Severity Guide

| Severity     | Meaning                          | Response Time        |
| ------------ | -------------------------------- | -------------------- |
| **Critical** | Service degraded, users impacted | Immediate (< 15 min) |
| **Warning**  | Issue detected, not yet critical | Next business day    |

## Key Alerts to Watch

### 🚨 AggregationStalled (CRITICAL)

- **Trigger**: No successful aggregations in 25 hours
- **Impact**: Stale price data shown to users
- **Action**: Check logs, verify job queue, trigger manually

### ⚠️ AggregationSuccessRateLow (WARNING)

- **Trigger**: Success rate < 95% for 5 minutes
- **Impact**: Some price updates failing
- **Action**: Monitor logs for error patterns

### ⚠️ AggregationOperationsSlow (WARNING)

- **Trigger**: Average duration > 60 seconds
- **Impact**: Slow price updates
- **Action**: Check database performance

## Next Steps

📖 **Full Documentation**: `/docs/PROMETHEUS_SETUP.md`

Covers:

- Complete architecture overview
- Alert rule details and runbooks
- Production deployment checklist
- Customization guide
- Comprehensive troubleshooting

## Support

Having issues? Check:

1. Application metrics: `curl http://localhost:5000/api/aggregation-metrics/prometheus`
2. Prometheus targets: http://localhost:9090/targets
3. AlertManager status: http://localhost:9093
4. Documentation: `/docs/PROMETHEUS_SETUP.md`
