# Chrome Stealth Configuration

This document covers the Chrome stealth configuration used to bypass sophisticated detection mechanisms, including Google's anti-automation systems.

## Overview

The Chrome stealth configuration combines multiple techniques to make automated browsing indistinguishable from human interaction:

1. **Runtime.enable Patching** - Bypasses CDP detection vectors
2. **Stealth Flags** - Removes automation indicators
3. **Extension-Based Control** - Avoids exposed debugging ports
4. **Behavioral Simulation** - Human-like interaction patterns

## Chrome Launcher Script

### Location: [`cdp-stealth/chrome_start.sh`](../cdp-stealth/chrome_start.sh)

The Chrome launcher script configures the browser with anti-detection flags:

```bash
#!/bin/bash

# Critical stealth flags
CHROME_ARGS=(
    --disable-blink-features=AutomationControlled  # Removes navigator.webdriver
    --exclude-switches=enable-automation           # Removes automation switches
    --disable-automation                          # Disables automation mode
    --disable-ipc-flooding-protection            # Prevents IPC interference
    --no-first-run                              # Skips first-run setup
    --no-default-browser-check                   # Prevents default browser dialogs
    --user-data-dir="$USER_DATA_DIR"             # Isolated profile
)
```

### Critical Flags Explained

| Flag | Purpose | Detection Vector Bypassed |
|-------|---------|--------------------------|
| `--disable-blink-features=AutomationControlled` | Removes navigator.webdriver property | Primary automation detection |
| `--exclude-switches=enable-automation` | Removes automation switches from navigator.plugins | Command-line detection |
| `--disable-automation` | Disables Chrome's automation infrastructure | Internal automation detection |
| `--disable-ipc-flooding-protection` | Prevents IPC flooding protection interference | CDP communication stability |
| **NO `--remote-debugging-port`** | **CRITICAL** - Avoids exposing debugging port | Remote debugging detection |

## Runtime.enable Patching

### The Problem

Standard CDP usage calls `Runtime.enable()`, which triggers JavaScript hooks that can be observed by detection systems:

```javascript
// DETECTABLE - This triggers browser automation detection
await Runtime.enable();
```

### The Solution: rebrowser-patches

We use [rebrowser-patches](https://github.com/rebrowser/rebrowser-patches) to bypass this detection:

```bash
# Install rebrowser-patches
npm install rebrowser-puppeteer@latest
npx rebrowser-patches@latest patch --packageName puppeteer-core

# Set patching mode
export REBROWSER_PATCHES_RUNTIME_FIX_MODE=addBinding
```

### Patching Modes

#### Mode 1: addBinding (Recommended)

```javascript
// Instead of Runtime.enable():
await Runtime.addBinding({ name: '__rebrowser_context' });
// Then get context ID from binding callback
```

**Advantages:**
- Zero detection window
- Full CDP functionality
- Most stable option

#### Mode 2: alwaysIsolated

```javascript
// Runs code in isolated context
await Page.createIsolatedWorld('stealth_context', {});
```

**Advantages:**
- Complete isolation from main context
- Best for fingerprint manipulation
- No main context contamination

#### Mode 3: enableDisable

```javascript
// Brief enable then disable
await Runtime.enable();
await Runtime.disable();
```

**Advantages:**
- Minimal code changes
- Works with existing CDP code
- Brief but acceptable detection window

## Stealth Module Implementation

### Location: [`cdp-stealth/src/index.js`](../cdp-stealth/src/index.js)

The main stealth module provides enhanced browser and page objects:

```javascript
const { launchStealthBrowser, createStealthPage } = require('./src/index.js');

// Launch stealth browser
const browser = await launchStealthBrowser({
  headless: false,
  proxy: 'http://127.0.0.1:8080'
});

// Create enhanced page
const page = await createStealthPage(browser);
```

### Browser Stealth Features

```javascript
// Get stealth status
const status = await browser.stealth.getStatus();
console.log(status);
/*
{
  navigator: {
    webdriver: undefined,        // ✅ Correctly removed
    plugins: 5,
    languages: ['en-US', 'en'],
    platform: 'Linux x86_64'
  },
  chrome: {
    runtime: { id: undefined }  // ✅ Extension hidden
  }
}
*/

// Take verification screenshot
await browser.stealth.takeVerificationScreenshot('./debug/stealth-check.png');
```

### Page Stealth Features

```javascript
// Human-like typing with random delays
await page.stealth.humanType('input[name="email"]', 'user@example.com');

// Human-like clicking with position randomization
await page.stealth.humanClick('button[type="submit"]');

// Human-like waiting
await page.stealth.waitHumanTime(100, 300); // Random 100-300ms
```

## Configuration Management

### Location: [`cdp-stealth/src/config/environment.js`](../cdp-stealth/src/config/environment.js)

Environment configuration manages all stealth settings:

```javascript
const config = {
  chrome: {
    executable: '/usr/bin/google-chrome-stable',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--exclude-switches=enable-automation',
      '--disable-automation'
    ]
  },
  stealth: {
    runtimePatchingMode: 'addBinding',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    viewport: { width: 1366, height: 768 }
  }
};
```

### Custom Configuration

```javascript
const customConfig = {
  stealth: {
    runtimePatchingMode: 'alwaysIsolated',  // Override default
    randomizeUserAgent: true,              // Enable UA randomization
    emulateDevice: 'desktop'               // Device emulation
  },
  chrome: {
    args: [
      '--custom-user-agent="Mozilla/5.0..."'  // Custom UA
    ]
  }
};

const browser = await launchStealthBrowser(customConfig);
```

## Verification and Testing

### Stealth Verification Script

Location: [`cdp-stealth/src/test/verify-stealth-flags.js`](../cdp-stealth/src/test/verify-stealth-flags.js)

```javascript
const { verifyStealth } = require('../src/index.js');

async function runVerification() {
  const browser = await launchStealthBrowser();
  const results = await verifyStealth(browser);
  
  console.log('Stealth Verification Results:');
  console.log(`Overall: ${results.passed ? '✅ PASS' : '❌ FAIL'}`);
  
  for (const [name, check] of Object.entries(results.checks)) {
    console.log(`${check.passed ? '✅' : '❌'} ${name}: ${check.actual}`);
  }
}
```

### Expected Results

```
✅ navigator.webdriver: undefined
✅ chrome.runtime.id: undefined
✅ window.webdriver: undefined
✅ Overall: PASS
```

## Advanced Stealth Techniques

### WebGL Fingerprinting Bypass

```javascript
// Injected into page context
const getParameter = WebGLRenderingContext.prototype.getParameter;
WebGLRenderingContext.prototype.getParameter = function(parameter) {
  if (parameter === 37445) return 'Intel Inc.';
  if (parameter === 37446) return 'Intel Iris OpenGL Engine';
  return getParameter(parameter);
};
```

### Permissions API Override

```javascript
// Override permissions to avoid prompts
if (navigator.permissions) {
  const originalQuery = navigator.permissions.query;
  navigator.permissions.query = function(parameters) {
    if (parameters.name === 'notifications') {
      return Promise.resolve({ state: 'granted' });
    }
    return originalQuery(parameters);
  };
}
```

### Chrome Runtime Hiding

```javascript
// Hide extension runtime from detection
if (window.chrome && window.chrome.runtime) {
  Object.defineProperty(window.chrome.runtime, 'id', {
    get: () => undefined,
    configurable: true
  });
}
```

## Performance Considerations

### Impact on Speed

| Technique | Performance Impact | Detection Bypass |
|-----------|-------------------|------------------|
| addBinding | Minimal | Excellent |
| alwaysIsolated | Low | Excellent |
| enableDisable | None | Good |
| Extension Control | Low | Excellent |

### Memory Usage

```javascript
// Monitor memory usage
const stats = await browser.stealth.getMemoryStats();
console.log(`Memory usage: ${stats.heapUsed / 1024 / 1024} MB`);
```

## Troubleshooting

### Common Issues

#### "navigator.webdriver is defined"

**Cause**: Missing stealth flags or incorrect patching mode

**Solution**:
```bash
# Verify flags in chrome_start.sh
grep -E "(AutomationControlled|enable-automation)" chrome_start.sh

# Check patching mode
echo $REBROWSER_PATCHES_RUNTIME_FIX_MODE

# Reinstall patches
npm install rebrowser-puppeteer@latest
npx rebrowser-patches@latest patch --packageName puppeteer-core
```

#### Extension not loading

**Cause**: Manifest errors or missing files

**Solution**:
```bash
# Validate manifest
cat extensions/cdp-stealth/manifest.json | python3 -m json.tool

# Check required files
ls -la extensions/cdp-stealth/

# Reload extension in Chrome
# chrome://extensions/ -> Click reload button
```

#### CDP commands failing

**Cause**: Debugger not attached or wrong target

**Solution**:
```javascript
// Verify debugger attachment
const tabs = await browser.pages();
console.log(`Available tabs: ${tabs.length}`);

// Check debugger status
const status = await browser.stealth.getDebuggerStatus();
console.log('Debugger status:', status);
```

### Debug Mode

Enable comprehensive debugging:

```bash
# Enable debug logging
export DEBUG=cdp-stealth:*
export NODE_ENV=development

# Run with verbose output
node --trace-warnings src/index.js
```

## Best Practices

1. **Always use stealth flags** - Never launch Chrome without them
2. **Prefer addBinding mode** - Most reliable patching method
3. **Test verification** - Always run stealth verification before automation
4. **Monitor detection** - Watch for "unsafe browser" warnings
5. **Keep updated** - Update Chrome and patches regularly

## Security Considerations

- **Profile Isolation**: Use separate user data directory for automation
- **Extension Security**: Review extension permissions and code
- **Network Privacy**: Consider VPN or proxy for sensitive operations
- **Data Cleanup**: Clear browser data between sessions

## References

- [rebrowser-patches Documentation](https://github.com/rebrowser/rebrowser-patches)
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
- [Chrome Extension Manifest v3](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [WebGL Fingerprinting](https://browserleaks.com/webgl)