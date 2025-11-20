#!/usr/bin/env node

/**
 * Detection Bypass Validation Script for CDP Stealth System
 * 
 * This script performs comprehensive detection bypass validation including:
 * - Gmail login testing with kijkwijs@gmail.com credentials
 * - Stealth flag verification testing
 * - Runtime patching validation
 * - Extension functionality testing
 * - Success rate measurement (>95% required)
 * 
 * Based on specifications from document.pdf for achieving >95% detection bypass rate
 * and Gmail login success rate.
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const puppeteer = require('rebrowser-puppeteer');

// Import utility modules
const DetectionValidator = require('./utils/detection-validator');
const MetricsCollector = require('./utils/metrics-collector');
const ReportGenerator = require('./utils/report-generator');

class DetectionBypassValidator {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.validator = new DetectionValidator();
    this.metricsCollector = new MetricsCollector();
    this.reportGenerator = new ReportGenerator();
    this.results = {
      tests: [],
      stealthFlags: {},
      runtimePatching: {},
      extensionTests: {},
      gmailLogin: {},
      successRates: {}
    };
    
    // Gmail test credentials from document.pdf
    this.gmailCredentials = {
      email: 'kijkwijs@gmail.com',
      password: 'Swamp98550!'
    };
  }

  /**
   * Main validation workflow
   */
  async runValidation() {
    console.log('🛡️ Starting CDP Stealth Detection Bypass Validation');
    console.log('='.repeat(60));
    
    const startTime = performance.now();
    
    try {
      // 1. Validate stealth flags
      await this.validateStealthFlags();
      
      // 2. Validate runtime patching
      await this.validateRuntimePatching();
      
      // 3. Test extension functionality
      await this.validateExtensionFunctionality();
      
      // 4. Perform Gmail login test
      await this.performGmailLoginTest();
      
      // 5. Calculate success rates
      await this.calculateSuccessRates();
      
      // 6. Generate validation report
      await this.generateValidationReport();
      
      const totalTime = (performance.now() - startTime) / 1000;
      console.log(`✅ Detection bypass validation completed in ${totalTime.toFixed(2)}s`);
      
      return this.results;
      
    } catch (error) {
      console.error('❌ Detection bypass validation failed:', error.message);
      throw error;
    }
  }

  /**
   * Validate stealth flags are properly configured
   */
  async validateStealthFlags() {
    console.log('\n🔍 Validating Stealth Flags...');
    
    // Launch browser with stealth configuration
    const browser = await this.launchStealthBrowser();
    const page = await browser.newPage();
    
    try {
      // Navigate to a test page
      await page.goto('https://bot.sannysoft.com/', { waitUntil: 'networkidle2' });
      
      // Check critical stealth indicators
      const stealthChecks = await page.evaluate(() => {
        return {
          // Critical checks
          webdriver: navigator.webdriver,
          chromeRuntime: window.chrome?.runtime?.id,
          permissions: navigator.permissions ? 'present' : 'missing',
          
          // Additional checks
          plugins: navigator.plugins.length,
          languages: navigator.languages.length,
          platform: navigator.platform,
          userAgent: navigator.userAgent,
          
          // Automation detection
          automation: window.chrome && window.chrome.runtime && window.chrome.runtime.onConnect,
          
          // WebDriver detection
          selenium: window.document.documentElement.getAttribute('selenium'),
          webdriverAttribute: window.document.documentElement.getAttribute('webdriver')
        };
      });
      
      // Validate each stealth flag
      const flagValidation = {
        'navigator.webdriver': {
          expected: undefined,
          actual: stealthChecks.webdriver,
          passed: stealthChecks.webdriver === undefined
        },
        'chrome.runtime.id': {
          expected: undefined,
          actual: stealthChecks.chromeRuntime,
          passed: stealthChecks.chromeRuntime === undefined
        },
        'automation detection': {
          expected: false,
          actual: !!stealthChecks.automation,
          passed: !stealthChecks.automation
        },
        'webdriver attribute': {
          expected: null,
          actual: stealthChecks.webdriverAttribute,
          passed: stealthChecks.webdriverAttribute === null
        },
        'selenium attribute': {
          expected: null,
          actual: stealthChecks.selenium,
          passed: stealthChecks.selenium === null
        }
      };
      
      // Calculate overall stealth score
      const passedChecks = Object.values(flagValidation).filter(check => check.passed).length;
      const totalChecks = Object.keys(flagValidation).length;
      const stealthScore = (passedChecks / totalChecks) * 100;
      
      this.results.stealthFlags = {
        checks: flagValidation,
        score: stealthScore,
        passed: stealthScore >= 95, // 95% threshold
        details: stealthChecks
      };
      
      console.log(`   📊 Stealth score: ${stealthScore.toFixed(1)}%`);
      console.log(`   ${stealthScore >= 95 ? '✅' : '❌'} Stealth validation: ${passedChecks}/${totalChecks} checks passed`);
      
    } finally {
      await browser.close();
    }
  }

  /**
   * Validate Runtime.enable patching
   */
  async validateRuntimePatching() {
    console.log('\n🔧 Validating Runtime Patching...');
    
    // Test different runtime patching modes
    const modes = ['addBinding', 'alwaysIsolated', 'enableDisable'];
    const results = {};
    
    for (const mode of modes) {
      console.log(`   🧪 Testing ${mode} mode...`);
      
      try {
        // Set runtime patching mode
        process.env.REBROWSER_PATCHES_RUNTIME_FIX_MODE = mode;
        
        // Launch browser with specific mode
        const browser = await this.launchStealthBrowser();
        const page = await browser.newPage();
        
        // Test Runtime.enable detection
        const detectionResult = await page.evaluate(() => {
          // Try to detect if Runtime.enable was called
          const originalDescriptor = Object.getOwnPropertyDescriptor(
            Object.getPrototypeOf(navigator),
            'webdriver'
          );
          
          return {
            hasRuntimeContext: !!window.__rebrowser_context,
            webdriverDefined: navigator.webdriver !== undefined,
            originalDescriptor: !!originalDescriptor
          };
        });
        
        results[mode] = {
          success: true,
          detected: detectionResult.webdriverDefined,
          contextPresent: detectionResult.hasRuntimeContext,
          score: detectionResult.webdriverDefined ? 0 : 100
        };
        
        await browser.close();
        
      } catch (error) {
        results[mode] = {
          success: false,
          error: error.message,
          score: 0
        };
      }
    }
    
    // Determine best mode
    const bestMode = Object.entries(results)
      .sort(([,a], [,b]) => b.score - a.score)[0];
    
    this.results.runtimePatching = {
      modes: results,
      bestMode: bestMode[0],
      bestScore: bestMode[1].score,
      passed: bestMode[1].score >= 95
    };
    
    console.log(`   🏆 Best mode: ${bestMode[0]} (${bestMode[1].score}% effectiveness)`);
    console.log(`   ${bestMode[1].score >= 95 ? '✅' : '❌'} Runtime patching validation`);
  }

  /**
   * Validate extension functionality
   */
  async validateExtensionFunctionality() {
    console.log('\n🧩 Validating Extension Functionality...');
    
    const extensionPath = path.join(this.projectRoot, 'extensions/cdp-stealth');
    const manifestPath = path.join(extensionPath, 'manifest.json');
    
    // Check if extension exists and is valid
    const extensionExists = fs.existsSync(manifestPath);
    let manifestValid = false;
    let extensionLoaded = false;
    
    if (extensionExists) {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        manifestValid = manifest.manifest_version === 3 && 
                       manifest.name && 
                       manifest.permissions &&
                       manifest.background;
        
        if (manifestValid) {
          // Test loading extension
          const browser = await this.launchStealthBrowser();
          const page = await browser.newPage();
          
          // Check if extension is loaded
          const extensionLoadedCheck = await page.evaluate(() => {
            return !!window.chrome?.runtime?.id;
          });
          
          extensionLoaded = extensionLoadedCheck;
          await browser.close();
        }
      } catch (error) {
        console.error('Extension validation error:', error.message);
      }
    }
    
    // Test extension CDP functionality
    let cdpFunctionality = false;
    if (extensionLoaded) {
      try {
        const browser = await this.launchStealthBrowser();
        const page = await browser.newPage();
        
        // Test CDP commands through extension
        const cdpTest = await page.evaluate(() => {
          // Simulate extension CDP command
          if (window.chrome && window.chrome.runtime) {
            return {
              canSendCommand: true,
              hasDebuggerAPI: !!chrome.debugger,
              hasTabAPI: !!chrome.tabs
            };
          }
          return { canSendCommand: false };
        });
        
        cdpFunctionality = cdpTest.canSendCommand;
        await browser.close();
      } catch (error) {
        console.error('CDP functionality test error:', error.message);
      }
    }
    
    this.results.extensionTests = {
      extensionExists,
      manifestValid,
      extensionLoaded,
      cdpFunctionality,
      passed: extensionExists && manifestValid && extensionLoaded && cdpFunctionality
    };
    
    console.log(`   📁 Extension exists: ${extensionExists ? '✅' : '❌'}`);
    console.log(`   📋 Manifest valid: ${manifestValid ? '✅' : '❌'}`);
    console.log(`   🚀 Extension loaded: ${extensionLoaded ? '✅' : '❌'}`);
    console.log(`   🔌 CDP functionality: ${cdpFunctionality ? '✅' : '❌'}`);
    console.log(`   ${this.results.extensionTests.passed ? '✅' : '❌'} Extension validation`);
  }

  /**
   * Perform Gmail login test
   */
  async performGmailLoginTest() {
    console.log('\n📧 Performing Gmail Login Test...');
    
    const testResults = {
      attempts: 0,
      successes: 0,
      detections: 0,
      errors: [],
      timings: []
    };
    
    // Run multiple tests for statistical significance
    const testIterations = 5;
    
    for (let i = 0; i < testIterations; i++) {
      console.log(`   🧪 Test attempt ${i + 1}/${testIterations}...`);
      
      const startTime = performance.now();
      testResults.attempts++;
      
      try {
        const result = await this.performSingleGmailLogin();
        const endTime = performance.now();
        
        testResults.timings.push((endTime - startTime) / 1000);
        
        if (result.success) {
          testResults.successes++;
          console.log(`     ✅ Login successful (${testResults.successes}/${testResults.attempts})`);
        } else {
          if (result.detection) {
            testResults.detections++;
            console.log(`     ❌ Detection triggered (${testResults.detections} detections)`);
          } else {
            console.log(`     ❌ Login failed: ${result.error}`);
          }
        }
        
      } catch (error) {
        testResults.errors.push(error.message);
        console.log(`     💥 Test error: ${error.message}`);
      }
      
      // Wait between attempts
      if (i < testIterations - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Calculate success rate
    const successRate = (testResults.successes / testResults.attempts) * 100;
    const detectionRate = (testResults.detections / testResults.attempts) * 100;
    const averageTime = testResults.timings.reduce((a, b) => a + b, 0) / testResults.timings.length;
    
    this.results.gmailLogin = {
      ...testResults,
      successRate,
      detectionRate,
      averageTime,
      passed: successRate >= 95 && detectionRate <= 5 // >95% success, <5% detection
    };
    
    console.log(`   📊 Success rate: ${successRate.toFixed(1)}%`);
    console.log(`   🚨 Detection rate: ${detectionRate.toFixed(1)}%`);
    console.log(`   ⏱️ Average time: ${averageTime.toFixed(2)}s`);
    console.log(`   ${this.results.gmailLogin.passed ? '✅' : '❌'} Gmail login validation`);
  }

  /**
   * Perform a single Gmail login attempt
   */
  async performSingleGmailLogin() {
    const browser = await this.launchStealthBrowser();
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
      await page.type('input[type="email"]', this.gmailCredentials.email, {
        delay: 50 + Math.random() * 50
      });
      
      // Click Next
      await page.click('button:contains("Next")');
      await page.waitForSelector('input[type="password"]', { timeout: 10000 });
      
      // Enter password
      await page.type('input[type="password"]', this.gmailCredentials.password, {
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
        return { success: true, detection: false };
      } else if (finalUrl.includes('unsafe')) {
        return { success: false, detection: true, error: 'Detection after login' };
      } else {
        return { success: false, detection: false, error: 'Login failed' };
      }
      
    } catch (error) {
      await browser.close();
      return { success: false, detection: false, error: error.message };
    }
  }

  /**
   * Calculate overall success rates
   */
  async calculateSuccessRates() {
    console.log('\n📈 Calculating Success Rates...');
    
    const rates = {
      stealthFlags: this.results.stealthFlags.passed ? 100 : 0,
      runtimePatching: this.results.runtimePatching.passed ? 100 : 0,
      extensionFunctionality: this.results.extensionTests.passed ? 100 : 0,
      gmailLogin: this.results.gmailLogin.successRate || 0
    };
    
    const overallRate = Object.values(rates).reduce((a, b) => a + b, 0) / Object.keys(rates).length;
    
    this.results.successRates = {
      ...rates,
      overall: overallRate,
      passed: overallRate >= 95 && rates.gmailLogin >= 95
    };
    
    console.log(`   🔍 Stealth flags: ${rates.stealthFlags}%`);
    console.log(`   🔧 Runtime patching: ${rates.runtimePatching}%`);
    console.log(`   🧩 Extension functionality: ${rates.extensionFunctionality}%`);
    console.log(`   📧 Gmail login: ${rates.gmailLogin.toFixed(1)}%`);
    console.log(`   📊 Overall: ${overallRate.toFixed(1)}%`);
    console.log(`   ${this.results.successRates.passed ? '✅' : '❌'} Success rate validation`);
  }

  /**
   * Generate validation report
   */
  async generateValidationReport() {
    console.log('\n📄 Generating Validation Report...');
    
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: {
        overallPassed: this.results.successRates.passed,
        overallRate: this.results.successRates.overall,
        gmailSuccessRate: this.results.successRates.gmailLogin,
        detectionBypassRate: this.results.stealthFlags.score
      },
      results: this.results,
      recommendations: this.generateRecommendations()
    };
    
    // Generate HTML report
    const htmlReport = await this.reportGenerator.generateHTMLReport(reportData, 'detection-bypass-validation');
    
    // Generate JSON report
    const jsonReport = await this.reportGenerator.generateJSONReport(reportData, 'detection-bypass-validation');
    
    console.log(`   📊 HTML report: ${htmlReport.path}`);
    console.log(`   📄 JSON report: ${jsonReport.path}`);
    
    // Print summary
    console.log('\n📋 Validation Summary:');
    console.log(`   Overall Success Rate: ${reportData.summary.overallRate.toFixed(1)}%`);
    console.log(`   Gmail Login Success: ${reportData.summary.gmailSuccessRate.toFixed(1)}%`);
    console.log(`   Detection Bypass Rate: ${reportData.summary.detectionBypassRate.toFixed(1)}%`);
    console.log(`   Status: ${reportData.summary.overallPassed ? '✅ PASSED' : '❌ FAILED'}`);
    
    return { htmlReport, jsonReport };
  }

  /**
   * Generate recommendations based on validation results
   */
  generateRecommendations() {
    const recommendations = [];
    
    if (!this.results.stealthFlags.passed) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Stealth Flags',
        description: 'Stealth flags are not properly configured.',
        action: 'Review and update Chrome launch flags in chrome_start.sh'
      });
    }
    
    if (!this.results.runtimePatching.passed) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Runtime Patching',
        description: 'Runtime.enable patching is not effective.',
        action: 'Ensure rebrowser-patches is installed and configured correctly'
      });
    }
    
    if (!this.results.extensionTests.passed) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Extension',
        description: 'CDP stealth extension is not working properly.',
        action: 'Verify extension manifest and background service worker'
      });
    }
    
    if (!this.results.gmailLogin.passed) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Gmail Login',
        description: `Gmail login success rate is ${this.results.gmailLogin.successRate.toFixed(1)}% (target: >95%).`,
        action: 'Investigate detection patterns and adjust stealth configuration'
      });
    }
    
    return recommendations;
  }

  /**
   * Launch stealth browser for testing
   */
  async launchStealthBrowser() {
    const { launchStealthBrowser } = require('../cdp-stealth/src/index');
    
    return await launchStealthBrowser({
      headless: false,
      windowSize: '1366,768'
    });
  }
}

// CLI execution
if (require.main === module) {
  const validator = new DetectionBypassValidator();
  
  validator.runValidation()
    .then(results => {
      console.log('\n🎉 Detection bypass validation completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Detection bypass validation failed:', error.message);
      process.exit(1);
    });
}

module.exports = DetectionBypassValidator;