# Debugging Infrastructure Guide

This document covers the comprehensive debugging infrastructure for the CDP automation system, including logging, monitoring, visual verification, and troubleshooting techniques.

## Overview

The debugging infrastructure provides:

- **Comprehensive Logging** - Multi-level logging across all components
- **Visual Verification** - Screenshot-based verification with GLM-4.5V integration
- **Performance Monitoring** - Resource usage and timing analysis
- **Error Tracking** - Detailed error reporting and analysis
- **Debug Tools** - Interactive debugging utilities

## Logging System

### Winston Configuration

**Location**: [`cdp-stealth/src/test/test-logger.js`](../cdp-stealth/src/test/test-logger.js)

```javascript
const winston = require('winston');
const path = require('path');

// Configure logger with multiple transports
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { 
    service: 'cdp-automation',
    version: '1.0.0'
  },
  transports: [
    // Error log file
    new winston.transports.File({
      filename: path.join(process.cwd(), 'debug', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),
    
    // Combined log file
    new winston.transports.File({
      filename: path.join(process.cwd(), 'debug', 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 10,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),
    
    // Console output with colors
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({
          format: 'HH:mm:ss'
        }),
        winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
          let msg = `${timestamp} [${service}] ${level}: ${message}`;
          
          // Add metadata if present
          if (Object.keys(meta).length > 0) {
            msg += ` ${JSON.stringify(meta)}`;
          }
          
          return msg;
        })
      )
    })
  ]
});

// Create debug directory if it doesn't exist
const fs = require('fs');
const debugDir = path.join(process.cwd(), 'debug');
if (!fs.existsSync(debugDir)) {
  fs.mkdirSync(debugDir, { recursive: true });
}

module.exports = logger;
```

### Component-Specific Logging

#### CDP Stealth Logging

```javascript
// In cdp-stealth/src/index.js
const logger = require('./test/test-logger');

class StealthBrowser {
  async launchStealthBrowser(options = {}) {
    logger.info('Launching stealth browser', { 
      chrome: config.chrome.executable,
      argsCount: config.chrome.args.length,
      runtimePatchingMode: config.stealth.runtimePatchingMode
    });
    
    try {
      const browser = await puppeteer.launch({
        // ... launch options
      });
      
      logger.debug('Browser launched successfully', {
        processId: browser.process()?.pid,
        websocketEndpoint: browser.wsEndpoint()
      });
      
      return browser;
      
    } catch (error) {
      logger.error('Failed to launch stealth browser', {
        error: error.message,
        stack: error.stack,
        options
      });
      throw error;
    }
  }
}
```

#### MCP Server Logging

```typescript
// In mcp-server/server.ts
import * as winston from 'winston';

class CDPAutomationServer {
  private setupLogger(): void {
    this.logger = winston.createLogger({
      level: this.config.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'cdp-mcp-server' },
      transports: [
        new winston.transports.File({ 
          filename: path.join(process.cwd(), 'logs', 'mcp-server.log'),
          level: 'info' 
        }),
        new winston.transports.File({ 
          filename: path.join(process.cwd(), 'logs', 'mcp-server-error.log'), 
          level: 'error' 
        }),
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });
  }
  
  private async handleCaptureAndAnalyze(args: CaptureAndAnalyzeInput): Promise<ToolResponse> {
    this.logger.info('Tool called: capture-and-analyze', { args });
    
    try {
      const result = await this.captureAndAnalyzeTool.execute(args);
      this.logger.info('Tool completed: capture-and-analyze', { 
        sessionId: result.sessionId,
        confidence: result.confidence 
      });
      return result;
      
    } catch (error) {
      this.logger.error('Tool execution failed: capture-and-analyze', {
        error: error.message,
        stack: error.stack,
        args
      });
      throw error;
    }
  }
}
```

## Visual Verification System

### Screenshot Capture

**Location**: [`cdp-stealth/src/debug/visual-verification.js`](../cdp-stealth/src/debug/visual-verification.js)

```javascript
const fs = require('fs').promises;
const path = require('path');

class VisualVerification {
  constructor(browser) {
    this.browser = browser;
    this.screenshotDir = path.join(process.cwd(), 'debug', 'screenshots');
    this.verificationHistory = [];
  }
  
  async takeVerificationScreenshot(label = 'verification') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${label}-${timestamp}.png`;
    const filepath = path.join(this.screenshotDir, filename);
    
    try {
      // Ensure directory exists
      await fs.mkdir(this.screenshotDir, { recursive: true });
      
      // Get all pages
      const pages = await this.browser.pages();
      if (pages.length === 0) {
        throw new Error('No pages available for screenshot');
      }
      
      const page = pages[0];
      
      // Take full page screenshot
      await page.screenshot({ 
        path: filepath, 
        fullPage: true,
        type: 'png'
      });
      
      // Get page info for analysis
      const pageInfo = await page.evaluate(() => ({
        url: window.location.href,
        title: document.title,
        userAgent: navigator.userAgent,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      }));
      
      const verification = {
        timestamp: new Date().toISOString(),
        label,
        filename,
        filepath,
        pageInfo,
        stealthStatus: await this.getStealthStatus(page)
      };
      
      // Save verification data
      this.verificationHistory.push(verification);
      await this.saveVerificationData(verification);
      
      console.log(`✅ Verification screenshot saved: ${filename}`);
      return verification;
      
    } catch (error) {
      console.error(`❌ Screenshot capture failed: ${error.message}`);
      throw error;
    }
  }
  
  async getStealthStatus(page) {
    return await page.evaluate(() => {
      const checks = {
        navigator: {
          webdriver: navigator.webdriver,
          plugins: navigator.plugins.length,
          languages: navigator.languages
        },
        chrome: {
          runtime: typeof chrome !== 'undefined' ? {
            id: chrome.runtime?.id
          } : null
        },
        window: {
          webdriver: typeof window.webdriver !== 'undefined'
        },
        document: {
          automationIndicators: document.body.textContent.includes('unsafe browser')
        }
      };
      
      return checks;
    });
  }
  
  async saveVerificationData(verification) {
    const dataFile = path.join(this.screenshotDir, `${verification.label}-data.json`);
    await fs.writeFile(dataFile, JSON.stringify(verification, null, 2));
  }
  
  async generateVerificationReport() {
    const report = {
      timestamp: new Date().toISOString(),
      totalVerifications: this.verificationHistory.length,
      verifications: this.verificationHistory,
      summary: this.generateSummary()
    };
    
    const reportPath = path.join(this.screenshotDir, 'verification-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    return report;
  }
  
  generateSummary() {
    const summary = {
      stealthIssues: 0,
      automationDetected: 0,
      uniquePages: new Set(),
      averageTimeBetweenScreenshots: 0
    };
    
    for (let i = 0; i < this.verificationHistory.length; i++) {
      const verification = this.verificationHistory[i];
      
      // Check for stealth issues
      if (verification.stealthStatus.navigator.webdriver !== undefined) {
        summary.stealthIssues++;
      }
      
      if (verification.stealthStatus.document.automationIndicators) {
        summary.automationDetected++;
      }
      
      // Track unique pages
      summary.uniquePages.add(verification.pageInfo.url);
      
      // Calculate time between screenshots
      if (i > 0) {
        const prevTime = new Date(this.verificationHistory[i-1].timestamp);
        const currTime = new Date(verification.timestamp);
        summary.averageTimeBetweenScreenshots += 
          (currTime - prevTime) / 1000; // Convert to seconds
      }
    }
    
    // Finalize calculations
    if (this.verificationHistory.length > 1) {
      summary.averageTimeBetweenScreenshots /= (this.verificationHistory.length - 1);
    }
    
    summary.uniquePages = summary.uniquePages.size;
    
    return summary;
  }
}

module.exports = { VisualVerification };
```

### GLM-4.5V Integration

**Location**: [`cdp-stealth/src/debug/ai-verification.js`](../cdp-stealth/src/debug/ai-verification.js)

```javascript
const axios = require('axios');

class AIVerification {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.openai.com/v1';
    this.model = 'gpt-4-vision-preview';
  }
  
  async analyzeScreenshot(imagePath, context = '') {
    try {
      // Convert image to base64
      const imageBase64 = await this.imageToBase64(imagePath);
      
      const response = await axios.post(`${this.baseUrl}/chat/completions`, {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing browser screenshots for automation detection. Look for signs of browser automation, CAPTCHAs, security warnings, or unusual UI elements.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this screenshot for browser automation detection indicators. ${context}`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.1
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      const analysis = response.data.choices[0].message.content;
      
      // Parse analysis for structured data
      const structuredAnalysis = this.parseAIAnalysis(analysis);
      
      return {
        success: true,
        analysis: structuredAnalysis,
        rawResponse: analysis
      };
      
    } catch (error) {
      console.error('AI verification failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  async imageToBase64(imagePath) {
    const fs = require('fs').promises;
    const imageBuffer = await fs.readFile(imagePath);
    return imageBuffer.toString('base64');
  }
  
  parseAIAnalysis(analysis) {
    // Extract structured information from AI response
    const indicators = {
      automationDetected: false,
      securityWarnings: [],
      captchaPresent: false,
      unusualElements: [],
      confidence: 0
    };
    
    // Look for key phrases
    if (analysis.toLowerCase().includes('automation detected')) {
      indicators.automationDetected = true;
    }
    
    if (analysis.toLowerCase().includes('captcha')) {
      indicators.captchaPresent = true;
    }
    
    // Extract security warnings
    const warningMatches = analysis.match(/security warning[:\s]*([^\n]+)/gi);
    if (warningMatches) {
      indicators.securityWarnings = warningMatches.map(match => 
        match.replace(/security warning[:\s]*/i, '').trim()
      );
    }
    
    // Extract confidence
    const confidenceMatch = analysis.match(/confidence[:\s]*(\d+%)/i);
    if (confidenceMatch) {
      indicators.confidence = parseInt(confidenceMatch[1]);
    }
    
    return indicators;
  }
  
  async generateVerificationReport(screenshots) {
    const report = {
      timestamp: new Date().toISOString(),
      screenshots: [],
      summary: {
        totalScreenshots: screenshots.length,
        automationDetections: 0,
        securityWarnings: 0,
        captchaDetections: 0,
        averageConfidence: 0
      }
    };
    
    for (const screenshot of screenshots) {
      const analysis = await this.analyzeScreenshot(
        screenshot.path,
        `Screenshot from ${screenshot.timestamp}`
      );
      
      if (analysis.success) {
        const screenshotData = {
          ...screenshot,
          aiAnalysis: analysis.analysis
        };
        
        report.screenshots.push(screenshotData);
        
        // Update summary
        if (analysis.analysis.automationDetected) {
          report.summary.automationDetections++;
        }
        
        report.summary.securityWarnings += analysis.analysis.securityWarnings.length;
        
        if (analysis.analysis.captchaPresent) {
          report.summary.captchaDetections++;
        }
        
        report.summary.averageConfidence += analysis.analysis.confidence;
      }
    }
    
    // Calculate average confidence
    if (report.screenshots.length > 0) {
      report.summary.averageConfidence /= report.screenshots.length;
    }
    
    return report;
  }
}

module.exports = { AIVerification };
```

## Performance Monitoring

### Resource Usage Tracker

**Location**: [`cdp-stealth/src/debug/performance-monitor.js`](../cdp-stealth/src/debug/performance-monitor.js)

```javascript
const os = require('os');
const process = require('process');

class PerformanceMonitor {
  constructor() {
    this.metrics = [];
    this.startTime = Date.now();
    this.monitoringInterval = null;
  }
  
  startMonitoring(intervalMs = 5000) {
    console.log('🔍 Starting performance monitoring');
    
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);
  }
  
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('⏹ Performance monitoring stopped');
    }
  }
  
  collectMetrics() {
    const timestamp = Date.now();
    
    const metrics = {
      timestamp,
      system: {
        cpuUsage: os.cpus().map(cpu => ({
          model: cpu.model,
          speed: cpu.speed,
          usage: {
            user: cpu.times.user,
            nice: cpu.times.nice,
            sys: cpu.times.sys,
            idle: cpu.times.idle,
            irq: cpu.times.irq
          }
        })),
        memoryUsage: {
          total: os.totalmem(),
          free: os.freemem(),
          used: os.totalmem() - os.freemem(),
          usagePercent: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100
        },
        loadAverage: os.loadavg(),
        uptime: os.uptime()
      },
      process: {
        pid: process.pid,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        uptime: process.uptime()
      }
    };
    
    this.metrics.push(metrics);
    
    // Log warnings for high usage
    if (metrics.system.memoryUsage.usagePercent > 90) {
      console.warn(`⚠️ High memory usage: ${metrics.system.memoryUsage.usagePercent.toFixed(1)}%`);
    }
    
    if (metrics.process.memoryUsage.heapUsed > 1024 * 1024 * 1024) { // 1GB
      console.warn(`⚠️ High heap usage: ${(metrics.process.memoryUsage.heapUsed / 1024 / 1024).toFixed(1)}MB`);
    }
  }
  
  getMetricsSummary(timeRangeMs = 60000) { // Default 1 minute
    const cutoff = Date.now() - timeRangeMs;
    const recentMetrics = this.metrics.filter(m => m.timestamp >= cutoff);
    
    if (recentMetrics.length === 0) {
      return null;
    }
    
    // Calculate averages
    const avgMemoryUsage = recentMetrics.reduce((sum, m) => 
      sum + m.system.memoryUsage.usagePercent, 0) / recentMetrics.length;
    
    const avgHeapUsed = recentMetrics.reduce((sum, m) => 
      sum + m.process.memoryUsage.heapUsed, 0) / recentMetrics.length;
    
    const maxMemoryUsage = Math.max(...recentMetrics.map(m => 
      m.system.memoryUsage.usagePercent));
    
    const maxHeapUsed = Math.max(...recentMetrics.map(m => 
      m.process.memoryUsage.heapUsed));
    
    return {
      timeRange: timeRangeMs,
      sampleCount: recentMetrics.length,
      memory: {
        average: avgMemoryUsage,
        maximum: maxMemoryUsage,
        trend: this.calculateTrend(recentMetrics.map(m => m.system.memoryUsage.usagePercent))
      },
      heap: {
        average: avgHeapUsed,
        maximum: maxHeapUsed,
        trend: this.calculateTrend(recentMetrics.map(m => m.process.memoryUsage.heapUsed))
      },
      timestamps: {
        start: new Date(recentMetrics[0].timestamp),
        end: new Date(recentMetrics[recentMetrics.length - 1].timestamp)
      }
    };
  }
  
  calculateTrend(values) {
    if (values.length < 2) return 'stable';
    
    const first = values[0];
    const last = values[values.length - 1];
    const change = ((last - first) / first) * 100;
    
    if (change > 10) return 'increasing';
    if (change < -10) return 'decreasing';
    return 'stable';
  }
  
  async saveMetricsReport() {
    const report = {
      timestamp: new Date().toISOString(),
      totalDuration: Date.now() - this.startTime,
      metrics: this.metrics,
      summary: this.getMetricsSummary(this.metrics.length > 0 ? 
        Date.now() - this.metrics[0].timestamp : 0)
    };
    
    const fs = require('fs').promises;
    const path = require('path');
    
    const reportPath = path.join(process.cwd(), 'debug', 'performance-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📊 Performance report saved: ${reportPath}`);
    return report;
  }
}

module.exports = { PerformanceMonitor };
```

## Debug Utilities

### Interactive Debug Console

**Location**: [`cdp-stealth/src/debug/debug-console.js`](../cdp-stealth/src/debug/debug-console.js)

```javascript
const readline = require('readline');
const { launchStealthBrowser } = require('../index.js');

class DebugConsole {
  constructor() {
    this.browser = null;
    this.page = null;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    this.commands = {
      'help': this.showHelp.bind(this),
      'launch': this.launchBrowser.bind(this),
      'navigate': this.navigate.bind(this),
      'screenshot': this.takeScreenshot.bind(this),
      'stealth': this.checkStealth.bind(this),
      'evaluate': this.evaluate.bind(this),
      'cookies': this.showCookies.bind(this),
      'storage': this.showStorage.bind(this),
      'network': this.showNetwork.bind(this),
      'exit': this.exit.bind(this)
    };
  }
  
  async start() {
    console.log('🔧 CDP Debug Console');
    console.log('Type "help" for available commands\n');
    
    this.rl.setPrompt('cdp-debug> ');
    
    this.rl.on('line', async (input) => {
      await this.handleCommand(input.trim());
    });
    
    this.rl.on('close', () => {
      this.exit();
    });
  }
  
  async handleCommand(input) {
    if (!input) return;
    
    const [command, ...args] = input.split(' ');
    
    if (this.commands[command]) {
      await this.commands[command](args);
    } else {
      console.log(`Unknown command: ${command}. Type "help" for available commands.`);
    }
  }
  
  showHelp() {
    console.log('\nAvailable commands:');
    console.log('  help                    - Show this help message');
    console.log('  launch                  - Launch stealth browser');
    console.log('  navigate <url>          - Navigate to URL');
    console.log('  screenshot [filename]     - Take screenshot');
    console.log('  stealth                  - Check stealth status');
    console.log('  evaluate <javascript>     - Execute JavaScript');
    console.log('  cookies                 - Show all cookies');
    console.log('  storage                 - Show localStorage/sessionStorage');
    console.log('  network                  - Show network activity');
    console.log('  exit                    - Exit debug console');
  }
  
  async launchBrowser() {
    if (this.browser) {
      console.log('Browser already launched');
      return;
    }
    
    try {
      console.log('Launching stealth browser...');
      this.browser = await launchStealthBrowser();
      this.page = await this.browser.newPage();
      console.log('✅ Browser launched successfully');
    } catch (error) {
      console.error('❌ Failed to launch browser:', error.message);
    }
  }
  
  async navigate(args) {
    if (!this.page) {
      console.log('Please launch browser first');
      return;
    }
    
    const url = args[0];
    if (!url) {
      console.log('Please provide a URL');
      return;
    }
    
    try {
      console.log(`Navigating to: ${url}`);
      await this.page.goto(url, { waitUntil: 'networkidle2' });
      console.log('✅ Navigation completed');
    } catch (error) {
      console.error('❌ Navigation failed:', error.message);
    }
  }
  
  async takeScreenshot(args) {
    if (!this.page) {
      console.log('Please launch browser first');
      return;
    }
    
    const filename = args[0] || `screenshot-${Date.now()}.png`;
    
    try {
      await this.page.screenshot({ path: filename, fullPage: true });
      console.log(`✅ Screenshot saved: ${filename}`);
    } catch (error) {
      console.error('❌ Screenshot failed:', error.message);
    }
  }
  
  async checkStealth() {
    if (!this.page) {
      console.log('Please launch browser first');
      return;
    }
    
    try {
      const status = await this.page.evaluate(() => ({
        navigator: {
          webdriver: navigator.webdriver,
          plugins: navigator.plugins.length,
          languages: navigator.languages
        },
        chrome: {
          runtime: typeof chrome !== 'undefined' ? {
            id: chrome.runtime?.id
          } : null
        },
        window: {
          webdriver: typeof window.webdriver !== 'undefined'
        }
      }));
      
      console.log('\n🔍 Stealth Status:');
      console.log(`  navigator.webdriver: ${status.navigator.webdriver}`);
      console.log(`  chrome.runtime.id: ${status.chrome.runtime?.id}`);
      console.log(`  window.webdriver: ${status.window.webdriver}`);
      
      const isStealthy = 
        status.navigator.webdriver === undefined &&
        (status.chrome.runtime?.id === undefined || status.chrome.runtime?.id === null) &&
        !status.window.webdriver;
      
      console.log(`  Overall: ${isStealthy ? '✅ STEALTHY' : '❌ DETECTABLE'}`);
      
    } catch (error) {
      console.error('❌ Stealth check failed:', error.message);
    }
  }
  
  async evaluate(args) {
    if (!this.page) {
      console.log('Please launch browser first');
      return;
    }
    
    const script = args.join(' ');
    if (!script) {
      console.log('Please provide JavaScript code');
      return;
    }
    
    try {
      const result = await this.page.evaluate(script);
      console.log('Result:', result);
    } catch (error) {
      console.error('❌ Evaluation failed:', error.message);
    }
  }
  
  async showCookies() {
    if (!this.page) {
      console.log('Please launch browser first');
      return;
    }
    
    try {
      const cookies = await this.page.cookies();
      console.log('\n🍪 Cookies:');
      cookies.forEach(cookie => {
        console.log(`  ${cookie.name}: ${cookie.value}`);
      });
      console.log(`Total: ${cookies.length} cookies`);
    } catch (error) {
      console.error('❌ Failed to get cookies:', error.message);
    }
  }
  
  async showStorage() {
    if (!this.page) {
      console.log('Please launch browser first');
      return;
    }
    
    try {
      const storage = await this.page.evaluate(() => ({
        localStorage: { ...localStorage },
        sessionStorage: { ...sessionStorage }
      }));
      
      console.log('\n💾 Local Storage:');
      Object.entries(storage.localStorage).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
      
      console.log('\n💾 Session Storage:');
      Object.entries(storage.sessionStorage).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
      
      console.log(`\nLocalStorage: ${Object.keys(storage.localStorage).length} items`);
      console.log(`SessionStorage: ${Object.keys(storage.sessionStorage).length} items`);
      
    } catch (error) {
      console.error('❌ Failed to get storage:', error.message);
    }
  }
  
  async exit() {
    console.log('\n👋 Exiting debug console...');
    
    if (this.browser) {
      await this.browser.close();
      console.log('✅ Browser closed');
    }
    
    this.rl.close();
    process.exit(0);
  }
}

// Start debug console if called directly
if (require.main === module) {
  const debugConsole = new DebugConsole();
  debugConsole.start().catch(error => {
    console.error('Debug console failed:', error);
    process.exit(1);
  });
}

module.exports = { DebugConsole };
```

## Debug Mode Configuration

### Environment Variables

```bash
# Enable debug logging
export DEBUG=cdp-stealth:*
export NODE_ENV=development

# Enable performance monitoring
export PERFORMANCE_MONITORING=true
export PERFORMANCE_INTERVAL=5000

# Enable visual verification
export VISUAL_VERIFICATION=true
export AI_VERIFICATION=true
export OPENAI_API_KEY=your_openai_api_key

# Enable debug console
export DEBUG_CONSOLE=true

# Save additional debug files
export TEST_DEBUG=true
export SAVE_DEBUG_SCREENSHOTS=true
```

### Debug Configuration File

**Location**: [`debug/config.json`](../debug/config.json)

```json
{
  "logging": {
    "level": "debug",
    "saveToFile": true,
    "consoleOutput": true,
    "maxFileSize": "10MB",
    "maxFiles": 5
  },
  "performance": {
    "enabled": true,
    "interval": 5000,
    "saveMetrics": true,
    "alertThresholds": {
      "memoryUsage": 90,
      "cpuUsage": 80,
      "heapSize": "1GB"
    }
  },
  "visual": {
    "enabled": true,
    "autoScreenshots": true,
    "screenshotInterval": 30000,
    "aiAnalysis": true,
    "saveRawImages": true
  },
  "debug": {
    "interactiveConsole": true,
    "autoLaunch": false,
    "keepOpen": true,
    "verboseErrors": true
  }
}
```

## Troubleshooting Guide

### Common Debugging Scenarios

#### 1. Stealth Detection Issues

```bash
# Enable comprehensive stealth debugging
export DEBUG=cdp-stealth:stealth
export VISUAL_VERIFICATION=true

# Run stealth verification
node cdp-stealth/src/test/verify-stealth-flags.js

# Check screenshots for detection indicators
ls -la debug/screenshots/
```

#### 2. Performance Issues

```bash
# Enable performance monitoring
export PERFORMANCE_MONITORING=true
export PERFORMANCE_INTERVAL=1000

# Run with performance tracking
node your-automation-script.js

# Analyze performance data
node cdp-stealth/src/debug/performance-monitor.js analyze
```

#### 3. Network Issues

```bash
# Enable network debugging
export DEBUG=cdp-stealth:network
export NETWORK_DEBUG=true

# Run with network capture
mitmdump -s .mitmproxy/record_addon.py -v

# Check network logs
tail -f debug/network.log
```

#### 4. Extension Issues

```bash
# Enable extension debugging
export DEBUG=cdp-stealth:extension

# Load extension in debug mode
chrome --load-extension=./extensions/cdp-stealth --debug-extension

# Check extension console
chrome://extensions/ -> Find extension -> Inspect views
```

### Debug Output Analysis

#### Log Analysis Script

```javascript
// debug/analyze-logs.js
const fs = require('fs').promises;
const path = require('path');

class LogAnalyzer {
  async analyzeLogFile(logPath) {
    const content = await fs.readFile(logPath, 'utf8');
    const lines = content.split('\n');
    
    const analysis = {
      totalLines: lines.length,
      errors: [],
      warnings: [],
      debugMessages: [],
      timeRange: { start: null, end: null },
      components: {}
    };
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      try {
        const logEntry = JSON.parse(line);
        
        // Track time range
        const timestamp = new Date(logEntry.timestamp);
        if (!analysis.timeRange.start || timestamp < analysis.timeRange.start) {
          analysis.timeRange.start = timestamp;
        }
        if (!analysis.timeRange.end || timestamp > analysis.timeRange.end) {
          analysis.timeRange.end = timestamp;
        }
        
        // Categorize by level
        if (logEntry.level === 'error') {
          analysis.errors.push(logEntry);
        } else if (logEntry.level === 'warn') {
          analysis.warnings.push(logEntry);
        } else if (logEntry.level === 'debug') {
          analysis.debugMessages.push(logEntry);
        }
        
        // Track by component
        const component = logEntry.service || 'unknown';
        if (!analysis.components[component]) {
          analysis.components[component] = { count: 0, errors: 0 };
        }
        analysis.components[component].count++;
        if (logEntry.level === 'error') {
          analysis.components[component].errors++;
        }
        
      } catch (e) {
        // Skip malformed log lines
      }
    }
    
    return analysis;
  }
  
  async generateReport(analysis) {
    console.log('\n📊 Log Analysis Report');
    console.log('='.repeat(50));
    console.log(`Total lines: ${analysis.totalLines}`);
    console.log(`Errors: ${analysis.errors.length}`);
    console.log(`Warnings: ${analysis.warnings.length}`);
    console.log(`Debug messages: ${analysis.debugMessages.length}`);
    
    if (analysis.timeRange.start && analysis.timeRange.end) {
      console.log(`Time range: ${analysis.timeRange.start.toISOString()} to ${analysis.timeRange.end.toISOString()}`);
    }
    
    console.log('\nComponent breakdown:');
    for (const [component, data] of Object.entries(analysis.components)) {
      const errorRate = ((data.errors / data.count) * 100).toFixed(1);
      console.log(`  ${component}: ${data.count} logs, ${data.errors} errors (${errorRate}%)`);
    }
    
    // Show recent errors
    if (analysis.errors.length > 0) {
      console.log('\nRecent errors:');
      analysis.errors.slice(-5).forEach(error => {
        console.log(`  ${error.timestamp}: ${error.message}`);
      });
    }
  }
}

// Run analysis if called directly
if (require.main === module) {
  const analyzer = new LogAnalyzer();
  const logPath = process.argv[2] || './debug/combined.log';
  
  analyzer.analyzeLogFile(logPath)
    .then(analysis => analyzer.generateReport(analysis))
    .catch(error => console.error('Analysis failed:', error));
}

module.exports = { LogAnalyzer };
```

## References

- [Winston Logging](https://github.com/winstonjs/winston)
- [Chrome DevTools Protocol Debugging](https://chromedevtools.github.io/devtools-protocol/)
- [Node.js Debugging](https://nodejs.org/en/docs/guides/debugging)
- [Puppeteer Debugging](https://pptr.dev/debugging/)
- [OpenAI Vision API](https://platform.openai.com/docs/guides/vision)