/**
 * Performance Tracker - Execution Metrics Collection and Analysis
 * 
 * This module tracks execution metrics for different automation modalities,
 * providing insights into performance, reliability, and optimization opportunities.
 * 
 * Features:
 * - Execution time tracking and analysis
 * - Success rate monitoring per modality and domain
 * - Performance trend analysis
 * - Anomaly detection for performance degradation
 * - Comparative analysis between modalities
 * - Resource utilization tracking
 */

const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');

class PerformanceTracker extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.dataDir = options.dataDir || path.join(process.cwd(), 'data', 'performance');
        this.retentionDays = options.retentionDays || 30;
        this.anomalyThreshold = options.anomalyThreshold || 2.5; // Standard deviations
        
        // In-memory cache for recent metrics
        this.recentMetrics = {
            integuru: [],
            headless_cdp: [],
            visible_browser: []
        };
        
        // Performance baselines
        this.baselines = {
            integuru: { avgTime: 3.5, successRate: 0.95, maxTime: 10 },
            headless_cdp: { avgTime: 22.5, successRate: 0.85, maxTime: 60 },
            visible_browser: { avgTime: 300, successRate: 0.99, maxTime: 900 }
        };
        
        // Initialize data directory
        this.initializeDataDirectory();
        
        // Load existing metrics
        this.loadMetrics();
        
        // Setup periodic cleanup
        this.setupPeriodicCleanup();
    }

    /**
     * Record execution metrics
     * 
     * @param {Object} params - Execution parameters
     * @param {string} params.modality - Automation modality used
     * @param {number} params.estimatedTime - Estimated execution time (seconds)
     * @param {number} params.actualTime - Actual execution time (seconds)
     * @param {boolean} params.success - Whether execution was successful
     * @param {string} params.error - Error message (if failed)
     * @param {string} params.sessionId - Unique session identifier
     * @param {Object} params.metadata - Additional metadata (domain, task type, etc.)
     * @returns {Promise<Object>} Recorded metrics
     */
    async recordExecution(params) {
        const {
            modality,
            estimatedTime,
            actualTime,
            success,
            error,
            sessionId,
            metadata = {}
        } = params;
        
        const timestamp = new Date().toISOString();
        const metric = {
            id: this.generateMetricId(),
            timestamp,
            modality,
            estimatedTime,
            actualTime,
            success,
            error: error || null,
            sessionId,
            metadata,
            performance: {
                timeAccuracy: this.calculateTimeAccuracy(estimatedTime, actualTime),
                timeDeviation: this.calculateTimeDeviation(estimatedTime, actualTime),
                isAnomaly: false
            }
        };
        
        // Check for performance anomalies
        metric.performance.isAnomaly = this.detectAnomaly(modality, actualTime);
        
        // Store in memory
        this.recentMetrics[modality].push(metric);
        
        // Keep only recent metrics in memory (last 100)
        if (this.recentMetrics[modality].length > 100) {
            this.recentMetrics[modality].shift();
        }
        
        // Persist to disk
        await this.persistMetric(metric);
        
        // Emit event for real-time monitoring
        this.emit('execution:recorded', metric);
        
        if (metric.performance.isAnomaly) {
            this.emit('performance:anomaly', metric);
        }
        
        return metric;
    }

    /**
     * Get performance statistics for a modality
     * 
     * @param {string} modality - Automation modality
     * @param {Object} options - Query options
     * @param {number} options.timeRange - Time range in hours (default: 24)
     * @param {string} options.domain - Filter by domain
     * @param {string} options.taskType - Filter by task type
     * @returns {Promise<Object>} Performance statistics
     */
    async getPerformanceStats(modality, options = {}) {
        const {
            timeRange = 24,
            domain = null,
            taskType = null
        } = options;
        
        const metrics = await this.loadMetricsForModality(modality, {
            timeRange,
            domain,
            taskType
        });
        
        if (metrics.length === 0) {
            return this.getEmptyStats(modality);
        }
        
        const stats = {
            modality,
            timeRange,
            totalExecutions: metrics.length,
            successfulExecutions: metrics.filter(m => m.success).length,
            failedExecutions: metrics.filter(m => !m.success).length,
            timing: this.calculateTimingStats(metrics),
            accuracy: this.calculateAccuracyStats(metrics),
            reliability: this.calculateReliabilityStats(metrics),
            trends: this.calculateTrends(metrics),
            anomalies: metrics.filter(m => m.performance.isAnomaly),
            topErrors: this.getTopErrors(metrics),
            byDomain: this.groupByDomain(metrics),
            byTaskType: this.groupByTaskType(metrics)
        };
        
        // Calculate overall performance score
        stats.overallScore = this.calculatePerformanceScore(stats);
        
        return stats;
    }

    /**
     * Compare performance between modalities
     * 
     * @param {Array} modalities - Modalities to compare
     * @param {Object} options - Comparison options
     * @returns {Promise<Object>} Comparative analysis
     */
    async compareModalities(modalities = ['integuru', 'headless_cdp', 'visible_browser'], options = {}) {
        const timeRange = options.timeRange || 24;
        
        const comparison = {
            timeRange,
            modalities: {},
            summary: {
                fastest: null,
                mostReliable: null,
                mostAccurate: null,
                recommendations: []
            }
        };
        
        // Get stats for each modality
        for (const modality of modalities) {
            comparison.modalities[modality] = await this.getPerformanceStats(modality, { timeRange });
        }
        
        // Find fastest modality
        let fastestModality = null;
        let fastestTime = Infinity;
        
        Object.keys(comparison.modalities).forEach(modality => {
            const stats = comparison.modalities[modality];
            if (stats.timing.averageTime < fastestTime && stats.totalExecutions > 0) {
                fastestTime = stats.timing.averageTime;
                fastestModality = modality;
            }
        });
        
        comparison.summary.fastest = fastestModality;
        
        // Find most reliable modality
        let mostReliable = null;
        let highestReliability = 0;
        
        Object.keys(comparison.modalities).forEach(modality => {
            const stats = comparison.modalities[modality];
            if (stats.reliability.successRate > highestReliability && stats.totalExecutions > 0) {
                highestReliability = stats.reliability.successRate;
                mostReliable = modality;
            }
        });
        
        comparison.summary.mostReliable = mostReliable;
        
        // Find most accurate modality
        let mostAccurate = null;
        let highestAccuracy = 0;
        
        Object.keys(comparison.modalities).forEach(modality => {
            const stats = comparison.modalities[modality];
            if (stats.accuracy.timeAccuracy > highestAccuracy && stats.totalExecutions > 0) {
                highestAccuracy = stats.accuracy.timeAccuracy;
                mostAccurate = modality;
            }
        });
        
        comparison.summary.mostAccurate = mostAccurate;
        
        // Generate recommendations
        comparison.summary.recommendations = this.generateRecommendations(comparison);
        
        return comparison;
    }

    /**
     * Get performance trends over time
     * 
     * @param {string} modality - Automation modality
     * @param {Object} options - Trend options
     * @param {number} options.days - Number of days to analyze (default: 7)
     * @param {string} options.granularity - Time granularity (hour, day, week)
     * @returns {Promise<Object>} Performance trends
     */
    async getPerformanceTrends(modality, options = {}) {
        const {
            days = 7,
            granularity = 'day'
        } = options;
        
        const metrics = await this.loadMetricsForModality(modality, {
            timeRange: days * 24
        });
        
        const trends = this.groupMetricsByTime(metrics, granularity);
        
        return {
            modality,
            period: `${days} days`,
            granularity,
            data: trends,
            insights: this.analyzeTrends(trends)
        };
    }

    /**
     * Detect performance anomalies
     * 
     * @param {string} modality - Automation modality
     * @param {Object} options - Detection options
     * @returns {Promise<Object>} Detected anomalies
     */
    async detectAnomalies(modality, options = {}) {
        const {
            timeRange = 24,
            severity = 'medium' // low, medium, high
        } = options;
        
        const metrics = await this.loadMetricsForModality(modality, { timeRange });
        const anomalies = [];
        
        // Statistical anomaly detection
        const timeStats = this.calculateTimingStats(metrics);
        const threshold = this.getAnomalyThreshold(severity);
        
        metrics.forEach(metric => {
            const zScore = Math.abs(
                (metric.actualTime - timeStats.averageTime) / timeStats.standardDeviation
            );
            
            if (zScore > threshold) {
                anomalies.push({
                    type: 'timing',
                    severity: this.classifySeverity(zScore),
                    metric,
                    zScore,
                    description: `Execution time ${metric.actualTime}s is ${zScore.toFixed(2)} standard deviations from mean`
                });
            }
        });
        
        // Success rate anomaly detection
        const recentFailures = metrics.filter(m => !m.success).length;
        const expectedFailures = metrics.length * (1 - this.baselines[modality].successRate);
        
        if (recentFailures > expectedFailures * 1.5) {
            anomalies.push({
                type: 'success_rate',
                severity: 'high',
                description: `Success rate ${(metrics.length - recentFailures) / metrics.length} is below expected ${this.baselines[modality].successRate}`,
                actualRate: (metrics.length - recentFailures) / metrics.length,
                expectedRate: this.baselines[modality].successRate
            });
        }
        
        return {
            modality,
            timeRange,
            anomalies,
            summary: {
                totalAnomalies: anomalies.length,
                severity: this.getOverallSeverity(anomalies)
            }
        };
    }

    /**
     * Export performance data for analysis
     * 
     * @param {Object} options - Export options
     * @returns {Promise<string>} Path to exported file
     */
    async exportData(options = {}) {
        const {
            format = 'json',
            timeRange = 24 * 7, // 1 week
            modalities = ['integuru', 'headless_cdp', 'visible_browser']
        } = options;
        
        const exportData = {
            exportedAt: new Date().toISOString(),
            timeRange,
            modalities: {}
        };
        
        for (const modality of modalities) {
            const metrics = await this.loadMetricsForModality(modality, { timeRange });
            exportData.modalities[modality] = {
                metrics,
                stats: this.calculateTimingStats(metrics),
                summary: await this.getPerformanceStats(modality, { timeRange })
            };
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `performance_export_${timestamp}.${format}`;
        const filepath = path.join(this.dataDir, filename);
        
        if (format === 'json') {
            await fs.writeFile(filepath, JSON.stringify(exportData, null, 2));
        } else if (format === 'csv') {
            const csv = this.convertToCSV(exportData);
            await fs.writeFile(filepath, csv);
        }
        
        return filepath;
    }

    // Helper methods
    
    async initializeDataDirectory() {
        try {
            await fs.access(this.dataDir);
        } catch {
            await fs.mkdir(this.dataDir, { recursive: true });
        }
    }

    generateMetricId() {
        return `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    calculateTimeAccuracy(estimated, actual) {
        if (estimated === 0) return 0;
        const accuracy = 1 - Math.abs(estimated - actual) / estimated;
        return Math.max(0, Math.min(1, accuracy));
    }

    calculateTimeDeviation(estimated, actual) {
        return ((actual - estimated) / estimated) * 100;
    }

    detectAnomaly(modality, actualTime) {
        const baseline = this.baselines[modality];
        return actualTime > baseline.maxTime;
    }

    async persistMetric(metric) {
        const date = new Date(metric.timestamp);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        const dir = path.join(this.dataDir, metric.modality, `${year}-${month}`);
        await fs.mkdir(dir, { recursive: true });
        
        const filename = `${day}.json`;
        const filepath = path.join(dir, filename);
        
        try {
            // Load existing metrics for the day
            let dailyMetrics = [];
            try {
                const data = await fs.readFile(filepath, 'utf8');
                dailyMetrics = JSON.parse(data);
            } catch {
                // File doesn't exist yet
            }
            
            // Add new metric
            dailyMetrics.push(metric);
            
            // Save back
            await fs.writeFile(filepath, JSON.stringify(dailyMetrics, null, 2));
            
        } catch (error) {
            console.error('Failed to persist metric:', error);
        }
    }

    async loadMetrics() {
        // Load recent metrics into memory for faster access
        for (const modality of Object.keys(this.recentMetrics)) {
            try {
                const metrics = await this.loadMetricsForModality(modality, { timeRange: 1 });
                this.recentMetrics[modality] = metrics.slice(-50); // Keep last 50
            } catch (error) {
                console.error(`Failed to load metrics for ${modality}:`, error);
            }
        }
    }

    async loadMetricsForModality(modality, options = {}) {
        const { timeRange = 24, domain = null, taskType = null } = options;
        
        const metrics = [];
        const now = new Date();
        const cutoffTime = new Date(now.getTime() - timeRange * 60 * 60 * 1000);
        
        try {
            const modalityDir = path.join(this.dataDir, modality);
            const years = await fs.readdir(modalityDir);
            
            for (const yearMonth of years) {
                const monthDir = path.join(modalityDir, yearMonth);
                const days = await fs.readdir(monthDir);
                
                for (const day of days) {
                    const dayFile = path.join(monthDir, day);
                    const data = await fs.readFile(dayFile, 'utf8');
                    const dayMetrics = JSON.parse(data);
                    
                    // Filter by time and criteria
                    const filtered = dayMetrics.filter(metric => {
                        const metricTime = new Date(metric.timestamp);
                        
                        // Time filter
                        if (metricTime < cutoffTime) return false;
                        
                        // Domain filter
                        if (domain && metric.metadata.domain !== domain) return false;
                        
                        // Task type filter
                        if (taskType && metric.metadata.taskType !== taskType) return false;
                        
                        return true;
                    });
                    
                    metrics.push(...filtered);
                }
            }
        } catch (error) {
            // Directory doesn't exist or other error
        }
        
        return metrics.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    calculateTimingStats(metrics) {
        if (metrics.length === 0) {
            return {
                averageTime: 0,
                minTime: 0,
                maxTime: 0,
                medianTime: 0,
                standardDeviation: 0,
                percentile95: 0
            };
        }
        
        const times = metrics.map(m => m.actualTime).sort((a, b) => a - b);
        const sum = times.reduce((a, b) => a + b, 0);
        const mean = sum / times.length;
        
        // Calculate standard deviation
        const squaredDiffs = times.map(time => Math.pow(time - mean, 2));
        const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / times.length;
        const standardDeviation = Math.sqrt(avgSquaredDiff);
        
        return {
            averageTime: Math.round(mean * 100) / 100,
            minTime: times[0],
            maxTime: times[times.length - 1],
            medianTime: times[Math.floor(times.length / 2)],
            standardDeviation: Math.round(standardDeviation * 100) / 100,
            percentile95: times[Math.floor(times.length * 0.95)]
        };
    }

    calculateAccuracyStats(metrics) {
        if (metrics.length === 0) {
            return { timeAccuracy: 0, estimateReliability: 0 };
        }
        
        const timeAccuracies = metrics.map(m => m.performance.timeAccuracy);
        const avgTimeAccuracy = timeAccuracies.reduce((a, b) => a + b, 0) / timeAccuracies.length;
        
        // Calculate estimate reliability (how often estimates are within 20% of actual)
        const reliableEstimates = metrics.filter(m => 
            Math.abs(m.performance.timeDeviation) <= 20
        ).length;
        const estimateReliability = reliableEstimates / metrics.length;
        
        return {
            timeAccuracy: Math.round(avgTimeAccuracy * 100) / 100,
            estimateReliability: Math.round(estimateReliability * 100) / 100
        };
    }

    calculateReliabilityStats(metrics) {
        if (metrics.length === 0) {
            return { successRate: 0, failureRate: 0, mtbf: 0 };
        }
        
        const successful = metrics.filter(m => m.success).length;
        const successRate = successful / metrics.length;
        const failureRate = 1 - successRate;
        
        // Calculate Mean Time Between Failures (MTBF)
        const failures = metrics.filter(m => !m.success);
        let mtbf = 0;
        
        if (failures.length > 1) {
            const failureTimes = failures.map(f => new Date(f.timestamp)).sort();
            const intervals = [];
            
            for (let i = 1; i < failureTimes.length; i++) {
                intervals.push(failureTimes[i] - failureTimes[i - 1]);
            }
            
            mtbf = intervals.reduce((a, b) => a + b, 0) / intervals.length / (1000 * 60 * 60); // Convert to hours
        }
        
        return {
            successRate: Math.round(successRate * 100) / 100,
            failureRate: Math.round(failureRate * 100) / 100,
            mtbf: Math.round(mtbf * 100) / 100
        };
    }

    getEmptyStats(modality) {
        return {
            modality,
            timeRange: 0,
            totalExecutions: 0,
            successfulExecutions: 0,
            failedExecutions: 0,
            timing: { averageTime: 0, minTime: 0, maxTime: 0 },
            accuracy: { timeAccuracy: 0, estimateReliability: 0 },
            reliability: { successRate: 0, failureRate: 0, mtbf: 0 },
            trends: {},
            anomalies: [],
            topErrors: [],
            byDomain: {},
            byTaskType: {},
            overallScore: 0
        };
    }

    setupPeriodicCleanup() {
        // Clean up old metrics daily
        setInterval(async () => {
            await this.cleanupOldMetrics();
        }, 24 * 60 * 60 * 1000);
    }

    async cleanupOldMetrics() {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
        
        try {
            const modalities = await fs.readdir(this.dataDir);
            
            for (const modality of modalities) {
                const modalityDir = path.join(this.dataDir, modality);
                const years = await fs.readdir(modalityDir);
                
                for (const yearMonth of years) {
                    const [year, month] = yearMonth.split('-');
                    const folderDate = new Date(`${year}-${month}-01`);
                    
                    if (folderDate < cutoffDate) {
                        const monthDir = path.join(modalityDir, yearMonth);
                        await fs.rmdir(monthDir, { recursive: true });
                    }
                }
            }
        } catch (error) {
            console.error('Cleanup failed:', error);
        }
    }

    calculateTrends(metrics) {
        const trends = {
            timeTrend: 'stable',
            successTrend: 'stable',
            volumeTrend: 'stable'
        };
        
        if (metrics.length < 5) {
            return trends;
        }
        
        // Sort by timestamp
        const sortedMetrics = metrics.sort((a, b) =>
            new Date(a.timestamp) - new Date(b.timestamp)
        );
        
        // Calculate time trend
        const recentTimes = sortedMetrics.slice(-5).map(m => m.actualTime);
        const olderTimes = sortedMetrics.slice(-10, -5).map(m => m.actualTime);
        
        if (recentTimes.length > 0 && olderTimes.length > 0) {
            const recentAvg = recentTimes.reduce((a, b) => a + b, 0) / recentTimes.length;
            const olderAvg = olderTimes.reduce((a, b) => a + b, 0) / olderTimes.length;
            
            if (recentAvg > olderAvg * 1.1) {
                trends.timeTrend = 'increasing';
            } else if (recentAvg < olderAvg * 0.9) {
                trends.timeTrend = 'decreasing';
            }
        }
        
        // Calculate success trend
        const recentSuccess = sortedMetrics.slice(-5).filter(m => m.success).length;
        const olderSuccess = sortedMetrics.slice(-10, -5).filter(m => m.success).length;
        
        if (recentSuccess < olderSuccess * 0.8) {
            trends.successTrend = 'decreasing';
        } else if (recentSuccess > olderSuccess * 1.2) {
            trends.successTrend = 'increasing';
        }
        
        // Calculate volume trend
        const recentVolume = sortedMetrics.slice(-5).length;
        const olderVolume = sortedMetrics.slice(-10, -5).length;
        
        if (recentVolume > olderVolume * 1.2) {
            trends.volumeTrend = 'increasing';
        } else if (recentVolume < olderVolume * 0.8) {
            trends.volumeTrend = 'decreasing';
        }
        
        return trends;
    }

    groupByDomain(metrics) {
        const grouped = {};
        
        metrics.forEach(metric => {
            const domain = metric.metadata?.domain || 'unknown';
            
            if (!grouped[domain]) {
                grouped[domain] = {
                    count: 0,
                    totalTime: 0,
                    successes: 0,
                    failures: 0
                };
            }
            
            grouped[domain].count++;
            grouped[domain].totalTime += metric.actualTime;
            
            if (metric.success) {
                grouped[domain].successes++;
            } else {
                grouped[domain].failures++;
            }
        });
        
        // Calculate averages and rates
        Object.keys(grouped).forEach(domain => {
            const data = grouped[domain];
            data.averageTime = data.count > 0 ? data.totalTime / data.count : 0;
            data.successRate = data.count > 0 ? data.successes / data.count : 0;
        });
        
        return grouped;
    }

    groupByTaskType(metrics) {
        const grouped = {};
        
        metrics.forEach(metric => {
            const taskType = metric.metadata?.taskType || 'general';
            
            if (!grouped[taskType]) {
                grouped[taskType] = {
                    count: 0,
                    totalTime: 0,
                    successes: 0,
                    failures: 0
                };
            }
            
            grouped[taskType].count++;
            grouped[taskType].totalTime += metric.actualTime;
            
            if (metric.success) {
                grouped[taskType].successes++;
            } else {
                grouped[taskType].failures++;
            }
        });
        
        // Calculate averages and rates
        Object.keys(grouped).forEach(taskType => {
            const data = grouped[taskType];
            data.averageTime = data.count > 0 ? data.totalTime / data.count : 0;
            data.successRate = data.count > 0 ? data.successes / data.count : 0;
        });
        
        return grouped;
    }

    getTopErrors(metrics) {
        const errorCounts = {};
        
        metrics.forEach(metric => {
            if (metric.error) {
                const error = metric.error;
                errorCounts[error] = (errorCounts[error] || 0) + 1;
            }
        });
        
        // Sort by frequency and return top 5
        return Object.keys(errorCounts)
            .map(error => ({ error, count: errorCounts[error] }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }

    calculatePerformanceScore(stats) {
        let score = 100;
        
        // Time performance factor
        const avgTime = stats.timing.averageTime;
        const targetTime = this.getBaselineTime(stats.modality);
        
        if (avgTime > targetTime * 2) {
            score -= 30;
        } else if (avgTime > targetTime * 1.5) {
            score -= 15;
        } else if (avgTime > targetTime) {
            score -= 5;
        }
        
        // Success rate factor
        const successRate = stats.reliability.successRate;
        if (successRate < 0.9) {
            score -= 20;
        } else if (successRate < 0.95) {
            score -= 10;
        }
        
        // Accuracy factor
        const timeAccuracy = stats.accuracy.timeAccuracy;
        if (timeAccuracy < 0.8) {
            score -= 15;
        } else if (timeAccuracy < 0.9) {
            score -= 5;
        }
        
        return Math.max(0, score);
    }

    getBaselineTime(modality) {
        const baselines = {
            integuru: 3.5,
            headless_cdp: 22.5,
            visible_browser: 300
        };
        
        return baselines[modality] || 60;
    }

    getAnomalyThreshold(severity) {
        const thresholds = {
            low: 1.5,
            medium: 2.0,
            high: 2.5
        };
        
        return thresholds[severity] || 2.0;
    }

    classifySeverity(zScore) {
        if (zScore > 3.0) {
            return 'high';
        } else if (zScore > 2.0) {
            return 'medium';
        } else {
            return 'low';
        }
    }

    getOverallSeverity(anomalies) {
        if (anomalies.length === 0) {
            return 'none';
        }
        
        const highSeverityCount = anomalies.filter(a => a.severity === 'high').length;
        const mediumSeverityCount = anomalies.filter(a => a.severity === 'medium').length;
        
        if (highSeverityCount > 0) {
            return 'high';
        } else if (mediumSeverityCount > 0) {
            return 'medium';
        } else {
            return 'low';
        }
    }

    groupMetricsByTime(metrics, granularity) {
        const grouped = {};
        
        metrics.forEach(metric => {
            const date = new Date(metric.timestamp);
            let key;
            
            switch (granularity) {
                case 'hour':
                    key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
                    break;
                case 'day':
                    key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
                    break;
                case 'week':
                    const weekStart = new Date(date);
                    weekStart.setDate(date.getDate() - date.getDay());
                    key = `${weekStart.getFullYear()}-W${Math.ceil(weekStart.getDate() / 7)}`;
                    break;
                default:
                    key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
            }
            
            if (!grouped[key]) {
                grouped[key] = {
                    timestamp: metric.timestamp,
                    count: 0,
                    totalTime: 0,
                    successes: 0,
                    failures: 0
                };
            }
            
            grouped[key].count++;
            grouped[key].totalTime += metric.actualTime;
            
            if (metric.success) {
                grouped[key].successes++;
            } else {
                grouped[key].failures++;
            }
        });
        
        // Calculate averages for each group
        Object.keys(grouped).forEach(key => {
            const group = grouped[key];
            group.averageTime = group.count > 0 ? group.totalTime / group.count : 0;
            group.successRate = group.count > 0 ? group.successes / group.count : 0;
        });
        
        return grouped;
    }

    analyzeTrends(trends) {
        const insights = [];
        
        const timeKeys = Object.keys(trends).sort();
        
        if (timeKeys.length < 3) {
            return insights;
        }
        
        // Analyze time trends
        const recentTimes = timeKeys.slice(-3).map(key => trends[key].averageTime);
        if (recentTimes.length >= 3) {
            const increasing = recentTimes.every((time, i) => i === 0 || time >= recentTimes[i - 1]);
            const decreasing = recentTimes.every((time, i) => i === 0 || time <= recentTimes[i - 1]);
            
            if (increasing) {
                insights.push({
                    type: 'performance_degradation',
                    severity: 'medium',
                    description: 'Execution times are consistently increasing'
                });
            } else if (decreasing) {
                insights.push({
                    type: 'performance_improvement',
                    severity: 'info',
                    description: 'Execution times are consistently decreasing'
                });
            }
        }
        
        // Analyze success rate trends
        const recentSuccess = timeKeys.slice(-3).map(key => trends[key].successRate);
        if (recentSuccess.length >= 3) {
            const declining = recentSuccess.every((rate, i) => i === 0 || rate <= recentSuccess[i - 1]);
            
            if (declining && recentSuccess[recentSuccess.length - 1] < 0.8) {
                insights.push({
                    type: 'reliability_concern',
                    severity: 'high',
                    description: 'Success rates are declining below 80%'
                });
            }
        }
        
        return insights;
    }

    convertToCSV(data) {
        const csvLines = [];
        
        // Header
        csvLines.push('Timestamp,Modality,EstimatedTime,ActualTime,Success,Error');
        
        // Data rows
        if (data.decisions) {
            Object.values(data.decisions).forEach(decisions => {
                decisions.forEach(decision => {
                    if (decision.execution) {
                        csvLines.push([
                            decision.timestamp,
                            decision.decision.modality,
                            decision.decision.estimatedTime,
                            decision.execution.actualTime,
                            decision.execution.success,
                            decision.execution.error || ''
                        ].join(','));
                    }
                });
            });
        }
        
        return csvLines.join('\n');
    }

    generateRecommendations(comparison) {
        const recommendations = [];
        
        // Speed recommendations
        if (comparison.summary.fastest) {
            const fastest = comparison.modalities[comparison.summary.fastest];
            if (fastest && fastest.timing.averageTime > 30) {
                recommendations.push({
                    category: 'speed',
                    priority: 'high',
                    description: 'Consider optimizing for faster execution',
                    modality: comparison.summary.fastest
                });
            }
        }
        
        // Reliability recommendations
        if (comparison.summary.mostReliable) {
            const reliable = comparison.modalities[comparison.summary.mostReliable];
            if (reliable && reliable.reliability.successRate < 0.9) {
                recommendations.push({
                    category: 'reliability',
                    priority: 'high',
                    description: 'Improve success rate through better error handling',
                    modality: comparison.summary.mostReliable
                });
            }
        }
        
        // Accuracy recommendations
        if (comparison.summary.mostAccurate) {
            const accurate = comparison.modalities[comparison.summary.mostAccurate];
            if (accurate && accurate.accuracy.timeAccuracy < 0.8) {
                recommendations.push({
                    category: 'accuracy',
                    priority: 'medium',
                    description: 'Improve time estimation accuracy',
                    modality: comparison.summary.mostAccurate
                });
            }
        }
        
        return recommendations;
    }
}

module.exports = PerformanceTracker;