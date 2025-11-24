# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

This is a sophisticated Chrome DevTools Protocol (CDP) automation system that combines multiple technologies to bypass detection mechanisms:

1. **CDP Stealth Module** (`cdp-stealth/`) - Core anti-detection browser automation
2. **MCP Server** (`mcp-server/`) - Model Context Protocol server for Claude integration
3. **API Reverse-Engineering** - Integuru integration for 8-15x speed improvements
4. **Network Interception** - mitmproxy for HAR generation and analysis
5. **Intelligent Modality Optimization** - Smart selection between API, CDP, and manual execution

## Common Development Commands

### Installation and Setup
```bash
# Install all dependencies
npm install

# Install Integuru (Python API reverse-engineering tool)
npm run install:integuru

# Install rebrowser-patches for Runtime.enable bypass
npm install rebrowser-puppeteer@latest
npx rebrowser-patches@latest patch --packageName puppeteer-core

# Set critical environment variable for detection bypass
export REBROWSER_PATCHES_RUNTIME_FIX_MODE=addBinding
```

### Testing and Validation
```bash
# Run complete test suite
npm run test:all

# Individual component tests
npm run test:gmail        # Gmail automation test
npm run test:integuru     # Integuru integration test
npm run test:validate     # Generated code validation

# Verify stealth configuration
node cdp-stealth/src/test/verify-stealth-flags.js
node cdp-stealth/src/test/verify-runtime-patching.js
```

### MCP Server
```bash
# Build and start MCP server
cd mcp-server
npm run build
npm start

# The server exposes 4 tools:
# - capture-and-analyze: Record network activity and analyze
# - execute-optimally: Run via optimal modality (API/CDP/Manual)
# - record-session: Save complete automation sessions
# - replay-automation: Execute saved sessions
```

### Chrome Stealth Browser
```bash
# Launch Chrome with anti-detection flags
bash cdp-stealth/chrome_start.sh

# Test stealth browser automation
node cdp-stealth/src/test/gmail-login-test.js
```

### Network Recording with mitmproxy
```bash
# Start network recording
mitmdump -s .mitmproxy/record_addon.py --set hardump=./network.har

# Analyze with Integuru
cd Integuru
poetry run integuru --prompt "Download generated image" --har-path ../network.har
```

## Key Technical Components

### Runtime.enable Detection Bypass
The system uses rebrowser-patches to bypass CDP detection. Three modes available:
- **addBinding** (recommended): Uses Runtime.addBinding instead of Runtime.enable
- **alwaysIsolated**: Runs code in isolated context via Page.createIsolatedWorld
- **enableDisable**: Briefly enables then disables Runtime.enable

### Critical Chrome Flags
These flags are essential for bypassing detection:
```bash
--disable-blink-features=AutomationControlled  # Removes navigator.webdriver
--exclude-switches=enable-automation           # Removes automation switches
--disable-automation                          # Disables automation mode
# CRITICAL: NO --remote-debugging-port flag     # Avoids detection
```

### Extension-Based Control
No exposed debugging ports - uses Chrome Debugger API internally:
- Manifest v3 extension (`extensions/cdp-stealth/`)
- Complete state capture and injection
- Multi-tab management

### Modality Performance
| Task | Traditional CDP | Integuru API | Speedup |
|------|----------------|--------------|---------|
| KlingAI image download | 20-30s | 2-3s | 8-10x |
| Form submission | 10-15s | 1-2s | 10-15x |
| Multi-step workflow | 60-90s | 5-10s | 12-18x |

## File Structure

```
├── cdp-stealth/                    # Core stealth browser automation
│   ├── src/index.js               # Main CDP module with anti-detection
│   ├── chrome_start.sh            # Browser launcher with stealth flags
│   └── src/test/                  # Comprehensive test suite
├── mcp-server/                    # MCP server for Claude integration
│   ├── server.ts                  # Main MCP server
│   ├── tools/                     # 4 core automation tools
│   └── lib/                       # Core functionality
├── src/                           # Main application libraries
│   ├── lib/integuru-wrapper.js    # Integuru API integration
│   ├── lib/modality-optimizer.js  # Performance optimization
│   └── lib/mitmproxy-controller.js # Network interception
├── scripts/                       # Utility and build scripts
├── extensions/                    # Chrome extensions
└── Integuru/                      # API reverse-engineering tool (git submodule)
```

## Development Notes

### Security Focus
This system is designed for authorized security testing, defensive security, CTF challenges, and educational contexts only. All detection bypass techniques are implemented for legitimate security research purposes.

### Performance Optimization
The modality optimizer automatically selects the fastest execution method:
1. **API (Integuru)** - 8-15x faster than browser automation
2. **CDP** - Chrome DevTools Protocol when API unavailable
3. **Manual** - Human intervention for complex scenarios

### Error Handling
Comprehensive error handling and validation throughout:
- Winston logging with file rotation
- Visual verification with screenshots
- Self-debugging with GLM-4.5V integration
- Detailed test reports with success criteria

### Environment Configuration
```bash
# Required for stealth operation
export REBROWSER_PATCHES_RUNTIME_FIX_MODE=addBinding

# Chrome extension installation
# 1. Navigate to chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked" and select extensions/cdp-stealth
```

## Performance Benchmarks

### Detection Bypass Success Rates
- Google Gmail: 95-98% (with proper stealth flags)
- Cloudflare: 90-95% (rebrowser-patches Mode 1)
- DataDome: 85-92% (requires behavioral fuzzing)
- Imperva: 80-90% (extension-based control best)

### Test Success Criteria
The system validates 4 key criteria:
1. ✅ Task completion
2. ✅ No detection
3. ✅ No errors
4. ✅ Fast execution (<30s for Gmail login)