# Quick Start Guide

Get up and running with the CDP Automation System in 5 minutes.

## Prerequisites

- Chrome 143+ (Canary/Dev/Unstable recommended)
- Node.js 18.0+
- Python 3.8+
- 4GB RAM minimum (8GB recommended)

## One-Command Installation

```bash
curl -sSL https://raw.githubusercontent.com/FreesoSaiFared/cdp-automation/main/scripts/install.sh | bash
```

## Manual Installation (5 minutes)

### 1. Clone Repository

```bash
git clone https://github.com/your-org/cdp-automation.git
cd cdp-automation
```

### 2. Install Node.js Dependencies

```bash
npm install
```

### 3. Install Stealth Patches

```bash
npm install rebrowser-puppeteer@latest
npx rebrowser-patches@latest patch --packageName puppeteer-core
```

### 4. Install Python Dependencies

```bash
# Install mitmproxy
pip install mitmproxy

# Clone and setup Integuru
git clone https://github.com/Integuru-AI/Integuru
cd Integuru && poetry install && cd ..
```

### 5. Set Environment Variables

```bash
export REBROWSER_PATCHES_RUNTIME_FIX_MODE=addBinding
export OPENAI_API_KEY=your_openai_api_key_here
```

## Quick Test (2 minutes)

### 1. Launch Chrome with Stealth Configuration

```bash
cd cdp-stealth
bash chrome_start.sh
```

### 2. Load CDP Extension

1. Open Chrome
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select `extensions/cdp-stealth`

### 3. Run Gmail Automation Test

```bash
# In a new terminal
npm run test:gmail
```

Expected output:
```
═══════════════════════════════════════════════════════════
TEST REPORT
═══════════════════════════════════════════════════════════
✅ SUCCESS: true
  Duration: 3.45 seconds
  Errors: 0
  Detection Attempts: 0
  Report saved: ./debug/gmail-login-test-report.json
SUCCESS CRITERIA
───────────────────────────────────────────────────────
✅ Login completed
✅ No detection
✅ No errors
✅ Fast execution (3.45s < 30s)
FINAL SCORE: 4/4 criteria met
  SYSTEM FULLY OPERATIONAL - READY FOR PRODUCTION
```

## Start MCP Server (1 minute)

```bash
# Build and start server
cd mcp-server
npm run build
npm start
```

## Use with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "cdp-automation": {
      "command": "node",
      "args": ["/path/to/cdp-automation/mcp-server/dist/server.js"]
    }
  }
}
```

## Basic Usage Examples

### CDP Automation

```javascript
const { launchStealthBrowser } = require('./cdp-stealth/src/index.js');

// Launch stealth browser
const browser = await launchStealthBrowser();
const page = await browser.newPage();

// Navigate to website
await page.goto('https://example.com');

// Human-like interaction
await page.stealth.humanType('input[name="username"]', 'user@example.com');
await page.stealth.humanClick('button[type="submit"]');
```

### Network Recording

```bash
# Start mitmproxy recording
mitmdump -s .mitmproxy/record_addon.py --set hardump=./network.har

# Perform actions in browser
# Stop recording with Ctrl+C

# Analyze with Integuru
cd Integuru
poetry run integuru --prompt "Login to website" --har-path ../network.har
```

### MCP Tools

```bash
# Capture and analyze network activity
capture-and-analyze --taskDescription "Login to Gmail" --timeoutSeconds 30

# Execute using optimal modality
execute-optimally --taskDescription "Check Gmail inbox" --sessionId abc123

# Record session for replay
record-session --taskDescription "Gmail workflow" --captureLevel 3
```

## Next Steps

- Read the [Installation Guide](installation.md) for detailed setup
- Check the [API Reference](api/README.md) for complete documentation
- Review [Security Considerations](security.md) for best practices
- Explore [Advanced Usage](advanced-usage.md) for complex scenarios

## Troubleshooting

### Common Issues

1. **Chrome won't start with stealth flags**
   ```bash
   # Check Chrome installation
   google-chrome --version
   
   # Try alternative Chrome path
   export CHROME_CMD="/usr/bin/google-chrome-stable"
   ```

2. **Extension loading fails**
   ```bash
   # Verify manifest syntax
   cat extensions/cdp-stealth/manifest.json | python3 -m json.tool
   
   # Check for missing files
   ls -la extensions/cdp-stealth/
   ```

3. **Gmail test fails**
   ```bash
   # Check stealth flags
   node cdp-stealth/src/test/verify-stealth-flags.js
   
   # Verify runtime patching
   node cdp-stealth/src/test/verify-runtime-patching.js
   ```

### Get Help

- [Troubleshooting Guide](troubleshooting.md) - Detailed solutions
- [GitHub Issues](https://github.com/your-org/cdp-automation/issues) - Report problems
- [Discussions](https://github.com/your-org/cdp-automation/discussions) - Ask questions

## Success Metrics

Your setup is successful when:

- ✅ Chrome launches without errors
- ✅ CDP extension loads and shows green status
- ✅ Gmail test passes with 4/4 criteria
- ✅ MCP server responds to tool calls
- ✅ Network recording captures requests
- ✅ Integuru analyzes HAR files successfully

**Time to complete: 5-10 minutes**

**Success rate: >95% with proper setup**