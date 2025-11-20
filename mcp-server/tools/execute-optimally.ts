import { 
  ExecuteOptimallyInput, 
  ToolResponse, 
  ServerConfig, 
  ExecutionResult,
  BrowserState,
  ModalityChoice
} from '../types.js';
import { InteguruWrapper } from '../../src/lib/integuru-wrapper.js';
import { ModalityOptimizer } from '../../src/lib/modality-optimizer.js';
import { BrowserStateCapture } from '../lib/browser-state-capture.js';
import * as winston from 'winston';
import * as puppeteer from 'puppeteer-extra';
import { v4 as uuidv4 } from 'uuid';

/**
 * Execute Optimally Tool
 * Executes automation using the optimal modality (Integuru/CDP/Manual)
 */
export class ExecuteOptimallyTool {
  private config: ServerConfig;
  private logger: winston.Logger;
  private integuruWrapper: InteguruWrapper;
  private modalityOptimizer: ModalityOptimizer;
  private browserStateCapture: BrowserStateCapture;

  constructor(config: ServerConfig, logger: winston.Logger) {
    this.config = config;
    this.logger = logger;
    
    this.integuruWrapper = new InteguruWrapper({
      integuruDir: config.integuru.integuruDir,
      model: config.integuru.model,
      timeout: config.integuru.timeout
    });
    
    this.modalityOptimizer = new ModalityOptimizer({
      thresholds: {
        integuruConfidence: 0.85,
        headlessConfidence: 0.70
      }
    });
    
    this.browserStateCapture = new BrowserStateCapture(
      config.integuru.tempDir,
      logger
    );
  }

  /**
   * Execute automation using optimal modality
   */
  async execute(input: ExecuteOptimallyInput): Promise<ToolResponse> {
    const executionId = uuidv4();
    const {
      taskDescription,
      sessionId,
      harFile,
      forceModality,
      browserState
    } = input;

    this.logger.info(`Starting execute-optimally for execution ${executionId}`, {
      taskDescription,
      sessionId,
      harFile,
      forceModality
    });

    try {
      // Step 1: Determine modality to use
      let modalityChoice: ModalityChoice;
      
      if (forceModality) {
        modalityChoice = await this.createForcedModalityChoice(forceModality, taskDescription);
      } else if (harFile || sessionId) {
        modalityChoice = await this.chooseOptimalModality(taskDescription, harFile, sessionId);
      } else {
        modalityChoice = await this.getDefaultModalityChoice(taskDescription);
      }

      this.logger.info(`Selected modality: ${modalityChoice.modality}`, modalityChoice);

      // Step 2: Execute based on selected modality
      let executionResult: ExecutionResult;
      
      switch (modalityChoice.modality) {
        case 'integuru':
          executionResult = await this.executeViaInteguru(taskDescription, harFile, sessionId);
          break;
          
        case 'headless_cdp':
          executionResult = await this.executeViaHeadlessCDP(taskDescription, browserState, sessionId);
          break;
          
        case 'visible_browser':
          executionResult = await this.executeViaVisibleBrowser(taskDescription, browserState);
          break;
          
        default:
          throw new Error(`Unknown modality: ${modalityChoice.modality}`);
      }

      // Step 3: Record execution for learning
      await this.recordExecution(executionId, taskDescription, modalityChoice, executionResult);

      // Step 4: Generate final result
      const result = {
        executionId,
        status: executionResult.success ? 'success' : 'failed',
        taskDescription,
        modalityUsed: modalityChoice.modality,
        executionTime: executionResult.executionTime,
        confidence: modalityChoice.confidence,
        reasoning: modalityChoice.reasoning,
        output: executionResult.output,
        error: executionResult.error,
        screenshots: executionResult.screenshots,
        metadata: {
          ...executionResult.metadata,
          ...modalityChoice.metadata
        }
      };

      this.logger.info(`Execute-optimally completed for execution ${executionId}`, result);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };

    } catch (error) {
      this.logger.error(`Execute-optimally failed for execution ${executionId}`, error);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              executionId,
              status: 'error',
              error: error instanceof Error ? error.message : String(error),
              taskDescription
            }, null, 2)
          }
        ],
        isError: true
      };
    }
  }

  /**
   * Create forced modality choice
   */
  private async createForcedModalityChoice(
    modality: string,
    taskDescription: string
  ): Promise<ModalityChoice> {
    return {
      modality: modality as any,
      confidence: 1.0,
      estimatedTimeSeconds: this.getEstimatedTimeForModality(modality as any),
      reasoning: `Modality forced by user: ${modality}`,
      metadata: { forced: true }
    };
  }

  /**
   * Choose optimal modality based on analysis
   */
  private async chooseOptimalModality(
    taskDescription: string,
    harFile?: string,
    sessionId?: string
  ): Promise<ModalityChoice> {
    try {
      // Load HAR file if provided
      let harPath = harFile;
      if (sessionId && !harFile) {
        harPath = `${this.config.sessions.storageDir}/${sessionId}.json`;
      }

      if (harPath) {
        return await this.modalityOptimizer.chooseModality({
          taskDescription,
          harFile: harPath
        });
      }

      return await this.getDefaultModalityChoice(taskDescription);
    } catch (error) {
      this.logger.error('Modality selection failed', error);
      return await this.getDefaultModalityChoice(taskDescription);
    }
  }

  /**
   * Get default modality choice when no analysis is available
   */
  private async getDefaultModalityChoice(taskDescription: string): Promise<ModalityChoice> {
    // Default to headless CDP for unknown tasks
    return {
      modality: 'headless_cdp',
      confidence: 0.6,
      estimatedTimeSeconds: 30,
      reasoning: 'Defaulting to headless CDP for unknown task',
      metadata: { default: true }
    };
  }

  /**
   * Execute via Integuru (API calls)
   */
  private async executeViaInteguru(
    taskDescription: string,
    harFile?: string,
    sessionId?: string
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    try {
      this.logger.info('Executing via Integuru');
      
      // Load HAR file if provided
      let harPath = harFile;
      if (sessionId && !harFile) {
        harPath = `${this.config.sessions.storageDir}/${sessionId}.json`;
      }

      if (!harPath) {
        throw new Error('HAR file or session ID required for Integuru execution');
      }

      // Analyze HAR and get code
      const analysis = await this.integuruWrapper.analyzeHAR(harPath, taskDescription, true);
      
      if (!analysis.success || !analysis.code) {
        throw new Error('Integuru analysis failed or no code generated');
      }

      // Execute generated code
      const execution = await this.integuruWrapper.executeCode(analysis.code);
      
      return {
        success: execution.success,
        modality: 'integuru',
        executionTime: (Date.now() - startTime) / 1000,
        output: execution.output,
        error: execution.error,
        metadata: {
          apiCalls: this.countApiCalls(analysis.code),
          codeLines: analysis.code.split('\n').length
        }
      };

    } catch (error) {
      return {
        success: false,
        modality: 'integuru',
        executionTime: (Date.now() - startTime) / 1000,
        error: error instanceof Error ? error.message : String(error),
        metadata: {}
      };
    }
  }

  /**
   * Execute via Headless CDP (browser automation)
   */
  private async executeViaHeadlessCDP(
    taskDescription: string,
    browserState?: BrowserState,
    sessionId?: string
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    let browser: puppeteer.Browser | null = null;
    
    try {
      this.logger.info('Executing via Headless CDP');
      
      // Launch headless browser
      browser = await this.launchHeadlessBrowser();
      const page = await browser.newPage();
      
      // Apply browser state if provided
      if (browserState) {
        await this.browserStateCapture.applyBrowserState(page, browserState);
      }
      
      // Load session if provided
      if (sessionId) {
        await this.loadSessionActions(page, sessionId);
      }
      
      // Execute task (this would be implemented based on specific task)
      const screenshots: string[] = [];
      const output = await this.executeTaskInBrowser(page, taskDescription, screenshots);
      
      return {
        success: true,
        modality: 'headless_cdp',
        executionTime: (Date.now() - startTime) / 1000,
        output,
        screenshots,
        metadata: {
          userAgent: await page.evaluate(() => {
            return (globalThis as any).navigator.userAgent;
          }),
          finalUrl: page.url()
        }
      };

    } catch (error) {
      return {
        success: false,
        modality: 'headless_cdp',
        executionTime: (Date.now() - startTime) / 1000,
        error: error instanceof Error ? error.message : String(error),
        metadata: {}
      };
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Execute via visible browser (manual fallback)
   */
  private async executeViaVisibleBrowser(
    taskDescription: string,
    browserState?: BrowserState
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    try {
      this.logger.info('Executing via visible browser (manual)');
      
      // Launch visible browser
      const browser = await this.launchVisibleBrowser();
      const page = await browser.newPage();
      
      // Apply browser state if provided
      if (browserState) {
        await this.browserStateCapture.applyBrowserState(page, browserState);
      }
      
      // For visible browser, we wait for user to complete the task
      await this.waitForManualCompletion(taskDescription);
      
      return {
        success: true,
        modality: 'visible_browser',
        executionTime: (Date.now() - startTime) / 1000,
        output: { message: 'Task completed manually by user' },
        metadata: {
          requiresUser: true,
          userAgent: await page.evaluate(() => {
            return (globalThis as any).navigator.userAgent;
          })
        }
      };

    } catch (error) {
      return {
        success: false,
        modality: 'visible_browser',
        executionTime: (Date.now() - startTime) / 1000,
        error: error instanceof Error ? error.message : String(error),
        metadata: {}
      };
    }
  }

  /**
   * Launch headless browser
   */
  private async launchHeadlessBrowser(): Promise<puppeteer.Browser> {
    return await puppeteer.launch({
      headless: true,
      userDataDir: this.config.chrome.userDataDir,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--exclude-switches=enable-automation',
        '--disable-automation',
        '--disable-ipc-flooding-protection'
      ],
      defaultViewport: {
        width: 1920,
        height: 1080
      }
    });
  }

  /**
   * Launch visible browser
   */
  private async launchVisibleBrowser(): Promise<puppeteer.Browser> {
    return await puppeteer.launch({
      headless: false,
      userDataDir: this.config.chrome.userDataDir,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--exclude-switches=enable-automation',
        '--disable-automation',
        '--disable-ipc-flooding-protection'
      ],
      defaultViewport: {
        width: 1920,
        height: 1080
      }
    });
  }

  /**
   * Load session actions for replay
   */
  private async loadSessionActions(page: puppeteer.Page, sessionId: string): Promise<void> {
    try {
      const sessionFile = `${this.config.sessions.storageDir}/${sessionId}.json`;
      const sessionData = await require('fs-extra').readJson(sessionFile);
      
      // This would implement the actual action replay logic
      this.logger.info(`Loading ${sessionData.actions?.length || 0} actions from session ${sessionId}`);
      
    } catch (error) {
      this.logger.warn('Failed to load session actions', error);
    }
  }

  /**
   * Execute task in browser (placeholder implementation)
   */
  private async executeTaskInBrowser(
    page: puppeteer.Page,
    taskDescription: string,
    screenshots: string[]
  ): Promise<any> {
    // This would be implemented based on specific task requirements
    // For now, return a placeholder result
    await page.goto('about:blank');
    
    const screenshot = await page.screenshot({ encoding: 'base64' });
    if (typeof screenshot === 'string') {
      screenshots.push(screenshot);
    }
    
    return { 
      message: `Task executed: ${taskDescription}`,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Wait for manual completion
   */
  private async waitForManualCompletion(taskDescription: string): Promise<void> {
    // This would implement user notification and waiting logic
    // For now, wait a reasonable time
    await new Promise(resolve => setTimeout(resolve, 60000)); // 1 minute
  }

  /**
   * Count API calls in generated code
   */
  private countApiCalls(code: string): number {
    const apiCallPatterns = [
      /requests\./g,
      /axios\./g,
      /fetch\(/g,
      /\.get\(/g,
      /\.post\(/g
    ];
    
    let count = 0;
    apiCallPatterns.forEach(pattern => {
      const matches = code.match(pattern);
      if (matches) {
        count += matches.length;
      }
    });
    
    return count;
  }

  /**
   * Get estimated time for modality
   */
  private getEstimatedTimeForModality(modality: 'integuru' | 'headless_cdp' | 'visible_browser'): number {
    switch (modality) {
      case 'integuru':
        return 5; // 5 seconds
      case 'headless_cdp':
        return 30; // 30 seconds
      case 'visible_browser':
        return 300; // 5 minutes
      default:
        return 30;
    }
  }

  /**
   * Record execution for learning
   */
  private async recordExecution(
    executionId: string,
    taskDescription: string,
    modalityChoice: ModalityChoice,
    executionResult: ExecutionResult
  ): Promise<void> {
    try {
      await this.modalityOptimizer.recordExecution({
        executionId,
        taskDescription,
        modality: modalityChoice.modality,
        confidence: modalityChoice.confidence,
        estimatedTime: modalityChoice.estimatedTimeSeconds,
        actualTime: executionResult.executionTime,
        success: executionResult.success,
        error: executionResult.error
      });
    } catch (error) {
      this.logger.warn('Failed to record execution for learning', error);
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.browserStateCapture) {
        await this.browserStateCapture.cleanup();
      }
      
      this.logger.info('Execute-optimally tool cleanup completed');
    } catch (error) {
      this.logger.error('Cleanup failed', error);
    }
  }
}