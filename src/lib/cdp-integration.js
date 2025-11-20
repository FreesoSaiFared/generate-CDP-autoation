/**
 * CDP Automation Integration
 * 
 * This module provides integration between the debugging infrastructure
 * and the existing CDP automation system. It demonstrates how to seamlessly
 * incorporate debugging capabilities into automation workflows.
 */

const DebugIntegration = require('./debug-integration');
const EventEmitter = require('events');

class CDPIntegration extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = {
            enableDebugging: options.enableDebugging !== false,
            enableVisualVerification: options.enableVisualVerification !== false,
            enablePerformanceMonitoring: options.enablePerformanceMonitoring !== false,
            enableSelfDebugging: options.enableSelfDebugging !== false,
            autoStart: options.autoStart !== false,
            debugOnFailure: options.debugOnFailure !== false,
            debugOnSuccess: options.debugOnSuccess !== false,
            sessionId: options.sessionId || null,
            ...options
        };
        
        // Initialize debug integration
        this.debugIntegration = new DebugIntegration({
            autoStart: this.config.autoStart,
            enableMonitoring: this.config.enablePerformanceMonitoring,
            enableAlerting: true
        });
        
        // Current debug session
        this.currentSession = null;
        
        // Integration state
        this.state = {
            initialized: false,
            debuggingEnabled: this.config.enableDebugging,
            activeAutomations: new Map(),
            errorCount: 0,
            successCount: 0
        };
        
        // Set up event listeners
        this.setupEventListeners();
    }

    /**
     * Initialize the CDP integration
     * 
     * @param {Object} options - Initialization options
     * @returns {Promise<Object>} Initialization results
     */
    async initialize(options = {}) {
        if (this.state.initialized) {
            return {
                success: true,
                message: 'Already initialized'
            };
        }
        
        try {
            // Initialize debug integration
            await this.debugIntegration.initialize();
            
            // Create initial debug session if enabled
            if (this.config.enableDebugging) {
                this.currentSession = await this.debugIntegration.createDebugSession({
                    sessionId: this.config.sessionId,
                    enableVisualVerification: this.config.enableVisualVerification,
                    enablePerformanceMonitoring: this.config.enablePerformanceMonitoring,
                    enableErrorAnalysis: true
                });
            }
            
            this.state.initialized = true;
            
            this.emit('integration:initialized', {
                sessionId: this.currentSession?.id,
                debuggingEnabled: this.state.debuggingEnabled
            });
            
            return {
                success: true,
                sessionId: this.currentSession?.id,
                debuggingEnabled: this.state.debuggingEnabled
            };
            
        } catch (error) {
            this.emit('integration:error', { type: 'initialization', error });
            throw error;
        }
    }

    /**
     * Execute CDP automation with debugging
     * 
     * @param {Function} automationFunction - The automation function to execute
     * @param {Object} options - Execution options
     * @returns {Promise<Object>} Execution results
     */
    async executeWithDebugging(automationFunction, options = {}) {
        const {
            automationId = this.generateAutomationId(),
            enableSelfDebugging = this.config.enableSelfDebugging,
            enableVisualVerification = this.config.enableVisualVerification,
            enablePerformanceMonitoring = this.config.enablePerformanceMonitoring,
            timeout = options.timeout || 30000,
            retries = options.retries || 0
        } = options;
        
        if (!this.state.initialized) {
            await this.initialize();
        }
        
        const startTime = Date.now();
        let result = null;
        let error = null;
        let attempts = 0;
        
        // Track automation
        this.state.activeAutomations.set(automationId, {
            startTime,
            status: 'running',
            options
        });
        
        try {
            // Pre-execution setup
            if (this.config.enableDebugging && this.currentSession) {
                await this.setupDebuggingForAutomation(automationId, options);
            }
            
            // Execute automation with retries
            do {
                attempts++;
                
                try {
                    // Execute the automation function
                    result = await this.executeAutomation(
                        automationFunction, 
                        automationId, 
                        attempts,
                        options
                    );
                    
                    // Success - break retry loop
                    break;
                    
                } catch (executionError) {
                    error = executionError;
                    
                    // Handle debugging on failure
                    if (this.config.debugOnFailure && this.config.enableDebugging) {
                        await this.handleDebuggingOnFailure(
                            automationId, 
                            executionError, 
                            attempts,
                            options
                        );
                    }
                    
                    // If self-debugging is enabled, try to fix the issue
                    if (enableSelfDebugging && attempts < retries + 1) {
                        const debugResult = await this.attemptSelfDebugging(
                            automationId,
                            executionError,
                            attempts,
                            options
                        );
                        
                        if (debugResult.fixed) {
                            continue; // Retry with the fix
                        }
                    }
                    
                    // If this is the last attempt, throw the error
                    if (attempts > retries) {
                        throw executionError;
                    }
                    
                    // Wait before retry
                    await this.delay(1000 * attempts);
                }
                
            } while (attempts <= retries);
            
            // Post-execution processing
            if (this.config.enableDebugging && this.currentSession) {
                await this.processDebuggingOnSuccess(
                    automationId,
                    result,
                    options
                );
            }
            
            // Update statistics
            this.state.successCount++;
            
            const executionResult = {
                automationId,
                success: true,
                result,
                attempts,
                duration: Date.now() - startTime,
                timestamp: new Date().toISOString()
            };
            
            this.emit('automation:completed', executionResult);
            
            return executionResult;
            
        } catch (executionError) {
            // Update statistics
            this.state.errorCount++;
            
            const errorResult = {
                automationId,
                success: false,
                error: executionError.message,
                stack: executionError.stack,
                attempts,
                duration: Date.now() - startTime,
                timestamp: new Date().toISOString()
            };
            
            this.emit('automation:failed', errorResult);
            
            throw errorResult;
            
        } finally {
            // Clean up automation tracking
            this.state.activeAutomations.delete(automationId);
        }
    }

    /**
     * Setup debugging for automation execution
     * 
     * @param {string} automationId - Automation ID
     * @param {Object} options - Execution options
     * @returns {Promise<void>}
     */
    async setupDebuggingForAutomation(automationId, options) {
        try {
            // Start performance monitoring
            if (this.config.enablePerformanceMonitoring && this.debugIntegration.components.performanceMonitor) {
                await this.debugIntegration.components.performanceMonitor.startMonitoring(automationId);
            }
            
            // Take initial screenshot if visual verification is enabled
            if (this.config.enableVisualVerification && this.debugIntegration.components.visualVerifier) {
                // This would normally capture a real screenshot
                // For now, we'll log the intent
                this.debugIntegration.components.logger?.info(
                    `Visual verification setup for automation ${automationId}`,
                    { automationId, options }
                );
            }
            
        } catch (error) {
            this.emit('debugging:setup_error', { automationId, error });
        }
    }

    /**
     * Execute the automation function with monitoring
     * 
     * @param {Function} automationFunction - Function to execute
     * @param {string} automationId - Automation ID
     * @param {number} attempt - Attempt number
     * @param {Object} options - Execution options
     * @returns {Promise<any>} Execution result
     */
    async executeAutomation(automationFunction, automationId, attempt, options) {
        const startTime = Date.now();
        
        try {
            // Log execution start
            this.debugIntegration.components.logger?.info(
                `Executing automation ${automationId} (attempt ${attempt})`,
                { automationId, attempt, options }
            );
            
            // Execute the function
            const result = await automationFunction({
                automationId,
                attempt,
                debugIntegration: this.debugIntegration,
                logger: this.debugIntegration.components.logger,
                ...options
            });
            
            const duration = Date.now() - startTime;
            
            // Log execution success
            this.debugIntegration.components.logger?.info(
                `Automation ${automationId} completed successfully (attempt ${attempt})`,
                { automationId, attempt, duration, result }
            );
            
            return result;
            
        } catch (error) {
            const duration = Date.now() - startTime;
            
            // Log execution error
            this.debugIntegration.components.logger?.error(
                `Automation ${automationId} failed (attempt ${attempt})`,
                { automationId, attempt, duration, error: error.message }
            );
            
            throw error;
        }
    }

    /**
     * Handle debugging when automation fails
     * 
     * @param {string} automationId - Automation ID
     * @param {Error} error - The error that occurred
     * @param {number} attempt - Attempt number
     * @param {Object} options - Execution options
     * @returns {Promise<void>}
     */
    async handleDebuggingOnFailure(automationId, error, attempt, options) {
        try {
            // Capture error details
            const errorDetails = {
                automationId,
                attempt,
                error: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            };
            
            // Analyze error
            if (this.debugIntegration.components.errorAnalyzer) {
                const analysis = await this.debugIntegration.components.errorAnalyzer.analyzeError(errorDetails);
                this.debugIntegration.components.logger?.warn(
                    `Error analysis for automation ${automationId}`,
                    { automationId, analysis }
                );
            }
            
            // Capture screenshot for visual analysis
            if (this.config.enableVisualVerification && this.debugIntegration.components.visualVerifier) {
                // This would normally capture a real screenshot
                this.debugIntegration.components.logger?.info(
                    `Capturing failure screenshot for automation ${automationId}`,
                    { automationId, attempt }
                );
            }
            
            // Run diagnostics
            if (this.debugIntegration.components.diagnosticTools) {
                const diagnostics = await this.debugIntegration.components.diagnosticTools.runQuickDiagnostics();
                this.debugIntegration.components.logger?.info(
                    `Diagnostics for automation ${automationId} failure`,
                    { automationId, diagnostics }
                );
            }
            
        } catch (debugError) {
            this.emit('debugging:failure_error', { 
                automationId, 
                originalError: error, 
                debugError 
            });
        }
    }

    /**
     * Attempt self-debugging to fix the issue
     * 
     * @param {string} automationId - Automation ID
     * @param {Error} error - The error that occurred
     * @param {number} attempt - Attempt number
     * @param {Object} options - Execution options
     * @returns {Promise<Object>} Self-debugging result
     */
    async attemptSelfDebugging(automationId, error, attempt, options) {
        try {
            if (!this.debugIntegration.components.selfDebuggingLoop) {
                return { fixed: false, reason: 'Self-debugging not available' };
            }
            
            const debugResult = await this.debugIntegration.components.selfDebuggingLoop.executeSelfDebugging({
                sessionId: this.currentSession?.id,
                error: error.message,
                context: {
                    automationId,
                    attempt,
                    options
                },
                maxAttempts: 1, // Single attempt for self-debugging
                strategy: 'adaptive'
            });
            
            return {
                fixed: debugResult.success,
                reason: debugResult.success ? 'Issue resolved by self-debugging' : 'Self-debugging failed',
                solutions: debugResult.solutionsApplied || []
            };
            
        } catch (debugError) {
            return {
                fixed: false,
                reason: `Self-debugging error: ${debugError.message}`
            };
        }
    }

    /**
     * Process debugging on successful automation
     * 
     * @param {string} automationId - Automation ID
     * @param {any} result - Automation result
     * @param {Object} options - Execution options
     * @returns {Promise<void>}
     */
    async processDebuggingOnSuccess(automationId, result, options) {
        try {
            // Stop performance monitoring
            if (this.config.enablePerformanceMonitoring && this.debugIntegration.components.performanceMonitor) {
                const metrics = await this.debugIntegration.components.performanceMonitor.stopMonitoring(automationId);
                this.debugIntegration.components.logger?.info(
                    `Performance metrics for automation ${automationId}`,
                    { automationId, metrics }
                );
            }
            
            // Visual verification on success
            if (this.config.enableVisualVerification && this.debugIntegration.components.visualVerifier) {
                // This would normally capture and analyze a screenshot
                this.debugIntegration.components.logger?.info(
                    `Visual verification for successful automation ${automationId}`,
                    { automationId }
                );
            }
            
            // Log success metrics
            this.debugIntegration.components.logger?.info(
                `Automation ${automationId} completed with debugging`,
                { automationId, success: true, result }
            );
            
        } catch (error) {
            this.emit('debugging:success_error', { automationId, error });
        }
    }

    /**
     * Get integration status
     * 
     * @returns {Object>} Integration status
     */
    getStatus() {
        return {
            state: this.state,
            config: this.config,
            currentSession: this.currentSession?.id,
            debugStatus: this.debugIntegration.getStatus(),
            statistics: {
                totalAutomations: this.state.successCount + this.state.errorCount,
                successCount: this.state.successCount,
                errorCount: this.state.errorCount,
                successRate: this.state.successCount + this.state.errorCount > 0 ? 
                    (this.state.successCount / (this.state.successCount + this.state.errorCount) * 100).toFixed(2) + '%' : 
                    '0%',
                activeAutomations: this.state.activeAutomations.size
            }
        };
    }

    /**
     * Generate comprehensive report
     * 
     * @param {Object} options - Report options
     * @returns {Promise<Object>} Generated report
     */
    async generateReport(options = {}) {
        if (!this.currentSession) {
            throw new Error('No active debug session');
        }
        
        return await this.debugIntegration.generateSessionReport(
            this.currentSession.id,
            {
                includeScreenshots: this.config.enableVisualVerification,
                includeMetrics: this.config.enablePerformanceMonitoring,
                includeErrors: true,
                ...options
            }
        );
    }

    /**
     * Shutdown the integration
     * 
     * @returns {Promise<Object>} Shutdown results
     */
    async shutdown() {
        try {
            // Close current debug session
            if (this.currentSession) {
                await this.debugIntegration.closeDebugSession(this.currentSession.id, {
                    generateReport: true
                });
            }
            
            // Stop debug integration
            await this.debugIntegration.stop();
            
            this.state.initialized = false;
            
            this.emit('integration:shutdown', {
                sessionId: this.currentSession?.id,
                statistics: {
                    totalAutomations: this.state.successCount + this.state.errorCount,
                    successCount: this.state.successCount,
                    errorCount: this.state.errorCount
                }
            });
            
            return {
                success: true,
                message: 'Integration shutdown successfully'
            };
            
        } catch (error) {
            this.emit('integration:error', { type: 'shutdown', error });
            throw error;
        }
    }

    // Private helper methods

    setupEventListeners() {
        // Forward debug integration events
        this.debugIntegration.on('error', (error) => {
            this.emit('debug:error', error);
        });
        
        this.debugIntegration.on('session:created', (data) => {
            this.emit('debug:session_created', data);
        });
        
        this.debugIntegration.on('session:closed', (data) => {
            this.emit('debug:session_closed', data);
        });
    }

    generateAutomationId() {
        return `automation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = CDPIntegration;