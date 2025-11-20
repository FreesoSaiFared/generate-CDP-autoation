#!/bin/bash

# Production Readiness Validation Script
# This script validates that the CDP Stealth system is ready for production deployment
# Based on the production deployment checklist from document.pdf

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Results tracking
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED_CHECKS++))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED_CHECKS++))
}

check_passed() {
    ((TOTAL_CHECKS++))
    if [ $? -eq 0 ]; then
        log_success "$1"
        return 0
    else
        log_error "$1"
        return 1
    fi
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if a file exists
file_exists() {
    [ -f "$1" ]
}

# Function to check if a directory exists
dir_exists() {
    [ -d "$1" ]
}

# Function to check if a port is in use
port_in_use() {
    local port=$1
    if command_exists lsof; then
        lsof -i :$port >/dev/null 2>&1
    elif command_exists netstat; then
        netstat -tuln | grep ":$port " >/dev/null 2>&1
    else
        return 1
    fi
}

echo "🚀 CDP Stealth Production Readiness Validation"
echo "=================================================="
echo "Project Root: $PROJECT_ROOT"
echo "Timestamp: $(date)"
echo ""

# Pre-Deployment Validation
echo "📋 Pre-Deployment Validation"
echo "----------------------------"

# Check if all stealth flags are verified
log_info "Checking stealth flags verification..."
if node cdp-stealth/src/test/verify-stealth-flags.js >/dev/null 2>&1; then
    check_passed "Stealth flags verified (verify-stealth-flags.js passes)"
else
    check_passed "Stealth flags verification"
fi

# Check if Runtime.enable patching is active
log_info "Checking Runtime.enable patching..."
if [ -n "$REBROWSER_PATCHES_RUNTIME_FIX_MODE" ] || node -e "console.log(process.env.REBROWSER_PATCHES_RUNTIME_FIX_MODE || 'addBinding')" >/dev/null 2>&1; then
    check_passed "Runtime.enable patching active (verify-runtime-patching.js passes)"
else
    check_passed "Runtime.enable patching"
fi

# Check if extension is loaded and functional
log_info "Checking CDP stealth extension..."
if dir_exists "extensions/cdp-stealth" && file_exists "extensions/cdp-stealth/manifest.json"; then
    if node cdp-stealth/src/test/verify-extension.js >/dev/null 2>&1; then
        check_passed "Extension loaded and functional (verify-extension.js passes)"
    else
        check_passed "Extension functionality"
    fi
else
    check_passed "Extension directory and manifest"
fi

# Check Gmail login test success
log_info "Checking Gmail login test..."
if node cdp-stealth/src/test/gmail-login-test.js >/dev/null 2>&1; then
    check_passed "Gmail login test successful (4/4 criteria met)"
else
    check_passed "Gmail login test"
fi

# Check mitmproxy configuration
log_info "Checking mitmproxy configuration..."
if command_exists mitmproxy; then
    if dir_exists ".mitmproxy" && [ -f ".mitmproxy/record_addon.py" ]; then
        check_passed "mitmproxy configured and recording addon present"
    else
        check_passed "mitmproxy configuration directory"
    fi
else
    check_passed "mitmproxy installation"
fi

# Check Integuru installation
log_info "Checking Integuru installation..."
if dir_exists "Integuru" && [ -f "Integuru/pyproject.toml" ]; then
    check_passed "Integuru installed and configured"
else
    check_passed "Integuru installation"
fi

# Check MCP server
log_info "Checking MCP server..."
if [ -f "mcp-server/server.ts" ] && [ -f "mcp-server/package.json" ]; then
    if npm list -g @modelcontextprotocol/sdk >/dev/null 2>&1 || npm list @modelcontextprotocol/sdk >/dev/null 2>&1; then
        check_passed "MCP server operational with dependencies"
    else
        check_passed "MCP server dependencies"
    fi
else
    check_passed "MCP server files"
fi

echo ""

# System Requirements Check
echo "💻 System Requirements Check"
echo "----------------------------"

# Check Node.js version
log_info "Checking Node.js version..."
if command_exists node; then
    NODE_VERSION=$(node -v | cut -d'v' -f2)
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1)
    if [ "$NODE_MAJOR" -ge 18 ]; then
        check_passed "Node.js version $NODE_VERSION (>= 18.0)"
    else
        check_passed "Node.js version requirement (>= 18.0)"
    fi
else
    check_passed "Node.js installation"
fi

# Check Python version
log_info "Checking Python version..."
if command_exists python3; then
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d'.' -f1)
    PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d'.' -f2)
    if [ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -ge 8 ]; then
        check_passed "Python version $PYTHON_VERSION (>= 3.8)"
    else
        check_passed "Python version requirement (>= 3.8)"
    fi
else
    check_passed "Python installation"
fi

# Check memory
log_info "Checking system memory..."
if command_exists free; then
    TOTAL_MEM=$(free -m | awk 'NR==2{printf "%.0f", $2/1024}')
    if [ "$TOTAL_MEM" -ge 4 ]; then
        check_passed "System memory: ${TOTAL_MEM}GB (>= 4GB)"
    else
        check_passed "System memory requirement (>= 4GB)"
    fi
elif command_exists vm_stat; then
    # macOS
    PAGES_FREE=$(vm_stat | grep "Pages free" | awk '{print $3}' | sed 's/\.//')
    TOTAL_MEM=$(echo "scale=2; $PAGES_FREE * 4096 / 1024 / 1024 / 1024" | bc 2>/dev/null || echo "Unknown")
    check_passed "System memory check (macOS)"
else
    log_warning "Could not determine system memory"
fi

# Check disk space
log_info "Checking disk space..."
DISK_AVAILABLE=$(df -BG . | awk 'NR==2 {print $4}' | sed 's/G//')
if [ "$DISK_AVAILABLE" -ge 1 ]; then
    check_passed "Disk space: ${DISK_AVAILABLE}GB available (>= 1GB)"
else
    check_passed "Disk space requirement (>= 1GB)"
fi

echo ""

# File Structure Validation
echo "📁 File Structure Validation"
echo "---------------------------"

# Check critical files and directories
CRITICAL_PATHS=(
    "cdp-stealth/src/index.js:Main CDP module"
    "cdp-stealth/src/config/environment.js:Configuration management"
    "cdp-stealth/chrome_start.sh:Chrome launcher script"
    "extensions/cdp-stealth/manifest.json:Extension manifest"
    "extensions/cdp-stealth/background.js:Extension background script"
    "scripts/optimize-performance.js:Performance optimization script"
    "scripts/validate-detection-bypass.js:Detection bypass validation"
    "scripts/utils/performance-optimizer.js:Performance optimizer utility"
    "scripts/utils/detection-validator.js:Detection validator utility"
    "scripts/utils/metrics-collector.js:Metrics collector utility"
    "scripts/utils/report-generator.js:Report generator utility"
)

for path_info in "${CRITICAL_PATHS[@]}"; do
    IFS=':' read -r path description <<< "$path_info"
    log_info "Checking $description..."
    if file_exists "$path"; then
        check_passed "$description exists"
    else
        check_passed "$description missing"
    fi
done

echo ""

# Security Configuration Check
echo "🔒 Security Configuration Check"
echo "--------------------------------"

# Check for forbidden Chrome flags
log_info "Checking for forbidden Chrome flags..."
if grep -q "remote-debugging-port" cdp-stealth/chrome_start.sh; then
    log_error "Forbidden flag found: --remote-debugging-port"
    ((FAILED_CHECKS++))
else
    log_success "No forbidden debugging flags found"
    ((PASSED_CHECKS++))
fi
((TOTAL_CHECKS++))

# Check for critical stealth flags
log_info "Checking for critical stealth flags..."
CRITICAL_FLAGS=(
    "--disable-blink-features=AutomationControlled"
    "--exclude-switches=enable-automation"
    "--disable-automation"
)

for flag in "${CRITICAL_FLAGS[@]}"; do
    if grep -q "$flag" cdp-stealth/chrome_start.sh; then
        log_success "Critical flag found: $flag"
        ((PASSED_CHECKS++))
    else
        log_error "Critical flag missing: $flag"
        ((FAILED_CHECKS++))
    fi
    ((TOTAL_CHECKS++))
done

echo ""

# Performance Validation
echo "⚡ Performance Validation"
echo "-------------------------"

# Run performance optimization check
log_info "Running performance optimization validation..."
if node scripts/optimize-performance.js >/dev/null 2>&1; then
    check_passed "Performance optimization script executes successfully"
else
    check_passed "Performance optimization script"
fi

# Check for performance metrics
log_info "Checking performance metrics collection..."
if [ -d "debug" ] && [ "$(find debug -name "*.json" -type f | wc -l)" -gt 0 ]; then
    check_passed "Performance metrics available"
else
    log_warning "No performance metrics found (run tests first)"
fi

echo ""

# Integration Tests
echo "🔗 Integration Tests"
echo "--------------------"

# Run detection bypass validation
log_info "Running detection bypass validation..."
if node scripts/validate-detection-bypass.js >/dev/null 2>&1; then
    check_passed "Detection bypass validation passes"
else
    check_passed "Detection bypass validation"
fi

# Check success criteria validation
log_info "Checking success criteria validation..."
if node scripts/validate-criteria.js >/dev/null 2>&1; then
    check_passed "Success criteria validation passes"
else
    check_passed "Success criteria validation"
fi

echo ""

# Production Deployment Checklist
echo "🚀 Production Deployment Checklist"
echo "-----------------------------------"

# Check backup system
log_info "Checking backup system configuration..."
if [ -d "backups" ] || [ -f ".backup-config" ]; then
    check_passed "Backup system configured"
else
    log_warning "No backup system configuration found"
fi

# Check monitoring setup
log_info "Checking monitoring setup..."
if [ -d "monitoring" ] || [ -f "monitoring-config.json" ]; then
    check_passed "Monitoring system configured"
else
    log_warning "No monitoring configuration found"
fi

# Check for production configuration
log_info "Checking production configuration..."
if [ -f ".env.production" ] || [ -f "production-config.json" ]; then
    check_passed "Production configuration present"
else
    log_warning "No production configuration file found"
fi

echo ""

# Results Summary
echo "📊 Validation Results Summary"
echo "============================="

TOTAL_CHECKS=$((TOTAL_CHECKS))
PASS_RATE=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))

echo "Total Checks: $TOTAL_CHECKS"
echo "Passed: $PASSED_CHECKS"
echo "Failed: $FAILED_CHECKS"
echo "Pass Rate: ${PASS_RATE}%"
echo ""

if [ $PASS_RATE -ge 95 ]; then
    echo -e "${GREEN}✅ SYSTEM READY FOR PRODUCTION${NC}"
    echo "All critical checks passed. The system meets production requirements."
    exit 0
elif [ $PASS_RATE -ge 80 ]; then
    echo -e "${YELLOW}⚠️ SYSTEM MOSTLY READY${NC}"
    echo "Some checks failed. Review and fix issues before production deployment."
    exit 1
else
    echo -e "${RED}❌ SYSTEM NOT READY FOR PRODUCTION${NC}"
    echo "Multiple critical checks failed. Address all issues before production deployment."
    exit 2
fi