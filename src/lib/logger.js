/**
 * Enhanced Winston-based Logging System
 * 
 * This module provides comprehensive logging capabilities for all components,
 * including structured logging, performance metrics tracking, error categorization,
 * and integration with the debugging system.
 * 
 * Features:
 * - Structured logging with multiple transports
 * - Performance metrics tracking
 * - Error categorization and alerting
 * - Log rotation and archival
 * - Integration with debugging system
 * - Real-time monitoring dashboard support
 * - Component-specific log levels
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs').promises;
const EventEmitter = require('events');
const crypto = require('crypto');

class EnhancedLogger extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = {
            logDir: options.logDir || path.join(process.cwd(), 'logs'),
            level: options.level || 'info',
            maxFileSize: options.maxFileSize || 10 * 1024 * 1024, // 10MB
            maxFiles: options.maxFiles || 30,
            enableConsole: options.enableConsole !== false,
            enableFile: options.enableFile !== false,
            enableMetrics: options.enableMetrics !== false,
            enableAlerting: options.enableAlerting !== false,
            alertThresholds: {
                errorRate: options.alertThresholds?.errorRate || 0.1, // 10% error rate
                responseTime: options.alertThresholds?.responseTime || 5000, // 5 seconds
                memoryUsage: options.alertThresholds?.memoryUsage || 0.8 // 80% memory usage
            },
            componentLevels: options.componentLevels || {},
            structuredFormat: options.structuredFormat !== false
        };
        
        // Performance metrics
        this.metrics = {
            counters: new Map(),
            timers: new Map(),
            gauges: new Map(),
            histograms: new Map()
        };
        
        // Error tracking
        this.errorStats = {
            total: 0,
            byCategory: new Map(),
            byComponent: new Map(),
            recent: []
        };
        
        // Component performance tracking
        this.componentPerformance = new Map();
        
        // Initialize logger
        this.initializeLogger();
        
        // Setup metrics collection
        if (this.config.enableMetrics) {
            this.setupMetricsCollection();
        }
        
        // Setup alerting
        if (this.config.enableAlerting) {
            this.setupAlerting();
        }
    }

    /**
     * Initialize Winston logger with custom transports
     */
    initializeLogger() {
        const transports = [];
        
        // Console transport
        if (this.config.enableConsole) {
            transports.push(
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.timestamp(),
                        winston.format.printf(this.formatConsoleLog.bind(this))
                    ),
                    level: this.config.level
                })
            );
        }
        
        // File transport for general logs
        if (this.config.enableFile) {
            transports.push(
                new winston.transports.File({
                    filename: path.join(this.config.logDir, 'combined.log'),
                    maxsize: this.config.maxFileSize,
                    maxFiles: this.config.maxFiles,
                    format: winston.format.combine(
                        winston.format.timestamp(),
                        winston.format.json()
                    ),
                    level: this.config.level
                })
            );
            
            // Error-specific file transport
            transports.push(
                new winston.transports.File({
                    filename: path.join(this.config.logDir, 'error.log'),
                    maxsize: this.config.maxFileSize,
                    maxFiles: this.config.maxFiles,
                    format: winston.format.combine(
                        winston.format.timestamp(),
                        winston.format.json()
                    ),
                    level: 'error'
                })
            );
            
            // Performance metrics file transport
            transports.push(
                new winston.transports.File({
                    filename: path.join(this.config.logDir, 'performance.log'),
                    maxsize: this.config.maxFileSize,
                    maxFiles: this.config.maxFiles,
                    format: winston.format.combine(
                        winston.format.timestamp(),
                        winston.format.json()
                    ),
                    level: 'info'
                })
            );
        }
        
        // Create Winston logger
        this.winston = winston.createLogger({
            level: this.config.level,
            transports,
            exitOnError: false,
            handleExceptions: true,
            handleRejections: true
        });
        
        // Custom log method for structured logging
        this.winston.logStructured = this.logStructured.bind(this);
    }

    /**
     * Structured logging method with enhanced metadata
     * 
     * @param {string} level - Log level
     * @param {string} message - Log message
     * @param {Object} metadata - Structured metadata
     * @param {Object} options - Additional options
     */
    logStructured(level, message, metadata = {}, options = {}) {
        const {
            component = 'system',
            sessionId = null,
            userId = null,
            requestId = null,
            tags = [],
            metrics = {},
            error = null,
            stack = null
        } = options;
        
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            component,
            sessionId,
            userId,
            requestId,
            tags,
            metrics,
            metadata,
            error: error ? {
                name: error.name,
                message: error.message,
                stack: error.stack || stack
            } : null,
            system: {
                pid: process.pid,
                hostname: require('os').hostname(),
                platform: process.platform,
                nodeVersion: process.version,
                memory: process.memoryUsage()
            }
        };
        
        // Check component-specific log level
        const componentLevel = this.config.componentLevels[component] || this.config.level;
        if (!this.shouldLog(level, componentLevel)) {
            return;
        }
        
        // Log with Winston
        this.winston.log(level, message, logEntry);
        
        // Update metrics
        this.updateLogMetrics(level, component, metadata);
        
        // Emit structured log event for real-time monitoring
        this.emit('log:structured', logEntry);
        
        // Handle error tracking
        if (level === 'error' && error) {
            this.trackError(error, component, metadata);
        }
    }

    /**
     * Log performance metrics
     * 
     * @param {Object} params - Performance parameters
     * @param {string} params.operation - Operation name
     * @param {number} params.duration - Duration in milliseconds
     * @param {string} params.component - Component name
     * @param {Object} params.metadata - Additional metadata
     */
    logPerformance(params) {
        const {
            operation,
            duration,
            component = 'system',
            metadata = {}
        } = params;
        
        const performanceEntry = {
            timestamp: new Date().toISOString(),
            type: 'performance',
            operation,
            duration,
            component,
            metadata,
            metrics: {
                memory: process.memoryUsage(),
                cpu: process.cpuUsage(),
                uptime: process.uptime()
            }
        };
        
        // Log to performance file
        this.winston.info(`Performance: ${operation}`, performanceEntry);
        
        // Update performance metrics
        this.updatePerformanceMetrics(operation, duration, component);
        
        // Check performance alerts
        this.checkPerformanceAlerts(performanceEntry);
        
        // Emit performance event
        this.emit('performance:metric', performanceEntry);
    }

    /**
     * Start a timer for performance measurement
     * 
     * @param {string} name - Timer name
     * @param {Object} metadata - Additional metadata
     * @returns {Function} Function to stop timer and log duration
     */
    startTimer(name, metadata = {}) {
        const startTime = process.hrtime.bigint();
        const timerId = crypto.randomBytes(8).toString('hex');
        
        // Store timer info
        this.metrics.timers.set(timerId, {
            name,
            startTime,
            metadata
        });
        
        return (additionalMetadata = {}) => {
            const endTime = process.hrtime.bigint();
            const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
            
            const timer = this.metrics.timers.get(timerId);
            if (timer) {
                this.logPerformance({
                    operation: timer.name,
                    duration,
                    metadata: { ...timer.metadata, ...additionalMetadata }
                });
                
                this.metrics.timers.delete(timerId);
            }
            
            return duration;
        };
    }

    /**
     * Increment a counter metric
     * 
     * @param {string} name - Counter name
     * @param {number} value - Increment value (default: 1)
     * @param {Object} tags - Tags for the counter
     */
    incrementCounter(name, value = 1, tags = {}) {
        const key = this.createMetricKey(name, tags);
        const current = this.metrics.counters.get(key) || 0;
        this.metrics.counters.set(key, current + value);
        
        this.emit('metric:counter', { name, value: current + value, tags });
    }

    /**
     * Set a gauge metric
     * 
     * @param {string} name - Gauge name
     * @param {number} value - Gauge value
     * @param {Object} tags - Tags for the gauge
     */
    setGauge(name, value, tags = {}) {
        const key = this.createMetricKey(name, tags);
        this.metrics.gauges.set(key, value);
        
        this.emit('metric:gauge', { name, value, tags });
    }

    /**
     * Record a histogram value
     * 
     * @param {string} name - Histogram name
     * @param {number} value - Value to record
     * @param {Object} tags - Tags for the histogram
     */
    recordHistogram(name, value, tags = {}) {
        const key = this.createMetricKey(name, tags);
        const values = this.metrics.histograms.get(key) || [];
        values.push({
            value,
            timestamp: new Date().toISOString()
        });
        
        // Keep only last 1000 values
        if (values.length > 1000) {
            values.shift();
        }
        
        this.metrics.histograms.set(key, values);
        this.emit('metric:histogram', { name, value, tags });
    }

    /**
     * Log component-specific information
     * 
     * @param {string} component - Component name
     * @param {string} level - Log level
     * @param {string} message - Log message
     * @param {Object} metadata - Additional metadata
     */
    logComponent(component, level, message, metadata = {}) {
        this.logStructured(level, message, metadata, {
            component,
            tags: ['component']
        });
    }

    /**
     * Log automation session information
     * 
     * @param {Object} params - Session parameters
     * @param {string} params.sessionId - Session ID
     * @param {string} params.action - Action being performed
     * @param {string} params.modality - Automation modality
     * @param {Object} params.metadata - Additional metadata
     */
    logSession(params) {
        const {
            sessionId,
            action,
            modality,
            metadata = {}
        } = params;
        
        this.logStructured('info', `Session ${action}`, metadata, {
            component: 'automation',
            sessionId,
            tags: ['session', 'automation'],
            metadata: { action, modality, ...metadata }
        });
    }

    /**
     * Log error with categorization
     * 
     * @param {Error} error - Error object
     * @param {string} component - Component where error occurred
     * @param {Object} context - Error context
     */
    logError(error, component = 'system', context = {}) {
        const category = this.categorizeError(error);
        const severity = this.assessErrorSeverity(error);
        
        this.logStructured('error', error.message, {
            category,
            severity,
            context,
            stack: error.stack
        }, {
            component,
            error,
            tags: ['error', category, severity]
        });
        
        // Check for alerting
        this.checkErrorAlerts(error, component, category);
    }

    /**
     * Get current metrics
     * 
     * @returns {Object} Current metrics
     */
    getMetrics() {
        return {
            counters: Object.fromEntries(this.metrics.counters),
            gauges: Object.fromEntries(this.metrics.gauges),
            histograms: Object.fromEntries(
                Array.from(this.metrics.histograms.entries()).map(([key, values]) => [
                    key,
                    {
                        count: values.length,
                        sum: values.reduce((sum, v) => sum + v.value, 0),
                        average: values.reduce((sum, v) => sum + v.value, 0) / values.length,
                        min: Math.min(...values.map(v => v.value)),
                        max: Math.max(...values.map(v => v.value))
                    }
                ])
            ),
            errorStats: {
                total: this.errorStats.total,
                byCategory: Object.fromEntries(this.errorStats.byCategory),
                byComponent: Object.fromEntries(this.errorStats.byComponent),
                recentErrors: this.errorStats.recent.slice(-10)
            }
        };
    }

    /**
     * Get component performance summary
     * 
     * @returns {Object} Component performance data
     */
    getComponentPerformance() {
        const performance = {};
        
        for (const [component, data] of this.componentPerformance.entries()) {
            const operations = Array.from(data.operations.values());
            const totalOperations = operations.length;
            const totalDuration = operations.reduce((sum, op) => sum + op.duration, 0);
            
            performance[component] = {
                totalOperations,
                averageDuration: totalOperations > 0 ? totalDuration / totalOperations : 0,
                minDuration: totalOperations > 0 ? Math.min(...operations.map(op => op.duration)) : 0,
                maxDuration: totalOperations > 0 ? Math.max(...operations.map(op => op.duration)) : 0,
                errorRate: data.errors / totalOperations,
                lastOperation: data.lastOperation
            };
        }
        
        return performance;
    }

    /**
     * Export logs for analysis
     * 
     * @param {Object} options - Export options
     * @returns {Promise<string>} Path to exported file
     */
    async exportLogs(options = {}) {
        const {
            format = 'json',
            timeRange = 24, // hours
            level = null,
            component = null
        } = options;
        
        const logs = await this.readLogs({
            timeRange,
            level,
            component
        });
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `logs_export_${timestamp}.${format}`;
        const filepath = path.join(this.config.logDir, filename);
        
        if (format === 'json') {
            await fs.writeFile(filepath, JSON.stringify(logs, null, 2));
        } else if (format === 'csv') {
            const csv = this.convertLogsToCSV(logs);
            await fs.writeFile(filepath, csv);
        }
        
        return filepath;
    }

    // Private helper methods

    formatConsoleLog(info) {
        const { timestamp, level, message, component, sessionId, tags = [], metadata = {} } = info;
        
        let formatted = `${timestamp} [${level.toUpperCase()}]`;
        
        if (component) {
            formatted += ` [${component}]`;
        }
        
        if (sessionId) {
            formatted += ` [${sessionId}]`;
        }
        
        formatted += `: ${message}`;
        
        if (tags.length > 0) {
            formatted += ` ${tags.map(tag => `#${tag}`).join(' ')}`;
        }
        
        if (Object.keys(metadata).length > 0) {
            formatted += `\n  Metadata: ${JSON.stringify(metadata, null, 2)}`;
        }
        
        return formatted;
    }

    shouldLog(level, componentLevel) {
        const levels = { error: 0, warn: 1, info: 2, debug: 3 };
        return levels[level] <= levels[componentLevel];
    }

    updateLogMetrics(level, component, metadata) {
        // Increment log counter
        this.incrementCounter('logs.total', 1, { level, component });
        
        // Track component performance
        if (!this.componentPerformance.has(component)) {
            this.componentPerformance.set(component, {
                operations: new Map(),
                errors: 0,
                lastOperation: new Date().toISOString()
            });
        }
        
        const compPerf = this.componentPerformance.get(component);
        compPerf.lastOperation = new Date().toISOString();
        
        if (level === 'error') {
            compPerf.errors++;
        }
    }

    updatePerformanceMetrics(operation, duration, component) {
        // Update component performance
        if (!this.componentPerformance.has(component)) {
            this.componentPerformance.set(component, {
                operations: new Map(),
                errors: 0,
                lastOperation: new Date().toISOString()
            });
        }
        
        const compPerf = this.componentPerformance.get(component);
        const operationKey = `${operation}_${Date.now()}`;
        compPerf.operations.set(operationKey, {
            operation,
            duration,
            timestamp: new Date().toISOString()
        });
        
        // Keep only last 100 operations per component
        if (compPerf.operations.size > 100) {
            const oldestKey = Array.from(compPerf.operations.keys())[0];
            compPerf.operations.delete(oldestKey);
        }
        
        // Record performance histogram
        this.recordHistogram(`operation_duration`, duration, { operation, component });
        
        // Set performance gauge
        this.setGauge(`last_operation_duration`, duration, { operation, component });
    }

    trackError(error, component, metadata) {
        this.errorStats.total++;
        
        const category = this.categorizeError(error);
        
        // Update category stats
        this.errorStats.byCategory.set(category, (this.errorStats.byCategory.get(category) || 0) + 1);
        
        // Update component stats
        this.errorStats.byComponent.set(component, (this.errorStats.byComponent.get(component) || 0) + 1);
        
        // Add to recent errors
        this.errorStats.recent.push({
            timestamp: new Date().toISOString(),
            message: error.message,
            category,
            component,
            metadata
        });
        
        // Keep only last 50 recent errors
        if (this.errorStats.recent.length > 50) {
            this.errorStats.recent.shift();
        }
        
        // Increment error counter
        this.incrementCounter('errors.total', 1, { category, component });
    }

    categorizeError(error) {
        const message = error.message.toLowerCase();
        
        if (message.includes('timeout')) return 'timeout';
        if (message.includes('network') || message.includes('connection')) return 'network';
        if (message.includes('permission') || message.includes('access')) return 'permission';
        if (message.includes('not found') || message.includes('selector')) return 'element_not_found';
        if (message.includes('navigation') || message.includes('redirect')) return 'navigation';
        if (message.includes('authentication') || message.includes('auth')) return 'authentication';
        if (message.includes('validation') || message.includes('invalid')) return 'validation';
        
        return 'unknown';
    }

    assessErrorSeverity(error) {
        const message = error.message.toLowerCase();
        
        if (message.includes('fatal') || message.includes('crash')) return 'critical';
        if (message.includes('timeout') || message.includes('not found')) return 'high';
        if (message.includes('warning') || message.includes('deprecated')) return 'medium';
        
        return 'low';
    }

    createMetricKey(name, tags) {
        const tagString = Object.keys(tags)
            .sort()
            .map(key => `${key}=${tags[key]}`)
            .join(',');
        return tagString ? `${name}{${tagString}}` : name;
    }

    setupMetricsCollection() {
        // Collect system metrics every 30 seconds
        setInterval(() => {
            const memUsage = process.memoryUsage();
            this.setGauge('memory.rss', memUsage.rss);
            this.setGauge('memory.heapUsed', memUsage.heapUsed);
            this.setGauge('memory.heapTotal', memUsage.heapTotal);
            this.setGauge('memory.external', memUsage.external);
            
            this.setGauge('uptime', process.uptime());
        }, 30000);
    }

    setupAlerting() {
        // Check alerts every minute
        setInterval(() => {
            this.checkAllAlerts();
        }, 60000);
    }

    checkPerformanceAlerts(performanceEntry) {
        const { duration, operation } = performanceEntry;
        
        if (duration > this.config.alertThresholds.responseTime) {
            this.emit('alert:performance', {
                type: 'slow_operation',
                operation,
                duration,
                threshold: this.config.alertThresholds.responseTime
            });
        }
    }

    checkErrorAlerts(error, component, category) {
        // Check error rate
        const totalLogs = this.metrics.counters.get('logs.total') || 0;
        const totalErrors = this.metrics.counters.get('errors.total') || 0;
        
        if (totalLogs > 0) {
            const errorRate = totalErrors / totalLogs;
            if (errorRate > this.config.alertThresholds.errorRate) {
                this.emit('alert:error_rate', {
                    type: 'high_error_rate',
                    errorRate,
                    threshold: this.config.alertThresholds.errorRate,
                    component,
                    category
                });
            }
        }
    }

    checkAllAlerts() {
        // Check memory usage
        const memUsage = process.memoryUsage();
        const totalMemory = require('os').totalmem();
        const memoryUsagePercent = memUsage.rss / totalMemory;
        
        if (memoryUsagePercent > this.config.alertThresholds.memoryUsage) {
            this.emit('alert:memory', {
                type: 'high_memory_usage',
                usage: memoryUsagePercent,
                threshold: this.config.alertThresholds.memoryUsage
            });
        }
    }

    async readLogs(options) {
        // This would implement log reading from files
        // For now, return empty array
        return [];
    }

    convertLogsToCSV(logs) {
        const headers = ['timestamp', 'level', 'message', 'component', 'sessionId', 'tags', 'metadata'];
        const csvLines = [headers.join(',')];
        
        logs.forEach(log => {
            const row = [
                log.timestamp || '',
                log.level || '',
                `"${this.escapeCsvField(log.message || '')}"`,
                log.component || '',
                log.sessionId || '',
                `"${(log.tags || []).join(';')}"`,
                `"${JSON.stringify(log.metadata || {})}"`
            ];
            csvLines.push(row.join(','));
        });
        
        return csvLines.join('\n');
    }

    escapeCsvField(field) {
        if (typeof field !== 'string') return field;
        return field.replace(/"/g, '""').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
    }
}

module.exports = EnhancedLogger;