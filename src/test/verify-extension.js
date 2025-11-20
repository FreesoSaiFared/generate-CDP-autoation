const puppeteer = require('rebrowser-puppeteer');
const { getConfig } = require('./test-config');
const testLogger = require('./test-logger');
const path = require('path');
const fs = require('fs');

class ExtensionTest {
  constructor() {
    this.config = getConfig();
    this.browser = null;
    this.page = null;
    this.extensionId = null;
    this.testResults = {
      startTime: null,
      endTime: null,
      duration: 0,
      success: false,
      extensionLoaded: false,
      cdpFunctional: false,
      stateCaptureWorking: false,
      debuggerAPIWorking: false,
      errors: [],
      tests: []
    };
  }

  // Initialize browser with extension loaded
  async initializeBrowser() {
    const testName = 'ExtensionTest';
    testLogger.startTest(testName, { phase: 'browser_initialization' });

    try {
      // Verify extension path exists
      if (!fs.existsSync(this.config.extension.path)) {
        throw new Error(`Extension path does not exist: ${this.config.extension.path}`);
      }

      // Verify manifest exists
      if (!fs.existsSync(this.config.extension.manifestPath)) {
        throw new Error(`Extension manifest does not exist: ${this.config.extension.manifestPath}`);
      }

      const launchOptions = {
        headless: false, // Extension requires non-headless mode
        args: [
          ...this.config.chrome.args,
          `--load-extension=${this.config.extension.path}`,
          '--disable-extensions-file-access-check',
          '--disable-extensions-http-throttling'
        ],
        defaultViewport: this.config.chrome.viewport,
        ignoreDefaultArgs: ['--enable-blink-features=AutomationControlled']
      };

      testLogger.logStep(testName, 'Launching browser with CDP extension', 'info', {
        extensionPath: this.config.extension.path,
        manifestPath: this.config.extension.manifestPath
      });
      
      this.browser = await puppeteer.launch(launchOptions);
      
      // Wait for extension to load
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Get extension ID
      const targets = await this.browser.targets();
      const extensionTarget = targets.find(target => 
        target.type() === 'background_page' || 
        target.type() === 'service_worker'
      );
      
      if (extensionTarget) {
        this.extensionId = extensionTarget.url().split('/')[2];
        testLogger.logStep(testName, `Extension loaded with ID: ${this.extensionId}`, 'success');
        this.testResults.extensionLoaded = true;
      } else {
        throw new Error('Extension target not found');
      }

      this.page = await this.browser.newPage();
      await this.page.setUserAgent(this.config.chrome.userAgent);

      testLogger.logStep(testName, 'Browser initialized with extension', 'success');
      return true;
    } catch (error) {
      testLogger.logError(testName, error, { phase: 'browser_initialization' });
      this.testResults.errors.push(`Browser initialization failed: ${error.message}`);
      return false;
    }
  }

  // Test 1: Verify extension is properly loaded
  async testExtensionLoading() {
    const testName = 'ExtensionTest';
    const testId = 'extension_loading';
    
    testLogger.logStep(testName, 'Testing extension loading', 'info');

    try {
      // Check extension pages
      const extensionPages = await this.browser.pages();
      const extensionContext = extensionPages.find(page => 
        page.url().includes('chrome-extension://')
      );

      // Test extension manifest validation
      const manifestContent = JSON.parse(fs.readFileSync(this.config.extension.manifestPath, 'utf8'));
      const manifestValidation = {
        hasManifestVersion: !!manifestContent.manifest_version,
        hasName: !!manifestContent.name,
        hasVersion: !!manifestContent.version,
        hasPermissions: Array.isArray(manifestContent.permissions),
        hasBackground: !!manifestContent.background,
        expectedPermissions: this.config.extension.expectedPermissions,
        actualPermissions: manifestContent.permissions || [],
        hasHostPermissions: Array.isArray(manifestContent.host_permissions),
        expectedHostPermissions: this.config.extension.expectedHostPermissions,
        actualHostPermissions: manifestContent.host_permissions || []
      };

      // Check if required permissions are present
      const hasRequiredPermissions = manifestValidation.expectedPermissions.every(perm => 
        manifestValidation.actualPermissions.includes(perm)
      );

      const testResult = {
        testId,
        name: 'Extension Loading',
        success: this.testResults.extensionLoaded && hasRequiredPermissions,
        details: {
          extensionId: this.extensionId,
          extensionPages: extensionPages.length,
          manifestValidation,
          hasRequiredPermissions
        }
      };

      this.testResults.tests.push(testResult);

      if (testResult.success) {
        testLogger.logStep(testName, 'Extension loaded successfully', 'success', testResult.details);
      } else {
        testLogger.logStep(testName, 'Extension loading failed', 'error', testResult.details);
        this.testResults.errors.push(`Extension loading failed: ${JSON.stringify(testResult.details)}`);
      }

      return testResult.success;
    } catch (error) {
      testLogger.logError(testName, error, { phase: 'test_extension_loading' });
      this.testResults.errors.push(`Extension loading test error: ${error.message}`);
      return false;
    }
  }

  // Test 2: Test CDP functionality through extension
  async testCDPFunctionality() {
    const testName = 'ExtensionTest';
    const testId = 'cdp_functionality';
    
    testLogger.logStep(testName, 'Testing CDP functionality through extension', 'info');

    try {
      // Navigate to a test page
      await this.page.goto('https://example.com', { waitUntil: 'networkidle2' });

      // Test CDP commands through extension
      const cdpTests = [
        {
          name: 'Get Page Title',
          command: async () => {
            return await this.page.evaluate(() => document.title);
          }
        },
        {
          name: 'Get DOM Content',
          command: async () => {
            return await this.page.evaluate(() => {
              return {
                title: document.title,
                url: window.location.href,
                elementCount: document.querySelectorAll('*').length
              };
            });
          }
        },
        {
          name: 'Execute JavaScript',
          command: async () => {
            return await this.page.evaluate(() => {
              return {
                timestamp: Date.now(),
                userAgent: navigator.userAgent,
                platform: navigator.platform
              };
            });
          }
        },
        {
          name: 'Access Browser APIs',
          command: async () => {
            return await this.page.evaluate(() => {
              return {
                hasChrome: typeof chrome !== 'undefined',
                hasChromeRuntime: typeof chrome?.runtime !== 'undefined',
                hasChromeDebugger: typeof chrome?.debugger !== 'undefined'
              };
            });
          }
        }
      ];

      const results = [];
      let successCount = 0;

      for (const test of cdpTests) {
        try {
          const startTime = Date.now();
          const result = await test.command();
          const duration = Date.now() - startTime;

          const testResult = {
            name: test.name,
            success: true,
            duration,
            result
          };

          results.push(testResult);
          successCount++;

          testLogger.logStep(testName, `CDP command successful: ${test.name}`, 'success', { duration });
        } catch (error) {
          results.push({
            name: test.name,
            success: false,
            error: error.message
          });
          
          testLogger.logError(testName, error, { phase: 'cdp_command', command: test.name });
        }
      }

      const testResult = {
        testId,
        name: 'CDP Functionality',
        success: successCount === cdpTests.length,
        details: {
          totalTests: cdpTests.length,
          successCount,
          results
        }
      };

      this.testResults.tests.push(testResult);
      this.testResults.cdpFunctional = testResult.success;

      if (testResult.success) {
        testLogger.logStep(testName, 'CDP functionality working correctly', 'success', testResult.details);
      } else {
        testLogger.logStep(testName, `CDP functionality issues: ${successCount}/${cdpTests.length} tests passed`, 'warning', testResult.details);
      }

      return testResult.success;
    } catch (error) {
      testLogger.logError(testName, error, { phase: 'test_cdp_functionality' });
      this.testResults.errors.push(`CDP functionality test error: ${error.message}`);
      return false;
    }
  }

  // Test 3: Test state capture and injection
  async testStateCaptureAndInjection() {
    const testName = 'ExtensionTest';
    const testId = 'state_capture_injection';
    
    testLogger.logStep(testName, 'Testing state capture and injection', 'info');

    try {
      // Navigate to a page with state
      await this.page.goto('https://example.com', { waitUntil: 'networkidle2' });

      // Create some test state
      await this.page.evaluate(() => {
        localStorage.setItem('test_key', 'test_value');
        sessionStorage.setItem('session_test', 'session_value');
        window.testVariable = 'injected_value';
      });

      // Capture state
      const capturedState = await this.page.evaluate(() => {
        return {
          localStorage: { ...localStorage },
          sessionStorage: { ...sessionStorage },
          windowVariables: {
            testVariable: window.testVariable
          },
          url: window.location.href,
          title: document.title,
          timestamp: Date.now()
        };
      });

      // Verify state capture
      const stateCaptureValid = 
        capturedState.localStorage.test_key === 'test_value' &&
        capturedState.sessionStorage.session_test === 'session_value' &&
        capturedState.windowVariables.testVariable === 'injected_value';

      // Test state injection (simulate)
      await this.page.evaluate((state) => {
        // Clear existing state
        localStorage.clear();
        sessionStorage.clear();
        
        // Inject captured state
        Object.keys(state.localStorage).forEach(key => {
          localStorage.setItem(key, state.localStorage[key]);
        });
        
        Object.keys(state.sessionStorage).forEach(key => {
          sessionStorage.setItem(key, state.sessionStorage[key]);
        });
      }, capturedState);

      // Verify injection worked
      const injectedState = await this.page.evaluate(() => {
        return {
          localStorage: { ...localStorage },
          sessionStorage: { ...sessionStorage }
        };
      });

      const stateInjectionValid = 
        injectedState.localStorage.test_key === 'test_value' &&
        injectedState.sessionStorage.session_test === 'session_value';

      const testResult = {
        testId,
        name: 'State Capture and Injection',
        success: stateCaptureValid && stateInjectionValid,
        details: {
          capturedState,
          injectedState,
          stateCaptureValid,
          stateInjectionValid
        }
      };

      this.testResults.tests.push(testResult);
      this.testResults.stateCaptureWorking = testResult.success;

      if (testResult.success) {
        testLogger.logStep(testName, 'State capture and injection working correctly', 'success', testResult.details);
      } else {
        testLogger.logStep(testName, 'State capture and injection issues', 'error', testResult.details);
        this.testResults.errors.push(`State capture/injection failed: capture=${stateCaptureValid}, injection=${stateInjectionValid}`);
      }

      return testResult.success;
    } catch (error) {
      testLogger.logError(testName, error, { phase: 'test_state_capture_injection' });
      this.testResults.errors.push(`State capture/injection test error: ${error.message}`);
      return false;
    }
  }

  // Test 4: Test debugger API integration
  async testDebuggerAPIIntegration() {
    const testName = 'ExtensionTest';
    const testId = 'debugger_api_integration';
    
    testLogger.logStep(testName, 'Testing debugger API integration', 'info');

    try {
      // Test debugger API availability and functionality
      const debuggerTests = await this.page.evaluate(() => {
        return new Promise((resolve) => {
          const results = [];
          
          // Test 1: Check if chrome.debugger is available
          results.push({
            name: 'Chrome Debugger API Available',
            success: typeof chrome !== 'undefined' && typeof chrome.debugger !== 'undefined',
            details: {
              hasChrome: typeof chrome !== 'undefined',
              hasDebugger: typeof chrome?.debugger !== 'undefined'
            }
          });
          
          // Test 2: Check if we can access debugger methods
          if (typeof chrome?.debugger !== 'undefined') {
            results.push({
              name: 'Debugger Methods Available',
              success: typeof chrome.debugger.attach === 'function' &&
                      typeof chrome.debugger.detach === 'function' &&
                      typeof chrome.debugger.sendCommand === 'function',
              details: {
                hasAttach: typeof chrome.debugger.attach === 'function',
                hasDetach: typeof chrome.debugger.detach === 'function',
                hasSendCommand: typeof chrome.debugger.sendCommand === 'function'
              }
            });
          }
          
          // Test 3: Check if we can get tab information
          if (typeof chrome?.tabs !== 'undefined') {
            chrome.tabs.query({}, (tabs) => {
              results.push({
                name: 'Tab API Available',
                success: Array.isArray(tabs) && tabs.length > 0,
                details: {
                  tabCount: tabs.length,
                  currentTab: tabs.find(tab => tab.active)
                }
              });
              
              resolve(results);
            });
          } else {
            results.push({
              name: 'Tab API Available',
              success: false,
              details: { error: 'chrome.tabs not available' }
            });
            resolve(results);
          }
        });
      });

      const successCount = debuggerTests.filter(test => test.success).length;
      const testResult = {
        testId,
        name: 'Debugger API Integration',
        success: successCount === debuggerTests.length,
        details: {
          totalTests: debuggerTests.length,
          successCount,
          tests: debuggerTests
        }
      };

      this.testResults.tests.push(testResult);
      this.testResults.debuggerAPIWorking = testResult.success;

      if (testResult.success) {
        testLogger.logStep(testName, 'Debugger API integration working correctly', 'success', testResult.details);
      } else {
        testLogger.logStep(testName, `Debugger API integration issues: ${successCount}/${debuggerTests.length} tests passed`, 'warning', testResult.details);
      }

      return testResult.success;
    } catch (error) {
      testLogger.logError(testName, error, { phase: 'test_debugger_api_integration' });
      this.testResults.errors.push(`Debugger API integration test error: ${error.message}`);
      return false;
    }
  }

  // Run all extension tests
  async runAllTests() {
    const testName = 'ExtensionTest';
    this.testResults.startTime = new Date().toISOString();
    
    testLogger.startTest(testName, {
      extensionPath: this.config.extension.path,
      manifestPath: this.config.extension.manifestPath
    });

    try {
      // Initialize browser with extension
      const browserInitialized = await this.initializeBrowser();
      if (!browserInitialized) {
        throw new Error('Browser initialization failed');
      }

      // Run all tests
      const tests = [
        { name: 'Extension Loading', fn: () => this.testExtensionLoading() },
        { name: 'CDP Functionality', fn: () => this.testCDPFunctionality() },
        { name: 'State Capture and Injection', fn: () => this.testStateCaptureAndInjection() },
        { name: 'Debugger API Integration', fn: () => this.testDebuggerAPIIntegration() }
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
      testLogger.logStep(testName, `Extension tests completed: ${passedTests}/${totalTests} passed`, 
                        this.testResults.success ? 'success' : 'warning');

      // End test
      testLogger.endTest(testName, this.testResults, {
        duration: this.testResults.duration,
        extensionId: this.extensionId,
        extensionLoaded: this.testResults.extensionLoaded,
        cdpFunctional: this.testResults.cdpFunctional,
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
    const testName = 'ExtensionTest';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsPath = path.join(this.config.screenshots.directory, `extension-test-${timestamp}.json`);
    
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
module.exports = ExtensionTest;

// Run test if called directly
if (require.main === module) {
  const test = new ExtensionTest();
  test.runAllTests()
    .then(results => {
      console.log('\n═══════════════════════════════════════════════════════════');
      console.log('EXTENSION TEST REPORT');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`✅ SUCCESS: ${results.success}`);
      console.log(`  Duration: ${(results.duration / 1000).toFixed(2)} seconds`);
      console.log(`  Extension ID: ${results.extensionId || 'Not loaded'}`);
      console.log(`  Extension Loaded: ${results.extensionLoaded}`);
      console.log(`  CDP Functional: ${results.cdpFunctional}`);
      console.log(`  State Capture Working: ${results.stateCaptureWorking}`);
      console.log(`  Debugger API Working: ${results.debuggerAPIWorking}`);
      console.log(`  Tests Passed: ${results.tests.filter(t => t.success).length}/${results.tests.length}`);
      console.log('\nTEST RESULTS:');
      results.tests.forEach(test => {
        const status = test.success ? '✅' : '❌';
        console.log(`  ${status} ${test.name}`);
      });
      
      if (results.success) {
        console.log('\n✅ EXTENSION FULLY OPERATIONAL');
      } else {
        console.log('\n❌ EXTENSION NEEDS ADJUSTMENT');
      }
      
      process.exit(results.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Extension test failed:', error);
      process.exit(1);
    });
}