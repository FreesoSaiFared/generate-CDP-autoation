import { BrowserState } from '../types';
/**
 * Browser State Capture and Management
 * Handles capturing, storing, and replicating browser state for automation
 */
export declare class BrowserStateCapture {
    private tempDir;
    private logger;
    constructor(tempDir: string, logger: any);
    /**
     * Capture complete browser state from a running browser
     */
    captureBrowserState(page: any): Promise<BrowserState>;
    /**
     * Capture all cookies from the current page
     */
    private captureCookies;
    /**
     * Capture localStorage content
     */
    private captureLocalStorage;
    /**
     * Capture sessionStorage content
     */
    private captureSessionStorage;
    /**
     * Attempt to capture IndexedDB data (limited)
     */
    private captureIndexedDB;
    /**
     * Save browser state to file
     */
    saveBrowserState(state: BrowserState, sessionId: string): Promise<string>;
    /**
     * Load browser state from file
     */
    loadBrowserState(stateFile: string): Promise<BrowserState>;
    /**
     * Apply browser state to a new page
     */
    applyBrowserState(page: any, state: BrowserState): Promise<void>;
    /**
     * Create a browser profile directory with state
     */
    createBrowserProfile(state: BrowserState, profileId: string): Promise<string>;
    /**
     * Save cookies in Chrome format
     */
    private saveChromeCookies;
    /**
     * Save Chrome preferences
     */
    private saveChromePreferences;
    /**
     * Compare two browser states
     */
    compareBrowserStates(state1: BrowserState, state2: BrowserState): {
        cookiesDiff: any;
        localStorageDiff: any;
        sessionStorageDiff: any;
        urlDiff: boolean;
    };
    /**
     * Compare cookies between two states
     */
    private compareCookies;
    /**
     * Compare storage between two states
     */
    private compareStorage;
    /**
     * Clean up temporary files
     */
    cleanup(): Promise<void>;
    /**
     * Ensure temporary directory exists
     */
    private ensureTempDir;
    /**
     * Get state file path for session
     */
    getStateFilePath(sessionId: string): string;
    /**
     * Check if state file exists
     */
    stateExists(sessionId: string): Promise<boolean>;
}
//# sourceMappingURL=browser-state-capture.d.ts.map