"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReplayAutomationTool = void 0;
const browser_state_capture_js_1 = require("../lib/browser-state-capture.js");
const puppeteer = __importStar(require("puppeteer-extra"));
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
/**
 * Replay Automation Tool
 * Replays a previously recorded automation session
 */
class ReplayAutomationTool {
    config;
    logger;
    browserStateCapture;
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
        this.browserStateCapture = new browser_state_capture_js_1.BrowserStateCapture(config.integuru.tempDir, logger);
    }
    /**
     * Execute replay automation tool
     */
    async execute(input) {
        const replayId = `replay-${Date.now()}`;
        const { sessionId, actionIndex, speedMultiplier = 1.0, skipScreenshots = false, dryRun = false } = input;
        this.logger.info(`Starting replay-automation ${replayId}`, {
            sessionId,
            actionIndex,
            speedMultiplier,
            skipScreenshots,
            dryRun
        });
        try {
            // Step 1: Load session recording
            const recording = await this.loadSessionRecording(sessionId);
            if (!recording) {
                throw new Error(`Session recording not found: ${sessionId}`);
            }
            // Step 2: Validate recording
            this.validateRecording(recording);
            // Step 3: Prepare actions for replay
            const actionsToReplay = this.prepareActionsForReplay(recording.actions, actionIndex, speedMultiplier);
            this.logger.info(`Preparing to replay ${actionsToReplay.length} actions`);
            // Step 4: Launch browser for replay
            const browser = await this.launchReplayBrowser(dryRun);
            const page = await browser.newPage();
            // Step 5: Apply initial browser state if available
            if (recording.initialBrowserState) {
                await this.browserStateCapture.applyBrowserState(page, recording.initialBrowserState);
            }
            // Step 6: Execute replay
            const replayResult = await this.executeReplay(page, actionsToReplay, skipScreenshots, dryRun);
            // Step 7: Capture final state if available
            let finalState = null;
            if (recording.finalBrowserState && !dryRun) {
                finalState = await this.browserStateCapture.captureBrowserState(page);
            }
            // Step 8: Cleanup
            await browser.close();
            const result = {
                replayId,
                sessionId,
                status: replayResult.success ? 'success' : 'failed',
                actionsReplayed: replayResult.actionsExecuted,
                totalActions: actionsToReplay.length,
                executionTime: replayResult.executionTime,
                speedMultiplier,
                skipScreenshots,
                dryRun,
                screenshotsTaken: replayResult.screenshots?.length || 0,
                errors: replayResult.errors,
                finalState: finalState ? {
                    url: finalState.url,
                    title: finalState.title,
                    cookieCount: finalState.cookies?.length || 0
                } : null,
                metadata: {
                    originalTask: recording.task,
                    originalDuration: recording.endTime && recording.startTime
                        ? recording.endTime.getTime() - recording.startTime.getTime()
                        : 0,
                    replayDuration: replayResult.executionTime
                }
            };
            this.logger.info(`Replay-automation completed ${replayId}`, result);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(result, null, 2)
                    }
                ]
            };
        }
        catch (error) {
            this.logger.error(`Replay-automation failed ${replayId}`, error);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            replayId,
                            sessionId,
                            status: 'error',
                            error: error instanceof Error ? error.message : String(error)
                        }, null, 2)
                    }
                ],
                isError: true
            };
        }
    }
    /**
     * Load session recording from file
     */
    async loadSessionRecording(sessionId) {
        try {
            const recordingFile = `${this.config.sessions.storageDir}/${sessionId}.json`;
            if (!await fs.pathExists(recordingFile)) {
                this.logger.error(`Session recording file not found: ${recordingFile}`);
                return null;
            }
            const recording = await fs.readJson(recordingFile);
            this.logger.info(`Loaded session recording: ${sessionId}`);
            return recording;
        }
        catch (error) {
            this.logger.error(`Failed to load session recording: ${sessionId}`, error);
            return null;
        }
    }
    /**
     * Validate session recording
     */
    validateRecording(recording) {
        if (!recording.actions || recording.actions.length === 0) {
            throw new Error('Recording has no actions to replay');
        }
        if (!recording.startTime) {
            throw new Error('Recording missing start time');
        }
        this.logger.info(`Recording validation passed: ${recording.actions.length} actions`);
    }
    /**
     * Prepare actions for replay
     */
    prepareActionsForReplay(actions, speedMultiplier, actionIndex) {
        let actionsToReplay = actions;
        // If specific action index provided, only replay that action
        if (actionIndex !== undefined && actionIndex !== null) {
            if (actionIndex < 0 || actionIndex >= actions.length) {
                throw new Error(`Invalid action index: ${actionIndex}`);
            }
            actionsToReplay = [actions[actionIndex]];
        }
        // Apply speed multiplier to wait times
        return actionsToReplay.map(action => ({
            ...action,
            duration: action.duration && action.duration > 0
                ? Math.max(100, Math.floor(action.duration / speedMultiplier))
                : action.duration
        }));
    }
    /**
     * Launch browser for replay
     */
    async launchReplayBrowser(dryRun) {
        this.logger.info(`Launching browser for replay (dry run: ${dryRun})`);
        const launchOptions = {
            headless: dryRun ? true : this.config.chrome.headless,
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
        };
        // Add extensions if provided and not dry run
        if (!dryRun && this.config.chrome.extensions.length > 0) {
            launchOptions.args.push(`--load-extension=${this.config.chrome.extensions.join(',')}`);
        }
        return await puppeteer.launch(launchOptions);
    }
    /**
     * Execute replay actions
     */
    async executeReplay(page, actions, skipScreenshots, dryRun) {
        const startTime = Date.now();
        const screenshots = [];
        const errors = [];
        let actionsExecuted = 0;
        this.logger.info(`Executing ${actions.length} replay actions`);
        try {
            for (let i = 0; i < actions.length; i++) {
                const action = actions[i];
                try {
                    await this.executeAction(page, action, skipScreenshots, screenshots);
                    actionsExecuted++;
                    this.logger.debug(`Executed action ${i + 1}/${actions.length}: ${action.type}`);
                }
                catch (error) {
                    const errorMsg = `Action ${i + 1} failed: ${error instanceof Error ? error.message : String(error)}`;
                    errors.push(errorMsg);
                    this.logger.error(errorMsg);
                    // Continue with next action even if one fails
                }
                // Small delay between actions
                await this.sleep(100);
            }
            return {
                success: errors.length === 0,
                actionsExecuted,
                executionTime: (Date.now() - startTime) / 1000,
                screenshots: skipScreenshots ? [] : screenshots,
                errors
            };
        }
        catch (error) {
            return {
                success: false,
                actionsExecuted,
                executionTime: (Date.now() - startTime) / 1000,
                screenshots: skipScreenshots ? [] : screenshots,
                errors: [...errors, `Replay failed: ${error instanceof Error ? error.message : String(error)}`]
            };
        }
    }
    /**
     * Execute a single action
     */
    async executeAction(page, action, skipScreenshots, screenshots) {
        switch (action.type) {
            case 'CDP_COMMAND':
                if (action.method && action.params) {
                    await this.executeCDPCommand(page, action.method, action.params);
                }
                break;
            case 'NAVIGATION':
                if (action.params?.url) {
                    await page.goto(action.params.url, { waitUntil: 'networkidle2' });
                }
                break;
            case 'WAIT':
                if (action.duration && action.duration > 0) {
                    await this.sleep(action.duration);
                }
                break;
            case 'SCREENSHOT_ANALYSIS':
                if (!skipScreenshots) {
                    await this.captureReplayScreenshot(page, screenshots);
                }
                break;
            case 'REQUEST':
            case 'RESPONSE':
            case 'CONSOLE_LOG':
            case 'PAGE_ERROR':
            case 'CDP_CONSOLE':
                // These are informational actions, no execution needed
                break;
            default:
                this.logger.warn(`Unknown action type: ${action.type}`);
        }
    }
    /**
     * Execute CDP command
     */
    async executeCDPCommand(page, method, params) {
        try {
            const client = await page.target().createCDPSession();
            await client.send(method, params);
        }
        catch (error) {
            this.logger.warn(`CDP command failed: ${method}`, error);
        }
    }
    /**
     * Capture screenshot during replay
     */
    async captureReplayScreenshot(page, screenshots) {
        try {
            const screenshot = await page.screenshot({
                encoding: 'base64',
                fullPage: true
            });
            if (typeof screenshot === 'string') {
                screenshots.push(screenshot);
            }
        }
        catch (error) {
            this.logger.warn('Failed to capture replay screenshot', error);
        }
    }
    /**
     * Sleep helper
     */
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Get available session recordings
     */
    async getAvailableSessions() {
        try {
            const sessionsDir = this.config.sessions.storageDir;
            const files = await fs.readdir(sessionsDir);
            const sessions = [];
            for (const file of files) {
                if (file.endsWith('.json')) {
                    try {
                        const filePath = path.join(sessionsDir, file);
                        const stats = await fs.stat(filePath);
                        const recording = await fs.readJson(filePath);
                        sessions.push({
                            sessionId: path.basename(file, '.json'),
                            task: recording.task || 'Unknown task',
                            date: stats.mtime
                        });
                    }
                    catch (error) {
                        this.logger.warn(`Failed to read session file: ${file}`, error);
                    }
                }
            }
            return sessions.sort((a, b) => b.date.getTime() - a.date.getTime());
        }
        catch (error) {
            this.logger.error('Failed to get available sessions', error);
            return [];
        }
    }
    /**
     * Validate session exists
     */
    async sessionExists(sessionId) {
        const recordingFile = `${this.config.sessions.storageDir}/${sessionId}.json`;
        return await fs.pathExists(recordingFile);
    }
    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            if (this.browserStateCapture) {
                await this.browserStateCapture.cleanup();
            }
            this.logger.info('Replay-automation tool cleanup completed');
        }
        catch (error) {
            this.logger.error('Cleanup failed', error);
        }
    }
}
exports.ReplayAutomationTool = ReplayAutomationTool;
//# sourceMappingURL=replay-automation.js.map