# Testing Documentation

This document covers the comprehensive test suite for the CDP automation system, including unit tests, integration tests, and end-to-end validation.

## Overview

The testing framework ensures system reliability and validates:

- **Stealth Configuration** - Verify anti-detection mechanisms
- **Browser Automation** - Test CDP functionality
- **Extension Integration** - Validate extension behavior
- **Network Recording** - Test mitmproxy integration
- **API Reverse-Engineering** - Validate Integuru integration
- **MCP Server** - Test tool functionality

## Test Structure

```
cdp-stealth/src/test/
├── verify-stealth-flags.js      # Stealth flag verification
├── verify-runtime-patching.js    # Runtime patching validation
├── verify-extension.js           # Extension functionality test
├── test-logger.js              # Winston logger configuration
├── gmail-login-test.js          # Gmail automation test
└── analyze-results.js           # Test result analysis

mcp-server/test/
├── tools/                       # MCP tool tests
├── lib/                         # Library tests
└── integration/                  # Integration tests

Integuru/tests/
├── test_integration_agent.py     # Integuru integration tests
└── sample-hars/                # Test HAR files
```

## Core Test Suite

### 1. Stealth Flag Verification

**Location**: [`cdp-stealth/src/test/verify-stealth-flags.js`](../cdp-stealth/src/test/verify-stealth-flags.js)

Validates that all stealth flags are properly applied and detection vectors are bypassed.

```javascript
const { launchStealthBrowser, verifyStealth } = require('../index.js');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

async function verifyStealthFlags() {
  logger.info('Starting stealth flag verification');
  
  const results = {
    timestamp: new Date().toISOString(),
    checks: {},
    passed: false,
    errors: []
  };
  
  try {
    // Launch stealth browser
    const browser = await launchStealthBrowser();
    const page = await browser.newPage();
    
    // Navigate to detection test page
    await page.goto('https://bot.sannysoft.com/');
    
    // Run stealth checks
    const checks = {
      'navigator.webdriver': async () => {
        const result = await page.evaluate(() => navigator.webdriver);
        return result === undefined;
      },
      
      'automation switches': async () => {
        const result = await page.evaluate(() => {
          return window.chrome?.runtime?.id !== undefined;
        });
        return !result;
      },
      
      'permissions API': async () => {
        const result = await page.evaluate(async () => {
          try {
            const permission = await navigator.permissions.query({ name: 'notifications' });
            return permission.state === 'granted';
          } catch (e) {
            return false;
          }
        });
        return result;
      },
      
      'WebGL fingerprint': async () => {
        const result = await page.evaluate(() => {
          const canvas = document.createElement('canvas');
          const gl = canvas.getContext('webgl');
          if (!gl) return false;
          
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          return debugInfo !== null;
        });
        return result;
      }
    };
    
    // Execute checks
    for (const [name, checkFn] of Object.entries(checks)) {
      try {
        const passed = await checkFn();
        results.checks[name] = {
          passed,
          result: passed ? 'PASS' : 'FAIL'
        };
        
        logger.info(`${passed ? '✅' : '❌'} ${name}`);
      } catch (error) {
        results.checks[name] = {
          passed: false,
          result: 'ERROR',
          error: error.message
        };
        results.errors.push(`${name}: ${error.message}`);
        logger.error(`❌ ${name}: ${error.message}`);
      }
    }
    
    // Overall result
    results.passed = Object.values(results.checks).every(check => check.passed);
    
    // Take verification screenshot
    const screenshotPath = `./debug/stealth-verification-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    results.screenshot = screenshotPath;
    
    await browser.close();
    
    // Save results
    const resultsPath = `./debug/stealth-verification-${Date.now()}.json`;
    require('fs').writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    
    logger.info(`Stealth verification ${results.passed ? 'PASSED' : 'FAILED'}`);
    logger.info(`Results saved to: ${resultsPath}`);
    
    return results;
    
  } catch (error) {
    logger.error('Stealth verification failed:', error);
    results.errors.push(`Verification failed: ${error.message}`);
    return results;
  }
}

// Run verification if called directly
if (require.main === module) {
  verifyStealthFlags()
    .then(results => {
      console.log('\n═'.repeat(30));
      console.log('STEALTH VERIFICATION RESULTS');
      console.log('═'.repeat(30));
      console.log(`Overall: ${results.passed ? '✅ PASS' : '❌ FAIL'}`);
      
      for (const [name, check] of Object.entries(results.checks)) {
        console.log(`${check.passed ? '✅' : '❌'} ${name}: ${check.result}`);
      }
      
      if (results.errors.length > 0) {
        console.log('\nErrors:');
        results.errors.forEach(error => console.log(`  - ${error}`));
      }
      
      process.exit(results.passed ? 0 : 1);
    })
    .catch(error => {
      console.error('Verification failed:', error);
      process.exit(1);
    });
}

module.exports = { verifyStealthFlags };
```

### 2. Runtime Patching Verification

**Location**: [`cdp-stealth/src/test/verify-runtime-patching.js`](../cdp-stealth/src/test/verify-runtime-patching.js)

Tests that Runtime.enable patching is working correctly.

```javascript
const puppeteer = require('rebrowser-puppeteer');
const path = require('path');

async function verifyRuntimePatching() {
  console.log('Verifying Runtime.enable patching...');
  
  const results = {
    timestamp: new Date().toISOString(),
    patchingMode: process.env.REBROWSER_PATCHES_RUNTIME_FIX_MODE,
    tests: {},
    passed: false
  };
  
  try {
    // Test with different patching modes
    const modes = ['addBinding', 'alwaysIsolated', 'enableDisable'];
    
    for (const mode of modes) {
      process.env.REBROWSER_PATCHES_RUNTIME_FIX_MODE = mode;
      
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      
      // Test Runtime.enable detection
      const detectionResult = await page.evaluate(() => {
        // Try to detect if Runtime.enable was called
        let runtimeDetected = false;
        
        // Hook Object.defineProperty to detect Runtime.enable
        const originalDefineProperty = Object.defineProperty;
        Object.defineProperty = function(obj, prop, descriptor) {
          if (prop === 'webdriver' && obj === navigator) {
            runtimeDetected = true;
          }
          return originalDefineProperty.call(this, obj, prop, descriptor);
        };
        
        return runtimeDetected;
      });
      
      results.tests[mode] = {
        detected: detectionResult,
        passed: !detectionResult
      };
      
      await browser.close();
    }
    
    results.passed = Object.values(results.tests).every(test => test.passed);
    
    // Save results
    const resultsPath = `./debug/runtime-patching-test-${Date.now()}.json`;
    require('fs').writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    
    console.log(`Runtime patching verification ${results.passed ? 'PASSED' : 'FAILED'}`);
    
    return results;
    
  } catch (error) {
    console.error('Runtime patching verification failed:', error);
    return { ...results, passed: false, error: error.message };
  }
}

if (require.main === module) {
  verifyRuntimePatching()
    .then(results => {
      console.log('\n═'.repeat(30));
      console.log('RUNTIME PATCHING RESULTS');
      console.log('═'.repeat(30));
      console.log(`Patching mode: ${results.patchingMode}`);
      console.log(`Overall: ${results.passed ? '✅ PASS' : '❌ FAIL'}`);
      
      for (const [mode, test] of Object.entries(results.tests)) {
        console.log(`${test.passed ? '✅' : '❌'} ${mode}: ${test.detected ? 'DETECTED' : 'NOT DETECTED'}`);
      }
      
      process.exit(results.passed ? 0 : 1);
    });
}

module.exports = { verifyRuntimePatching };
```

### 3. Gmail Login Test

**Location**: [`cdp-stealth/src/test/gmail-login-test.js`](../cdp-stealth/src/test/gmail-login-test.js)

End-to-end test of Gmail login automation with comprehensive validation.

```javascript
const { launchStealthBrowser } = require('../index.js');
const winston = require('winston');

class GmailLoginTest {
  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'debug/gmail-test.log' }),
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });
    
    this.browser = null;
    this.page = null;
    this.testResults = {
      timestamp: new Date().toISOString(),
      success: false,
      duration: 0,
      errors: [],
      detectionAttempts: 0,
      criteria: {
        loginCompleted: false,
        noDetection: false,
        noErrors: false,
        fastExecution: false
      }
    };
  }
  
  async run(email, password) {
    const startTime = Date.now();
    
    try {
      this.logger.info('Starting Gmail login test');
      
      // Step 1: Launch browser
      await this.launchBrowser();
      
      // Step 2: Navigate to Gmail
      await this.navigateToGmail();
      
      // Step 3: Fill email
      await this.fillEmail(email);
      
      // Step 4: Click Next
      await this.clickNext();
      
      // Step 5: Fill password
      await this.fillPassword(password);
      
      // Step 6: Click Sign In
      await this.signIn();
      
      // Step 7: Verify success
      await this.verifySuccess();
      
      // Step 8: Check for detection
      await this.checkForDetection();
      
      // Calculate results
      this.testResults.duration = (Date.now() - startTime) / 1000;
      this.testResults.success = this.evaluateSuccess();
      
      this.logger.info(`Gmail login test ${this.testResults.success ? 'PASSED' : 'FAILED'}`);
      
      return this.testResults;
      
    } catch (error) {
      this.testResults.errors.push(error.message);
      this.logger.error('Gmail login test failed:', error);
      return this.testResults;
      
    } finally {
      await this.cleanup();
    }
  }
  
  async launchBrowser() {
    this.logger.info('Launching stealth browser');
    
    this.browser = await launchStealthBrowser({
      headless: false,
      args: ['--window-size=1366,768']
    });
    
    this.page = await this.browser.newPage();
    
    // Set up error handling
    this.page.on('error', (error) => {
      this.testResults.errors.push(`Page error: ${error.message}`);
    });
    
    this.page.on('pageerror', (error) => {
      this.testResults.errors.push(`JavaScript error: ${error.message}`);
    });
  }
  
  async navigateToGmail() {
    this.logger.info('Navigating to Gmail login');
    
    await this.page.goto('https://accounts.google.com/ServiceLogin', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Wait for email field
    await this.page.waitForSelector('input[type="email"]', {
      timeout: 10000
    });
  }
  
  async fillEmail(email) {
    this.logger.info('Filling email field');
    
    await this.page.stealth.humanType('input[type="email"]', email, {
      delay: 50 + Math.random() * 50
    });
    
    // Wait a moment to simulate human behavior
    await this.page.stealth.waitHumanTime(500, 1000);
  }
  
  async clickNext() {
    this.logger.info('Clicking Next button');
    
    await this.page.stealth.humanClick('#identifierNext');
    
    // Wait for password field
    await this.page.waitForSelector('input[type="password"]', {
      timeout: 10000
    });
  }
  
  async fillPassword(password) {
    this.logger.info('Filling password field');
    
    await this.page.stealth.humanType('input[type="password"]', password, {
      delay: 50 + Math.random() * 50
    });
    
    await this.page.stealth.waitHumanTime(500, 1000);
  }
  
  async signIn() {
    this.logger.info('Clicking Sign In button');
    
    await this.page.stealth.humanClick('#passwordNext');
    
    // Wait for navigation
    await this.page.waitForNavigation({
      waitUntil: 'networkidle2',
      timeout: 30000
    });
  }
  
  async verifySuccess() {
    this.logger.info('Verifying login success');
    
    const finalUrl = this.page.url();
    
    if (finalUrl.includes('mail.google.com')) {
      this.testResults.criteria.loginCompleted = true;
      this.logger.info('✅ Login completed successfully');
    } else if (finalUrl.includes('unsafe')) {
      this.testResults.detectionAttempts++;
      this.testResults.criteria.noDetection = false;
      this.logger.warn('❌ Detection: Unsafe browser warning');
    } else {
      this.logger.warn(`Unexpected final URL: ${finalUrl}`);
    }
  }
  
  async checkForDetection() {
    this.logger.info('Checking for detection indicators');
    
    // Check for common detection indicators
    const detectionChecks = await this.page.evaluate(() => {
      const checks = {
        unsafeBrowser: document.body.textContent.includes('unsafe browser'),
        automationDetected: document.body.textContent.includes('automation'),
        suspiciousActivity: document.body.textContent.includes('suspicious activity'),
        captchaPresent: document.querySelector('.captcha') !== null,
        verificationRequired: document.querySelector('#challenge') !== null
      };
      
      return checks;
    });
    
    for (const [indicator, present] of Object.entries(detectionChecks)) {
      if (present) {
        this.testResults.detectionAttempts++;
        this.logger.warn(`❌ Detection indicator: ${indicator}`);
      }
    }
    
    if (this.testResults.detectionAttempts === 0) {
      this.testResults.criteria.noDetection = true;
      this.logger.info('✅ No detection indicators found');
    }
  }
  
  evaluateSuccess() {
    const { criteria } = this.testResults;
    
    // Check each criterion
    criteria.noErrors = this.testResults.errors.length === 0;
    criteria.fastExecution = this.testResults.duration < 30;
    
    // Overall success requires all criteria
    return Object.values(criteria).every(value => value === true);
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

// Test execution
if (require.main === module) {
  const test = new GmailLoginTest();
  
  // Test credentials (replace with actual test credentials)
  const email = process.env.GMAIL_EMAIL || 'test@example.com';
  const password = process.env.GMAIL_PASSWORD || 'testpassword';
  
  test.run(email, password)
    .then(results => {
      console.log('\n' + '='.repeat(60));
      console.log('GMAIL LOGIN TEST RESULTS');
      console.log('='.repeat(60));
      console.log(`✅ SUCCESS: ${results.success}`);
      console.log(`  Duration: ${results.duration.toFixed(2)} seconds`);
      console.log(`  Errors: ${results.errors.length}`);
      console.log(`  Detection Attempts: ${results.detectionAttempts}`);
      console.log(`  Report saved: ./debug/gmail-login-test-report.json`);
      console.log('\nSUCCESS CRITERIA');
      console.log('-'.repeat(30));
      
      for (const [criterion, passed] of Object.entries(results.criteria)) {
        console.log(`${passed ? '✅' : '❌'} ${criterion.replace(/([A-Z])/g, ' $1').trim()}`);
      }
      
      const passedCount = Object.values(results.criteria).filter(Boolean).length;
      console.log(`\nFINAL SCORE: ${passedCount}/4 criteria met`);
      
      if (passedCount === 4) {
        console.log('  SYSTEM FULLY OPERATIONAL - READY FOR PRODUCTION');
      } else {
        console.log('  SYSTEM NEEDS ATTENTION - CHECK FAILURES');
      }
      
      // Save detailed report
      require('fs').writeFileSync(
        './debug/gmail-login-test-report.json',
        JSON.stringify(results, null, 2)
      );
      
      process.exit(results.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { GmailLoginTest };
```

### 4. Results Analysis

**Location**: [`cdp-stealth/src/test/analyze-results.js`](../cdp-stealth/src/test/analyze-results.js)

Analyzes test results and generates comprehensive reports.

```javascript
const fs = require('fs').promises;
const path = require('path');

class TestAnalyzer {
  constructor() {
    this.resultsDir = './debug';
    this.reportPath = './debug/test-analysis-report.json';
  }
  
  async analyzeAll() {
    console.log('Analyzing all test results...');
    
    const analysis = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        averageDuration: 0,
        detectionRate: 0
      },
      categories: {
        stealth: {},
        runtime: {},
        gmail: {},
        extension: {}
      },
      trends: [],
      recommendations: []
    };
    
    try {
      // Get all test result files
      const files = await fs.readdir(this.resultsDir);
      const testFiles = files.filter(file => 
        file.includes('verification') || 
        file.includes('test-') || 
        file.includes('gmail-')
      );
      
      analysis.summary.totalTests = testFiles.length;
      
      // Analyze each file
      for (const file of testFiles) {
        const filePath = path.join(this.resultsDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const result = JSON.parse(content);
        
        this.analyzeResult(result, analysis);
      }
      
      // Calculate summary statistics
      this.calculateSummary(analysis);
      
      // Generate recommendations
      this.generateRecommendations(analysis);
      
      // Save analysis
      await fs.writeFile(this.reportPath, JSON.stringify(analysis, null, 2));
      
      // Print summary
      this.printSummary(analysis);
      
      return analysis;
      
    } catch (error) {
      console.error('Analysis failed:', error);
      throw error;
    }
  }
  
  analyzeResult(result, analysis) {
    // Categorize result
    let category = 'unknown';
    if (result.checks && result.checks['navigator.webdriver']) {
      category = 'stealth';
    } else if (result.tests || result.patchingMode) {
      category = 'runtime';
    } else if (result.criteria && result.criteria.loginCompleted !== undefined) {
      category = 'gmail';
    } else if (result.extension) {
      category = 'extension';
    }
    
    // Update category
    if (!analysis.categories[category]) {
      analysis.categories[category] = {
        total: 0,
        passed: 0,
        failed: 0,
        avgDuration: 0
      };
    }
    
    const categoryData = analysis.categories[category];
    categoryData.total++;
    
    if (result.passed || result.success) {
      categoryData.passed++;
      analysis.summary.passedTests++;
    } else {
      categoryData.failed++;
      analysis.summary.failedTests++;
    }
    
    // Update duration
    if (result.duration) {
      categoryData.avgDuration = 
        (categoryData.avgDuration * (categoryData.total - 1) + result.duration) / 
        categoryData.total;
    }
  }
  
  calculateSummary(analysis) {
    const { summary, categories } = analysis;
    
    // Calculate average duration across all tests
    let totalDuration = 0;
    let durationCount = 0;
    
    for (const category of Object.values(categories)) {
      if (category.avgDuration > 0) {
        totalDuration += category.avgDuration * category.total;
        durationCount += category.total;
      }
    }
    
    summary.averageDuration = durationCount > 0 ? totalDuration / durationCount : 0;
    
    // Calculate detection rate
    const gmailTests = categories.gmail || {};
    if (gmailTests.total > 0) {
      const detectionAttempts = gmailTests.failed || 0;
      summary.detectionRate = (detectionAttempts / gmailTests.total) * 100;
    }
  }
  
  generateRecommendations(analysis) {
    const { summary, categories } = analysis;
    const recommendations = [];
    
    // Stealth recommendations
    if (categories.stealth && categories.stealth.failed > 0) {
      recommendations.push({
        category: 'stealth',
        priority: 'high',
        issue: 'Stealth flags not working correctly',
        solution: 'Review chrome_start.sh and verify all stealth flags are applied'
      });
    }
    
    // Runtime patching recommendations
    if (categories.runtime && categories.runtime.failed > 0) {
      recommendations.push({
        category: 'runtime',
        priority: 'high',
        issue: 'Runtime.enable patching failing',
        solution: 'Check REBROWSER_PATCHES_RUNTIME_FIX_MODE and reinstall rebrowser-patches'
      });
    }
    
    // Gmail test recommendations
    if (categories.gmail) {
      if (categories.gmail.failed > categories.gmail.passed) {
        recommendations.push({
          category: 'gmail',
          priority: 'critical',
          issue: 'Gmail login success rate below 50%',
          solution: 'Review detection indicators and update stealth techniques'
        });
      }
      
      if (summary.detectionRate > 10) {
        recommendations.push({
          category: 'gmail',
          priority: 'high',
          issue: 'Detection rate above 10%',
          solution: 'Implement additional anti-detection measures'
        });
      }
    }
    
    // Performance recommendations
    if (summary.averageDuration > 30) {
      recommendations.push({
        category: 'performance',
        priority: 'medium',
        issue: 'Average test duration above 30 seconds',
        solution: 'Optimize test execution and reduce timeouts'
      });
    }
    
    analysis.recommendations = recommendations;
  }
  
  printSummary(analysis) {
    console.log('\n' + '='.repeat(60));
    console.log('TEST ANALYSIS SUMMARY');
    console.log('='.repeat(60));
    
    const { summary } = analysis;
    console.log(`Total Tests: ${summary.totalTests}`);
    console.log(`Passed: ${summary.passedTests}`);
    console.log(`Failed: ${summary.failedTests}`);
    console.log(`Success Rate: ${((summary.passedTests / summary.totalTests) * 100).toFixed(1)}%`);
    console.log(`Average Duration: ${summary.averageDuration.toFixed(2)}s`);
    console.log(`Detection Rate: ${summary.detectionRate.toFixed(1)}%`);
    
    console.log('\nCATEGORY BREAKDOWN:');
    for (const [category, data] of Object.entries(analysis.categories)) {
      if (data.total > 0) {
        const successRate = (data.passed / data.total * 100).toFixed(1);
        console.log(`  ${category.toUpperCase()}: ${data.passed}/${data.total} (${successRate}%)`);
      }
    }
    
    if (analysis.recommendations.length > 0) {
      console.log('\nRECOMMENDATIONS:');
      analysis.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. [${rec.priority.toUpperCase()}] ${rec.issue}`);
        console.log(`     Solution: ${rec.solution}`);
      });
    }
    
    console.log(`\nDetailed report saved to: ${this.reportPath}`);
  }
}

// Run analysis if called directly
if (require.main === module) {
  const analyzer = new TestAnalyzer();
  analyzer.analyzeAll()
    .then(() => {
      console.log('\nAnalysis completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Analysis failed:', error);
      process.exit(1);
    });
}

module.exports = { TestAnalyzer };
```

## Test Execution

### Running All Tests

```bash
# Navigate to project root
cd cdp-stealth

# Run complete test suite
npm run test:all

# Or run individual tests
npm run test:stealth      # Stealth verification
npm run test:runtime      # Runtime patching
npm run test:gmail        # Gmail automation
npm run test:extension    # Extension functionality
npm run test:analyze      # Results analysis
```

### Test Scripts

Add to [`cdp-stealth/package.json`](../cdp-stealth/package.json):

```json
{
  "scripts": {
    "test:stealth": "node src/test/verify-stealth-flags.js",
    "test:runtime": "node src/test/verify-runtime-patching.js",
    "test:gmail": "node src/test/gmail-login-test.js",
    "test:extension": "node src/test/verify-extension.js",
    "test:analyze": "node src/test/analyze-results.js",
    "test:all": "npm run test:stealth && npm run test:runtime && npm run test:gmail && npm run test:analyze",
    "test:debug": "DEBUG=* npm run test:all"
  }
}
```

### Continuous Integration

**Location**: [`.github/workflows/test.yml`](../.github/workflows/test.yml)

```yaml
name: Test Suite

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Setup Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
        
    - name: Install dependencies
      run: |
        npm install
        pip install mitmproxy
        
    - name: Run stealth tests
      run: |
        npm run test:stealth
        npm run test:runtime
        
    - name: Run Gmail test
      env:
        GMAIL_EMAIL: ${{ secrets.GMAIL_EMAIL }}
        GMAIL_PASSWORD: ${{ secrets.GMAIL_PASSWORD }}
      run: |
        npm run test:gmail
        
    - name: Analyze results
      run: |
        npm run test:analyze
        
    - name: Upload test results
      uses: actions/upload-artifact@v3
      with:
        name: test-results
        path: |
          debug/*.json
          debug/*.log
```

## Test Data Management

### Test Result Storage

Test results are stored in the `debug/` directory:

```
debug/
├── stealth-verification-*.json      # Stealth verification results
├── stealth-verification-*.png       # Verification screenshots
├── runtime-patching-test-*.json      # Runtime patching results
├── gmail-login-test-report.json      # Gmail test detailed report
├── extension-test-*.json           # Extension test results
└── test-analysis-report.json        # Comprehensive analysis
```

### Test Configuration

**Location**: [`cdp-stealth/src/test/test-config.js`](../cdp-stealth/src/test/test-config.js)

```javascript
module.exports = {
  // Test credentials (use environment variables in production)
  gmail: {
    email: process.env.GMAIL_EMAIL || 'test@example.com',
    password: process.env.GMAIL_PASSWORD || 'testpassword'
  },
  
  // Test timeouts
  timeouts: {
    pageLoad: 30000,
    elementWait: 10000,
    navigation: 30000,
    testComplete: 60000
  },
  
  // Test URLs
  urls: {
    gmail: 'https://accounts.google.com/ServiceLogin',
    detectionTest: 'https://bot.sannysoft.com/',
    extensionTest: 'https://example.com'
  },
  
  // Expected results
  expectations: {
    stealthFlags: {
      'navigator.webdriver': undefined,
      'chrome.runtime.id': undefined,
      'window.webdriver': undefined
    },
    gmail: {
      maxDuration: 30,
      maxDetectionAttempts: 0,
      requiredCriteria: ['loginCompleted', 'noDetection', 'noErrors', 'fastExecution']
    }
  }
};
```

## Troubleshooting Tests

### Common Test Failures

#### Stealth Verification Fails

```bash
# Check Chrome version
google-chrome --version

# Verify stealth flags
grep -E "(AutomationControlled|enable-automation)" chrome_start.sh

# Check extension loading
chrome://extensions/ -> Verify CDP extension is enabled
```

#### Runtime Patching Test Fails

```bash
# Check rebrowser-patches installation
npm list rebrowser-puppeteer

# Verify patching mode
echo $REBROWSER_PATCHES_RUNTIME_FIX_MODE

# Reinstall patches
npm install rebrowser-puppeteer@latest
npx rebrowser-patches@latest patch --packageName puppeteer-core
```

#### Gmail Test Fails

```bash
# Check network connectivity
ping mail.google.com

# Verify credentials
echo "Email: $GMAIL_EMAIL"
echo "Password: [REDACTED]"

# Check for 2FA
# Manual login may be required for first time
```

### Debug Mode

Enable comprehensive debugging:

```bash
# Enable debug logging
export DEBUG=cdp-stealth:*
export NODE_ENV=development

# Run with verbose output
npm run test:debug

# Generate additional debug files
export TEST_DEBUG=true
npm run test:all
```

### Test Isolation

Run tests in isolated environment:

```bash
# Create isolated Chrome profile
mkdir -p test-profiles/stealth-test
mkdir -p test-profiles/gmail-test

# Use isolated profile
export CHROME_USER_DATA_DIR=./test-profiles/stealth-test
npm run test:stealth

export CHROME_USER_DATA_DIR=./test-profiles/gmail-test
npm run test:gmail
```

## References

- [Jest Testing Framework](https://jestjs.io/)
- [Puppeteer Testing](https://pptr.dev/)
- [Chrome DevTools Protocol Testing](https://chromedevtools.github.io/devtools-protocol/)
- [Node.js Testing Best Practices](https://nodejs.org/en/docs/guides/testing)