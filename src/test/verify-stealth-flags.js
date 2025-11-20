#!/usr/bin/env node

/**
 * Stealth Flags Verification Script
 * 
 * This script tests whether the Chrome browser is properly configured with
 * stealth flags to bypass automation detection. It checks for the most common
 * detection vectors and provides clear pass/fail results.
 * 
 * Usage: node src/test/verify-stealth-flags.js
 */

const { launchStealthBrowser, verifyStealth } = require('../../cdp-stealth/src/index');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Test results
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  details: []
};

/**
 * Print a test result with color
 */
function printResult(name, passed, details = '') {
  const status = passed ? 
    `${colors.green}PASS${colors.reset}` : 
    `${colors.red}FAIL${colors.reset}`;
  
  console.log(`  ${status} ${name}`);
  if (details) {
    console.log(`       ${colors.gray}${details}${colors.reset}`);
  }
  
  testResults.total++;
  if (passed) {
    testResults.passed++;
  } else {
    testResults.failed++;
  }
  
  testResults.details.push({ name, passed, details });
}

/**
 * Test for navigator.webdriver being undefined
 */
async function testNavigatorWebdriver(page) {
  const result = await page.evaluate(() => {
    return {
      webdriver: navigator.webdriver,
      hasWebdriver: 'webdriver' in navigator,
      descriptor: Object.getOwnPropertyDescriptor(navigator, 'webdriver')
    };
  });
  
  // Check if webdriver is undefined (the desired state)
  const passed = result.webdriver === undefined;
  const details = `navigator.webdriver is ${result.webdriver}`;
  
  printResult('navigator.webdriver is undefined', passed, details);
  return passed;
}

/**
 * Test for automation switches not being present
 */
async function testAutomationSwitches(page) {
  const result = await page.evaluate(() => {
    // Check for common automation indicators in navigator.plugins
    const plugins = Array.from(navigator.plugins).map(p => p.name);
    const hasAutomationPlugin = plugins.some(p => 
      p.toLowerCase().includes('automation') || 
      p.toLowerCase().includes('chrome remote')
    );
    
    // Check for automation-related command line switches
    const hasAutomationSwitches = !!(window.chrome && window.chrome.runtime && window.chrome.runtime.onConnect);
    
    return {
      plugins,
      hasAutomationPlugin,
      hasAutomationSwitches
    };
  });
  
  const passed = !result.hasAutomationPlugin && !result.hasAutomationSwitches;
  const details = passed ? 
    'No automation indicators found' : 
    `Found automation indicators: ${result.hasAutomationPlugin ? 'plugins' : ''}${result.hasAutomationSwitches ? ' switches' : ''}`;
  
  printResult('No automation switches present', passed, details);
  return passed;
}

/**
 * Test for chrome.runtime.id being undefined
 */
async function testChromeRuntimeId(page) {
  const result = await page.evaluate(() => {
    if (typeof chrome === 'undefined') {
      return { hasChrome: false, runtimeId: null };
    }
    
    return {
      hasChrome: true,
      runtimeId: chrome.runtime ? chrome.runtime.id : null,
      hasRuntime: !!chrome.runtime
    };
  });
  
  // Check if chrome.runtime.id is undefined or null (both indicate no extension)
  const passed = !result.hasChrome || result.runtimeId === undefined || result.runtimeId === null;
  const details = result.hasChrome ?
    `chrome.runtime.id is ${result.runtimeId}` :
    'chrome object is not present';
  
  printResult('chrome.runtime.id is undefined', passed, details);
  return passed;
}

/**
 * Test for window.webdriver being undefined
 */
async function testWindowWebdriver(page) {
  const result = await page.evaluate(() => {
    return {
      webdriver: window.webdriver,
      hasWebdriver: 'webdriver' in window
    };
  });
  
  // Check if window.webdriver is undefined (the desired state)
  const passed = result.webdriver === undefined;
  const details = `window.webdriver is ${result.webdriver}`;
  
  printResult('window.webdriver is undefined', passed, details);
  return passed;
}

/**
 * Test for permissions API behavior
 */
async function testPermissionsAPI(page) {
  const result = await page.evaluate(async () => {
    if (!navigator.permissions) {
      return { hasPermissions: false };
    }
    
    try {
      const notificationPermission = await navigator.permissions.query({ name: 'notifications' });
      return {
        hasPermissions: true,
        notificationState: notificationPermission.state
      };
    } catch (error) {
      return {
        hasPermissions: true,
        error: error.message
      };
    }
  });
  
  const passed = !result.hasPermissions || result.notificationState === 'granted';
  const details = passed ? 
    result.hasPermissions ? 
      `Permissions API behaves normally (${result.notificationState})` : 
      'Permissions API not present' :
    `Permissions API behavior suspicious: ${result.error || result.notificationState}`;
  
  printResult('Permissions API behavior', passed, details);
  return passed;
}

/**
 * Test for WebGL fingerprinting protection
 */
async function testWebGLFingerprinting(page) {
  const result = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (!gl) {
      return { hasWebGL: false };
    }
    
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) {
      return { hasWebGL: true, hasDebugInfo: false };
    }
    
    return {
      hasWebGL: true,
      hasDebugInfo: true,
      vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
      renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
    };
  });
  
  const passed = !result.hasWebGL || 
    (result.vendor === 'Intel Inc.' && result.renderer.includes('Intel'));
  
  const details = passed ? 
    result.hasWebGL ? 
      `WebGL fingerprinting protected (${result.vendor}, ${result.renderer})` : 
      'WebGL not available' :
    `WebGL fingerprinting not protected: ${result.vendor}, ${result.renderer}`;
  
  printResult('WebGL fingerprinting protection', passed, details);
  return passed;
}

/**
 * Test for user agent consistency
 */
async function testUserAgent(page) {
  const result = await page.evaluate(() => {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      vendor: navigator.vendor
    };
  });
  
  // Check if user agent contains HeadlessChrome
  const hasHeadless = result.userAgent.includes('HeadlessChrome');
  
  // Check if platform is consistent with user agent
  const platformConsistent = 
    (result.userAgent.includes('Windows') && result.platform.includes('Win')) ||
    (result.userAgent.includes('Mac') && result.platform.includes('Mac')) ||
    (result.userAgent.includes('Linux') && result.platform.includes('Linux'));
  
  const passed = !hasHeadless && platformConsistent;
  const details = passed ? 
    `User agent appears normal: ${result.userAgent.substring(0, 50)}...` : 
    hasHeadless ? 
      'User agent contains HeadlessChrome' :
      `Platform inconsistency: ${result.platform} vs ${result.userAgent}`;
  
  printResult('User agent consistency', passed, details);
  return passed;
}

/**
 * Save test results to a file
 */
function saveResults(results) {
  const resultsDir = path.join(process.cwd(), 'debug');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  
  const resultsFile = path.join(resultsDir, `stealth-verification-${Date.now()}.json`);
  fs.writeFileSync(resultsFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      total: results.total,
      passed: results.passed,
      failed: results.failed,
      successRate: `${Math.round((results.passed / results.total) * 100)}%`
    },
    details: results.details
  }, null, 2));
  
  console.log(`\n${colors.blue}Detailed results saved to:${colors.reset} ${resultsFile}`);
}

/**
 * Main verification function
 */
async function runVerification() {
  console.log(`${colors.cyan}
╔══════════════════════════════════════════════════════════════╗
║                Chrome Stealth Verification                 ║
╚══════════════════════════════════════════════════════════════╝
${colors.reset}`);
  
  console.log(`${colors.yellow}Launching stealth browser...${colors.reset}\n`);
  
  let browser;
  let page;
  
  try {
    // Launch stealth browser
    browser = await launchStealthBrowser({
      headless: false
    });
    
    // Create a new page
    page = await browser.newPage();
    
    // Navigate to a blank page to avoid external factors
    await page.goto('about:blank');
    
    console.log(`${colors.yellow}Running stealth verification tests...${colors.reset}\n`);
    
    // Run all tests
    await testNavigatorWebdriver(page);
    await testAutomationSwitches(page);
    await testChromeRuntimeId(page);
    await testWindowWebdriver(page);
    await testPermissionsAPI(page);
    await testWebGLFingerprinting(page);
    await testUserAgent(page);
    
    // Print summary
    const successRate = Math.round((testResults.passed / testResults.total) * 100);
    const allPassed = testResults.failed === 0;
    
    console.log(`\n${colors.cyan}
╔══════════════════════════════════════════════════════════════╗
║                      Test Summary                           ║
╚══════════════════════════════════════════════════════════════╝
${colors.reset}`);
    
    console.log(`Total Tests: ${testResults.total}`);
    console.log(`Passed: ${colors.green}${testResults.passed}${colors.reset}`);
    console.log(`Failed: ${colors.red}${testResults.failed}${colors.reset}`);
    console.log(`Success Rate: ${successRate}%\n`);
    
    if (allPassed) {
      console.log(`${colors.green}✅ ALL TESTS PASSED - Browser is properly configured for stealth!${colors.reset}`);
    } else {
      console.log(`${colors.red}❌ SOME TESTS FAILED - Browser may be detectable!${colors.reset}`);
      console.log(`${colors.yellow}Review the failed tests above and adjust your configuration.${colors.reset}`);
    }
    
    // Save results
    saveResults(testResults);
    
    // Take a verification screenshot
    const screenshotPath = await browser.stealth.takeVerificationScreenshot();
    console.log(`\n${colors.blue}Verification screenshot saved to:${colors.reset} ${screenshotPath}`);
    
  } catch (error) {
    console.error(`${colors.red}Error during verification:${colors.reset}`, error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (page) {
      await page.close();
    }
    if (browser) {
      await browser.close();
    }
  }
  
  // Exit with appropriate code
  process.exit(testResults.failed === 0 ? 0 : 1);
}

// Run verification if this script is executed directly
if (require.main === module) {
  runVerification().catch(error => {
    console.error(`${colors.red}Unhandled error:${colors.reset}`, error);
    process.exit(1);
  });
}

module.exports = {
  runVerification,
  testNavigatorWebdriver,
  testAutomationSwitches,
  testChromeRuntimeId,
  testWindowWebdriver,
  testPermissionsAPI,
  testWebGLFingerprinting,
  testUserAgent
};