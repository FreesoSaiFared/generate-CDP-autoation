import { CaptureAndAnalyzeInput, ToolResponse, ServerConfig } from '../types.js';
import * as winston from 'winston';
/**
 * Capture and Analyze Tool
 * Records network activity and analyzes with Integuru to determine optimal automation modality
 */
export declare class CaptureAndAnalyzeTool {
    private config;
    private logger;
    private mitmproxyController;
    private integuruWrapper;
    private modalityOptimizer;
    private browserStateCapture;
    constructor(config: ServerConfig, logger: winston.Logger);
    /**
     * Execute the capture and analyze tool
     */
    execute(input: CaptureAndAnalyzeInput): Promise<ToolResponse>;
    /**
     * Start network capture with mitmproxy
     */
    private startNetworkCapture;
    /**
     * Launch browser with stealth configuration
     */
    private launchBrowser;
    /**
     * Wait for user action with timeout
     */
    private waitForUserAction;
    /**
     * Stop network capture and get results
     */
    private stopNetworkCapture;
    /**
     * Analyze captured network data with Integuru
     */
    private analyzeWithInteguru;
    /**
     * Choose optimal automation modality
     */
    private chooseOptimalModality;
    /**
     * Save session data for later use
     */
    private saveSessionData;
    /**
     * Extract request count from HAR data
     */
    private extractRequestCount;
    /**
     * Extract domains from HAR data
     */
    private extractDomains;
    /**
     * Extract total size from HAR data
     */
    private extractSize;
    /**
     * Cleanup resources
     */
    cleanup(): Promise<void>;
}
//# sourceMappingURL=capture-and-analyze.d.ts.map