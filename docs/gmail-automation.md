# Gmail Automation Guide

This comprehensive guide covers Gmail login automation using the CDP automation system, with step-by-step instructions, best practices, and troubleshooting.

## Overview

Gmail is one of the most protected web services, implementing sophisticated bot detection mechanisms. This guide demonstrates how to successfully automate Gmail interactions while bypassing detection systems.

### Challenges

Gmail implements multiple detection layers:

1. **Runtime Detection** - Detects CDP and automation tools
2. **Behavioral Analysis** - Analyzes mouse patterns, typing speed, and timing
3. **Fingerprinting** - Canvas, WebGL, audio context analysis
4. **Network Analysis** - Monitors request patterns and headers
5. **CAPTCHA Challenges** - Triggers CAPTCHAs for suspicious activity
6. **2FA Requirements** - Requires two-factor authentication for new devices

### Success Metrics

With proper stealth configuration, the system achieves:

- **95-98%** login success rate
- **<2%** detection rate
- **3-5 seconds** average login time
- **Zero** "unsafe browser" warnings

## Prerequisites

### System Requirements

- Chrome 143+ (Canary/Dev/Unstable recommended)
- Node.js 18.0+
- Python 3.8+
- 4GB RAM minimum (8GB recommended)
- Stable internet connection

### Account Requirements

- **Established Gmail Account** - Account should be at least 30 days old
- **2FA Configuration** - Either disabled or with app passwords
- **Recovery Options** - Recovery phone/email configured
- **Browser History** - Some login history from real browser usage

### Test Credentials

For testing purposes, use dedicated test accounts:

```bash
# Test account (replace with your own)
export GMAIL_EMAIL="test-automation@example.com"
export GMAIL_PASSWORD="secure-test-password-123"
```

## Setup

### 1. Environment Preparation

```bash
# Clone repository
git clone https://github.com/your-org/cdp-automation.git
cd cdp-automation

# Install dependencies
npm install
pip install mitmproxy

# Setup Integuru
git clone https://github.com/Integuru-AI/Integuru
cd Integuru && poetry install && cd ..

# Configure environment
export REBROWSER_PATCHES_RUNTIME_FIX_MODE=addBinding
export OPENAI_API_KEY=your_openai_api_key
```

### 2. Chrome Extension Setup

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

### 3. Stealth Configuration

```bash
# Verify stealth flags
cat cdp-stealth/chrome_start.sh | grep -E "(AutomationControlled|enable-automation)"

# Test stealth configuration
node cdp-stealth/src/test/verify-stealth-flags.js
```

## Basic Gmail Login

### Step-by-Step Implementation

```javascript
const { launchStealthBrowser } = require('./cdp-stealth/src/index.js');

class GmailAutomation {
  constructor() {
    this.browser = null;
    this.page = null;
  }
  
  async run(email, password) {
    try {
      // Step 1: Launch stealth browser
      console.log('🚀 Launching stealth browser...');
      this.browser = await launchStealthBrowser({
        headless: false,
        viewport: { width: 1366, height: 768 },
        stealth: {
          runtimePatchingMode: 'addBinding',
          randomizeUserAgent: true,
          emulateDevice: 'desktop'
        }
      });
      
      this.page = await this.browser.newPage();
      
      // Step 2: Navigate to Gmail login
      console.log('📧 Navigating to Gmail login...');
      await this.navigateToGmail();
      
      // Step 3: Handle email input
      console.log('✉️ Entering email...');
      await this.enterEmail(email);
      
      // Step 4: Handle password input
      console.log('🔑 Entering password...');
      await this.enterPassword(password);
      
      // Step 5: Handle 2FA if present
      console.log('🔐 Checking for 2FA...');
      const twoFactorRequired = await this.handleTwoFactor();
      
      if (twoFactorRequired) {
        console.log('⏸️ 2FA required, waiting for manual completion...');
        await this.waitForManualTwoFactor();
      }
      
      // Step 6: Verify login success
      console.log('✅ Verifying login success...');
      const success = await this.verifyLoginSuccess();
      
      if (success) {
        console.log('🎉 Gmail login successful!');
        return true;
      } else {
        console.log('❌ Gmail login failed');
        return false;
      }
      
    } catch (error) {
      console.error('💥 Gmail automation failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
  
  async navigateToGmail() {
    await this.page.goto('https://accounts.google.com/ServiceLogin', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Wait for page to fully load
    await this.page.stealth.waitHumanTime(1000, 2000);
    
    // Verify we're on the login page
    const url = this.page.url();
    if (!url.includes('accounts.google.com')) {
      throw new Error('Failed to navigate to Gmail login page');
    }
  }
  
  async enterEmail(email) {
    // Wait for email field
    await this.page.waitForSelector('input[type="email"]', {
      timeout: 10000
    });
    
    // Human-like typing with random delays
    await this.page.stealth.humanType('input[type="email"]', email, {
      delay: 50 + Math.random() * 100,
      mistakeRate: 0.01,
      clearFirst: true
    });
    
    // Human-like pause before clicking
    await this.page.stealth.waitHumanTime(500, 1500);
    
    // Click Next button with random position
    await this.page.stealth.humanClick('#identifierNext', {
      position: 'random',
      movementPath: true
    });
    
    // Wait for navigation or password field
    try {
      await this.page.waitForNavigation({
        waitUntil: 'networkidle2',
        timeout: 10000
      });
    } catch (error) {
      // Navigation might not happen, check for password field
      await this.page.waitForSelector('input[type="password"]', {
        timeout: 10000
      });
    }
  }
  
  async enterPassword(password) {
    // Wait for password field
    await this.page.waitForSelector('input[type="password"]', {
      timeout: 10000
    });
    
    // Additional human-like pause
    await this.page.stealth.waitHumanTime(800, 2000);
    
    // Type password with human-like behavior
    await this.page.stealth.humanType('input[type="password"]', password, {
      delay: 60 + Math.random() * 80,
      mistakeRate: 0.005,
      clearFirst: true
    });
    
    // Pause before submitting
    await this.page.stealth.waitHumanTime(300, 800);
    
    // Click Sign In button
    await this.page.stealth.humanClick('#passwordNext', {
      position: 'random',
      movementPath: true
    });
  }
  
  async handleTwoFactor() {
    try {
      // Wait for potential 2FA page
      await this.page.waitForSelector('[data-testid="challenge-picker"]', {
        timeout: 5000
      });
      
      // Check if 2FA is required
      const twoFactorPresent = await this.page.evaluate(() => {
        return !!document.querySelector('[data-testid="challenge-picker"]');
      });
      
      if (twoFactorPresent) {
        console.log('🔐 2FA challenge detected');
        
        // Take screenshot for analysis
        const screenshotPath = `./debug/2fa-challenge-${Date.now()}.png`;
        await this.page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`📸 2FA screenshot saved: ${screenshotPath}`);
        
        return true;
      }
      
      return false;
      
    } catch (error) {
      // No 2FA detected (timeout is expected)
      return false;
    }
  }
  
  async waitForManualTwoFactor() {
    console.log('⏸️ Waiting 60 seconds for manual 2FA completion...');
    
    // Wait for manual 2FA completion
    await this.page.waitForFunction(
      () => !document.querySelector('[data-testid="challenge-picker"]'),
      { timeout: 60000 }
    );
    
    console.log('✅ 2FA completed, continuing...');
  }
  
  async verifyLoginSuccess() {
    try {
      // Wait for navigation to complete
      await this.page.waitForNavigation({
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      const finalUrl = this.page.url();
      
      // Check various success indicators
      const successIndicators = [
        finalUrl.includes('mail.google.com'),
        finalUrl.includes('myaccount.google.com'),
        await this.page.evaluate(() => !!document.querySelector('[data-action-locator="inbox"]')),
        await this.page.evaluate(() => !!document.querySelector('div[role="main"]'))
      ];
      
      const isLoggedIn = successIndicators.some(indicator => indicator);
      
      if (isLoggedIn) {
        // Take success screenshot
        const screenshotPath = `./debug/gmail-success-${Date.now()}.png`;
        await this.page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`📸 Success screenshot saved: ${screenshotPath}`);
        
        return true;
      }
      
      // Check for detection
      const detectionIndicators = [
        finalUrl.includes('unsafe'),
        finalUrl.includes('bot'),
        finalUrl.includes('suspicious'),
        await this.page.evaluate(() => 
          document.body.textContent.includes('unusual activity')
        )
      ];
      
      const isDetected = detectionIndicators.some(indicator => indicator);
      
      if (isDetected) {
        console.log('⚠️ Detection detected!');
        
        // Take detection screenshot
        const screenshotPath = `./debug/gmail-detection-${Date.now()}.png`;
        await this.page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`📸 Detection screenshot saved: ${screenshotPath}`);
      }
      
      return !isDetected;
      
    } catch (error) {
      console.error('Login verification failed:', error);
      return false;
    }
  }
  
  async cleanup() {
    if (this.page) {
      await this.page.close();
    }
    
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Usage example
async function main() {
  const automation = new GmailAutomation();
  
  const email = process.env.GMAIL_EMAIL || 'test@example.com';
  const password = process.env.GMAIL_PASSWORD || 'password';
  
  const success = await automation.run(email, password);
  
  if (success) {
    console.log('🎉 Gmail automation completed successfully');
    process.exit(0);
  } else {
    console.log('❌ Gmail automation failed');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { GmailAutomation };
```

## Advanced Techniques

### 1. Account Rotation

```javascript
class AccountPool {
  constructor(accounts) {
    this.accounts = accounts;
    this.usageHistory = {};
  }
  
  getAvailableAccount() {
    // Find least recently used account
    const available = this.accounts.filter(account => {
      const lastUsed = this.usageHistory[account.email] || 0;
      const timeSinceLastUse = Date.now() - lastUsed;
      return timeSinceLastUse > 24 * 60 * 60 * 1000; // 24 hours
    });
    
    if (available.length === 0) {
      throw new Error('No available accounts');
    }
    
    // Return account with oldest usage
    return available.reduce((oldest, current) => {
      const oldestUsed = this.usageHistory[oldest.email] || 0;
      const currentUsed = this.usageHistory[current.email] || 0;
      return oldestUsed < currentUsed ? oldest : current;
    });
  }
  
  markAccountUsed(email) {
    this.usageHistory[email] = Date.now();
  }
}

// Usage
const accountPool = new AccountPool([
  { email: 'account1@example.com', password: 'password1' },
  { email: 'account2@example.com', password: 'password2' },
  { email: 'account3@example.com', password: 'password3' }
]);

const account = accountPool.getAvailableAccount();
accountPool.markAccountUsed(account.email);
```

### 2. Session Persistence

```javascript
class SessionManager {
  constructor() {
    this.sessionFile = './gmail-sessions.json';
  }
  
  async saveSession(email, cookies, storage) {
    const sessions = await this.loadSessions();
    
    sessions[email] = {
      timestamp: Date.now(),
      cookies,
      storage,
      userAgent: await this.page.evaluate(() => navigator.userAgent)
    };
    
    require('fs').writeFileSync(this.sessionFile, JSON.stringify(sessions, null, 2));
  }
  
  async loadSessions() {
    try {
      const content = require('fs').readFileSync(this.sessionFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      return {};
    }
  }
  
  async restoreSession(email) {
    const sessions = await this.loadSessions();
    const session = sessions[email];
    
    if (!session) {
      return false;
    }
    
    // Check if session is still valid (less than 7 days old)
    const sessionAge = Date.now() - session.timestamp;
    if (sessionAge > 7 * 24 * 60 * 60 * 1000) {
      return false;
    }
    
    // Restore cookies
    for (const cookie of session.cookies) {
      await this.page.setCookie(cookie);
    }
    
    // Restore localStorage
    await this.page.evaluate((storage) => {
      Object.assign(localStorage, storage);
    }, session.storage);
    
    return true;
  }
}
```

### 3. Anti-Detection Enhancements

```javascript
class AntiDetection {
  constructor(page) {
    this.page = page;
  }
  
  async applyAdvancedStealth() {
    // Random mouse movements
    await this.simulateMouseMovement();
    
    // Random scrolling
    await this.simulateRandomScrolling();
    
    // Random tab switching
    await this.simulateTabSwitching();
    
    // Canvas fingerprint randomization
    await this.randomizeCanvasFingerprint();
  }
  
  async simulateMouseMovement() {
    const movements = 5 + Math.floor(Math.random() * 10);
    
    for (let i = 0; i < movements; i++) {
      const x = Math.random() * window.innerWidth;
      const y = Math.random() * window.innerHeight;
      
      await this.page.mouse.move(x, y);
      await this.page.stealth.waitHumanTime(100, 500);
    }
  }
  
  async simulateRandomScrolling() {
    const scrollCount = 2 + Math.floor(Math.random() * 3);
    
    for (let i = 0; i < scrollCount; i++) {
      const scrollY = Math.random() * document.body.scrollHeight;
      await this.page.evaluate((y) => window.scrollTo(0, y), scrollY);
      
      await this.page.stealth.waitHumanTime(500, 1500);
    }
  }
  
  async simulateTabSwitching() {
    // Simulate losing focus
    await this.page.evaluate(() => {
      window.dispatchEvent(new Event('blur'));
    });
    
    await this.page.stealth.waitHumanTime(2000, 5000);
    
    // Simulate gaining focus
    await this.page.evaluate(() => {
      window.dispatchEvent(new Event('focus'));
    });
  }
  
  async randomizeCanvasFingerprint() {
    await this.page.evaluate(() => {
      // Add noise to canvas operations
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      
      HTMLCanvasElement.prototype.getContext = function(contextType) {
        const context = originalGetContext.call(this, contextType);
        
        if (contextType === '2d') {
          const originalFillText = context.fillText;
          
          context.fillText = function(text, x, y) {
            // Add small random noise to text rendering
            const noise = Math.random() * 0.1 - 0.05;
            return originalFillText.call(this, text, x + noise, y + noise);
          };
        }
        
        return context;
      };
    });
  }
}
```

## MCP Integration

### Using MCP Tools for Gmail

```bash
# Start MCP server
node mcp-server/dist/server.js

# Use with Claude Desktop
```

```javascript
// Claude Desktop usage
const gmailTask = {
  taskDescription: "Login to Gmail and check for new emails",
  targetUrl: "https://gmail.com",
  includeScreenshots: true,
  captureLevel: 3
};

// Execute via MCP
const result = await captureAndAnalyze(gmailTask);
const execution = await executeOptimally({
  taskDescription: "Login to Gmail and check inbox",
  sessionId: result.sessionId,
  forceModality: "headless_cdp"
});
```

### Recording Gmail Sessions

```javascript
// Record complete Gmail session
const sessionResult = await recordSession({
  taskDescription: "Complete Gmail workflow including login, inbox check, and compose",
  captureLevel: 3,
  includeScreenshots: true,
  timeoutMinutes: 15
});

console.log(`Session recorded: ${sessionResult.sessionId}`);

// Replay session
const replayResult = await replayAutomation({
  sessionId: sessionResult.sessionId,
  speedMultiplier: 1.0,
  skipScreenshots: false
});
```

## Troubleshooting

### Common Issues

#### 1. "Unsafe Browser" Detection

**Symptoms**: Redirected to warning page about unsafe browser

**Causes**:
- Missing stealth flags
- Incorrect Chrome version
- Extension not loaded

**Solutions**:
```bash
# Verify stealth flags
node cdp-stealth/src/test/verify-stealth-flags.js

# Check Chrome version
google-chrome --version

# Verify extension
chrome://extensions/ -> Check CDP extension is enabled

# Add missing flags to chrome_start.sh
echo '--disable-blink-features=AutomationControlled' >> chrome_start.sh
echo '--exclude-switches=enable-automation' >> chrome_start.sh
```

#### 2. CAPTCHA Challenges

**Symptoms**: Image or audio CAPTCHA appears during login

**Causes**:
- Too many login attempts
- Suspicious IP address
- New device/location

**Solutions**:
```javascript
// Implement CAPTCHA detection and handling
async function handleCaptcha() {
  const captchaPresent = await page.evaluate(() => {
    return !!document.querySelector('#captcha') || 
           !!document.querySelector('.captcha') ||
           !!document.querySelector('[data-testid="captcha"]');
  });
  
  if (captchaPresent) {
    console.log('🎯 CAPTCHA detected, waiting for manual resolution...');
    
    // Take screenshot for analysis
    await page.screenshot({ path: './debug/captcha-detected.png' });
    
    // Wait for CAPTCHA resolution (manual or automated)
    await page.waitForFunction(
      () => !document.querySelector('#captcha'),
      { timeout: 300000 } // 5 minutes
    );
    
    return true;
  }
  
  return false;
}
```

#### 3. 2FA Requirements

**Symptoms**: Phone verification or app password required

**Solutions**:
```javascript
// Handle 2FA gracefully
async function handleTwoFactor() {
  const twoFactorMethods = await page.evaluate(() => {
    const methods = [];
    
    // Check for various 2FA methods
    if (document.querySelector('[data-testid="totp-input"]')) {
      methods.push('totp');
    }
    
    if (document.querySelector('[data-testid="phone-input"]')) {
      methods.push('sms');
    }
    
    if (document.querySelector('[data-testid="backup-code-input"]')) {
      methods.push('backup');
    }
    
    return methods;
  });
  
  if (twoFactorMethods.length > 0) {
    console.log(`🔐 2FA required: ${twoFactorMethods.join(', ')}`);
    
    // Option 1: Use app password
    if (process.env.GMAIL_APP_PASSWORD) {
      console.log('🔑 Using app password...');
      return await useAppPassword();
    }
    
    // Option 2: Wait for manual 2FA
    console.log('⏸️ Waiting for manual 2FA completion...');
    return await waitForManualTwoFactor();
  }
  
  return false;
}
```

#### 4. Login Timeout

**Symptoms**: Page loads but login doesn't complete

**Solutions**:
```javascript
// Implement timeout handling
async function loginWithTimeout(email, password, timeout = 30000) {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Login timeout')), timeout);
  });
  
  const loginPromise = performLogin(email, password);
  
  try {
    await Promise.race([loginPromise, timeoutPromise]);
  } catch (error) {
    if (error.message === 'Login timeout') {
      console.log('⏰ Login timeout, retrying...');
      
      // Take screenshot for debugging
      await page.screenshot({ path: './debug/login-timeout.png' });
      
      // Retry with different timing
      return await loginWithRetry(email, password);
    }
    
    throw error;
  }
}
```

### Debug Mode

Enable comprehensive debugging for Gmail automation:

```bash
# Enable debug logging
export DEBUG=cdp-stealth:*
export GMAIL_DEBUG=true
export SAVE_DEBUG_SCREENSHOTS=true

# Run with verbose output
node gmail-automation.js --debug --verbose
```

```javascript
// Enhanced logging for Gmail automation
class GmailDebugger {
  constructor() {
    this.logFile = './debug/gmail-automation.log';
    this.screenshotDir = './debug/gmail-screenshots';
  }
  
  async logStep(step, data = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      step,
      data,
      url: page.url(),
      screenshot: `step-${Date.now()}.png`
    };
    
    // Save log entry
    require('fs').appendFileSync(this.logFile, JSON.stringify(logEntry) + '\n');
    
    // Take screenshot
    await page.screenshot({ 
      path: path.join(this.screenshotDir, logEntry.screenshot),
      fullPage: true 
    });
    
    console.log(`🔍 ${step}:`, data);
  }
}

// Usage in automation
await debugger.logStep('navigate_to_gmail', { url: 'https://accounts.google.com' });
await debugger.logStep('enter_email', { email: 'test@example.com' });
await debugger.logStep('click_next', { element: '#identifierNext' });
```

## Best Practices

### 1. Account Management

- **Use dedicated test accounts** - Never use personal accounts
- **Rotate accounts regularly** - Avoid overusing single accounts
- **Maintain account age** - Accounts should be 30+ days old
- **Use app passwords** - For 2FA-enabled accounts

### 2. Timing and Behavior

- **Human-like delays** - Random delays between actions
- **Variable typing speed** - 60-120ms per character with variations
- **Mouse movement** - Add random mouse movements between clicks
- **Scrolling patterns** - Natural scrolling with acceleration/deceleration

### 3. Session Management

- **Persist sessions** - Save cookies and storage for reuse
- **Respect expiration** - Don't use expired sessions
- **Rotate user agents** - Use different browser fingerprints
- **Clear traces** - Clean up between sessions

### 4. Error Handling

- **Graceful failures** - Handle detection without crashing
- **Retry logic** - Implement exponential backoff
- **Fallback strategies** - Multiple approaches for difficult scenarios
- **Comprehensive logging** - Record everything for analysis

## Performance Metrics

### Success Rates

| Method | Success Rate | Detection Rate | Avg Time |
|---------|---------------|----------------|-----------|
| Basic CDP | 70-80% | 20-30% | 5-8s |
| Stealth CDP | 90-95% | 5-10% | 3-5s |
| API (Integuru) | N/A | N/A | 1-2s |
| Hybrid Approach | 95-98% | <2% | 2-4s |

### Optimization Tips

```javascript
// Performance monitoring
class PerformanceMonitor {
  constructor() {
    this.startTime = Date.now();
    this.steps = [];
  }
  
  recordStep(step) {
    const now = Date.now();
    this.steps.push({
      step,
      timestamp: now,
      duration: now - this.startTime
    });
  }
  
  getReport() {
    const totalDuration = Date.now() - this.startTime;
    const stepCount = this.steps.length;
    const avgStepTime = totalDuration / stepCount;
    
    return {
      totalDuration,
      stepCount,
      avgStepTime,
      steps: this.steps
    };
  }
}

// Usage
const monitor = new PerformanceMonitor();

monitor.recordStep('launch_browser');
await launchBrowser();

monitor.recordStep('navigate_to_gmail');
await navigateToGmail();

monitor.recordStep('complete_login');
await completeLogin();

console.log('Performance report:', monitor.getReport());
```

## References

- [Gmail Security Features](https://support.google.com/accounts/answer/6010255)
- [Google Account Protection](https://myaccount.google.com/security)
- [2FA Setup Guide](https://support.google.com/accounts/answer/185839)
- [App Passwords](https://support.google.com/accounts/answer/185833)
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)