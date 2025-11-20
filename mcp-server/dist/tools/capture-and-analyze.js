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
exports.CaptureAndAnalyzeTool = void 0;
const mitmproxy_controller_js_1 = require("../../src/lib/mitmproxy-controller.js");
const integuru_wrapper_js_1 = require("../../src/lib/integuru-wrapper.js");
const modality_optimizer_js_1 = require("../../src/lib/modality-optimizer.js");
const browser_state_capture_js_1 = require("../lib/browser-state-capture.js");
const puppeteer = __importStar(require("puppeteer-extra"));
const uuid_1 = require("uuid");
/**
 * Capture and Analyze Tool
 * Records network activity and analyzes with Integuru to determine optimal automation modality
 */
class CaptureAndAnalyzeTool {
    config;
    logger;
    mitmproxyController;
    integuruWrapper;
    modalityOptimizer;
    browserStateCapture;
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
        this.mitmproxyController = new mitmproxy_controller_js_1.MitmproxyController({
            port: config.mitmproxy.port,
            host: config.mitmproxy.host,
            harOutput: config.mitmproxy.harOutput,
            sessionsDir: config.sessions.storageDir
        });
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
     * Execute the capture and analyze tool
     */
    async execute(input) {
        const sessionId = (0, uuid_1.v4)();
        const { timeoutSeconds = 30, taskDescription, captureLevel = 2, includeScreenshots = true } = input;
        this.logger.info(`Starting capture-and-analyze for session ${sessionId}`, {
            taskDescription,
            timeoutSeconds,
            captureLevel,
            includeScreenshots
        });
        try {
            // Step 1: Start mitmproxy for network capture
            const networkCapture = await this.startNetworkCapture(sessionId, captureLevel);
            // Step 2: Launch browser for user interaction
            const browser = await this.launchBrowser();
            const page = await browser.newPage();
            // Step 3: Capture initial browser state
            const initialBrowserState = await this.browserStateCapture.captureBrowserState(page);
            // Step 4: Wait for user action
            this.logger.info(`Waiting ${timeoutSeconds} seconds for user action...`);
            await this.waitForUserAction(timeoutSeconds);
            // Step 5: Stop network capture
            const finalNetworkCapture = await this.stopNetworkCapture(networkCapture);
            // Step 6: Capture final browser state
            const finalBrowserState = await this.browserStateCapture.captureBrowserState(page);
            // Step 7: Analyze with Integuru
            const integuruAnalysis = await this.analyzeWithInteguru(finalNetworkCapture.harFile, taskDescription);
            // Step 8: Choose optimal modality
            const modalityChoice = await this.chooseOptimalModality(finalNetworkCapture, integuruAnalysis, taskDescription);
            // Step 9: Save session data
            await this.saveSessionData(sessionId, {
                taskDescription,
                networkCapture: finalNetworkCapture,
                initialBrowserState,
                finalBrowserState,
                integuruAnalysis,
                modalityChoice,
                captureLevel,
                includeScreenshots
            });
            // Step 10: Cleanup
            await browser.close();
            const result = {
                sessionId,
                status: 'success',
                taskDescription,
                networkCapture: {
                    sessionId: finalNetworkCapture.sessionId,
                    harFile: finalNetworkCapture.harFile,
                    requestCount: finalNetworkCapture.requestCount,
                    domains: finalNetworkCapture.domains,
                    duration: finalNetworkCapture.endTime.getTime() - finalNetworkCapture.startTime.getTime()
                },
                integuruAnalysis: {
                    success: integuruAnalysis.success,
                    confidence: integuruAnalysis.confidence,
                    codeGenerated: !!integuruAnalysis.code,
                    apiEndpoints: integuruAnalysis.apiEndpoints,
                    estimatedTime: integuruAnalysis.estimatedTime
                },
                recommendedModality: modalityChoice,
                browserState: {
                    url: finalBrowserState.url,
                    title: finalBrowserState.title,
                    cookieCount: finalBrowserState.cookies?.length || 0,
                    localStorageKeys: Object.keys(finalBrowserState.localStorage || {}).length,
                    sessionStorageKeys: Object.keys(finalBrowserState.sessionStorage || {}).length
                }
            };
            this.logger.info(`Capture-and-analyze completed for session ${sessionId}`, result);
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
            this.logger.error(`Capture-and-analyze failed for session ${sessionId}`, error);
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
     * Start network capture with mitmproxy
     */
    async startNetworkCapture(sessionId, captureLevel) {
        this.logger.info(`Starting network capture for session ${sessionId} at level ${captureLevel}`);
        const options = {
            sessionId,
            recordLevel: captureLevel,
            harOutput: this.config.mitmproxy.harOutput
        };
        await this.mitmproxyController.start(options);
        return {
            sessionId,
            harFile: this.config.mitmproxy.harOutput,
            startTime: new Date(),
            endTime: new Date(),
            requestCount: 0,
            domains: [],
            size: 0
        };
    }
    /**
     * Launch browser with stealth configuration
     */
    async launchBrowser() {
        this.logger.info('Launching browser for user interaction');
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
        return await puppeteer.launch(launchOptions);
    }
    /**
     * Wait for user action with timeout
     */
    async waitForUserAction(timeoutSeconds) {
        return new Promise((resolve) => {
            setTimeout(resolve, timeoutSeconds * 1000);
        });
    }
    /**
     * Stop network capture and get results
     */
    async stopNetworkCapture(networkCapture) {
        this.logger.info('Stopping network capture');
        await this.mitmproxyController.stop();
        // Update network capture with final data
        const sessionFiles = await this.mitmproxyController.getSessionFiles();
        const harData = sessionFiles.har ? sessionFiles.har : null;
        return {
            ...networkCapture,
            endTime: new Date(),
            requestCount: harData ? this.extractRequestCount(harData) : 0,
            domains: harData ? this.extractDomains(harData) : [],
            size: harData ? this.extractSize(harData) : 0
        };
    }
    /**
     * Analyze captured network data with Integuru
     */
    async analyzeWithInteguru(harFile, taskDescription) {
        this.logger.info('Analyzing HAR file with Integuru');
        try {
            const result = await this.integuruWrapper.analyzeHAR(harFile, taskDescription, true);
            return {
                success: result.success,
                confidence: result.confidence,
                code: result.code,
                analysis: result.analysis,
                recommendations: result.recommendations || [],
                apiEndpoints: result.apiEndpoints || [],
                estimatedTime: result.estimatedTime || 0
            };
        }
        catch (error) {
            this.logger.error('Integuru analysis failed', error);
            return {
                success: false,
                confidence: 0,
                analysis: `Analysis failed: ${error instanceof Error ? error.message : String(error)}`,
                recommendations: [],
                apiEndpoints: [],
                estimatedTime: 0
            };
        }
    }
    /**
     * Choose optimal automation modality
     */
    async chooseOptimalModality(networkCapture, integuruAnalysis, taskDescription) {
        this.logger.info('Choosing optimal modality');
        try {
            const choice = await this.modalityOptimizer.chooseModality({
                taskDescription,
                harFile: networkCapture.harFile,
                integuruConfidence: integuruAnalysis.confidence
            });
            return choice;
        }
        catch (error) {
            this.logger.error('Modality selection failed', error);
            // Fallback to headless CDP
            return {
                modality: 'headless_cdp',
                confidence: 0.5,
                estimatedTimeSeconds: 30,
                reasoning: 'Modality selection failed, falling back to headless CDP',
                metadata: { fallback: true }
            };
        }
    }
    /**
     * Save session data for later use
     */
    async saveSessionData(sessionId, data) {
        this.logger.info(`Saving session data for ${sessionId}`);
        const sessionFile = `${this.config.sessions.storageDir}/${sessionId}.json`;
        try {
            await require('fs-extra').writeJson(sessionFile, data, { spaces: 2 });
        }
        catch (error) {
            this.logger.error('Failed to save session data', error);
        }
    }
    /**
     * Extract request count from HAR data
     */
    extractRequestCount(harData) {
        try {
            return harData.log?.entries?.length || 0;
        }
        catch {
            return 0;
        }
    }
    /**
     * Extract domains from HAR data
     */
    extractDomains(harData) {
        try {
            const domains = new Set();
            harData.log?.entries?.forEach((entry) => {
                const url = new URL(entry.request.url);
                domains.add(url.hostname);
            });
            return Array.from(domains);
        }
        catch {
            return [];
        }
    }
    /**
     * Extract total size from HAR data
     */
    extractSize(harData) {
        try {
            return harData.log?.entries?.reduce((total, entry) => {
                return total + (entry.response?.bodySize || 0);
            }, 0) || 0;
        }
        catch {
            return 0;
        }
    }
    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            if (this.mitmproxyController) {
                await this.mitmproxyController.stop();
            }
            if (this.browserStateCapture) {
                await this.browserStateCapture.cleanup();
            }
            this.logger.info('Capture-and-analyze tool cleanup completed');
        }
        catch (error) {
            this.logger.error('Cleanup failed', error);
        }
    }
}
exports.CaptureAndAnalyzeTool = CaptureAndAnalyzeTool;
//# sourceMappingURL=capture-and-analyze.js.map