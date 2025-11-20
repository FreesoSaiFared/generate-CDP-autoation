/**
 * Session Manager Module
 * Handles session lifecycle management, persistence, and maintenance
 */

const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { promisify } = require('util');
const gzip = promisify(require('zlib').gzip);
const gunzip = promisify(require('zlib').gunzip);

class SessionManager {
  constructor(options = {}) {
    this.sessionsDir = options.sessionsDir || './sessions';
    this.maxSessions = options.maxSessions || 100;
    this.maxSessionAge = options.maxSessionAge || 30 * 24 * 60 * 60 * 1000; // 30 days
    this.compressionEnabled = options.compression !== false;
    this.encryptionEnabled = options.encryption || false;
    this.encryptionKey = options.encryptionKey || null;
    this.logger = options.logger || console;
    this.autoCleanup = options.autoCleanup !== false;
    this.cleanupInterval = options.cleanupInterval || 60 * 60 * 1000; // 1 hour
    
    this.ensureSessionsDir();
    
    // Start auto cleanup if enabled
    if (this.autoCleanup) {
      this.startAutoCleanup();
    }
  }

  /**
   * Create a new session
   */
  async createSession(sessionData = {}) {
    const sessionId = uuidv4();
    const timestamp = new Date().toISOString();
    
    const session = {
      sessionId,
      timestamp,
      created: timestamp,
      lastModified: timestamp,
      status: 'active',
      version: '1.0.0',
      metadata: {
        title: sessionData.title || `Session ${sessionId.substring(0, 8)}`,
        description: sessionData.description || '',
        tags: sessionData.tags || [],
        domain: sessionData.domain || '',
        userAgent: sessionData.userAgent || '',
        browser: sessionData.browser || '',
        platform: sessionData.platform || ''
      },
      state: {
        initial: sessionData.initialState || null,
        final: sessionData.finalState || null,
        snapshots: []
      },
      activity: {
        actions: [],
        networkRequests: [],
        screenshots: [],
        events: []
      },
      performance: {
        duration: 0,
        actionCount: 0,
        requestCount: 0,
        screenshotCount: 0,
        errorCount: 0
      },
      analysis: {
        integuru: null,
        modality: null,
        confidence: 0,
        optimization: null
      },
      files: {
        state: null,
        screenshots: [],
        logs: [],
        exports: []
      },
      sharing: {
        shared: false,
        shareToken: null,
        shareExpiry: null,
        permissions: []
      }
    };
    
    try {
      // Save session to disk
      await this.saveSession(session);
      
      this.logger.info(`Created new session: ${sessionId}`);
      return session;
    } catch (error) {
      this.logger.error('Failed to create session:', error);
      throw new Error(`Session creation failed: ${error.message}`);
    }
  }

  /**
   * Load an existing session
   */
  async loadSession(sessionId) {
    try {
      const sessionFile = this.getSessionFilePath(sessionId);
      
      if (!await fs.pathExists(sessionFile)) {
        throw new Error(`Session not found: ${sessionId}`);
      }
      
      const sessionData = await this.readSessionFile(sessionFile);
      
      // Update last modified time
      sessionData.lastModified = new Date().toISOString();
      
      this.logger.info(`Loaded session: ${sessionId}`);
      return sessionData;
    } catch (error) {
      this.logger.error(`Failed to load session ${sessionId}:`, error);
      throw new Error(`Session load failed: ${error.message}`);
    }
  }

  /**
   * Save a session to disk
   */
  async saveSession(session) {
    try {
      const sessionFile = this.getSessionFilePath(session.sessionId);
      
      // Update last modified time
      session.lastModified = new Date().toISOString();
      
      // Serialize and optionally compress/encrypt
      const serializedData = await this.serializeSession(session);
      
      // Write to file
      await fs.writeFile(sessionFile, serializedData);
      
      this.logger.debug(`Saved session: ${session.sessionId}`);
      return sessionFile;
    } catch (error) {
      this.logger.error(`Failed to save session ${session.sessionId}:`, error);
      throw new Error(`Session save failed: ${error.message}`);
    }
  }

  /**
   * Update session with new data
   */
  async updateSession(sessionId, updates) {
    try {
      const session = await this.loadSession(sessionId);
      
      // Deep merge updates
      const updatedSession = this.deepMerge(session, updates);
      
      // Save updated session
      await this.saveSession(updatedSession);
      
      this.logger.info(`Updated session: ${sessionId}`);
      return updatedSession;
    } catch (error) {
      this.logger.error(`Failed to update session ${sessionId}:`, error);
      throw new Error(`Session update failed: ${error.message}`);
    }
  }

  /**
   * Add action to session
   */
  async addAction(sessionId, action) {
    try {
      const session = await this.loadSession(sessionId);
      
      // Add timestamp if not present
      if (!action.timestamp) {
        action.timestamp = new Date().toISOString();
      }
      
      // Add to activity
      session.activity.actions.push(action);
      
      // Update performance metrics
      session.performance.actionCount++;
      
      if (action.type === 'error') {
        session.performance.errorCount++;
      }
      
      // Save session
      await this.saveSession(session);
      
      return action;
    } catch (error) {
      this.logger.error(`Failed to add action to session ${sessionId}:`, error);
      throw new Error(`Action addition failed: ${error.message}`);
    }
  }

  /**
   * Add network request to session
   */
  async addNetworkRequest(sessionId, request) {
    try {
      const session = await this.loadSession(sessionId);
      
      // Add timestamp if not present
      if (!request.timestamp) {
        request.timestamp = new Date().toISOString();
      }
      
      // Add to activity
      session.activity.networkRequests.push(request);
      
      // Update performance metrics
      session.performance.requestCount++;
      
      // Save session
      await this.saveSession(session);
      
      return request;
    } catch (error) {
      this.logger.error(`Failed to add network request to session ${sessionId}:`, error);
      throw new Error(`Network request addition failed: ${error.message}`);
    }
  }

  /**
   * Add screenshot to session
   */
  async addScreenshot(sessionId, screenshotData) {
    try {
      const session = await this.loadSession(sessionId);
      
      // Generate screenshot file path
      const screenshotId = uuidv4();
      const screenshotPath = path.join(
        this.getScreenshotsDir(sessionId),
        `${screenshotId}.png`
      );
      
      // Save screenshot file
      await fs.writeFile(screenshotPath, screenshotData.buffer);
      
      // Create screenshot metadata
      const screenshot = {
        id: screenshotId,
        path: screenshotPath,
        timestamp: screenshotData.timestamp || new Date().toISOString(),
        actionIndex: screenshotData.actionIndex || 0,
        size: screenshotData.buffer.length,
        width: screenshotData.width,
        height: screenshotData.height,
        format: 'png',
        description: screenshotData.description || '',
        tags: screenshotData.tags || []
      };
      
      // Add to activity
      session.activity.screenshots.push(screenshot);
      
      // Update files list
      session.files.screenshots.push(screenshotPath);
      
      // Update performance metrics
      session.performance.screenshotCount++;
      
      // Save session
      await this.saveSession(session);
      
      return screenshot;
    } catch (error) {
      this.logger.error(`Failed to add screenshot to session ${sessionId}:`, error);
      throw new Error(`Screenshot addition failed: ${error.message}`);
    }
  }

  /**
   * Add state snapshot to session
   */
  async addStateSnapshot(sessionId, state, label = '') {
    try {
      const session = await this.loadSession(sessionId);
      
      // Create snapshot
      const snapshot = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        label,
        state,
        checksum: this.calculateChecksum(state)
      };
      
      // Add to state snapshots
      session.state.snapshots.push(snapshot);
      
      // Save session
      await this.saveSession(session);
      
      return snapshot;
    } catch (error) {
      this.logger.error(`Failed to add state snapshot to session ${sessionId}:`, error);
      throw new Error(`State snapshot addition failed: ${error.message}`);
    }
  }

  /**
   * List all sessions
   */
  async listSessions(filter = {}) {
    try {
      const sessionFiles = await fs.readdir(this.sessionsDir);
      const sessions = [];
      
      for (const file of sessionFiles) {
        if (file.endsWith('.json')) {
          try {
            const sessionId = path.basename(file, '.json');
            const session = await this.loadSession(sessionId);
            
            // Apply filters
            if (this.matchesFilter(session, filter)) {
              sessions.push({
                sessionId: session.sessionId,
                title: session.metadata.title,
                description: session.metadata.description,
                tags: session.metadata.tags,
                domain: session.metadata.domain,
                created: session.created,
                lastModified: session.lastModified,
                status: session.status,
                performance: session.performance,
                sharing: session.sharing
              });
            }
          } catch (error) {
            this.logger.warn(`Failed to load session ${file}:`, error.message);
          }
        }
      }
      
      // Sort by last modified (newest first)
      sessions.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
      
      return sessions;
    } catch (error) {
      this.logger.error('Failed to list sessions:', error);
      throw new Error(`Session listing failed: ${error.message}`);
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId) {
    try {
      const sessionFile = this.getSessionFilePath(sessionId);
      const screenshotsDir = this.getScreenshotsDir(sessionId);
      
      // Delete session file
      if (await fs.pathExists(sessionFile)) {
        await fs.remove(sessionFile);
      }
      
      // Delete screenshots directory
      if (await fs.pathExists(screenshotsDir)) {
        await fs.remove(screenshotsDir);
      }
      
      this.logger.info(`Deleted session: ${sessionId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete session ${sessionId}:`, error);
      throw new Error(`Session deletion failed: ${error.message}`);
    }
  }

  /**
   * Export session for sharing
   */
  async exportSession(sessionId, options = {}) {
    try {
      const session = await this.loadSession(sessionId);
      
      // Create export package
      const exportData = {
        session,
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        exportOptions: options
      };
      
      // Serialize and optionally compress
      const serializedData = await this.serializeSession(exportData);
      
      // Generate export filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const exportFilename = `${session.metadata.title || sessionId}_${timestamp}.cdp`;
      const exportPath = path.join(this.sessionsDir, 'exports', exportFilename);
      
      // Ensure exports directory exists
      await fs.ensureDir(path.dirname(exportPath));
      
      // Write export file
      await fs.writeFile(exportPath, serializedData);
      
      // Update session with export info
      session.files.exports.push(exportPath);
      await this.saveSession(session);
      
      this.logger.info(`Exported session: ${sessionId} to ${exportPath}`);
      return {
        exportPath,
        filename: exportFilename,
        size: serializedData.length
      };
    } catch (error) {
      this.logger.error(`Failed to export session ${sessionId}:`, error);
      throw new Error(`Session export failed: ${error.message}`);
    }
  }

  /**
   * Import session from file
   */
  async importSession(exportPath, options = {}) {
    try {
      if (!await fs.pathExists(exportPath)) {
        throw new Error(`Export file not found: ${exportPath}`);
      }
      
      // Read and deserialize export file
      const serializedData = await fs.readFile(exportPath);
      const exportData = await this.deserializeSession(serializedData);
      
      // Generate new session ID to avoid conflicts
      const newSessionId = uuidv4();
      exportData.session.sessionId = newSessionId;
      exportData.session.imported = {
        originalId: exportData.session.sessionId,
        importedAt: new Date().toISOString(),
        importPath: exportPath
      };
      
      // Save imported session
      await this.saveSession(exportData.session);
      
      this.logger.info(`Imported session from ${exportPath} as ${newSessionId}`);
      return exportData.session;
    } catch (error) {
      this.logger.error(`Failed to import session from ${exportPath}:`, error);
      throw new Error(`Session import failed: ${error.message}`);
    }
  }

  /**
   * Share session with token
   */
  async shareSession(sessionId, options = {}) {
    try {
      const session = await this.loadSession(sessionId);
      
      // Generate share token
      const shareToken = this.generateShareToken();
      const expiry = options.expiry ? new Date(Date.now() + options.expiry).toISOString() : null;
      
      // Update session with sharing info
      session.sharing = {
        shared: true,
        shareToken,
        shareExpiry: expiry,
        permissions: options.permissions || ['read'],
        sharedAt: new Date().toISOString()
      };
      
      await this.saveSession(session);
      
      this.logger.info(`Shared session: ${sessionId} with token ${shareToken}`);
      return {
        shareToken,
        expiry,
        shareUrl: `${this.getShareBaseUrl()}/session/${shareToken}`
      };
    } catch (error) {
      this.logger.error(`Failed to share session ${sessionId}:`, error);
      throw new Error(`Session sharing failed: ${error.message}`);
    }
  }

  /**
   * Access shared session via token
   */
  async accessSharedSession(shareToken) {
    try {
      const sessions = await this.listSessions();
      
      // Find session with matching share token
      const sharedSession = sessions.find(s => 
        s.sharing && s.sharing.shared && s.sharing.shareToken === shareToken
      );
      
      if (!sharedSession) {
        throw new Error('Invalid or expired share token');
      }
      
      // Check expiry
      if (sharedSession.sharing.shareExpiry) {
        const expiryTime = new Date(sharedSession.sharing.shareExpiry);
        if (Date.now() > expiryTime.getTime()) {
          throw new Error('Share token has expired');
        }
      }
      
      // Load full session data
      const fullSession = await this.loadSession(sharedSession.sessionId);
      
      // Remove sensitive information for shared access
      const sanitizedSession = this.sanitizeSharedSession(fullSession);
      
      this.logger.info(`Accessed shared session: ${sharedSession.sessionId}`);
      return sanitizedSession;
    } catch (error) {
      this.logger.error(`Failed to access shared session:`, error);
      throw new Error(`Shared session access failed: ${error.message}`);
    }
  }

  /**
   * Clean up old sessions
   */
  async cleanup() {
    try {
      this.logger.info('Starting session cleanup...');
      
      const sessions = await this.listSessions();
      const now = Date.now();
      let deletedCount = 0;
      
      for (const session of sessions) {
        const sessionAge = now - new Date(session.lastModified).getTime();
        
        // Delete old sessions
        if (sessionAge > this.maxSessionAge) {
          await this.deleteSession(session.sessionId);
          deletedCount++;
          continue;
        }
        
        // Delete expired shared sessions
        if (session.sharing && session.sharing.shared && session.sharing.shareExpiry) {
          const expiryTime = new Date(session.sharing.shareExpiry);
          if (now > expiryTime.getTime()) {
            // Unshare but keep session
            await this.updateSession(session.sessionId, {
              sharing: { shared: false, shareToken: null, shareExpiry: null }
            });
          }
        }
      }
      
      // Enforce maximum session limit
      if (sessions.length - deletedCount > this.maxSessions) {
        const sortedSessions = sessions.sort((a, b) => 
          new Date(a.lastModified) - new Date(b.lastModified)
        );
        
        const excessCount = sessions.length - deletedCount - this.maxSessions;
        for (let i = 0; i < excessCount; i++) {
          await this.deleteSession(sortedSessions[i].sessionId);
          deletedCount++;
        }
      }
      
      this.logger.info(`Cleanup completed. Deleted ${deletedCount} sessions.`);
      return deletedCount;
    } catch (error) {
      this.logger.error('Session cleanup failed:', error);
      throw new Error(`Session cleanup failed: ${error.message}`);
    }
  }

  /**
   * Get session statistics
   */
  async getStatistics() {
    try {
      const sessions = await this.listSessions();
      const now = Date.now();
      
      const stats = {
        totalSessions: sessions.length,
        activeSessions: sessions.filter(s => s.status === 'active').length,
        sharedSessions: sessions.filter(s => s.sharing && s.sharing.shared).length,
        totalActions: sessions.reduce((sum, s) => sum + s.performance.actionCount, 0),
        totalRequests: sessions.reduce((sum, s) => sum + s.performance.requestCount, 0),
        totalScreenshots: sessions.reduce((sum, s) => sum + s.performance.screenshotCount, 0),
        totalErrors: sessions.reduce((sum, s) => sum + s.performance.errorCount, 0),
        averageAge: 0,
        oldestSession: null,
        newestSession: null,
        sizeUsage: await this.calculateStorageUsage()
      };
      
      if (sessions.length > 0) {
        const ages = sessions.map(s => now - new Date(s.created).getTime());
        stats.averageAge = ages.reduce((sum, age) => sum + age, 0) / ages.length;
        stats.oldestSession = sessions.reduce((oldest, s) => 
          new Date(s.created) < new Date(oldest.created) ? s : oldest
        );
        stats.newestSession = sessions.reduce((newest, s) => 
          new Date(s.created) > new Date(newest.created) ? s : newest
        );
      }
      
      return stats;
    } catch (error) {
      this.logger.error('Failed to get statistics:', error);
      throw new Error(`Statistics calculation failed: ${error.message}`);
    }
  }

  /**
   * Serialize session with optional compression and encryption
   */
  async serializeSession(session) {
    try {
      let serialized = JSON.stringify(session, null, 2);
      
      // Compress if enabled
      if (this.compressionEnabled) {
        const compressed = await gzip(serialized);
        serialized = compressed;
      }
      
      // Encrypt if enabled
      if (this.encryptionEnabled && this.encryptionKey) {
        serialized = this.encryptData(serialized, this.encryptionKey);
      }
      
      return serialized;
    } catch (error) {
      this.logger.error('Session serialization failed:', error);
      throw new Error(`Session serialization failed: ${error.message}`);
    }
  }

  /**
   * Deserialize session with optional decompression and decryption
   */
  async deserializeSession(serializedData) {
    try {
      let data = serializedData;
      
      // Decrypt if encrypted
      if (this.encryptionEnabled && this.encryptionKey) {
        data = this.decryptData(data, this.encryptionKey);
      }
      
      // Decompress if compressed
      if (this.compressionEnabled) {
        data = await gunzip(data);
        data = data.toString('utf8');
      }
      
      return JSON.parse(data);
    } catch (error) {
      this.logger.error('Session deserialization failed:', error);
      throw new Error(`Session deserialization failed: ${error.message}`);
    }
  }

  /**
   * Read session file with error handling
   */
  async readSessionFile(sessionFile) {
    try {
      const serializedData = await fs.readFile(sessionFile);
      return await this.deserializeSession(serializedData);
    } catch (error) {
      this.logger.error(`Failed to read session file ${sessionFile}:`, error);
      throw error;
    }
  }

  /**
   * Get session file path
   */
  getSessionFilePath(sessionId) {
    return path.join(this.sessionsDir, `${sessionId}.json`);
  }

  /**
   * Get screenshots directory for session
   */
  getScreenshotsDir(sessionId) {
    return path.join(this.sessionsDir, sessionId, 'screenshots');
  }

  /**
   * Ensure sessions directory exists
   */
  ensureSessionsDir() {
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  /**
   * Start automatic cleanup
   */
  startAutoCleanup() {
    this.cleanupTimer = setInterval(async () => {
      try {
        await this.cleanup();
      } catch (error) {
        this.logger.error('Auto cleanup failed:', error);
      }
    }, this.cleanupInterval);
    
    this.logger.info(`Started auto cleanup with interval ${this.cleanupInterval}ms`);
  }

  /**
   * Stop automatic cleanup
   */
  stopAutoCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      this.logger.info('Stopped auto cleanup');
    }
  }

  /**
   * Deep merge objects
   */
  deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * Check if session matches filter
   */
  matchesFilter(session, filter) {
    if (!filter || Object.keys(filter).length === 0) {
      return true;
    }
    
    if (filter.status && session.status !== filter.status) {
      return false;
    }
    
    if (filter.domain && session.metadata.domain !== filter.domain) {
      return false;
    }
    
    if (filter.tags && filter.tags.length > 0) {
      const hasAllTags = filter.tags.every(tag => 
        session.metadata.tags.includes(tag)
      );
      if (!hasAllTags) {
        return false;
      }
    }
    
    if (filter.dateFrom && new Date(session.created) < new Date(filter.dateFrom)) {
      return false;
    }
    
    if (filter.dateTo && new Date(session.created) > new Date(filter.dateTo)) {
      return false;
    }
    
    return true;
  }

  /**
   * Calculate checksum for data integrity
   */
  calculateChecksum(data) {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  /**
   * Generate share token
   */
  generateShareToken() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Get share base URL
   */
  getShareBaseUrl() {
    return process.env.SHARE_BASE_URL || 'http://localhost:3000/share';
  }

  /**
   * Sanitize session for sharing
   */
  sanitizeSharedSession(session) {
    const sanitized = JSON.parse(JSON.stringify(session));
    
    // Remove sensitive data
    if (sanitized.state && sanitized.state.initial) {
      if (sanitized.state.initial.cookies) {
        sanitized.state.initial.cookies = sanitized.state.initial.cookies.map(cookie => ({
          ...cookie,
          value: '***'
        }));
      }
    }
    
    if (sanitized.state && sanitized.state.final) {
      if (sanitized.state.final.cookies) {
        sanitized.state.final.cookies = sanitized.state.final.cookies.map(cookie => ({
          ...cookie,
          value: '***'
        }));
      }
    }
    
    return sanitized;
  }

  /**
   * Calculate storage usage
   */
  async calculateStorageUsage() {
    try {
      const totalSize = await this.getDirectorySize(this.sessionsDir);
      return {
        totalBytes: totalSize,
        totalMB: Math.round(totalSize / 1024 / 1024 * 100) / 100,
        sessions: await this.getDirectorySize(this.sessionsDir, '.json'),
        screenshots: await this.getDirectorySize(this.sessionsDir, '.png'),
        exports: await this.getDirectorySize(path.join(this.sessionsDir, 'exports'))
      };
    } catch (error) {
      this.logger.error('Failed to calculate storage usage:', error);
      return { totalBytes: 0, totalMB: 0 };
    }
  }

  /**
   * Get directory size for specific file types
   */
  async getDirectorySize(dirPath, extension = null) {
    try {
      if (!await fs.pathExists(dirPath)) {
        return 0;
      }
      
      let totalSize = 0;
      const files = await fs.readdir(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stat = await fs.stat(filePath);
        
        if (stat.isDirectory()) {
          totalSize += await this.getDirectorySize(filePath, extension);
        } else if (!extension || file.endsWith(extension)) {
          totalSize += stat.size;
        }
      }
      
      return totalSize;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Encrypt data
   */
  encryptData(data, key) {
    const cipher = crypto.createCipher('aes-256-cbc', key);
    let encrypted = cipher.update(data);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return encrypted;
  }

  /**
   * Decrypt data
   */
  decryptData(encryptedData, key) {
    const decipher = crypto.createDecipher('aes-256-cbc', key);
    let decrypted = decipher.update(encryptedData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted;
  }
}

module.exports = SessionManager;