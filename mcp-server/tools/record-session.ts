import { 
  RecordSessionInput, 
  ToolResponse, 
  ServerConfig, 
  SessionRecording,
  BrowserState 
} from '../types.js';
import { MitmproxyController } from '../../src/lib/mitmproxy-controller.js';
import { BrowserStateCapture } from '../lib/browser-state-capture.js';
import * as winston from 'winston';
import * as puppeteer from 'puppeteer-extra';
import { v4 as uuidv4 } from 'uuid';

/**
 * Record Session Tool
 * Records complete automation session for replay
 */
export class RecordSessionTool {
  private config: ServerConfig;
  private logger: winston.Logger;
  private mitmproxyController: MitmproxyController;
  private browserStateCapture: BrowserStateCapture;
  private activeRecordings: Map<string, any> = new Map();

  constructor(config: ServerConfig, logger: winston.Logger) {
    this.config = config;
    this.logger = logger;
    
    this.mitmproxyController = new MitmproxyController({
      port: config.mitmproxy.port,
      host: config.mitmproxy.host,
      harOutput: config.mitmproxy.harOutput,
      sessionsDir: config.sessions.storageDir
    });
    
    this.browserStateCapture = new BrowserStateCapture(
      config.integuru.tempDir,
      logger
    );
  }

  /**
   * Execute record session tool
   */
  async execute(input: RecordSessionInput): Promise<ToolResponse> {
    const sessionId = input.sessionId || uuidv4();
    const {
      taskDescription,
      captureLevel = 3,
      includeScreenshots = true,
      autoStop = true,
      timeoutMinutes = 30
    } = input;

    this.logger.info(`Starting record-session for session ${sessionId}`, {
      taskDescription,
      captureLevel,
      includeScreenshots,
      autoStop,
      timeoutMinutes
    });

    try {
      // Step 1: Initialize session recording
      const recording = await this.initializeRecording(sessionId, {
        taskDescription,
        captureLevel,
        includeScreenshots,
        autoStop,
        timeoutMinutes
      });
      
      this.activeRecordings.set(sessionId, recording);

      // Step 2: Start network capture
      await this.startNetworkCapture(sessionId, captureLevel);
      
      // Step 3: Launch browser for recording
      const browser = await this.launchRecordingBrowser();
      const page = await browser.newPage();
      
      // Step 4: Setup recording hooks
      await this.setupRecordingHooks(page, recording);
      
      // Step 5: Capture initial state
      const initialState = await this.browserStateCapture.captureBrowserState(page);
      recording.initialBrowserState = initialState;
      
      // Step 6: Wait for recording completion
      const recordingResult = await this.waitForRecordingCompletion(
        page, 
        recording, 
        timeoutMinutes * 60 * 1000
      );
      
      // Step 7: Capture final state
      const finalState = await this.browserStateCapture.captureBrowserState(page);
      recording.finalBrowserState = finalState;
      
      // Step 8: Stop network capture
      const networkData = await this.stopNetworkCapture();
      recording.networkCapture = networkData;
      
      // Step 9: Finalize recording
      await this.finalizeRecording(recording);
      
      // Step 10: Cleanup
      await browser.close();
      this.activeRecordings.delete(sessionId);
      
      const result = {
        sessionId,
        status: recordingResult.success ? 'success' : 'stopped',
        taskDescription,
        recordingDuration: recording.endTime.getTime() - recording.startTime.getTime(),
        actionsRecorded: recording.actions.length,
        networkRequests: networkData.requestCount,
        screenshotsTaken: recording.screenshots.length,
        captureLevel,
        autoStop: recordingResult.autoStopped,
        recordingFile: `${this.config.sessions.storageDir}/${sessionId}.json`
      };

      this.logger.info(`Record-session completed for session ${sessionId}`, result);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };

    } catch (error) {
      this.logger.error(`Record-session failed for session ${sessionId}`, error);
      
      // Cleanup on error
      this.activeRecordings.delete(sessionId);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              sessionId,
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
   * Initialize session recording
   */
  private async initializeRecording(sessionId: string, options: any): Promise<SessionRecording> {
    this.logger.info(`Initializing recording for session ${sessionId}`);
    
    const recording: SessionRecording = {
      sessionId,
      task: options.taskDescription,
      startTime: new Date(),
      actions: [],
      screenshots: [],
      metadata: {
        captureLevel: options.captureLevel,
        includeScreenshots: options.includeScreenshots,
        autoStop: options.autoStop,
        timeoutMinutes: options.timeoutMinutes
      }
    };

    return recording;
  }

  /**
   * Start network capture
   */
  private async startNetworkCapture(sessionId: string, captureLevel: number): Promise<void> {
    this.logger.info(`Starting network capture for session ${sessionId} at level ${captureLevel}`);
    
    await this.mitmproxyController.start({
      sessionId,
      recordLevel: captureLevel,
      harOutput: `${this.config.sessions.storageDir}/${sessionId}.har`
    });
  }

  /**
   * Launch browser for recording
   */
  private async launchRecordingBrowser(): Promise<puppeteer.Browser> {
    this.logger.info('Launching browser for recording');
    
    const launchOptions = {
      headless: this.config.chrome.headless,
      userDataDir: this.config.chrome.userDataDir,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--exclude-switches=enable-automation',
        '--disable-automation',
        '--disable-ipc-flooding-protection',
        `--proxy-server=${this.config.mitmproxy.host}:${this.config.mitmproxy.port}`
      ],
      defaultViewport: {
        width: 1920,
        height: 1080
      }
    };

    // Add extensions if provided
    if (this.config.chrome.extensions.length > 0) {
      launchOptions.args.push(`--load-extension=${this.config.chrome.extensions.join(',')}`);
    }

    return await (puppeteer as any).launch(launchOptions);
  }

  /**
   * Setup recording hooks on page
   */
  private async setupRecordingHooks(page: puppeteer.Page, recording: SessionRecording): Promise<void> {
    this.logger.info('Setting up recording hooks');
    
    // Hook into console for logging
    page.on('console', (msg) => {
      this.recordAction(recording, {
        timestamp: new Date(),
        type: 'CONSOLE_LOG',
        data: {
          type: msg.type(),
          text: msg.text(),
          location: msg.location()
        }
      });
    });

    // Hook into page errors
    page.on('pageerror', (error) => {
      this.recordAction(recording, {
        timestamp: new Date(),
        type: 'PAGE_ERROR',
        data: {
          message: error.message,
          stack: error.stack
        }
      });
    });

    // Hook into request/response
    page.on('request', (request) => {
      this.recordAction(recording, {
        timestamp: new Date(),
        type: 'REQUEST',
        data: {
          url: request.url(),
          method: request.method(),
          headers: request.headers(),
          resourceType: request.resourceType()
        }
      });
    });

    page.on('response', (response) => {
      this.recordAction(recording, {
        timestamp: new Date(),
        type: 'RESPONSE',
        data: {
          url: response.url(),
          status: response.status(),
          headers: response.headers(),
          resourceType: response.resourceType()
        }
      });
    });

    // Setup CDP command interception
    const client = await page.target().createCDPSession();
    
    client.on('Runtime.consoleAPICalled', (event) => {
      this.recordAction(recording, {
        timestamp: new Date(),
        type: 'CDP_CONSOLE',
        data: event
      });
    });

    client.on('Page.screencastFrame', async (event) => {
      if (recording.metadata?.includeScreenshots) {
        await this.captureScreenshot(page, recording);
      }
    });
  }

  /**
   * Record an action in the session
   */
  private recordAction(recording: SessionRecording, action: any): void {
    recording.actions.push({
      timestamp: action.timestamp,
      type: action.type,
      method: action.data?.method,
      params: action.data,
      response: action.data,
      duration: 0,
      success: true
    });
  }

  /**
   * Capture screenshot
   */
  private async captureScreenshot(page: puppeteer.Page, recording: SessionRecording): Promise<void> {
    try {
      const screenshot = await page.screenshot({ 
        encoding: 'base64',
        fullPage: true 
      });
      
      if (typeof screenshot === 'string') {
        recording.screenshots.push({
          timestamp: new Date(),
          data: screenshot,
          actionIndex: recording.actions.length
        });
      }
    } catch (error) {
      this.logger.warn('Failed to capture screenshot', error);
    }
  }

  /**
   * Wait for recording completion
   */
  private async waitForRecordingCompletion(
    page: puppeteer.Page,
    recording: SessionRecording,
    timeoutMs: number
  ): Promise<{ success: boolean; autoStopped: boolean }> {
    this.logger.info(`Waiting for recording completion (timeout: ${timeoutMs}ms)`);
    
    return new Promise((resolve) => {
      const startTime = Date.now();
      let lastActivityTime = Date.now();
      let inactivityTimer: NodeJS.Timeout | null = null;

      // Check for activity
      const checkActivity = () => {
        const now = Date.now();
        const timeSinceActivity = now - lastActivityTime;
        const timeSinceStart = now - startTime;

        // Auto-stop on inactivity if enabled
        if (recording.metadata?.autoStop && timeSinceActivity > 30000) { // 30 seconds
          if (inactivityTimer) {
            clearTimeout(inactivityTimer);
          }
          
          recording.endTime = new Date();
          resolve({ success: true, autoStopped: true });
          return;
        }

        // Timeout reached
        if (timeSinceStart >= timeoutMs) {
          if (inactivityTimer) {
            clearTimeout(inactivityTimer);
          }
          
          recording.endTime = new Date();
          resolve({ success: true, autoStopped: false });
          return;
        }

        // Continue checking
        setTimeout(checkActivity, 1000);
      };

      // Monitor page activity
      const updateActivity = () => {
        lastActivityTime = Date.now();
        
        // Reset inactivity timer
        if (inactivityTimer) {
          clearTimeout(inactivityTimer);
        }
        
        if (recording.metadata?.autoStop) {
          inactivityTimer = setTimeout(() => {
            recording.endTime = new Date();
            resolve({ success: true, autoStopped: true });
          }, 30000); // 30 seconds of inactivity
        }
      };

      // Setup activity monitoring
      page.on('load', updateActivity);
      page.on('mousemove', updateActivity);
      page.on('click', updateActivity);
      page.on('keypress', updateActivity);

      // Start checking
      setTimeout(checkActivity, 1000);
    });
  }

  /**
   * Stop network capture
   */
  private async stopNetworkCapture(): Promise<any> {
    this.logger.info('Stopping network capture');
    
    const result = await this.mitmproxyController.stop();
    const sessionFiles = await this.mitmproxyController.getSessionFiles();
    
    return {
      sessionId: result.sessionId,
      harFile: sessionFiles.har,
      startTime: new Date(result.startTime),
      endTime: new Date(),
      requestCount: 0, // Would be calculated from HAR
      domains: [], // Would be extracted from HAR
      size: 0 // Would be calculated from HAR
    };
  }

  /**
   * Finalize recording
   */
  private async finalizeRecording(recording: SessionRecording): Promise<void> {
    this.logger.info(`Finalizing recording for session ${recording.sessionId}`);
    
    recording.endTime = new Date();
    
    // Save recording to file
    const recordingFile = `${this.config.sessions.storageDir}/${recording.sessionId}.json`;
    await require('fs-extra').writeJson(recordingFile, recording, { spaces: 2 });
    
    this.logger.info(`Recording saved to ${recordingFile}`);
  }

  /**
   * Get active recording
   */
  getActiveRecording(sessionId: string): SessionRecording | undefined {
    return this.activeRecordings.get(sessionId);
  }

  /**
   * Stop active recording
   */
  async stopRecording(sessionId: string): Promise<void> {
    const recording = this.activeRecordings.get(sessionId);
    if (recording) {
      recording.endTime = new Date();
      await this.finalizeRecording(recording);
      this.activeRecordings.delete(sessionId);
      this.logger.info(`Recording stopped for session ${sessionId}`);
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      // Stop all active recordings
      const activeSessionIds = Array.from(this.activeRecordings.keys());
      for (const sessionId of activeSessionIds) {
        await this.stopRecording(sessionId);
      }
      
      if (this.mitmproxyController) {
        await this.mitmproxyController.stop();
      }
      
      if (this.browserStateCapture) {
        await this.browserStateCapture.cleanup();
      }
      
      this.logger.info('Record-session tool cleanup completed');
    } catch (error) {
      this.logger.error('Cleanup failed', error);
    }
  }
}