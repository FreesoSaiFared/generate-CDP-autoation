// Test data and mock responses for Gmail login test suite
// Based on document.pdf specifications

const testData = {
  // Gmail test credentials from document.pdf
  gmail: {
    email: 'kijkwijs@gmail.com',
    password: 'Swamp98550!',
    // Test URLs
    urls: {
      login: 'https://accounts.google.com/ServiceLogin',
      signIn: 'https://accounts.google.com/signin',
      mail: 'https://mail.google.com',
      inbox: 'https://mail.google.com/mail/u/0/#inbox'
    },
    // Selectors for Gmail login flow
    selectors: {
      emailInput: 'input[type="email"], input[id="identifierId"]',
      passwordInput: 'input[type="password"], input[name="password"]',
      nextButton: 'button:contains("Next"), div[id="identifierNext"] button, [data-primary-action-label="Next"]',
      signInButton: 'button:contains("Sign in"), div[id="passwordNext"] button, [data-primary-action-label="Sign in"]',
      profileButton: 'a[aria-label*="Google Account"], .gb_Ba',
      inboxElement: 'div[role="main"], .nH',
      composeButton: 'div[gh="cm"]'
    }
  },

  // Mock responses for different scenarios
  mockResponses: {
    // Successful login response
    loginSuccess: {
      url: 'https://mail.google.com/mail/u/0/#inbox',
      title: 'Inbox - kijkwijs@gmail.com - Gmail',
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'set-cookie': [
          'SID=mock_session_id; Path=/; Secure; HttpOnly',
          'LSID=mock_lsid; Path=/; Secure; HttpOnly'
        ]
      },
      body: {
        userEmail: 'kijkwijs@gmail.com',
        inboxCount: 15,
        labels: ['INBOX', 'SENT', 'DRAFTS', 'SPAM', 'TRASH']
      }
    },

    // Login failure response
    loginFailure: {
      url: 'https://accounts.google.com/signin/v2/challenge/pwd',
      title: 'Sign in - Google Accounts',
      status: 200,
      error: {
        code: 400,
        message: 'Invalid password',
        type: 'authentication_error'
      },
      body: {
        error: 'Invalid password',
        errorType: 'BAD_PASSWORD',
        retryAllowed: true
      }
    },

    // Detection warning response
    detectionWarning: {
      url: 'https://accounts.google.com/signin/v2/challenge/az',
      title: 'Suspicious login attempt prevented',
      status: 200,
      warning: {
        type: 'suspicious_activity',
        message: 'Google detected suspicious activity',
        requiresVerification: true
      },
      body: {
        challenge: 'suspicious_login',
        verificationRequired: ['phone', 'email'],
        blocked: true
      }
    },

    // 2FA challenge response
    twoFactorChallenge: {
      url: 'https://accounts.google.com/signin/v2/challenge/2fa',
      title: '2-Step Verification',
      status: 200,
      challenge: {
        type: '2fa',
        methods: ['sms', 'authenticator', 'backup_code'],
        timeout: 60000
      },
      body: {
        challengeType: 'TWO_FACTOR',
        availableMethods: ['SMS', 'AUTHENTICATOR'],
        expiresAt: Date.now() + 60000
      }
    },

    // CAPTCHA challenge response
    captchaChallenge: {
      url: 'https://accounts.google.com/signin/v2/challenge/captcha',
      title: 'Verify you\'re human',
      status: 200,
      challenge: {
        type: 'captcha',
        siteKey: 'mock_site_key',
        provider: 'recaptcha'
      },
      body: {
        challengeType: 'CAPTCHA',
        siteKey: '6Le-wvkSAAAAAPBMRTvw0Q4Muexq9bi0DJwx_mJ-',
        provider: 'Google reCAPTCHA'
      }
    }
  },

  // Stealth test data
  stealth: {
    // Expected stealth properties
    expectedProperties: {
      navigator: {
        webdriver: undefined,
        plugins: {
          length: 5,
          names: ['Chrome PDF Plugin', 'Chrome PDF Viewer', 'Native Client', 'WebKit built-in PDF', 'Edge PDF Viewer']
        },
        languages: ['en-US', 'en', 'es'],
        platform: 'Win32',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      chrome: {
        runtime: {
          onConnect: undefined,
          onMessage: undefined
        },
        webstore: undefined
      },
      window: {
        cdc_adoQpoasnfa76pfcZLmcfl_Array: undefined,
        cdc_adoQpoasnfa76pfcZLmcfl_Promise: undefined,
        cdc_adoQpoasnfa76pfcZLmcfl_Symbol: undefined,
        webdriver: undefined
      }
    },

    // Detection indicators to monitor
    detectionIndicators: [
      'navigator.webdriver',
      'chrome.runtime.onMessage',
      'chrome.webstore',
      'window.cdc_adoQpoasnfa76pfcZLmcfl_Array',
      'window.cdc_adoQpoasnfa76pfcZLmcfl_Promise',
      'window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol',
      'window.webdriver',
      'window.phantom',
      'window.selenium',
      'window.webdriver'
    ],

    // URLs that indicate detection
    detectionUrls: [
      /unsafe/i,
      /captcha/i,
      /verification/i,
      /suspicious/i,
      /blocked/i,
      /challenge/i
    ]
  },

  // Runtime patching test data
  runtimePatching: {
    // Test scenarios for addBinding mode
    addBindingTests: [
      {
        name: 'Basic addBinding',
        code: 'window.__rebrowser_test = { id: "test", timestamp: Date.now() }',
        expected: { success: true, detection: false }
      },
      {
        name: 'Context isolation',
        code: '(() => { const isolated = { data: "test" }; return isolated; })()',
        expected: { success: true, detection: false }
      },
      {
        name: 'Runtime evaluation',
        code: '({ type: "evaluation", result: document.title })',
        expected: { success: true, detection: false }
      }
    ],

    // CDP commands to test
    cdpCommands: [
      {
        domain: 'Runtime',
        command: 'evaluate',
        params: { expression: 'document.title' },
        expectedDetection: false
      },
      {
        domain: 'Page',
        command: 'navigate',
        params: { url: 'https://example.com' },
        expectedDetection: false
      },
      {
        domain: 'DOM',
        command: 'getDocument',
        params: {},
        expectedDetection: false
      },
      {
        domain: 'CSS',
        command: 'getComputedStyleForNode',
        params: { nodeId: 1 },
        expectedDetection: false
      }
    ],

    // Detection window monitoring
    detectionWindow: {
      duration: 5000, // 5 seconds
      interval: 100, // Check every 100ms
      maxDetections: 0 // Should be 0 for successful stealth
    }
  },

  // Extension test data
  extension: {
    // Expected manifest structure
    expectedManifest: {
      manifest_version: 3,
      name: 'CDP Activity Recorder',
      version: '1.0.0',
      permissions: ['debugger', 'storage', 'cookies', 'tabs'],
      host_permissions: ['<all_urls>'],
      background: {
        service_worker: 'background.js'
      },
      action: {
        default_popup: 'popup.html'
      }
    },

    // Extension functionality tests
    functionalityTests: [
      {
        name: 'CDP Command Execution',
        test: 'executeCDPCommand',
        expected: { success: true, response: 'valid' }
      },
      {
        name: 'State Capture',
        test: 'captureState',
        expected: { success: true, state: 'captured' }
      },
      {
        name: 'State Injection',
        test: 'injectState',
        expected: { success: true, state: 'injected' }
      },
      {
        name: 'Debugger API',
        test: 'debuggerAPI',
        expected: { success: true, api: 'functional' }
      }
    ],

    // Mock extension responses
    mockResponses: {
      cdpCommand: {
        result: {
          value: 'mock_cdp_result',
          type: 'string'
        }
      },
      stateCapture: {
        localStorage: { 'test_key': 'test_value' },
        sessionStorage: { 'session_key': 'session_value' },
        cookies: [{ name: 'test_cookie', value: 'test_value' }]
      },
      debuggerAttach: {
        success: true,
        target: {
          id: 'mock_target_id',
          type: 'page',
          url: 'https://example.com'
        }
      }
    }
  },

  // Performance test data
  performance: {
    // Expected performance thresholds
    thresholds: {
      maxExecutionTime: 30000, // 30 seconds
      warningThreshold: 20000, // 20 seconds
      criticalThreshold: 25000, // 25 seconds
      minSuccessRate: 95, // 95%
      maxDetectionRate: 5 // 5%
    },

    // Performance benchmarks
    benchmarks: {
      gmailLogin: {
        optimal: 5000, // 5 seconds
        acceptable: 15000, // 15 seconds
        maximum: 30000 // 30 seconds
      },
      runtimePatching: {
        optimal: 2000, // 2 seconds
        acceptable: 5000, // 5 seconds
        maximum: 10000 // 10 seconds
      },
      extensionTest: {
        optimal: 3000, // 3 seconds
        acceptable: 8000, // 8 seconds
        maximum: 15000 // 15 seconds
      }
    },

    // Mock performance data
    mockData: {
      successful: {
        duration: 8500,
        success: true,
        detectionAttempts: 0,
        errors: []
      },
      slow: {
        duration: 35000,
        success: true,
        detectionAttempts: 0,
        errors: ['Execution timeout warning']
      },
      detected: {
        duration: 12000,
        success: false,
        detectionAttempts: 3,
        errors: ['Detection warning page', 'CAPTCHA challenge']
      },
      failed: {
        duration: 8000,
        success: false,
        detectionAttempts: 0,
        errors: ['Login failed', 'Invalid credentials']
      }
    }
  },

  // Test environment data
  environment: {
    // Browser configurations
    browsers: {
      chrome: {
        name: 'Chrome',
        version: '120.0.0.0',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 768 }
      },
      headless: {
        name: 'Chrome Headless',
        version: '120.0.0.0',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 768 }
      }
    },

    // Network conditions
    network: {
      fast: {
        downloadThroughput: 10000000, // 10 Mbps
        uploadThroughput: 5000000, // 5 Mbps
        latency: 20 // 20ms
      },
      slow: {
        downloadThroughput: 1000000, // 1 Mbps
        uploadThroughput: 500000, // 500 Kbps
        latency: 100 // 100ms
      }
    },

    // Device profiles
    devices: {
      desktop: {
        name: 'Desktop',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 768 },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false
      },
      mobile: {
        name: 'Mobile',
        userAgent: 'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        viewport: { width: 375, height: 667 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true
      }
    }
  },

  // Error scenarios and expected behaviors
  errorScenarios: {
    // Network errors
    network: [
      {
        type: 'timeout',
        message: 'Navigation timeout exceeded',
        expectedBehavior: 'retry with extended timeout',
        recovery: 'increase timeout values'
      },
      {
        type: 'connection_refused',
        message: 'Connection refused',
        expectedBehavior: 'check network connectivity',
        recovery: 'verify proxy settings'
      },
      {
        type: 'dns_failure',
        message: 'DNS resolution failed',
        expectedBehavior: 'fallback to alternative URLs',
        recovery: 'check DNS configuration'
      }
    ],

    // Authentication errors
    authentication: [
      {
        type: 'invalid_credentials',
        message: 'Invalid email or password',
        expectedBehavior: 'report authentication failure',
        recovery: 'verify credentials'
      },
      {
        type: 'account_locked',
        message: 'Account temporarily locked',
        expectedBehavior: 'report security challenge',
        recovery: 'manual intervention required'
      },
      {
        type: '2fa_required',
        message: '2-step verification required',
        expectedBehavior: 'wait for manual 2FA completion',
        recovery: 'extend timeout for 2FA'
      }
    ],

    // Detection errors
    detection: [
      {
        type: 'webdriver_detected',
        message: 'navigator.webdriver detected',
        expectedBehavior: 'stealth configuration failure',
        recovery: 'review Chrome flags'
      },
      {
        type: 'runtime_detected',
        message: 'Runtime.enable detection triggered',
        expectedBehavior: 'runtime patching failure',
        recovery: 'verify rebrowser-patches setup'
      },
      {
        type: 'behavioral_detected',
        message: 'Behavioral analysis detected automation',
        expectedBehavior: 'human-like interaction failure',
        recovery: 'add randomization to actions'
      }
    ]
  },

  // Test utilities
  utilities: {
    // Random delays for human-like behavior
    delays: {
      typing: { min: 50, max: 150 },
      clicking: { min: 100, max: 300 },
      navigation: { min: 500, max: 1500 },
      thinking: { min: 1000, max: 3000 }
    },

    // Mouse movement patterns
    mouseMovements: {
      bezier: true,
      randomOffset: { x: 10, y: 10 },
      speed: { min: 100, max: 300 }
    },

    // Keyboard patterns
    keyboard: {
      typingSpeed: { min: 50, max: 100 },
      mistakes: { probability: 0.05, correctionDelay: 200 },
      pauses: { min: 200, max: 500 }
    }
  }
};

// Export test data
module.exports = testData;