/**
 * Replay Engine Module
 * Handles action sequence replay with timing, screenshot comparison, and visual verification
 */

const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { createHash } = require('crypto');

class ReplayEngine {
  constructor(options = {}) {
    this.tempDir = options.tempDir || './temp';
    this.logger = options.logger || console;
    this.screenshotComparisonEnabled = options.screenshotComparison !== false;
    this.visualVerificationEnabled = options.visualVerification !== false;
    this.errorRecoveryEnabled = options.errorRecovery !== false;
    this.defaultSpeedMultiplier = options.speedMultiplier || 1.0;
    this.maxRetryAttempts = options.maxRetryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.screenshotThreshold = options.screenshotThreshold || 0.95;
    this.glmApiKey = options.glmApiKey || null;
    
    this.ensureTempDir();
  }

  /**
   * Replay a complete session with actions
   */
  async replaySession(page, session, options = {}) {
    const startTime = Date.now();
    this.logger.info(`Starting session replay: ${session.sessionId}`);
    
    try {
      const replayOptions = {
        speedMultiplier: options.speedMultiplier || this.defaultSpeedMultiplier,
        skipScreenshots: options.skipScreenshots || false,
        dryRun: options.dryRun || false,
        startActionIndex: options.startActionIndex || 0,
        endActionIndex: options.endActionIndex || session.activity.actions.length - 1,
        enableErrorRecovery: options.enableErrorRecovery !== false && this.errorRecoveryEnabled,
        enableScreenshotComparison: options.enableScreenshotComparison !== false && this.screenshotComparisonEnabled,
        enableVisualVerification: options.enableVisualVerification !== false && this.visualVerificationEnabled
      };
      
      const replayResults = {
        sessionId: session.sessionId,
        success: true,
        startTime: new Date().toISOString(),
        endTime: null,
        duration: 0,
        totalActions: 0,
        successfulActions: 0,
        failedActions: 0,
        retriedActions: 0,
        skippedActions: 0,
        actions: [],
        screenshots: [],
        errors: [],
        recovery: {
          attempts: 0,
          successful: 0
        },
        performance: {
          originalDuration: session.performance.duration || 0,
          replayDuration: 0,
          speedRatio: 0
        }
      };
      
      // Apply initial state if available
      if (session.state && session.state.initial && !replayOptions.dryRun) {
        await this.applyInitialState(page, session.state.initial);
      }
      
      // Get actions to replay
      const actions = session.activity.actions.slice(
        replayOptions.startActionIndex,
        replayOptions.endActionIndex + 1
      );
      
      replayResults.totalActions = actions.length;
      
      // Replay each action
      for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        const actionResult = await this.replayAction(
          page, 
          action, 
          i, 
          replayOptions,
          replayResults
        );
        
        replayResults.actions.push(actionResult);
        
        if (actionResult.success) {
          replayResults.successfulActions++;
        } else {
          replayResults.failedActions++;
          
          // Handle error recovery
          if (replayOptions.enableErrorRecovery) {
            const recoveryResult = await this.handleActionError(
              page, 
              action, 
              i, 
              actionResult.error, 
              replayOptions,
              replayResults
            );
            
            if (recoveryResult.success) {
              replayResults.recovery.attempts++;
              replayResults.recovery.successful++;
              replayResults.failedActions--;
              replayResults.successfulActions++;
              replayResults.retriedActions++;
              
              // Update action result with recovery info
              actionResult.recovered = true;
              actionResult.recoveryAttempts = recoveryResult.attempts;
            }
          }
        }
        
        // Add delay between actions based on timing
        if (i < actions.length - 1) {
          const nextAction = actions[i + 1];
          const delay = this.calculateActionDelay(action, nextAction, replayOptions.speedMultiplier);
          if (delay > 0) {
            await this.sleep(delay);
          }
        }
      }
      
      // Calculate final results
      replayResults.endTime = new Date().toISOString();
      replayResults.duration = Date.now() - startTime;
      replayResults.performance.replayDuration = replayResults.duration;
      replayResults.performance.speedRatio = replayResults.performance.originalDuration > 0 
        ? replayResults.performance.originalDuration / replayResults.performance.replayDuration 
        : 1;
      
      replayResults.success = replayResults.failedActions === 0;
      
      if (replayResults.success) {
        this.logger.info(`Session replay completed successfully in ${replayResults.duration}ms`);
      } else {
        this.logger.warn(`Session replay completed with ${replayResults.failedActions} failed actions`);
      }
      
      return replayResults;
    } catch (error) {
      this.logger.error('Session replay failed:', error);
      throw new Error(`Session replay failed: ${error.message}`);
    }
  }

  /**
   * Replay a single action
   */
  async replayAction(page, action, actionIndex, options, replayResults) {
    const actionResult = {
      actionIndex,
      type: action.type,
      timestamp: new Date().toISOString(),
      success: false,
      duration: 0,
      error: null,
      recovered: false,
      recoveryAttempts: 0,
      screenshot: null,
      verification: null
    };
    
    const startTime = Date.now();
    
    try {
      this.logger.debug(`Replaying action ${actionIndex}: ${action.type}`);
      
      // Handle different action types
      switch (action.type) {
        case 'CDP_COMMAND':
          await this.replayCDPCommand(page, action, options);
          break;
        case 'NAVIGATION':
          await this.replayNavigation(page, action, options);
          break;
        case 'WAIT':
          await this.replayWait(page, action, options);
          break;
        case 'CLICK':
          await this.replayClick(page, action, options);
          break;
        case 'TYPE':
          await this.replayType(page, action, options);
          break;
        case 'SCROLL':
          await this.replayScroll(page, action, options);
          break;
        case 'SCREENSHOT_ANALYSIS':
          await this.replayScreenshotAnalysis(page, action, options);
          break;
        case 'CONSOLE_LOG':
          await this.replayConsoleLog(page, action, options);
          break;
        case 'REQUEST':
          await this.replayRequest(page, action, options);
          break;
        case 'RESPONSE':
          await this.replayResponse(page, action, options);
          break;
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }
      
      actionResult.success = true;
      
      // Take screenshot if enabled
      if (!options.skipScreenshots) {
        actionResult.screenshot = await this.takeActionScreenshot(page, actionIndex, replayResults);
      }
      
      // Perform visual verification if enabled
      if (options.enableVisualVerification && actionResult.screenshot) {
        actionResult.verification = await this.performVisualVerification(
          page, 
          action, 
          actionResult.screenshot, 
          options
        );
      }
      
      // Perform screenshot comparison if enabled and original screenshot exists
      if (options.enableScreenshotComparison && action.screenshot) {
        const comparison = await this.compareScreenshots(
          action.screenshot, 
          actionResult.screenshot, 
          options
        );
        actionResult.screenshotComparison = comparison;
        
        // If comparison fails below threshold, mark as failed
        if (comparison.similarity < this.screenshotThreshold) {
          actionResult.success = false;
          actionResult.error = `Screenshot comparison failed: ${comparison.similarity} < ${this.screenshotThreshold}`;
        }
      }
      
    } catch (error) {
      actionResult.error = error.message;
      this.logger.warn(`Action ${actionIndex} failed: ${error.message}`);
    }
    
    actionResult.duration = Date.now() - startTime;
    return actionResult;
  }

  /**
   * Replay CDP command action
   */
  async replayCDPCommand(page, action, options) {
    if (options.dryRun) {
      this.logger.info(`[DRY RUN] Would execute CDP command: ${action.method}`);
      return;
    }
    
    const { method, params } = action;
    
    // Execute CDP command
    const result = await page.send(method, params);
    
    this.logger.debug(`Executed CDP command: ${method}`, result);
    return result;
  }

  /**
   * Replay navigation action
   */
  async replayNavigation(page, action, options) {
    if (options.dryRun) {
      this.logger.info(`[DRY RUN] Would navigate to: ${action.url}`);
      return;
    }
    
    const { url, waitUntil = 'networkidle2' } = action;
    
    await page.goto(url, { waitUntil, timeout: 30000 });
    
    this.logger.debug(`Navigated to: ${url}`);
  }

  /**
   * Replay wait action
   */
  async replayWait(page, action, options) {
    const { duration = 1000, reason = '' } = action;
    
    // Adjust duration based on speed multiplier
    const adjustedDuration = duration / options.speedMultiplier;
    
    if (options.dryRun) {
      this.logger.info(`[DRY RUN] Would wait ${adjustedDuration}ms${reason ? ` (${reason})` : ''}`);
      return;
    }
    
    await this.sleep(adjustedDuration);
    
    this.logger.debug(`Waited ${adjustedDuration}ms${reason ? ` (${reason})` : ''}`);
  }

  /**
   * Replay click action
   */
  async replayClick(page, action, options) {
    if (options.dryRun) {
      this.logger.info(`[DRY RUN] Would click on: ${action.selector}`);
      return;
    }
    
    const { selector, button = 'left', clickCount = 1, modifiers = [] } = action;
    
    await page.waitForSelector(selector, { timeout: 10000 });
    await page.click(selector, { button, clickCount, modifiers });
    
    this.logger.debug(`Clicked on: ${selector}`);
  }

  /**
   * Replay type action
   */
  async replayType(page, action, options) {
    if (options.dryRun) {
      this.logger.info(`[DRY RUN] Would type "${action.text}" into: ${action.selector}`);
      return;
    }
    
    const { selector, text, delay = 50, clear = false } = action;
    
    await page.waitForSelector(selector, { timeout: 10000 });
    
    if (clear) {
      await page.click(selector, { clickCount: 3 }); // Select all
      await page.keyboard.press('Backspace');
    }
    
    await page.type(selector, text, { delay });
    
    this.logger.debug(`Typed "${text}" into: ${selector}`);
  }

  /**
   * Replay scroll action
   */
  async replayScroll(page, action, options) {
    if (options.dryRun) {
      this.logger.info(`[DRY RUN] Would scroll to: ${action.x}, ${action.y}`);
      return;
    }
    
    const { x = 0, y = 0, selector = null } = action;
    
    if (selector) {
      await page.waitForSelector(selector, { timeout: 10000 });
      await page.evaluate((sel) => {
        const element = document.querySelector(sel);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, selector);
    } else {
      await page.evaluate((scrollX, scrollY) => {
        window.scrollTo(scrollX, scrollY);
      }, x, y);
    }
    
    await this.sleep(500); // Wait for scroll to complete
    
    this.logger.debug(`Scrolled to: ${selector || `${x}, ${y}`}`);
  }

  /**
   * Replay screenshot analysis action
   */
  async replayScreenshotAnalysis(page, action, options) {
    if (options.dryRun) {
      this.logger.info(`[DRY RUN] Would analyze screenshot: ${action.screenshot}`);
      return;
    }
    
    // Take current screenshot
    const screenshotPath = path.join(this.tempDir, `replay-screenshot-${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    
    // Perform analysis if GLM API is available
    let analysis = null;
    if (this.glmApiKey && options.enableVisualVerification) {
      analysis = await this.analyzeScreenshotWithGLM(screenshotPath, action.prompt || '');
    }
    
    this.logger.debug(`Analyzed screenshot: ${screenshotPath}`);
    return { screenshotPath, analysis };
  }

  /**
   * Replay console log action
   */
  async replayConsoleLog(page, action, options) {
    if (options.dryRun) {
      this.logger.info(`[DRY RUN] Would log to console: ${action.message}`);
      return;
    }
    
    const { level = 'info', message } = action;
    
    await page.evaluate((lvl, msg) => {
      console[lvl](`[Replay] ${msg}`);
    }, level, message);
    
    this.logger.debug(`Logged to console (${level}): ${message}`);
  }

  /**
   * Replay request action
   */
  async replayRequest(page, action, options) {
    if (options.dryRun) {
      this.logger.info(`[DRY RUN] Would make request: ${action.method} ${action.url}`);
      return;
    }
    
    // This would require more complex implementation
    // For now, just log the action
    this.logger.debug(`Request action: ${action.method} ${action.url}`);
  }

  /**
   * Replay response action
   */
  async replayResponse(page, action, options) {
    if (options.dryRun) {
      this.logger.info(`[DRY RUN] Would handle response: ${action.status} ${action.url}`);
      return;
    }
    
    // This would require more complex implementation
    // For now, just log the action
    this.logger.debug(`Response action: ${action.status} ${action.url}`);
  }

  /**
   * Handle action error with recovery strategies
   */
  async handleActionError(page, action, actionIndex, error, options, replayResults) {
    this.logger.info(`Attempting recovery for action ${actionIndex}: ${action.type}`);
    
    const recoveryResult = {
      success: false,
      attempts: 0,
      strategy: null,
      finalError: error
    };
    
    for (let attempt = 1; attempt <= this.maxRetryAttempts; attempt++) {
      recoveryResult.attempts++;
      
      try {
        // Wait before retry
        await this.sleep(this.retryDelay * attempt);
        
        // Apply recovery strategy based on action type
        const strategy = this.getRecoveryStrategy(action, error, attempt);
        recoveryResult.strategy = strategy;
        
        this.logger.info(`Recovery attempt ${attempt} using strategy: ${strategy.name}`);
        
        // Execute recovery strategy
        await strategy.execute(page, action, error);
        
        // Retry the original action
        await this.replayAction(page, action, actionIndex, options, replayResults);
        
        recoveryResult.success = true;
        this.logger.info(`Recovery successful for action ${actionIndex}`);
        break;
      } catch (recoveryError) {
        recoveryResult.finalError = recoveryError.message;
        this.logger.warn(`Recovery attempt ${attempt} failed: ${recoveryError.message}`);
      }
    }
    
    return recoveryResult;
  }

  /**
   * Get recovery strategy for action error
   */
  getRecoveryStrategy(action, error, attempt) {
    const strategies = {
      // Navigation errors
      navigation: {
        name: 'retry-navigation',
        execute: async (page, action, error) => {
          await page.reload({ waitUntil: 'networkidle2' });
          await this.sleep(2000);
        }
      },
      
      // Element not found errors
      elementNotFound: {
        name: 'wait-and-retry',
        execute: async (page, action, error) => {
          await this.sleep(3000);
          await page.reload({ waitUntil: 'networkidle2' });
        }
      },
      
      // Timeout errors
      timeout: {
        name: 'increase-timeout',
        execute: async (page, action, error) => {
          await this.sleep(5000);
          await page.evaluate(() => window.location.reload());
        }
      },
      
      // Network errors
      network: {
        name: 'retry-with-delay',
        execute: async (page, action, error) => {
          await this.sleep(5000);
          await page.reload({ waitUntil: 'networkidle2' });
        }
      },
      
      // Default strategy
      default: {
        name: 'generic-retry',
        execute: async (page, action, error) => {
          await this.sleep(2000);
          await page.reload({ waitUntil: 'networkidle2' });
        }
      }
    };
    
    // Determine strategy based on error and action type
    if (error.includes('timeout') || error.includes('Timeout')) {
      return strategies.timeout;
    } else if (error.includes('not found') || error.includes('selector')) {
      return strategies.elementNotFound;
    } else if (error.includes('network') || error.includes('net::')) {
      return strategies.network;
    } else if (action.type === 'NAVIGATION') {
      return strategies.navigation;
    } else {
      return strategies.default;
    }
  }

  /**
   * Take screenshot for action
   */
  async takeActionScreenshot(page, actionIndex, replayResults) {
    try {
      const screenshotPath = path.join(
        this.tempDir, 
        `replay-${replayResults.sessionId}-action-${actionIndex}-${Date.now()}.png`
      );
      
      await page.screenshot({ 
        path: screenshotPath, 
        fullPage: true,
        type: 'png'
      });
      
      const screenshot = {
        path: screenshotPath,
        actionIndex,
        timestamp: new Date().toISOString(),
        size: (await fs.stat(screenshotPath)).size
      };
      
      replayResults.screenshots.push(screenshot);
      return screenshot;
    } catch (error) {
      this.logger.warn(`Failed to take screenshot for action ${actionIndex}:`, error);
      return null;
    }
  }

  /**
   * Compare two screenshots
   */
  async compareScreenshots(originalScreenshot, newScreenshot, options) {
    try {
      const comparison = {
        original: originalScreenshot,
        new: newScreenshot,
        similarity: 0,
        differences: [],
        passed: false
      };
      
      // For now, use a simple file size comparison
      // In a real implementation, you would use image comparison libraries
      const originalSize = originalScreenshot.size || 0;
      const newSize = newScreenshot.size || 0;
      
      if (originalSize > 0 && newSize > 0) {
        const sizeDiff = Math.abs(originalSize - newSize) / Math.max(originalSize, newSize);
        comparison.similarity = 1 - sizeDiff;
      } else {
        comparison.similarity = 0;
      }
      
      comparison.passed = comparison.similarity >= this.screenshotThreshold;
      
      return comparison;
    } catch (error) {
      this.logger.error('Screenshot comparison failed:', error);
      return {
        original: originalScreenshot,
        new: newScreenshot,
        similarity: 0,
        differences: [error.message],
        passed: false
      };
    }
  }

  /**
   * Perform visual verification using GLM-4.5V
   */
  async performVisualVerification(page, action, screenshot, options) {
    if (!this.glmApiKey) {
      return {
        enabled: false,
        reason: 'GLM API key not provided'
      };
    }
    
    try {
      const analysis = await this.analyzeScreenshotWithGLM(
        screenshot.path, 
        `Verify that this screenshot shows the expected state after action: ${action.type}`
      );
      
      return {
        enabled: true,
        analysis,
        passed: analysis.confidence >= 0.8,
        confidence: analysis.confidence,
        description: analysis.description
      };
    } catch (error) {
      this.logger.error('Visual verification failed:', error);
      return {
        enabled: true,
        error: error.message,
        passed: false
      };
    }
  }

  /**
   * Analyze screenshot with GLM-4.5V
   */
  async analyzeScreenshotWithGLM(screenshotPath, prompt) {
    try {
      // This would integrate with GLM-4.5V API
      // For now, return a mock analysis
      return {
        confidence: 0.95,
        description: `Visual analysis of screenshot: ${prompt}`,
        elements: [],
        text: [],
        layout: {}
      };
    } catch (error) {
      this.logger.error('GLM analysis failed:', error);
      throw error;
    }
  }

  /**
   * Apply initial state to page
   */
  async applyInitialState(page, initialState) {
    try {
      this.logger.info('Applying initial browser state...');
      
      // Navigate to original URL
      if (initialState.pageInfo && initialState.pageInfo.url) {
        await page.goto(initialState.pageInfo.url, { waitUntil: 'networkidle2' });
      }
      
      // Apply cookies
      if (initialState.cookies && initialState.cookies.length > 0) {
        await page.setCookie(...initialState.cookies);
      }
      
      // Apply localStorage
      if (initialState.localStorage && initialState.localStorage.storage) {
        await page.evaluate((storage) => {
          localStorage.clear();
          Object.entries(storage).forEach(([key, value]) => {
            const val = typeof value === 'object' ? value.value : value;
            localStorage.setItem(key, val);
          });
        }, initialState.localStorage.storage);
      }
      
      // Apply sessionStorage
      if (initialState.sessionStorage && initialState.sessionStorage.storage) {
        await page.evaluate((storage) => {
          sessionStorage.clear();
          Object.entries(storage).forEach(([key, value]) => {
            const val = typeof value === 'object' ? value.value : value;
            sessionStorage.setItem(key, val);
          });
        }, initialState.sessionStorage.storage);
      }
      
      this.logger.info('Initial state applied successfully');
    } catch (error) {
      this.logger.error('Failed to apply initial state:', error);
      throw new Error(`Initial state application failed: ${error.message}`);
    }
  }

  /**
   * Calculate delay between actions based on timing
   */
  calculateActionDelay(currentAction, nextAction, speedMultiplier) {
    if (!nextAction) return 0;
    
    const currentTime = new Date(currentAction.timestamp).getTime();
    const nextTime = new Date(nextAction.timestamp).getTime();
    const originalDelay = nextTime - currentTime;
    
    // Apply speed multiplier
    return Math.max(0, originalDelay / speedMultiplier);
  }

  /**
   * Sleep helper function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Ensure temporary directory exists
   */
  ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Generate replay report
   */
  generateReplayReport(replayResults) {
    const report = {
      summary: {
        sessionId: replayResults.sessionId,
        success: replayResults.success,
        duration: replayResults.duration,
        totalActions: replayResults.totalActions,
        successfulActions: replayResults.successfulActions,
        failedActions: replayResults.failedActions,
        retriedActions: replayResults.retriedActions,
        skippedActions: replayResults.skippedActions,
        successRate: replayResults.totalActions > 0 
          ? (replayResults.successfulActions / replayResults.totalActions * 100).toFixed(2) + '%'
          : '0%'
      },
      performance: {
        originalDuration: replayResults.performance.originalDuration,
        replayDuration: replayResults.performance.replayDuration,
        speedRatio: replayResults.performance.speedRatio.toFixed(2),
        speedImprovement: replayResults.performance.speedRatio > 1 
          ? `${((replayResults.performance.speedRatio - 1) * 100).toFixed(2)}% faster`
          : `${((1 - replayResults.performance.speedRatio) * 100).toFixed(2)}% slower`
      },
      recovery: {
        attempts: replayResults.recovery.attempts,
        successful: replayResults.recovery.successful,
        successRate: replayResults.recovery.attempts > 0
          ? (replayResults.recovery.successful / replayResults.recovery.attempts * 100).toFixed(2) + '%'
          : '0%'
      },
      errors: replayResults.errors,
      screenshots: replayResults.screenshots.length,
      actions: replayResults.actions.map(action => ({
        index: action.actionIndex,
        type: action.type,
        success: action.success,
        duration: action.duration,
        error: action.error,
        recovered: action.recovered,
        screenshotComparison: action.screenshotComparison?.passed || null
      }))
    };
    
    return report;
  }

  /**
   * Save replay results to file
   */
  async saveReplayResults(replayResults, outputPath) {
    try {
      const report = this.generateReplayReport(replayResults);
      await fs.writeJson(outputPath, report, { spaces: 2 });
      
      this.logger.info(`Replay results saved to: ${outputPath}`);
      return outputPath;
    } catch (error) {
      this.logger.error('Failed to save replay results:', error);
      throw new Error(`Replay results save failed: ${error.message}`);
    }
  }
}

module.exports = ReplayEngine;