/**
 * Network Activity Analysis Utility
 * 
 * This module provides utilities for analyzing network activity captured
 * by mitmproxy, including traffic patterns, API detection, and performance analysis.
 */

const HarParser = require('./har-parser');
const CookieExtractor = require('./cookie-extractor');

class NetworkAnalyzer {
    constructor() {
        this.harParser = new HarParser();
        this.cookieExtractor = new CookieExtractor();
    }
    
    /**
     * Analyze network activity from HAR file
     * @param {string|Object} harInput - Path to HAR file or parsed HAR data
     * @returns {Promise<Object>} Comprehensive network analysis
     */
    async analyzeNetworkActivity(harInput) {
        const harData = typeof harInput === 'string' 
            ? await this.harParser.parseHarFile(harInput)
            : harInput;
        
        const analysis = {
            summary: await this.harParser.getHarStatistics(harData),
            domains: await this.analyzeDomains(harData),
            apiEndpoints: await this.harParser.extractApiEndpoints(harData),
            performance: await this.analyzePerformance(harData),
            security: await this.analyzeSecurity(harData),
            trafficPatterns: await this.analyzeTrafficPatterns(harData),
            contentTypes: await this.analyzeContentTypes(harData),
            errors: await this.analyzeErrors(harData)
        };
        
        return analysis;
    }
    
    /**
     * Analyze domains in network traffic
     * @param {Object} harData - Parsed HAR data
     * @returns {Promise<Object>} Domain analysis
     */
    async analyzeDomains(harData) {
        const domainStats = {};
        
        harData.log.entries.forEach(entry => {
            try {
                const url = new URL(entry.request.url);
                const domain = url.hostname;
                
                if (!domainStats[domain]) {
                    domainStats[domain] = {
                        requests: 0,
                        totalSize: 0,
                        totalTime: 0,
                        methods: new Set(),
                        statusCodes: {},
                        firstParty: false,
                        thirdParty: false,
                        subdomains: new Set()
                    };
                }
                
                const stats = domainStats[domain];
                stats.requests++;
                
                // Track methods
                stats.methods.add(entry.request.method);
                
                // Track status codes
                const status = entry.response.status;
                stats.statusCodes[status] = (stats.statusCodes[status] || 0) + 1;
                
                // Calculate size
                const requestSize = entry.request.bodySize || 0;
                const responseSize = entry.response.bodySize || 0;
                stats.totalSize += requestSize + responseSize;
                
                // Calculate time
                if (entry.time) {
                    stats.totalTime += entry.time;
                }
                
                // Track subdomains
                const parts = domain.split('.');
                if (parts.length > 2) {
                    stats.subdomains.add(parts[0]);
                }
                
            } catch (error) {
                // Skip invalid URLs
            }
        });
        
        // Convert Sets to arrays and calculate averages
        Object.keys(domainStats).forEach(domain => {
            const stats = domainStats[domain];
            stats.methods = Array.from(stats.methods);
            stats.subdomains = Array.from(stats.subdomains);
            stats.averageRequestTime = stats.requests > 0 ? stats.totalTime / stats.requests : 0;
            stats.averageRequestSize = stats.requests > 0 ? stats.totalSize / stats.requests : 0;
            
            // Determine if first-party or third-party (simplified heuristic)
            // This would need to be enhanced with actual first-party detection logic
            stats.firstParty = this.isLikelyFirstParty(domain);
            stats.thirdParty = !stats.firstParty;
        });
        
        return domainStats;
    }
    
    /**
     * Analyze performance metrics
     * @param {Object} harData - Parsed HAR data
     * @returns {Promise<Object>} Performance analysis
     */
    async analyzePerformance(harData) {
        const performance = {
            totalRequests: harData.log.entries.length,
            totalTime: 0,
            totalSize: 0,
            slowRequests: [],
            largeRequests: [],
            timingBreakdown: {
                dns: 0,
                connect: 0,
                ssl: 0,
                send: 0,
                wait: 0,
                receive: 0
            },
            bottlenecks: []
        };
        
        harData.log.entries.forEach(entry => {
            const totalTime = entry.time || 0;
            const requestSize = (entry.request.bodySize || 0) + (entry.response.bodySize || 0);
            
            performance.totalTime += totalTime;
            performance.totalSize += requestSize;
            
            // Track slow requests (> 2 seconds)
            if (totalTime > 2000) {
                performance.slowRequests.push({
                    url: entry.request.url,
                    time: totalTime,
                    method: entry.request.method,
                    status: entry.response.status
                });
            }
            
            // Track large requests (> 1MB)
            if (requestSize > 1024 * 1024) {
                performance.largeRequests.push({
                    url: entry.request.url,
                    size: requestSize,
                    method: entry.request.method,
                    status: entry.response.status
                });
            }
            
            // Analyze timing breakdown
            if (entry.timings) {
                Object.keys(entry.timings).forEach(phase => {
                    if (typeof entry.timings[phase] === 'number' && entry.timings[phase] > 0) {
                        performance.timingBreakdown[phase] += entry.timings[phase];
                    }
                });
            }
        });
        
        // Calculate averages
        performance.averageRequestTime = performance.totalRequests > 0 
            ? performance.totalTime / performance.totalRequests 
            : 0;
        performance.averageRequestSize = performance.totalRequests > 0 
            ? performance.totalSize / performance.totalRequests 
            : 0;
        
        // Identify bottlenecks
        if (performance.slowRequests.length > 0) {
            performance.bottlenecks.push({
                type: 'slow_requests',
                count: performance.slowRequests.length,
                description: `${performance.slowRequests.length} requests took longer than 2 seconds`
            });
        }
        
        if (performance.largeRequests.length > 0) {
            performance.bottlenecks.push({
                type: 'large_requests',
                count: performance.largeRequests.length,
                description: `${performance.largeRequests.length} requests were larger than 1MB`
            });
        }
        
        return performance;
    }
    
    /**
     * Analyze security aspects of network traffic
     * @param {Object} harData - Parsed HAR data
     * @returns {Promise<Object>} Security analysis
     */
    async analyzeSecurity(harData) {
        const security = {
            httpRequests: 0,
            httpsRequests: 0,
            mixedContent: [],
            insecureForms: [],
            cookiesAnalysis: null,
            headersAnalysis: {
                securityHeaders: {},
                missingSecurityHeaders: []
            }
        };
        
        // Analyze each entry
        harData.log.entries.forEach(entry => {
            try {
                const url = new URL(entry.request.url);
                const isHttps = url.protocol === 'https:';
                
                if (isHttps) {
                    security.httpsRequests++;
                } else {
                    security.httpRequests++;
                }
                
                // Check for mixed content (HTTP resources on HTTPS pages)
                // This would need context of the referring page, simplified here
                if (entry.request.method === 'GET' && !isHttps) {
                    security.mixedContent.push({
                        url: entry.request.url,
                        type: 'resource'
                    });
                }
                
                // Check for insecure forms
                if (entry.request.method === 'POST' && !isHttps) {
                    security.insecureForms.push({
                        url: entry.request.url,
                        method: 'POST',
                        insecure: true
                    });
                }
                
                // Analyze security headers
                this.analyzeSecurityHeaders(entry, security.headersAnalysis);
                
            } catch (error) {
                // Skip invalid URLs
            }
        });
        
        // Analyze cookies
        security.cookiesAnalysis = await this.cookieExtractor.analyzeCookieSecurity(harData);
        
        return security;
    }
    
    /**
     * Analyze security headers in request/response
     * @param {Object} entry - HAR entry
     * @param {Object} headersAnalysis - Headers analysis object
     */
    analyzeSecurityHeaders(entry, headersAnalysis) {
        const securityHeaders = [
            'strict-transport-security',
            'content-security-policy',
            'x-frame-options',
            'x-content-type-options',
            'x-xss-protection',
            'referrer-policy'
        ];
        
        entry.response.headers.forEach(header => {
            const headerName = header.name.toLowerCase();
            
            if (securityHeaders.includes(headerName)) {
                headersAnalysis.securityHeaders[headerName] = header.value;
            }
        });
        
        // Check for missing security headers
        securityHeaders.forEach(headerName => {
            const hasHeader = entry.response.headers.some(
                h => h.name.toLowerCase() === headerName
            );
            
            if (!hasHeader) {
                headersAnalysis.missingSecurityHeaders.push({
                    url: entry.request.url,
                    missingHeader: headerName
                });
            }
        });
    }
    
    /**
     * Analyze traffic patterns
     * @param {Object} harData - Parsed HAR data
     * @returns {Promise<Object>} Traffic patterns analysis
     */
    async analyzeTrafficPatterns(harData) {
        const patterns = {
            requestSequence: [],
            timeDistribution: {},
            methodDistribution: {},
            statusCodeDistribution: {},
            parallelism: {
                maxConcurrent: 0,
                averageConcurrent: 0
            },
            userAgents: new Set(),
            apiCallsVsContent: {
                apiCalls: 0,
                contentRequests: 0
            }
        };
        
        const timestamps = [];
        
        harData.log.entries.forEach((entry, index) => {
            const timestamp = new Date(entry.startedDateTime).getTime();
            timestamps.push(timestamp);
            
            // Track request sequence
            patterns.requestSequence.push({
                index,
                url: entry.request.url,
                method: entry.request.method,
                status: entry.response.status,
                timestamp: entry.startedDateTime
            });
            
            // Track time distribution (by hour)
            const hour = new Date(entry.startedDateTime).getHours();
            patterns.timeDistribution[hour] = (patterns.timeDistribution[hour] || 0) + 1;
            
            // Track method distribution
            const method = entry.request.method;
            patterns.methodDistribution[method] = (patterns.methodDistribution[method] || 0) + 1;
            
            // Track status code distribution
            const status = entry.response.status;
            patterns.statusCodeDistribution[status] = (patterns.statusCodeDistribution[status] || 0) + 1;
            
            // Track user agents
            const userAgentHeader = entry.request.headers.find(
                h => h.name.toLowerCase() === 'user-agent'
            );
            if (userAgentHeader) {
                patterns.userAgents.add(userAgentHeader.value);
            }
            
            // Classify as API call or content request
            const isApiCall = this.isApiCall(entry);
            if (isApiCall) {
                patterns.apiCallsVsContent.apiCalls++;
            } else {
                patterns.apiCallsVsContent.contentRequests++;
            }
        });
        
        // Convert Set to array
        patterns.userAgents = Array.from(patterns.userAgents);
        
        // Calculate parallelism (simplified)
        if (timestamps.length > 1) {
            timestamps.sort();
            const timeSpan = timestamps[timestamps.length - 1] - timestamps[0];
            patterns.parallelism.averageConcurrent = timeSpan > 0 
                ? (timestamps.length * 1000) / timeSpan 
                : 1;
            patterns.parallelism.maxConcurrent = Math.max(1, patterns.parallelism.averageConcurrent * 2);
        }
        
        return patterns;
    }
    
    /**
     * Analyze content types in network traffic
     * @param {Object} harData - Parsed HAR data
     * @returns {Promise<Object>} Content types analysis
     */
    async analyzeContentTypes(harData) {
        const contentTypes = {
            distribution: {},
            totalSizeByType: {},
            largeResponses: [],
            compressionAnalysis: {
                compressed: 0,
                uncompressed: 0,
                compressionRatio: 0
            }
        };
        
        harData.log.entries.forEach(entry => {
            const contentTypeHeader = entry.response.headers.find(
                h => h.name.toLowerCase() === 'content-type'
            );
            
            let contentType = 'unknown';
            if (contentTypeHeader) {
                contentType = contentTypeHeader.value.split(';')[0].toLowerCase();
            }
            
            // Track distribution
            contentTypes.distribution[contentType] = (contentTypes.distribution[contentType] || 0) + 1;
            
            // Track size by type
            const responseSize = entry.response.bodySize || 0;
            contentTypes.totalSizeByType[contentType] = (contentTypes.totalSizeByType[contentType] || 0) + responseSize;
            
            // Track large responses (> 500KB)
            if (responseSize > 500 * 1024) {
                contentTypes.largeResponses.push({
                    url: entry.request.url,
                    contentType,
                    size: responseSize
                });
            }
            
            // Analyze compression
            const contentEncodingHeader = entry.response.headers.find(
                h => h.name.toLowerCase() === 'content-encoding'
            );
            
            if (contentEncodingHeader && contentEncodingHeader.value.includes('gzip')) {
                contentTypes.compressionAnalysis.compressed++;
            } else {
                contentTypes.compressionAnalysis.uncompressed++;
            }
        });
        
        // Calculate compression ratio
        const total = contentTypes.compressionAnalysis.compressed + contentTypes.compressionAnalysis.uncompressed;
        if (total > 0) {
            contentTypes.compressionAnalysis.compressionRatio = 
                contentTypes.compressionAnalysis.compressed / total;
        }
        
        return contentTypes;
    }
    
    /**
     * Analyze errors in network traffic
     * @param {Object} harData - Parsed HAR data
     * @returns {Promise<Object>} Error analysis
     */
    async analyzeErrors(harData) {
        const errors = {
            clientErrors: [], // 4xx
            serverErrors: [], // 5xx
            networkErrors: [],
            timeouts: [],
            totalErrors: 0
        };
        
        harData.log.entries.forEach(entry => {
            const status = entry.response.status;
            
            if (status >= 400 && status < 500) {
                errors.clientErrors.push({
                    url: entry.request.url,
                    status,
                    statusText: entry.response.statusText,
                    method: entry.request.method
                });
            } else if (status >= 500) {
                errors.serverErrors.push({
                    url: entry.request.url,
                    status,
                    statusText: entry.response.statusText,
                    method: entry.request.method
                });
            }
            
            // Check for timeouts (requests that took > 30 seconds)
            if (entry.time && entry.time > 30000) {
                errors.timeouts.push({
                    url: entry.request.url,
                    time: entry.time,
                    method: entry.request.method
                });
            }
        });
        
        errors.totalErrors = errors.clientErrors.length + errors.serverErrors.length + errors.timeouts.length;
        
        return errors;
    }
    
    /**
     * Determine if a domain is likely first-party
     * @param {string} domain - Domain to check
     * @returns {boolean} True if likely first-party
     */
    isLikelyFirstParty(domain) {
        // This is a simplified heuristic - in practice, you'd want to compare
        // against the main page domain or use a more sophisticated algorithm
        const commonFirstPartyPatterns = [
            /www\./,
            /app\./,
            /api\./,
            /cdn\./,
            /static\./,
            /assets\./
        ];
        
        const commonThirdPartyPatterns = [
            /google-analytics\.com$/,
            /doubleclick\.net$/,
            /facebook\.net$/,
            /googletagmanager\.com$/,
            /googlesyndication\.com$/,
            /amazon-adsystem\.com$/,
            /adsystem\.google\.com$/
        ];
        
        // Check against third-party patterns first
        for (const pattern of commonThirdPartyPatterns) {
            if (pattern.test(domain)) {
                return false;
            }
        }
        
        // Check against first-party patterns
        for (const pattern of commonFirstPartyPatterns) {
            if (pattern.test(domain)) {
                return true;
            }
        }
        
        // Default to assuming first-party if no patterns match
        return true;
    }
    
    /**
     * Determine if a request is likely an API call
     * @param {Object} entry - HAR entry
     * @returns {boolean} True if likely API call
     */
    isApiCall(entry) {
        try {
            const url = new URL(entry.request.url);
            const pathname = url.pathname.toLowerCase();
            
            // Check URL patterns
            const apiPatterns = [
                /\/api\//,
                /\/v\d+\//,
                /\/graphql/,
                /\/rest\//,
                /\/service\//
            ];
            
            for (const pattern of apiPatterns) {
                if (pattern.test(pathname)) {
                    return true;
                }
            }
            
            // Check content type
            const contentTypeHeader = entry.response.headers.find(
                h => h.name.toLowerCase() === 'content-type'
            );
            
            if (contentTypeHeader) {
                const contentType = contentTypeHeader.value.toLowerCase();
                if (contentType.includes('application/json') || 
                    contentType.includes('application/xml')) {
                    return true;
                }
            }
            
            // Check method
            if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(entry.request.method)) {
                return true;
            }
            
        } catch (error) {
            // Invalid URL, assume not API call
        }
        
        return false;
    }
}

module.exports = NetworkAnalyzer;