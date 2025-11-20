#!/bin/bash

# Integuru Installation Script
# This script automates the installation of Integuru and its dependencies
# Based on the specifications from implementation_guide.md

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
INTEGURU_REPO="https://github.com/Integuru-AI/Integuru.git"
INTEGURU_DIR="./Integuru"
PYTHON_MIN_VERSION="3.8"
POETRY_VERSION="1.6.1"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check Python version
check_python_version() {
    log_info "Checking Python version..."
    
    if ! command_exists python3; then
        log_error "Python 3 is not installed. Please install Python 3.8 or higher."
        exit 1
    fi
    
    PYTHON_VERSION=$(python3 -c "import sys; print('.'.join(map(str, sys.version_info[:2])))")
    REQUIRED_VERSION=$PYTHON_MIN_VERSION
    
    if ! python3 -c "import sys; exit(0 if sys.version_info >= tuple(map(int, '$REQUIRED_VERSION'.split('.'))) else 1)"; then
        log_error "Python $REQUIRED_VERSION or higher is required. Found version: $PYTHON_VERSION"
        exit 1
    fi
    
    log_success "Python version check passed: $PYTHON_VERSION"
}

# Function to install system dependencies
install_system_deps() {
    log_info "Installing system dependencies..."
    
    # Detect OS
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        if command_exists apt-get; then
            sudo apt-get update
            sudo apt-get install -y python3-pip python3-venv git curl
        elif command_exists yum; then
            sudo yum install -y python3-pip python3-venv git curl
        elif command_exists dnf; then
            sudo dnf install -y python3-pip python3-venv git curl
        else
            log_warning "Unable to detect package manager. Please install python3-pip, python3-venv, git, and curl manually."
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command_exists brew; then
            brew install python3 git curl
        else
            log_warning "Homebrew not found. Please install Python 3, git, and curl manually."
        fi
    else
        log_warning "Unsupported OS: $OSTYPE. Please ensure Python 3, git, and curl are installed."
    fi
    
    log_success "System dependencies installation completed"
}

# Function to install Poetry
install_poetry() {
    log_info "Installing Poetry..."
    
    if command_exists poetry; then
        INSTALLED_POETRY_VERSION=$(poetry --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
        log_info "Poetry is already installed (version: $INSTALLED_POETRY_VERSION)"
        
        # Check if version is adequate
        if python3 -c "
import sys
from packaging import version
installed = version.parse('$INSTALLED_POETRY_VERSION')
required = version.parse('$POETRY_VERSION')
if installed < required:
    sys.exit(1)
"; then
            log_success "Poetry version is adequate"
            return
        else
            log_warning "Poetry version is too old. Updating..."
        fi
    fi
    
    # Install Poetry
    curl -sSL https://install.python-poetry.org | python3 -
    
    # Add Poetry to PATH
    export PATH="$HOME/.local/bin:$PATH"
    
    # Verify installation
    if command_exists poetry; then
        POETRY_VERSION_CHECK=$(poetry --version)
        log_success "Poetry installed: $POETRY_VERSION_CHECK"
    else
        log_error "Poetry installation failed"
        exit 1
    fi
    
    # Configure Poetry
    poetry config virtualenvs.create true
    poetry config virtualenvs.in-project true
    log_success "Poetry configured"
}

# Function to clone Integuru repository
clone_integuru() {
    log_info "Cloning Integuru repository..."
    
    if [ -d "$INTEGURU_DIR" ]; then
        log_warning "Integuru directory already exists. Updating..."
        cd "$INTEGURU_DIR"
        git pull origin main
        cd ..
    else
        git clone "$INTEGURU_REPO" "$INTEGURU_DIR"
        log_success "Integuru repository cloned"
    fi
}

# Function to install Integuru dependencies
install_integuru_deps() {
    log_info "Installing Integuru dependencies..."
    
    cd "$INTEGURU_DIR"
    
    # Install dependencies with Poetry
    poetry install
    
    # Verify installation
    poetry run python -c "import integuru; print('Integuru module imported successfully')"
    
    cd ..
    log_success "Integuru dependencies installed"
}

# Function to configure environment
configure_environment() {
    log_info "Configuring environment..."
    
    # Create environment file if it doesn't exist
    ENV_FILE=".env"
    
    if [ ! -f "$ENV_FILE" ]; then
        cat > "$ENV_FILE" << EOF
# Integuru Environment Configuration
OPENAI_API_KEY=your_openai_api_key_here
INTEGURU_MODEL=gpt-4o
INTEGURU_TIMEOUT=30
INTEGURU_TEMP_DIR=./temp
EOF
        log_success "Created .env file with template configuration"
        log_warning "Please update OPENAI_API_KEY in .env file with your actual API key"
    else
        log_info ".env file already exists"
    fi
    
    # Create temp directory
    mkdir -p ./temp
    log_success "Created temp directory"
}

# Function to validate installation
validate_installation() {
    log_info "Validating Integuru installation..."
    
    cd "$INTEGURU_DIR"
    
    # Check if Poetry environment is set up
    if ! poetry run python -c "import sys; print(sys.executable)" | grep -q "Integuru"; then
        log_error "Poetry environment not properly set up"
        exit 1
    fi
    
    # Check if Integuru can be imported
    if ! poetry run python -c "import integuru; print('Integuru version:', getattr(integuru, '__version__', 'unknown'))"; then
        log_error "Integuru module cannot be imported"
        exit 1
    fi
    
    # Check if command line tool works
    if ! poetry run integuru --help > /dev/null 2>&1; then
        log_error "Integuru command line tool not working"
        exit 1
    fi
    
    cd ..
    log_success "Installation validation passed"
}

# Function to create test script
create_test_script() {
    log_info "Creating test script..."
    
    TEST_SCRIPT="test-integuru-installation.sh"
    
    cat > "$TEST_SCRIPT" << 'EOF'
#!/bin/bash

# Test script for Integuru installation
set -e

echo "Testing Integuru installation..."

# Test 1: Check if Poetry environment works
echo "Test 1: Poetry environment"
cd Integuru
poetry run python --version
echo "✓ Poetry environment working"

# Test 2: Check if Integuru can be imported
echo "Test 2: Module import"
poetry run python -c "import integuru; print('✓ Integuru module imported successfully')"

# Test 3: Check command line tool
echo "Test 3: Command line tool"
poetry run integuru --help | head -5
echo "✓ Command line tool working"

# Test 4: Test with sample HAR (if available)
if [ -f "../src/test/sample.har" ]; then
    echo "Test 4: HAR analysis"
    poetry run integuru --har-path "../src/test/sample.har" --prompt "Test analysis" --model gpt-4o --dry-run
    echo "✓ HAR analysis test completed"
else
    echo "Test 4: Skipped (no sample HAR file found)"
fi

echo "All tests passed! Integuru is properly installed."
cd ..
EOF
    
    chmod +x "$TEST_SCRIPT"
    log_success "Test script created: $TEST_SCRIPT"
}

# Function to create integration helper
create_integration_helper() {
    log_info "Creating integration helper..."
    
    INTEGRATION_HELPER="integuru-helper.sh"
    
    cat > "$INTEGRATION_HELPER" << 'EOF'
#!/bin/bash

# Integuru Integration Helper
# Provides convenient commands for Integuru integration

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INTEGURU_DIR="$SCRIPT_DIR/Integuru"

# Function to run Integuru with common parameters
run_integuru() {
    local har_path="$1"
    local prompt="$2"
    local model="${3:-gpt-4o}"
    local generate_code="${4:-true}"
    
    cd "$INTEGURU_DIR"
    
    cmd="poetry run integuru --har-path \"$har_path\" --prompt \"$prompt\" --model \"$model\""
    
    if [ "$generate_code" = "true" ]; then
        cmd="$cmd --generate-code"
    fi
    
    echo "Running: $cmd"
    eval "$cmd"
    
    cd "$SCRIPT_DIR"
}

# Function to validate HAR file
validate_har() {
    local har_path="$1"
    
    if [ ! -f "$har_path" ]; then
        echo "Error: HAR file not found: $har_path"
        return 1
    fi
    
    # Basic JSON validation
    if ! python3 -m json.tool "$har_path" > /dev/null 2>&1; then
        echo "Error: Invalid JSON in HAR file: $har_path"
        return 1
    fi
    
    # Check for required HAR structure
    if ! python3 -c "
import json
with open('$har_path', 'r') as f:
    data = json.load(f)
    if 'log' not in data or 'entries' not in data['log']:
        exit(1)
" 2>/dev/null; then
        echo "Error: Invalid HAR format in file: $har_path"
        return 1
    fi
    
    echo "✓ HAR file is valid: $har_path"
    return 0
}

# Function to show available models
show_models() {
    echo "Available Integuru models:"
    echo "- gpt-4o (recommended)"
    echo "- o1-mini (faster, cheaper)"
    echo "- gpt-3.5-turbo (basic)"
}

# Function to show usage
show_usage() {
    echo "Integuru Integration Helper"
    echo ""
    echo "Usage:"
    echo "  $0 analyze <har_file> <prompt> [model] [generate_code]"
    echo "  $0 validate <har_file>"
    echo "  $0 models"
    echo "  $0 help"
    echo ""
    echo "Examples:"
    echo "  $0 analyze ./network.har \"Download image from KlingAI\" gpt-4o true"
    echo "  $0 validate ./network.har"
    echo "  $0 models"
}

# Main script logic
case "$1" in
    analyze)
        if [ $# -lt 3 ]; then
            echo "Error: Missing required arguments"
            show_usage
            exit 1
        fi
        
        har_file="$2"
        prompt="$3"
        model="${4:-gpt-4o}"
        generate_code="${5:-true}"
        
        validate_har "$har_file" || exit 1
        run_integuru "$har_file" "$prompt" "$model" "$generate_code"
        ;;
    validate)
        if [ $# -lt 2 ]; then
            echo "Error: Missing HAR file argument"
            show_usage
            exit 1
        fi
        
        validate_har "$2"
        ;;
    models)
        show_models
        ;;
    help|--help|-h)
        show_usage
        ;;
    *)
        echo "Error: Unknown command: $1"
        show_usage
        exit 1
        ;;
esac
EOF
    
    chmod +x "$INTEGRATION_HELPER"
    log_success "Integration helper created: $INTEGRATION_HELPER"
}

# Main installation flow
main() {
    echo "Integuru Installation Script"
    echo "============================"
    echo ""
    
    log_info "Starting Integuru installation..."
    
    # Check prerequisites
    check_python_version
    
    # Install dependencies
    install_system_deps
    install_poetry
    
    # Clone and install Integuru
    clone_integuru
    install_integuru_deps
    
    # Configure environment
    configure_environment
    
    # Validate installation
    validate_installation
    
    # Create helper scripts
    create_test_script
    create_integration_helper
    
    echo ""
    log_success "Integuru installation completed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Update OPENAI_API_KEY in .env file"
    echo "2. Run ./test-integuru-installation.sh to verify installation"
    echo "3. Use ./integuru-helper.sh for easy integration"
    echo ""
    echo "Example usage:"
    echo "  ./integuru-helper.sh analyze ./network.har \"Download image from KlingAI\""
    echo ""
}

# Run main function
main "$@"