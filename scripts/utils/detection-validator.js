/**
 * Detection Validator Utility
 * 
 * This utility provides comprehensive detection bypass validation for CDP Stealth system,
 * including stealth flag verification, runtime patching validation, and extension testing.
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const puppeteer = require('rebrowser-puppeteer');

class DetectionValidator {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '../..');
    this.validationResults = {
      stealthFlags: {},
      runtimePatching: {},
      extensionTests: {},
      gmailLogin: {},
      detectionAttempts: 0
    };
  }

  /**
   * Validate stealth flags effectiveness
   */
  async validateStealthFlags(browser) {
    try {
      console.log('   🔍 Validating stealth flags...');
      
      const page = await browser.newPage();
      
      // Navigate to detection test page
      await page.goto('https://bot.sannysoft.com/', { waitUntil: 'networkidle2' });
      
      // Run comprehensive stealth checks
      const stealthChecks = await page.evaluate(() => {
        return {
          // Critical detection vectors
          webdriver: navigator.webdriver,
          chromeRuntime: window.chrome?.runtime?.id,
          permissions: navigator.permissions ? 'present' : 'missing',
          
          // Browser fingerprinting
          plugins: navigator.plugins.length,
          languages: navigator.languages.length,
          platform: navigator.platform,
          userAgent: navigator.userAgent,
          
          // Automation detection
          automation: window.chrome && window.chrome.runtime && window.chrome.runtime.onConnect,
          
          // WebDriver detection
          selenium: window.document.documentElement.getAttribute('selenium'),
          webdriverAttribute: window.document.documentElement.getAttribute('webdriver'),
          
          // Additional checks
          phantom: window.callPhantom || window._phantom,
          nightmare: window.__nightmare,
          seleniumWebDriver: window.webdriver,
          
          // Chrome-specific checks
          chrome: window.chrome ? {
            app: !!window.chrome.app,
            runtime: !!window.chrome.runtime,
            csi: !!window.chrome.csi,
            loadTimes: !!window.chrome.loadTimes
          } : null,
          
          // Performance timing
          timing: performance.timing ? {
            navigationStart: performance.timing.navigationStart,
            loadEventEnd: performance.timing.loadEventEnd
          } : null
        };
      });
      
      // Evaluate each check against expected values
      const flagValidation = {
        'navigator.webdriver': {
          expected: undefined,
          actual: stealthChecks.webdriver,
          passed: stealthChecks.webdriver === undefined,
          critical: true
        },
        'chrome.runtime.id': {
          expected: undefined,
          actual: stealthChecks.chromeRuntime,
          passed: stealthChecks.chromeRuntime === undefined,
          critical: true
        },
        'automation detection': {
          expected: false,
          actual: !!stealthChecks.automation,
          passed: !stealthChecks.automation,
          critical: true
        },
        'webdriver attribute': {
          expected: null,
          actual: stealthChecks.webdriverAttribute,
          passed: stealthChecks.webdriverAttribute === null,
          critical: true
        },
        'selenium attribute': {
          expected: null,
          actual: stealthChecks.selenium,
          passed: stealthChecks.selenium === null,
          critical: true
        },
        'phantom detection': {
          expected: undefined,
          actual: stealthChecks.phantom,
          passed: stealthChecks.phantom === undefined,
          critical: false
        },
        'nightmare detection': {
          expected: undefined,
          actual: stealthChecks.nightmare,
          passed: stealthChecks.nightmare === undefined,
          critical: false
        },
        'plugins count': {
          expected: '> 0',
          actual: stealthChecks.plugins,
          passed: stealthChecks.plugins > 0,
          critical: false
        },
        'languages count': {
          expected: '> 0',
          actual: stealthChecks.languages,
          passed: stealthChecks.languages > 0,
          critical: false
        }
      };
      
      // Calculate overall stealth score
      const allChecks = Object.values(flagValidation);
      const criticalChecks = allChecks.filter(check => check.critical);
      const passedChecks = allChecks.filter(check => check.passed);
      const passedCriticalChecks = criticalChecks.filter(check => check.passed);
      
      const stealthScore = (passedChecks.length / allChecks.length) * 100;
      const criticalScore = (passedCriticalChecks.length / criticalChecks.length) * 100;
      
      await page.close();
      
      this.validationResults.stealthFlags = {
        checks: flagValidation,
        score: stealthScore,
        criticalScore,
        passed: stealthScore >= 95 && criticalScore === 100,
        details: stealthChecks
      };
      
      return this.validationResults.stealthFlags;
      
    } catch (error) {
      console.error('   ❌ Stealth flag validation failed:', error.message);
      return {
        passed: false,
        error: error.message,
        score: 0
      };
    }
  }

  /**
   * Validate Runtime.enable patching
   */
  async validateRuntimePatching() {
    try {
      console.log('   🔧 Validating Runtime.enable patching...');
      
      const modes = ['addBinding', 'alwaysIsolated', 'enableDisable'];
      const results = {};
      
      for (const mode of modes) {
        console.log(`     Testing ${mode} mode...`);
        
        try {
          // Set runtime patching mode
          process.env.REBROWSER_PATCHES_RUNTIME_FIX_MODE = mode;
          
          // Launch browser with specific mode
          const { launchStealthBrowser } = require('../../cdp-stealth/src/index');
          const browser = await launchStealthBrowser({ headless: true });
          const page = await browser.newPage();
          
          // Test Runtime.enable detection
          const detectionResult = await page.evaluate(() => {
            // Check for common Runtime.enable detection vectors
            return {
              hasRuntimeContext: !!window.__rebrowser_context,
              webdriverDefined: navigator.webdriver !== undefined,
              originalDescriptor: Object.getOwnPropertyDescriptor(
                Object.getPrototypeOf(navigator),
                'webdriver'
              ) !== undefined,
              runtimePatched: window.__rebrowser_patches_applied === true
            };
          });
          
          // Calculate effectiveness score
          let score = 0;
          if (!detectionResult.webdriverDefined) score += 40;
          if (detectionResult.hasRuntimeContext) score += 30;
          if (detectionResult.runtimePatched) score += 20;
          if (!detectionResult.originalDescriptor) score += 10;
          
          results[mode] = {
            success: true,
            detected: detectionResult.webdriverDefined,
            contextPresent: detectionResult.hasRuntimeContext,
            score,
            details: detectionResult
          };
          
          await browser.close();
          
          console.log(`       ${mode}: ${score}% effectiveness`);
          
        } catch (error) {
          results[mode] = {
            success: false,
            error: error.message,
            score: 0
          };
          console.log(`       ${mode}: Error - ${error.message}`);
        }
      }
      
      // Determine best mode
      const bestMode = Object.entries(results)
        .sort(([,a], [,b]) => b.score - a.score)[0];
      
      this.validationResults.runtimePatching = {
        modes: results,
        bestMode: bestMode[0],
        bestScore: bestMode[1].score,
        passed: bestMode[1].score >= 95
      };
      
      console.log(`   🏆 Best runtime mode: ${bestMode[0]} (${bestMode[1].score}% effectiveness)`);
      
      return this.validationResults.runtimePatching;
      
    } catch (error) {
      console.error('   ❌ Runtime patching validation failed:', error.message);
      return {
        passed: false,
        error: error.message,
        score: 0
      };
    }
  }

  /**
   * Validate extension functionality
   */
  async validateExtensionFunctionality() {
    try {
      console.log('   🧩 Validating extension functionality...');
      
      const extensionPath = path.join(this.projectRoot, 'extensions/cdp-stealth');
      const manifestPath = path.join(extensionPath, 'manifest.json');
      
      // Check if extension exists and is valid
      const extensionExists = fs.existsSync(manifestPath);
      let manifestValid = false;
      let extensionLoaded = false;
      let cdpFunctionality = false;
      
      if (extensionExists) {
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          manifestValid = this.validateManifest(manifest);
          
          if (manifestValid) {
            // Test loading extension
            const { launchStealthBrowser } = require('../../cdp-stealth/src/index');
            const browser = await launchStealthBrowser({ headless: true });
            const page = await browser.newPage();
            
            // Check if extension is loaded
            const extensionLoadedCheck = await page.evaluate(() => {
              return {
                chromeRuntime: !!window.chrome?.runtime,
                debuggerAPI: !!chrome?.debugger,
                tabsAPI: !!chrome?.tabs,
                storageAPI: !!chrome?.storage,
                cookiesAPI: !!chrome?.cookies
              };
            });
            
            extensionLoaded = extensionLoadedCheck.chromeRuntime;
            cdpFunctionality = extensionLoadedCheck.debuggerAPI && 
                             extensionLoadedCheck.tabsAPI;
            
            await browser.close();
          }
        } catch (error) {
          console.error('     Extension validation error:', error.message);
        }
      }
      
      // Test CDP commands through extension
      let cdpTestResults = {};
      if (extensionLoaded && cdpFunctionality) {
        cdpTestResults = await this.testCDPCommands();
      }
      
      this.validationResults.extensionTests = {
        extensionExists,
        manifestValid,
        extensionLoaded,
        cdpFunctionality,
        cdpTestResults,
        passed: extensionExists && manifestValid && extensionLoaded && cdpFunctionality
      };
      
      console.log(`     Extension exists: ${extensionExists ? '✅' : '❌'}`);
      console.log(`     Manifest valid: ${manifestValid ? '✅' : '❌'}`);
      console.log(`     Extension loaded: ${extensionLoaded ? '✅' : '❌'}`);
      console.log(`     CDP functionality: ${cdpFunctionality ? '✅' : '❌'}`);
      
      return this.validationResults.extensionTests;
      
    } catch (error) {
      console.error('   ❌ Extension functionality validation failed:', error.message);
      return {
        passed: false,
        error: error.message
      };
    }
  }

  /**
   * Validate Gmail login bypass
   */
  async validateGmailLogin(credentials, iterations = 3) {
    try {
      console.log('   📧 Validating Gmail login bypass...');
      
      const results = {
        attempts: 0,
        successes: 0,
        detections: 0,
        errors: [],
        timings: [],
        details: []
      };
      
      for (let i = 0; i < iterations; i++) {
        console.log(`     Attempt ${i + 1}/${iterations}...`);
        
        const startTime = performance.now();
        results.attempts++;
        
        try {
          const result = await this.performGmailLoginAttempt(credentials);
          const endTime = performance.now();
          
          results.timings.push((endTime - startTime) / 1000);
          results.details.push(result);
          
          if (result.success && !result.detection) {
            results.successes++;
            console.log(`       ✅ Login successful`);
          } else {
            if (result.detection) {
              results.detections++;
              console.log(`       ❌ Detection triggered`);
            } else {
              console.log(`       ❌ Login failed: ${result.error}`);
            }
          }
          
        } catch (error) {
          results.errors.push(error.message);
          console.log(`       💥 Attempt error: ${error.message}`);
        }
        
        // Wait between attempts
        if (i < iterations - 1) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
      
      // Calculate success rate
      const successRate = (results.successes / results.attempts) * 100;
      const detectionRate = (results.detections / results.attempts) * 100;
      const averageTime = results.timings.reduce((a, b) => a + b, 0) / results.timings.length;
      
      this.validationResults.gmailLogin = {
        ...results,
        successRate,
        detectionRate,
        averageTime,
        passed: successRate >= 95 && detectionRate <= 5
      };
      
      console.log(`     Success rate: ${successRate.toFixed(1)}%`);
      console.log(`     Detection rate: ${detectionRate.toFixed(1)}%`);
      console.log(`     Average time: ${averageTime.toFixed(2)}s`);
      
      return this.validationResults.gmailLogin;
      
    } catch (error) {
      console.error('   ❌ Gmail login validation failed:', error.message);
      return {
        passed: false,
        error: error.message,
        successRate: 0
      };
    }
  }

  /**
   * Perform a single Gmail login attempt
   */
  async performGmailLoginAttempt(credentials) {
    const { launchStealthBrowser } = require('../../cdp-stealth/src/index');
    const browser = await launchStealthBrowser({ headless: false });
    const page = await browser.newPage();
    
    try {
      // Navigate to Gmail login
      await page.goto('https://accounts.google.com/ServiceLogin', { 
        waitUntil: 'networkidle2' 
      });
      
      // Check for detection warnings
      const url = page.url();
      if (url.includes('unsafe') || url.includes('vibrate')) {
        await browser.close();
        return { success: false, detection: true, error: 'Detection warning page' };
      }
      
      // Enter email
      await page.waitForSelector('input[type="email"]', { timeout: 10000 });
      await page.type('input[type="email"]', credentials.email, {
        delay: 50 + Math.random() * 50
      });
      
      // Click Next
      await page.click('button:contains("Next")');
      await page.waitForSelector('input[type="password"]', { timeout: 10000 });
      
      // Enter password
      await page.type('input[type="password"]', credentials.password, {
        delay: 50 + Math.random() * 50
      });
      
      // Click Sign In
      await page.click('button:contains("Sign in")');
      
      // Wait for navigation
      await page.waitForNavigation({ timeout: 30000 });
      
      // Check final URL
      const finalUrl = page.url();
      await browser.close();
      
      if (finalUrl.includes('mail.google.com')) {
        return { success: true, detection: false, url: finalUrl };
      } else if (finalUrl.includes('unsafe')) {
        return { success: false, detection: true, error: 'Detection after login', url: finalUrl };
      } else {
        return { success: false, detection: false, error: 'Login failed', url: finalUrl };
      }
      
    } catch (error) {
      await browser.close();
      return { success: false, detection: false, error: error.message };
    }
  }

  /**
   * Validate manifest structure
   */
  validateManifest(manifest) {
    const required = ['manifest_version', 'name', 'version', 'permissions', 'background'];
    const missing = required.filter(key => !manifest[key]);
    
    if (missing.length > 0) {
      console.error(`     Missing manifest keys: ${missing.join(', ')}`);
      return false;
    }
    
    if (manifest.manifest_version !== 3) {
      console.error('     Manifest version must be 3');
      return false;
    }
    
    const requiredPermissions = ['debugger', 'storage', 'cookies', 'tabs'];
    const missingPermissions = requiredPermissions.filter(perm => 
      !manifest.permissions.includes(perm)
    );
    
    if (missingPermissions.length > 0) {
      console.error(`     Missing permissions: ${missingPermissions.join(', ')}`);
      return false;
    }
    
    return true;
  }

  /**
   * Test CDP commands through extension
   */
  async testCDPCommands() {
    try {
      const { launchStealthBrowser } = require('../../cdp-stealth/src/index');
      const browser = await launchStealthBrowser({ headless: true });
      const page = await browser.newPage();
      
      const testResults = await page.evaluate(() => {
        const results = {};
        
        // Test debugger API
        if (chrome && chrome.debugger) {
          try {
            // Test attach/detach
            results.debuggerAttach = true;
          } catch (error) {
            results.debuggerAttach = false;
          }
        }
        
        // Test tabs API
        if (chrome && chrome.tabs) {
          try {
            results.tabsQuery = true;
          } catch (error) {
            results.tabsQuery = false;
          }
        }
        
        // Test storage API
        if (chrome && chrome.storage) {
          try {
            results.storageLocal = true;
          } catch (error) {
            results.storageLocal = false;
          }
        }
        
        // Test cookies API
        if (chrome && chrome.cookies) {
          try {
            results.cookiesGet = true;
          } catch (error) {
            results.cookiesGet = false;
          }
        }
        
        return results;
      });
      
      await browser.close();
      
      return testResults;
      
    } catch (error) {
      console.error('     CDP command test failed:', error.message);
      return {};
    }
  }

  /**
   * Get comprehensive validation results
   */
  getValidationResults() {
    return this.validationResults;
  }

  /**
   * Calculate overall detection bypass score
   */
  calculateOverallScore() {
    const { stealthFlags, runtimePatching, extensionTests, gmailLogin } = this.validationResults;
    
    let totalScore = 0;
    let totalWeight = 0;
    
    // Stealth flags (30% weight)
    if (stealthFlags.score) {
      totalScore += stealthFlags.score * 0.3;
      totalWeight += 0.3;
    }
    
    // Runtime patching (25% weight)
    if (runtimePatching.bestScore) {
      totalScore += runtimePatching.bestScore * 0.25;
      totalWeight += 0.25;
    }
    
    // Extension functionality (20% weight)
    if (extensionTests.passed !== undefined) {
      const extensionScore = extensionTests.passed ? 100 : 0;
      totalScore += extensionScore * 0.2;
      totalWeight += 0.2;
    }
    
    // Gmail login (25% weight)
    if (gmailLogin.successRate !== undefined) {
      totalScore += gmailLogin.successRate * 0.25;
      totalWeight += 0.25;
    }
    
    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  /**
   * Generate validation report
   */
  generateReport() {
    const overallScore = this.calculateOverallScore();
    
    return {
      timestamp: new Date().toISOString(),
      overallScore,
      passed: overallScore >= 95,
      results: this.validationResults,
      recommendations: this.generateRecommendations()
    };
  }

  /**
   * Generate recommendations based on validation results
   */
  generateRecommendations() {
    const recommendations = [];
    const { stealthFlags, runtimePatching, extensionTests, gmailLogin } = this.validationResults;
    
    if (stealthFlags.score < 95) {
      const failedChecks = Object.entries(stealthFlags.checks)
        .filter(([, check]) => !check.passed)
        .map(([name]) => name);
      
      recommendations.push({
        priority: 'HIGH',
        category: 'Stealth Flags',
        description: `Failed stealth checks: ${failedChecks.join(', ')}`,
        action: 'Review and update Chrome launch flags'
      });
    }
    
    if (runtimePatching.bestScore < 95) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Runtime Patching',
        description: `Runtime patching effectiveness: ${runtimePatching.bestScore}%`,
        action: 'Ensure rebrowser-patches is properly installed and configured'
      });
    }
    
    if (!extensionTests.passed) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Extension',
        description: 'CDP stealth extension is not working properly',
        action: 'Verify extension manifest and background service worker'
      });
    }
    
    if (gmailLogin.successRate < 95) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Gmail Login',
        description: `Gmail login success rate: ${gmailLogin.successRate.toFixed(1)}%`,
        action: 'Investigate detection patterns and adjust stealth configuration'
      });
    }
    
    return recommendations;
  }
}

module.exports = DetectionValidator;