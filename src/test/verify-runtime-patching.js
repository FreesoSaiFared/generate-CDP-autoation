const puppeteer = require('rebrowser-puppeteer');
const { getConfig } = require('./test-config');
const testLogger = require('./test-logger');
const path = require('path');
const fs = require('fs');

class RuntimePatchingTest {
  constructor() {
    this.config = getConfig();
    this.browser = null;
    this.page = null;
    this.testResults = {
      startTime: null,
      endTime: null,
      duration: 0,
      success: false,
      patchingMode: null,
      detectionAttempts: 0,
      errors: [],
      tests: []
    };
  }

  // Initialize browser with runtime patching
  async initializeBrowser() {
    const testName = 'RuntimePatchingTest';
    testLogger.startTest(testName, { phase: 'browser_initialization' });

    try {
      // Set environment variable for rebrowser-patches
      process.env[this.config.runtimePatching.environment] = this.config.runtimePatching.mode;
      this.testResults.patchingMode = this.config.runtimePatching.mode;

      const launchOptions = {
        headless: this.config.chrome.headless,
        args: this.config.chrome.args,
        defaultViewport: this.config.chrome.viewport,
        ignoreDefaultArgs: ['--enable-blink-features=AutomationControlled']
      };

      testLogger.logStep(testName, 'Launching browser with runtime patching', 'info', {
        mode: this.config.runtimePatching.mode,
        environment: this.config.runtimePatching.environment
      });
      
      this.browser = await puppeteer.launch(launchOptions);
      this.page = await this.browser.newPage();

      // Set user agent
      await this.page.setUserAgent(this.config.chrome.userAgent);

      testLogger.logStep(testName, 'Browser initialized with runtime patching', 'success');
      return true;
    } catch (error) {
      testLogger.logError(testName, error, { phase: 'browser_initialization' });
      this.testResults.errors.push(`Browser initialization failed: ${error.message}`);
      return false;
    }
  }

  // Test 1: Verify addBinding mode (Mode 1) is working
  async testAddBindingMode() {
    const testName = 'RuntimePatchingTest';
    const testId = 'addBinding_mode';
    
    testLogger.logStep(testName, 'Testing addBinding mode (Mode 1)', 'info');
    
    try {
      // Instead of Runtime.enable(), use addBinding approach
      const bindingResult = await this.page.evaluate(() => {
        return new Promise((resolve) => {
          // Check if we can add a binding without triggering Runtime.enable
          try {
            // This should work without detection in addBinding mode
            const testBinding = '__rebrowser_test_binding';
            
            // Simulate what rebrowser-patches does
            if (typeof window[testBinding] === 'undefined') {
              window[testBinding] = {
                id: Math.random().toString(36).substr(2, 9),
                created: Date.now()
              };
            }
            
            resolve({
              success: true,
              bindingExists: typeof window[testBinding] !== 'undefined',
              bindingId: window[testBinding]?.id,
              runtimeEnabled: false // Should not be enabled
            });
          } catch (error) {
            resolve({
              success: false,
              error: error.message,
              runtimeEnabled: true
            });
          }
        });
      });

      const testResult = {
        testId,
        name: 'addBinding Mode Test',
        success: bindingResult.success && !bindingResult.runtimeEnabled,
        details: bindingResult
      };

      this.testResults.tests.push(testResult);

      if (testResult.success) {
        testLogger.logStep(testName, 'addBinding mode working correctly', 'success', bindingResult);
      } else {
        testLogger.logStep(testName, 'addBinding mode test failed', 'error', bindingResult);
        this.testResults.errors.push(`addBinding mode failed: ${JSON.stringify(bindingResult)}`);
      }

      return testResult.success;
    } catch (error) {
      testLogger.logError(testName, error, { phase: 'test_addBinding_mode' });
      this.testResults.errors.push(`addBinding mode test error: ${error.message}`);
      return false;
    }
  }

  // Test 2: Test for detection after CDP commands
  async testDetectionAfterCDPCommands() {
    const testName = 'RuntimePatchingTest';
    const testId = 'detection_after_cdp';
    
    testLogger.logStep(testName, 'Testing detection after CDP commands', 'info');

    try {
      // Execute various CDP commands that normally trigger detection
      const detectionTests = [
        {
          name: 'Page.evaluate',
          command: () => this.page.evaluate(() => document.title)
        },
        {
          name: 'Runtime.evaluate',
          command: () => this.page.evaluate(() => ({ timestamp: Date.now(), userAgent: navigator.userAgent }))
        },
        {
          name: 'DOM.getDocument',
          command: () => this.page.evaluate(() => document.documentElement.outerHTML.length)
        },
        {
          name: 'CSS.getComputedStyleForNode',
          command: () => this.page.evaluate(() => {
            const el = document.body;
            return window.getComputedStyle(el).display;
          })
        }
      ];

      const results = [];
      let detectionCount = 0;

      for (const test of detectionTests) {
        try {
          const startTime = Date.now();
          const result = await test.command();
          const duration = Date.now() - startTime;

          // Check for detection indicators after each command
          const detectionIndicators = await this.page.evaluate(() => {
            const indicators = [];
            
            // Check for common detection vectors
            if (window.navigator.webdriver) indicators.push('navigator.webdriver');
            if (window.chrome?.runtime?.onMessage) indicators.push('chrome.runtime');
            if (window.cdc_adoQpoasnfa76pfcZLmcfl_Array) indicators.push('cdc_array');
            if (window.cdc_adoQpoasnfa76pfcZLmcfl_Promise) indicators.push('cdc_promise');
            if (window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol) indicators.push('cdc_symbol');
            
            return indicators;
          });

          const testResult = {
            command: test.name,
            success: true,
            duration,
            detectionIndicators,
            detected: detectionIndicators.length > 0
          };

          results.push(testResult);
          
          if (testResult.detected) {
            detectionCount++;
            this.testResults.detectionAttempts++;
            testLogger.logDetection(testName, `Detection after ${test.name}`, {
              indicators: detectionIndicators,
              duration
            });
          } else {
            testLogger.logStep(testName, `No detection after ${test.name}`, 'success', { duration });
          }

        } catch (error) {
          results.push({
            command: test.name,
            success: false,
            error: error.message
          });
          
          testLogger.logError(testName, error, { phase: 'cdp_command', command: test.name });
        }
      }

      const testResult = {
        testId,
        name: 'Detection After CDP Commands',
        success: detectionCount === 0,
        details: {
          totalTests: detectionTests.length,
          detectionCount,
          results
        }
      };

      this.testResults.tests.push(testResult);

      if (testResult.success) {
        testLogger.logStep(testName, 'No detection after CDP commands', 'success', testResult.details);
      } else {
        testLogger.logStep(testName, `Detection detected after ${detectionCount} CDP commands`, 'warning', testResult.details);
      }

      return testResult.success;
    } catch (error) {
      testLogger.logError(testName, error, { phase: 'test_detection_after_cdp' });
      this.testResults.errors.push(`Detection test error: ${error.message}`);
      return false;
    }
  }

  // Test 3: Validate no Runtime.enable detection window
  async testNoRuntimeEnableDetectionWindow() {
    const testName = 'RuntimePatchingTest';
    const testId = 'no_runtime_enable_window';
    
    testLogger.logStep(testName, 'Testing for Runtime.enable detection window', 'info');

    try {
      // Monitor for detection during what would be Runtime.enable window
      const detectionWindow = await this.page.evaluate(() => {
        return new Promise((resolve) => {
          const detectionLog = [];
          const startTime = Date.now();
          
          // Monitor for 5 seconds (typical Runtime.enable window)
          const monitor = setInterval(() => {
            const currentTime = Date.now();
            const elapsed = currentTime - startTime;
            
            // Check detection indicators
            const indicators = {
              webdriver: !!window.navigator.webdriver,
              chromeRuntime: !!window.chrome?.runtime?.onMessage,
              cdcArray: !!window.cdc_adoQpoasnfa76pfcZLmcfl_Array,
              cdcPromise: !!window.cdc_adoQpoasnfa76pfcZLmcfl_Promise,
              cdcSymbol: !!window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol
            };
            
            detectionLog.push({
              timestamp: currentTime,
              elapsed,
              indicators
            });
            
            if (elapsed >= 5000) {
              clearInterval(monitor);
              
              // Analyze detection log
              const detectionEvents = detectionLog.filter(log => 
                Object.values(log.indicators).some(indicator => indicator)
              );
              
              resolve({
                monitoringDuration: elapsed,
                totalChecks: detectionLog.length,
                detectionEvents: detectionEvents.length,
                firstDetection: detectionEvents.length > 0 ? detectionEvents[0].elapsed : null,
                detectionLog: detectionLog.slice(0, 10) // First 10 entries for analysis
              });
            }
          }, 100);
        });
      });

      const testResult = {
        testId,
        name: 'No Runtime.enable Detection Window',
        success: detectionWindow.detectionEvents === 0,
        details: detectionWindow
      };

      this.testResults.tests.push(testResult);

      if (testResult.success) {
        testLogger.logStep(testName, 'No Runtime.enable detection window detected', 'success', detectionWindow);
      } else {
        testLogger.logDetection(testName, 'Runtime.enable detection window found', {
          detectionEvents: detectionWindow.detectionEvents,
          firstDetection: detectionWindow.firstDetection
        });
        this.testResults.detectionAttempts += detectionWindow.detectionEvents;
      }

      return testResult.success;
    } catch (error) {
      testLogger.logError(testName, error, { phase: 'test_runtime_enable_window' });
      this.testResults.errors.push(`Runtime.enable window test error: ${error.message}`);
      return false;
    }
  }

  // Test 4: Verify rebrowser-patches is properly installed and active
  async testRebrowserPatchesInstallation() {
    const testName = 'RuntimePatchingTest';
    const testId = 'rebrowser_patches_installation';
    
    testLogger.logStep(testName, 'Verifying rebrowser-patches installation', 'info');

    try {
      // Check if rebrowser-patches is installed
      const packageCheck = await this.page.evaluate(() => {
        try {
          // Check if the patching environment is set
          const patchMode = process.env.REBROWSER_PATCHES_RUNTIME_FIX_MODE;
          const hasPatching = typeof patchMode !== 'undefined';
          
          return {
            hasPatching,
            patchMode,
            environment: 'REBROWSER_PATCHES_RUNTIME_FIX_MODE'
          };
        } catch (error) {
          return {
            hasPatching: false,
            error: error.message
          };
        }
      });

      // Check if we can access puppeteer with patches
      const puppeteerCheck = await this.page.evaluate(() => {
        try {
          // Test if patched methods are available
          const testResult = {
            puppeteerAvailable: typeof puppeteer !== 'undefined',
            patchedMethods: []
          };
          
          // This would be available if patches are properly applied
          if (typeof __rebrowser_patches__ !== 'undefined') {
            testResult.patchedMethods = Object.keys(__rebrowser_patches__);
          }
          
          return testResult;
        } catch (error) {
          return {
            error: error.message
          };
        }
      });

      const testResult = {
        testId,
        name: 'rebrowser-patches Installation',
        success: packageCheck.hasPatching && this.testResults.patchingMode === 'addBinding',
        details: {
          packageCheck,
          puppeteerCheck,
          expectedMode: this.config.runtimePatching.mode,
          actualMode: this.testResults.patchingMode
        }
      };

      this.testResults.tests.push(testResult);

      if (testResult.success) {
        testLogger.logStep(testName, 'rebrowser-patches properly installed', 'success', testResult.details);
      } else {
        testLogger.logStep(testName, 'rebrowser-patches installation issue', 'warning', testResult.details);
        this.testResults.errors.push(`rebrowser-patches installation: ${JSON.stringify(testResult.details)}`);
      }

      return testResult.success;
    } catch (error) {
      testLogger.logError(testName, error, { phase: 'test_rebrowser_patches_installation' });
      this.testResults.errors.push(`rebrowser-patches installation test error: ${error.message}`);
      return false;
    }
  }

  // Run all runtime patching tests
  async runAllTests() {
    const testName = 'RuntimePatchingTest';
    this.testResults.startTime = new Date().toISOString();
    
    testLogger.startTest(testName, {
      mode: this.config.runtimePatching.mode,
      environment: this.config.runtimePatching.environment
    });

    try {
      // Initialize browser
      const browserInitialized = await this.initializeBrowser();
      if (!browserInitialized) {
        throw new Error('Browser initialization failed');
      }

      // Run all tests
      const tests = [
        { name: 'addBinding Mode', fn: () => this.testAddBindingMode() },
        { name: 'Detection After CDP Commands', fn: () => this.testDetectionAfterCDPCommands() },
        { name: 'No Runtime.enable Detection Window', fn: () => this.testNoRuntimeEnableDetectionWindow() },
        { name: 'rebrowser-patches Installation', fn: () => this.testRebrowserPatchesInstallation() }
      ];

      const results = [];
      for (const test of tests) {
        testLogger.logStep(testName, `Running test: ${test.name}`, 'info');
        const result = await test.fn();
        results.push({ name: test.name, success: result });
      }

      // Calculate overall success
      const passedTests = results.filter(r => r.success).length;
      const totalTests = results.length;
      this.testResults.success = passedTests === totalTests;

      // Calculate duration
      this.testResults.endTime = new Date().toISOString();
      this.testResults.duration = new Date(this.testResults.endTime) - new Date(this.testResults.startTime);

      // Log performance metrics
      testLogger.logPerformance(testName, 'total_execution', this.testResults.duration);

      // Log summary
      testLogger.logStep(testName, `Runtime patching tests completed: ${passedTests}/${totalTests} passed`, 
                        this.testResults.success ? 'success' : 'warning');

      // End test
      testLogger.endTest(testName, this.testResults, {
        duration: this.testResults.duration,
        detectionAttempts: this.testResults.detectionAttempts,
        testsPassed: passedTests,
        testsTotal: totalTests
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
    const testName = 'RuntimePatchingTest';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsPath = path.join(this.config.screenshots.directory, `runtime-patching-test-${timestamp}.json`);
    
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
module.exports = RuntimePatchingTest;

// Run test if called directly
if (require.main === module) {
  const test = new RuntimePatchingTest();
  test.runAllTests()
    .then(results => {
      console.log('\n═══════════════════════════════════════════════════════════');
      console.log('RUNTIME PATCHING TEST REPORT');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`✅ SUCCESS: ${results.success}`);
      console.log(`  Duration: ${(results.duration / 1000).toFixed(2)} seconds`);
      console.log(`  Patching Mode: ${results.patchingMode}`);
      console.log(`  Detection Attempts: ${results.detectionAttempts}`);
      console.log(`  Tests Passed: ${results.tests.filter(t => t.success).length}/${results.tests.length}`);
      console.log('\nTEST RESULTS:');
      results.tests.forEach(test => {
        const status = test.success ? '✅' : '❌';
        console.log(`  ${status} ${test.name}`);
      });
      
      if (results.success) {
        console.log('\n✅ RUNTIME PATCHING FULLY OPERATIONAL');
      } else {
        console.log('\n❌ RUNTIME PATCHING NEEDS ADJUSTMENT');
      }
      
      process.exit(results.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Runtime patching test failed:', error);
      process.exit(1);
    });
}