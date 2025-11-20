import { ServerConfig } from './types';
import * as path from 'path';
import * as fs from 'fs-extra';

/**
 * Default configuration for the MCP server
 */
export const defaultConfig: ServerConfig = {
  logLevel: 'info',
  integuru: {
    model: 'gpt-4o',
    timeout: 30000,
    tempDir: path.join(process.cwd(), 'temp'),
    integuruDir: path.join(process.cwd(), 'Integuru')
  },
  mitmproxy: {
    port: 8080,
    host: '127.0.0.1',
    harOutput: path.join(process.cwd(), 'network_requests.har')
  },
  chrome: {
    headless: false,
    userDataDir: path.join(process.cwd(), 'chrome-user-data'),
    extensions: [path.join(process.cwd(), 'extensions', 'cdp-stealth')]
  },
  sessions: {
    storageDir: path.join(process.cwd(), 'sessions'),
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
};

/**
 * Load configuration from environment variables and config files
 */
export function loadConfig(): ServerConfig {
  const config = { ...defaultConfig };

  // Load from environment variables
  if (process.env.MCP_LOG_LEVEL) {
    config.logLevel = process.env.MCP_LOG_LEVEL as any;
  }

  if (process.env.INTEGURU_MODEL) {
    config.integuru.model = process.env.INTEGURU_MODEL;
  }

  if (process.env.INTEGURU_TIMEOUT) {
    config.integuru.timeout = parseInt(process.env.INTEGURU_TIMEOUT, 10);
  }

  if (process.env.INTEGURU_DIR) {
    config.integuru.integuruDir = process.env.INTEGURU_DIR;
  }

  if (process.env.MITMPROXY_PORT) {
    config.mitmproxy.port = parseInt(process.env.MITMPROXY_PORT, 10);
  }

  if (process.env.MITMPROXY_HOST) {
    config.mitmproxy.host = process.env.MITMPROXY_HOST;
  }

  if (process.env.CHROME_HEADLESS) {
    config.chrome.headless = process.env.CHROME_HEADLESS === 'true';
  }

  if (process.env.CHROME_USER_DATA_DIR) {
    config.chrome.userDataDir = process.env.CHROME_USER_DATA_DIR;
  }

  if (process.env.SESSIONS_DIR) {
    config.sessions.storageDir = process.env.SESSIONS_DIR;
  }

  // Load from config file if it exists
  const configPath = path.join(process.cwd(), 'mcp-config.json');
  if (fs.existsSync(configPath)) {
    try {
      const fileConfig = fs.readJsonSync(configPath);
      // Deep merge the configuration
      mergeDeep(config, fileConfig);
    } catch (error) {
      console.warn(`Failed to load config file ${configPath}:`, error);
    }
  }

  // Ensure directories exist
  ensureDirectories(config);

  return config;
}

/**
 * Deep merge two objects
 */
function mergeDeep(target: any, source: any): void {
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      mergeDeep(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
}

/**
 * Ensure required directories exist
 */
function ensureDirectories(config: ServerConfig): void {
  const dirs = [
    config.integuru.tempDir,
    config.sessions.storageDir,
    path.dirname(config.mitmproxy.harOutput),
    config.chrome.userDataDir
  ];

  dirs.forEach(dir => {
    try {
      fs.ensureDirSync(dir);
    } catch (error) {
      console.warn(`Failed to create directory ${dir}:`, error);
    }
  });
}

/**
 * Validate configuration
 */
export function validateConfig(config: ServerConfig): void {
  const errors: string[] = [];

  // Validate log level
  const validLogLevels = ['debug', 'info', 'warn', 'error'];
  if (!validLogLevels.includes(config.logLevel)) {
    errors.push(`Invalid log level: ${config.logLevel}. Must be one of: ${validLogLevels.join(', ')}`);
  }

  // Validate integuru configuration
  if (!config.integuru.model) {
    errors.push('Integuru model is required');
  }

  if (config.integuru.timeout <= 0) {
    errors.push('Integuru timeout must be positive');
  }

  // Validate mitmproxy configuration
  if (config.mitmproxy.port < 1 || config.mitmproxy.port > 65535) {
    errors.push('Mitmproxy port must be between 1 and 65535');
  }

  // Validate chrome configuration
  if (!config.chrome.userDataDir) {
    errors.push('Chrome user data directory is required');
  }

  // Validate sessions configuration
  if (!config.sessions.storageDir) {
    errors.push('Sessions storage directory is required');
  }

  if (config.sessions.maxAge <= 0) {
    errors.push('Sessions max age must be positive');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

/**
 * Get configuration for specific environments
 */
export function getEnvironmentConfig(): Partial<ServerConfig> {
  const env = process.env.NODE_ENV || 'development';

  switch (env) {
    case 'production':
      return {
        logLevel: 'warn',
        chrome: {
          headless: true
        }
      };
    
    case 'test':
      return {
        logLevel: 'error',
        integuru: {
          timeout: 5000
        },
        sessions: {
          maxAge: 60 * 1000 // 1 minute for tests
        }
      };
    
    default:
      return {};
  }
}

/**
 * Export configuration as JSON for debugging
 */
export function exportConfig(config: ServerConfig): string {
  return JSON.stringify(config, null, 2);
}

/**
 * Save configuration to file
 */
export function saveConfig(config: ServerConfig, filePath?: string): void {
  const configPath = filePath || path.join(process.cwd(), 'mcp-config.json');
  fs.writeJsonSync(configPath, config, { spaces: 2 });
}