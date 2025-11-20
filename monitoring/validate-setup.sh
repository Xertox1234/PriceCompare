#!/bin/bash
#
# Prometheus Monitoring Setup Validation Script
#
# This script validates the Prometheus monitoring setup and provides
# troubleshooting guidance.

set -e

BOLD='\033[1m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BOLD}Prometheus Monitoring Setup Validation${NC}\n"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2"
    fi
}

# 1. Check prerequisites
echo -e "${BOLD}1. Checking Prerequisites${NC}"

if command_exists docker; then
    print_status 0 "Docker installed"
else
    print_status 1 "Docker not found - Install from https://docker.com"
    exit 1
fi

if command_exists docker-compose; then
    print_status 0 "Docker Compose installed"
else
    print_status 1 "Docker Compose not found"
    exit 1
fi

if command_exists curl; then
    print_status 0 "curl installed"
else
    print_status 1 "curl not found"
fi

echo ""

# 2. Check configuration files
echo -e "${BOLD}2. Checking Configuration Files${NC}"

FILES=(
    "monitoring/prometheus.yml"
    "monitoring/alertmanager.yml"
    "monitoring/aggregation-alerts.yml"
    "docker-compose.monitoring.yml"
    "monitoring/grafana/provisioning/datasources/prometheus.yml"
    "monitoring/grafana/provisioning/dashboards/dashboards.yml"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        print_status 0 "$file exists"
    else
        print_status 1 "$file missing"
    fi
done

echo ""

# 3. Check Docker network
echo -e "${BOLD}3. Checking Docker Network${NC}"

if docker network inspect app-network >/dev/null 2>&1; then
    print_status 0 "app-network exists"
else
    print_status 1 "app-network not found - Start main app first"
    echo -e "   ${YELLOW}Run: docker-compose up -d${NC}"
fi

echo ""

# 4. Check if monitoring services are running
echo -e "${BOLD}4. Checking Monitoring Services${NC}"

SERVICES=("pricecompare-prometheus" "pricecompare-alertmanager" "pricecompare-grafana")

for service in "${SERVICES[@]}"; do
    if docker ps --format '{{.Names}}' | grep -q "^${service}$"; then
        print_status 0 "$service is running"
    else
        print_status 1 "$service not running"
        echo -e "   ${YELLOW}Run: docker-compose -f docker-compose.monitoring.yml up -d${NC}"
    fi
done

echo ""

# 5. Check service health
echo -e "${BOLD}5. Checking Service Health${NC}"

# Check Prometheus
if curl -s http://localhost:9090/-/healthy >/dev/null 2>&1; then
    print_status 0 "Prometheus is healthy (port 9090)"
else
    print_status 1 "Prometheus not accessible on port 9090"
fi

# Check AlertManager
if curl -s http://localhost:9093/-/healthy >/dev/null 2>&1; then
    print_status 0 "AlertManager is healthy (port 9093)"
else
    print_status 1 "AlertManager not accessible on port 9093"
fi

# Check Grafana
if curl -s http://localhost:3001/api/health >/dev/null 2>&1; then
    print_status 0 "Grafana is healthy (port 3001)"
else
    print_status 1 "Grafana not accessible on port 3001"
fi

echo ""

# 6. Check application metrics endpoint
echo -e "${BOLD}6. Checking Application Metrics${NC}"

if curl -s http://localhost:5000/api/aggregation-metrics/prometheus >/dev/null 2>&1; then
    print_status 0 "Application metrics endpoint accessible"

    # Count metrics
    METRIC_COUNT=$(curl -s http://localhost:5000/api/aggregation-metrics/prometheus | grep -v "^#" | wc -l)
    echo -e "   ${GREEN}Found $METRIC_COUNT metric lines${NC}"
else
    print_status 1 "Application metrics endpoint not accessible"
    echo -e "   ${YELLOW}Ensure main app is running on port 5000${NC}"
fi

echo ""

# 7. Check Prometheus targets
echo -e "${BOLD}7. Checking Prometheus Targets${NC}"

if command_exists jq && curl -s http://localhost:9090/api/v1/targets >/dev/null 2>&1; then
    TARGETS=$(curl -s http://localhost:9090/api/v1/targets | jq -r '.data.activeTargets[] | "\(.job): \(.health)"')

    if [ -n "$TARGETS" ]; then
        echo "$TARGETS" | while read -r line; do
            if [[ $line == *"up"* ]]; then
                print_status 0 "$line"
            else
                print_status 1 "$line"
            fi
        done
    else
        print_status 1 "No targets found"
    fi
else
    echo -e "${YELLOW}Skipping (requires jq and running Prometheus)${NC}"
fi

echo ""

# 8. Check alert rules
echo -e "${BOLD}8. Checking Alert Rules${NC}"

if curl -s http://localhost:9090/api/v1/rules >/dev/null 2>&1; then
    if command_exists jq; then
        ALERT_COUNT=$(curl -s http://localhost:9090/api/v1/rules | jq '.data.groups[].rules | length' | awk '{sum+=$1} END {print sum}')
        print_status 0 "Alert rules loaded ($ALERT_COUNT rules)"
    else
        print_status 0 "Alert rules endpoint accessible"
    fi
else
    print_status 1 "Cannot check alert rules"
fi

echo ""

# 9. Summary and next steps
echo -e "${BOLD}9. Summary${NC}"

echo -e "\n${BOLD}Access Dashboards:${NC}"
echo -e "  Prometheus:    http://localhost:9090"
echo -e "  AlertManager:  http://localhost:9093"
echo -e "  Grafana:       http://localhost:3001 (admin/admin)"

echo -e "\n${BOLD}Useful Commands:${NC}"
echo -e "  View logs:     docker logs pricecompare-prometheus"
echo -e "  Restart:       docker-compose -f docker-compose.monitoring.yml restart"
echo -e "  Stop:          docker-compose -f docker-compose.monitoring.yml down"

echo -e "\n${BOLD}Next Steps:${NC}"
echo -e "  1. Configure notifications in monitoring/alertmanager.yml"
echo -e "  2. Test alert delivery (see QUICKSTART.md)"
echo -e "  3. Create Grafana dashboards"
echo -e "  4. Review alert thresholds"
echo -e "  5. Set up production deployment"

echo -e "\n${BOLD}Documentation:${NC}"
echo -e "  Full Guide:  docs/PROMETHEUS_SETUP.md"
echo -e "  Quick Start: monitoring/QUICKSTART.md"
echo -e "  Reference:   monitoring/README.md"

echo ""
