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
exports.BrowserStateCapture = void 0;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const uuid_1 = require("uuid");
/**
 * Browser State Capture and Management
 * Handles capturing, storing, and replicating browser state for automation
 */
class BrowserStateCapture {
    tempDir;
    logger;
    constructor(tempDir, logger) {
        this.tempDir = tempDir;
        this.logger = logger;
        this.ensureTempDir();
    }
    /**
     * Capture complete browser state from a running browser
     */
    async captureBrowserState(page) {
        this.logger.info('Capturing browser state...');
        try {
            const state = {
                cookies: await this.captureCookies(page),
                localStorage: await this.captureLocalStorage(page),
                sessionStorage: await this.captureSessionStorage(page),
                url: page.url(),
                title: await page.title(),
                userAgent: await page.evaluate(() => navigator.userAgent)
            };
            // Capture screenshot if requested
            const screenshotPath = path.join(this.tempDir, `state-${(0, uuid_1.v4)()}.png`);
            await page.screenshot({ path: screenshotPath, fullPage: true });
            state.screenshot = screenshotPath;
            // Attempt to capture IndexedDB (best effort)
            try {
                state.indexedDB = await this.captureIndexedDB(page);
            }
            catch (error) {
                this.logger.warn('Failed to capture IndexedDB:', error);
            }
            this.logger.info('Browser state captured successfully');
            return state;
        }
        catch (error) {
            this.logger.error('Failed to capture browser state:', error);
            throw error;
        }
    }
    /**
     * Capture all cookies from the current page
     */
    async captureCookies(page) {
        try {
            const cookies = await page.cookies();
            return cookies.map((cookie) => ({
                name: cookie.name,
                value: cookie.value,
                domain: cookie.domain,
                path: cookie.path,
                expires: cookie.expires,
                httpOnly: cookie.httpOnly,
                secure: cookie.secure,
                sameSite: cookie.sameSite
            }));
        }
        catch (error) {
            this.logger.warn('Failed to capture cookies:', error);
            return [];
        }
    }
    /**
     * Capture localStorage content
     */
    async captureLocalStorage(page) {
        try {
            return await page.evaluate(() => {
                const storage = {};
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key) {
                        storage[key] = localStorage.getItem(key) || '';
                    }
                }
                return storage;
            });
        }
        catch (error) {
            this.logger.warn('Failed to capture localStorage:', error);
            return {};
        }
    }
    /**
     * Capture sessionStorage content
     */
    async captureSessionStorage(page) {
        try {
            return await page.evaluate(() => {
                const storage = {};
                for (let i = 0; i < sessionStorage.length; i++) {
                    const key = sessionStorage.key(i);
                    if (key) {
                        storage[key] = sessionStorage.getItem(key) || '';
                    }
                }
                return storage;
            });
        }
        catch (error) {
            this.logger.warn('Failed to capture sessionStorage:', error);
            return {};
        }
    }
    /**
     * Attempt to capture IndexedDB data (limited)
     */
    async captureIndexedDB(page) {
        try {
            return await page.evaluate(() => {
                // This is a simplified IndexedDB capture
                // In practice, IndexedDB is complex to capture completely
                return {
                    databases: [],
                    note: 'IndexedDB capture is limited and may not contain all data'
                };
            });
        }
        catch (error) {
            this.logger.warn('Failed to capture IndexedDB:', error);
            return null;
        }
    }
    /**
     * Save browser state to file
     */
    async saveBrowserState(state, sessionId) {
        const stateFile = path.join(this.tempDir, `state-${sessionId}.json`);
        try {
            await fs.writeJson(stateFile, state, { spaces: 2 });
            this.logger.info(`Browser state saved to ${stateFile}`);
            return stateFile;
        }
        catch (error) {
            this.logger.error('Failed to save browser state:', error);
            throw error;
        }
    }
    /**
     * Load browser state from file
     */
    async loadBrowserState(stateFile) {
        try {
            const state = await fs.readJson(stateFile);
            this.logger.info(`Browser state loaded from ${stateFile}`);
            return state;
        }
        catch (error) {
            this.logger.error('Failed to load browser state:', error);
            throw error;
        }
    }
    /**
     * Apply browser state to a new page
     */
    async applyBrowserState(page, state) {
        this.logger.info('Applying browser state...');
        try {
            // Set cookies
            if (state.cookies && state.cookies.length > 0) {
                await page.setCookie(...state.cookies);
                this.logger.debug(`Applied ${state.cookies.length} cookies`);
            }
            // Set localStorage
            if (state.localStorage && Object.keys(state.localStorage).length > 0) {
                await page.evaluate((storage) => {
                    Object.entries(storage).forEach(([key, value]) => {
                        localStorage.setItem(key, value);
                    });
                }, state.localStorage);
                this.logger.debug(`Applied ${Object.keys(state.localStorage).length} localStorage items`);
            }
            // Set sessionStorage
            if (state.sessionStorage && Object.keys(state.sessionStorage).length > 0) {
                await page.evaluate((storage) => {
                    Object.entries(storage).forEach(([key, value]) => {
                        sessionStorage.setItem(key, value);
                    });
                }, state.sessionStorage);
                this.logger.debug(`Applied ${Object.keys(state.sessionStorage).length} sessionStorage items`);
            }
            // Navigate to original URL if provided
            if (state.url) {
                await page.goto(state.url, { waitUntil: 'networkidle2' });
                this.logger.debug(`Navigated to ${state.url}`);
            }
            this.logger.info('Browser state applied successfully');
        }
        catch (error) {
            this.logger.error('Failed to apply browser state:', error);
            throw error;
        }
    }
    /**
     * Create a browser profile directory with state
     */
    async createBrowserProfile(state, profileId) {
        const profileDir = path.join(this.tempDir, `profile-${profileId}`);
        try {
            await fs.ensureDir(profileDir);
            // Save state to profile
            const stateFile = path.join(profileDir, 'state.json');
            await fs.writeJson(stateFile, state, { spaces: 2 });
            // Create Chrome profile structure
            const chromeProfileDir = path.join(profileDir, 'chrome-profile');
            await fs.ensureDir(chromeProfileDir);
            // Save cookies in Chrome format
            await this.saveChromeCookies(state.cookies || [], chromeProfileDir);
            // Save preferences
            await this.saveChromePreferences(state, chromeProfileDir);
            this.logger.info(`Browser profile created at ${profileDir}`);
            return profileDir;
        }
        catch (error) {
            this.logger.error('Failed to create browser profile:', error);
            throw error;
        }
    }
    /**
     * Save cookies in Chrome format
     */
    async saveChromeCookies(cookies, profileDir) {
        try {
            const cookiesFile = path.join(profileDir, 'Cookies');
            // This is a simplified version - Chrome cookies are in a specific binary format
            // In practice, you'd need to use Chrome's cookie format or set them via CDP
            await fs.writeJson(path.join(profileDir, 'cookies.json'), cookies, { spaces: 2 });
        }
        catch (error) {
            this.logger.warn('Failed to save Chrome cookies:', error);
        }
    }
    /**
     * Save Chrome preferences
     */
    async saveChromePreferences(state, profileDir) {
        try {
            const preferences = {
                profile: {
                    name: 'CDP Automation Profile',
                    last_used: Date.now()
                },
                browser: {
                    window_placement: {}
                }
            };
            await fs.writeJson(path.join(profileDir, 'Preferences'), preferences, { spaces: 2 });
        }
        catch (error) {
            this.logger.warn('Failed to save Chrome preferences:', error);
        }
    }
    /**
     * Compare two browser states
     */
    compareBrowserStates(state1, state2) {
        const cookiesDiff = this.compareCookies(state1.cookies || [], state2.cookies || []);
        const localStorageDiff = this.compareStorage(state1.localStorage || {}, state2.localStorage || {});
        const sessionStorageDiff = this.compareStorage(state1.sessionStorage || {}, state2.sessionStorage || {});
        const urlDiff = state1.url !== state2.url;
        return {
            cookiesDiff,
            localStorageDiff,
            sessionStorageDiff,
            urlDiff
        };
    }
    /**
     * Compare cookies between two states
     */
    compareCookies(cookies1, cookies2) {
        const added = cookies2.filter(c2 => !cookies1.some(c1 => c1.name === c2.name && c1.domain === c2.domain));
        const removed = cookies1.filter(c1 => !cookies2.some(c2 => c1.name === c2.name && c1.domain === c2.domain));
        const modified = cookies2.filter(c2 => {
            const c1 = cookies1.find(c => c.name === c2.name && c.domain === c2.domain);
            return c1 && c1.value !== c2.value;
        });
        return { added, removed, modified };
    }
    /**
     * Compare storage between two states
     */
    compareStorage(storage1, storage2) {
        const keys1 = new Set(Object.keys(storage1));
        const keys2 = new Set(Object.keys(storage2));
        const added = Array.from(keys2).filter(key => !keys1.has(key));
        const removed = Array.from(keys1).filter(key => !keys2.has(key));
        const modified = Array.from(keys2).filter(key => keys1.has(key) && storage1[key] !== storage2[key]);
        return { added, removed, modified };
    }
    /**
     * Clean up temporary files
     */
    async cleanup() {
        try {
            if (await fs.pathExists(this.tempDir)) {
                await fs.remove(this.tempDir);
                this.logger.info(`Cleaned up temporary directory: ${this.tempDir}`);
            }
        }
        catch (error) {
            this.logger.warn('Failed to cleanup temporary files:', error);
        }
    }
    /**
     * Ensure temporary directory exists
     */
    ensureTempDir() {
        try {
            fs.ensureDirSync(this.tempDir);
        }
        catch (error) {
            this.logger.error('Failed to create temporary directory:', error);
            throw error;
        }
    }
    /**
     * Get state file path for session
     */
    getStateFilePath(sessionId) {
        return path.join(this.tempDir, `state-${sessionId}.json`);
    }
    /**
     * Check if state file exists
     */
    async stateExists(sessionId) {
        const stateFile = this.getStateFilePath(sessionId);
        return await fs.pathExists(stateFile);
    }
}
exports.BrowserStateCapture = BrowserStateCapture;
//# sourceMappingURL=browser-state-capture.js.map