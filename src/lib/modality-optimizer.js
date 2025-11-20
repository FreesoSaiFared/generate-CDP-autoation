/**
 * Modality Optimizer - Intelligent Automation Modality Selection
 * 
 * This module implements the core decision logic for choosing the optimal
 * automation modality (Integuru, Headless CDP, or Visible Browser) based on:
 * - HAR file analysis for API patterns
 * - Task complexity assessment
 * - Historical performance data
 * - Risk assessment for automation failure
 * - Performance estimation models
 * 
 * Based on specifications from automation_architecture.md and implementation_guide.md
 */

const fs = require('fs').promises;
const path = require('path');
const HarParser = require('./har-parser');
const InteguruWrapper = require('./integuru-wrapper');
const PerformanceTracker = require('./performance-tracker');
const DecisionLogger = require('./decision-logger');
const OptimizationEngine = require('./optimization-engine');

class ModalityOptimizer {
    constructor(options = {}) {
        this.harParser = new HarParser();
        this.integuruWrapper = new InteguruWrapper(options.integuru || {});
        this.performanceTracker = new PerformanceTracker(options.performance || {});
        this.decisionLogger = new DecisionLogger(options.logging || {});
        this.optimizationEngine = new OptimizationEngine(options.optimization || {});
        
        // Configuration thresholds
        this.thresholds = {
            integuruConfidence: options.integuruConfidence || 0.85,
            headlessConfidence: options.headlessConfidence || 0.70,
            maxApiComplexity: options.maxApiComplexity || 10,
            maxDependencyDepth: options.maxDependencyDepth || 5,
            minSuccessRate: options.minSuccessRate || 0.80
        };
        
        // Performance targets (in seconds)
        this.performanceTargets = {
            integuru: { min: 2, max: 5 },
            headless_cdp: { min: 15, max: 30 },
            visible_browser: { min: 300, max: 600 } // 5-10 minutes
        };
        
        // Initialize historical data
        this.historicalData = {};
        this.loadHistoricalData();
    }

    /**
     * Choose the optimal automation modality for a given task
     * 
     * @param {Object} params - Analysis parameters
     * @param {string} params.harFile - Path to HAR file
     * @param {string} params.taskDescription - Description of the task to automate
     * @param {Object} params.context - Additional context (domain, user preferences, etc.)
     * @returns {Promise<Object>} Modality choice with reasoning and confidence
     */
    async chooseModality(params) {
        const { harFile, taskDescription, context = {} } = params;
        
        try {
            // Step 1: Analyze HAR file for API patterns and complexity
            const harAnalysis = await this.analyzeHarFile(harFile);
            
            // Step 2: Score API reversibility and complexity
            const reversibilityScore = await this.scoreApiReversibility(harAnalysis);
            const complexityScore = await this.analyzeComplexity(harAnalysis, taskDescription);
            
            // Step 3: Assess Integuru feasibility
            const integuruAssessment = await this.assessInteguruFeasibility({
                harAnalysis,
                reversibilityScore,
                complexityScore,
                taskDescription
            });
            
            // Step 4: Assess Headless CDP feasibility
            const headlessAssessment = await this.assessHeadlessFeasibility({
                harAnalysis,
                complexityScore,
                taskDescription
            });
            
            // Step 5: Apply historical learning and optimization
            const optimizedScores = await this.applyHistoricalLearning({
                domain: context.domain,
                integuruAssessment,
                headlessAssessment,
                taskType: this.classifyTaskType(taskDescription)
            });
            
            // Step 6: Make final decision with fallback logic
            const decision = await this.makeDecision({
                integuruAssessment: optimizedScores.integuru,
                headlessAssessment: optimizedScores.headless,
                context,
                harAnalysis
            });
            
            // Step 7: Log decision for continuous improvement
            await this.decisionLogger.logDecision({
                taskDescription,
                harFile,
                decision,
                analysis: {
                    harAnalysis,
                    reversibilityScore,
                    complexityScore,
                    integuruAssessment,
                    headlessAssessment
                },
                timestamp: new Date().toISOString()
            });
            
            return decision;
            
        } catch (error) {
            throw new Error(`Modality optimization failed: ${error.message}`);
        }
    }

    /**
     * Analyze HAR file for patterns and metrics
     * 
     * @param {string} harFile - Path to HAR file
     * @returns {Promise<Object>} HAR analysis results
     */
    async analyzeHarFile(harFile) {
        const harData = await this.harParser.parseHarFile(harFile);
        const statistics = await this.harParser.getHarStatistics(harData);
        const apiEndpoints = await this.harParser.extractApiEndpoints(harData);
        
        // Analyze request patterns
        const requestPatterns = this.analyzeRequestPatterns(harData.log.entries);
        
        // Extract authentication patterns
        const authPatterns = this.extractAuthPatterns(harData.log.entries);
        
        // Identify dynamic parameters
        const dynamicParams = this.identifyDynamicParameters(harData.log.entries);
        
        return {
            statistics,
            apiEndpoints,
            requestPatterns,
            authPatterns,
            dynamicParams,
            totalEntries: harData.log.entries.length,
            hasApiEndpoints: Object.keys(apiEndpoints).length > 0,
            complexity: this.calculateHarComplexity(harData)
        };
    }

    /**
     * Score API reversibility - how easily the traffic can be reverse-engineered
     * 
     * @param {Object} harAnalysis - HAR analysis results
     * @returns {Promise<Object>} Reversibility score with factors
     */
    async scoreApiReversibility(harAnalysis) {
        let score = 0.5; // Base score
        const factors = {};
        
        // Factor 1: API endpoint consistency (30% weight)
        if (harAnalysis.hasApiEndpoints) {
            const apiConsistency = this.calculateApiConsistency(harAnalysis.apiEndpoints);
            factors.apiConsistency = apiConsistency;
            score += (apiConsistency - 0.5) * 0.3;
        } else {
            factors.apiConsistency = 0;
            score -= 0.3;
        }
        
        // Factor 2: Authentication clarity (25% weight)
        const authClarity = this.scoreAuthClarity(harAnalysis.authPatterns);
        factors.authClarity = authClarity;
        score += (authClarity - 0.5) * 0.25;
        
        // Factor 3: Parameter predictability (20% weight)
        const paramPredictability = this.scoreParameterPredictability(harAnalysis.dynamicParams);
        factors.paramPredictability = paramPredictability;
        score += (paramPredictability - 0.5) * 0.2;
        
        // Factor 4: Request/response simplicity (15% weight)
        const simplicity = this.scoreRequestSimplicity(harAnalysis.requestPatterns);
        factors.simplicity = simplicity;
        score += (simplicity - 0.5) * 0.15;
        
        // Factor 5: Dependency graph clarity (10% weight)
        const dependencyClarity = this.scoreDependencyClarity(harAnalysis);
        factors.dependencyClarity = dependencyClarity;
        score += (dependencyClarity - 0.5) * 0.1;
        
        // Normalize score to 0-1 range
        score = Math.max(0, Math.min(1, score));
        
        return {
            score: Math.round(score * 100) / 100,
            factors,
            recommendation: score > 0.8 ? 'high' : score > 0.6 ? 'medium' : 'low'
        };
    }

    /**
     * Analyze task complexity
     * 
     * @param {Object} harAnalysis - HAR analysis results
     * @param {string} taskDescription - Task description
     * @returns {Promise<Object>} Complexity analysis
     */
    async analyzeComplexity(harAnalysis, taskDescription) {
        const factors = {};
        
        // Network complexity
        factors.networkComplexity = this.calculateNetworkComplexity(harAnalysis);
        
        // API complexity
        factors.apiComplexity = this.calculateApiComplexity(harAnalysis);
        
        // Task complexity from description
        factors.taskComplexity = this.analyzeTaskDescription(taskDescription);
        
        // UI interaction complexity
        factors.uiComplexity = this.estimateUiComplexity(harAnalysis);
        
        // State management complexity
        factors.stateComplexity = this.assessStateComplexity(harAnalysis);
        
        // Calculate overall complexity score (0-1, higher is more complex)
        const weights = {
            networkComplexity: 0.2,
            apiComplexity: 0.3,
            taskComplexity: 0.25,
            uiComplexity: 0.15,
            stateComplexity: 0.1
        };
        
        let overallScore = 0;
        Object.keys(weights).forEach(factor => {
            overallScore += factors[factor] * weights[factor];
        });
        
        return {
            score: Math.round(overallScore * 100) / 100,
            factors,
            level: overallScore > 0.7 ? 'high' : overallScore > 0.4 ? 'medium' : 'low'
        };
    }

    /**
     * Assess Integuru feasibility
     * 
     * @param {Object} params - Assessment parameters
     * @returns {Promise<Object>} Integuru feasibility assessment
     */
    async assessInteguruFeasibility(params) {
        const { harAnalysis, reversibilityScore, complexityScore, taskDescription } = params;
        
        let feasibility = 0.5;
        const reasons = [];
        
        // Primary factor: API reversibility
        feasibility = reversibilityScore.score;
        if (reversibilityScore.score > 0.8) {
            reasons.push('High API reversibility score');
        } else if (reversibilityScore.score < 0.6) {
            reasons.push('Low API reversibility score');
        }
        
        // Adjust based on complexity
        if (complexityScore.level === 'low') {
            feasibility = Math.min(1.0, feasibility + 0.1);
            reasons.push('Low task complexity');
        } else if (complexityScore.level === 'high') {
            feasibility = Math.max(0.3, feasibility - 0.2);
            reasons.push('High task complexity');
        }
        
        // Check for API endpoints
        if (!harAnalysis.hasApiEndpoints) {
            feasibility = Math.max(0.2, feasibility - 0.3);
            reasons.push('No API endpoints detected');
        }
        
        // Check authentication patterns
        if (harAnalysis.authPatterns.length > 0) {
            feasibility = Math.min(1.0, feasibility + 0.05);
            reasons.push('Clear authentication patterns');
        }
        
        // Estimate execution time
        const estimatedTime = this.estimateInteguruTime(harAnalysis, complexityScore);
        
        // Calculate confidence
        const confidence = this.calculateConfidence(feasibility, {
            reversibility: reversibilityScore.score,
            complexity: 1 - complexityScore.score,
            hasApi: harAnalysis.hasApiEndpoints ? 1 : 0
        });
        
        return {
            feasible: feasibility > this.thresholds.integuruConfidence,
            feasibility: Math.round(feasibility * 100) / 100,
            confidence: Math.round(confidence * 100) / 100,
            estimatedTime,
            reasons,
            risks: this.assessInteguruRisks(harAnalysis, complexityScore)
        };
    }

    /**
     * Assess Headless CDP feasibility
     * 
     * @param {Object} params - Assessment parameters
     * @returns {Promise<Object>} Headless CDP feasibility assessment
     */
    async assessHeadlessFeasibility(params) {
        const { harAnalysis, complexityScore, taskDescription } = params;
        
        let feasibility = 0.7; // Headless is generally more feasible than Integuru
        const reasons = [];
        
        // Headless can handle most web interactions
        if (harAnalysis.totalEntries > 0) {
            feasibility = Math.min(1.0, feasibility + 0.1);
            reasons.push('Network activity detected for replication');
        }
        
        // Adjust based on complexity
        if (complexityScore.level === 'medium') {
            feasibility = Math.min(1.0, feasibility + 0.1);
            reasons.push('Suitable complexity level for headless automation');
        } else if (complexityScore.level === 'high') {
            feasibility = Math.max(0.4, feasibility - 0.15);
            reasons.push('High complexity may reduce reliability');
        }
        
        // Check for modern web features that might be challenging
        const modernFeatures = this.detectModernWebFeatures(harAnalysis);
        if (modernFeatures.length > 0) {
            feasibility = Math.max(0.5, feasibility - 0.1);
            reasons.push(`Modern features detected: ${modernFeatures.join(', ')}`);
        }
        
        // Estimate execution time
        const estimatedTime = this.estimateHeadlessTime(harAnalysis, complexityScore);
        
        // Calculate confidence
        const confidence = this.calculateConfidence(feasibility, {
            complexity: 1 - complexityScore.score * 0.5,
            hasNetwork: harAnalysis.totalEntries > 0 ? 1 : 0,
            modernFeatures: modernFeatures.length === 0 ? 1 : 0.7
        });
        
        return {
            feasible: feasibility > this.thresholds.headlessConfidence,
            feasibility: Math.round(feasibility * 100) / 100,
            confidence: Math.round(confidence * 100) / 100,
            estimatedTime,
            reasons,
            risks: this.assessHeadlessRisks(harAnalysis, complexityScore),
            modernFeatures
        };
    }

    /**
     * Apply historical learning to optimize scores
     * 
     * @param {Object} params - Learning parameters
     * @returns {Promise<Object>} Optimized assessments
     */
    async applyHistoricalLearning(params) {
        const { domain, integuruAssessment, headlessAssessment, taskType } = params;
        
        // Get historical performance for this domain/task type
        const historical = await this.optimizationEngine.getHistoricalPerformance({
            domain,
            taskType
        });
        
        // Adjust Integuru assessment based on history
        let adjustedInteguru = { ...integuruAssessment };
        if (historical.integuru) {
            const successFactor = historical.integuru.successRate || 0.8;
            const timeFactor = this.calculateTimeFactor(
                historical.integuru.avgTime,
                this.performanceTargets.integuru
            );
            
            adjustedInteguru.confidence = Math.min(1.0, 
                integuruAssessment.confidence * successFactor * timeFactor);
            
            if (successFactor < 0.7) {
                adjustedInteguru.reasons.push('Low historical success rate for this domain');
            }
        }
        
        // Adjust Headless assessment based on history
        let adjustedHeadless = { ...headlessAssessment };
        if (historical.headless) {
            const successFactor = historical.headless.successRate || 0.8;
            const timeFactor = this.calculateTimeFactor(
                historical.headless.avgTime,
                this.performanceTargets.headless_cdp
            );
            
            adjustedHeadless.confidence = Math.min(1.0, 
                headlessAssessment.confidence * successFactor * timeFactor);
            
            if (successFactor < 0.7) {
                adjustedHeadless.reasons.push('Low historical success rate for this domain');
            }
        }
        
        return {
            integuru: adjustedInteguru,
            headless: adjustedHeadless,
            historicalData: historical
        };
    }

    /**
     * Make final modality decision
     * 
     * @param {Object} params - Decision parameters
     * @returns {Promise<Object>} Final decision with reasoning
     */
    async makeDecision(params) {
        const { integuruAssessment, headlessAssessment, context, harAnalysis } = params;
        
        // Primary decision logic
        if (integuruAssessment.feasible && 
            integuruAssessment.confidence > this.thresholds.integuruConfidence) {
            
            return {
                modality: 'integuru',
                confidence: integuruAssessment.confidence,
                estimatedTime: integuruAssessment.estimatedTime,
                reasoning: {
                    primary: 'API reverse-engineering is optimal',
                    factors: integuruAssessment.reasons,
                    risks: integuruAssessment.risks,
                    alternatives: ['headless_cdp', 'visible_browser']
                },
                metadata: {
                    harComplexity: harAnalysis.complexity,
                    hasApiEndpoints: harAnalysis.hasApiEndpoints,
                    reversibilityScore: integuruAssessment.feasibility
                }
            };
        }
        
        // Fallback to Headless CDP
        if (headlessAssessment.feasible && 
            headlessAssessment.confidence > this.thresholds.headlessConfidence) {
            
            return {
                modality: 'headless_cdp',
                confidence: headlessAssessment.confidence,
                estimatedTime: headlessAssessment.estimatedTime,
                reasoning: {
                    primary: 'Headless browser automation is optimal',
                    factors: headlessAssessment.reasons,
                    risks: headlessAssessment.risks,
                    alternatives: ['visible_browser']
                },
                metadata: {
                    harComplexity: harAnalysis.complexity,
                    modernFeatures: headlessAssessment.modernFeatures,
                    uiComplexity: harAnalysis.statistics.totalRequests
                }
            };
        }
        
        // Final fallback to visible browser
        return {
            modality: 'visible_browser',
            confidence: 1.0, // Always possible with human intervention
            estimatedTime: this.performanceTargets.visible_browser.min,
            reasoning: {
                primary: 'Task requires human intervention',
                factors: ['Too complex for automation', 'Low confidence in automated approaches'],
                risks: ['Time intensive', 'Requires user availability'],
                alternatives: []
            },
            metadata: {
                requiresHuman: true,
                fallbackReason: 'Automated approaches not feasible'
            }
        };
    }

    /**
     * Record execution results for learning
     * 
     * @param {Object} params - Execution results
     * @returns {Promise<Object>} Learning outcome
     */
    async recordExecution(params) {
        const { 
            decision, 
            executionTime, 
            success, 
            error, 
            metrics,
            sessionId 
        } = params;
        
        // Record performance
        await this.performanceTracker.recordExecution({
            modality: decision.modality,
            estimatedTime: decision.estimatedTime,
            actualTime: executionTime,
            success,
            error,
            sessionId,
            metadata: decision.metadata
        });
        
        // Update optimization engine
        const learningResult = await this.optimizationEngine.updateModel({
            modality: decision.modality,
            success,
            timeAccuracy: this.calculateTimeAccuracy(decision.estimatedTime, executionTime),
            confidenceAccuracy: decision.confidence,
            features: decision.metadata
        });
        
        // Update historical data
        await this.updateHistoricalData(decision, executionTime, success);
        
        return learningResult;
    }

    // Helper methods for analysis calculations
    
    analyzeRequestPatterns(entries) {
        const patterns = {
            methods: {},
            statusCodes: {},
            contentTypes: {},
            timing: {
                average: 0,
                min: Infinity,
                max: 0
            }
        };
        
        let totalTime = 0;
        
        entries.forEach(entry => {
            // Method patterns
            const method = entry.request.method;
            patterns.methods[method] = (patterns.methods[method] || 0) + 1;
            
            // Status code patterns
            const status = entry.response.status;
            patterns.statusCodes[status] = (patterns.statusCodes[status] || 0) + 1;
            
            // Content type patterns
            const contentType = entry.response.headers.find(
                h => h.name.toLowerCase() === 'content-type'
            );
            if (contentType) {
                const type = contentType.value.split(';')[0];
                patterns.contentTypes[type] = (patterns.contentTypes[type] || 0) + 1;
            }
            
            // Timing patterns
            const time = entry.time || 0;
            totalTime += time;
            patterns.timing.min = Math.min(patterns.timing.min, time);
            patterns.timing.max = Math.max(patterns.timing.max, time);
        });
        
        patterns.timing.average = entries.length > 0 ? totalTime / entries.length : 0;
        patterns.timing.min = patterns.timing.min === Infinity ? 0 : patterns.timing.min;
        
        return patterns;
    }

    extractAuthPatterns(entries) {
        const patterns = [];
        
        entries.forEach(entry => {
            // Check for authorization headers
            const authHeader = entry.request.headers.find(
                h => h.name.toLowerCase() === 'authorization'
            );
            if (authHeader) {
                patterns.push({
                    type: 'authorization',
                    location: 'request_header',
                    pattern: authHeader.value.substring(0, 20) + '...'
                });
            }
            
            // Check for cookie-based auth
            const cookies = entry.request.cookies;
            if (cookies && cookies.length > 0) {
                const authCookies = cookies.filter(cookie => 
                    cookie.name.toLowerCase().includes('token') ||
                    cookie.name.toLowerCase().includes('session') ||
                    cookie.name.toLowerCase().includes('auth')
                );
                
                if (authCookies.length > 0) {
                    patterns.push({
                        type: 'cookie',
                        location: 'request_cookies',
                        count: authCookies.length
                    });
                }
            }
            
            // Check for API key in query params
            const url = new URL(entry.request.url);
            const apiKeyParams = ['api_key', 'apikey', 'token', 'access_token'];
            const hasApiKey = apiKeyParams.some(param => url.searchParams.has(param));
            
            if (hasApiKey) {
                patterns.push({
                    type: 'query_param',
                    location: 'url_query'
                });
            }
        });
        
        return patterns;
    }

    identifyDynamicParameters(entries) {
        const dynamicParams = [];
        
        // Look for patterns that suggest dynamic parameters
        entries.forEach(entry => {
            const url = new URL(entry.request.url);
            const pathSegments = url.pathname.split('/').filter(segment => segment);
            
            pathSegments.forEach((segment, index) => {
                // Check if segment looks like an ID (numeric or UUID)
                if (/^\d+$/.test(segment) || 
                    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) {
                    
                    dynamicParams.push({
                        type: 'path_id',
                        position: index,
                        example: segment,
                        url: entry.request.url
                    });
                }
            });
            
            // Check for dynamic query parameters
            url.searchParams.forEach((value, key) => {
                if (key.includes('id') || key.includes('token') || key.includes('uuid')) {
                    dynamicParams.push({
                        type: 'query_param',
                        name: key,
                        example: value.substring(0, 10) + '...',
                        url: entry.request.url
                    });
                }
            });
        });
        
        return dynamicParams;
    }

    calculateHarComplexity(harData) {
        const entries = harData.log.entries;
        let complexity = 0;
        
        // Base complexity from number of requests
        complexity += Math.min(entries.length / 20, 1) * 0.3;
        
        // API endpoint diversity
        const uniqueEndpoints = new Set();
        entries.forEach(entry => {
            if (entry.request.url.includes('/api/')) {
                const url = new URL(entry.request.url);
                uniqueEndpoints.add(url.pathname);
            }
        });
        complexity += Math.min(uniqueEndpoints.size / 10, 1) * 0.2;
        
        // Method diversity
        const methods = new Set();
        entries.forEach(entry => methods.add(entry.request.method));
        complexity += Math.min(methods.size / 5, 1) * 0.1;
        
        // Response time variability
        const times = entries.map(e => e.time || 0);
        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        const variance = times.reduce((sum, time) => sum + Math.pow(time - avgTime, 2), 0) / times.length;
        complexity += Math.min(Math.sqrt(variance) / 1000, 1) * 0.2;
        
        // Content type diversity
        const contentTypes = new Set();
        entries.forEach(entry => {
            const contentType = entry.response.headers.find(
                h => h.name.toLowerCase() === 'content-type'
            );
            if (contentType) {
                contentTypes.add(contentType.value.split(';')[0]);
            }
        });
        complexity += Math.min(contentTypes.size / 10, 1) * 0.2;
        
        return Math.round(complexity * 100) / 100;
    }
    calculateApiConsistency(apiEndpoints) {
        if (!apiEndpoints || Object.keys(apiEndpoints).length === 0) {
            return 0;
        }
        
        let totalEndpoints = 0;
        let consistentEndpoints = 0;
        
        Object.values(apiEndpoints).forEach(endpoints => {
            totalEndpoints += endpoints.length;
            
            // Check if endpoints follow consistent patterns
            const patterns = new Set();
            endpoints.forEach(endpoint => {
                // Extract pattern by replacing IDs with placeholders
                const pattern = endpoint.replace(/\/\d+/g, '/{id}');
                patterns.add(pattern);
            });
            
            // If most endpoints follow few patterns, it's consistent
            if (patterns.size <= Math.ceil(endpoints.length / 2)) {
                consistentEndpoints += endpoints.length;
            }
        });
        
        return totalEndpoints > 0 ? consistentEndpoints / totalEndpoints : 0;
    }

    scoreAuthClarity(authPatterns) {
        if (!authPatterns || authPatterns.length === 0) {
            return 0.3; // Some auth might be implicit
        }
        
        let clarityScore = 0.5; // Base score
        
        authPatterns.forEach(pattern => {
            switch (pattern.type) {
                case 'authorization':
                    clarityScore += 0.2; // Clear auth header
                    break;
                case 'cookie':
                    clarityScore += 0.15; // Cookie-based auth
                    break;
                case 'query_param':
                    clarityScore += 0.1; // API key in query
                    break;
                default:
                    clarityScore += 0.05; // Other auth patterns
            }
        });
        
        return Math.min(1.0, clarityScore);
    }

    scoreParameterPredictability(dynamicParams) {
        if (!dynamicParams || dynamicParams.length === 0) {
            return 0.8; // No dynamic params is predictable
        }
        
        let predictability = 0.5; // Base score
        
        dynamicParams.forEach(param => {
            switch (param.type) {
                case 'path_id':
                    predictability += 0.1; // Path IDs are predictable
                    break;
                case 'query_param':
                    predictability += 0.05; // Query params are somewhat predictable
                    break;
                default:
                    predictability += 0.02; // Other params
            }
        });
        
        return Math.min(1.0, predictability);
    }

    scoreRequestSimplicity(requestPatterns) {
        const { methods, statusCodes, timing } = requestPatterns;
        
        let simplicity = 0.5; // Base score
        
        // Method diversity (fewer methods = simpler)
        const methodCount = Object.keys(methods).length;
        if (methodCount <= 2) {
            simplicity += 0.2;
        } else if (methodCount <= 4) {
            simplicity += 0.1;
        }
        
        // Status code consistency (mostly 200/201 = simpler)
        const successCodes = (statusCodes[200] || 0) + (statusCodes[201] || 0);
        const totalCodes = Object.values(statusCodes).reduce((a, b) => a + b, 0);
        if (totalCodes > 0 && successCodes / totalCodes > 0.8) {
            simplicity += 0.2;
        }
        
        // Timing consistency (low variance = simpler)
        if (timing && timing.averageTime < 1000) { // Less than 1 second average
            simplicity += 0.1;
        }
        
        return Math.min(1.0, simplicity);
    }

    scoreDependencyClarity(harAnalysis) {
        if (!harAnalysis.apiEndpoints || Object.keys(harAnalysis.apiEndpoints).length === 0) {
            return 0.2; // No clear dependencies
        }
        
        let clarity = 0.5; // Base score
        
        // Fewer domains = clearer dependencies
        const domainCount = Object.keys(harAnalysis.apiEndpoints).length;
        if (domainCount === 1) {
            clarity += 0.3;
        } else if (domainCount <= 3) {
            clarity += 0.1;
        }
        
        // Fewer endpoints per domain = clearer dependencies
        let avgEndpointsPerDomain = 0;
        Object.values(harAnalysis.apiEndpoints).forEach(endpoints => {
            avgEndpointsPerDomain += endpoints.length;
        });
        avgEndpointsPerDomain /= domainCount;
        
        if (avgEndpointsPerDomain <= 5) {
            clarity += 0.2;
        } else if (avgEndpointsPerDomain <= 10) {
            clarity += 0.1;
        }
        
        return Math.min(1.0, clarity);
    }

    calculateNetworkComplexity(harAnalysis) {
        const { statistics } = harAnalysis;
        
        let complexity = 0;
        
        // Request count complexity
        const requestCount = statistics.totalRequests || 0;
        complexity += Math.min(requestCount / 50, 1) * 0.3;
        
        // Domain diversity complexity
        const domainCount = (statistics.domains || []).length;
        complexity += Math.min(domainCount / 10, 1) * 0.2;
        
        // Method diversity complexity
        const methodCount = (statistics.methods || []).length;
        complexity += Math.min(methodCount / 8, 1) * 0.2;
        
        // Content type diversity complexity
        const contentTypeCount = (statistics.contentTypes || []).length;
        complexity += Math.min(contentTypeCount / 15, 1) * 0.2;
        
        // Size complexity
        const avgSize = statistics.averageRequestSize || 0;
        complexity += Math.min(avgSize / (1024 * 1024), 1) * 0.1; // 1MB threshold
        
        return Math.min(1.0, complexity);
    }

    calculateApiComplexity(harAnalysis) {
        const { apiEndpoints } = harAnalysis;
        
        if (!apiEndpoints || Object.keys(apiEndpoints).length === 0) {
            return 0; // No API complexity
        }
        
        let complexity = 0;
        let totalEndpoints = 0;
        
        Object.values(apiEndpoints).forEach(endpoints => {
            totalEndpoints += endpoints.length;
            
            // Analyze endpoint patterns
            endpoints.forEach(endpoint => {
                // More complex HTTP methods increase complexity
                if (endpoint.includes('PUT') || endpoint.includes('DELETE') || endpoint.includes('PATCH')) {
                    complexity += 0.1;
                }
                
                // Path depth increases complexity
                const pathDepth = (endpoint.match(/\//g) || []).length;
                complexity += Math.min(pathDepth / 10, 0.1);
            });
        });
        
        return Math.min(1.0, complexity / Math.max(totalEndpoints, 1));
    }

    analyzeTaskDescription(taskDescription) {
        const description = taskDescription.toLowerCase();
        
        let complexity = 0.3; // Base complexity
        
        // Task type indicators
        if (description.includes('download') || description.includes('get')) {
            complexity += 0.1; // Simple task
        } else if (description.includes('upload') || description.includes('submit')) {
            complexity += 0.2; // Medium task
        } else if (description.includes('multi') || description.includes('complex')) {
            complexity += 0.4; // Complex task
        }
        
        // Action indicators
        if (description.includes('form') || description.includes('fill')) {
            complexity += 0.2;
        }
        
        if (description.includes('navigate') || description.includes('browse')) {
            complexity += 0.1;
        }
        
        if (description.includes('wait') || description.includes('delay')) {
            complexity += 0.1;
        }
        
        // Step indicators
        const stepMatches = description.match(/step|phase|stage/i);
        if (stepMatches && stepMatches.length > 1) {
            complexity += 0.2;
        }
        
        return Math.min(1.0, complexity);
    }

    estimateUiComplexity(harAnalysis) {
        const { statistics } = harAnalysis;
        
        let complexity = 0.2; // Base complexity
        
        // More requests suggest more UI interactions
        const requestCount = statistics.totalRequests || 0;
        complexity += Math.min(requestCount / 30, 1) * 0.3;
        
        // More content types suggest richer UI
        const contentTypeCount = (statistics.contentTypes || []).length;
        complexity += Math.min(contentTypeCount / 10, 1) * 0.2;
        
        // Presence of images, CSS, JS suggests UI complexity
        const hasImages = (statistics.contentTypes || []).some(ct => 
            ct.includes('image')
        );
        const hasCss = (statistics.contentTypes || []).some(ct => 
            ct.includes('css')
        );
        const hasJs = (statistics.contentTypes || []).some(ct => 
            ct.includes('javascript')
        );
        
        if (hasImages) complexity += 0.1;
        if (hasCss) complexity += 0.1;
        if (hasJs) complexity += 0.1;
        
        return Math.min(1.0, complexity);
    }

    assessStateComplexity(harAnalysis) {
        const { authPatterns, dynamicParams } = harAnalysis;
        
        let complexity = 0.2; // Base complexity
        
        // More auth patterns suggest complex state management
        if (authPatterns && authPatterns.length > 0) {
            complexity += Math.min(authPatterns.length / 5, 1) * 0.3;
        }
        
        // More dynamic params suggest complex state
        if (dynamicParams && dynamicParams.length > 0) {
            complexity += Math.min(dynamicParams.length / 10, 1) * 0.3;
        }
        
        // Check for state-related requests
        const hasStateManagement = harAnalysis.requestPatterns && 
            harAnalysis.requestPatterns.methods &&
            (harAnalysis.requestPatterns.methods['POST'] > 0 || 
             harAnalysis.requestPatterns.methods['PUT'] > 0);
        
        if (hasStateManagement) {
            complexity += 0.2;
        }
        
        return Math.min(1.0, complexity);
    }

    estimateInteguruTime(harAnalysis, complexityScore) {
        let baseTime = 3; // Base 3 seconds for Integuru
        
        // Adjust based on complexity
        baseTime *= (1 + complexityScore.score * 2);
        
        // Adjust based on number of API endpoints
        const apiEndpointCount = Object.keys(harAnalysis.apiEndpoints || {}).length;
        baseTime += apiEndpointCount * 0.5;
        
        // Adjust based on request count
        const requestCount = harAnalysis.totalEntries || 0;
        baseTime += Math.min(requestCount / 20, 2);
        
        return Math.round(baseTime * 100) / 100;
    }

    estimateHeadlessTime(harAnalysis, complexityScore) {
        let baseTime = 20; // Base 20 seconds for headless
        
        // Adjust based on complexity
        baseTime *= (1 + complexityScore.score * 1.5);
        
        // Adjust based on request count
        const requestCount = harAnalysis.totalEntries || 0;
        baseTime += Math.min(requestCount / 10, 15);
        
        // Adjust based on UI complexity
        const uiComplexity = this.estimateUiComplexity(harAnalysis);
        baseTime += uiComplexity * 10;
        
        return Math.round(baseTime * 100) / 100;
    }

    assessInteguruRisks(harAnalysis, complexityScore) {
        const risks = [];
        
        if (!harAnalysis.hasApiEndpoints) {
            risks.push({
                type: 'no_api',
                severity: 'high',
                description: 'No API endpoints detected for reverse-engineering'
            });
        }
        
        if (complexityScore.level === 'high') {
            risks.push({
                type: 'high_complexity',
                severity: 'medium',
                description: 'Task complexity may exceed Integuru capabilities'
            });
        }
        
        if (harAnalysis.authPatterns.length === 0) {
            risks.push({
                type: 'unclear_auth',
                severity: 'medium',
                description: 'Authentication patterns unclear or missing'
            });
        }
        
        const dynamicParamCount = (harAnalysis.dynamicParams || []).length;
        if (dynamicParamCount > 10) {
            risks.push({
                type: 'many_dynamic_params',
                severity: 'low',
                description: 'Many dynamic parameters may complicate reverse-engineering'
            });
        }
        
        return risks;
    }

    assessHeadlessRisks(harAnalysis, complexityScore) {
        const risks = [];
        
        if (complexityScore.level === 'high') {
            risks.push({
                type: 'high_complexity',
                severity: 'medium',
                description: 'High complexity may reduce reliability'
            });
        }
        
        const modernFeatures = this.detectModernWebFeatures(harAnalysis);
        if (modernFeatures.length > 0) {
            risks.push({
                type: 'modern_features',
                severity: 'low',
                description: `Modern features may require special handling: ${modernFeatures.join(', ')}`
            });
        }
        
        const requestCount = harAnalysis.totalEntries || 0;
        if (requestCount > 100) {
            risks.push({
                type: 'many_requests',
                severity: 'low',
                description: 'High number of requests may increase execution time'
            });
        }
        
        return risks;
    }

    detectModernWebFeatures(harAnalysis) {
        const features = [];
        
        // Check for modern JavaScript frameworks
        const { contentTypes } = harAnalysis.statistics || {};
        if (contentTypes && contentTypes.some(ct => ct.includes('module'))) {
            features.push('ES Modules');
        }
        
        // Check for WebSocket connections
        if (harAnalysis.requestPatterns && harAnalysis.requestPatterns.methods) {
            // This is a simplified check - in reality would look at actual protocols
            if (harAnalysis.totalEntries > 50) {
                features.push('Potential WebSockets');
            }
        }
        
        // Check for service worker indicators
        if (contentTypes && contentTypes.some(ct => ct.includes('javascript'))) {
            features.push('Potential Service Workers');
        }
        
        return features;
    }

    calculateConfidence(feasibility, factors) {
        let confidence = feasibility;
        
        // Adjust confidence based on individual factors
        Object.keys(factors).forEach(factor => {
            const factorValue = factors[factor];
            const factorWeight = this.getFactorWeight(factor);
            
            if (factorValue < 0.5) {
                confidence -= (0.5 - factorValue) * factorWeight;
            } else {
                confidence += (factorValue - 0.5) * factorWeight * 0.5;
            }
        });
        
        return Math.max(0, Math.min(1, confidence));
    }

    getFactorWeight(factor) {
        const weights = {
            reversibility: 0.4,
            complexity: 0.3,
            hasApi: 0.2,
            modernFeatures: 0.1
        };
        
        return weights[factor] || 0.1;
    }

    classifyTaskType(taskDescription) {
        const description = taskDescription.toLowerCase();
        
        if (description.includes('download') || description.includes('save') || description.includes('export')) {
            return 'download';
        } else if (description.includes('upload') || description.includes('submit') || description.includes('post')) {
            return 'upload';
        } else if (description.includes('login') || description.includes('auth') || description.includes('signin')) {
            return 'authentication';
        } else if (description.includes('search') || description.includes('find') || description.includes('query')) {
            return 'search';
        } else if (description.includes('form') || description.includes('fill') || description.includes('input')) {
            return 'form_interaction';
        } else if (description.includes('navigate') || description.includes('browse') || description.includes('goto')) {
            return 'navigation';
        } else if (description.includes('click') || description.includes('button') || description.includes('link')) {
            return 'interaction';
        } else {
            return 'general';
        }
    }

    calculateTimeFactor(actualTime, targetRange) {
        if (actualTime <= targetRange.max) {
            return 1.0; // Within target range
        } else if (actualTime <= targetRange.max * 2) {
            return 0.8; // Slightly over target
        } else {
            return 0.5; // Significantly over target
        }
    }

    calculateTimeAccuracy(estimated, actual) {
        if (estimated === 0) return 0;
        const accuracy = 1 - Math.abs(estimated - actual) / estimated;
        return Math.max(0, Math.min(1, accuracy));
    }

    // Additional helper methods would continue here...
    // For brevity, I'm including the most critical ones
    
    async loadHistoricalData() {
        try {
            const dataPath = path.join(process.cwd(), 'data', 'historical_modality_data.json');
            const data = await fs.readFile(dataPath, 'utf8');
            this.historicalData = JSON.parse(data);
        } catch (error) {
            // File doesn't exist or is invalid, start with empty data
            this.historicalData = {};
        }
    }
    
    async updateHistoricalData(decision, executionTime, success) {
        // Update in-memory historical data
        // Periodic saving would be handled by the optimization engine
        await this.optimizationEngine.recordExecution({
            modality: decision.modality,
            executionTime,
            success,
            features: decision.metadata
        });
    }
}

module.exports = ModalityOptimizer;