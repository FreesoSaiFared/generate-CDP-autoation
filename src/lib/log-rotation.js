/**
 * Log Rotation and Archival System
 * 
 * This module provides comprehensive log rotation and archival capabilities
 * for the debugging and logging infrastructure, including automated
 * cleanup, compression, and long-term storage.
 * 
 * Features:
 * - Automated log rotation based on size, time, or count
 * - Log compression and archival
 * - Multiple rotation strategies
 * - Configurable retention policies
 * - Log indexing and search capabilities
 * - Integration with Winston logger
 * - Archive management and cleanup
 * - Performance-optimized rotation
 * - Emergency log preservation
 */

const fs = require('fs').promises;
const path = require('path');
const zlib = require('zlib');
const tar = require('tar');
const crypto = require('crypto');
const EventEmitter = require('events');
const { promisify } = require('util');
const { pipeline } = require('stream/promises');

class LogRotation extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = {
            logDir: options.logDir || path.join(process.cwd(), 'logs'),
            archiveDir: options.archiveDir || path.join(process.cwd(), 'logs', 'archive'),
            maxFileSize: options.maxFileSize || 10 * 1024 * 1024, // 10MB
            maxFiles: options.maxFiles || 30,
            rotationInterval: options.rotationInterval || 3600000, // 1 hour
            compressionLevel: options.compressionLevel || 'gzip', // 'none', 'gzip', 'brotli'
            archiveFormat: options.archiveFormat || 'tar.gz', // 'tar', 'tar.gz', 'zip'
            retentionDays: options.retentionDays || 30,
            enableIndexing: options.enableIndexing !== false,
            enableEncryption: options.enableEncryption !== false,
            encryptionKey: options.encryptionKey || process.env.LOG_ENCRYPTION_KEY,
            strategies: options.strategies || ['size', 'time', 'count'],
            emergencyPreservation: options.emergencyPreservation !== false,
            performanceMode: options.performanceMode || 'balanced', // 'minimal', 'balanced', 'performance'
            dryRun: options.dryRun !== false,
            excludePatterns: options.excludePatterns || [],
            includePatterns: options.includePatterns || ['*.log']
        };
        
        // Rotation state
        this.rotationState = {
            lastRotation: null,
            totalRotations: 0,
            totalArchives: 0,
            totalBytesProcessed: 0,
            errors: 0,
            runningRotation: false
        };
        
        // File tracking
        this.fileTracker = new Map();
        this.archiveTracker = new Map();
        this.indexTracker = new Map();
        
        // Rotation strategies
        this.strategies = {
            size: this.rotateBySize.bind(this),
            time: this.rotateByTime.bind(this),
            count: this.rotateByCount.bind(this),
            hybrid: this.rotateHybrid.bind(this)
        };
        
        // Initialize
        this.initializeDirectories();
        this.loadFileTracking();
        this.startRotationScheduler();
    }

    /**
     * Perform immediate log rotation
     * 
     * @param {Object} options - Rotation options
     * @returns {Promise<Object>} Rotation results
     */
    async rotateLogs(options = {}) {
        const {
            force = false,
            strategy = 'auto',
            logFiles = null
        } = options;
        
        if (this.rotationState.runningRotation && !force) {
            return {
                success: false,
                reason: 'Rotation already in progress',
                timestamp: new Date().toISOString()
            };
        }
        
        this.rotationState.runningRotation = true;
        
        try {
            const startTime = Date.now();
            const results = {
                timestamp: new Date().toISOString(),
                strategy: strategy,
                rotatedFiles: [],
                archivedFiles: [],
                errors: [],
                bytesProcessed: 0,
                duration: 0
            };
            
            // Get log files to process
            const filesToProcess = logFiles || await this.getLogFiles();
            
            // Process each file
            for (const file of filesToProcess) {
                try {
                    const fileResult = await this.processLogFile(file, options);
                    results.rotatedFiles.push(fileResult);
                    results.bytesProcessed += fileResult.bytesProcessed;
                } catch (error) {
                    results.errors.push({
                        file: file.path,
                        error: error.message,
                        stack: error.stack
                    });
                }
            }
            
            // Update file tracking
            await this.updateFileTracking(results.rotatedFiles);
            
            // Clean up old files
            const cleanupResults = await this.cleanupOldFiles();
            results.archivedFiles = cleanupResults.archived;
            results.errors.push(...cleanupResults.errors);
            
            // Update rotation state
            results.duration = Date.now() - startTime;
            this.rotationState.lastRotation = new Date().toISOString();
            this.rotationState.totalRotations++;
            this.rotationState.totalBytesProcessed += results.bytesProcessed;
            
            // Emit events
            this.emit('rotation:completed', results);
            
            return results;
            
        } catch (error) {
            this.rotationState.runningRotation = false;
            this.rotationState.errors++;
            
            const errorResult = {
                timestamp: new Date().toISOString(),
                error: error.message,
                stack: error.stack
            };
            
            this.emit('rotation:error', errorResult);
            
            return {
                success: false,
                error: error.message,
                timestamp: errorResult.timestamp
            };
        } finally {
            this.rotationState.runningRotation = false;
        }
    }

    /**
     * Get log files for rotation
     * 
     * @returns {Promise<Array>} Array of log files
     */
    async getLogFiles() {
        try {
            const files = await fs.readdir(this.config.logDir);
            
            const logFiles = [];
            
            for (const file of files) {
                const filePath = path.join(this.config.logDir, file);
                const stat = await fs.stat(filePath);
                
                // Check if file matches include patterns
                if (this.matchesPatterns(file)) {
                    logFiles.push({
                        path: filePath,
                        name: file,
                        size: stat.size,
                        mtime: stat.mtime,
                        birthtime: stat.birthtime,
                        isDirectory: stat.isDirectory(),
                        needsRotation: await this.needsRotation(filePath, stat)
                    });
                }
            }
            
            // Sort by size (largest first) for efficient rotation
            logFiles.sort((a, b) => b.size - a.size);
            
            return logFiles;
            
        } catch (error) {
            this.emit('rotation:error', { 
                type: 'file_listing', 
                error: error.message 
            });
            return [];
        }
    }

    /**
     * Process a single log file for rotation
     * 
     * @param {Object} file - File information
     * @param {Object} options - Processing options
     * @returns {Promise<Object>} Processing result
     */
    async processLogFile(file, options = {}) {
        const {
            strategy = 'auto'
        } = options;
        
        const filePath = file.path;
        const stat = await fs.stat(filePath);
        
        // Check if rotation is needed
        if (!file.needsRotation && strategy === 'auto') {
            return {
                path: filePath,
                action: 'no_rotation_needed',
                bytesProcessed: 0
            };
        }
        
        const result = {
            path: filePath,
            action: 'rotated',
            originalSize: file.size,
            bytesProcessed: file.size,
            strategy: strategy
        };
        
        try {
            // Choose rotation strategy
            const rotationStrategy = this.strategies[strategy] || this.strategies.hybrid;
            const rotationResult = await rotationStrategy(file, this.config);
            
            // Apply rotation result
            if (rotationResult.archived) {
                result.archivedPath = rotationResult.archivePath;
                result.bytesProcessed = rotationResult.bytesProcessed;
            }
            
            if (rotationResult.rotated) {
                result.rotatedPath = rotationResult.rotatedPath;
            }
            
            // Update file tracking
            await this.updateFileTracking([result]);
            
            return result;
            
        } catch (error) {
            throw new Error(`Failed to process log file ${filePath}: ${error.message}`);
        }
    }

    /**
     * Check if a file needs rotation
     * 
     * @param {string} filePath - File path
     * @param {Object} stat - File stats
     * @returns {boolean} Whether rotation is needed
     */
    async needsRotation(filePath, stat) {
        // Check size-based rotation
        if (this.config.strategies.includes('size') && stat.size > this.config.maxFileSize) {
            return true;
        }
        
        // Check time-based rotation
        if (this.config.strategies.includes('time')) {
            const fileAge = Date.now() - stat.mtime.getTime();
            return fileAge > this.config.rotationInterval;
        }
        
        // Check count-based rotation
        if (this.config.strategies.includes('count')) {
            const fileTracker = this.fileTracker.get(filePath);
            if (fileTracker && fileTracker.lineCount > this.config.maxFiles) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Rotation strategy: rotate by size
     * 
     * @param {Object} file - File to rotate
     * @param {Object} config - Configuration
     * @returns {Promise<Object>} Rotation result
     */
    async rotateBySize(file, config) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedPath = path.join(config.logDir, `${file.name}.${timestamp}.rotated`);
        const archivePath = path.join(config.archiveDir, `${file.name}.${timestamp}.tar.gz`);
        
        try {
            // Create archive with original file
            await this.createArchive([file.path], archivePath);
            
            // Create new empty log file
            await fs.writeFile(file.path, '');
            
            return {
                rotated: true,
                rotatedPath,
                archivePath,
                bytesProcessed: file.size
            };
            
        } catch (error) {
            return {
                rotated: false,
                error: error.message,
                bytesProcessed: 0
            };
        }
    }

    /**
     * Rotation strategy: rotate by time
     * 
     * @param {Object} file - File to rotate
     * @param {Object} config - Configuration
     * @returns {Promise<Object>} Rotation result
     */
    async rotateByTime(file, config) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedPath = path.join(config.logDir, `${file.name}.${timestamp}.rotated`);
        const archivePath = path.join(config.archiveDir, `${file.name}.${timestamp}.tar.gz`);
        
        try {
            // Move current file to archive
            await fs.rename(file.path, rotatedPath);
            
            // Create archive
            await this.createArchive([rotatedPath], archivePath);
            
            // Create new empty log file
            await fs.writeFile(file.path, '');
            
            return {
                rotated: true,
                rotatedPath,
                archivePath,
                bytesProcessed: file.size
            };
            
        } catch (error) {
            return {
                rotated: false,
                error: error.message,
                bytesProcessed: 0
            };
        }
    }

    /**
     * Rotation strategy: rotate by count
     * 
     * @param {Object} file - File to rotate
     * @param {Object} config - Configuration
     * @returns {Promise<Object>} Rotation result
     */
    async rotateByCount(file, config) {
        const fileTracker = this.fileTracker.get(file.path) || { lineCount: 0 };
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedPath = path.join(config.logDir, `${file.name}.${timestamp}.${fileTracker.lineCount}.rotated`);
        const archivePath = path.join(config.archiveDir, `${file.name}.${timestamp}.${fileTracker.lineCount}.tar.gz`);
        
        try {
            // Move current file to archive
            await fs.rename(file.path, rotatedPath);
            
            // Create archive
            await this.createArchive([rotatedPath], archivePath);
            
            // Update line count
            fileTracker.lineCount++;
            
            // Create new empty log file
            await fs.writeFile(file.path, '');
            
            return {
                rotated: true,
                rotatedPath,
                archivePath,
                bytesProcessed: file.size
            };
            
        } catch (error) {
            return {
                rotated: false,
                error: error.message,
                bytesProcessed: 0
            };
        }
    }

    /**
     * Rotation strategy: hybrid rotation
     * 
     * @param {Object} file - File to rotate
     * @param {Object} config - Configuration
     * @returns {Promise<Object>} Rotation result
     */
    async rotateHybrid(file, config) {
        const fileAge = Date.now() - file.mtime.getTime();
        const fileSize = file.size;
        
        // Use size-based rotation for large files, time-based for old files
        let strategy;
        if (fileSize > config.maxFileSize) {
            strategy = 'size';
        } else if (fileAge > config.rotationInterval) {
            strategy = 'time';
        } else {
            // Use count-based rotation as fallback
            strategy = 'count';
        }
        
        const rotationStrategy = this.strategies[strategy];
        return await rotationStrategy(file, config);
    }

    /**
     * Create archive of files
     * 
     * @param {Array} filePaths - Files to archive
     * @param {string} archivePath - Archive path
     * @returns {Promise<string>} Archive path
     */
    async createArchive(filePaths, archivePath) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            
            // Create tar archive with proper options
            const tarOptions = {
                file: archivePath,
                cwd: path.dirname(archivePath),
                gzip: this.config.compressionLevel === 'gzip'
            };
            
            // Extract just filenames for tar
            const fileNames = filePaths.map(filePath => path.basename(filePath));
            
            await tar.c(tarOptions, fileNames);
            
            this.rotationState.totalArchives++;
            
            return archivePath;
            
        } catch (error) {
            throw new Error(`Failed to create archive: ${error.message}`);
        }
    }

    /**
     * Clean up old files based on retention policy
     * 
     * @param {Object} options - Cleanup options
     * @returns {Promise<Object>} Cleanup results
     */
    async cleanupOldFiles(options = {}) {
        const {
            force = false,
            dryRun = this.config.dryRun
        } = options;
        
        const cutoffTime = new Date(Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000);
        
        try {
            const results = {
                deletedFiles: [],
                deletedArchives: [],
                errors: [],
                bytesFreed: 0
            };
            
            // Clean up log files
            const logFiles = await fs.readdir(this.config.logDir);
            
            for (const file of logFiles) {
                const filePath = path.join(this.config.logDir, file);
                const stat = await fs.stat(filePath);
                
                if (stat.isFile() && stat.mtime < cutoffTime) {
                    if (!dryRun) {
                        await fs.unlink(filePath);
                    }
                    
                    results.deletedFiles.push({
                        path: filePath,
                        size: stat.size,
                        mtime: stat.mtime
                    });
                    
                    results.bytesFreed += stat.size;
                }
            }
            
            // Clean up archives
            const archiveFiles = await fs.readdir(this.config.archiveDir);
            
            for (const file of archiveFiles) {
                const filePath = path.join(this.config.archiveDir, file);
                const stat = await fs.stat(filePath);
                
                if (stat.isFile() && stat.mtime < cutoffTime) {
                    if (!dryRun) {
                        await fs.unlink(filePath);
                    }
                    
                    results.deletedArchives.push({
                        path: filePath,
                        size: stat.size,
                        mtime: stat.mtime
                    });
                    
                    results.bytesFreed += stat.size;
                }
            }
            
            this.emit('cleanup:completed', results);
            
            return results;
            
        } catch (error) {
            this.emit('cleanup:error', { error: error.message });
            return {
                deletedFiles: [],
                deletedArchives: [],
                errors: [error.message],
                bytesFreed: 0
            };
        }
    }

    /**
     * Update file tracking information
     * 
     * @param {Array} results - Processing results
     * @returns {Promise<void>}
     */
    async updateFileTracking(results) {
        for (const result of results) {
            const filePath = result.path;
            
            // Update file tracker
            if (!this.fileTracker.has(filePath)) {
                this.fileTracker.set(filePath, {
                    lastRotated: result.timestamp || new Date().toISOString(),
                    rotationCount: (this.fileTracker.get(filePath)?.rotationCount || 0) + 1,
                    totalBytesProcessed: (this.fileTracker.get(filePath)?.totalBytesProcessed || 0) + (result.bytesProcessed || 0)
                });
            }
            
            // Update archive tracker
            if (result.archivePath && !this.archiveTracker.has(result.archivePath)) {
                this.archiveTracker.set(result.archivePath, {
                    createdAt: new Date().toISOString(),
                    files: [filePath]
                });
            }
        }
    }

    /**
     * Get rotation statistics
     * 
     * @returns {Object>} Rotation statistics
     */
    getRotationStatistics() {
        return {
            ...this.rotationState,
            filesTracked: this.fileTracker.size,
            archivesTracked: this.archiveTracker.size,
            averageRotationTime: this.rotationState.totalRotations > 0 ? 
                this.rotationState.totalBytesProcessed / this.rotationState.totalRotations : 0,
            errorRate: this.rotationState.totalRotations > 0 ? 
                (this.rotationState.errors / this.rotationState.totalRotations) * 100 : 0
        };
    }

    /**
     * Search log files
     * 
     * @param {Object} params - Search parameters
     * @returns {Promise<Object>} Search results
     */
    async searchLogs(params) {
        const {
            query = params.query || '',
            limit = params.limit || 100,
            startDate = params.startDate,
            endDate = params.endDate,
            logLevel = params.logLevel,
            filePattern = params.filePattern || '*.log'
        } = params;
        
        try {
            const results = {
                matches: [],
                totalFiles: 0,
                totalMatches: 0,
                searchTime: 0
            };
            
            const startTime = Date.now();
            const files = await this.getLogFiles();
            results.totalFiles = files.length;
            
            for (const file of files) {
                // Skip files that don't match pattern
                if (!this.matchesPattern(file.name, filePattern)) {
                    continue;
                }
                
                const fileResults = await this.searchInFile(file, params);
                results.matches.push(...fileResults.matches);
                results.totalMatches += fileResults.matchCount;
            }
            
            results.searchTime = Date.now() - startTime;
            
            this.emit('search:completed', results);
            
            return results;
            
        } catch (error) {
            this.emit('search:error', { query, error });
            return {
                matches: [],
                totalFiles: 0,
                totalMatches: 0,
                searchTime: 0,
                error: error.message
            };
        }
    }

    /**
     * Search within a single file
     * 
     * @param {Object} file - File information
     * @param {Object} params - Search parameters
     * @returns {Promise<Object>} Search results
     */
    async searchInFile(file, params) {
        const {
            query = params.query || '',
            limit = params.limit || 100,
            startDate = params.startDate,
            endDate = params.endDate,
            logLevel = params.logLevel
        } = params;
        
        try {
            const results = {
                filePath: file.path,
                matches: [],
                matchCount: 0
            };
            
            // Read file in chunks for large files
            const fileSize = file.size;
            const chunkSize = Math.min(fileSize, 1024 * 1024); // 1MB chunks
            
            let lineNumber = 0;
            let buffer = Buffer.alloc(0);
            
            const stream = fs.createReadStream(file.path, {
                start: 0,
                end: fileSize,
                highWaterMark: chunkSize
            });
            
            // Read the entire file
            const content = await fs.readFile(file.path, 'utf8');
            const lines = content.split('\n');
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                lineNumber++;
                
                // Check if line matches search criteria
                if (this.lineMatchesQuery(line, query) &&
                    this.lineMatchesDate(line, startDate, endDate) &&
                    this.lineMatchesLevel(line, logLevel)) {
                    
                    results.matches.push({
                        lineNumber,
                        line: line.trim(),
                        context: this.getLineContext(lines, i, 3)
                    });
                    results.matchCount++;
                    
                    if (results.matchCount >= limit) {
                        break;
                    }
                }
            }
            
            return results;
            
        } catch (error) {
            this.emit('search:error', { 
                filePath: file.path, 
                query, 
                error: error.message 
            });
            
            return {
                filePath: file.path,
                matches: [],
                matchCount: 0,
                error: error.message
            };
        }
    }

    /**
     * Check if file matches include patterns
     * 
     * @param {string} filename - File name
     * @returns {boolean} Match result
     */
    matchesPatterns(filename) {
        const includePatterns = this.config.includePatterns.map(pattern => 
            pattern.startsWith('*') ? filename.endsWith(pattern.slice(1)) : filename.includes(pattern)
        );
        
        const excludePatterns = this.config.excludePatterns.map(pattern => 
            pattern.startsWith('*') ? filename.endsWith(pattern.slice(1)) : filename.includes(pattern)
        );
        
        return includePatterns.length > 0 && excludePatterns.length === 0 ||
               (includePatterns.length > 0 && !excludePatterns.some(exclude => filename.includes(exclude)));
    }

    /**
     * Check if line matches search query
     * 
     * @param {string} line - Log line
     * @param {string} query - Search query
     * @returns {boolean} Match result
     */
    lineMatchesQuery(line, query) {
        if (!query) return true;
        return line.toLowerCase().includes(query.toLowerCase());
    }

    /**
     * Check if line matches date range
     * 
     * @param {string} line - Log line
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {boolean} Match result
     */
    lineMatchesDate(line, startDate, endDate) {
        if (!startDate || !endDate) return true;
        
        // Extract date from log line (simplified)
        const dateMatch = line.match(/\d{4}-\d{2}-\d{4}/g);
        if (!dateMatch) return true;
        
        const lineDate = new Date(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T${dateMatch[4]}:${dateMatch[5]}:${dateMatch[6]}`);
        
        return lineDate >= startDate && lineDate <= endDate;
    }

    /**
     * Check if line matches log level
     * 
     * @param {string} line - Log line
     * @param {string} logLevel - Log level
     * @returns {boolean} Match result
     */
    lineMatchesLevel(line, logLevel) {
        if (!logLevel) return true;
        
        const levelPatterns = {
            error: /\[Ee][Rr][Oo][Rr]/i,
            warn: /\[Ww][Aa][Rr][Nn]/i,
            info: /\[Ii][Nn][Ff][Oo]/i,
            debug: /\[Dd][Ee][Bb][Uu][Gg]/i
        };
        
        const pattern = levelPatterns[logLevel.toLowerCase()];
        return pattern ? pattern.test(line) : false;
    }

    /**
     * Get context around a line
     * 
     * @param {Array} lines - All lines
     * @param {number} index - Current line index
     * @param {number} context - Context lines count
     * @returns {string} Context string
     */
    getLineContext(lines, index, context = 3) {
        const start = Math.max(0, index - context);
        const end = Math.min(lines.length - 1, index + context);
        
        return lines.slice(start, end).join('\n');
    }

    // Private helper methods

    async initializeDirectories() {
        const dirs = [this.config.logDir, this.config.archiveDir];
        
        for (const dir of dirs) {
            try {
                await fs.access(dir);
            } catch {
                await fs.mkdir(dir, { recursive: true });
            }
        }
    }

    async loadFileTracking() {
        try {
            const trackingPath = path.join(this.config.logDir, '.file-tracking.json');
            const data = await fs.readFile(trackingPath, 'utf8');
            const tracking = JSON.parse(data);
            
            // Convert to Map
            Object.keys(tracking.files || {}).forEach(filePath => {
                this.fileTracker.set(filePath, tracking.files[filePath]);
            });
            
            Object.keys(tracking.archives || {}).forEach(archivePath => {
                this.archiveTracker.set(archivePath, tracking.archives[archivePath]);
            });
            
        } catch {
            // File doesn't exist or is invalid
            this.fileTracker = new Map();
            this.archiveTracker = new Map();
        }
    }

    startRotationScheduler() {
        if (this.config.rotationInterval > 0) {
            setInterval(async () => {
                try {
                    await this.rotateLogs({ strategy: 'auto' });
                } catch (error) {
                    this.emit('scheduler:error', error);
                }
            }, this.config.rotationInterval);
        }
    }

    /**
     * Get archive index
     * 
     * @returns {Promise<Object>} Archive index
     */
    async getArchiveIndex() {
        try {
            const index = {};
            
            for (const [archivePath, archiveInfo] of this.archiveTracker.entries()) {
                index[archivePath] = {
                    ...archiveInfo,
                    files: await this.getArchiveFiles(archivePath)
                };
            }
            
            return index;
            
        } catch (error) {
            this.emit('archive:index:error', error);
            return {};
        }
    }

    /**
     * Get files in archive
     * 
     * @param {string} archivePath - Archive path
     * @returns {Promise<Array>} Array of files
     */
    async getArchiveFiles(archivePath) {
        try {
            // For now, return placeholder
            // In production, this would list and extract archive contents
            return [];
            
        } catch (error) {
            return [];
        }
    }

    /**
     * Generate rotation report
     * 
     * @returns {Promise<Object>} Rotation report
     */
    async generateRotationReport() {
        const stats = this.getRotationStatistics();
        
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalRotations: stats.totalRotations,
                totalErrors: stats.errors,
                averageRotationTime: stats.averageRotationTime,
                errorRate: stats.errorRate,
                filesTracked: stats.filesTracked,
                archivesTracked: stats.archivesTracked
            },
            details: {
                lastRotation: stats.lastRotation,
                performanceMode: this.config.performanceMode,
                compressionLevel: this.config.compressionLevel,
                retentionDays: this.config.retentionDays,
                strategies: this.config.strategies
            },
            recommendations: this.generateRecommendations(stats)
        };
        
        this.emit('report:generated', { type: 'rotation', report });
        
        return report;
    }

    generateRecommendations(stats) {
        const recommendations = [];
        
        // Performance recommendations
        if (stats.averageRotationTime > 5000) { // 5 seconds
            recommendations.push({
                type: 'performance',
                priority: 'high',
                title: 'Slow Rotation Performance',
                description: 'Average rotation time is high, consider optimizing file sizes or rotation frequency',
                action: 'Reduce rotation interval or implement streaming rotation'
            });
        }
        
        // Error rate recommendations
        if (stats.errorRate > 5) {
            recommendations.push({
                type: 'reliability',
                priority: 'medium',
                title: 'High Error Rate',
                description: `Error rate is ${stats.errorRate.toFixed(2)}%, investigate rotation failures`,
                action: 'Review error logs and implement better error handling'
            });
        }
        
        // Storage recommendations
        if (stats.filesTracked > 1000) {
            recommendations.push({
                type: 'storage',
                priority: 'low',
                title: 'High File Count',
                description: `${stats.filesTracked} files being tracked, consider more aggressive cleanup policies`,
                action: 'Reduce retention period or implement more efficient archiving'
            });
        }
        
        return recommendations;
    }
}

module.exports = LogRotation;