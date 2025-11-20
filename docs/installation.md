# Installation Guide

This comprehensive guide covers installation of the CDP automation system across different platforms and environments.

## System Requirements

### Minimum Requirements

- **Operating System**: Windows 10+, macOS 10.15+, Ubuntu 18.04+
- **Chrome**: Version 143+ (Canary/Dev/Unstable recommended)
- **Node.js**: Version 18.0+ (LTS recommended)
- **Python**: Version 3.8+ (3.11+ recommended)
- **RAM**: 4GB minimum (8GB recommended)
- **Disk Space**: 2GB minimum (5GB recommended)
- **Network**: Stable internet connection

### Recommended Requirements

- **Operating System**: Windows 11, macOS 13+, Ubuntu 20.04+
- **Chrome**: Latest Canary/Dev build
- **Node.js**: Version 20.0+ LTS
- **Python**: Version 3.11+
- **RAM**: 8GB+ (16GB for heavy workloads)
- **Disk Space**: 10GB+ (for recordings and logs)
- **Network**: Broadband connection with low latency

## Platform-Specific Installation

### Windows

#### Prerequisites

1. **Install Chrome Canary**:
   ```powershell
   # Download and install Chrome Canary
   # https://www.google.com/chrome/canary/
   ```

2. **Install Node.js**:
   ```powershell
   # Using Chocolatey
   choco install nodejs --version=20.0.0
   
   # Or download from https://nodejs.org/
   ```

3. **Install Python**:
   ```powershell
   # Using Chocolatey
   choco install python311 --version=3.11.0
   
   # Or download from https://www.python.org/
   ```

4. **Install Git**:
   ```powershell
   choco install git
   ```

#### Installation Steps

```powershell
# 1. Clone repository
git clone https://github.com/your-org/cdp-automation.git
cd cdp-automation

# 2. Install Node.js dependencies
npm install

# 3. Install Python dependencies
pip install mitmproxy

# 4. Install Poetry for Integuru
curl -sSL https://install.python-poetry.org | python3 -
```

#### Windows-Specific Configuration

```powershell
# Add to PATH (if not automatically added)
[Environment]::SetEnvironmentVariable("PATH", $env:PATH + ";C:\Program Files\Google\Chrome\Application\chrome_canary.exe", "User")

# Set environment variables
[Environment]::SetEnvironmentVariable("REBROWSER_PATCHES_RUNTIME_FIX_MODE", "addBinding", "User")
[Environment]::SetEnvironmentVariable("OPENAI_API_KEY", "your_api_key_here", "User")

# Windows Defender exclusions (if needed)
Add-MpPreference -ExclusionPath "C:\path\to\cdp-automation"
```

### macOS

#### Prerequisites

1. **Install Homebrew** (if not installed):
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

2. **Install Chrome Canary**:
   ```bash
   brew install --cask google-chrome-canary
   ```

3. **Install Node.js**:
   ```bash
   brew install node@20
   ```

4. **Install Python**:
   ```bash
   brew install python@3.11
   ```

#### Installation Steps

```bash
# 1. Clone repository
git clone https://github.com/your-org/cdp-automation.git
cd cdp-automation

# 2. Install Node.js dependencies
npm install

# 3. Install Python dependencies
pip3 install mitmproxy

# 4. Install Poetry for Integuru
curl -sSL https://install.python-poetry.org | python3 -
```

#### macOS-Specific Configuration

```bash
# Add to PATH (add to ~/.zshrc or ~/.bash_profile)
export PATH="/opt/homebrew/bin:$PATH"
export PATH="/usr/local/bin:$PATH"

# Set environment variables
export REBROWSER_PATCHES_RUNTIME_FIX_MODE=addBinding
export OPENAI_API_KEY=your_api_key_here

# macOS security settings (allow unsigned binaries)
xattr -d -r com.apple.quarantine /path/to/cdp-automation
```

### Linux (Ubuntu/Debian)

#### Prerequisites

1. **Update system packages**:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **Install Chrome**:
   ```bash
   # Add Google Chrome repository
   wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
   sudo sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list'
   
   # Install Chrome
   sudo apt update
   sudo apt install google-chrome-stable
   ```

3. **Install Node.js**:
   ```bash
   # Using NodeSource repository
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

4. **Install Python**:
   ```bash
   sudo apt install python3.11 python3.11-pip python3.11-venv
   ```

5. **Install additional dependencies**:
   ```bash
   sudo apt install -y git curl wget build-essential
   ```

#### Installation Steps

```bash
# 1. Clone repository
git clone https://github.com/your-org/cdp-automation.git
cd cdp-automation

# 2. Install Node.js dependencies
npm install

# 3. Install Python dependencies
pip3 install mitmproxy

# 4. Install Poetry for Integuru
curl -sSL https://install.python-poetry.org | python3 -
```

#### Linux-Specific Configuration

```bash
# Set environment variables (add to ~/.bashrc or ~/.zshrc)
export REBROWSER_PATCHES_RUNTIME_FIX_MODE=addBinding
export OPENAI_API_KEY=your_api_key_here
export CHROME_BIN=/usr/bin/google-chrome

# Create desktop entry (optional)
cat > ~/.local/share/applications/cdp-automation.desktop << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=CDP Automation
Comment=Chrome DevTools Protocol Automation
Exec=/path/to/cdp-automation/start.sh
Icon=/path/to/cdp-automation/icon.png
Terminal=false
Categories=Development;
EOF
```

## Docker Installation

### Dockerfile

```dockerfile
FROM ubuntu:22.04

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    python3.11 \
    python3.11-pip \
    python3.11-venv \
    nodejs \
    npm

# Install Chrome
RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable

# Install Python dependencies
RUN pip3 install mitmproxy

# Install Poetry
RUN curl -sSL https://install.python-poetry.org | python3 -

# Copy application code
WORKDIR /app
COPY . .

# Install Node.js dependencies
RUN npm install

# Install Integuru
RUN git clone https://github.com/Integuru-AI/Integuru.git \
    && cd Integuru \
    && poetry install

# Create non-root user
RUN useradd -m -u automation
USER automation

# Expose ports
EXPOSE 8080 9222

# Start script
CMD ["npm", "start"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  cdp-automation:
    build: .
    ports:
      - "8080:8080"  # mitmproxy
      - "9222:9222"  # Chrome debugging (if needed)
    environment:
      - REBROWSER_PATCHES_RUNTIME_FIX_MODE=addBinding
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - NODE_ENV=production
    volumes:
      - ./recordings:/app/recordings
      - ./logs:/app/logs
      - ./chrome-user-data:/app/chrome-user-data
    cap_add:
      - SYS_ADMIN  # Required for Chrome in Docker
    security_opt:
      - seccomp:unconfined

  mitmproxy:
    image: mitmproxy/mitmproxy
    ports:
      - "8080:8080"
    volumes:
      - ./recordings:/home/mitmproxy/.mitmproxy
    command: mitmdump -s ./record_addon.py --set hardump=/recordings/network.har

  integuru:
    build: ./Integuru
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    volumes:
      - ./recordings:/app/recordings
```

## Verification Installation

### Health Check Script

```bash
#!/bin/bash
# health-check.sh

echo "🔍 CDP Automation System Health Check"
echo "=================================="

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js: $NODE_VERSION"
else
    echo "❌ Node.js: Not installed"
    exit 1
fi

# Check Python
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo "✅ Python: $PYTHON_VERSION"
else
    echo "❌ Python: Not installed"
    exit 1
fi

# Check Chrome
if command -v google-chrome &> /dev/null; then
    CHROME_VERSION=$(google-chrome --version)
    echo "✅ Chrome: $CHROME_VERSION"
else
    echo "❌ Chrome: Not installed"
    exit 1
fi

# Check mitmproxy
if command -v mitmdump &> /dev/null; then
    MITMPROXY_VERSION=$(mitmdump --version)
    echo "✅ mitmproxy: $MITMPROXY_VERSION"
else
    echo "❌ mitmproxy: Not installed"
    exit 1
fi

# Check Node.js dependencies
if [ -d "node_modules" ]; then
    echo "✅ Node.js dependencies: Installed"
else
    echo "❌ Node.js dependencies: Not installed"
    echo "Run: npm install"
    exit 1
fi

# Check Integuru
if [ -d "Integuru" ]; then
    echo "✅ Integuru: Cloned"
else
    echo "❌ Integuru: Not cloned"
    echo "Run: git clone https://github.com/Integuru-AI/Integuru.git"
    exit 1
fi

# Check environment variables
if [ -n "$REBROWSER_PATCHES_RUNTIME_FIX_MODE" ]; then
    echo "✅ Runtime patching mode: $REBROWSER_PATCHES_RUNTIME_FIX_MODE"
else
    echo "⚠️ Runtime patching mode: Not set"
    echo "Export: export REBROWSER_PATCHES_RUNTIME_FIX_MODE=addBinding"
fi

if [ -n "$OPENAI_API_KEY" ]; then
    echo "✅ OpenAI API key: Set"
else
    echo "⚠️ OpenAI API key: Not set"
    echo "Export: export OPENAI_API_KEY=your_api_key"
fi

echo "=================================="
echo "🎉 Installation verification complete!"
```

### Test Installation

```bash
# Make health check executable
chmod +x health-check.sh

# Run health check
./health-check.sh

# Expected output:
# ✅ Node.js: v20.0.0
# ✅ Python: Python 3.11.0
# ✅ Chrome: Google Chrome 120.0.6099.127
# ✅ mitmproxy: mitmproxy 10.1.5
# ✅ Node.js dependencies: Installed
# ✅ Integuru: Cloned
# ✅ Runtime patching mode: addBinding
# ⚠️ OpenAI API key: Not set
```

## Configuration

### Environment Variables

Create `.env` file in project root:

```bash
# Chrome Configuration
CHROME_PATH=/usr/bin/google-chrome
CHROME_USER_DATA_DIR=./chrome-user-data

# Stealth Configuration
REBROWSER_PATCHES_RUNTIME_FIX_MODE=addBinding
STEALTH_USER_AGENT_RANDOMIZATION=true
STEALTH_DEVICE_EMULATION=desktop

# Integuru Configuration
OPENAI_API_KEY=your_openai_api_key_here
INTEGURU_MODEL=gpt-4o
INTEGURU_TIMEOUT=30

# mitmproxy Configuration
MITMPROXY_PORT=8080
HAR_OUTPUT_PATH=./recordings/network.har

# Logging Configuration
LOG_LEVEL=info
LOG_FILE=./logs/cdp-automation.log
DEBUG_ENABLED=false

# Performance Configuration
MEMORY_LIMIT=512MB
TIMEOUT=30000
```

### Configuration Files

#### Chrome Configuration (`config/chrome.json`)

```json
{
  "executable": "/usr/bin/google-chrome",
  "args": [
    "--disable-blink-features=AutomationControlled",
    "--exclude-switches=enable-automation",
    "--disable-automation",
    "--disable-ipc-flooding-protection",
    "--no-first-run",
    "--no-default-browser-check",
    "--user-data-dir=./chrome-user-data"
  ],
  "userDataDir": "./chrome-user-data",
  "viewport": {
    "width": 1366,
    "height": 768
  }
}
```

#### Stealth Configuration (`config/stealth.json`)

```json
{
  "runtimePatchingMode": "addBinding",
  "randomizeUserAgent": true,
  "emulateDevice": "desktop",
  "webglVendor": "Intel Inc.",
  "webglRenderer": "Intel Iris OpenGL Engine",
  "canvasNoise": true,
  "audioNoise": true,
  "timezone": "America/New_York",
  "language": "en-US,en",
  "platform": "Win32",
  "hardwareConcurrency": 8,
  "deviceMemory": 8
}
```

## Post-Installation Setup

### 1. Chrome Extension Setup

```bash
# Navigate to extension directory
cd extensions/cdp-stealth

# Verify manifest
cat manifest.json | python3 -m json.tool

# Load extension in Chrome
# 1. Open Chrome
# 2. Navigate to chrome://extensions/
# 3. Enable "Developer mode"
# 4. Click "Load unpacked"
# 5. Select extensions/cdp-stealth directory
```

### 2. SSL Certificate Setup (for mitmproxy)

```bash
# Start mitmproxy to generate certificates
mitmproxy

# Navigate to http://mitm.it in Chrome
# Download and install certificate for your platform
# Windows: .cer file
# macOS: .pem file
# Linux: .crt file

# Import certificate into system trust store
```

### 3. Integuru Setup

```bash
# Navigate to Integuru directory
cd Integuru

# Install dependencies
poetry install

# Create virtual environment
poetry shell

# Verify installation
poetry run integuru --help
```

### 4. MCP Server Setup

```bash
# Build MCP server
cd mcp-server
npm run build

# Test server
npm start

# Add to Claude Desktop configuration
# Edit ~/.config/claude-desktop/config.json
```

## Troubleshooting Installation

### Common Issues

#### 1. Permission Denied Errors

**Linux/macOS**:
```bash
# Fix permissions
chmod +x chrome_start.sh
chmod +x scripts/*.sh

# Fix file ownership
sudo chown -R $USER:$USER ./chrome-user-data
```

**Windows**:
```powershell
# Run PowerShell as Administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

#### 2. Chrome Not Found

```bash
# Check Chrome installation
which google-chrome
google-chrome --version

# Update PATH if needed
export PATH="/path/to/chrome:$PATH"

# Use full path in configuration
export CHROME_PATH="/full/path/to/google-chrome"
```

#### 3. Python Module Not Found

```bash
# Check Python path
which python3
python3 --version

# Use pip3 explicitly
pip3 install mitmproxy

# Check Python installation
python3 -c "import mitmproxy; print('mitmproxy installed')"
```

#### 4. Node.js Module Build Failures

```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules
rm -rf node_modules package-lock.json

# Reinstall with verbose output
npm install --verbose

# Use alternative registry
npm config set registry https://registry.npmjs.org/
```

#### 5. Docker Issues

```bash
# Check Docker permissions
sudo usermod -aG docker $USER
newgrp docker

# Fix Docker daemon issues
sudo systemctl restart docker

# Check Docker logs
docker logs cdp-automation
```

### Debug Installation

```bash
# Enable verbose installation
export DEBUG=*
export npm_config_loglevel=verbose

# Run installation with debug
npm install --loglevel=verbose 2>&1 | tee install.log

# Check system compatibility
node -e "console.log('Node.js:', process.version, 'Platform:', process.platform, 'Arch:', process.arch)"
python3 -c "import sys; print('Python:', sys.version, 'Platform:', sys.platform)"
```

## Automated Installation Scripts

### One-Click Installation (Unix-like)

```bash
#!/bin/bash
# install.sh

set -e

echo "🚀 Installing CDP Automation System..."

# Detect platform
PLATFORM=$(uname -s)
case $PLATFORM in
    Linux*)  OS="linux" ;;
    Darwin*) OS="macos" ;;
    *)        echo "❌ Unsupported platform: $PLATFORM"; exit 1 ;;
esac

echo "📦 Detected platform: $OS"

# Install system dependencies
echo "📦 Installing system dependencies..."
if [ "$OS" = "linux" ]; then
    sudo apt-get update && sudo apt-get install -y curl wget git python3 python3-pip nodejs npm
elif [ "$OS" = "macos" ]; then
    if ! command -v brew &> /dev/null; then
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
    brew install curl wget git python3 node npm
fi

# Clone repository
echo "📦 Cloning repository..."
git clone https://github.com/your-org/cdp-automation.git
cd cdp-automation

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip3 install mitmproxy

# Install Poetry
echo "📦 Installing Poetry..."
curl -sSL https://install.python-poetry.org | python3 -

# Clone and setup Integuru
echo "📦 Setting up Integuru..."
git clone https://github.com/Integuru-AI/Integuru.git
cd Integuru && poetry install && cd ..

# Set environment variables
echo "📦 Setting up environment..."
cat > .env << EOF
REBROWSER_PATCHES_RUNTIME_FIX_MODE=addBinding
STEALTH_USER_AGENT_RANDOMIZATION=true
EOF

echo "✅ Installation complete!"
echo ""
echo "🎯 Next steps:"
echo "1. Set your OpenAI API key: export OPENAI_API_KEY=your_key"
echo "2. Load Chrome extension: chrome://extensions/ -> Load unpacked -> extensions/cdp-stealth"
echo "3. Run health check: ./health-check.sh"
echo "4. Start MCP server: npm start"
```

### Windows Installation Script

```powershell
# install.ps1

Write-Host "🚀 Installing CDP Automation System..." -ForegroundColor Green

# Check administrator privileges
if (-NOT ([Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator))) {
    Write-Host "❌ Please run as Administrator" -ForegroundColor Red
    exit 1
}

# Install Chocolatey if not present
if (-NOT (Get-Command choco -ErrorAction SilentlyContinue)) {
    Write-Host "📦 Installing Chocolatey..." -ForegroundColor Yellow
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))
    Set-ExecutionPolicy Bypass -Scope Process -Force
}

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
choco install -y nodejs python git google-chrome-canary

# Clone repository
Write-Host "📦 Cloning repository..." -ForegroundColor Yellow
git clone https://github.com/your-org/cdp-automation.git
Set-Location cdp-automation

# Install Node.js dependencies
Write-Host "📦 Installing Node.js dependencies..." -ForegroundColor Yellow
npm install

# Install Python dependencies
Write-Host "📦 Installing Python dependencies..." -ForegroundColor Yellow
pip install mitmproxy

# Install Poetry
Write-Host "📦 Installing Poetry..." -ForegroundColor Yellow
(Invoke-WebRequest -Uri https://install.python-poetry.org -UseBasicParsing).Content | python3 -

# Clone and setup Integuru
Write-Host "📦 Setting up Integuru..." -ForegroundColor Yellow
git clone https://github.com/Integuru-AI/Integuru.git
Set-Location Integuru
poetry install
Set-Location ..

# Create environment file
Write-Host "📦 Setting up environment..." -ForegroundColor Yellow
@"
REBROWSER_PATCHES_RUNTIME_FIX_MODE=addBinding
STEALTH_USER_AGENT_RANDOMIZATION=true
"@ | Out-File -FilePath .env -Encoding utf8

Write-Host "✅ Installation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "🎯 Next steps:" -ForegroundColor Cyan
Write-Host "1. Set your OpenAI API key: `$env:OPENAI_API_KEY=your_key`" -ForegroundColor White
Write-Host "2. Load Chrome extension: chrome://extensions/ -> Load unpacked -> extensions/cdp-stealth" -ForegroundColor White
Write-Host "3. Run health check: .\health-check.ps1" -ForegroundColor White
Write-Host "4. Start MCP server: npm start" -ForegroundColor White
```

## Verification

### Test Suite

```bash
# Run complete test suite
npm run test:all

# Expected output:
# ✅ Stealth verification: PASSED
# ✅ Runtime patching: PASSED
# ✅ Extension loading: PASSED
# ✅ Gmail login: PASSED
# ✅ Overall system: READY FOR PRODUCTION
```

### Manual Verification

1. **Chrome Extension**:
   - Open Chrome
   - Navigate to `chrome://extensions/`
   - Verify "CDP Stealth Extension" is enabled
   - Click extension icon to verify popup opens

2. **Stealth Configuration**:
   - Run: `node cdp-stealth/src/test/verify-stealth-flags.js`
   - Verify all checks pass

3. **Network Recording**:
   - Run: `mitmdump -s .mitmproxy/record_addon.py --set hardump=test.har`
   - Browse to a website
   - Verify HAR file is generated

4. **MCP Server**:
   - Run: `node mcp-server/dist/server.js`
   - Test with: `echo '{"jsonrpc": "2.0", "method": "tools/list"}' | node mcp-server/dist/server.js`

## References

- [Chrome Installation](https://www.google.com/chrome/)
- [Node.js Installation](https://nodejs.org/en/download/)
- [Python Installation](https://www.python.org/downloads/)
- [Poetry Installation](https://python-poetry.org/docs/#installation)
- [mitmproxy Installation](https://docs.mitmproxy.org/stable/overview-installation.html)
- [Docker Installation](https://docs.docker.com/get-docker/)