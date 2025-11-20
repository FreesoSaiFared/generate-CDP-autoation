/**
 * Self-Debugging Loop with 5-Attempt Limit
 * 
 * This module implements the autonomous self-debugging loop as specified
 * in document.pdf, with a maximum of 5 attempts and iterative
 * improvement through visual verification and error analysis.
 * 
 * Features:
 * - Autonomous debugging with 5-attempt limit
 * - Iterative improvement through each attempt
 * - Visual verification integration
 * - Error pattern analysis
 * - Adaptive strategy selection
 * - Progress tracking and reporting
 * - Automatic recovery mechanisms
 * - Learning from previous attempts
 */

const EventEmitter = require('events');
const crypto = require('crypto');

class SelfDebuggingLoop extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = {
            maxAttempts: options.maxAttempts || 5,
            attemptDelay: options.attemptDelay || 1000, // 1 second between attempts
            enableVisualVerification: options.enableVisualVerification !== false,
            enableErrorAnalysis: options.enableErrorAnalysis !== false,
            enableLearning: options.enableLearning !== false,
            adaptiveStrategies: options.adaptiveStrategies !== false,
            progressCallback: options.progressCallback || null,
            dataDir: options.dataDir || './debug/self-debugging'
        };
        
        // Debugging state
        this.activeSessions = new Map();
        this.attemptHistory = [];
        this.learnedStrategies = new Map();
        this.successPatterns = new Map();
        
        // Strategy definitions
        this.strategies = {
            timeout_adjustment: {
                name: 'Timeout Adjustment',
                priority: 1,
                description: 'Adjust timeout values and wait conditions',
                apply: this.applyTimeoutAdjustment.bind(this)
            },
            selector_improvement: {
                name: 'Selector Improvement',
                priority: 2,
                description: 'Improve element selectors and wait conditions',
                apply: this.applySelectorImprovement.bind(this)
            },
            retry_with_backoff: {
                name: 'Retry with Backoff',
                priority: 3,
                description: 'Retry operation with exponential backoff',
                apply: this.applyRetryWithBackoff.bind(this)
            },
            navigation_optimization: {
                name: 'Navigation Optimization',
                priority: 2,
                description: 'Optimize navigation and page load handling',
                apply: this.applyNavigationOptimization.bind(this)
            },
            visual_verification: {
                name: 'Visual Verification',
                priority: 4,
                description: 'Use visual verification to validate state',
                apply: this.applyVisualVerification.bind(this)
            },
            error_pattern_fix: {
                name: 'Error Pattern Fix',
                priority: 5,
                description: 'Apply fixes based on error pattern analysis',
                apply: this.applyErrorPatternFix.bind(this)
            },
            resource_optimization: {
                name: 'Resource Optimization',
                priority: 3,
                description: 'Optimize resource usage and allocation',
                apply: this.applyResourceOptimization.bind(this)
            },
            configuration_reset: {
                name: 'Configuration Reset',
                priority: 6,
                description: 'Reset to known good configuration',
                apply: this.applyConfigurationReset.bind(this)
            }
        };
        
        // Initialize data directory
        this.initializeDataDirectory();
        
        // Load learned strategies
        if (this.config.enableLearning) {
            this.loadLearnedStrategies();
        }
    }

    /**
     * Execute self-debugging loop for a task
     * 
     * @param {Object} params - Debugging parameters
     * @param {Function} params.testFunction - Function to test the task
     * @param {Object} params.context - Additional context
     * @param {Array} params.expectedElements - Elements expected to be found
     * @param {Object} params.visualVerifier - Visual verifier instance
     * @param {Object} params.errorAnalyzer - Error analyzer instance
     * @returns {Promise<Object>} Debugging results
     */
    async executeSelfDebugging(params) {
        const {
            testFunction,
            context = {},
            expectedElements = [],
            visualVerifier = null,
            errorAnalyzer = null,
            sessionId = this.generateSessionId()
        } = params;
        
        const session = {
            id: sessionId,
            startTime: new Date().toISOString(),
            taskDescription: context.taskDescription || 'Unknown task',
            context,
            expectedElements,
            attempts: [],
            currentAttempt: 0,
            status: 'running',
            resolved: false,
            finalResult: null,
            learnedLessons: [],
            strategies: new Set()
        };
        
        this.activeSessions.set(sessionId, session);
        
        this.emit('session:started', { sessionId, session });
        
        try {
            for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
                session.currentAttempt = attempt;
                
                const attemptResult = await this.executeAttempt({
                    session,
                    attemptNumber: attempt,
                    testFunction,
                    visualVerifier,
                    errorAnalyzer,
                    previousAttempts: session.attempts
                });
                
                session.attempts.push(attemptResult);
                
                // Check if successful
                if (attemptResult.success) {
                    session.status = 'resolved';
                    session.resolved = true;
                    session.finalResult = attemptResult.result;
                    
                    // Learn from success
                    if (this.config.enableLearning) {
                        this.learnFromSuccess(session, attemptResult);
                    }
                    
                    this.emit('session:resolved', { sessionId, session, finalAttempt: attemptResult });
                    break;
                }
                
                // Check if we should continue
                if (attempt < this.config.maxAttempts) {
                    // Analyze failure and prepare next attempt
                    const analysis = await this.analyzeAttemptFailure(attemptResult, session);
                    
                    if (analysis.shouldContinue) {
                        // Apply delay before next attempt
                        if (this.config.attemptDelay > 0) {
                            await this.delay(this.config.attemptDelay);
                        }
                        
                        // Update session with analysis
                        session.learnedLessons.push(analysis);
                        
                        this.emit('attempt:completed', { 
                            sessionId, 
                            attemptNumber: attempt, 
                            result: attemptResult,
                            analysis 
                        });
                        
                        // Call progress callback if provided
                        if (this.config.progressCallback) {
                            this.config.progressCallback({
                                sessionId,
                                attempt,
                                maxAttempts: this.config.maxAttempts,
                                result: attemptResult,
                                analysis
                            });
                        }
                    } else {
                        // Analysis suggests we should stop
                        session.status = 'failed';
                        session.finalResult = {
                            reason: analysis.reason || 'Analysis suggested termination',
                            lastAttempt: attemptResult
                        };
                        break;
                    }
                }
            }
            
            // Final status if not resolved
            if (!session.resolved) {
                session.status = 'failed';
                session.finalResult = {
                    reason: `Maximum attempts (${this.config.maxAttempts}) exceeded`,
                    lastAttempt: session.attempts[session.attempts.length - 1]
                };
                
                // Learn from failure
                if (this.config.enableLearning) {
                    this.learnFromFailure(session);
                }
            }
            
        } catch (error) {
            session.status = 'error';
            session.finalResult = {
                reason: 'Self-debugging loop error',
                error: error.message,
                stack: error.stack
            };
            
            this.emit('session:error', { sessionId, session, error });
        }
        
        session.endTime = new Date().toISOString();
        session.duration = this.calculateDuration(session.startTime, session.endTime);
        
        // Store in history
        this.attemptHistory.push({
            sessionId: session.id,
            startTime: session.startTime,
            endTime: session.endTime,
            duration: session.duration,
            status: session.status,
            attempts: session.attempts.length,
            resolved: session.resolved,
            taskDescription: session.taskDescription
        });
        
        // Clean up active session
        this.activeSessions.delete(sessionId);
        
        // Save learned strategies
        if (this.config.enableLearning) {
            this.saveLearnedStrategies();
        }
        
        this.emit('session:completed', { sessionId, session });
        
        return {
            sessionId,
            status: session.status,
            resolved: session.resolved,
            attempts: session.attempts,
            duration: session.duration,
            finalResult: session.finalResult,
            learnedLessons: session.learnedLessons
        };
    }

    /**
     * Execute a single debugging attempt
     * 
     * @param {Object} params - Attempt parameters
     * @returns {Promise<Object>} Attempt result
     */
    async executeAttempt(params) {
        const {
            session,
            attemptNumber,
            testFunction,
            visualVerifier,
            errorAnalyzer,
            previousAttempts
        } = params;
        
        const attemptStartTime = Date.now();
        const attempt = {
            number: attemptNumber,
            startTime: new Date().toISOString(),
            strategy: null,
            success: false,
            result: null,
            error: null,
            duration: 0,
            metrics: {},
            visualAnalysis: null,
            errorAnalysis: null
        };
        
        try {
            // Select strategy for this attempt
            const strategy = this.selectStrategy(session, attemptNumber, previousAttempts);
            attempt.strategy = strategy.name;
            session.strategies.add(strategy.name);
            
            // Apply strategy modifications
            const modifiedContext = await strategy.apply(session.context, attempt);
            
            // Execute test function with modified context
            const testResult = await testFunction(modifiedContext);
            
            // Record basic metrics
            attempt.duration = Date.now() - attemptStartTime;
            attempt.success = testResult.success;
            attempt.result = testResult.result;
            
            if (testResult.success) {
                attempt.metrics = testResult.metrics || {};
                
                // Perform visual verification if enabled
                if (this.config.enableVisualVerification && visualVerifier && testResult.screenshot) {
                    attempt.visualAnalysis = await visualVerifier.analyzeScreenshot({
                        filepath: testResult.screenshot,
                        expectedElements: session.expectedElements,
                        context: modifiedContext
                    });
                }
                
                this.emit('attempt:success', { 
                    sessionId: session.id, 
                    attemptNumber, 
                    result: attempt 
                });
                
            } else {
                attempt.error = testResult.error || new Error('Test failed without specific error');
                
                // Perform error analysis if enabled
                if (this.config.enableErrorAnalysis && errorAnalyzer) {
                    attempt.errorAnalysis = await errorAnalyzer.analyzeError({
                        error: attempt.error,
                        context: modifiedContext,
                        component: session.context.component || 'unknown'
                    });
                }
                
                this.emit('attempt:failed', { 
                    sessionId: session.id, 
                    attemptNumber, 
                    result: attempt 
                });
            }
            
        } catch (error) {
            attempt.error = error;
            attempt.duration = Date.now() - attemptStartTime;
            
            this.emit('attempt:error', { 
                sessionId: session.id, 
                attemptNumber, 
                error,
                result: attempt 
            });
        }
        
        return attempt;
    }

    /**
     * Analyze attempt failure and provide recommendations
     * 
     * @param {Object} attemptResult - Failed attempt result
     * @param {Object} session - Current session
     * @returns {Promise<Object>} Analysis results
     */
    async analyzeAttemptFailure(attemptResult, session) {
        const analysis = {
            shouldContinue: true,
            reason: null,
            recommendedStrategies: [],
            confidence: 0.5,
            patterns: [],
            nextStrategy: null
        };
        
        // Analyze error if available
        if (attemptResult.errorAnalysis) {
            analysis.patterns = attemptResult.errorAnalysis.patterns || [];
            analysis.recommendedStrategies = attemptResult.errorAnalysis.suggestions || [];
        }
        
        // Analyze visual issues if available
        if (attemptResult.visualAnalysis && !attemptResult.visualAnalysis.success) {
            analysis.visualIssues = attemptResult.visualAnalysis.issues || [];
        }
        
        // Determine if we should continue based on error type
        const errorType = this.classifyError(attemptResult.error);
        
        switch (errorType) {
            case 'timeout':
                analysis.shouldContinue = attemptResult.number < 3; // Allow up to 3 timeout attempts
                analysis.reason = attemptResult.number >= 3 ? 
                    'Multiple timeout failures suggest deeper issues' : null;
                analysis.recommendedStrategies.push('timeout_adjustment', 'retry_with_backoff');
                break;
                
            case 'element_not_found':
                analysis.shouldContinue = true;
                analysis.recommendedStrategies.push('selector_improvement', 'visual_verification');
                break;
                
            case 'navigation':
                analysis.shouldContinue = true;
                analysis.recommendedStrategies.push('navigation_optimization', 'retry_with_backoff');
                break;
                
            case 'authentication':
                analysis.shouldContinue = attemptResult.number < 2; // Only 2 auth attempts
                analysis.reason = attemptResult.number >= 2 ? 
                    'Authentication failures suggest credential issues' : null;
                analysis.recommendedStrategies.push('configuration_reset');
                break;
                
            case 'resource':
                analysis.shouldContinue = attemptResult.number < 2; // Only 2 resource attempts
                analysis.reason = attemptResult.number >= 2 ? 
                    'Resource issues require manual intervention' : null;
                analysis.recommendedStrategies.push('resource_optimization', 'configuration_reset');
                break;
                
            case 'network':
                analysis.shouldContinue = attemptResult.number < 3; // Allow up to 3 network attempts
                analysis.reason = attemptResult.number >= 3 ? 
                    'Persistent network issues indicate connectivity problems' : null;
                analysis.recommendedStrategies.push('retry_with_backoff', 'navigation_optimization');
                break;
                
            default:
                analysis.shouldContinue = attemptResult.number < this.config.maxAttempts;
                analysis.recommendedStrategies.push('error_pattern_fix', 'retry_with_backoff');
        }
        
        // Select next strategy based on recommendations
        if (analysis.recommendedStrategies.length > 0) {
            const strategyName = this.selectBestStrategy(
                analysis.recommendedStrategies, 
                session.strategies,
                attemptResult.number
            );
            analysis.nextStrategy = this.strategies[strategyName];
        }
        
        // Calculate confidence based on patterns and previous success
        analysis.confidence = this.calculateAnalysisConfidence(analysis, session);
        
        return analysis;
    }

    /**
     * Select strategy for the next attempt
     * 
     * @param {Array} recommendedStrategies - Recommended strategies
     * @param {Set} usedStrategies - Already used strategies
     * @param {number} attemptNumber - Current attempt number
     * @returns {string} Selected strategy name
     */
    selectBestStrategy(recommendedStrategies, usedStrategies, attemptNumber) {
        // Filter out already used strategies
        const availableStrategies = recommendedStrategies.filter(name => !usedStrategies.has(name));
        
        if (availableStrategies.length === 0) {
            // Fallback to least recently used strategy
            const allStrategies = Object.keys(this.strategies);
            const unusedStrategies = allStrategies.filter(name => !usedStrategies.has(name));
            return unusedStrategies.length > 0 ? unusedStrategies[0] : 'retry_with_backoff';
        }
        
        // Prioritize by learned success rates if available
        if (this.config.enableLearning && this.learnedStrategies.size > 0) {
            const strategyScores = availableStrategies.map(name => ({
                name,
                score: this.getStrategySuccessRate(name)
            }));
            
            strategyScores.sort((a, b) => b.score - a.score);
            return strategyScores[0].name;
        }
        
        // Default to first recommended strategy
        return availableStrategies[0];
    }

    /**
     * Select strategy for current attempt
     * 
     * @param {Object} session - Current session
     * @param {number} attemptNumber - Current attempt number
     * @param {Array} previousAttempts - Previous attempts
     * @returns {Object} Selected strategy
     */
    selectStrategy(session, attemptNumber, previousAttempts) {
        // For first attempt, use conservative strategy
        if (attemptNumber === 1) {
            return this.strategies.retry_with_backoff;
        }
        
        // Analyze previous failures
        const errorTypes = previousAttempts.map(attempt => 
            this.classifyError(attempt.error)
        );
        
        // Most common error type
        const errorFrequency = {};
        errorTypes.forEach(type => {
            errorFrequency[type] = (errorFrequency[type] || 0) + 1;
        });
        
        const mostCommonError = Object.keys(errorFrequency)
            .sort((a, b) => errorFrequency[b] - errorFrequency[a])[0];
        
        // Select strategy based on most common error
        switch (mostCommonError) {
            case 'timeout':
                return this.strategies.timeout_adjustment;
            case 'element_not_found':
                return this.strategies.selector_improvement;
            case 'navigation':
                return this.strategies.navigation_optimization;
            case 'authentication':
                return this.strategies.configuration_reset;
            case 'resource':
                return this.strategies.resource_optimization;
            case 'network':
                return this.strategies.retry_with_backoff;
            default:
                return this.strategies.error_pattern_fix;
        }
    }

    // Strategy implementation methods

    async applyTimeoutAdjustment(context, attempt) {
        const modifiedContext = { ...context };
        
        // Increase timeout values
        modifiedContext.timeout = (context.timeout || 30000) * (1 + attempt.number * 0.5);
        modifiedContext.waitTimeout = (context.waitTimeout || 5000) * (1 + attempt.number * 0.3);
        
        // Add explicit waits
        if (!modifiedContext.implicitWaits) {
            modifiedContext.implicitWaits = [];
        }
        
        modifiedContext.implicitWaits.push({
            type: 'before_action',
            duration: 1000 * attempt.number
        });
        
        return modifiedContext;
    }

    async applySelectorImprovement(context, attempt) {
        const modifiedContext = { ...context };
        
        // Improve selectors if available
        if (context.selectors) {
            modifiedContext.selectors = this.improveSelectors(context.selectors, attempt.number);
        }
        
        // Add wait conditions
        modifiedContext.waitForVisible = true;
        modifiedContext.waitForTimeout = (context.waitForTimeout || 5000) * (1 + attempt.number * 0.2);
        
        // Add retry logic for element finding
        modifiedContext.elementRetryCount = Math.min(attempt.number + 1, 3);
        
        return modifiedContext;
    }

    async applyRetryWithBackoff(context, attempt) {
        const modifiedContext = { ...context };
        
        // Calculate backoff delay
        const baseDelay = 1000;
        const maxDelay = 10000;
        const backoffDelay = Math.min(baseDelay * Math.pow(2, attempt.number - 1), maxDelay);
        
        modifiedContext.retryDelay = backoffDelay;
        modifiedContext.maxRetries = Math.max(3 - attempt.number, 1);
        
        // Add jitter to prevent thundering herd
        modifiedContext.jitter = Math.random() * 1000;
        
        return modifiedContext;
    }

    async applyNavigationOptimization(context, attempt) {
        const modifiedContext = { ...context };
        
        // Wait for navigation completion
        modifiedContext.waitForNavigation = true;
        modifiedContext.navigationTimeout = (context.navigationTimeout || 30000) * (1 + attempt.number * 0.3);
        
        // Wait for specific network conditions
        modifiedContext.waitForNetworkIdle = attempt.number > 1;
        modifiedContext.networkIdleTimeout = 2000;
        
        // Handle potential redirects
        modifiedContext.handleRedirects = true;
        modifiedContext.maxRedirects = 3;
        
        return modifiedContext;
    }

    async applyVisualVerification(context, attempt) {
        const modifiedContext = { ...context };
        
        // Enable visual verification
        modifiedContext.enableVisualVerification = true;
        modifiedContext.visualVerificationTimeout = 10000;
        
        // Add screenshot capture points
        if (!modifiedContext.screenshotPoints) {
            modifiedContext.screenshotPoints = [];
        }
        
        modifiedContext.screenshotPoints.push({
            type: 'before_action',
            description: `Screenshot before action (attempt ${attempt.number})`
        });
        
        modifiedContext.screenshotPoints.push({
            type: 'after_action',
            description: `Screenshot after action (attempt ${attempt.number})`
        });
        
        return modifiedContext;
    }

    async applyErrorPatternFix(context, attempt) {
        const modifiedContext = { ...context };
        
        // Apply common fixes based on previous errors
        if (attempt.previousErrors) {
            const errorPatterns = this.analyzeErrorPatterns(attempt.previousErrors);
            
            if (errorPatterns.hasTimeout) {
                modifiedContext.timeout = (modifiedContext.timeout || 30000) * 1.5;
            }
            
            if (errorPatterns.hasSelectorIssues) {
                modifiedContext.useRobustSelectors = true;
                modifiedContext.waitForStableElements = true;
            }
            
            if (errorPatterns.hasNavigationIssues) {
                modifiedContext.waitForPageLoad = true;
                modifiedContext.pageLoadTimeout = 15000;
            }
        }
        
        return modifiedContext;
    }

    async applyResourceOptimization(context, attempt) {
        const modifiedContext = { ...context };
        
        // Optimize resource usage
        modifiedContext.concurrency = 1; // Reduce concurrency
        modifiedContext.memoryLimit = 'low'; // Use less memory
        modifiedContext.cpuPriority = 'low'; // Lower CPU priority
        
        // Add garbage collection hints
        modifiedContext.forceGC = attempt.number > 2;
        
        return modifiedContext;
    }

    async applyConfigurationReset(context, attempt) {
        const modifiedContext = { ...context };
        
        // Reset to known good configuration
        modifiedContext.resetConfiguration = true;
        modifiedContext.useDefaultTimeouts = true;
        modifiedContext.useDefaultSelectors = true;
        modifiedContext.disableOptimizations = true;
        
        // Clear any custom settings that might cause issues
        delete modifiedContext.customTimeouts;
        delete modifiedContext.customSelectors;
        delete modifiedContext.customWaits;
        
        return modifiedContext;
    }

    // Helper methods

    async initializeDataDirectory() {
        const fs = require('fs').promises;
        const path = require('path');
        
        try {
            await fs.access(this.config.dataDir);
        } catch {
            await fs.mkdir(this.config.dataDir, { recursive: true });
        }
    }

    generateSessionId() {
        return `debug_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    }

    calculateDuration(startTime, endTime) {
        const start = new Date(startTime);
        const end = new Date(endTime);
        return (end - start) / 1000; // Duration in seconds
    }

    classifyError(error) {
        if (!error) return 'unknown';
        
        const message = error.message ? error.message.toLowerCase() : '';
        
        if (message.includes('timeout') || message.includes('time out')) {
            return 'timeout';
        } else if (message.includes('not found') || message.includes('selector')) {
            return 'element_not_found';
        } else if (message.includes('navigation') || message.includes('redirect')) {
            return 'navigation';
        } else if (message.includes('auth') || message.includes('login')) {
            return 'authentication';
        } else if (message.includes('memory') || message.includes('resource')) {
            return 'resource';
        } else if (message.includes('network') || message.includes('connection')) {
            return 'network';
        }
        
        return 'unknown';
    }

    improveSelectors(selectors, attemptNumber) {
        const improved = {};
        
        Object.keys(selectors).forEach(key => {
            const selector = selectors[key];
            
            // Add more specific selectors
            if (attemptNumber === 1) {
                improved[key] = `${selector}, ${selector}:visible`;
            } else if (attemptNumber === 2) {
                improved[key] = `${selector}, ${selector}:not([disabled]), ${selector}[data-ready]`;
            } else {
                // Use XPath as fallback
                improved[key] = `xpath=.//*[contains(@class, '${selector.replace('.', '')}')]`;
            }
        });
        
        return improved;
    }

    analyzeErrorPatterns(errors) {
        const patterns = {
            hasTimeout: false,
            hasSelectorIssues: false,
            hasNavigationIssues: false,
            hasAuthenticationIssues: false
        };
        
        errors.forEach(error => {
            const type = this.classifyError(error);
            switch (type) {
                case 'timeout':
                    patterns.hasTimeout = true;
                    break;
                case 'element_not_found':
                    patterns.hasSelectorIssues = true;
                    break;
                case 'navigation':
                    patterns.hasNavigationIssues = true;
                    break;
                case 'authentication':
                    patterns.hasAuthenticationIssues = true;
                    break;
            }
        });
        
        return patterns;
    }

    calculateAnalysisConfidence(analysis, session) {
        let confidence = 0.5; // Base confidence
        
        // Increase confidence based on patterns
        if (analysis.patterns && analysis.patterns.length > 0) {
            confidence += 0.2;
        }
        
        // Increase confidence based on visual analysis
        if (analysis.visualIssues && analysis.visualIssues.length > 0) {
            confidence += 0.2;
        }
        
        // Decrease confidence for repeated errors
        const errorTypes = session.attempts.map(attempt => this.classifyError(attempt.error));
        const uniqueErrorTypes = new Set(errorTypes);
        if (uniqueErrorTypes.size < errorTypes.length / 2) {
            confidence -= 0.2;
        }
        
        return Math.max(0, Math.min(1, confidence));
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Learning methods

    async learnFromSuccess(session, successfulAttempt) {
        const strategyName = successfulAttempt.strategy;
        
        if (!this.learnedStrategies.has(strategyName)) {
            this.learnedStrategies.set(strategyName, {
                successes: 0,
                failures: 0,
                lastUsed: new Date().toISOString()
            });
        }
        
        const strategy = this.learnedStrategies.get(strategyName);
        strategy.successes++;
        strategy.lastUsed = new Date().toISOString();
        
        // Learn from context modifications that worked
        if (successfulAttempt.contextModifications) {
            strategy.successfulModifications = strategy.successfulModifications || [];
            strategy.successfulModifications.push(successfulAttempt.contextModifications);
        }
    }

    async learnFromFailure(session) {
        // Learn which strategies failed
        session.strategies.forEach(strategyName => {
            if (!this.learnedStrategies.has(strategyName)) {
                this.learnedStrategies.set(strategyName, {
                    successes: 0,
                    failures: 0,
                    lastUsed: new Date().toISOString()
                });
            }
            
            const strategy = this.learnedStrategies.get(strategyName);
            strategy.failures++;
        });
    }

    getStrategySuccessRate(strategyName) {
        const strategy = this.learnedStrategies.get(strategyName);
        if (!strategy || (strategy.successes + strategy.failures) === 0) {
            return 0.5; // Default confidence
        }
        
        return strategy.successes / (strategy.successes + strategy.failures);
    }

    async loadLearnedStrategies() {
        const fs = require('fs').promises;
        const path = require('path');
        
        try {
            const dataPath = path.join(this.config.dataDir, 'learned-strategies.json');
            const data = await fs.readFile(dataPath, 'utf8');
            const learned = JSON.parse(data);
            
            // Convert to Map
            Object.keys(learned).forEach(key => {
                this.learnedStrategies.set(key, learned[key]);
            });
            
        } catch {
            // File doesn't exist or is invalid
            console.log('No learned strategies found, starting fresh');
        }
    }

    async saveLearnedStrategies() {
        const fs = require('fs').promises;
        const path = require('path');
        
        try {
            const dataPath = path.join(this.config.dataDir, 'learned-strategies.json');
            const learnedObject = Object.fromEntries(this.learnedStrategies);
            await fs.writeFile(dataPath, JSON.stringify(learnedObject, null, 2));
            
        } catch (error) {
            console.error('Failed to save learned strategies:', error);
        }
    }

    /**
     * Get debugging statistics
     * 
     * @returns {Object} Debugging statistics
     */
    getStatistics() {
        const totalSessions = this.attemptHistory.length;
        const successfulSessions = this.attemptHistory.filter(s => s.resolved).length;
        const averageAttempts = totalSessions > 0 ? 
            this.attemptHistory.reduce((sum, s) => sum + s.attempts, 0) / totalSessions : 0;
        
        return {
            totalSessions,
            successfulSessions,
            successRate: totalSessions > 0 ? (successfulSessions / totalSessions) * 100 : 0,
            averageAttempts,
            activeSessions: this.activeSessions.size,
            learnedStrategies: this.learnedStrategies.size,
            mostUsedStrategies: this.getMostUsedStrategies()
        };
    }

    getMostUsedStrategies() {
        const strategyCounts = {};
        
        this.attemptHistory.forEach(session => {
            session.attempts.forEach(attempt => {
                if (attempt.strategy) {
                    strategyCounts[attempt.strategy] = (strategyCounts[attempt.strategy] || 0) + 1;
                }
            });
        });
        
        return Object.keys(strategyCounts)
            .sort((a, b) => strategyCounts[b] - strategyCounts[a])
            .slice(0, 5)
            .map(name => ({ name, count: strategyCounts[name] }));
    }
}

module.exports = SelfDebuggingLoop;