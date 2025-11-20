/**
 * CDP Stealth Module
 * 
 * This is the main module for launching and controlling a stealth Chrome browser
 * using the Chrome DevTools Protocol (CDP) with advanced anti-detection techniques.
 * 
 * Key Features:
 * - Runtime.enable patching (Mode 1: addBinding)
 * - Extension-based control (no exposed debugging ports)
 * - Comprehensive stealth flags
 * - Error handling and validation
 */

const puppeteer = require('rebrowser-puppeteer');
const { getConfig, validateConfig } = require('./config/environment');
const fs = require('fs');
const path = require('path');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'cdp-stealth' },
  transports: [
    new winston.transports.File({ filename: 'debug/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'debug/combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

/**
 * Launch a stealth browser instance
 * 
 * @param {Object} options - Configuration options
 * @param {boolean} options.headless - Whether to run in headless mode (not recommended for stealth)
 * @param {string} options.proxy - Proxy server to use
 * @param {string} options.userAgent - Custom user agent
 * @param {string} options.windowSize - Window size (default: '1366,768')
 * @param {Object} options.stealth - Stealth configuration overrides
 * @returns {Promise<Object>} Browser instance with additional methods
 */
async function launchStealthBrowser(options = {}) {
  try {
    // Get configuration
    const config = getConfig(options);
    
    // Validate configuration
    const validation = validateConfig(config);
    if (!validation.isValid) {
      throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
    }
    
    logger.info('Launching stealth browser with configuration', { 
      chrome: config.chrome.executable,
      argsCount: config.chrome.args.length,
      runtimePatchingMode: config.stealth.runtimePatchingMode
    });
    
    // Set runtime patching mode
    process.env.REBROWSER_PATCHES_RUNTIME_FIX_MODE = config.stealth.runtimePatchingMode;
    
    // Launch browser with stealth configuration
    const browser = await puppeteer.launch({
      executablePath: config.chrome.executable,
      args: config.chrome.args,
      headless: options.headless || false,
      ignoreHTTPSErrors: true,
      defaultViewport: null,
      timeout: 30000
    });
    
    // Add stealth methods to browser instance
    browser.stealth = {
      config,
      
      // Method to get the current stealth status
      async getStatus() {
        const pages = await browser.pages();
        if (pages.length === 0) {
          return { error: 'No pages available' };
        }
        
        const page = pages[0];
        
        return await page.evaluate(() => {
          return {
            navigator: {
              webdriver: navigator.webdriver,
              plugins: navigator.plugins.length,
              languages: navigator.languages,
              platform: navigator.platform,
              userAgent: navigator.userAgent
            },
            chrome: {
              runtime: typeof chrome !== 'undefined' ? {
                id: chrome.runtime?.id,
                onConnect: typeof chrome?.onConnect !== 'undefined'
              } : null
            },
            webdriver: {
              present: typeof window.webdriver !== 'undefined'
            }
          };
        });
      },
      
      // Method to take a stealth verification screenshot
      async takeVerificationScreenshot(outputPath) {
        const pages = await browser.pages();
        if (pages.length === 0) {
          throw new Error('No pages available for screenshot');
        }
        
        const page = pages[0];
        const defaultPath = path.join(config.paths.debugDir, `stealth-verification-${Date.now()}.png`);
        const screenshotPath = outputPath || defaultPath;
        
        await page.screenshot({ 
          path: screenshotPath, 
          fullPage: true 
        });
        
        logger.info('Stealth verification screenshot taken', { path: screenshotPath });
        return screenshotPath;
      }
    };
    
    // Set up browser event handlers
    browser.on('disconnected', () => {
      logger.info('Browser disconnected');
    });
    
    // Create a new page with stealth enhancements
    const originalNewPage = browser.newPage.bind(browser);
    browser.newPage = async function() {
      const page = await originalNewPage();
      
      // Set up stealth page handlers
      await setupStealthPage(page, config);
      
      return page;
    };
    
    logger.info('Stealth browser launched successfully');
    return browser;
    
  } catch (error) {
    logger.error('Failed to launch stealth browser', { 
      error: error.message, 
      stack: error.stack 
    });
    throw error;
  }
}

/**
 * Set up stealth enhancements for a page
 * 
 * @param {Page} page - Puppeteer page instance
 * @param {Object} config - Configuration object
 */
async function setupStealthPage(page, config) {
  // Set up request interception for debugging
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    // Allow all requests but log for debugging
    const url = request.url();
    const resourceType = request.resourceType();
    
    if (config.environment.isDevelopment) {
      logger.debug('Page request', { url, resourceType });
    }
    
    request.continue();
  });
  
  // Inject additional stealth scripts
  await page.evaluateOnNewDocument(() => {
    // CRITICAL: Remove navigator.webdriver completely
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
      configurable: true
    });
    
    // Override permissions API
    if (navigator.permissions) {
      const originalQuery = navigator.permissions.query;
      navigator.permissions.query = function(parameters) {
        // Always return granted for common permissions to avoid prompts
        if (parameters.name === 'notifications') {
          return Promise.resolve({ state: 'granted' });
        }
        return originalQuery(parameters);
      };
    }
    
    // Override WebGL vendor/renderer to avoid fingerprinting
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter) {
      if (parameter === 37445) {
        return 'Intel Inc.';
      }
      if (parameter === 37446) {
        return 'Intel Iris OpenGL Engine';
      }
      return getParameter(parameter);
    };
    
    // CRITICAL: Override chrome.runtime if it exists
    if (window.chrome && window.chrome.runtime) {
      Object.defineProperty(window.chrome.runtime, 'id', {
        get: function() {
          return undefined;
        },
        configurable: true
      });
      
      // Also override the entire runtime object if needed
      if (window.chrome.runtime.id === null) {
        Object.defineProperty(window.chrome.runtime, 'id', {
          value: undefined,
          writable: false,
          configurable: true
        });
      }
    }
    
    // Additional stealth: Remove webdriver from window object
    if (window.webdriver !== undefined) {
      delete window.webdriver;
    }
    
    // Prevent future access to webdriver
    Object.defineProperty(window, 'webdriver', {
      get: () => undefined,
      configurable: true
    });
  });
  
  // Set up page error handler
  page.on('error', (error) => {
    logger.error('Page error', { error: error.message });
  });
  
  page.on('pageerror', (error) => {
    logger.error('Page JavaScript error', { error: error.message });
  });
}

/**
 * Create a new page with stealth enhancements
 * 
 * @param {Browser} browser - Browser instance
 * @param {Object} options - Page options
 * @returns {Promise<Page>} Enhanced page instance
 */
async function createStealthPage(browser, options = {}) {
  const page = await browser.newPage();
  
  // Set additional stealth options
  if (options.userAgent) {
    await page.setUserAgent(options.userAgent);
  }
  
  if (options.viewport) {
    await page.setViewport(options.viewport);
  }
  
  // Add stealth methods to page
  page.stealth = {
    // Method to wait for human-like time
    async waitHumanTime(minMs = 100, maxMs = 300) {
      const waitTime = Math.random() * (maxMs - minMs) + minMs;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    },
    
    // Method to type like a human
    async humanType(selector, text, options = {}) {
      await page.focus(selector);
      await page.stealth.waitHumanTime();
      
      for (let i = 0; i < text.length; i++) {
        await page.keyboard.type(text[i]);
        await page.stealth.waitHumanTime(50, 150);
      }
    },
    
    // Method to click like a human
    async humanClick(selector, options = {}) {
      const element = await page.$(selector);
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }
      
      const rect = await element.boundingBox();
      if (!rect) {
        throw new Error(`Could not get bounding box for: ${selector}`);
      }
      
      // Add some randomness to the click position
      const x = rect.x + rect.width / 2 + (Math.random() - 0.5) * 10;
      const y = rect.y + rect.height / 2 + (Math.random() - 0.5) * 10;
      
      await page.mouse.move(x, y);
      await page.stealth.waitHumanTime(50, 150);
      await page.mouse.click(x, y);
    }
  };
  
  return page;
}

/**
 * Verify stealth implementation
 * 
 * @param {Browser} browser - Browser instance to verify
 * @returns {Promise<Object>} Verification results
 */
async function verifyStealth(browser) {
  if (!browser.stealth) {
    throw new Error('Browser does not have stealth capabilities');
  }
  
  logger.info('Verifying stealth implementation');
  
  const status = await browser.stealth.getStatus();
  const results = {
    passed: true,
    checks: {
      webdriver: {
        name: 'navigator.webdriver',
        expected: undefined,
        actual: status.navigator.webdriver,
        passed: status.navigator.webdriver === undefined
      },
      chromeRuntime: {
        name: 'chrome.runtime.id',
        expected: undefined,
        actual: status.chrome?.runtime?.id,
        passed: status.chrome?.runtime?.id === undefined
      },
      windowWebdriver: {
        name: 'window.webdriver',
        expected: undefined,
        actual: status.webdriver?.present,
        passed: !status.webdriver?.present
      }
    }
  };
  
  // Overall result
  results.passed = Object.values(results.checks).every(check => check.passed);
  
  logger.info('Stealth verification completed', { 
    passed: results.passed,
    checks: Object.keys(results.checks).length 
  });
  
  return results;
}

module.exports = {
  launchStealthBrowser,
  createStealthPage,
  verifyStealth,
  setupStealthPage,
  logger
};