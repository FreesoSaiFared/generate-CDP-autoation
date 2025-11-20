/**
 * Performance Metrics Collection Utility
 * 
 * This module provides utilities for collecting, analyzing, and reporting
 * performance metrics from mitmproxy recordings and HAR files.
 */

const fs = require('fs').promises;
const path = require('path');
const HarParser = require('./har-parser');

class PerformanceCollector {
    constructor() {
        this.harParser = new HarParser();
        this.metrics = {
            network: {},
            timing: {},
            resources: {},
            userExperience: {}
        };
    }
    
    /**
     * Collect performance metrics from HAR file
     * @param {string|Object} harInput - Path to HAR file or parsed HAR data
     * @returns {Promise<Object>} Comprehensive performance metrics
     */
    async collectMetrics(harInput) {
        const harData = typeof harInput === 'string' 
            ? await this.harParser.parseHarFile(harInput)
            : harInput;
        
        const metrics = {
            network: await this.collectNetworkMetrics(harData),
            timing: await this.collectTimingMetrics(harData),
            resources: await this.collectResourceMetrics(harData),
            userExperience: await this.collectUserExperienceMetrics(harData),
            summary: {}
        };
        
        // Generate summary
        metrics.summary = this.generateSummary(metrics);
        
        return metrics;
    }
    
    /**
     * Collect network-related performance metrics
     * @param {Object} harData - Parsed HAR data
     * @returns {Promise<Object>} Network metrics
     */
    async collectNetworkMetrics(harData) {
        const networkMetrics = {
            totalRequests: harData.log.entries.length,
            totalSize: 0,
            compressedSize: 0,
            uncompressedSize: 0,
            requestsByDomain: {},
            requestsByType: {},
            cacheHits: 0,
            cacheMisses: 0,
            compressionRatio: 0,
            protocolDistribution: {
                http1: 0,
                http2: 0,
                other: 0
            }
        };
        
        harData.log.entries.forEach(entry => {
            const requestSize = entry.request.bodySize || 0;
            const responseSize = entry.response.bodySize || 0;
            const totalRequestSize = requestSize + responseSize;
            
            networkMetrics.totalSize += totalRequestSize;
            
            // Track by domain
            try {
                const url = new URL(entry.request.url);
                const domain = url.hostname;
                
                if (!networkMetrics.requestsByDomain[domain]) {
                    networkMetrics.requestsByDomain[domain] = {
                        count: 0,
                        size: 0,
                        totalTime: 0
                    };
                }
                
                networkMetrics.requestsByDomain[domain].count++;
                networkMetrics.requestsByDomain[domain].size += totalRequestSize;
                networkMetrics.requestsByDomain[domain].totalTime += entry.time || 0;
                
            } catch (error) {
                // Skip invalid URLs
            }
            
            // Track by content type
            const contentTypeHeader = entry.response.headers.find(
                h => h.name.toLowerCase() === 'content-type'
            );
            
            let contentType = 'unknown';
            if (contentTypeHeader) {
                contentType = contentTypeHeader.value.split(';')[0].toLowerCase();
            }
            
            if (!networkMetrics.requestsByType[contentType]) {
                networkMetrics.requestsByType[contentType] = {
                    count: 0,
                    size: 0
                };
            }
            
            networkMetrics.requestsByType[contentType].count++;
            networkMetrics.requestsByType[contentType].size += totalRequestSize;
            
            // Analyze compression
            const contentEncodingHeader = entry.response.headers.find(
                h => h.name.toLowerCase() === 'content-encoding'
            );
            
            if (contentEncodingHeader && contentEncodingHeader.value.includes('gzip')) {
                networkMetrics.compressedSize += responseSize;
                
                // Estimate uncompressed size (simplified)
                const uncompressedSize = entry.response.content.size || responseSize;
                networkMetrics.uncompressedSize += uncompressedSize;
            } else {
                networkMetrics.uncompressedSize += responseSize;
                networkMetrics.compressedSize += responseSize;
            }
            
            // Analyze caching
            if (entry.cache) {
                if (entry.cache.beforeRequest && entry.cache.afterRequest) {
                    if (entry.cache.afterRequest.expires) {
                        networkMetrics.cacheHits++;
                    } else {
                        networkMetrics.cacheMisses++;
                    }
                } else {
                    networkMetrics.cacheMisses++;
                }
            }
            
            // Protocol distribution
            const httpVersion = entry.request.httpVersion;
            if (httpVersion.startsWith('HTTP/2')) {
                networkMetrics.protocolDistribution.http2++;
            } else if (httpVersion.startsWith('HTTP/1')) {
                networkMetrics.protocolDistribution.http1++;
            } else {
                networkMetrics.protocolDistribution.other++;
            }
        });
        
        // Calculate compression ratio
        if (networkMetrics.uncompressedSize > 0) {
            networkMetrics.compressionRatio = 
                (networkMetrics.uncompressedSize - networkMetrics.compressedSize) / 
                networkMetrics.uncompressedSize;
        }
        
        // Calculate averages
        Object.keys(networkMetrics.requestsByDomain).forEach(domain => {
            const domainMetrics = networkMetrics.requestsByDomain[domain];
            domainMetrics.averageTime = domainMetrics.count > 0 
                ? domainMetrics.totalTime / domainMetrics.count 
                : 0;
            domainMetrics.averageSize = domainMetrics.count > 0 
                ? domainMetrics.size / domainMetrics.count 
                : 0;
        });
        
        return networkMetrics;
    }
    
    /**
     * Collect timing-related performance metrics
     * @param {Object} harData - Parsed HAR data
     * @returns {Promise<Object>} Timing metrics
     */
    async collectTimingMetrics(harData) {
        const timingMetrics = {
            totalTime: 0,
            averageRequestTime: 0,
            slowestRequests: [],
            fastestRequests: [],
            timingBreakdown: {
                dns: { total: 0, average: 0, count: 0 },
                connect: { total: 0, average: 0, count: 0 },
                ssl: { total: 0, average: 0, count: 0 },
                send: { total: 0, average: 0, count: 0 },
                wait: { total: 0, average: 0, count: 0 },
                receive: { total: 0, average: 0, count: 0 }
            },
            timeDistribution: {
                under100ms: 0,
                under500ms: 0,
                under1s: 0,
                under5s: 0,
                over5s: 0
            }
        };
        
        const requestTimes = [];
        
        harData.log.entries.forEach(entry => {
            const requestTime = entry.time || 0;
            requestTimes.push({
                time: requestTime,
                url: entry.request.url,
                method: entry.request.method,
                status: entry.response.status
            });
            
            timingMetrics.totalTime += requestTime;
            
            // Time distribution
            if (requestTime < 100) {
                timingMetrics.timeDistribution.under100ms++;
            } else if (requestTime < 500) {
                timingMetrics.timeDistribution.under500ms++;
            } else if (requestTime < 1000) {
                timingMetrics.timeDistribution.under1s++;
            } else if (requestTime < 5000) {
                timingMetrics.timeDistribution.under5s++;
            } else {
                timingMetrics.timeDistribution.over5s++;
            }
            
            // Analyze timing breakdown
            if (entry.timings) {
                Object.keys(entry.timings).forEach(phase => {
                    const phaseTime = entry.timings[phase];
                    if (typeof phaseTime === 'number' && phaseTime >= 0) {
                        if (timingMetrics.timingBreakdown[phase]) {
                            timingMetrics.timingBreakdown[phase].total += phaseTime;
                            timingMetrics.timingBreakdown[phase].count++;
                        }
                    }
                });
            }
        });
        
        // Calculate averages
        timingMetrics.averageRequestTime = requestTimes.length > 0 
            ? timingMetrics.totalTime / requestTimes.length 
            : 0;
        
        Object.keys(timingMetrics.timingBreakdown).forEach(phase => {
            const phaseMetrics = timingMetrics.timingBreakdown[phase];
            if (phaseMetrics.count > 0) {
                phaseMetrics.average = phaseMetrics.total / phaseMetrics.count;
            }
        });
        
        // Find slowest and fastest requests
        requestTimes.sort((a, b) => b.time - a.time);
        timingMetrics.slowestRequests = requestTimes.slice(0, 10);
        timingMetrics.fastestRequests = requestTimes.slice(-10).reverse();
        
        return timingMetrics;
    }
    
    /**
     * Collect resource-related performance metrics
     * @param {Object} harData - Parsed HAR data
     * @returns {Promise<Object>} Resource metrics
     */
    async collectResourceMetrics(harData) {
        const resourceMetrics = {
            resourcesByType: {},
            totalResources: harData.log.entries.length,
            largeResources: [],
            resourcesWithoutCache: [],
            resourcesWithoutCompression: [],
            criticalResources: {
                css: [],
                js: [],
                images: []
            }
        };
        
        harData.log.entries.forEach(entry => {
            const responseSize = entry.response.bodySize || 0;
            const contentTypeHeader = entry.response.headers.find(
                h => h.name.toLowerCase() === 'content-type'
            );
            
            let resourceType = 'unknown';
            let subType = '';
            
            if (contentTypeHeader) {
                const contentType = contentTypeHeader.value.toLowerCase();
                const parts = contentType.split(';')[0].split('/');
                resourceType = parts[0] || 'unknown';
                subType = parts[1] || '';
            }
            
            // Track by type
            if (!resourceMetrics.resourcesByType[resourceType]) {
                resourceMetrics.resourcesByType[resourceType] = {
                    count: 0,
                    totalSize: 0,
                    averageSize: 0,
                    subTypes: {}
                };
            }
            
            resourceMetrics.resourcesByType[resourceType].count++;
            resourceMetrics.resourcesByType[resourceType].totalSize += responseSize;
            
            if (subType) {
                if (!resourceMetrics.resourcesByType[resourceType].subTypes[subType]) {
                    resourceMetrics.resourcesByType[resourceType].subTypes[subType] = {
                        count: 0,
                        totalSize: 0
                    };
                }
                
                resourceMetrics.resourcesByType[resourceType].subTypes[subType].count++;
                resourceMetrics.resourcesByType[resourceType].subTypes[subType].totalSize += responseSize;
            }
            
            // Track large resources (> 1MB)
            if (responseSize > 1024 * 1024) {
                resourceMetrics.largeResources.push({
                    url: entry.request.url,
                    type: resourceType,
                    size: responseSize,
                    time: entry.time || 0
                });
            }
            
            // Check for missing cache headers
            const cacheControlHeader = entry.response.headers.find(
                h => h.name.toLowerCase() === 'cache-control'
            );
            const expiresHeader = entry.response.headers.find(
                h => h.name.toLowerCase() === 'expires'
            );
            
            if (!cacheControlHeader && !expiresHeader) {
                resourceMetrics.resourcesWithoutCache.push({
                    url: entry.request.url,
                    type: resourceType
                });
            }
            
            // Check for missing compression
            const contentEncodingHeader = entry.response.headers.find(
                h => h.name.toLowerCase() === 'content-encoding'
            );
            
            const shouldCompress = [
                'text/',
                'application/json',
                'application/javascript',
                'application/xml'
            ].some(type => contentTypeHeader && contentTypeHeader.value.toLowerCase().includes(type));
            
            if (shouldCompress && !contentEncodingHeader && responseSize > 1024) {
                resourceMetrics.resourcesWithoutCompression.push({
                    url: entry.request.url,
                    type: resourceType,
                    size: responseSize
                });
            }
            
            // Track critical resources
            if (resourceType === 'text') {
                if (subType === 'css') {
                    resourceMetrics.criticalResources.css.push({
                        url: entry.request.url,
                        size: responseSize,
                        time: entry.time || 0
                    });
                } else if (subType === 'javascript' || subType === 'javascript') {
                    resourceMetrics.criticalResources.js.push({
                        url: entry.request.url,
                        size: responseSize,
                        time: entry.time || 0
                    });
                }
            } else if (resourceType === 'image') {
                resourceMetrics.criticalResources.images.push({
                    url: entry.request.url,
                    size: responseSize,
                    time: entry.time || 0
                });
            }
        });
        
        // Calculate averages
        Object.keys(resourceMetrics.resourcesByType).forEach(type => {
            const typeMetrics = resourceMetrics.resourcesByType[type];
            typeMetrics.averageSize = typeMetrics.count > 0 
                ? typeMetrics.totalSize / typeMetrics.count 
                : 0;
        });
        
        return resourceMetrics;
    }
    
    /**
     * Collect user experience metrics
     * @param {Object} harData - Parsed HAR data
     * @returns {Promise<Object>} User experience metrics
     */
    async collectUserExperienceMetrics(harData) {
        const uxMetrics = {
            pageLoadTime: 0,
            timeToFirstByte: 0,
            domContentLoaded: 0,
            loadComplete: 0,
            renderBlockingResources: 0,
            criticalRequestChaining: 0,
            userPerceivedPerformance: {
                score: 0,
                factors: []
            }
        };
        
        // Find main document request
        let mainDocument = null;
        let earliestStartTime = Infinity;
        
        harData.log.entries.forEach(entry => {
            const startTime = new Date(entry.startedDateTime).getTime();
            if (startTime < earliestStartTime) {
                earliestStartTime = startTime;
                mainDocument = entry;
            }
        });
        
        if (mainDocument) {
            // Calculate page load metrics
            const mainDocumentTime = mainDocument.time || 0;
            uxMetrics.pageLoadTime = mainDocumentTime;
            uxMetrics.timeToFirstByte = mainDocument.timings ? 
                (mainDocument.timings.receive || 0) : 0;
            
            // Find DOMContentLoaded and load events (simplified)
            // In a real implementation, you'd look for specific event markers
            const events = harData.log.entries.filter(entry => {
                const url = entry.request.url;
                return url.includes('domcontentloaded') || url.includes('load');
            });
            
            if (events.length > 0) {
                const domContentLoadedEvent = events.find(e => 
                    e.request.url.includes('domcontentloaded')
                );
                const loadEvent = events.find(e => 
                    e.request.url.includes('load')
                );
                
                if (domContentLoadedEvent) {
                    uxMetrics.domContentLoaded = 
                        new Date(domContentLoadedEvent.startedDateTime).getTime() - earliestStartTime;
                }
                
                if (loadEvent) {
                    uxMetrics.loadComplete = 
                        new Date(loadEvent.startedDateTime).getTime() - earliestStartTime;
                }
            }
        }
        
        // Count render-blocking resources
        harData.log.entries.forEach(entry => {
            const contentTypeHeader = entry.response.headers.find(
                h => h.name.toLowerCase() === 'content-type'
            );
            
            if (contentTypeHeader) {
                const contentType = contentTypeHeader.value.toLowerCase();
                if (contentType.includes('text/css') || 
                    contentType.includes('javascript')) {
                    uxMetrics.renderBlockingResources++;
                }
            }
        });
        
        // Calculate user perceived performance score
        uxMetrics.userPerceivedPerformance = this.calculatePerformanceScore(uxMetrics);
        
        return uxMetrics;
    }
    
    /**
     * Calculate performance score
     * @param {Object} uxMetrics - User experience metrics
     * @returns {Object} Performance score with factors
     */
    calculatePerformanceScore(uxMetrics) {
        const score = {
            score: 100,
            factors: []
        };
        
        // Page load time factor
        if (uxMetrics.pageLoadTime > 3000) {
            score.score -= 20;
            score.factors.push({
                type: 'page_load_time',
                impact: 'negative',
                value: uxMetrics.pageLoadTime,
                description: 'Page load time exceeds 3 seconds'
            });
        } else if (uxMetrics.pageLoadTime > 1000) {
            score.score -= 10;
            score.factors.push({
                type: 'page_load_time',
                impact: 'moderate',
                value: uxMetrics.pageLoadTime,
                description: 'Page load time exceeds 1 second'
            });
        }
        
        // Render-blocking resources factor
        if (uxMetrics.renderBlockingResources > 20) {
            score.score -= 15;
            score.factors.push({
                type: 'render_blocking',
                impact: 'negative',
                value: uxMetrics.renderBlockingResources,
                description: 'Too many render-blocking resources'
            });
        } else if (uxMetrics.renderBlockingResources > 10) {
            score.score -= 5;
            score.factors.push({
                type: 'render_blocking',
                impact: 'moderate',
                value: uxMetrics.renderBlockingResources,
                description: 'Moderate number of render-blocking resources'
            });
        }
        
        // Ensure score doesn't go below 0
        score.score = Math.max(0, score.score);
        
        return score;
    }
    
    /**
     * Generate performance summary
     * @param {Object} metrics - Collected metrics
     * @returns {Object} Performance summary
     */
    generateSummary(metrics) {
        return {
            overallScore: metrics.userExperience.userPerceivedPerformance.score,
            totalRequests: metrics.network.totalRequests,
            totalSize: this.formatBytes(metrics.network.totalSize),
            averageRequestTime: `${metrics.timing.averageRequestTime.toFixed(2)}ms`,
            compressionSavings: metrics.network.compressionRatio > 0 
                ? `${(metrics.network.compressionRatio * 100).toFixed(1)}%`
                : 'None',
            cacheHitRate: (metrics.network.cacheHits + metrics.network.cacheMisses) > 0
                ? `${((metrics.network.cacheHits / (metrics.network.cacheHits + metrics.network.cacheMisses)) * 100).toFixed(1)}%`
                : '0%',
            recommendations: this.generateRecommendations(metrics)
        };
    }
    
    /**
     * Generate performance recommendations
     * @param {Object} metrics - Collected metrics
     * @returns {Array} Performance recommendations
     */
    generateRecommendations(metrics) {
        const recommendations = [];
        
        // Compression recommendations
        if (metrics.network.compressionRatio < 0.3) {
            recommendations.push({
                category: 'compression',
                priority: 'high',
                description: 'Enable compression for text-based resources',
                impact: 'Reduce bandwidth usage by 60-80%'
            });
        }
        
        // Caching recommendations
        const cacheHitRate = (metrics.network.cacheHits + metrics.network.cacheMisses) > 0
            ? metrics.network.cacheHits / (metrics.network.cacheHits + metrics.network.cacheMisses)
            : 0;
        
        if (cacheHitRate < 0.5) {
            recommendations.push({
                category: 'caching',
                priority: 'high',
                description: 'Implement proper caching headers',
                impact: 'Improve repeat visit performance'
            });
        }
        
        // Large resources recommendations
        if (metrics.resources.largeResources.length > 0) {
            recommendations.push({
                category: 'optimization',
                priority: 'medium',
                description: `Optimize ${metrics.resources.largeResources.length} large resources`,
                impact: 'Reduce page load time'
            });
        }
        
        // Render-blocking resources recommendations
        if (metrics.userExperience.renderBlockingResources > 15) {
            recommendations.push({
                category: 'rendering',
                priority: 'medium',
                description: 'Reduce render-blocking resources',
                impact: 'Improve time to first paint'
            });
        }
        
        return recommendations;
    }
    
    /**
     * Format bytes to human readable format
     * @param {number} bytes - Bytes to format
     * @returns {string} Formatted string
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    /**
     * Export metrics to JSON file
     * @param {Object} metrics - Performance metrics
     * @param {string} outputPath - Path to save metrics
     * @returns {Promise<string>} Path to saved file
     */
    async exportMetrics(metrics, outputPath) {
        await fs.writeFile(outputPath, JSON.stringify(metrics, null, 2));
        return outputPath;
    }
    
    /**
     * Generate performance report
     * @param {Object} metrics - Performance metrics
     * @returns {string} HTML report
     */
    generateReport(metrics) {
        const summary = metrics.summary;
        
        return `
<!DOCTYPE html>
<html>
<head>
    <title>Performance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .score { font-size: 48px; font-weight: bold; color: ${summary.overallScore > 80 ? 'green' : summary.overallScore > 50 ? 'orange' : 'red'}; }
        .metric { margin: 10px 0; padding: 10px; border: 1px solid #ddd; }
        .recommendation { margin: 10px 0; padding: 10px; background: #f5f5f5; }
        .high { border-left: 5px solid #d32f2f; }
        .medium { border-left: 5px solid #f57c00; }
        .low { border-left: 5px solid #388e3c; }
    </style>
</head>
<body>
    <h1>Performance Report</h1>
    
    <div class="metric">
        <h2>Overall Score</h2>
        <div class="score">${summary.overallScore}/100</div>
    </div>
    
    <div class="metric">
        <h2>Summary</h2>
        <p>Total Requests: ${summary.totalRequests}</p>
        <p>Total Size: ${summary.totalSize}</p>
        <p>Average Request Time: ${summary.averageRequestTime}</p>
        <p>Compression Savings: ${summary.compressionSavings}</p>
        <p>Cache Hit Rate: ${summary.cacheHitRate}</p>
    </div>
    
    <div class="metric">
        <h2>Recommendations</h2>
        ${summary.recommendations.map(rec => `
            <div class="recommendation ${rec.priority}">
                <h3>${rec.category} (${rec.priority})</h3>
                <p>${rec.description}</p>
                <p><strong>Impact:</strong> ${rec.impact}</p>
            </div>
        `).join('')}
    </div>
</body>
</html>`;
    }
}

module.exports = PerformanceCollector;