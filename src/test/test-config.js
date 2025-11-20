const path = require('path');
const os = require('os');

// Test configuration based on document.pdf specifications
const testConfig = {
  // Gmail test credentials from document.pdf
  gmail: {
    email: 'kijkwijs@gmail.com',
    password: 'Swamp98550!',
    url: 'https://accounts.google.com/ServiceLogin',
    successUrl: 'https://mail.google.com',
    timeout: 30000, // 30 seconds max as per document
    unsafeUrlPattern: /unsafe/i
  },

  // Chrome stealth configuration
  chrome: {
    headless: false, // Use visible browser for testing
    args: [
      '--disable-blink-features=AutomationControlled',
      '--exclude-switches=enable-automation',
      '--disable-automation',
      '--disable-ipc-flooding-protection',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ],
    // Critical: No remote-debugging-port to avoid detection
    viewport: {
      width: 1366,
      height: 768
    },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  },

  // Runtime patching configuration (rebrowser-patches)
  runtimePatching: {
    mode: 'addBinding', // Mode 1 from document.pdf
    packageName: 'puppeteer-core',
    environment: 'REBROWSER_PATCHES_RUNTIME_FIX_MODE=addBinding'
  },

  // Extension configuration
  extension: {
    path: path.join(process.cwd(), 'extensions', 'cdp-stealth'),
    manifestPath: path.join(process.cwd(), 'extensions', 'cdp-stealth', 'manifest.json'),
    expectedPermissions: ['debugger', 'storage', 'cookies', 'tabs'],
    expectedHostPermissions: ['<all_urls>']
  },

  // Test execution configuration
  execution: {
    maxRetries: 3,
    retryDelay: 2000, // 2 seconds between retries
    timeout: 30000, // 30 seconds total timeout
    screenshotDelay: 1000, // Wait 1 second before screenshot
    elementWaitTimeout: 10000, // Wait up to 10 seconds for elements
    navigationTimeout: 15000 // Wait up to 15 seconds for navigation
  },

  // Success criteria from document.pdf
  successCriteria: {
    loginCompleted: {
      name: 'Login completed',
      validator: (result) => result.isLoggedIn === true
    },
    noDetection: {
      name: 'No detection',
      validator: (result) => result.detectionAttempts === 0
    },
    noErrors: {
      name: 'No errors',
      validator: (result) => result.errors.length === 0
    },
    fastExecution: {
      name: 'Fast execution',
      validator: (result) => result.duration < 30000, // < 30 seconds
      threshold: 30000
    }
  },

  // Performance thresholds
  performance: {
    maxExecutionTime: 30000, // 30 seconds
    minSuccessRate: 95, // 95% success rate
    maxDetectionRate: 5, // 5% detection rate max
    warningThreshold: 20000, // 20 seconds warning threshold
    criticalThreshold: 25000 // 25 seconds critical threshold
  },

  // Detection monitoring
  detection: {
    indicators: [
      'navigator.webdriver',
      'chrome.runtime.onMessage',
      'window.chrome.webstore',
      'window.cdc_adoQpoasnfa76pfcZLmcfl_Array',
      'window.cdc_adoQpoasnfa76pfcZLmcfl_Promise',
      'window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol'
    ],
    urls: [
      /unsafe/i,
      /captcha/i,
      /verification/i,
      /suspicious/i
    ]
  },

  // Screenshot configuration
  screenshots: {
    enabled: true,
    directory: path.join(process.cwd(), 'debug'),
    format: 'png',
    quality: 90,
    fullPage: true,
    naming: {
      prefix: 'gmail-test-',
      timestamp: true
    }
  },

  // Logging configuration
  logging: {
    level: process.env.TEST_LOG_LEVEL || 'info',
    directory: path.join(process.cwd(), 'debug'),
    files: {
      combined: 'combined.log',
      error: 'error.log',
      test: 'test-results.log'
    },
    console: process.env.NODE_ENV !== 'production'
  },

  // Test data configuration
  testData: {
    mockResponses: {
      loginSuccess: {
        url: 'https://mail.google.com/mail/u/0/#inbox',
        title: 'Inbox - kijkwijs@gmail.com - Gmail'
      },
      loginFailure: {
        url: 'https://accounts.google.com/signin/v2/challenge/pwd',
        error: 'Invalid password'
      },
      detectionWarning: {
        url: 'https://accounts.google.com/signin/v2/challenge/az',
        title: 'Suspicious login attempt prevented'
      }
    },
    selectors: {
      emailInput: 'input[type="email"], input[id="identifierId"]',
      passwordInput: 'input[type="password"], input[name="password"]',
      nextButton: 'button:contains("Next"), div[id="identifierNext"] button',
      signInButton: 'button:contains("Sign in"), div[id="passwordNext"] button',
      profileButton: 'a[aria-label*="Google Account"]',
      inboxElement: 'div[role="main"]'
    }
  },

  // CI/CD configuration
  ci: {
    enabled: process.env.CI === 'true',
    headless: process.env.CI === 'true',
    parallel: false,
    reporter: 'json',
    outputDir: path.join(process.cwd(), 'test-results'),
    artifacts: {
      screenshots: true,
      logs: true,
      videos: false,
      traces: false
    }
  },

  // Environment-specific overrides
  environments: {
    development: {
      headless: false,
      logging: {
        level: 'debug',
        console: true
      }
    },
    production: {
      headless: true,
      logging: {
        level: 'info',
        console: false
      }
    },
    test: {
      headless: true,
      logging: {
        level: 'warn',
        console: false
      }
    }
  }
};

// Apply environment-specific overrides
function applyEnvironmentOverrides(config) {
  const env = process.env.NODE_ENV || 'development';
  if (config.environments[env]) {
    return { ...config, ...config.environments[env] };
  }
  return config;
}

// Get configuration for current environment
function getConfig() {
  return applyEnvironmentOverrides(testConfig);
}

// Validate configuration
function validateConfig(config) {
  const errors = [];
  
  // Check required paths
  if (!require('fs').existsSync(config.extension.path)) {
    errors.push(`Extension path does not exist: ${config.extension.path}`);
  }
  
  // Check Gmail credentials
  if (!config.gmail.email || !config.gmail.password) {
    errors.push('Gmail credentials not configured');
  }
  
  // Check performance thresholds
  if (config.performance.maxExecutionTime > 60000) {
    errors.push('Max execution time should not exceed 60 seconds');
  }
  
  return errors;
}

// Export configuration and utilities
module.exports = {
  getConfig,
  validateConfig,
  testConfig
};