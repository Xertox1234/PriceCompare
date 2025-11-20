# Monitoring Configuration

This directory contains Prometheus monitoring stack configurations for the PriceCompare application.

## Quick Start

```bash
# Start monitoring stack
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d

# Access dashboards
open http://localhost:9090   # Prometheus
open http://localhost:9093   # AlertManager
open http://localhost:3001   # Grafana (admin/admin)
```

## Directory Structure

```
monitoring/
├── prometheus.yml              # Prometheus scrape config
├── alertmanager.yml           # Alert routing & notifications
├── aggregation-alerts.yml     # Alert rules for price aggregation
├── grafana/
│   ├── provisioning/
│   │   ├── datasources/       # Auto-configure Prometheus
│   │   └── dashboards/        # Auto-load dashboards
│   └── dashboards/            # JSON dashboard definitions
└── README.md                  # This file
```

## Configuration Files

### prometheus.yml
- Scrapes metrics from `/api/aggregation-metrics/prometheus` every 15s
- Evaluates alert rules every 15s
- Retains metrics for 30 days
- Sends alerts to AlertManager

### alertmanager.yml
- Routes alerts based on severity and component
- Sends notifications via Email and Slack
- Groups alerts to reduce noise
- Supports critical, warning, and info severity levels

**IMPORTANT**: Update SMTP and Slack credentials before production use!

### aggregation-alerts.yml
- 12+ alert rules covering:
  - Success rate monitoring
  - Performance degradation
  - Data staleness detection
  - Record count anomalies
  - Failure rate tracking
  - Data gap detection

## Notification Channels

Before deploying to production, configure these in `alertmanager.yml`:

1. **Email (SMTP)**:
   ```yaml
   smtp_smarthost: 'smtp.gmail.com:587'
   smtp_auth_username: 'your-email@example.com'
   smtp_auth_password: 'your-app-password'
   ```

2. **Slack**:
   ```yaml
   slack_api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK'
   ```

3. **PagerDuty** (optional):
   See alertmanager.yml for receiver configuration examples

## Alert Severity Levels

- **Critical** - Immediate attention required (AggregationStalled, NoRecordsProcessed)
- **Warning** - Monitor closely (SuccessRateLow, OperationsSlow)
- **Info** - Informational only

## Metrics Available

- `aggregation_duration_seconds{operation,quantile}` - Operation duration
- `aggregation_records_total{operation}` - Records processed
- `aggregation_success_total{operation}` - Successful operations
- `aggregation_failure_total{operation}` - Failed operations

## Testing

### Test Alert Rules
```bash
# Verify Prometheus loaded alerts
curl http://localhost:9090/api/v1/rules | jq '.data.groups[].rules[].name'

# Check alert status
curl http://localhost:9090/api/v1/alerts
```

### Test Notifications
```bash
# Send test alert to AlertManager
curl -X POST http://localhost:9093/api/v1/alerts \
  -H 'Content-Type: application/json' \
  -d '[{
    "labels": {"alertname": "TestAlert", "severity": "warning"},
    "annotations": {"summary": "Test alert"}
  }]'
```

## Useful Commands

```bash
# View Prometheus logs
docker logs pricecompare-prometheus

# Reload Prometheus config
curl -X POST http://localhost:9090/-/reload

# View AlertManager logs
docker logs pricecompare-alertmanager

# Restart monitoring stack
docker-compose -f docker-compose.monitoring.yml restart

# Stop monitoring stack
docker-compose -f docker-compose.monitoring.yml down

# View metrics
docker exec -it pricecompare-prometheus promtool check config /etc/prometheus/prometheus.yml
docker exec -it pricecompare-alertmanager amtool check-config /etc/alertmanager/alertmanager.yml
```

## Documentation

See `/docs/PROMETHEUS_SETUP.md` for complete documentation including:
- Architecture overview
- Alert rule details and runbooks
- Customization guide
- Production deployment checklist
- Troubleshooting guide

## Grafana Dashboards

After starting Grafana:

1. Login at http://localhost:3001 (admin/admin)
2. Prometheus datasource is auto-configured
3. Create dashboards or import from Grafana.com

### Recommended Dashboard Panels

- **Success Rate Gauge**: `sum(rate(aggregation_success_total[5m])) / (sum(rate(aggregation_success_total[5m])) + sum(rate(aggregation_failure_total[5m])))`
- **Duration Graph**: `aggregation_duration_seconds{quantile="avg"}`
- **Records Processed**: `increase(aggregation_records_total[1h])`
- **Failure Rate**: `rate(aggregation_failure_total[5m])`

## Production Checklist

Before deploying to production:

- [ ] Update SMTP credentials in `alertmanager.yml`
- [ ] Update Slack webhook in `alertmanager.yml`
- [ ] Change Grafana admin password
- [ ] Review and adjust alert thresholds
- [ ] Test all notification channels
- [ ] Set up TLS/SSL for external access
- [ ] Configure backup for Prometheus data
- [ ] Document on-call procedures
- [ ] Create runbook URLs for each alert

## Support

For issues or questions:
- Application metrics: Check `/api/aggregation-metrics/*` endpoints
- Prometheus issues: Review Prometheus logs and targets page
- Alert issues: Check AlertManager UI and logs
- Dashboard issues: Verify Grafana datasource connection

See `/docs/PROMETHEUS_SETUP.md` for comprehensive troubleshooting guide.
