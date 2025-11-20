import { ExecuteOptimallyInput, ToolResponse, ServerConfig } from '../types.js';
import * as winston from 'winston';
/**
 * Execute Optimally Tool
 * Executes automation using the optimal modality (Integuru/CDP/Manual)
 */
export declare class ExecuteOptimallyTool {
    private config;
    private logger;
    private integuruWrapper;
    private modalityOptimizer;
    private browserStateCapture;
    constructor(config: ServerConfig, logger: winston.Logger);
    /**
     * Execute automation using optimal modality
     */
    execute(input: ExecuteOptimallyInput): Promise<ToolResponse>;
    /**
     * Create forced modality choice
     */
    private createForcedModalityChoice;
    /**
     * Choose optimal modality based on analysis
     */
    private chooseOptimalModality;
    /**
     * Get default modality choice when no analysis is available
     */
    private getDefaultModalityChoice;
    /**
     * Execute via Integuru (API calls)
     */
    private executeViaInteguru;
    /**
     * Execute via Headless CDP (browser automation)
     */
    private executeViaHeadlessCDP;
    /**
     * Execute via visible browser (manual fallback)
     */
    private executeViaVisibleBrowser;
    /**
     * Launch headless browser
     */
    private launchHeadlessBrowser;
    /**
     * Launch visible browser
     */
    private launchVisibleBrowser;
    /**
     * Load session actions for replay
     */
    private loadSessionActions;
    /**
     * Execute task in browser (placeholder implementation)
     */
    private executeTaskInBrowser;
    /**
     * Wait for manual completion
     */
    private waitForManualCompletion;
    /**
     * Count API calls in generated code
     */
    private countApiCalls;
    /**
     * Get estimated time for modality
     */
    private getEstimatedTimeForModality;
    /**
     * Record execution for learning
     */
    private recordExecution;
    /**
     * Cleanup resources
     */
    cleanup(): Promise<void>;
}
//# sourceMappingURL=execute-optimally.d.ts.map