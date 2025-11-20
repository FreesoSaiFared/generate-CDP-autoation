const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure debug directory exists
const debugDir = path.join(process.cwd(), 'debug');
if (!fs.existsSync(debugDir)) {
  fs.mkdirSync(debugDir, { recursive: true });
}

// Create test-specific logger
const testLogger = winston.createLogger({
  level: process.env.TEST_LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'gmail-test-suite' },
  transports: [
    // Write all logs with importance level of `error` or less to `error.log`
    new winston.transports.File({
      filename: path.join(debugDir, 'error.log'),
      level: 'error'
    }),
    // Write all logs to `combined.log`
    new winston.transports.File({
      filename: path.join(debugDir, 'combined.log')
    }),
    // Test-specific log file
    new winston.transports.File({
      filename: path.join(debugDir, 'test-results.log'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${level.toUpperCase()}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        })
      )
    })
  ]
});

// If we're not in production, log to the console
if (process.env.NODE_ENV !== 'production') {
  testLogger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        return `${timestamp} [${level}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
      })
    )
  }));
}

// Test-specific logging methods
const testSuiteLogger = {
  // Test start/end logging
  startTest: (testName, metadata = {}) => {
    testLogger.info(`🚀 Starting test: ${testName}`, { 
      test: testName, 
      phase: 'start', 
      ...metadata 
    });
  },
  
  endTest: (testName, result, metadata = {}) => {
    const status = result.success ? '✅ PASSED' : '❌ FAILED';
    testLogger.info(`${status} test: ${testName}`, { 
      test: testName, 
      phase: 'end', 
      result, 
      ...metadata 
    });
  },
  
  // Step logging
  logStep: (testName, step, status = 'info', metadata = {}) => {
    const icons = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      debug: '🔍'
    };
    const icon = icons[status] || icons.info;
    testLogger.log(status.toLowerCase(), `${icon} ${testName} - ${step}`, { 
      test: testName, 
      step, 
      ...metadata 
    });
  },
  
  // Performance logging
  logPerformance: (testName, operation, duration, metadata = {}) => {
    testLogger.info(`⏱️ ${testName} - ${operation}: ${duration}ms`, { 
      test: testName, 
      operation, 
      duration, 
      type: 'performance', 
      ...metadata 
    });
  },
  
  // Detection logging
  logDetection: (testName, detectionType, details, metadata = {}) => {
    testLogger.warn(`🚨 ${testName} - Detection attempt: ${detectionType}`, { 
      test: testName, 
      detectionType, 
      details, 
      type: 'detection', 
      ...metadata 
    });
  },
  
  // Screenshot logging
  logScreenshot: (testName, screenshotPath, metadata = {}) => {
    testLogger.info(`📸 ${testName} - Screenshot saved: ${screenshotPath}`, { 
      test: testName, 
      screenshotPath, 
      type: 'screenshot', 
      ...metadata 
    });
  },
  
  // Error logging with stack trace
  logError: (testName, error, metadata = {}) => {
    testLogger.error(`💥 ${testName} - Error: ${error.message}`, { 
      test: testName, 
      error: error.message, 
      stack: error.stack, 
      type: 'error', 
      ...metadata 
    });
  },
  
  // Success criteria validation
  logCriteria: (testName, criteria, passed, metadata = {}) => {
    const status = passed ? '✅' : '❌';
    testLogger.info(`${status} ${testName} - Criteria: ${criteria}`, { 
      test: testName, 
      criteria, 
      passed, 
      type: 'criteria', 
      ...metadata 
    });
  },
  
  // Test summary
  logSummary: (testName, summary, metadata = {}) => {
    const { totalTests, passed, failed, successRate, avgDuration } = summary;
    testLogger.info(`📊 ${testName} - Summary: ${passed}/${totalTests} passed (${successRate}%)`, { 
      test: methodName, 
      summary, 
      type: 'summary', 
      ...metadata 
    });
  },
  
  // Raw winston logger access
  raw: testLogger
};

module.exports = testSuiteLogger;