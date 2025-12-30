# Prometheus Monitoring Setup Guide

> **⚠️ ARCHIVED**: This guide previously described a Docker-based monitoring setup using `docker-compose.monitoring.yml`. The Docker infrastructure has been removed from this project. The monitoring stack configurations are preserved in the `/monitoring/` directory for reference, but are no longer actively maintained. This documentation is kept for historical reference and may be useful if implementing monitoring with alternative deployment methods.

This guide covers the complete setup and operation of the Prometheus monitoring stack for the PriceCompare price aggregation system.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Configuration](#configuration)
- [Alert Rules](#alert-rules)
- [Viewing Metrics](#viewing-metrics)
- [Testing Alerts](#testing-alerts)
- [Customization](#customization)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)

## Overview

The monitoring stack provides comprehensive observability for price aggregation operations:

- **Prometheus** - Metrics collection and alerting engine
- **AlertManager** - Alert routing and notification delivery
- **Grafana** - Visualization and dashboards

### What's Monitored

- **Success Rate** - Percentage of successful aggregation operations
- **Performance** - Duration and throughput of aggregations
- **Data Quality** - Record counts and anomaly detection
- **Failures** - Error rates and patterns
- **Staleness** - Detection of stopped aggregations
- **System Health** - Overall aggregation pipeline health

## Prerequisites

Before starting, ensure you have:

1. **Docker & Docker Compose** installed
2. **Main application running** with aggregation metrics endpoint
3. **Port availability**: 9090 (Prometheus), 9093 (AlertManager), 3001 (Grafana)
4. **Network**: Existing `app-network` from main docker-compose.yml

### Verify Application Metrics

Test that metrics are available:

```bash
# Check Prometheus endpoint
curl http://localhost:5000/api/aggregation-metrics/prometheus

# Check health endpoint
curl http://localhost:5000/api/aggregation-metrics/health
```

You should see Prometheus-formatted metrics and health status.

## Quick Start

### 1. Start the Monitoring Stack

```bash
# From project root
cd /Users/williamtower/projects/PriceCompare

# Start monitoring services alongside existing services
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d

# Or start only monitoring services
docker-compose -f docker-compose.monitoring.yml up -d
```

### 2. Verify Services

Check that all services are running:

```bash
docker-compose -f docker-compose.monitoring.yml ps

# Expected output:
# NAME                       STATUS    PORTS
# pricecompare-prometheus    Up        0.0.0.0:9090->9090/tcp
# pricecompare-alertmanager  Up        0.0.0.0:9093->9093/tcp
# pricecompare-grafana       Up        0.0.0.0:3001->3000/tcp
```

### 3. Access Dashboards

- **Prometheus**: http://localhost:9090
- **AlertManager**: http://localhost:9093
- **Grafana**: http://localhost:3001 (default credentials: admin/admin)

### 4. Configure Notifications

Edit notification channels in `monitoring/alertmanager.yml`:

```yaml
global:
  # Email configuration
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@yourdomain.com'
  smtp_auth_username: 'your-email@gmail.com'
  smtp_auth_password: 'your-app-password'

  # Slack configuration
  slack_api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
```

Then reload AlertManager:

```bash
docker-compose -f docker-compose.monitoring.yml restart alertmanager
```

## Architecture

### Data Flow

```
┌─────────────────┐
│  Price-App      │
│  (Port 5000)    │
│                 │
│  Metrics:       │
│  /api/          │
│  aggregation-   │
│  metrics/       │
│  prometheus     │
└────────┬────────┘
         │
         │ Scrape every 15s
         │
         ▼
┌─────────────────┐
│  Prometheus     │
│  (Port 9090)    │
│                 │
│  - Collect      │
│  - Store (30d)  │
│  - Evaluate     │
│    alerts       │
└────────┬────────┘
         │
         │ Trigger alerts
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│  AlertManager   │─────▶│  Email       │
│  (Port 9093)    │      │  Slack       │
│                 │      │  PagerDuty   │
│  - Route        │      └──────────────┘
│  - Group        │
│  - Deduplicate  │
└─────────────────┘
         ▲
         │
         │ Query metrics
         │
┌─────────────────┐
│  Grafana        │
│  (Port 3001)    │
│                 │
│  - Dashboards   │
│  - Visualization│
│  - Alerts UI    │
└─────────────────┘
```

### Network Architecture

All services communicate on the `app-network` Docker network:

- `price-app:5000` - Application metrics endpoint
- `prometheus:9090` - Metrics collection
- `alertmanager:9093` - Alert routing
- `grafana:3000` - Visualization (exposed as 3001)

## Configuration

### Prometheus Configuration

**File**: `monitoring/prometheus.yml`

Key sections:

```yaml
# Scrape configuration for aggregation metrics
scrape_configs:
  - job_name: 'price-aggregation'
    scrape_interval: 15s
    metrics_path: '/api/aggregation-metrics/prometheus'
    static_configs:
      - targets: ['price-app:5000']
```

**Adjustable parameters**:

- `scrape_interval` - How often to collect metrics (default: 15s)
- `scrape_timeout` - Timeout for scraping (default: 10s)
- `evaluation_interval` - How often to evaluate alert rules (default: 15s)
- `retention.time` - How long to keep metrics (default: 30d)

### AlertManager Configuration

**File**: `monitoring/alertmanager.yml`

Key sections:

```yaml
route:
  # Alert grouping
  group_by: ['alertname', 'severity', 'component']
  group_wait: 10s        # Wait before sending first notification
  group_interval: 5m     # Wait before sending notifications about new alerts
  repeat_interval: 4h    # How often to resend alerts
```

**Notification receivers**:

- `default-notifications` - All alerts (email + Slack)
- `critical-alerts` - Critical severity (urgent channels)
- `warning-alerts` - Warning severity
- `aggregation-alerts` - Aggregation-specific
- `data-quality-alerts` - Data quality issues

### Alert Rules

**File**: `monitoring/aggregation-alerts.yml`

Alert rules are organized into groups:

1. **aggregation_health** - Success rate and staleness
2. **aggregation_performance** - Duration and timeouts
3. **aggregation_data_quality** - Record counts and anomalies
4. **aggregation_failures** - Error rates
5. **aggregation_retry** - Retry patterns
6. **aggregation_resources** - Queue backlogs
7. **aggregation_gaps** - Data gaps detection

## Alert Rules

### Critical Alerts

#### 1. AggregationStalled

**Trigger**: No successful aggregations in 25 hours

**Impact**: Users see stale price data

**Response**:
1. Check application logs: `docker logs pricecompare-app`
2. Check job queue: `docker exec -it redis redis-cli KEYS "bull:*"`
3. Verify database connectivity
4. Check for stuck distributed locks: `docker exec -it redis redis-cli KEYS "lock:*"`
5. Manual trigger if needed

```bash
# Check last successful aggregation
curl http://localhost:5000/api/aggregation-metrics/stats

# Manually trigger aggregation (if endpoint exists)
curl -X POST http://localhost:5000/api/admin/trigger-aggregation
```

#### 2. AggregationNoRecordsProcessed

**Trigger**: Zero records aggregated for 2 hours

**Impact**: Data pipeline broken

**Response**:
1. Check source data tables in database
2. Verify date range calculations
3. Check query logic in aggregation service
4. Review recent code changes

#### 3. AggregationHighFailureRate

**Trigger**: Failure rate > 10% for 10 minutes

**Impact**: Unreliable price data

**Response**:
1. Check error logs for patterns
2. Investigate database connection issues
3. Check resource constraints (memory, CPU)
4. Review recent deployments

### Warning Alerts

#### 1. AggregationSuccessRateLow

**Trigger**: Success rate < 95% for 5 minutes

**Response**:
- Monitor for escalation
- Review error patterns in logs
- Check external dependencies (database, Redis)

#### 2. AggregationOperationsSlow

**Trigger**: Average duration > 60 seconds for 10 minutes

**Response**:
- Check database query performance
- Review recent data volume changes
- Monitor system resources
- Consider query optimization

#### 3. AggregationRecordCountAnomaly

**Trigger**: Record count < 50% of 7-day average

**Response**:
- Investigate data sources
- Check for data pipeline issues
- Review filtering logic
- Verify data quality

## Viewing Metrics

### Prometheus UI

Access: http://localhost:9090

**Useful queries**:

```promql
# Current success rate by operation
sum(rate(aggregation_success_total[5m])) by (operation)
/
(sum(rate(aggregation_success_total[5m])) by (operation) + sum(rate(aggregation_failure_total[5m])) by (operation))

# Average duration in seconds
aggregation_duration_seconds{quantile="avg"}

# Total records processed per hour
increase(aggregation_records_total[1h])

# Failure rate over time
rate(aggregation_failure_total[5m])
```

**Navigate to**:
- **Graph** - Query and visualize metrics
- **Alerts** - View active/pending alerts
- **Status > Targets** - Check scrape health
- **Status > Configuration** - View loaded config

### Grafana Dashboards

Access: http://localhost:3001 (admin/admin)

**Pre-configured datasource**: Prometheus is auto-configured

**Create a dashboard**:

1. Click "+" > "Dashboard"
2. Click "Add visualization"
3. Select "Prometheus" datasource
4. Enter a query (see examples above)
5. Customize visualization
6. Save dashboard

**Recommended panels**:

- **Success Rate Gauge** - Current success rate (target: 95%+)
- **Operation Duration Graph** - Time series of durations
- **Records Processed Counter** - Total records over time
- **Failure Rate Heatmap** - Error patterns
- **Alert Status Table** - Current alerts

### AlertManager UI

Access: http://localhost:9093

**Features**:
- View active alerts
- Silence alerts temporarily
- Check notification status
- View alert history

## Testing Alerts

### Test Alert Rules

Use Prometheus to evaluate alert expressions:

```bash
# Test success rate alert
curl -G 'http://localhost:9090/api/v1/query' \
  --data-urlencode 'query=(sum(rate(aggregation_success_total[5m])) by (operation) / (sum(rate(aggregation_success_total[5m])) by (operation) + sum(rate(aggregation_failure_total[5m])) by (operation))) < 0.95'

# Test stalled alert
curl -G 'http://localhost:9090/api/v1/query' \
  --data-urlencode 'query=increase(aggregation_success_total[25h]) == 0'
```

### Simulate Alert Conditions

**Trigger slow aggregation alert**:

```bash
# Generate slow operations by adding artificial delay
# (requires code modification for testing)
```

**Trigger failure alert**:

```bash
# Cause failures by disconnecting database temporarily
docker-compose pause postgres

# Wait for failures to accumulate
sleep 60

# Restore database
docker-compose unpause postgres
```

### Test Notifications

**Send test alert**:

```bash
# Use AlertManager API to send test alert
curl -X POST http://localhost:9093/api/v1/alerts \
  -H 'Content-Type: application/json' \
  -d '[{
    "labels": {
      "alertname": "TestAlert",
      "severity": "warning",
      "component": "aggregation",
      "operation": "test"
    },
    "annotations": {
      "summary": "Test alert from Prometheus setup",
      "description": "This is a test alert to verify notification channels"
    }
  }]'
```

Check your email/Slack for the test notification.

## Customization

### Adding Custom Metrics

**Step 1**: Expose metrics in application

```typescript
// server/services/aggregation-metrics.ts
export interface AggregationMetric {
  // Add custom field
  customMetric?: number;
}
```

**Step 2**: Update Prometheus export

```typescript
// In exportPrometheus() method
lines.push(`aggregation_custom_metric{operation="${operation}"} ${customValue}`);
```

**Step 3**: Create alert rule

```yaml
# monitoring/aggregation-alerts.yml
- alert: CustomMetricThreshold
  expr: aggregation_custom_metric > 100
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Custom metric exceeded threshold"
```

### Adding New Alert Receivers

**Step 1**: Add receiver configuration

```yaml
# monitoring/alertmanager.yml
receivers:
  - name: 'pagerduty-critical'
    pagerduty_configs:
      - service_key: 'YOUR_PAGERDUTY_KEY'
        description: '{{ .CommonAnnotations.summary }}'
```

**Step 2**: Add routing rule

```yaml
route:
  routes:
    - match:
        severity: critical
      receiver: 'pagerduty-critical'
```

**Step 3**: Reload AlertManager

```bash
docker-compose -f docker-compose.monitoring.yml restart alertmanager
```

### Adjusting Alert Thresholds

Edit `monitoring/aggregation-alerts.yml`:

```yaml
# Lower success rate threshold from 95% to 90%
- alert: AggregationSuccessRateLow
  expr: (...) < 0.90  # Changed from 0.95
  for: 5m
```

Reload Prometheus:

```bash
# Using lifecycle API (enabled in docker-compose)
curl -X POST http://localhost:9090/-/reload
```

## Production Deployment

### Security Hardening

**1. Change default credentials**

```yaml
# docker-compose.monitoring.yml - Grafana
environment:
  - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}
```

**2. Enable TLS/SSL**

Add reverse proxy (nginx) configuration:

```nginx
server {
  listen 443 ssl;
  server_name prometheus.yourdomain.com;

  ssl_certificate /etc/ssl/certs/prometheus.crt;
  ssl_certificate_key /etc/ssl/private/prometheus.key;

  location / {
    proxy_pass http://prometheus:9090;
    proxy_set_header Host $host;
  }
}
```

**3. Add authentication**

Enable basic auth in Prometheus:

```yaml
# monitoring/prometheus.yml
basic_auth_users:
  prometheus: '$2y$10$...'  # bcrypt hash
```

Generate password hash:

```bash
htpasswd -nBC 10 "" | tr -d ':\n'
```

### High Availability Setup

**1. Deploy multiple Prometheus instances**

```yaml
# docker-compose.monitoring.yml
prometheus-1:
  # ... config
prometheus-2:
  # ... config (same scrape targets)
```

**2. Configure AlertManager clustering**

```yaml
# docker-compose.monitoring.yml
alertmanager-1:
  command:
    - '--cluster.peer=alertmanager-2:9094'

alertmanager-2:
  command:
    - '--cluster.peer=alertmanager-1:9094'
```

**3. Use external storage**

For long-term metrics retention:

```yaml
# Use Thanos, Cortex, or VictoriaMetrics
# See: https://thanos.io/
```

### Resource Limits

Add resource constraints:

```yaml
# docker-compose.monitoring.yml
prometheus:
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 4G
      reservations:
        cpus: '1'
        memory: 2G
```

### Backup & Restore

**Backup Prometheus data**:

```bash
# Backup Prometheus TSDB
docker run --rm \
  -v pricecompare_prometheus-data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/prometheus-$(date +%Y%m%d).tar.gz /data

# Backup AlertManager state
docker run --rm \
  -v pricecompare_alertmanager-data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/alertmanager-$(date +%Y%m%d).tar.gz /data
```

**Restore**:

```bash
# Stop services
docker-compose -f docker-compose.monitoring.yml down

# Restore data
docker run --rm \
  -v pricecompare_prometheus-data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar xzf /backup/prometheus-20250120.tar.gz -C /

# Restart services
docker-compose -f docker-compose.monitoring.yml up -d
```

### Production Checklist

- [ ] Changed default Grafana password
- [ ] Configured SMTP for email alerts
- [ ] Configured Slack/PagerDuty webhooks
- [ ] Set up TLS/SSL certificates
- [ ] Enabled authentication on Prometheus
- [ ] Configured backup automation
- [ ] Set resource limits
- [ ] Tested failover scenarios
- [ ] Documented runbook URLs
- [ ] Configured retention policies
- [ ] Set up log aggregation
- [ ] Created on-call rotation

## Troubleshooting

### Prometheus Not Scraping Targets

**Symptom**: Targets show as "DOWN" in Prometheus UI

**Check**:

1. Verify target is reachable:
   ```bash
   docker exec -it pricecompare-prometheus wget -O- http://price-app:5000/api/aggregation-metrics/prometheus
   ```

2. Check scrape configuration:
   ```bash
   docker exec -it pricecompare-prometheus cat /etc/prometheus/prometheus.yml
   ```

3. Check Prometheus logs:
   ```bash
   docker logs pricecompare-prometheus
   ```

**Common causes**:
- Application not running
- Wrong port or path in config
- Network connectivity issues
- Firewall blocking access

### Alerts Not Firing

**Symptom**: Metrics show issue but no alerts

**Check**:

1. Verify alert rules loaded:
   ```bash
   curl http://localhost:9090/api/v1/rules
   ```

2. Check alert evaluation:
   - Go to Prometheus > Alerts
   - Look for "Pending" alerts
   - Check "for" duration

3. Test alert expression manually:
   ```bash
   # Run the alert expression in Prometheus UI > Graph
   ```

**Common causes**:
- Alert rule syntax error
- "for" duration not elapsed
- Alert expression doesn't match data
- Alert rules file not mounted

### Notifications Not Received

**Symptom**: Alerts firing but no notifications

**Check**:

1. Verify AlertManager receiving alerts:
   ```bash
   curl http://localhost:9093/api/v1/alerts
   ```

2. Check AlertManager logs:
   ```bash
   docker logs pricecompare-alertmanager
   ```

3. Test notification channel:
   ```bash
   # Send test alert (see Testing Alerts section)
   ```

**Common causes**:
- SMTP credentials incorrect
- Slack webhook URL invalid
- Alert routing rules not matching
- Email/Slack blocked by firewall

### High Prometheus Memory Usage

**Symptom**: Prometheus container using excessive memory

**Solutions**:

1. Reduce retention time:
   ```yaml
   # prometheus.yml
   storage:
     tsdb:
       retention.time: 7d  # Reduce from 30d
   ```

2. Reduce cardinality:
   - Limit labels in metrics
   - Use `metric_relabel_configs` to drop labels

3. Increase resource limits:
   ```yaml
   # docker-compose.monitoring.yml
   deploy:
     resources:
       limits:
         memory: 8G
   ```

### Grafana Dashboard Not Loading Data

**Symptom**: Dashboard panels show "No data"

**Check**:

1. Verify datasource configured:
   - Grafana > Configuration > Data sources
   - Click "Prometheus" > "Test"

2. Check query syntax:
   - Edit panel
   - Run query manually

3. Verify time range:
   - Check dashboard time picker
   - Ensure metrics exist for selected time

**Common causes**:
- Prometheus datasource not configured
- Invalid PromQL query
- No data for selected time range
- Prometheus not scraping successfully

### Container Health Checks Failing

**Check container status**:

```bash
docker-compose -f docker-compose.monitoring.yml ps

# Check individual container health
docker inspect pricecompare-prometheus | grep -A 20 Health
```

**View health check logs**:

```bash
docker logs pricecompare-prometheus 2>&1 | grep health
```

## Additional Resources

### Documentation

- [Prometheus Documentation](https://prometheus.io/docs/)
- [AlertManager Guide](https://prometheus.io/docs/alerting/latest/alertmanager/)
- [Grafana Documentation](https://grafana.com/docs/)
- [PromQL Cheat Sheet](https://promlabs.com/promql-cheat-sheet/)

### Grafana Dashboard Examples

- [Prometheus Stats Dashboard](https://grafana.com/grafana/dashboards/3662)
- [AlertManager Dashboard](https://grafana.com/grafana/dashboards/9578)

### Runbook Examples

Create runbooks for each alert at:

```
docs/runbooks/
├── aggregation-stalled.md
├── aggregation-slow.md
├── aggregation-failures.md
└── aggregation-gaps.md
```

### Monitoring Best Practices

1. **Define SLOs** - Set clear service level objectives
2. **Alert on symptoms** - Not causes (alert on user impact)
3. **Reduce noise** - Group related alerts, use inhibition rules
4. **Test regularly** - Run chaos engineering tests
5. **Document runbooks** - Clear response procedures for each alert
6. **Review alerts** - Regular retrospectives on alert quality
7. **Monitor the monitors** - Ensure monitoring stack is healthy

## Support

For issues or questions:

- **Application Issues**: Check application logs and metrics
- **Monitoring Setup**: Review this documentation
- **Prometheus/Grafana**: Refer to official documentation
- **Alerting Logic**: Review alert rules in `monitoring/aggregation-alerts.yml`

## Changelog

- **2025-01-20**: Initial monitoring stack setup
  - Prometheus metrics collection
  - AlertManager notification routing
  - Grafana visualization platform
  - 12 alert rules covering all aggregation scenarios
  - Complete documentation and runbooks
