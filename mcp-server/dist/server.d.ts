/**
 * Main MCP Server for CDP Integuru Automation
 * Exposes 4 core tools for browser automation with intelligent modality selection
 */
declare class CDPAutomationServer {
    private server;
    private config;
    private logger;
    private browserStateCapture;
    private captureAndAnalyzeTool;
    private executeOptimallyTool;
    private recordSessionTool;
    private replayAutomationTool;
    constructor();
    /**
     * Setup Winston logger
     */
    private setupLogger;
    /**
     * Setup MCP server
     */
    private setupServer;
    /**
     * Setup tool instances
     */
    private setupTools;
    /**
     * Setup browser state capture
     */
    private setupBrowserStateCapture;
    /**
     * Get tool definition for capture-and-analyze
     */
    private getCaptureAndAnalyzeToolDefinition;
    /**
     * Get tool definition for execute-optimally
     */
    private getExecuteOptimallyToolDefinition;
    /**
     * Get tool definition for record-session
     */
    private getRecordSessionToolDefinition;
    /**
     * Get tool definition for replay-automation
     */
    private getReplayAutomationToolDefinition;
    /**
     * Handle capture-and-analyze tool call
     */
    private handleCaptureAndAnalyze;
    /**
     * Handle execute-optimally tool call
     */
    private handleExecuteOptimally;
    /**
     * Handle record-session tool call
     */
    private handleRecordSession;
    /**
     * Handle replay-automation tool call
     */
    private handleReplayAutomation;
    /**
     * Start the server
     */
    start(): Promise<void>;
    /**
     * Cleanup resources
     */
    private cleanup;
}
export { CDPAutomationServer };
//# sourceMappingURL=server.d.ts.map