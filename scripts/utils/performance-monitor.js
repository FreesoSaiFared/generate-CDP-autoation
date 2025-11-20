/**
 * Performance Monitor Utility
 * 
 * Tracks and analyzes performance metrics during test execution,
 * including CPU usage, memory consumption, execution times,
 * and network performance.
 */

const { performance } = require('perf_hooks');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');

class PerformanceMonitor extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            interval: options.interval || 1000, // 1 second
            maxDataPoints: options.maxDataPoints || 300, // 5 minutes at 1s interval
            outputDir: options.outputDir || './test-results',
            enableSystemMetrics: options.enableSystemMetrics !== false,
            ...options
        };
        
        this.isMonitoring = false;
        this.monitorInterval = null;
        this.startTime = null;
        this.metrics = {
            timestamps: [],
            cpu: [],
            memory: [],
            network: [],
            custom: {}
        };
        
        this.processId = process.pid;
        this.ensureOutputDirectory();
    }

    /**
     * Start performance monitoring
     */
    start() {
        if (this.isMonitoring) {
            this.emit('warning', 'Performance monitoring already started');
            return;
        }
        
        this.isMonitoring = true;
        this.startTime = Date.now();
        this.metrics.timestamps = [];
        this.metrics.cpu = [];
        this.metrics.memory = [];
        this.metrics.network = [];
        this.metrics.custom = {};
        
        this.emit('started', { timestamp: new Date().toISOString() });
        
        // Start monitoring interval
        this.monitorInterval = setInterval(() => {
            this.collectMetrics();
        }, this.options.interval);
        
        // Collect initial metrics
        this.collectMetrics();
    }

    /**
     * Stop performance monitoring
     */
    stop() {
        if (!this.isMonitoring) {
            this.emit('warning', 'Performance monitoring not started');
            return;
        }
        
        this.isMonitoring = false;
        
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
        
        // Collect final metrics
        this.collectMetrics();
        
        const duration = Date.now() - this.startTime;
        this.emit('stopped', { 
            timestamp: new Date().toISOString(),
            duration,
            dataPoints: this.metrics.timestamps.length
        });
        
        return this.getSummary();
    }

    /**
     * Collect performance metrics
     */
    async collectMetrics() {
        const timestamp = Date.now();
        this.metrics.timestamps.push(timestamp);
        
        try {
            // Collect memory metrics
            const memoryUsage = process.memoryUsage();
            this.metrics.memory.push({
                timestamp,
                rss: memoryUsage.rss,
                heapUsed: memoryUsage.heapUsed,
                heapTotal: memoryUsage.heapTotal,
                external: memoryUsage.external,
                arrayBuffers: memoryUsage.arrayBuffers
            });
            
            // Collect CPU metrics (system-wide if enabled)
            if (this.options.enableSystemMetrics) {
                const cpuUsage = await this.getCPUUsage();
                this.metrics.cpu.push({
                    timestamp,
                    usage: cpuUsage,
                    processUsage: process.cpuUsage()
                });
            }
            
            // Trim data points if exceeding maximum
            if (this.metrics.timestamps.length > this.options.maxDataPoints) {
                const excess = this.metrics.timestamps.length - this.options.maxDataPoints;
                
                this.metrics.timestamps.splice(0, excess);
                this.metrics.memory.splice(0, excess);
                this.metrics.cpu.splice(0, excess);
                
                // Trim custom metrics
                Object.keys(this.metrics.custom).forEach(key => {
                    if (this.metrics.custom[key].length > this.options.maxDataPoints) {
                        this.metrics.custom[key].splice(0, excess);
                    }
                });
            }
            
            this.emit('metricsCollected', {
                timestamp,
                memory: this.metrics.memory[this.metrics.memory.length - 1],
                cpu: this.metrics.cpu[this.metrics.cpu.length - 1]
            });
            
        } catch (error) {
            this.emit('error', 'Failed to collect metrics', error);
        }
    }

    /**
     * Get CPU usage (system-wide)
     */
    async getCPUUsage() {
        return new Promise((resolve) => {
            const command = process.platform === 'win32' 
                ? 'wmic cpu get loadpercentage /value'
                : 'top -bn1 | grep "Cpu(s)" | sed "s/.*, *\\([0-9.]*\\)%* id.*/\\1/" | awk \'{print 100 - $1}\'';
            
            const child = spawn(command, [], {
                shell: true,
                stdio: ['pipe', 'pipe', 'pipe']
            });
            
            let output = '';
            child.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            child.on('close', (code) => {
                if (code === 0) {
                    const usage = this.parseCPUUsage(output);
                    resolve(usage);
                } else {
                    resolve(0);
                }
            });
            
            child.on('error', () => {
                resolve(0);
            });
        });
    }

    /**
     * Parse CPU usage output
     */
    parseCPUUsage(output) {
        try {
            if (process.platform === 'win32') {
                const match = output.match(/LoadPercentage=(\d+)/);
                return match ? parseFloat(match[1]) : 0;
            } else {
                const match = output.match(/(\d+(?:\.\d+)?)/);
                return match ? parseFloat(match[1]) : 0;
            }
        } catch {
            return 0;
        }
    }

    /**
     * Record custom metric
     */
    recordCustomMetric(name, value, metadata = null) {
        if (!this.metrics.custom[name]) {
            this.metrics.custom[name] = [];
        }
        
        this.metrics.custom[name].push({
            timestamp: Date.now(),
            value,
            metadata
        });
        
        this.emit('customMetric', { name, value, metadata });
    }

    /**
     * Start timer for measuring execution time
     */
    startTimer(name) {
        const startTime = performance.now();
        
        return {
            name,
            startTime,
            end: () => {
                const endTime = performance.now();
                const duration = endTime - startTime;
                
                this.recordCustomMetric(`${name}_duration`, duration, {
                    startTime,
                    endTime
                });
                
                return duration;
            }
        };
    }

    /**
     * Measure function execution time
     */
    async measureFunction(name, fn) {
        const timer = this.startTimer(name);
        
        try {
            const result = await fn();
            timer.end();
            return { success: true, result, duration: timer.startTime };
        } catch (error) {
            timer.end();
            return { success: false, error, duration: timer.startTime };
        }
    }

    /**
     * Get performance summary
     */
    getSummary() {
        const summary = {
            duration: this.startTime ? Date.now() - this.startTime : 0,
            dataPoints: this.metrics.timestamps.length,
            memory: this.getMemorySummary(),
            cpu: this.getCPUSummary(),
            custom: {}
        };
        
        // Summarize custom metrics
        Object.keys(this.metrics.custom).forEach(name => {
            summary.custom[name] = this.getCustomMetricSummary(name);
        });
        
        return summary;
    }

    /**
     * Get memory usage summary
     */
    getMemorySummary() {
        if (this.metrics.memory.length === 0) {
            return null;
        }
        
        const rss = this.metrics.memory.map(m => m.rss);
        const heapUsed = this.metrics.memory.map(m => m.heapUsed);
        const heapTotal = this.metrics.memory.map(m => m.heapTotal);
        
        return {
            rss: {
                current: rss[rss.length - 1],
                peak: Math.max(...rss),
                average: rss.reduce((a, b) => a + b, 0) / rss.length,
                min: Math.min(...rss)
            },
            heapUsed: {
                current: heapUsed[heapUsed.length - 1],
                peak: Math.max(...heapUsed),
                average: heapUsed.reduce((a, b) => a + b, 0) / heapUsed.length,
                min: Math.min(...heapUsed)
            },
            heapTotal: {
                current: heapTotal[heapTotal.length - 1],
                peak: Math.max(...heapTotal),
                average: heapTotal.reduce((a, b) => a + b, 0) / heapTotal.length,
                min: Math.min(...heapTotal)
            }
        };
    }

    /**
     * Get CPU usage summary
     */
    getCPUSummary() {
        if (this.metrics.cpu.length === 0) {
            return null;
        }
        
        const usage = this.metrics.cpu.map(c => c.usage);
        
        return {
            usage: {
                current: usage[usage.length - 1],
                peak: Math.max(...usage),
                average: usage.reduce((a, b) => a + b, 0) / usage.length,
                min: Math.min(...usage)
            }
        };
    }

    /**
     * Get custom metric summary
     */
    getCustomMetricSummary(name) {
        const metrics = this.metrics.custom[name];
        if (!metrics || metrics.length === 0) {
            return null;
        }
        
        const values = metrics.map(m => m.value);
        const numbers = values.filter(v => typeof v === 'number');
        
        if (numbers.length === 0) {
            return {
                count: values.length,
                values: values
            };
        }
        
        return {
            count: values.length,
            current: numbers[numbers.length - 1],
            peak: Math.max(...numbers),
            average: numbers.reduce((a, b) => a + b, 0) / numbers.length,
            min: Math.min(...numbers),
            values: values
        };
    }

    /**
     * Export metrics to JSON file
     */
    async exportMetrics(filename = null) {
        if (!filename) {
            filename = `performance-metrics-${Date.now()}.json`;
        }
        
        const filePath = path.join(this.options.outputDir, filename);
        
        const exportData = {
            metadata: {
                startTime: this.startTime,
                endTime: Date.now(),
                duration: Date.now() - this.startTime,
                interval: this.options.interval,
                dataPoints: this.metrics.timestamps.length
            },
            metrics: this.metrics,
            summary: this.getSummary()
        };
        
        await fs.writeFile(filePath, JSON.stringify(exportData, null, 2));
        
        this.emit('exported', { filename, filePath });
        return filePath;
    }

    /**
     * Generate performance report
     */
    async generateReport() {
        const summary = this.getSummary();
        const reportData = {
            timestamp: new Date().toISOString(),
            summary,
            recommendations: this.generateRecommendations(summary)
        };
        
        const reportFileName = `performance-report-${Date.now()}.json`;
        const reportPath = path.join(this.options.outputDir, reportFileName);
        
        await fs.writeFile(reportPath, JSON.stringify(reportData, null, 2));
        
        // Generate text summary
        await this.generateTextReport(reportData);
        
        return reportPath;
    }

    /**
     * Generate performance recommendations
     */
    generateRecommendations(summary) {
        const recommendations = [];
        
        // Memory recommendations
        if (summary.memory) {
            const memoryUsage = summary.memory.heapUsed.current / summary.memory.heapTotal.current;
            if (memoryUsage > 0.8) {
                recommendations.push({
                    type: 'memory',
                    severity: 'high',
                    message: 'High memory usage detected (>80%). Consider optimizing memory usage or increasing available memory.',
                    value: `${(memoryUsage * 100).toFixed(1)}%`
                });
            } else if (memoryUsage > 0.6) {
                recommendations.push({
                    type: 'memory',
                    severity: 'medium',
                    message: 'Moderate memory usage detected (>60%). Monitor for memory leaks.',
                    value: `${(memoryUsage * 100).toFixed(1)}%`
                });
            }
        }
        
        // CPU recommendations
        if (summary.cpu) {
            if (summary.cpu.usage.average > 80) {
                recommendations.push({
                    type: 'cpu',
                    severity: 'high',
                    message: 'High CPU usage detected (>80%). Consider optimizing CPU-intensive operations.',
                    value: `${summary.cpu.usage.average.toFixed(1)}%`
                });
            } else if (summary.cpu.usage.average > 60) {
                recommendations.push({
                    type: 'cpu',
                    severity: 'medium',
                    message: 'Moderate CPU usage detected (>60%). Monitor for performance bottlenecks.',
                    value: `${summary.cpu.usage.average.toFixed(1)}%`
                });
            }
        }
        
        // Duration recommendations
        if (summary.duration > 300000) { // 5 minutes
            recommendations.push({
                type: 'duration',
                severity: 'medium',
                message: 'Long execution time detected (>5 minutes). Consider optimizing for faster execution.',
                value: `${(summary.duration / 1000).toFixed(1)}s`
            });
        }
        
        return recommendations;
    }

    /**
     * Generate text performance report
     */
    async generateTextReport(reportData) {
        const reportFileName = `performance-summary-${Date.now()}.txt`;
        const reportPath = path.join(this.options.outputDir, reportFileName);
        
        let report = `
═══════════════════════════════════════════════════════════
PERFORMANCE MONITORING REPORT
═══════════════════════════════════════════════════════════

Generated: ${reportData.timestamp}
Duration: ${(reportData.summary.duration / 1000).toFixed(2)}s
Data Points: ${reportData.summary.dataPoints}

`;
        
        if (reportData.summary.memory) {
            const mem = reportData.summary.memory;
            report += `
MEMORY USAGE
───────────────────────────────────────────────────────────────
RSS:
  Current: ${(mem.rss.current / 1024 / 1024).toFixed(2)} MB
  Peak: ${(mem.rss.peak / 1024 / 1024).toFixed(2)} MB
  Average: ${(mem.rss.average / 1024 / 1024).toFixed(2)} MB

Heap Used:
  Current: ${(mem.heapUsed.current / 1024 / 1024).toFixed(2)} MB
  Peak: ${(mem.heapUsed.peak / 1024 / 1024).toFixed(2)} MB
  Average: ${(mem.heapUsed.average / 1024 / 1024).toFixed(2)} MB

Heap Total:
  Current: ${(mem.heapTotal.current / 1024 / 1024).toFixed(2)} MB
  Peak: ${(mem.heapTotal.peak / 1024 / 1024).toFixed(2)} MB
  Average: ${(mem.heapTotal.average / 1024 / 1024).toFixed(2)} MB
`;
        }
        
        if (reportData.summary.cpu) {
            const cpu = reportData.summary.cpu;
            report += `
CPU USAGE
───────────────────────────────────────────────────────────────
  Current: ${cpu.usage.current.toFixed(1)}%
  Peak: ${cpu.usage.peak.toFixed(1)}%
  Average: ${cpu.usage.average.toFixed(1)}%
  Min: ${cpu.usage.min.toFixed(1)}%
`;
        }
        
        if (Object.keys(reportData.summary.custom).length > 0) {
            report += `
CUSTOM METRICS
───────────────────────────────────────────────────────────────
`;
            
            Object.keys(reportData.summary.custom).forEach(name => {
                const metric = reportData.summary.custom[name];
                report += `
${name}:
  Count: ${metric.count}
`;
                
                if (typeof metric.current === 'number') {
                    report += `  Current: ${metric.current}
  Peak: ${metric.peak}
  Average: ${metric.average.toFixed(2)}
  Min: ${metric.min}
`;
                }
            });
        }
        
        if (reportData.recommendations.length > 0) {
            report += `
RECOMMENDATIONS
───────────────────────────────────────────────────────────────
`;
            
            reportData.recommendations.forEach(rec => {
                const severity = rec.severity.toUpperCase();
                report += `
${severity}: ${rec.message}
Value: ${rec.value}
`;
            });
        }
        
        report += `
═══════════════════════════════════════════════════════════
`;
        
        await fs.writeFile(reportPath, report);
        return reportPath;
    }

    /**
     * Ensure output directory exists
     */
    async ensureOutputDirectory() {
        try {
            await fs.mkdir(this.options.outputDir, { recursive: true });
        } catch (error) {
            console.error('Failed to create output directory:', error);
        }
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        this.stop();
        
        // Export final metrics
        await this.exportMetrics();
        await this.generateReport();
        
        this.emit('cleaned');
    }
}

module.exports = PerformanceMonitor;