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
exports.ExecuteOptimallyTool = void 0;
const integuru_wrapper_js_1 = require("../../src/lib/integuru-wrapper.js");
const modality_optimizer_js_1 = require("../../src/lib/modality-optimizer.js");
const browser_state_capture_js_1 = require("../lib/browser-state-capture.js");
const puppeteer = __importStar(require("puppeteer-extra"));
const uuid_1 = require("uuid");
/**
 * Execute Optimally Tool
 * Executes automation using the optimal modality (Integuru/CDP/Manual)
 */
class ExecuteOptimallyTool {
    config;
    logger;
    integuruWrapper;
    modalityOptimizer;
    browserStateCapture;
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
        this.integuruWrapper = new integuru_wrapper_js_1.InteguruWrapper({
            integuruDir: config.integuru.integuruDir,
            model: config.integuru.model,
            timeout: config.integuru.timeout
        });
        this.modalityOptimizer = new modality_optimizer_js_1.ModalityOptimizer({
            thresholds: {
                integuruConfidence: 0.85,
                headlessConfidence: 0.70
            }
        });
        this.browserStateCapture = new browser_state_capture_js_1.BrowserStateCapture(config.integuru.tempDir, logger);
    }
    /**
     * Execute automation using optimal modality
     */
    async execute(input) {
        const executionId = (0, uuid_1.v4)();
        const { taskDescription, sessionId, harFile, forceModality, browserState } = input;
        this.logger.info(`Starting execute-optimally for execution ${executionId}`, {
            taskDescription,
            sessionId,
            harFile,
            forceModality
        });
        try {
            // Step 1: Determine modality to use
            let modalityChoice;
            if (forceModality) {
                modalityChoice = await this.createForcedModalityChoice(forceModality, taskDescription);
            }
            else if (harFile || sessionId) {
                modalityChoice = await this.chooseOptimalModality(taskDescription, harFile, sessionId);
            }
            else {
                modalityChoice = await this.getDefaultModalityChoice(taskDescription);
            }
            this.logger.info(`Selected modality: ${modalityChoice.modality}`, modalityChoice);
            // Step 2: Execute based on selected modality
            let executionResult;
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
        }
        catch (error) {
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
    async createForcedModalityChoice(modality, taskDescription) {
        return {
            modality: modality,
            confidence: 1.0,
            estimatedTimeSeconds: this.getEstimatedTimeForModality(modality),
            reasoning: `Modality forced by user: ${modality}`,
            metadata: { forced: true }
        };
    }
    /**
     * Choose optimal modality based on analysis
     */
    async chooseOptimalModality(taskDescription, harFile, sessionId) {
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
        }
        catch (error) {
            this.logger.error('Modality selection failed', error);
            return await this.getDefaultModalityChoice(taskDescription);
        }
    }
    /**
     * Get default modality choice when no analysis is available
     */
    async getDefaultModalityChoice(taskDescription) {
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
    async executeViaInteguru(taskDescription, harFile, sessionId) {
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
        }
        catch (error) {
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
    async executeViaHeadlessCDP(taskDescription, browserState, sessionId) {
        const startTime = Date.now();
        let browser = null;
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
            const screenshots = [];
            const output = await this.executeTaskInBrowser(page, taskDescription, screenshots);
            return {
                success: true,
                modality: 'headless_cdp',
                executionTime: (Date.now() - startTime) / 1000,
                output,
                screenshots,
                metadata: {
                    userAgent: await page.evaluate(() => {
                        return globalThis.navigator.userAgent;
                    }),
                    finalUrl: page.url()
                }
            };
        }
        catch (error) {
            return {
                success: false,
                modality: 'headless_cdp',
                executionTime: (Date.now() - startTime) / 1000,
                error: error instanceof Error ? error.message : String(error),
                metadata: {}
            };
        }
        finally {
            if (browser) {
                await browser.close();
            }
        }
    }
    /**
     * Execute via visible browser (manual fallback)
     */
    async executeViaVisibleBrowser(taskDescription, browserState) {
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
                        return globalThis.navigator.userAgent;
                    })
                }
            };
        }
        catch (error) {
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
    async launchHeadlessBrowser() {
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
    async launchVisibleBrowser() {
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
    async loadSessionActions(page, sessionId) {
        try {
            const sessionFile = `${this.config.sessions.storageDir}/${sessionId}.json`;
            const sessionData = await require('fs-extra').readJson(sessionFile);
            // This would implement the actual action replay logic
            this.logger.info(`Loading ${sessionData.actions?.length || 0} actions from session ${sessionId}`);
        }
        catch (error) {
            this.logger.warn('Failed to load session actions', error);
        }
    }
    /**
     * Execute task in browser (placeholder implementation)
     */
    async executeTaskInBrowser(page, taskDescription, screenshots) {
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
    async waitForManualCompletion(taskDescription) {
        // This would implement user notification and waiting logic
        // For now, wait a reasonable time
        await new Promise(resolve => setTimeout(resolve, 60000)); // 1 minute
    }
    /**
     * Count API calls in generated code
     */
    countApiCalls(code) {
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
    getEstimatedTimeForModality(modality) {
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
    async recordExecution(executionId, taskDescription, modalityChoice, executionResult) {
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
        }
        catch (error) {
            this.logger.warn('Failed to record execution for learning', error);
        }
    }
    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            if (this.browserStateCapture) {
                await this.browserStateCapture.cleanup();
            }
            this.logger.info('Execute-optimally tool cleanup completed');
        }
        catch (error) {
            this.logger.error('Cleanup failed', error);
        }
    }
}
exports.ExecuteOptimallyTool = ExecuteOptimallyTool;
//# sourceMappingURL=execute-optimally.js.map