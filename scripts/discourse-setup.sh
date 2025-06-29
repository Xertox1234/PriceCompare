#!/bin/bash

# Discourse Integration Setup Script
# This script automates the setup of the full Discourse integration

set -e

echo "🚀 Starting Discourse Integration Setup..."

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_requirements() {
    print_status "Checking requirements..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    if ! command -v openssl &> /dev/null; then
        print_error "OpenSSL is not installed. Please install OpenSSL first."
        exit 1
    fi
    
    print_success "All requirements are satisfied"
}

# Generate secure secrets
generate_secrets() {
    print_status "Generating secure secrets..."
    
    # Generate SSO secret
    SSO_SECRET=$(openssl rand -hex 32)
    print_success "Generated SSO secret"
    
    # Generate session secret
    SESSION_SECRET=$(openssl rand -hex 32)
    print_success "Generated session secret"
    
    # Generate database password
    DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    print_success "Generated database password"
    
    # Generate Discourse database password
    DISCOURSE_DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    print_success "Generated Discourse database password"
}

# Create environment file
create_env_file() {
    print_status "Creating environment configuration..."
    
    if [ -f .env ]; then
        print_warning ".env file already exists. Creating backup..."
        cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    fi
    
    cat > .env << EOF
# Database Configuration
DATABASE_URL=postgresql://postgres:${DB_PASSWORD}@postgres:5432/price_db
POSTGRES_PASSWORD=${DB_PASSWORD}

# Discourse Configuration
DISCOURSE_URL=http://localhost:3000
DISCOURSE_SSO_SECRET=${SSO_SECRET}
DISCOURSE_API_KEY=your_discourse_api_key_here
DISCOURSE_DB_PASSWORD=${DISCOURSE_DB_PASSWORD}

# Session Configuration
SESSION_SECRET=${SESSION_SECRET}

# SMTP Configuration (Update with your SMTP settings)
SMTP_ADDRESS=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password

# Admin Configuration
ADMIN_EMAIL=admin@localhost

# External API Keys (Optional - update as needed)
OPENAI_API_KEY=your_openai_api_key
GOOGLE_CUSTOM_SEARCH_API_KEY=your_google_search_api_key
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id
EOF
    
    print_success "Environment file created"
}

# Initialize database schema
init_database() {
    print_status "Initializing database schema..."
    
    # Start only the database first
    docker-compose up -d postgres
    
    # Wait for database to be ready
    print_status "Waiting for database to be ready..."
    sleep 10
    
    # Run database initialization
    docker-compose exec -T postgres psql -U postgres -d price_db < init-db.sql 2>/dev/null || true
    
    print_success "Database schema initialized"
}

# Start all services
start_services() {
    print_status "Starting all services..."
    
    # Build and start all services
    docker-compose up -d
    
    print_status "Waiting for services to start..."
    sleep 30
    
    # Check service status
    if docker-compose ps | grep -q "Up"; then
        print_success "Services started successfully"
    else
        print_error "Some services failed to start"
        docker-compose logs
        exit 1
    fi
}

# Test the integration
test_integration() {
    print_status "Testing the integration..."
    
    # Test main app
    if curl -f http://localhost:5000/health &> /dev/null; then
        print_success "Price comparison app is running"
    else
        print_warning "Price comparison app health check failed"
    fi
    
    # Test Discourse health endpoint
    if curl -f http://localhost:5000/api/discourse/health &> /dev/null; then
        print_success "Discourse integration endpoint is working"
    else
        print_warning "Discourse integration endpoint check failed"
    fi
    
    # Test Discourse (may take longer to start)
    print_status "Checking Discourse status (this may take a few minutes)..."
    for i in {1..12}; do
        if curl -f http://localhost:3000 &> /dev/null; then
            print_success "Discourse is running"
            break
        else
            if [ $i -eq 12 ]; then
                print_warning "Discourse is still starting up. Check logs with: docker-compose logs discourse"
            else
                sleep 15
            fi
        fi
    done
}

# Display next steps
show_next_steps() {
    echo
    echo "🎉 Discourse Integration Setup Complete!"
    echo
    echo "Next steps:"
    echo "1. Update SMTP settings in .env file for email notifications"
    echo "2. Access the main app at: http://localhost:5000"
    echo "3. Access Discourse at: http://localhost:3000"
    echo "4. Complete Discourse admin setup when prompted"
    echo "5. Configure SSO in Discourse admin panel:"
    echo "   - Go to Admin → Settings → Login"
    echo "   - Set 'enable sso' to true"
    echo "   - Set 'sso url' to http://localhost:5000/discourse/sso"
    echo "   - Set 'sso secret' to the value in your .env file"
    echo
    echo "Useful commands:"
    echo "- View logs: docker-compose logs -f"
    echo "- Stop services: docker-compose down"
    echo "- Restart services: docker-compose restart"
    echo
    echo "For detailed configuration and troubleshooting, see:"
    echo "docs/DISCOURSE_DEPLOYMENT_GUIDE.md"
}

# Handle script arguments
case "${1:-setup}" in
    "setup")
        check_requirements
        generate_secrets
        create_env_file
        init_database
        start_services
        test_integration
        show_next_steps
        ;;
    "start")
        print_status "Starting existing Discourse integration..."
        docker-compose up -d
        test_integration
        print_success "Services started"
        ;;
    "stop")
        print_status "Stopping Discourse integration..."
        docker-compose down
        print_success "Services stopped"
        ;;
    "restart")
        print_status "Restarting Discourse integration..."
        docker-compose restart
        test_integration
        print_success "Services restarted"
        ;;
    "logs")
        docker-compose logs -f
        ;;
    "status")
        docker-compose ps
        ;;
    "clean")
        print_warning "This will remove all containers and volumes. Are you sure? (y/N)"
        read -r response
        if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
            docker-compose down -v
            docker-compose rm -f
            print_success "All containers and volumes removed"
        else
            print_status "Operation cancelled"
        fi
        ;;
    *)
        echo "Usage: $0 {setup|start|stop|restart|logs|status|clean}"
        echo
        echo "Commands:"
        echo "  setup    - Initial setup of Discourse integration"
        echo "  start    - Start all services"
        echo "  stop     - Stop all services"
        echo "  restart  - Restart all services"
        echo "  logs     - Show service logs"
        echo "  status   - Show service status"
        echo "  clean    - Remove all containers and volumes"
        exit 1
        ;;
esac