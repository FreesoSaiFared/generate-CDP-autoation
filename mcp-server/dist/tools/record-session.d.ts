import { RecordSessionInput, ToolResponse, ServerConfig, SessionRecording } from '../types.js';
import * as winston from 'winston';
/**
 * Record Session Tool
 * Records complete automation session for replay
 */
export declare class RecordSessionTool {
    private config;
    private logger;
    private mitmproxyController;
    private browserStateCapture;
    private activeRecordings;
    constructor(config: ServerConfig, logger: winston.Logger);
    /**
     * Execute record session tool
     */
    execute(input: RecordSessionInput): Promise<ToolResponse>;
    /**
     * Initialize session recording
     */
    private initializeRecording;
    /**
     * Start network capture
     */
    private startNetworkCapture;
    /**
     * Launch browser for recording
     */
    private launchRecordingBrowser;
    /**
     * Setup recording hooks on page
     */
    private setupRecordingHooks;
    /**
     * Record an action in the session
     */
    private recordAction;
    /**
     * Capture screenshot
     */
    private captureScreenshot;
    /**
     * Wait for recording completion
     */
    private waitForRecordingCompletion;
    /**
     * Stop network capture
     */
    private stopNetworkCapture;
    /**
     * Finalize recording
     */
    private finalizeRecording;
    /**
     * Get active recording
     */
    getActiveRecording(sessionId: string): SessionRecording | undefined;
    /**
     * Stop active recording
     */
    stopRecording(sessionId: string): Promise<void>;
    /**
     * Cleanup resources
     */
    cleanup(): Promise<void>;
}
//# sourceMappingURL=record-session.d.ts.map