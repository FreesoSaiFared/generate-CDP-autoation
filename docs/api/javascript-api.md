# JavaScript API Reference

This document provides comprehensive API reference for the JavaScript library used in CDP automation system.

## Overview

The JavaScript API provides browser automation capabilities with advanced stealth features:

- **Browser Management** - Launch and control stealth browsers
- **Page Interaction** - Human-like interaction with web pages
- **Stealth Features** - Anti-detection mechanisms
- **State Management** - Browser state capture and restoration
- **Debugging Support** - Comprehensive debugging utilities

## Installation

```bash
npm install cdp-stealth-automation
```

```javascript
// Import the library
const { 
  launchStealthBrowser, 
  createStealthPage, 
  verifyStealth 
} = require('cdp-stealth-automation');

// Or with ES6 modules
import { 
  launchStealthBrowser, 
  createStealthPage, 
  verifyStealth 
} from 'cdp-stealth-automation';
```

## Core Classes

### StealthBrowser

The main class for launching and managing stealth browsers.

#### Constructor

```typescript
class StealthBrowser {
  constructor(options?: LaunchOptions);
}
```

#### Launch Options

```typescript
interface LaunchOptions {
  headless?: boolean;              // Default: false
  executablePath?: string;         // Default: auto-detect
  args?: string[];                // Default: stealth flags
  userDataDir?: string;            // Default: ./chrome-user-data
  proxy?: string;                  // Format: http://host:port
  userAgent?: string;               // Custom user agent
  viewport?: Viewport;             // Default: {width: 1366, height: 768}
  windowSize?: string;              // Default: "1366,768"
  ignoreHTTPSErrors?: boolean;     // Default: true
  defaultViewport?: null | Viewport; // Default: null
  timeout?: number;                 // Default: 30000
  stealth?: StealthConfig;          // Stealth configuration overrides
}

interface StealthConfig {
  runtimePatchingMode?: 'addBinding' | 'alwaysIsolated' | 'enableDisable';
  randomizeUserAgent?: boolean;
  emulateDevice?: 'desktop' | 'mobile' | 'tablet';
  webglVendor?: string;
  webglRenderer?: string;
  canvasNoise?: boolean;
  audioNoise?: boolean;
  timezone?: string;
  language?: string;
  platform?: string;
  hardwareConcurrency?: number;
  deviceMemory?: number;
}

interface Viewport {
  width: number;
  height: number;
  deviceScaleFactor?: number;
  isMobile?: boolean;
  hasTouch?: boolean;
  isLandscape?: boolean;
}
```

#### Methods

##### launchStealthBrowser()

```typescript
async function launchStealthBrowser(options?: LaunchOptions): Promise<StealthBrowserInstance>
```

Launches a stealth browser instance with anti-detection features.

**Parameters:**
- `options` (LaunchOptions, optional) - Configuration options

**Returns:** Promise<StealthBrowserInstance>

**Example:**
```javascript
const browser = await launchStealthBrowser({
  headless: false,
  proxy: 'http://127.0.0.1:8080',
  stealth: {
    runtimePatchingMode: 'addBinding',
    randomizeUserAgent: true,
    emulateDevice: 'desktop'
  }
});
```

##### StealthBrowserInstance

Enhanced browser instance with additional stealth methods:

```typescript
interface StealthBrowserInstance extends Browser {
  stealth: {
    getStatus(): Promise<StealthStatus>;
    takeVerificationScreenshot(outputPath?: string): Promise<string>;
    getMemoryStats(): Promise<MemoryStats>;
    getDebugInfo(): Promise<DebugInfo>;
  };
  newPage(): Promise<StealthPageInstance>;
}
```

**Methods:**

- `getStatus()` - Get current stealth status
- `takeVerificationScreenshot()` - Take verification screenshot
- `getMemoryStats()` - Get memory usage statistics
- `getDebugInfo()` - Get debugging information

**Example:**
```javascript
// Get stealth status
const status = await browser.stealth.getStatus();
console.log('Stealth status:', status);

// Take verification screenshot
const screenshotPath = await browser.stealth.takeVerificationScreenshot();
console.log('Screenshot saved:', screenshotPath);

// Get memory stats
const memoryStats = await browser.stealth.getMemoryStats();
console.log('Memory usage:', memoryStats.heapUsed / 1024 / 1024, 'MB');
```

### StealthPage

Enhanced page instance with human-like interaction methods.

#### Methods

##### createStealthPage()

```typescript
async function createStealthPage(browser: StealthBrowserInstance, options?: PageOptions): Promise<StealthPageInstance>
```

Creates a new page with stealth enhancements.

**Parameters:**
- `browser` (StealthBrowserInstance) - Browser instance
- `options` (PageOptions, optional) - Page configuration

**Returns:** Promise<StealthPageInstance>

##### Page Options

```typescript
interface PageOptions {
  userAgent?: string;
  viewport?: Viewport;
  extraHTTPHeaders?: Record<string, string>;
  ignoreHTTPSErrors?: boolean;
  timeout?: number;
  stealth?: PageStealthConfig;
}

interface PageStealthConfig {
  humanTyping?: boolean;              // Default: true
  humanClicking?: boolean;             // Default: true
  randomDelays?: boolean;             // Default: true
  mouseMovement?: boolean;             // Default: true
  keyboardSimulation?: boolean;        // Default: true
  canvasProtection?: boolean;          // Default: true
  webglProtection?: boolean;          // Default: true
  audioProtection?: boolean;           // Default: true
  timezoneSpoofing?: boolean;         // Default: true
  languageSpoofing?: boolean;         // Default: true
}
```

##### StealthPageInstance

Enhanced page instance with stealth methods:

```typescript
interface StealthPageInstance extends Page {
  stealth: {
    waitHumanTime(minMs?: number, maxMs?: number): Promise<void>;
    humanType(selector: string, text: string, options?: HumanTypeOptions): Promise<void>;
    humanClick(selector: string, options?: HumanClickOptions): Promise<void>;
    humanScroll(options?: HumanScrollOptions): Promise<void>;
    humanHover(selector: string, duration?: number): Promise<void>;
    humanDrag(sourceSelector: string, targetSelector: string): Promise<void>;
    simulateMouseMovement(path?: Array<{x: number, y: number}>): Promise<void>;
    getRandomDelay(min?: number, max?: number): number;
    getRandomMousePosition(element?: Element): {x: number, y: number};
    bypassDetection(): Promise<void>;
    getFingerprint(): Promise<BrowserFingerprint>;
  };
}
```

#### Stealth Page Methods

##### waitHumanTime()

```typescript
waitHumanTime(minMs?: number, maxMs?: number): Promise<void>
```

Waits for a random amount of time to simulate human behavior.

**Parameters:**
- `minMs` (number, optional) - Minimum delay in milliseconds (default: 100)
- `maxMs` (number, optional) - Maximum delay in milliseconds (default: 300)

**Example:**
```javascript
await page.stealth.waitHumanTime(500, 1500); // Random 500-1500ms delay
```

##### humanType()

```typescript
humanType(selector: string, text: string, options?: HumanTypeOptions): Promise<void>
```

Types text like a human with random delays and variations.

**Parameters:**
- `selector` (string) - CSS selector for element
- `text` (string) - Text to type
- `options` (HumanTypeOptions, optional) - Typing options

```typescript
interface HumanTypeOptions {
  delay?: number;                 // Custom delay between keystrokes
  mistakeRate?: number;            // Rate of typing mistakes (0-1)
  correctionDelay?: number;        // Delay before correcting mistakes
  clearFirst?: boolean;           // Clear field before typing
  caseVariation?: boolean;         // Randomly vary case
}
```

**Example:**
```javascript
await page.stealth.humanType('#email', 'user@example.com', {
  delay: 50 + Math.random() * 100,
  mistakeRate: 0.02,
  clearFirst: true
});
```

##### humanClick()

```typescript
humanClick(selector: string, options?: HumanClickOptions): Promise<void>
```

Clicks element like a human with random position and timing.

**Parameters:**
- `selector` (string) - CSS selector for element
- `options` (HumanClickOptions, optional) - Click options

```typescript
interface HumanClickOptions {
  position?: 'center' | 'random' | {x: number, y: number};
  delay?: number;                 // Delay before click
  holdDuration?: number;           // Mouse hold duration
  movementPath?: boolean;          // Add mouse movement path
  doubleClick?: boolean;           // Perform double click
  rightClick?: boolean;            // Perform right click
}
```

**Example:**
```javascript
await page.stealth.humanClick('#submit-button', {
  position: 'random',
  delay: 100,
  movementPath: true
});
```

##### humanScroll()

```typescript
humanScroll(options?: HumanScrollOptions): Promise<void>
```

Scrolls page like a human with variable speed and patterns.

**Parameters:**
- `options` (HumanScrollOptions, optional) - Scroll options

```typescript
interface HumanScrollOptions {
  direction?: 'down' | 'up' | 'left' | 'right';
  distance?: number;               // Scroll distance in pixels
  speed?: 'slow' | 'medium' | 'fast' | number;
  acceleration?: boolean;         // Accelerate/decelerate scroll
  randomPauses?: boolean;         // Add random pauses during scroll
}
```

**Example:**
```javascript
await page.stealth.humanScroll({
  direction: 'down',
  distance: 500,
  speed: 'medium',
  acceleration: true,
  randomPauses: true
});
```

##### bypassDetection()

```typescript
bypassDetection(): Promise<void>
```

Applies advanced anti-detection techniques dynamically.

**Example:**
```javascript
await page.stealth.bypassDetection();
```

##### getFingerprint()

```typescript
getFingerprint(): Promise<BrowserFingerprint>
```

Gets current browser fingerprint for analysis.

```typescript
interface BrowserFingerprint {
  userAgent: string;
  screen: {
    width: number;
    height: number;
    colorDepth: number;
    pixelDepth: number;
  };
  timezone: string;
  language: string;
  languages: string[];
  platform: string;
  hardware: {
    concurrency: number;
    memory: number;
    deviceMemory: number;
  };
  webgl: {
    vendor: string;
    renderer: string;
    version: string;
  };
  canvas: {
    fingerprint: string;
    noise: boolean;
  };
  audio: {
    context: string;
    fingerprint: string;
  };
}
```

## State Management

### Browser State Capture

```typescript
interface BrowserState {
  timestamp: string;
  url: string;
  title: string;
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires?: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: string;
  }>;
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  indexedDB?: any;
  sessionStorage?: Record<string, string>;
  plugins: Array<{
    name: string;
    description: string;
    filename: string;
  }>;
  permissions: Array<{
    name: string;
    state: 'granted' | 'prompt' | 'denied';
  }>;
}
```

#### captureState()

```typescript
async captureState(options?: StateCaptureOptions): Promise<BrowserState>
```

Captures complete browser state.

**Parameters:**
- `options` (StateCaptureOptions, optional) - Capture options

```typescript
interface StateCaptureOptions {
  includeCookies?: boolean;          // Default: true
  includeLocalStorage?: boolean;     // Default: true
  includeSessionStorage?: boolean;   // Default: true
  includeIndexedDB?: boolean;       // Default: false
  includeScreenshot?: boolean;       // Default: true
  includePermissions?: boolean;      // Default: true
}
```

**Example:**
```javascript
const state = await page.stealth.captureState({
  includeCookies: true,
  includeLocalStorage: true,
  includeScreenshot: true
});

console.log('Captured state:', state);
```

#### restoreState()

```typescript
async restoreState(state: BrowserState, options?: StateRestoreOptions): Promise<void>
```

Restores previously captured browser state.

**Parameters:**
- `state` (BrowserState) - State to restore
- `options` (StateRestoreOptions, optional) - Restore options

```typescript
interface StateRestoreOptions {
  clearExisting?: boolean;         // Default: true
  skipCookies?: boolean;           // Default: false
  skipStorage?: boolean;           // Default: false
  waitForNavigation?: boolean;      // Default: true
  timeout?: number;                // Default: 10000
}
```

**Example:**
```javascript
await page.stealth.restoreState(capturedState, {
  clearExisting: true,
  waitForNavigation: true,
  timeout: 15000
});
```

## Utility Functions

### verifyStealth()

```typescript
async function verifyStealth(browser: StealthBrowserInstance): Promise<StealthVerificationResult>
```

Verifies stealth implementation is working correctly.

```typescript
interface StealthVerificationResult {
  passed: boolean;
  checks: {
    [checkName: string]: {
      name: string;
      expected: any;
      actual: any;
      passed: boolean;
    };
  };
  timestamp: string;
  browserInfo: {
    userAgent: string;
    viewport: Viewport;
    platform: string;
  };
}
```

**Example:**
```javascript
const verification = await verifyStealth(browser);

console.log('Stealth verification passed:', verification.passed);
console.log('Checks:', verification.checks);

for (const [name, check] of Object.entries(verification.checks)) {
  console.log(`${check.passed ? '✅' : '❌'} ${name}: ${check.actual}`);
}
```

### getRandomDelay()

```typescript
function getRandomDelay(min?: number, max?: number): number
```

Generates random delay for human-like timing.

**Parameters:**
- `min` (number, optional) - Minimum delay (default: 100)
- `max` (number, optional) - Maximum delay (default: 300)

**Returns:** Random delay in milliseconds

**Example:**
```javascript
const delay = getRandomDelay(200, 800); // Random 200-800ms
await new Promise(resolve => setTimeout(resolve, delay));
```

### generateFingerprint()

```typescript
function generateFingerprint(options?: FingerprintOptions): BrowserFingerprint
```

Generates realistic browser fingerprint.

**Parameters:**
- `options` (FingerprintOptions, optional) - Fingerprint options

```typescript
interface FingerprintOptions {
  deviceType?: 'desktop' | 'mobile' | 'tablet';
  os?: 'windows' | 'macos' | 'linux' | 'android' | 'ios';
  browser?: 'chrome' | 'firefox' | 'safari' | 'edge';
  version?: string;
  screenResolution?: {width: number, height: number};
  timezone?: string;
  language?: string;
}
```

**Example:**
```javascript
const fingerprint = generateFingerprint({
  deviceType: 'desktop',
  os: 'windows',
  browser: 'chrome',
  version: '120.0.0.0',
  screenResolution: {width: 1920, height: 1080}
});

console.log('Generated fingerprint:', fingerprint);
```

## Event Handling

### Page Events

```typescript
// Stealth page extends standard Puppeteer page events
page.on('load', () => {
  console.log('Page loaded with stealth features');
});

page.on('framenavigated', (frame) => {
  console.log('Frame navigated:', frame.url());
});

// Custom stealth events
page.on('stealth:bypass-applied', () => {
  console.log('Stealth bypass techniques applied');
});

page.on('stealth:detection-attempt', (detection) => {
  console.log('Detection attempt detected:', detection);
});
```

### Browser Events

```typescript
browser.on('targetcreated', (target) => {
  console.log('New target created:', target.type());
});

browser.on('targetdestroyed', (target) => {
  console.log('Target destroyed:', target.type());
});

// Custom stealth events
browser.on('stealth:status-changed', (status) => {
  console.log('Stealth status changed:', status);
});
```

## Error Handling

### Error Types

```typescript
interface StealthError extends Error {
  code: ErrorCode;
  details?: any;
  timestamp: string;
  retryable: boolean;
}

enum ErrorCode {
  BrowserLaunchFailed = 'BROWSER_LAUNCH_FAILED',
  StealthConfigurationInvalid = 'STEALTH_CONFIG_INVALID',
  StateCaptureFailed = 'STATE_CAPTURE_FAILED',
  StateRestoreFailed = 'STATE_RESTORE_FAILED',
  ElementNotFound = 'ELEMENT_NOT_FOUND',
  Timeout = 'TIMEOUT',
  DetectionBypassFailed = 'DETECTION_BYPASS_FAILED'
}
```

### Error Handling Pattern

```typescript
try {
  await page.stealth.humanType('#email', 'user@example.com');
} catch (error) {
  if (error.code === 'ELEMENT_NOT_FOUND') {
    console.log('Element not found, retrying with different selector');
    await page.stealth.humanType('input[name="email"]', 'user@example.com');
  } else if (error.retryable) {
    console.log('Retryable error, retrying...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    // Retry operation
  } else {
    console.error('Non-retryable error:', error);
    throw error;
  }
}
```

## Performance Optimization

### Resource Management

```typescript
// Configure memory limits
const browser = await launchStealthBrowser({
  stealth: {
    memoryLimit: '512MB',
    enableMemoryOptimization: true
  }
});

// Monitor memory usage
setInterval(async () => {
  const memory = await browser.stealth.getMemoryStats();
  if (memory.heapUsed > 500 * 1024 * 1024) { // 500MB
    console.warn('High memory usage detected:', memory.heapUsed);
  }
}, 10000);
```

### Connection Pooling

```typescript
// Create browser pool for parallel operations
const browserPool = new StealthBrowserPool({
  maxBrowsers: 3,
  minBrowsers: 1,
  idleTimeoutMs: 300000
});

const browser = await browserPool.acquire();
// Use browser...
await browserPool.release(browser);
```

## Configuration

### Environment Variables

```bash
# Stealth configuration
export STEALTH_RUNTIME_PATCHING_MODE=addBinding
export STEALTH_USER_AGENT_RANDOMIZATION=true
export STEALTH_DEVICE_EMULATION=desktop

# Performance settings
export STEALTH_MEMORY_LIMIT=512MB
export STEALTH_TIMEOUT=30000
export STEALTH_RETRY_ATTEMPTS=3

# Debug settings
export STEALTH_DEBUG=true
export STEALTH_LOG_LEVEL=debug
export STEALTH_SCREENSHOTS_ENABLED=true
```

### Configuration File

```javascript
// stealth-config.json
{
  "browser": {
    "executablePath": "/usr/bin/google-chrome",
    "userDataDir": "./chrome-user-data",
    "args": [
      "--disable-blink-features=AutomationControlled",
      "--exclude-switches=enable-automation"
    ]
  },
  "stealth": {
    "runtimePatchingMode": "addBinding",
    "randomizeUserAgent": true,
    "emulateDevice": "desktop",
    "canvasNoise": true,
    "webglProtection": true,
    "timezoneSpoofing": true,
    "languageSpoofing": true
  },
  "performance": {
    "memoryLimit": "512MB",
    "timeout": 30000,
    "retryAttempts": 3,
    "enableOptimization": true
  },
  "debug": {
    "enabled": false,
    "logLevel": "info",
    "screenshots": true,
    "verboseErrors": true
  }
}
```

## Testing

### Unit Testing

```javascript
const { expect } = require('chai');
const { launchStealthBrowser } = require('cdp-stealth-automation');

describe('StealthBrowser', () => {
  it('should launch with stealth configuration', async () => {
    const browser = await launchStealthBrowser({
      headless: true,
      stealth: {
        runtimePatchingMode: 'addBinding'
      }
    });
    
    expect(browser).to.exist;
    expect(browser.stealth).to.exist;
    
    await browser.close();
  });
  
  it('should apply stealth features', async () => {
    const browser = await launchStealthBrowser();
    const page = await browser.newPage();
    
    const status = await browser.stealth.getStatus();
    expect(status.passed).to.be.true;
    
    await browser.close();
  });
});
```

### Integration Testing

```javascript
describe('Gmail Login', () => {
  let browser;
  let page;
  
  beforeEach(async () => {
    browser = await launchStealthBrowser({
      headless: false,
      stealth: {
        runtimePatchingMode: 'addBinding'
      }
    });
    page = await browser.newPage();
  });
  
  afterEach(async () => {
    await browser.close();
  });
  
  it('should login successfully', async () => {
    await page.goto('https://accounts.google.com/ServiceLogin');
    
    await page.stealth.humanType('input[type="email"]', 'test@gmail.com');
    await page.stealth.humanClick('#identifierNext');
    
    await page.waitForSelector('input[type="password"]', {timeout: 10000});
    await page.stealth.humanType('input[type="password"]', 'password');
    await page.stealth.humanClick('#passwordNext');
    
    await page.waitForNavigation({timeout: 30000});
    expect(page.url()).to.include('mail.google.com');
  });
});
```

## References

- [Puppeteer Documentation](https://pptr.dev/)
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
- [Browser Fingerprinting](https://browserleaks.com/)
- [WebGL Specifications](https://www.khronos.org/registry/webgl/specs/latest/)
- [Canvas Fingerprinting](https://github.com/kkapsner/CanvasBlocker)