/**
 * Debug Integration Module
 * 
 * This module provides the main integration point for all debugging and logging
 * infrastructure components. It orchestrates the interaction between different
 * debugging tools and provides a unified interface for the automation platform.
 * 
 * Features:
 * - Centralized coordination of all debug components
 * - Unified API for debugging operations
 * - Component lifecycle management
 * - Event-driven communication between components
 * - Configuration synchronization
 * - Performance optimization
 * - Error handling and recovery
 * - Monitoring and alerting
 * - Debug session management
 */

const EventEmitter = require('events');
const path = require('path');
const fs = require('fs').promises;

// Import all debug components
const DebugManager = require('./debug-manager');
const Logger = require('./logger');
const VisualVerifier = require('./visual-verifier');
const DiagnosticTools = require('./diagnostic-tools');
const PerformanceMonitor = require('./performance-monitor');
const ErrorAnalyzer = require('./error-analyzer');
const DebugConfig = require('./debug-config');
const WebSocketServer = require('./websocket-server');
const SelfDebuggingLoop = require('./self-debugging-loop');
const DebugReportGenerator = require('./debug-report-generator');
const VisualRegressionTester = require('./visual-regression-tester');
const LogRotation = require('./log-rotation');

class DebugIntegration extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = {
            enableAll: options.enableAll !== false,
            components: {
                debugManager: options.debugManager !== false,
                logger: options.logger !== false,
                visualVerifier: options.visualVerifier !== false,
                diagnosticTools: options.diagnosticTools !== false,
                performanceMonitor: options.performanceMonitor !== false,
                errorAnalyzer: options.errorAnalyzer !== false,
                debugConfig: options.debugConfig !== false,
                webSocketServer: options.webSocketServer !== false,
                selfDebuggingLoop: options.selfDebuggingLoop !== false,
                debugReportGenerator: options.debugReportGenerator !== false,
                visualRegressionTester: options.visualRegressionTester !== false,
                logRotation: options.logRotation !== false
            },
            autoStart: options.autoStart !== false,
            enableMonitoring: options.enableMonitoring !== false,
            enableAlerting: options.enableAlerting !== false,
            logLevel: options.logLevel || 'info',
            configPath: options.configPath || path.join(process.cwd(), 'debug-config.json'),
            dataDir: options.dataDir || path.join(process.cwd(), 'debug-data'),
            ...options
        };
        
        // Component instances
        this.components = {};
        
        // Integration state
        this.state = {
            initialized: false,
            started: false,
            activeSessions: new Map(),
            metrics: {
                totalSessions: 0,
                activeSessions: 0,
                totalErrors: 0,
                totalReports: 0,
                uptime: 0
            },
            lastActivity: null
        };
        
        // Event handlers
        this.eventHandlers = new Map();
        
        // Initialize if auto-start is enabled
        if (this.config.autoStart) {
            this.initialize().catch(error => {
                this.emit('integration:error', { type: 'initialization', error });
            });
        }
    }

    /**
     * Initialize all debug components
     * 
     * @param {Object} options - Initialization options
     * @returns {Promise<Object>} Initialization results
     */
    async initialize(options = {}) {
        if (this.state.initialized) {
            return {
                success: true,
                message: 'Already initialized',
                components: Object.keys(this.components)
            };
        }
        
        try {
            const startTime = Date.now();
            const results = {
                timestamp: new Date().toISOString(),
                initialized: [],
                failed: [],
                warnings: [],
                duration: 0
            };
            
            // Ensure data directory exists
            await this.ensureDataDirectory();
            
            // Load configuration
            const config = await this.loadConfiguration();
            
            // Initialize components in dependency order
            const initOrder = [
                'debugConfig',
                'logger',
                'errorAnalyzer',
                'performanceMonitor',
                'diagnosticTools',
                'debugManager',
                'visualVerifier',
                'visualRegressionTester',
                'selfDebuggingLoop',
                'debugReportGenerator',
                'webSocketServer',
                'logRotation'
            ];
            
            for (const componentName of initOrder) {
                if (!this.config.components[componentName]) {
                    continue;
                }
                
                try {
                    await this.initializeComponent(componentName, config);
                    results.initialized.push(componentName);
                } catch (error) {
                    results.failed.push({
                        component: componentName,
                        error: error.message
                    });
                }
            }
            
            // Set up inter-component communication
            this.setupComponentCommunication();
            
            // Set up global error handling
            this.setupGlobalErrorHandling();
            
            // Update state
            this.state.initialized = true;
            this.state.lastActivity = new Date().toISOString();
            results.duration = Date.now() - startTime;
            
            // Emit initialization event
            this.emit('integration:initialized', results);
            
            return results;
            
        } catch (error) {
            this.emit('integration:error', { type: 'initialization', error });
            throw error;
        }
    }

    /**
     * Start all debug components
     * 
     * @param {Object} options - Start options
     * @returns {Promise<Object>} Start results
     */
    async start(options = {}) {
        if (!this.state.initialized) {
            await this.initialize();
        }
        
        if (this.state.started) {
            return {
                success: true,
                message: 'Already started',
                components: Object.keys(this.components)
            };
        }
        
        try {
            const startTime = Date.now();
            const results = {
                timestamp: new Date().toISOString(),
                started: [],
                failed: [],
                duration: 0
            };
            
            // Start components
            for (const [name, component] of Object.entries(this.components)) {
                try {
                    if (typeof component.start === 'function') {
                        await component.start();
                        results.started.push(name);
                    } else {
                        results.started.push(name); // Component doesn't need start
                    }
                } catch (error) {
                    results.failed.push({
                        component: name,
                        error: error.message
                    });
                }
            }
            
            // Update state
            this.state.started = true;
            this.state.metrics.uptime = Date.now();
            results.duration = Date.now() - startTime;
            
            // Start monitoring if enabled
            if (this.config.enableMonitoring) {
                this.startMonitoring();
            }
            
            // Emit start event
            this.emit('integration:started', results);
            
            return results;
            
        } catch (error) {
            this.emit('integration:error', { type: 'start', error });
            throw error;
        }
    }

    /**
     * Stop all debug components
     * 
     * @param {Object} options - Stop options
     * @returns {Promise<Object>} Stop results
     */
    async stop(options = {}) {
        if (!this.state.started) {
            return {
                success: true,
                message: 'Already stopped'
            };
        }
        
        try {
            const startTime = Date.now();
            const results = {
                timestamp: new Date().toISOString(),
                stopped: [],
                failed: [],
                duration: 0
            };
            
            // Stop components in reverse order
            const componentNames = Object.keys(this.components).reverse();
            
            for (const name of componentNames) {
                try {
                    const component = this.components[name];
                    if (typeof component.stop === 'function') {
                        await component.stop();
                        results.stopped.push(name);
                    } else {
                        results.stopped.push(name); // Component doesn't need stop
                    }
                } catch (error) {
                    results.failed.push({
                        component: name,
                        error: error.message
                    });
                }
            }
            
            // Update state
            this.state.started = false;
            results.duration = Date.now() - startTime;
            
            // Emit stop event
            this.emit('integration:stopped', results);
            
            return results;
            
        } catch (error) {
            this.emit('integration:error', { type: 'stop', error });
            throw error;
        }
    }

    /**
     * Create a new debug session
     * 
     * @param {Object} options - Session options
     * @returns {Promise<Object>} Session information
     */
    async createDebugSession(options = {}) {
        const sessionId = options.sessionId || this.generateSessionId();
        const session = {
            id: sessionId,
            startTime: new Date().toISOString(),
            endTime: null,
            status: 'active',
            config: options,
            logs: [],
            screenshots: [],
            errors: [],
            metrics: {},
            reports: []
        };
        
        // Store session
        this.state.activeSessions.set(sessionId, session);
        this.state.metrics.activeSessions++;
        this.state.metrics.totalSessions++;
        
        // Initialize session in components
        for (const [name, component] of Object.entries(this.components)) {
            if (typeof component.createSession === 'function') {
                try {
                    await component.createSession(sessionId, options);
                } catch (error) {
                    session.errors.push({
                        component: name,
                        error: error.message,
                        timestamp: new Date().toISOString()
                    });
                }
            }
        }
        
        // Emit session created event
        this.emit('session:created', { sessionId, session });
        
        return session;
    }

    /**
     * Close a debug session
     * 
     * @param {string} sessionId - Session ID
     * @param {Object} options - Close options
     * @returns {Promise<Object>} Close results
     */
    async closeDebugSession(sessionId, options = {}) {
        const session = this.state.activeSessions.get(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }
        
        try {
            // Update session
            session.endTime = new Date().toISOString();
            session.status = 'closed';
            
            // Generate final report if requested
            if (options.generateReport) {
                const report = await this.generateSessionReport(sessionId, options);
                session.reports.push(report);
            }
            
            // Close session in components
            for (const [name, component] of Object.entries(this.components)) {
                if (typeof component.closeSession === 'function') {
                    try {
                        await component.closeSession(sessionId, options);
                    } catch (error) {
                        session.errors.push({
                            component: name,
                            error: error.message,
                            timestamp: new Date().toISOString()
                        });
                    }
                }
            }
            
            // Move to inactive sessions
            this.state.activeSessions.delete(sessionId);
            this.state.metrics.activeSessions--;
            
            // Save session data
            await this.saveSessionData(session);
            
            // Emit session closed event
            this.emit('session:closed', { sessionId, session });
            
            return session;
            
        } catch (error) {
            this.emit('session:error', { sessionId, error });
            throw error;
        }
    }

    /**
     * Run comprehensive debugging
     * 
     * @param {Object} options - Debugging options
     * @returns {Promise<Object>} Debugging results
     */
    async runDebugging(options = {}) {
        const {
            sessionId = this.generateSessionId(),
            enableSelfDebugging = true,
            enableVisualVerification = true,
            enablePerformanceMonitoring = true,
            enableErrorAnalysis = true,
            enableDiagnostics = true
        } = options;
        
        try {
            // Create debug session
            const session = await this.createDebugSession({
                sessionId,
                ...options
            });
            
            const results = {
                sessionId,
                timestamp: new Date().toISOString(),
                steps: [],
                errors: [],
                success: false,
                duration: 0
            };
            
            const startTime = Date.now();
            
            // Step 1: Run diagnostics
            if (enableDiagnostics && this.components.diagnosticTools) {
                try {
                    const diagnostics = await this.components.diagnosticTools.runFullDiagnostics();
                    results.steps.push({
                        step: 'diagnostics',
                        success: true,
                        data: diagnostics
                    });
                } catch (error) {
                    results.errors.push({
                        step: 'diagnostics',
                        error: error.message
                    });
                }
            }
            
            // Step 2: Performance monitoring
            if (enablePerformanceMonitoring && this.components.performanceMonitor) {
                try {
                    const performance = await this.components.performanceMonitor.startMonitoring(sessionId);
                    results.steps.push({
                        step: 'performance',
                        success: true,
                        data: performance
                    });
                } catch (error) {
                    results.errors.push({
                        step: 'performance',
                        error: error.message
                    });
                }
            }
            
            // Step 3: Visual verification
            if (enableVisualVerification && this.components.visualVerifier) {
                try {
                    const visual = await this.components.visualVerifier.verifyVisualState(options);
                    results.steps.push({
                        step: 'visual',
                        success: true,
                        data: visual
                    });
                } catch (error) {
                    results.errors.push({
                        step: 'visual',
                        error: error.message
                    });
                }
            }
            
            // Step 4: Error analysis
            if (enableErrorAnalysis && this.components.errorAnalyzer) {
                try {
                    const analysis = await this.components.errorAnalyzer.analyzeErrors(sessionId);
                    results.steps.push({
                        step: 'error_analysis',
                        success: true,
                        data: analysis
                    });
                } catch (error) {
                    results.errors.push({
                        step: 'error_analysis',
                        error: error.message
                    });
                }
            }
            
            // Step 5: Self-debugging loop
            if (enableSelfDebugging && this.components.selfDebuggingLoop) {
                try {
                    const selfDebug = await this.components.selfDebuggingLoop.executeSelfDebugging(options);
                    results.steps.push({
                        step: 'self_debugging',
                        success: true,
                        data: selfDebug
                    });
                } catch (error) {
                    results.errors.push({
                        step: 'self_debugging',
                        error: error.message
                    });
                }
            }
            
            // Calculate overall success
            results.success = results.errors.length === 0;
            results.duration = Date.now() - startTime;
            
            // Close session
            await this.closeDebugSession(sessionId, {
                generateReport: true,
                includeSteps: true
            });
            
            // Emit debugging completed event
            this.emit('debugging:completed', results);
            
            return results;
            
        } catch (error) {
            this.emit('debugging:error', { sessionId, error });
            throw error;
        }
    }

    /**
     * Generate session report
     * 
     * @param {string} sessionId - Session ID
     * @param {Object} options - Report options
     * @returns {Promise<Object>} Generated report
     */
    async generateSessionReport(sessionId, options = {}) {
        const session = this.state.activeSessions.get(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }
        
        if (this.components.debugReportGenerator) {
            return await this.components.debugReportGenerator.generateReport(sessionId, {
                ...options,
                session
            });
        }
        
        // Fallback report generation
        return {
            sessionId,
            timestamp: new Date().toISOString(),
            session,
            summary: {
                duration: session.endTime ? 
                    new Date(session.endTime) - new Date(session.startTime) : 
                    Date.now() - new Date(session.startTime),
                errors: session.errors.length,
                screenshots: session.screenshots.length,
                logs: session.logs.length
            }
        };
    }

    /**
     * Get integration status
     * 
     * @returns {Object>} Integration status
     */
    getStatus() {
        return {
            state: this.state,
            components: Object.keys(this.components).reduce((acc, name) => {
                const component = this.components[name];
                acc[name] = {
                    initialized: !!component,
                    status: component?.status || 'unknown',
                    methods: component ? Object.getOwnPropertyNames(component) : []
                };
                return acc;
            }, {}),
            metrics: this.state.metrics,
            config: this.config
        };
    }

    // Private helper methods

    async initializeComponent(componentName, config) {
        const componentClass = this.getComponentClass(componentName);
        if (!componentClass) {
            throw new Error(`Unknown component: ${componentName}`);
        }
        
        const componentConfig = config[componentName] || {};
        const instance = new componentClass({
            ...componentConfig,
            integration: this
        });
        
        this.components[componentName] = instance;
        
        // Set up event listeners
        if (instance instanceof EventEmitter) {
            instance.on('error', (error) => {
                this.emit('component:error', { component: componentName, error });
            });
            
            instance.on('data', (data) => {
                this.emit('component:data', { component: componentName, data });
            });
        }
    }

    getComponentClass(componentName) {
        const componentMap = {
            debugManager: DebugManager,
            logger: Logger,
            visualVerifier: VisualVerifier,
            diagnosticTools: DiagnosticTools,
            performanceMonitor: PerformanceMonitor,
            errorAnalyzer: ErrorAnalyzer,
            debugConfig: DebugConfig,
            webSocketServer: WebSocketServer,
            selfDebuggingLoop: SelfDebuggingLoop,
            debugReportGenerator: DebugReportGenerator,
            visualRegressionTester: VisualRegressionTester,
            logRotation: LogRotation
        };
        
        return componentMap[componentName];
    }

    setupComponentCommunication() {
        // Set up event-based communication between components
        const eventMappings = [
            { from: 'logger', to: 'errorAnalyzer', event: 'log', handler: 'analyzeLog' },
            { from: 'performanceMonitor', to: 'errorAnalyzer', event: 'performance_alert', handler: 'analyzePerformanceIssue' },
            { from: 'visualVerifier', to: 'errorAnalyzer', event: 'visual_error', handler: 'analyzeVisualError' },
            { from: 'selfDebuggingLoop', to: 'debugReportGenerator', event: 'debugging_completed', handler: 'addDebuggingData' },
            { from: 'diagnosticTools', to: 'performanceMonitor', event: 'diagnostic_result', handler: 'updateMetrics' }
        ];
        
        for (const mapping of eventMappings) {
            const fromComponent = this.components[mapping.from];
            const toComponent = this.components[mapping.to];
            
            if (fromComponent && toComponent) {
                fromComponent.on(mapping.event, (data) => {
                    try {
                        toComponent[mapping.handler](data);
                    } catch (error) {
                        this.emit('communication:error', {
                            from: mapping.from,
                            to: mapping.to,
                            event: mapping.event,
                            error
                        });
                    }
                });
            }
        }
    }

    setupGlobalErrorHandling() {
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            this.emit('integration:error', { type: 'uncaught_exception', error });
            
            if (this.components.logger) {
                this.components.logger.error('Uncaught exception', { error });
            }
        });
        
        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            this.emit('integration:error', { type: 'unhandled_rejection', reason, promise });
            
            if (this.components.logger) {
                this.components.logger.error('Unhandled promise rejection', { reason, promise });
            }
        });
    }

    startMonitoring() {
        setInterval(() => {
            this.updateMetrics();
        }, 30000); // Update every 30 seconds
    }

    updateMetrics() {
        this.state.metrics.uptime = Date.now() - this.state.metrics.uptime;
        this.state.metrics.activeSessions = this.state.activeSessions.size;
        
        // Emit metrics update
        this.emit('metrics:updated', this.state.metrics);
    }

    async ensureDataDirectory() {
        try {
            await fs.access(this.config.dataDir);
        } catch {
            await fs.mkdir(this.config.dataDir, { recursive: true });
        }
    }

    async loadConfiguration() {
        try {
            const configData = await fs.readFile(this.config.configPath, 'utf8');
            return JSON.parse(configData);
        } catch {
            // Return default configuration
            return {};
        }
    }

    async saveSessionData(session) {
        const sessionPath = path.join(this.config.dataDir, `session-${session.id}.json`);
        try {
            await fs.writeFile(sessionPath, JSON.stringify(session, null, 2));
        } catch (error) {
            this.emit('session:error', { sessionId: session.id, error });
        }
    }

    generateSessionId() {
        return `debug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

module.exports = DebugIntegration;