import { ReplayAutomationInput, ToolResponse, ServerConfig } from '../types.js';
import * as winston from 'winston';
/**
 * Replay Automation Tool
 * Replays a previously recorded automation session
 */
export declare class ReplayAutomationTool {
    private config;
    private logger;
    private browserStateCapture;
    constructor(config: ServerConfig, logger: winston.Logger);
    /**
     * Execute replay automation tool
     */
    execute(input: ReplayAutomationInput): Promise<ToolResponse>;
    /**
     * Load session recording from file
     */
    private loadSessionRecording;
    /**
     * Validate session recording
     */
    private validateRecording;
    /**
     * Prepare actions for replay
     */
    private prepareActionsForReplay;
    /**
     * Launch browser for replay
     */
    private launchReplayBrowser;
    /**
     * Execute replay actions
     */
    private executeReplay;
    /**
     * Execute a single action
     */
    private executeAction;
    /**
     * Execute CDP command
     */
    private executeCDPCommand;
    /**
     * Capture screenshot during replay
     */
    private captureReplayScreenshot;
    /**
     * Sleep helper
     */
    private sleep;
    /**
     * Get available session recordings
     */
    getAvailableSessions(): Promise<Array<{
        sessionId: string;
        task: string;
        date: Date;
    }>>;
    /**
     * Validate session exists
     */
    sessionExists(sessionId: string): Promise<boolean>;
    /**
     * Cleanup resources
     */
    cleanup(): Promise<void>;
}
//# sourceMappingURL=replay-automation.d.ts.map