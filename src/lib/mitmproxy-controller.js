/**
 * mitmproxy Controller for CDP Automation System
 * 
 * This module provides programmatic control over mitmproxy instances,
 * including starting/stopping, HAR file management, and session handling.
 */

const { spawn, exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');

class MitmproxyController extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            host: options.host || '127.0.0.1',
            port: options.port || 8080,
            recordLevel: options.recordLevel || 3,
            configPath: options.configPath || path.join(process.cwd(), '.mitmproxy/config.yaml'),
            addonPath: options.addonPath || path.join(process.cwd(), '.mitmproxy/record_addon.py'),
            sessionsDir: options.sessionsDir || './activity_sessions',
            ...options
        };
        
        this.process = null;
        this.sessionId = null;
        this.isRunning = false;
        this.harFilePath = null;
        
        // Ensure sessions directory exists
        this.ensureSessionsDirectory();
    }
    
    /**
     * Ensure the sessions directory exists
     */
    async ensureSessionsDirectory() {
        try {
            await fs.mkdir(this.options.sessionsDir, { recursive: true });
        } catch (error) {
            console.error('Failed to create sessions directory:', error);
        }
    }
    
    /**
     * Start mitmproxy with recording addon
     * @param {Object} options - Additional options for this session
     * @returns {Promise<string>} Session ID
     */
    async start(options = {}) {
        if (this.isRunning) {
            throw new Error('mitmproxy is already running');
        }
        
        const sessionOptions = { ...this.options, ...options };
        this.sessionId = this.generateSessionId();
        
        // Create session-specific HAR file path
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.harFilePath = path.join(sessionOptions.sessionsDir, `session-${this.sessionId}-${timestamp}.har`);
        
        // Build mitmproxy command
        const args = [
            '--mode', 'regular',
            '--listen-host', sessionOptions.host,
            '--listen-port', sessionOptions.port.toString(),
            '--set', 'confdir=' + path.dirname(sessionOptions.configPath),
            '--set', 'flow_detail=3',
            '--set', `hardump=${this.harFilePath}`,
            '--set', `record_level=${sessionOptions.recordLevel}`,
            '-s', sessionOptions.addonPath,
            '-q'  // Quiet mode
        ];
        
        return new Promise((resolve, reject) => {
            console.log(`Starting mitmproxy with args: ${args.join(' ')}`);
            
            this.process = spawn('mitmdump', args, {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: { ...process.env, PYTHONUNBUFFERED: '1' }
            });
            
            let stdout = '';
            let stderr = '';
            
            this.process.stdout.on('data', (data) => {
                stdout += data.toString();
                this.emit('stdout', data);
                
                // Check for successful startup
                if (stdout.includes('Proxy server listening') || stdout.includes('listening at')) {
                    this.isRunning = true;
                    this.emit('started', { sessionId: this.sessionId, harFilePath: this.harFilePath });
                    resolve(this.sessionId);
                }
            });
            
            this.process.stderr.on('data', (data) => {
                stderr += data.toString();
                this.emit('stderr', data);
            });
            
            this.process.on('close', (code) => {
                this.isRunning = false;
                this.emit('stopped', { code, stdout, stderr });
                
                if (code !== 0 && !this.isRunning) {
                    reject(new Error(`mitmproxy exited with code ${code}: ${stderr}`));
                }
            });
            
            this.process.on('error', (error) => {
                this.isRunning = false;
                this.emit('error', error);
                reject(error);
            });
            
            // Timeout after 10 seconds if no startup confirmation
            const timeout = setTimeout(() => {
                if (!this.isRunning) {
                    this.process.kill();
                    reject(new Error('mitmproxy startup timeout'));
                }
            }, 10000);
            
            this.process.once('close', () => clearTimeout(timeout));
        });
    }
    
    /**
     * Stop mitmproxy process
     * @returns {Promise<Object>} Session summary
     */
    async stop() {
        if (!this.isRunning || !this.process) {
            throw new Error('mitmproxy is not running');
        }
        
        return new Promise((resolve) => {
            const sessionSummary = {
                sessionId: this.sessionId,
                harFilePath: this.harFilePath,
                startTime: this.startTime,
                endTime: new Date().toISOString()
            };
            
            this.process.on('close', (code) => {
                this.isRunning = false;
                this.process = null;
                
                // Verify HAR file was created
                this.verifyHarFile()
                    .then((harExists) => {
                        sessionSummary.harFileExists = harExists;
                        resolve(sessionSummary);
                    })
                    .catch(() => {
                        sessionSummary.harFileExists = false;
                        resolve(sessionSummary);
                    });
            });
            
            // Send SIGTERM first
            this.process.kill('SIGTERM');
            
            // Force kill after 5 seconds if still running
            setTimeout(() => {
                if (this.process && !this.process.killed) {
                    this.process.kill('SIGKILL');
                }
            }, 5000);
        });
    }
    
    /**
     * Verify HAR file exists and is valid
     * @returns {Promise<boolean>}
     */
    async verifyHarFile() {
        if (!this.harFilePath) return false;
        
        try {
            const stats = await fs.stat(this.harFilePath);
            if (stats.size > 0) {
                // Try to parse as JSON to verify it's valid
                const content = await fs.readFile(this.harFilePath, 'utf8');
                JSON.parse(content);
                return true;
            }
        } catch (error) {
            console.warn('HAR file verification failed:', error.message);
        }
        
        return false;
    }
    
    /**
     * Get session directory for the current session
     * @returns {Promise<string>} Session directory path
     */
    async getSessionDirectory() {
        if (!this.sessionId) {
            throw new Error('No active session');
        }
        
        // Find the most recent session directory
        const sessions = await fs.readdir(this.options.sessionsDir);
        const sessionDirs = sessions
            .filter(name => name.startsWith(this.sessionId) || name.includes(this.sessionId))
            .map(name => path.join(this.options.sessionsDir, name));
        
        if (sessionDirs.length === 0) {
            throw new Error(`Session directory not found for session ${this.sessionId}`);
        }
        
        // Return the most recent directory
        return sessionDirs[sessionDirs.length - 1];
    }
    
    /**
     * Get session files (network activity, performance metrics, etc.)
     * @returns {Promise<Object>} Session files
     */
    async getSessionFiles() {
        try {
            const sessionDir = await this.getSessionDirectory();
            const files = await fs.readdir(sessionDir);
            
            const sessionFiles = {};
            for (const file of files) {
                const filePath = path.join(sessionDir, file);
                const stats = await fs.stat(filePath);
                sessionFiles[file] = {
                    path: filePath,
                    size: stats.size,
                    modified: stats.mtime
                };
            }
            
            return sessionFiles;
        } catch (error) {
            console.error('Failed to get session files:', error);
            return {};
        }
    }
    
    /**
     * Check if mitmproxy is installed and available
     * @returns {Promise<boolean>}
     */
    static async isInstalled() {
        return new Promise((resolve) => {
            exec('mitmdump --version', (error) => {
                resolve(!error);
            });
        });
    }
    
    /**
     * Get mitmproxy version
     * @returns {Promise<string>}
     */
    static async getVersion() {
        return new Promise((resolve) => {
            exec('mitmdump --version', (error, stdout) => {
                if (error) {
                    resolve('unknown');
                } else {
                    resolve(stdout.trim());
                }
            });
        });
    }
    
    /**
     * Generate a unique session ID
     * @returns {string}
     */
    generateSessionId() {
        return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Clean up old session directories
     * @param {number} maxAge - Maximum age in milliseconds (default: 24 hours)
     * @returns {Promise<number>} Number of directories cleaned
     */
    async cleanupOldSessions(maxAge = 24 * 60 * 60 * 1000) {
        try {
            const sessions = await fs.readdir(this.options.sessionsDir);
            let cleaned = 0;
            const now = Date.now();
            
            for (const session of sessions) {
                const sessionPath = path.join(this.options.sessionsDir, session);
                const stats = await fs.stat(sessionPath);
                
                if (now - stats.mtime.getTime() > maxAge) {
                    await fs.rmdir(sessionPath, { recursive: true });
                    cleaned++;
                }
            }
            
            return cleaned;
        } catch (error) {
            console.error('Failed to cleanup old sessions:', error);
            return 0;
        }
    }
    
    /**
     * Get current status
     * @returns {Object}
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            sessionId: this.sessionId,
            harFilePath: this.harFilePath,
            options: this.options
        };
    }
}

module.exports = MitmproxyController;