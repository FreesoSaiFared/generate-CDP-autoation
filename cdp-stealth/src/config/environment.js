/**
 * Environment Configuration for CDP Stealth System
 * 
 * This module manages all configuration aspects of the stealth browser system,
 * including Chrome flags, paths, environment detection, and debug/production modes.
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

// Get the project root directory
const projectRoot = path.resolve(__dirname, '../..');

/**
 * Environment Detection
 */
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

/**
 * Chrome Configuration
 * 
 * These are the critical flags that must be used to bypass detection.
 * Each flag has been carefully selected based on analysis of Chrome's detection mechanisms.
 */
const chromeFlags = {
  // CRITICAL FLAGS - These must always be included
  critical: [
    '--disable-blink-features=AutomationControlled',
    '--exclude-switches=enable-automation',
    '--disable-automation',
    '--disable-ipc-flooding-protection',
    '--no-first-run',
    '--no-default-browser-check'
  ],
  
  // OPTIONAL FLAGS - These enhance stealth but are not strictly required
  optional: [
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-features=TranslateUI',
    '--password-store=basic',
    '--use-mock-keychain'
  ],
  
  // DEBUG FLAGS - Only used in development mode
  debug: [
    '--enable-logging',
    '--log-level=0',
    '--v=1'
  ],
  
  // NEVER INCLUDE THESE FLAGS - They are detection vectors
  forbidden: [
    '--remote-debugging-port=9222',
    '--remote-debugging-port',
    '--enable-automation'
  ]
};

/**
 * Path Configuration
 */
const paths = {
  // Project paths
  projectRoot,
  src: path.join(projectRoot, 'src'),
  config: path.join(projectRoot, 'src/config'),
  test: path.join(projectRoot, 'src/test'),
  
  // Chrome paths
  userDataDir: path.join(projectRoot, 'chrome-user-data'),
  extensionDir: path.join(projectRoot, 'extensions/cdp-stealth'),
  
  // Debug and recording paths
  debugDir: path.join(projectRoot, 'debug'),
  recordingsDir: path.join(projectRoot, 'recordings'),
  mitmproxyDir: path.join(projectRoot, '.mitmproxy')
};

/**
 * Ensure all required directories exist
 */
function ensureDirectories() {
  const dirsToCreate = [
    paths.userDataDir,
    paths.debugDir,
    paths.recordingsDir,
    paths.mitmproxyDir
  ];
  
  dirsToCreate.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

/**
 * Get Chrome executable path based on the current platform
 */
function getChromeExecutable() {
  const platform = os.platform();
  const arch = os.arch();
  
  const chromePaths = {
    win32: [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Users\\' + os.userInfo().username + '\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'
    ],
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    ],
    linux: [
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/snap/bin/chromium'
    ]
  };
  
  const platformPaths = chromePaths[platform] || [];
  
  for (const chromePath of platformPaths) {
    if (fs.existsSync(chromePath)) {
      return chromePath;
    }
  }
  
  throw new Error(`Chrome executable not found for platform ${platform}-${arch}. Please install Chrome or specify the path manually.`);
}

/**
 * Build Chrome arguments based on configuration
 */
function buildChromeArgs(options = {}) {
  const {
    userDataDir = paths.userDataDir,
    extensionDir = paths.extensionDir,
    proxy = process.env.CHROME_PROXY,
    userAgent = process.env.CHROME_USER_AGENT,
    windowSize = process.env.CHROME_WINDOW_SIZE || '1366,768',
    headless = false,
    debug = isDevelopment
  } = options;
  
  // Start with critical flags
  const args = [...chromeFlags.critical];
  
  // Add optional flags
  args.push(...chromeFlags.optional);
  
  // Add debug flags if in development mode
  if (debug) {
    args.push(...chromeFlags.debug);
  }
  
  // Add user data directory
  args.push(`--user-data-dir=${userDataDir}`);
  
  // Add extension if it exists
  if (fs.existsSync(extensionDir)) {
    args.push(`--load-extension=${extensionDir}`);
  }
  
  // Add proxy if specified
  if (proxy) {
    args.push(`--proxy-server=${proxy}`);
  }
  
  // Add custom user agent if specified
  if (userAgent) {
    args.push(`--user-agent=${userAgent}`);
  }
  
  // Add window size
  args.push(`--window-size=${windowSize}`);
  
  // Add headless mode if requested (not recommended for stealth)
  if (headless) {
    args.push('--headless');
  }
  
  // Verify no forbidden flags are present
  for (const forbidden of chromeFlags.forbidden) {
    if (args.some(arg => arg.includes(forbidden))) {
      throw new Error(`Forbidden flag detected: ${forbidden}. This will compromise stealth.`);
    }
  }
  
  return args;
}

/**
 * Get the runtime patching mode for rebrowser-patches
 */
function getRuntimePatchingMode() {
  // Check environment variable first
  const envMode = process.env.REBROWSER_PATCHES_RUNTIME_FIX_MODE;
  if (envMode) {
    return envMode;
  }
  
  // Default to addBinding (Mode 1) as recommended
  return 'addBinding';
}

/**
 * Get the current configuration
 */
function getConfig(options = {}) {
  ensureDirectories();
  
  return {
    // Environment info
    environment: {
      isDevelopment,
      isProduction,
      isTest,
      nodeVersion: process.version,
      platform: os.platform(),
      arch: os.arch()
    },
    
    // Chrome configuration
    chrome: {
      executable: getChromeExecutable(),
      args: buildChromeArgs(options),
      runtimePatchingMode: getRuntimePatchingMode()
    },
    
    // Paths
    paths,
    
    // Stealth configuration
    stealth: {
      // Runtime.enable patching mode
      runtimePatchingMode: getRuntimePatchingMode(),
      
      // Extension-based control (no exposed debugging ports)
      useExtensionControl: true,
      
      // Behavioral fingerprinting settings
      humanization: {
        mouseMovement: true,
        typingPattern: true,
        scrollBehavior: true,
        timingVariation: true
      }
    }
  };
}

/**
 * Validate the current configuration
 */
function validateConfig(config) {
  const errors = [];
  
  // Check if Chrome executable exists
  if (!fs.existsSync(config.chrome.executable)) {
    errors.push(`Chrome executable not found: ${config.chrome.executable}`);
  }
  
  // Check if extension directory exists
  if (!fs.existsSync(config.paths.extensionDir)) {
    errors.push(`CDP stealth extension not found: ${config.paths.extensionDir}`);
  }
  
  // Verify critical flags are present
  const criticalFlags = chromeFlags.critical;
  const presentFlags = config.chrome.args;
  
  for (const critical of criticalFlags) {
    if (!presentFlags.some(arg => arg.includes(critical.split('=')[0]))) {
      errors.push(`Missing critical flag: ${critical}`);
    }
  }
  
  // Check for forbidden flags
  for (const forbidden of chromeFlags.forbidden) {
    if (presentFlags.some(arg => arg.includes(forbidden))) {
      errors.push(`Forbidden flag detected: ${forbidden}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = {
  chromeFlags,
  paths,
  getChromeExecutable,
  buildChromeArgs,
  getRuntimePatchingMode,
  getConfig,
  validateConfig,
  ensureDirectories
};