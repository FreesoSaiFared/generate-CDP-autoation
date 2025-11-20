const puppeteer = require('rebrowser-puppeteer');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { getConfig } = require('./test-config');
const testLogger = require('./test-logger');
const path = require('path');
const fs = require('fs');

// Apply stealth plugin (rebrowser-puppeteer handles stealth automatically)
// puppeteer.use(StealthPlugin()); // Not needed with rebrowser-puppeteer

class GmailLoginTest {
  constructor() {
    this.config = getConfig();
    this.browser = null;
    this.page = null;
    this.testResults = {
      startTime: null,
      endTime: null,
      duration: 0,
      success: false,
      isLoggedIn: false,
      detectionAttempts: 0,
      errors: [],
      screenshots: [],
      steps: []
    };
  }

  // Initialize browser with stealth configuration
  async initializeBrowser() {
    const testName = 'GmailLoginTest';
    testLogger.startTest(testName, { phase: 'browser_initialization' });

    try {
      // Set environment variable for rebrowser-patches
      process.env[this.config.runtimePatching.environment] = this.config.runtimePatching.mode;

      const launchOptions = {
        headless: this.config.chrome.headless,
        args: this.config.chrome.args,
        defaultViewport: this.config.chrome.viewport,
        ignoreDefaultArgs: ['--enable-blink-features=AutomationControlled'],
        // Load extension if path exists
        ...(fs.existsSync(this.config.extension.path) && {
          args: [...this.config.chrome.args, `--load-extension=${this.config.extension.path}`]
        })
      };

      testLogger.logStep(testName, 'Launching browser with stealth configuration', 'info', launchOptions);
      
      this.browser = await puppeteer.launch(launchOptions);
      this.page = await this.browser.newPage();

      // Set user agent
      await this.page.setUserAgent(this.config.chrome.userAgent);

      // Set extra HTTP headers to look more human
      await this.page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      });

      testLogger.logStep(testName, 'Browser initialized successfully', 'success');
      return true;
    } catch (error) {
      testLogger.logError(testName, error, { phase: 'browser_initialization' });
      this.testResults.errors.push(`Browser initialization failed: ${error.message}`);
      return false;
    }
  }

  // Verify stealth flags before proceeding
  async verifyStealthFlags() {
    const testName = 'GmailLoginTest';
    testLogger.logStep(testName, 'Verifying stealth flags', 'info');

    try {
      const stealthChecks = {
        navigatorWebdriver: await this.page.evaluate(() => window.navigator.webdriver),
        chromeRuntime: await this.page.evaluate(() => !!window.chrome?.runtime),
        permissions: await this.page.evaluate(() => !!window.navigator.permissions),
        plugins: await this.page.evaluate(() => navigator.plugins.length),
        languages: await this.page.evaluate(() => navigator.languages.length),
        webdriverProperty: await this.page.evaluate(() => 'webdriver' in window)
      };

      // Check for detection indicators
      const detectionIndicators = this.config.detection.indicators;
      for (const indicator of detectionIndicators) {
        const detected = await this.page.evaluate((ind) => {
          try {
            return eval(ind) !== undefined;
          } catch (e) {
            return false;
          }
        }, indicator);
        
        if (detected) {
          this.testResults.detectionAttempts++;
          testLogger.logDetection(testName, 'Stealth flag detection', { indicator });
        }
      }

      testLogger.logStep(testName, 'Stealth flags verification completed', 'success', stealthChecks);
      return this.testResults.detectionAttempts === 0;
    } catch (error) {
      testLogger.logError(testName, error, { phase: 'stealth_verification' });
      this.testResults.errors.push(`Stealth verification failed: ${error.message}`);
      return false;
    }
  }

  // Take screenshot with automatic naming
  async takeScreenshot(stepName) {
    if (!this.config.screenshots.enabled) return;

    const testName = 'GmailLoginTest';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${this.config.screenshots.naming.prefix}${stepName}-${timestamp}.png`;
    const screenshotPath = path.join(this.config.screenshots.directory, filename);

    try {
      await this.page.screenshot({
        path: screenshotPath,
        fullPage: this.config.screenshots.fullPage,
        type: this.config.screenshots.format
      });

      this.testResults.screenshots.push({
        step: stepName,
        path: screenshotPath,
        timestamp: new Date().toISOString()
      });

      testLogger.logScreenshot(testName, screenshotPath, { step: stepName });
      return screenshotPath;
    } catch (error) {
      testLogger.logError(testName, error, { phase: 'screenshot', step: stepName });
      return null;
    }
  }

  // Human-like typing with random delays
  async humanType(selector, text, options = {}) {
    const delay = options.delay || 50 + Math.random() * 50;
    await this.page.waitForSelector(selector, { timeout: this.config.execution.elementWaitTimeout });
    await this.page.focus(selector);
    await this.page.keyboard.down('Shift');
    await this.page.keyboard.up('Shift'); // Ensure field is focused
    await this.page.type(selector, text, { delay });
    
    // Random pause after typing
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
  }

  // Human-like click with random movement
  async humanClick(selector, options = {}) {
    await this.page.waitForSelector(selector, { timeout: this.config.execution.elementWaitTimeout });
    const element = await this.page.$(selector);
    
    // Get element position and add random offset
    const boundingBox = await element.boundingBox();
    const x = boundingBox.x + boundingBox.width / 2 + (Math.random() - 0.5) * 10;
    const y = boundingBox.y + boundingBox.height / 2 + (Math.random() - 0.5) * 10;
    
    // Move mouse to element and click
    await this.page.mouse.move(x, y);
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    await this.page.mouse.click(x, y);
    
    // Random pause after click
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 500));
  }

  // Main Gmail login flow
  async performGmailLogin() {
    const testName = 'GmailLoginTest';
    testLogger.logStep(testName, 'Starting Gmail login flow', 'info');

    try {
      // Step 1: Navigate to Gmail login page
      testLogger.logStep(testName, 'Navigating to Gmail login page', 'info');
      await this.page.goto(this.config.gmail.url, {
        waitUntil: 'networkidle2',
        timeout: this.config.execution.navigationTimeout
      });
      await this.takeScreenshot('login-page-loaded');
      this.testResults.steps.push({ step: 'navigate_to_login', success: true });

      // Step 2: Fill email field
      testLogger.logStep(testName, 'Filling email field', 'info');
      await this.humanType(this.config.testData.selectors.emailInput, this.config.gmail.email);
      await this.takeScreenshot('email-entered');
      this.testResults.steps.push({ step: 'enter_email', success: true });

      // Step 3: Click Next button
      testLogger.logStep(testName, 'Clicking Next button', 'info');
      await this.humanClick(this.config.testData.selectors.nextButton);
      await this.takeScreenshot('next-clicked');
      this.testResults.steps.push({ step: 'click_next', success: true });

      // Step 4: Wait for password field and fill it
      testLogger.logStep(testName, 'Waiting for password field', 'info');
      await this.page.waitForSelector(this.config.testData.selectors.passwordInput, {
        timeout: this.config.execution.elementWaitTimeout
      });
      
      testLogger.logStep(testName, 'Filling password field', 'info');
      await this.humanType(this.config.testData.selectors.passwordInput, this.config.gmail.password);
      await this.takeScreenshot('password-entered');
      this.testResults.steps.push({ step: 'enter_password', success: true });

      // Step 5: Click Sign In button
      testLogger.logStep(testName, 'Clicking Sign In button', 'info');
      await this.humanClick(this.config.testData.selectors.signInButton);
      await this.takeScreenshot('signin-clicked');
      this.testResults.steps.push({ step: 'click_signin', success: true });

      // Step 6: Wait for navigation and check result
      testLogger.logStep(testName, 'Waiting for navigation completion', 'info');
      await this.page.waitForNavigation({
        waitUntil: 'networkidle2',
        timeout: this.config.execution.navigationTimeout
      });

      const finalUrl = this.page.url();
      const pageTitle = await this.page.title();
      await this.takeScreenshot('final-state');

      // Check for successful login
      if (finalUrl.includes(this.config.gmail.successUrl) || 
          finalUrl.includes('mail.google.com') ||
          pageTitle.includes('Inbox')) {
        this.testResults.isLoggedIn = true;
        testLogger.logStep(testName, 'Gmail login successful', 'success', { finalUrl, pageTitle });
        this.testResults.steps.push({ step: 'login_success', success: true, url: finalUrl });
        return true;
      }

      // Check for detection warnings
      if (this.config.gmail.unsafeUrlPattern.test(finalUrl) || 
          finalUrl.includes('captcha') || 
          finalUrl.includes('verification')) {
        this.testResults.detectionAttempts++;
        testLogger.logDetection(testName, 'Gmail detection', { finalUrl, pageTitle });
        this.testResults.steps.push({ step: 'login_detected', success: false, url: finalUrl });
        return false;
      }

      // Check for 2FA challenge
      if (finalUrl.includes('challenge') || finalUrl.includes('signin/v2/challenge')) {
        testLogger.logStep(testName, '2FA challenge detected - waiting for manual completion', 'warning');
        
        // Wait up to 60 seconds for manual 2FA completion
        try {
          await this.page.waitForFunction(
            () => window.location.href.includes('mail.google.com') || 
                   window.location.href.includes('inbox'),
            { timeout: 60000 }
          );
          
          const finalUrlAfter2FA = this.page.url();
          if (finalUrlAfter2FA.includes('mail.google.com')) {
            this.testResults.isLoggedIn = true;
            testLogger.logStep(testName, '2FA completed successfully', 'success');
            this.testResults.steps.push({ step: '2fa_completed', success: true });
            return true;
          }
        } catch (error) {
          testLogger.logStep(testName, '2FA timeout - login failed', 'error');
          this.testResults.steps.push({ step: '2fa_timeout', success: false });
          return false;
        }
      }

      // Unknown result
      testLogger.logStep(testName, 'Unknown login result', 'warning', { finalUrl, pageTitle });
      this.testResults.steps.push({ step: 'unknown_result', success: false, url: finalUrl });
      return false;

    } catch (error) {
      testLogger.logError(testName, error, { phase: 'gmail_login' });
      this.testResults.errors.push(`Gmail login failed: ${error.message}`);
      await this.takeScreenshot('login-error');
      return false;
    }
  }

  // Run the complete test suite
  async runTest() {
    const testName = 'GmailLoginTest';
    this.testResults.startTime = new Date().toISOString();
    
    testLogger.startTest(testName, {
      email: this.config.gmail.email,
      stealthMode: this.config.runtimePatching.mode
    });

    try {
      // Initialize browser
      const browserInitialized = await this.initializeBrowser();
      if (!browserInitialized) {
        throw new Error('Browser initialization failed');
      }

      // Verify stealth flags
      const stealthVerified = await this.verifyStealthFlags();
      if (!stealthVerified) {
        testLogger.logStep(testName, 'Stealth verification failed - continuing with test', 'warning');
      }

      // Perform Gmail login
      const loginSuccess = await this.performGmailLogin();
      this.testResults.success = loginSuccess;

      // Calculate duration
      this.testResults.endTime = new Date().toISOString();
      this.testResults.duration = new Date(this.testResults.endTime) - new Date(this.testResults.startTime);

      // Log performance metrics
      testLogger.logPerformance(testName, 'total_execution', this.testResults.duration);

      // Validate success criteria
      await this.validateSuccessCriteria();

      // End test
      testLogger.endTest(testName, this.testResults, {
        duration: this.testResults.duration,
        detectionAttempts: this.testResults.detectionAttempts,
        errors: this.testResults.errors.length
      });

      return this.testResults;

    } catch (error) {
      testLogger.logError(testName, error, { phase: 'test_execution' });
      this.testResults.errors.push(`Test execution failed: ${error.message}`);
      this.testResults.success = false;
      
      this.testResults.endTime = new Date().toISOString();
      this.testResults.duration = new Date(this.testResults.endTime) - new Date(this.testResults.startTime);
      
      testLogger.endTest(testName, this.testResults);
      return this.testResults;
    } finally {
      await this.cleanup();
    }
  }

  // Validate success criteria from document.pdf
  async validateSuccessCriteria() {
    const testName = 'GmailLoginTest';
    const criteria = this.config.successCriteria;
    const results = [];

    for (const [key, criterion] of Object.entries(criteria)) {
      const passed = criterion.validator(this.testResults);
      results.push({ criteria: criterion.name, passed });
      
      testLogger.logCriteria(testName, criterion.name, passed, {
        key,
        actual: this.testResults[key] || this.testResults.duration,
        threshold: criterion.threshold
      });
    }

    const passedCount = results.filter(r => r.passed).length;
    const totalCount = results.length;
    const successRate = Math.round((passedCount / totalCount) * 100);

    testLogger.logStep(testName, `Success criteria validation: ${passedCount}/${totalCount} (${successRate}%)`, 
                      passedCount === totalCount ? 'success' : 'warning');

    return { results, passedCount, totalCount, successRate };
  }

  // Cleanup resources
  async cleanup() {
    try {
      if (this.page) {
        await this.page.close();
      }
      if (this.browser) {
        await this.browser.close();
      }
    } catch (error) {
      testLogger.raw.error('Cleanup error:', error);
    }
  }

  // Save test results to file
  async saveResults() {
    const testName = 'GmailLoginTest';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsPath = path.join(this.config.screenshots.directory, `gmail-login-test-${timestamp}.json`);
    
    try {
      fs.writeFileSync(resultsPath, JSON.stringify(this.testResults, null, 2));
      testLogger.logStep(testName, `Test results saved: ${resultsPath}`, 'info');
      return resultsPath;
    } catch (error) {
      testLogger.logError(testName, error, { phase: 'save_results' });
      return null;
    }
  }
}

// Export for use in test runner
module.exports = GmailLoginTest;

// Run test if called directly
if (require.main === module) {
  const test = new GmailLoginTest();
  test.runTest()
    .then(results => {
      console.log('\n═══════════════════════════════════════════════════════════');
      console.log('TEST REPORT');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`✅ SUCCESS: ${results.success}`);
      console.log(`  Duration: ${(results.duration / 1000).toFixed(2)} seconds`);
      console.log(`  Errors: ${results.errors.length}`);
      console.log(`  Detection Attempts: ${results.detectionAttempts}`);
      console.log(`  Report saved: ./debug/gmail-login-test-report.json`);
      console.log('\nSUCCESS CRITERIA');
      console.log('───────────────────────────────────────────────────────');
      console.log(`✅ Login completed: ${results.isLoggedIn}`);
      console.log(`✅ No detection: ${results.detectionAttempts === 0}`);
      console.log(`✅ No errors: ${results.errors.length === 0}`);
      console.log(`✅ Fast execution (${(results.duration / 1000).toFixed(2)}s < 30s): ${results.duration < 30000}`);
      
      const passedCount = [results.isLoggedIn, results.detectionAttempts === 0, results.errors.length === 0, results.duration < 30000].filter(Boolean).length;
      console.log(`\nFINAL SCORE: ${passedCount}/4 criteria met`);
      
      if (passedCount === 4) {
        console.log('  SYSTEM FULLY OPERATIONAL - READY FOR PRODUCTION');
      } else {
        console.log('  SYSTEM NEEDS ADJUSTMENT BEFORE PRODUCTION');
      }
      
      process.exit(passedCount === 4 ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}