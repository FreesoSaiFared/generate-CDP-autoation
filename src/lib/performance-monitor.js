/**
 * Performance Monitor - Real-time Performance Tracking
 * 
 * This module provides comprehensive real-time performance monitoring for the
 * automation platform, including system metrics, application performance,
 * and automation-specific metrics.
 * 
 * Features:
 * - Real-time system resource monitoring
 * - Application performance metrics
 * - Automation execution tracking
 * - Performance trend analysis
 * - Bottleneck detection
 * - Performance alerts and notifications
 * - Historical data analysis
 * - Performance optimization recommendations
 */

const os = require('os');
const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const { performance } = require('perf_hooks');

class PerformanceMonitor extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = {
            monitoringInterval: options.monitoringInterval || 1000, // 1 second
            historySize: options.historySize || 3600, // 1 hour of data at 1-second intervals
            alertThresholds: {
                cpu: options.cpuThreshold || 80,
                memory: options.memoryThreshold || 85,
                disk: options.diskThreshold || 90,
                responseTime: options.responseTimeThreshold || 5000,
                errorRate: options.errorRateThreshold || 0.05
            },
            enableAutoOptimization: options.enableAutoOptimization !== false,
            dataDir: options.dataDir || path.join(process.cwd(), 'data', 'performance'),
            enablePersistence: options.enablePersistence !== false
        };
        
        // Performance data storage
        this.currentMetrics = {
            system: {},
            application: {},
            automation: {},
            custom: {}
        };
        
        this.performanceHistory = {
            system: [],
            application: [],
            automation: [],
            custom: []
        };
        
        // Performance counters
        this.counters = new Map();
        this.timers = new Map();
        this.gauges = new Map();
        this.histograms = new Map();
        
        // Performance baselines
        this.baselines = {
            system: {
                cpu: { min: 0, max: 100, avg: 50 },
                memory: { min: 0, max: 100, avg: 60 },
                disk: { min: 0, max: 100, avg: 50 }
            },
            application: {
                responseTime: { min: 0, max: 10000, avg: 1000 },
                throughput: { min: 0, max: 1000, avg: 100 },
                errorRate: { min: 0, max: 1, avg: 0.01 }
            },
            automation: {
                executionTime: { min: 0, max: 300000, avg: 5000 },
                successRate: { min: 0, max: 1, avg: 0.95 },
                modalityPerformance: {}
            }
        };
        
        // Monitoring state
        this.isMonitoring = false;
        this.monitoringInterval = null;
        this.startTime = null;
        
        // Initialize data directory
        if (this.config.enablePersistence) {
            this.initializeDataDirectory();
        }
        
        // Load historical data
        if (this.config.enablePersistence) {
            this.loadHistoricalData();
        }
    }

    /**
     * Start performance monitoring
     */
    startMonitoring() {
        if (this.isMonitoring) {
            return;
        }
        
        this.isMonitoring = true;
        this.startTime = Date.now();
        
        // Start collection interval
        this.monitoringInterval = setInterval(() => {
            this.collectMetrics();
        }, this.config.monitoringInterval);
        
        // Initial collection
        this.collectMetrics();
        
        this.emit('monitoring:started', {
            timestamp: new Date().toISOString(),
            interval: this.config.monitoringInterval
        });
    }

    /**
     * Stop performance monitoring
     */
    stopMonitoring() {
        if (!this.isMonitoring) {
            return;
        }
        
        this.isMonitoring = false;
        
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        
        // Save final data
        if (this.config.enablePersistence) {
            this.saveHistoricalData();
        }
        
        this.emit('monitoring:stopped', {
            timestamp: new Date().toISOString(),
            duration: Date.now() - this.startTime
        });
    }

    /**
     * Record a performance metric
     * 
     * @param {string} category - Metric category (system, application, automation, custom)
     * @param {string} name - Metric name
     * @param {number} value - Metric value
     * @param {Object} tags - Additional tags
     */
    recordMetric(category, name, value, tags = {}) {
        const metric = {
            timestamp: new Date().toISOString(),
            category,
            name,
            value,
            tags
        };
        
        // Update current metrics
        if (!this.currentMetrics[category]) {
            this.currentMetrics[category] = {};
        }
        this.currentMetrics[category][name] = metric;
        
        // Add to history
        this.performanceHistory[category].push(metric);
        
        // Limit history size
        if (this.performanceHistory[category].length > this.config.historySize) {
            this.performanceHistory[category].shift();
        }
        
        // Check for alerts
        this.checkMetricAlerts(metric);
        
        // Emit metric event
        this.emit('metric:recorded', metric);
    }

    /**
     * Start a performance timer
     * 
     * @param {string} name - Timer name
     * @param {Object} tags - Additional tags
     * @returns {Function} Function to stop the timer
     */
    startTimer(name, tags = {}) {
        const startTime = performance.now();
        const timerId = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        this.timers.set(timerId, {
            name,
            startTime,
            tags
        });
        
        return (additionalTags = {}) => {
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            this.recordMetric('application', name, duration, { ...tags, ...additionalTags });
            this.recordHistogram('timer_duration', duration, { name, ...tags });
            
            this.timers.delete(timerId);
            
            return duration;
        };
    }

    /**
     * Increment a counter
     * 
     * @param {string} name - Counter name
     * @param {number} value - Increment value (default: 1)
     * @param {Object} tags - Additional tags
     */
    incrementCounter(name, value = 1, tags = {}) {
        const key = this.createCounterKey(name, tags);
        const current = this.counters.get(key) || 0;
        this.counters.set(key, current + value);
        
        this.recordMetric('application', name, current + value, tags);
        this.emit('counter:incremented', { name, value: current + value, tags });
    }

    /**
     * Set a gauge value
     * 
     * @param {string} name - Gauge name
     * @param {number} value - Gauge value
     * @param {Object} tags - Additional tags
     */
    setGauge(name, value, tags = {}) {
        this.gauges.set(this.createGaugeKey(name, tags), value);
        this.recordMetric('application', name, value, tags);
        this.emit('gauge:set', { name, value, tags });
    }

    /**
     * Record a histogram value
     * 
     * @param {string} name - Histogram name
     * @param {number} value - Value to record
     * @param {Object} tags - Additional tags
     */
    recordHistogram(name, value, tags = {}) {
        const key = this.createHistogramKey(name, tags);
        const values = this.histograms.get(key) || [];
        
        values.push({
            value,
            timestamp: new Date().toISOString()
        });
        
        // Keep only last 1000 values
        if (values.length > 1000) {
            values.shift();
        }
        
        this.histograms.set(key, values);
        this.emit('histogram:recorded', { name, value, tags });
    }

    /**
     * Record automation execution metrics
     * 
     * @param {Object} params - Execution parameters
     * @param {string} params.modality - Automation modality
     * @param {number} params.executionTime - Execution time in milliseconds
     * @param {boolean} params.success - Whether execution was successful
     * @param {Object} params.metadata - Additional metadata
     */
    recordAutomationExecution(params) {
        const {
            modality,
            executionTime,
            success,
            metadata = {}
        } = params;
        
        // Record execution time
        this.recordMetric('automation', 'execution_time', executionTime, {
            modality,
            success: success.toString()
        });
        
        // Record success/failure
        this.incrementCounter('automation_executions', 1, {
            modality,
            result: success ? 'success' : 'failure'
        });
        
        // Update modality performance
        if (!this.baselines.automation.modalityPerformance[modality]) {
            this.baselines.automation.modalityPerformance[modality] = {
                totalTime: 0,
                count: 0,
                successes: 0,
                avgTime: 0,
                successRate: 0
            };
        }
        
        const modalityPerf = this.baselines.automation.modalityPerformance[modality];
        modalityPerf.totalTime += executionTime;
        modalityPerf.count++;
        if (success) {
            modalityPerf.successes++;
        }
        modalityPerf.avgTime = modalityPerf.totalTime / modalityPerf.count;
        modalityPerf.successRate = modalityPerf.successes / modalityPerf.count;
        
        this.emit('automation:execution_recorded', params);
    }

    /**
     * Get current performance metrics
     * 
     * @returns {Object} Current metrics
     */
    getCurrentMetrics() {
        return {
            timestamp: new Date().toISOString(),
            monitoring: {
                active: this.isMonitoring,
                duration: this.startTime ? Date.now() - this.startTime : 0,
                interval: this.config.monitoringInterval
            },
            system: this.currentMetrics.system || {},
            application: this.currentMetrics.application || {},
            automation: this.currentMetrics.automation || {},
            custom: this.currentMetrics.custom || {},
            counters: Object.fromEntries(this.counters),
            gauges: Object.fromEntries(this.gauges),
            histograms: this.getHistogramSummaries()
        };
    }

    /**
     * Get performance summary for a time range
     * 
     * @param {Object} options - Query options
     * @returns {Object} Performance summary
     */
    getPerformanceSummary(options = {}) {
        const {
            timeRange = 3600, // 1 hour in seconds
            category = 'all',
            includeTrends = true
        } = options;
        
        const cutoffTime = new Date(Date.now() - timeRange * 1000);
        const summary = {
            timeRange,
            categories: {},
            trends: {},
            alerts: [],
            recommendations: []
        };
        
        const categories = category === 'all' 
            ? ['system', 'application', 'automation', 'custom']
            : [category];
        
        categories.forEach(cat => {
            const history = this.performanceHistory[cat] || [];
            const filteredHistory = history.filter(metric => 
                new Date(metric.timestamp) >= cutoffTime
            );
            
            summary.categories[cat] = this.calculateCategorySummary(filteredHistory);
            
            if (includeTrends && filteredHistory.length > 1) {
                summary.trends[cat] = this.calculateTrends(filteredHistory);
            }
        });
        
        // Generate recommendations
        summary.recommendations = this.generatePerformanceRecommendations(summary.categories);
        
        return summary;
    }

    /**
     * Get performance baselines
     * 
     * @returns {Object} Current baselines
     */
    getBaselines() {
        return {
            system: this.baselines.system,
            application: this.baselines.application,
            automation: this.baselines.automation
        };
    }

    /**
     * Update performance baselines
     * 
     * @param {Object} newBaselines - New baseline values
     */
    updateBaselines(newBaselines) {
        this.baselines = {
            system: { ...this.baselines.system, ...newBaselines.system },
            application: { ...this.baselines.application, ...newBaselines.application },
            automation: { ...this.baselines.automation, ...newBaselines.automation }
        };
        
        this.emit('baselines:updated', this.baselines);
    }

    /**
     * Export performance data
     * 
     * @param {Object} options - Export options
     * @returns {Promise<string>} Path to exported file
     */
    async exportData(options = {}) {
        const {
            format = 'json',
            timeRange = 86400, // 24 hours
            categories = ['system', 'application', 'automation']
        } = options;
        
        const exportData = {
            exportedAt: new Date().toISOString(),
            timeRange,
            categories: {},
            baselines: this.getBaselines(),
            summary: this.getPerformanceSummary({ timeRange, category: 'all' })
        };
        
        const cutoffTime = new Date(Date.now() - timeRange * 1000);
        
        categories.forEach(category => {
            const history = this.performanceHistory[category] || [];
            exportData.categories[category] = history.filter(metric => 
                new Date(metric.timestamp) >= cutoffTime
            );
        });
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `performance_export_${timestamp}.${format}`;
        const filepath = path.join(this.config.dataDir, filename);
        
        if (format === 'json') {
            await fs.writeFile(filepath, JSON.stringify(exportData, null, 2));
        } else if (format === 'csv') {
            const csv = this.convertToCSV(exportData);
            await fs.writeFile(filepath, csv);
        }
        
        this.emit('data:exported', { filepath, format, timeRange });
        return filepath;
    }

    // Private helper methods

    async initializeDataDirectory() {
        try {
            await fs.access(this.config.dataDir);
        } catch {
            await fs.mkdir(this.config.dataDir, { recursive: true });
        }
    }

    async loadHistoricalData() {
        try {
            const dataFile = path.join(this.config.dataDir, 'performance_history.json');
            const data = await fs.readFile(dataFile, 'utf8');
            const history = JSON.parse(data);
            
            // Load only recent data to avoid memory issues
            const maxAge = Date.now() - (this.config.historySize * this.config.monitoringInterval);
            
            Object.keys(history).forEach(category => {
                if (this.performanceHistory[category]) {
                    this.performanceHistory[category] = history[category].filter(metric =>
                        new Date(metric.timestamp).getTime() > maxAge
                    );
                }
            });
            
        } catch {
            // File doesn't exist or is invalid
            console.log('No historical data found, starting fresh');
        }
    }

    async saveHistoricalData() {
        try {
            const dataFile = path.join(this.config.dataDir, 'performance_history.json');
            await fs.writeFile(dataFile, JSON.stringify(this.performanceHistory, null, 2));
        } catch (error) {
            console.error('Failed to save historical data:', error);
        }
    }

    collectMetrics() {
        if (!this.isMonitoring) return;
        
        try {
            // System metrics
            this.collectSystemMetrics();
            
            // Application metrics
            this.collectApplicationMetrics();
            
            // Custom metrics (if any)
            this.collectCustomMetrics();
            
            // Emit metrics collection event
            this.emit('metrics:collected', this.getCurrentMetrics());
            
        } catch (error) {
            this.emit('metrics:error', error);
        }
    }

    collectSystemMetrics() {
        // CPU usage
        const cpuUsage = this.getCPUUsage();
        this.recordMetric('system', 'cpu_usage', cpuUsage, { unit: 'percent' });
        
        // Memory usage
        const memoryUsage = this.getMemoryUsage();
        this.recordMetric('system', 'memory_usage', memoryUsage.percentage, { unit: 'percent' });
        this.recordMetric('system', 'memory_used', memoryUsage.used, { unit: 'bytes' });
        this.recordMetric('system', 'memory_available', memoryUsage.available, { unit: 'bytes' });
        
        // System load
        const loadAvg = os.loadavg();
        this.recordMetric('system', 'load_average_1m', loadAvg[0]);
        this.recordMetric('system', 'load_average_5m', loadAvg[1]);
        this.recordMetric('system', 'load_average_15m', loadAvg[2]);
        
        // Process metrics
        const processMetrics = this.getProcessMetrics();
        this.recordMetric('system', 'process_memory', processMetrics.memory, { unit: 'bytes' });
        this.recordMetric('system', 'process_cpu', processMetrics.cpu, { unit: 'percent' });
    }

    collectApplicationMetrics() {
        // Application uptime
        if (this.startTime) {
            const uptime = Date.now() - this.startTime;
            this.recordMetric('application', 'uptime', uptime, { unit: 'milliseconds' });
        }
        
        // Event loop lag
        const start = process.hrtime.bigint();
        setImmediate(() => {
            const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to milliseconds
            this.recordMetric('application', 'event_loop_lag', lag, { unit: 'milliseconds' });
        });
        
        // Active handles and requests
        this.recordMetric('application', 'active_handles', process._getActiveHandles().length);
        this.recordMetric('application', 'active_requests', process._getActiveRequests().length);
    }

    collectCustomMetrics() {
        // This would collect any custom metrics registered by the application
        // For now, it's a placeholder for extensibility
    }

    getCPUUsage() {
        const cpus = os.cpus();
        let totalIdle = 0;
        let totalTick = 0;
        
        cpus.forEach(cpu => {
            for (const type in cpu.times) {
                totalTick += cpu.times[type];
            }
            totalIdle += cpu.times.idle;
        });
        
        const idle = totalIdle / cpus.length;
        const total = totalTick / cpus.length;
        const usage = 100 - (idle / total) * 100;
        
        return Math.round(usage * 100) / 100;
    }

    getMemoryUsage() {
        const total = os.totalmem();
        const free = os.freemem();
        const used = total - free;
        const percentage = (used / total) * 100;
        
        return {
            total,
            used,
            free,
            percentage: Math.round(percentage * 100) / 100
        };
    }

    getProcessMetrics() {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        return {
            memory: memUsage.rss,
            cpu: (cpuUsage.user + cpuUsage.system) / 1000000 // Convert to milliseconds
        };
    }

    checkMetricAlerts(metric) {
        const { category, name, value } = metric;
        
        // Check against thresholds
        if (category === 'system') {
            if (name === 'cpu_usage' && value > this.config.alertThresholds.cpu) {
                this.emit('alert:cpu_high', { metric, threshold: this.config.alertThresholds.cpu });
            }
            if (name === 'memory_usage' && value > this.config.alertThresholds.memory) {
                this.emit('alert:memory_high', { metric, threshold: this.config.alertThresholds.memory });
            }
        } else if (category === 'application') {
            if (name.includes('response_time') && value > this.config.alertThresholds.responseTime) {
                this.emit('alert:response_time_high', { 
                    metric, 
                    threshold: this.config.alertThresholds.responseTime 
                });
            }
        }
    }

    calculateCategorySummary(history) {
        if (history.length === 0) {
            return {
                count: 0,
                latest: null,
                min: null,
                max: null,
                avg: null,
                trend: 'stable'
            };
        }
        
        const values = history.map(m => m.value);
        const latest = history[history.length - 1];
        
        return {
            count: history.length,
            latest: latest.value,
            timestamp: latest.timestamp,
            min: Math.min(...values),
            max: Math.max(...values),
            avg: values.reduce((sum, v) => sum + v, 0) / values.length,
            trend: this.calculateSimpleTrend(values)
        };
    }

    calculateTrends(history) {
        if (history.length < 10) {
            return { direction: 'insufficient_data' };
        }
        
        const recent = history.slice(-5).map(h => h.value);
        const older = history.slice(-10, -5).map(h => h.value);
        
        const recentAvg = recent.reduce((sum, v) => sum + v, 0) / recent.length;
        const olderAvg = older.reduce((sum, v) => sum + v, 0) / older.length;
        
        const change = ((recentAvg - olderAvg) / olderAvg) * 100;
        
        return {
            direction: change > 5 ? 'increasing' : change < -5 ? 'decreasing' : 'stable',
            changePercent: Math.round(change * 100) / 100,
            recentAvg: Math.round(recentAvg * 100) / 100,
            olderAvg: Math.round(olderAvg * 100) / 100
        };
    }

    calculateSimpleTrend(values) {
        if (values.length < 3) return 'stable';
        
        const recent = values.slice(-3);
        const trend = recent[2] - recent[0];
        
        if (Math.abs(trend) < 0.1) return 'stable';
        return trend > 0 ? 'increasing' : 'decreasing';
    }

    generatePerformanceRecommendations(categories) {
        const recommendations = [];
        
        // System recommendations
        if (categories.system?.latest) {
            const cpuUsage = categories.system.latest;
            if (cpuUsage > this.config.alertThresholds.cpu) {
                recommendations.push({
                    category: 'system',
                    priority: 'high',
                    type: 'cpu_optimization',
                    message: 'CPU usage is high - consider optimizing CPU-intensive operations',
                    action: 'optimize_cpu'
                });
            }
        }
        
        // Application recommendations
        if (categories.application?.latest) {
            const responseTime = categories.application.latest;
            if (responseTime > this.config.alertThresholds.responseTime) {
                recommendations.push({
                    category: 'application',
                    priority: 'medium',
                    type: 'response_time_optimization',
                    message: 'Response times are elevated - investigate performance bottlenecks',
                    action: 'optimize_response_time'
                });
            }
        }
        
        return recommendations;
    }

    getHistogramSummaries() {
        const summaries = {};
        
        for (const [key, values] of this.histograms.entries()) {
            if (values.length === 0) {
                summaries[key] = { count: 0 };
                continue;
            }
            
            const numericValues = values.map(v => v.value);
            numericValues.sort((a, b) => a - b);
            
            summaries[key] = {
                count: values.length,
                sum: numericValues.reduce((sum, v) => sum + v, 0),
                avg: numericValues.reduce((sum, v) => sum + v, 0) / numericValues.length,
                min: numericValues[0],
                max: numericValues[numericValues.length - 1],
                median: numericValues[Math.floor(numericValues.length / 2)],
                p95: numericValues[Math.floor(numericValues.length * 0.95)],
                p99: numericValues[Math.floor(numericValues.length * 0.99)]
            };
        }
        
        return summaries;
    }

    createCounterKey(name, tags) {
        const tagString = Object.keys(tags)
            .sort()
            .map(key => `${key}=${tags[key]}`)
            .join(',');
        return tagString ? `${name}{${tagString}}` : name;
    }

    createGaugeKey(name, tags) {
        return this.createCounterKey(name, tags);
    }

    createHistogramKey(name, tags) {
        return this.createCounterKey(name, tags);
    }

    convertToCSV(data) {
        const csvLines = [];
        
        // Header
        csvLines.push('Timestamp,Category,Name,Value,Tags');
        
        // Data rows
        Object.keys(data.categories).forEach(category => {
            data.categories[category].forEach(metric => {
                const tags = Object.keys(metric.tags || {})
                    .map(key => `${key}=${metric.tags[key]}`)
                    .join(';');
                
                csvLines.push([
                    metric.timestamp,
                    category,
                    metric.name,
                    metric.value,
                    tags
                ].join(','));
            });
        });
        
        return csvLines.join('\n');
    }
}

module.exports = PerformanceMonitor;