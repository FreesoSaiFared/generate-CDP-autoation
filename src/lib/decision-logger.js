/**
 * Decision Logger - Modality Choice Recording and Analysis
 * 
 * This module records and analyzes modality decisions to provide insights
 * into decision patterns, accuracy, and optimization opportunities.
 * 
 * Features:
 * - Comprehensive decision logging with context
 * - Decision accuracy tracking
 * - Pattern recognition in decision making
 * - Decision tree analysis
 * - Performance vs. decision correlation
 * - Decision quality metrics
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const EventEmitter = require('events');

class DecisionLogger extends EventEmitter {
    constructor(options = {}) {
        this.dataDir = options.dataDir || path.join(process.cwd(), 'data', 'decisions');
        this.maxLogSize = options.maxLogSize || 1000; // Max decisions in memory
        this.compressionEnabled = options.compressionEnabled !== false;
        
        // In-memory decision cache
        this.decisionCache = [];
        
        // Decision patterns
        this.patterns = {
            byDomain: {},
            byTaskType: {},
            byTimeOfDay: {},
            byComplexity: {}
        };
        
        // Initialize data directory
        this.initializeDataDirectory();
        
        // Load existing decisions
        this.loadDecisions();
        
        // Setup periodic persistence
        this.setupPeriodicPersistence();
    }

    /**
     * Log a modality decision with full context
     * 
     * @param {Object} params - Decision parameters
     * @param {string} params.taskDescription - Description of the task
     * @param {string} params.harFile - Path to HAR file used for decision
     * @param {Object} params.decision - Final decision made
     * @param {Object} params.analysis - Analysis data used for decision
     * @param {string} params.timestamp - Decision timestamp
     * @returns {Promise<Object>} Logged decision record
     */
    async logDecision(params) {
        const {
            taskDescription,
            harFile,
            decision,
            analysis,
            timestamp = new Date().toISOString()
        } = params;
        
        const decisionId = this.generateDecisionId();
        
        const record = {
            id: decisionId,
            timestamp,
            taskDescription,
            harFile,
            decision: {
                modality: decision.modality,
                confidence: decision.confidence,
                estimatedTime: decision.estimatedTime,
                reasoning: decision.reasoning,
                metadata: decision.metadata
            },
            analysis: {
                harAnalysis: this.simplifyHarAnalysis(analysis.harAnalysis),
                reversibilityScore: analysis.reversibilityScore,
                complexityScore: analysis.complexityScore,
                integuruAssessment: analysis.integuruAssessment,
                headlessAssessment: analysis.headlessAssessment
            },
            context: this.extractContext(params),
            execution: null, // To be filled when execution completes
            quality: null // To be calculated after execution
        };
        
        // Add to cache
        this.decisionCache.push(record);
        
        // Limit cache size
        if (this.decisionCache.length > this.maxLogSize) {
            this.decisionCache.shift();
        }
        
        // Update patterns
        this.updatePatterns(record);
        
        // Persist to disk
        await this.persistDecision(record);
        
        // Emit event for real-time monitoring
        this.emit('decision:logged', record);
        
        return record;
    }

    /**
     * Record execution results for a decision
     * 
     * @param {string} decisionId - ID of the decision
     * @param {Object} executionResults - Execution results
     * @returns {Promise<Object>} Updated decision record
     */
    async recordExecution(decisionId, executionResults) {
        const decision = this.findDecision(decisionId);
        
        if (!decision) {
            throw new Error(`Decision not found: ${decisionId}`);
        }
        
        decision.execution = {
            modality: executionResults.modality,
            actualTime: executionResults.actualTime,
            success: executionResults.success,
            error: executionResults.error || null,
            timestamp: executionResults.timestamp || new Date().toISOString(),
            metrics: executionResults.metrics || {}
        };
        
        // Calculate decision quality
        decision.quality = this.calculateDecisionQuality(decision);
        
        // Update patterns with execution results
        this.updatePatternsWithExecution(decision);
        
        // Persist updated record
        await this.persistDecision(decision);
        
        // Emit event for real-time monitoring
        this.emit('execution:recorded', decision);
        
        return decision;
    }

    /**
     * Get decision statistics and patterns
     * 
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Decision statistics
     */
    async getDecisionStats(options = {}) {
        const {
            timeRange = 24 * 7, // 1 week in hours
            domain = null,
            modality = null,
            includeExecuted = true
        } = options;
        
        const decisions = this.getFilteredDecisions({
            timeRange,
            domain,
            modality,
            includeExecuted
        });
        
        return {
            totalDecisions: decisions.length,
            executedDecisions: decisions.filter(d => d.execution).length,
            modalityDistribution: this.calculateModalityDistribution(decisions),
            accuracyMetrics: this.calculateAccuracyMetrics(decisions),
            confidenceAnalysis: this.analyzeConfidence(decisions),
            timeAnalysis: this.analyzeTimeAccuracy(decisions),
            patterns: this.analyzeDecisionPatterns(decisions),
            qualityMetrics: this.calculateQualityMetrics(decisions),
            trends: this.calculateDecisionTrends(decisions)
        };
    }

    /**
     * Analyze decision patterns for insights
     * 
     * @param {Object} options - Analysis options
     * @returns {Promise<Object>} Pattern analysis results
     */
    async analyzePatterns(options = {}) {
        const {
            timeRange = 24 * 7,
            minSampleSize = 10
        } = options;
        
        const decisions = this.getFilteredDecisions({ timeRange });
        
        if (decisions.length < minSampleSize) {
            return {
                insufficientData: true,
                sampleSize: decisions.length,
                requiredSize: minSampleSize
            };
        }
        
        return {
            domainPatterns: this.analyzeDomainPatterns(decisions),
            taskTypePatterns: this.analyzeTaskTypePatterns(decisions),
            complexityPatterns: this.analyzeComplexityPatterns(decisions),
            timePatterns: this.analyzeTimePatterns(decisions),
            sequencePatterns: this.analyzeSequencePatterns(decisions),
            recommendations: this.generatePatternRecommendations(decisions)
        };
    }

    /**
     * Get decision accuracy by different dimensions
     * 
     * @param {Object} options - Accuracy analysis options
     * @returns {Promise<Object>} Accuracy analysis
     */
    async getAccuracyAnalysis(options = {}) {
        const {
            timeRange = 24 * 7,
            groupBy = 'domain' // domain, taskType, complexity, modality
        } = options;
        
        const decisions = this.getFilteredDecisions({
            timeRange,
            includeExecuted: true
        });
        
        const groups = this.groupDecisions(decisions, groupBy);
        const analysis = {};
        
        Object.keys(groups).forEach(key => {
            const groupDecisions = groups[key];
            const executedDecisions = groupDecisions.filter(d => d.execution);
            
            if (executedDecisions.length > 0) {
                analysis[key] = {
                    totalDecisions: groupDecisions.length,
                    executedDecisions: executedDecisions.length,
                    successRate: executedDecisions.filter(d => d.execution.success).length / executedDecisions.length,
                    avgConfidence: executedDecisions.reduce((sum, d) => sum + d.decision.confidence, 0) / executedDecisions.length,
                    timeAccuracy: this.calculateAverageTimeAccuracy(executedDecisions),
                    qualityScore: this.calculateAverageQualityScore(executedDecisions)
                };
            }
        });
        
        return {
            groupBy,
            timeRange,
            analysis,
            overall: this.calculateOverallAccuracy(decisions)
        };
    }

    /**
     * Export decision data for external analysis
     * 
     * @param {Object} options - Export options
     * @returns {Promise<string>} Path to exported file
     */
    async exportDecisions(options = {}) {
        const {
            format = 'json',
            timeRange = 24 * 7,
            includeAnalysis = true,
            anonymize = false
        } = options;
        
        const decisions = this.getFilteredDecisions({ timeRange });
        let exportData = {
            exportedAt: new Date().toISOString(),
            timeRange,
            totalDecisions: decisions.length,
            decisions: anonymize ? this.anonymizeDecisions(decisions) : decisions
        };
        
        if (includeAnalysis) {
            exportData.analysis = {
                stats: await this.getDecisionStats({ timeRange }),
                patterns: await this.analyzePatterns({ timeRange }),
                accuracy: await this.getAccuracyAnalysis({ timeRange })
            };
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `decisions_export_${timestamp}.${format}`;
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
    
    generateDecisionId() {
        return `decision_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }

    simplifyHarAnalysis(harAnalysis) {
        // Extract only key information to reduce storage size
        return {
            totalEntries: harAnalysis.totalEntries,
            hasApiEndpoints: harAnalysis.hasApiEndpoints,
            complexity: harAnalysis.complexity,
            apiEndpointCount: Object.keys(harAnalysis.apiEndpoints || {}).length,
            authPatternCount: (harAnalysis.authPatterns || []).length,
            dynamicParamCount: (harAnalysis.dynamicParams || []).length
        };
    }

    extractContext(params) {
        // Extract relevant context from parameters and environment
        return {
            domain: this.extractDomain(params.harFile),
            taskType: this.classifyTaskType(params.taskDescription),
            timeOfDay: new Date().getHours(),
            dayOfWeek: new Date().getDay(),
            environment: process.env.NODE_ENV || 'development'
        };
    }

    extractDomain(harFile) {
        // Extract domain from HAR file path or content
        // This is a simplified implementation
        if (harFile && typeof harFile === 'string') {
            const match = harFile.match(/([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/);
            return match ? match[1] : 'unknown';
        }
        return 'unknown';
    }

    classifyTaskType(taskDescription) {
        const description = taskDescription.toLowerCase();
        
        if (description.includes('download') || description.includes('save')) {
            return 'download';
        } else if (description.includes('upload') || description.includes('submit')) {
            return 'upload';
        } else if (description.includes('login') || description.includes('auth')) {
            return 'authentication';
        } else if (description.includes('search') || description.includes('find')) {
            return 'search';
        } else if (description.includes('form') || description.includes('fill')) {
            return 'form_interaction';
        } else if (description.includes('navigate') || description.includes('browse')) {
            return 'navigation';
        } else {
            return 'general';
        }
    }

    updatePatterns(decision) {
        const { context, decision: dec } = decision;
        
        // Update domain patterns
        if (!this.patterns.byDomain[context.domain]) {
            this.patterns.byDomain[context.domain] = {
                integuru: 0,
                headless_cdp: 0,
                visible_browser: 0,
                total: 0
            };
        }
        this.patterns.byDomain[context.domain][dec.modality]++;
        this.patterns.byDomain[context.domain].total++;
        
        // Update task type patterns
        if (!this.patterns.byTaskType[context.taskType]) {
            this.patterns.byTaskType[context.taskType] = {
                integuru: 0,
                headless_cdp: 0,
                visible_browser: 0,
                total: 0
            };
        }
        this.patterns.byTaskType[context.taskType][dec.modality]++;
        this.patterns.byTaskType[context.taskType].total++;
        
        // Update time of day patterns
        const hour = context.timeOfDay;
        if (!this.patterns.byTimeOfDay[hour]) {
            this.patterns.byTimeOfDay[hour] = {
                integuru: 0,
                headless_cdp: 0,
                visible_browser: 0,
                total: 0
            };
        }
        this.patterns.byTimeOfDay[hour][dec.modality]++;
        this.patterns.byTimeOfDay[hour].total++;
    }

    updatePatternsWithExecution(decision) {
        if (!decision.execution) return;
        
        const { context, decision: dec, execution } = decision;
        
        // Update patterns with execution success/failure
        // This would involve tracking success rates by pattern
        // Implementation depends on specific pattern tracking needs
    }

    calculateDecisionQuality(decision) {
        if (!decision.execution) return null;
        
        const { decision: dec, execution } = decision;
        let quality = 0;
        
        // Success factor (40% weight)
        quality += execution.success ? 0.4 : 0;
        
        // Time accuracy factor (30% weight)
        const timeAccuracy = this.calculateTimeAccuracy(dec.estimatedTime, execution.actualTime);
        quality += timeAccuracy * 0.3;
        
        // Confidence accuracy factor (20% weight)
        const confidenceAccuracy = execution.success ? dec.confidence : (1 - dec.confidence);
        quality += confidenceAccuracy * 0.2;
        
        // Modality appropriateness factor (10% weight)
        const modalityScore = this.calculateModalityAppropriateness(dec, execution);
        quality += modalityScore * 0.1;
        
        return {
            overall: Math.round(quality * 100) / 100,
            success: execution.success,
            timeAccuracy: Math.round(timeAccuracy * 100) / 100,
            confidenceAccuracy: Math.round(confidenceAccuracy * 100) / 100,
            modalityAppropriateness: Math.round(modalityScore * 100) / 100
        };
    }

    calculateTimeAccuracy(estimated, actual) {
        if (estimated === 0) return 0;
        const accuracy = 1 - Math.abs(estimated - actual) / estimated;
        return Math.max(0, Math.min(1, accuracy));
    }

    calculateModalityAppropriateness(decision, execution) {
        // Score how appropriate chosen modality was
        // This is a simplified implementation
        const { modality, estimatedTime } = decision;
        const { actualTime, success } = execution;
        
        if (!success) return 0;
        
        // Check if time was within expected range for modality
        const expectedRanges = {
            integuru: { min: 2, max: 10 },
            headless_cdp: { min: 10, max: 60 },
            visible_browser: { min: 60, max: 900 }
        };
        
        const range = expectedRanges[modality];
        if (range && actualTime >= range.min && actualTime <= range.max) {
            return 1;
        }
        
        // Partial credit if close to range
        if (range) {
            const deviation = Math.min(
                Math.abs(actualTime - range.min),
                Math.abs(actualTime - range.max)
            );
            return Math.max(0, 1 - deviation / range.max);
        }
        
        return 0.5; // Default if no range defined
    }

    findDecision(decisionId) {
        return this.decisionCache.find(d => d.id === decisionId);
    }

    getFilteredDecisions(options = {}) {
        const {
            timeRange = null,
            domain = null,
            modality = null,
            includeExecuted = true
        } = options;
        
        let decisions = [...this.decisionCache];
        
        // Time range filter
        if (timeRange) {
            const cutoffTime = new Date(Date.now() - timeRange * 60 * 60 * 1000);
            decisions = decisions.filter(d => new Date(d.timestamp) >= cutoffTime);
        }
        
        // Domain filter
        if (domain) {
            decisions = decisions.filter(d => d.context.domain === domain);
        }
        
        // Modality filter
        if (modality) {
            decisions = decisions.filter(d => d.decision.modality === modality);
        }
        
        // Execution filter
        if (includeExecuted) {
            decisions = decisions.filter(d => d.execution);
        }
        
        return decisions;
    }

    calculateModalityDistribution(decisions) {
        const distribution = {
            integuru: 0,
            headless_cdp: 0,
            visible_browser: 0
        };
        
        decisions.forEach(decision => {
            distribution[decision.decision.modality]++;
        });
        
        // Convert to percentages
        const total = decisions.length || 1;
        Object.keys(distribution).forEach(modality => {
            distribution[modality] = Math.round((distribution[modality] / total) * 100);
        });
        
        return distribution;
    }

    calculateAccuracyMetrics(decisions) {
        const executed = decisions.filter(d => d.execution);
        
        if (executed.length === 0) {
            return { successRate: 0, timeAccuracy: 0, confidenceAccuracy: 0 };
        }
        
        const successful = executed.filter(d => d.execution.success);
        const successRate = successful.length / executed.length;
        
        const timeAccuracies = executed.map(d => 
            this.calculateTimeAccuracy(d.decision.estimatedTime, d.execution.actualTime)
        );
        const avgTimeAccuracy = timeAccuracies.reduce((a, b) => a + b, 0) / timeAccuracies.length;
        
        const confidenceAccuracies = executed.map(d => 
            d.execution.success ? d.decision.confidence : (1 - d.decision.confidence)
        );
        const avgConfidenceAccuracy = confidenceAccuracies.reduce((a, b) => a + b, 0) / confidenceAccuracies.length;
        
        return {
            successRate: Math.round(successRate * 100) / 100,
            timeAccuracy: Math.round(avgTimeAccuracy * 100) / 100,
            confidenceAccuracy: Math.round(avgConfidenceAccuracy * 100) / 100
        };
    }

    analyzeConfidence(decisions) {
        const executed = decisions.filter(d => d.execution);
        
        if (executed.length === 0) {
            return {
                average: 0,
                distribution: { high: 0, medium: 0, low: 0 },
                accuracy: 0
            };
        }
        
        const confidences = executed.map(d => d.decision.confidence);
        const average = confidences.reduce((a, b) => a + b, 0) / confidences.length;
        
        const distribution = {
            high: confidences.filter(c => c > 0.8).length,
            medium: confidences.filter(c => c >= 0.6 && c <= 0.8).length,
            low: confidences.filter(c => c < 0.6).length
        };
        
        // Calculate confidence accuracy
        const accurateConfidences = executed.filter(d => 
            d.execution.success && d.decision.confidence > 0.7
        ).length;
        const accuracy = executed.length > 0 ? accurateConfidences / executed.length : 0;
        
        return {
            average: Math.round(average * 100) / 100,
            distribution,
            accuracy: Math.round(accuracy * 100) / 100
        };
    }

    analyzeTimeAccuracy(decisions) {
        const executed = decisions.filter(d => d.execution);
        
        if (executed.length === 0) {
            return {
                average: 0,
                distribution: { excellent: 0, good: 0, fair: 0, poor: 0 },
                byModality: {}
            };
        }
        
        const timeAccuracies = executed.map(d => 
            this.calculateTimeAccuracy(d.decision.estimatedTime, d.execution.actualTime)
        );
        const average = timeAccuracies.reduce((a, b) => a + b, 0) / timeAccuracies.length;
        
        const distribution = {
            excellent: timeAccuracies.filter(a => a > 0.9).length,
            good: timeAccuracies.filter(a => a >= 0.7 && a <= 0.9).length,
            fair: timeAccuracies.filter(a => a >= 0.5 && a < 0.7).length,
            poor: timeAccuracies.filter(a => a < 0.5).length
        };
        
        // Group by modality
        const byModality = {};
        executed.forEach(decision => {
            const modality = decision.decision.modality;
            const accuracy = this.calculateTimeAccuracy(
                decision.decision.estimatedTime, 
                decision.execution.actualTime
            );
            
            if (!byModality[modality]) {
                byModality[modality] = [];
            }
            byModality[modality].push(accuracy);
        });
        
        // Calculate averages by modality
        Object.keys(byModality).forEach(modality => {
            const accuracies = byModality[modality];
            byModality[modality] = {
                count: accuracies.length,
                average: accuracies.reduce((a, b) => a + b, 0) / accuracies.length
            };
        });
        
        return {
            average: Math.round(average * 100) / 100,
            distribution,
            byModality
        };
    }

    analyzeDecisionPatterns(decisions) {
        const patterns = {
            timeOfDay: {},
            dayOfWeek: {},
            sequence: {},
            transitions: {}
        };
        
        decisions.forEach((decision, index) => {
            const timestamp = new Date(decision.timestamp);
            const hour = timestamp.getHours();
            const day = timestamp.getDay();
            const modality = decision.decision.modality;
            
            // Time of day patterns
            if (!patterns.timeOfDay[hour]) {
                patterns.timeOfDay[hour] = {
                    integuru: 0,
                    headless_cdp: 0,
                    visible_browser: 0,
                    total: 0
                };
            }
            patterns.timeOfDay[hour][modality]++;
            patterns.timeOfDay[hour].total++;
            
            // Day of week patterns
            if (!patterns.dayOfWeek[day]) {
                patterns.dayOfWeek[day] = {
                    integuru: 0,
                    headless_cdp: 0,
                    visible_browser: 0,
                    total: 0
                };
            }
            patterns.dayOfWeek[day][modality]++;
            patterns.dayOfWeek[day].total++;
            
            // Sequence patterns (what follows what)
            if (index > 0) {
                const previousModality = decisions[index - 1].decision.modality;
                const transition = `${previousModality}->${modality}`;
                
                if (!patterns.transitions[transition]) {
                    patterns.transitions[transition] = 0;
                }
                patterns.transitions[transition]++;
            }
        });
        
        return patterns;
    }

    calculateDecisionTrends(decisions) {
        const trends = {
            modalityShifts: [],
            confidenceChanges: [],
            accuracyChanges: []
        };
        
        if (decisions.length < 10) {
            return trends;
        }
        
        // Sort by timestamp
        const sorted = decisions.sort((a, b) => 
            new Date(a.timestamp) - new Date(b.timestamp)
        );
        
        // Analyze modality shifts over time
        const recent = sorted.slice(-5);
        const older = sorted.slice(-10, -5);
        
        const recentDistribution = this.calculateModalityDistribution(recent);
        const olderDistribution = this.calculateModalityDistribution(older);
        
        Object.keys(recentDistribution).forEach(modality => {
            const recentCount = recentDistribution[modality];
            const olderCount = olderDistribution[modality] || 0;
            
            if (recentCount > olderCount + 10) { // 10% increase threshold
                trends.modalityShifts.push({
                    modality,
                    change: 'increasing',
                    magnitude: recentCount - olderCount
                });
            } else if (recentCount < olderCount - 10) {
                trends.modalityShifts.push({
                    modality,
                    change: 'decreasing',
                    magnitude: olderCount - recentCount
                });
            }
        });
        
        return trends;
    }

    calculateQualityMetrics(decisions) {
        const executed = decisions.filter(d => d.execution && d.quality);
        
        if (executed.length === 0) {
            return {
                overall: 0,
                byModality: {},
                factors: {
                    success: 0,
                    timeAccuracy: 0,
                    confidenceAccuracy: 0,
                    modalityAppropriateness: 0
                }
            };
        }
        
        const overallScores = executed.map(d => d.quality.overall);
        const overall = overallScores.reduce((a, b) => a + b, 0) / overallScores.length;
        
        // Group by modality
        const byModality = {};
        executed.forEach(decision => {
            const modality = decision.decision.modality;
            const score = decision.quality.overall;
            
            if (!byModality[modality]) {
                byModality[modality] = [];
            }
            byModality[modality].push(score);
        });
        
        // Calculate averages by modality
        Object.keys(byModality).forEach(modality => {
            const scores = byModality[modality];
            byModality[modality] = {
                count: scores.length,
                average: scores.reduce((a, b) => a + b, 0) / scores.length
            };
        });
        
        // Calculate factor averages
        const factors = {
            success: executed.reduce((sum, d) => sum + d.quality.success, 0) / executed.length,
            timeAccuracy: executed.reduce((sum, d) => sum + d.quality.timeAccuracy, 0) / executed.length,
            confidenceAccuracy: executed.reduce((sum, d) => sum + d.quality.confidenceAccuracy, 0) / executed.length,
            modalityAppropriateness: executed.reduce((sum, d) => sum + d.quality.modalityAppropriateness, 0) / executed.length
        };
        
        return {
            overall: Math.round(overall * 100) / 100,
            byModality,
            factors
        };
    }

    groupDecisions(decisions, groupBy) {
        const groups = {};
        
        decisions.forEach(decision => {
            let key;
            
            switch (groupBy) {
                case 'domain':
                    key = decision.context.domain;
                    break;
                case 'taskType':
                    key = decision.context.taskType;
                    break;
                case 'complexity':
                    key = decision.analysis.complexityScore.level;
                    break;
                case 'modality':
                    key = decision.decision.modality;
                    break;
                default:
                    key = 'unknown';
            }
            
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(decision);
        });
        
        return groups;
    }

    calculateOverallAccuracy(decisions) {
        const executed = decisions.filter(d => d.execution);
        
        if (executed.length === 0) {
            return { successRate: 0, timeAccuracy: 0, confidenceAccuracy: 0 };
        }
        
        const successful = executed.filter(d => d.execution.success);
        const successRate = successful.length / executed.length;
        
        const timeAccuracies = executed.map(d => 
            this.calculateTimeAccuracy(d.decision.estimatedTime, d.execution.actualTime)
        );
        const avgTimeAccuracy = timeAccuracies.reduce((a, b) => a + b, 0) / timeAccuracies.length;
        
        const confidenceAccuracies = executed.map(d => 
            d.execution.success ? d.decision.confidence : (1 - d.decision.confidence)
        );
        const avgConfidenceAccuracy = confidenceAccuracies.reduce((a, b) => a + b, 0) / confidenceAccuracies.length;
        
        return {
            successRate: Math.round(successRate * 100) / 100,
            timeAccuracy: Math.round(avgTimeAccuracy * 100) / 100,
            confidenceAccuracy: Math.round(avgConfidenceAccuracy * 100) / 100
        };
    }

    calculateAverageTimeAccuracy(executedDecisions) {
        if (executedDecisions.length === 0) return 0;
        
        const timeAccuracies = executedDecisions.map(d => 
            this.calculateTimeAccuracy(d.decision.estimatedTime, d.execution.actualTime)
        );
        
        return timeAccuracies.reduce((a, b) => a + b, 0) / timeAccuracies.length;
    }

    calculateAverageQualityScore(executedDecisions) {
        if (executedDecisions.length === 0) return 0;
        
        const qualityScores = executedDecisions.map(d => d.quality.overall);
        
        return qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length;
    }

    anonymizeDecisions(decisions) {
        return decisions.map(decision => ({
            ...decision,
            taskDescription: this.anonymizeText(decision.taskDescription),
            harFile: 'anonymized.har',
            context: {
                ...decision.context,
                domain: this.anonymizeDomain(decision.context.domain)
            },
            metadata: {
                ...decision.metadata,
                // Remove any sensitive metadata
            }
        }));
    }

    anonymizeText(text) {
        // Simple anonymization - replace potential PII
        return text
            .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, 'email@example.com')
            .replace(/\b\d{3}-\d{2}-\d{4}\b/g, 'xxx-xx-xxxx')
            .replace(/\b[A-Za-z]{2}\d{4}\b/g, 'xx1234');
    }

    anonymizeDomain(domain) {
        // Replace domain with generic placeholder
        const parts = domain.split('.');
        if (parts.length >= 2) {
            return `${parts[0].substring(0, 3)}***.${parts.slice(1).join('.')}`;
        }
        return '***.com';
    }

    convertToCSV(data) {
        const csvLines = [];
        
        // Header
        csvLines.push('ID,Timestamp,TaskDescription,Modality,Confidence,EstimatedTime,ActualTime,Success,Quality');
        
        // Data rows
        if (data.decisions) {
            data.decisions.forEach(decision => {
                const execution = decision.execution || {};
                const quality = decision.quality || {};
                
                csvLines.push([
                    decision.id,
                    decision.timestamp,
                    `"${this.escapeCsvField(decision.taskDescription)}"`,
                    decision.decision.modality,
                    decision.decision.confidence,
                    decision.decision.estimatedTime,
                    execution.actualTime || '',
                    execution.success || '',
                    quality.overall || ''
                ].join(','));
            });
        }
        
        return csvLines.join('\n');
    }

    escapeCsvField(field) {
        if (typeof field !== 'string') return field;
        
        // Escape quotes and commas
        return field.replace(/"/g, '""').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
    }

    async initializeDataDirectory() {
        try {
            await fs.access(this.dataDir);
        } catch {
            await fs.mkdir(this.dataDir, { recursive: true });
        }
    }

    async loadDecisions() {
        // Load recent decisions from disk
        try {
            const today = new Date().toISOString().split('T')[0];
            const todayFile = path.join(this.dataDir, `${today}.json`);
            
            const data = await fs.readFile(todayFile, 'utf8');
            const todayDecisions = JSON.parse(data);
            
            this.decisionCache = todayDecisions.slice(-this.maxLogSize);
        } catch (error) {
            // File doesn't exist or is invalid
            this.decisionCache = [];
        }
    }

    async persistDecision(decision) {
        const date = new Date(decision.timestamp).toISOString().split('T')[0];
        const filename = `${date}.json`;
        const filepath = path.join(this.dataDir, filename);
        
        try {
            // Load existing decisions for day
            let dailyDecisions = [];
            try {
                const data = await fs.readFile(filepath, 'utf8');
                dailyDecisions = JSON.parse(data);
            } catch {
                // File doesn't exist yet
            }
            
            // Update or add decision
            const existingIndex = dailyDecisions.findIndex(d => d.id === decision.id);
            if (existingIndex >= 0) {
                dailyDecisions[existingIndex] = decision;
            } else {
                dailyDecisions.push(decision);
            }
            
            // Save back
            await fs.writeFile(filepath, JSON.stringify(dailyDecisions, null, 2));
            
        } catch (error) {
            console.error('Failed to persist decision:', error);
        }
    }

    setupPeriodicPersistence() {
        // Persist any unsaved decisions every 5 minutes
        setInterval(async () => {
            // This would ensure all in-memory decisions are persisted
            // Implementation depends on specific persistence strategy
        }, 5 * 60 * 1000);
    }
}

module.exports = DecisionLogger;