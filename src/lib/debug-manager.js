/**
 * Debug Manager - Centralized Debugging System with GLM-4.5V Integration
 * 
 * This module provides comprehensive debugging capabilities for the entire automation
 * platform, including visual verification, error detection, and self-debugging loops.
 * 
 * Features:
 * - Centralized debugging orchestration
 * - GLM-4.5V integration for visual verification
 * - Screenshot capture and analysis
 * - Error detection and diagnosis
 * - Self-debugging loop implementation (5-attempt limit)
 * - Debug report generation
 * - Integration with all system components
 */

const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');
const crypto = require('crypto');

class DebugManager extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = {
            debugDir: options.debugDir || path.join(process.cwd(), 'debug'),
            screenshotDir: options.screenshotDir || path.join(process.cwd(), 'debug', 'screenshots'),
            reportsDir: options.reportsDir || path.join(process.cwd(), 'debug', 'reports'),
            maxDebugAttempts: options.maxDebugAttempts || 5,
            autoScreenshot: options.autoScreenshot !== false,
            visualVerification: options.visualVerification !== false,
            selfDebugging: options.selfDebugging !== false,
            glmApiKey: options.glmApiKey || process.env.GLM_API_KEY,
            glmEndpoint: options.glmEndpoint || 'https://api.openai.com/v1/chat/completions'
        };
        
        // Debug state
        this.activeSessions = new Map();
        this.debugHistory = [];
        this.errorPatterns = new Map();
        this.visualVerifier = null;
        this.logger = null;
        
        // Initialize directories
        this.initializeDirectories();
        
        // Load debug history
        this.loadDebugHistory();
    }

    /**
     * Initialize a debug session for automation
     * 
     * @param {Object} params - Session parameters
     * @param {string} params.sessionId - Unique session identifier
     * @param {string} params.taskDescription - Description of the task being debugged
     * @param {string} params.modality - Automation modality being used
     * @param {Object} params.context - Additional context information
     * @returns {Promise<Object>} Debug session object
     */
    async initializeDebugSession(params) {
        const {
            sessionId,
            taskDescription,
            modality,
            context = {}
        } = params;
        
        const debugSession = {
            id: sessionId || this.generateSessionId(),
            startTime: new Date().toISOString(),
            taskDescription,
            modality,
            context,
            status: 'active',
            attempts: 0,
            screenshots: [],
            errors: [],
            diagnoses: [],
            fixes: [],
            resolved: false,
            metadata: {
                browserInfo: await this.getBrowserInfo(),
                systemInfo: await this.getSystemInfo(),
                environment: process.env.NODE_ENV || 'development'
            }
        };
        
        // Store session
        this.activeSessions.set(debugSession.id, debugSession);
        
        // Emit session start
        this.emit('debug:session:started', debugSession);
        
        // Log session start
        if (this.logger) {
            this.logger.info('Debug session started', {
                sessionId: debugSession.id,
                task: taskDescription,
                modality
            });
        }
        
        return debugSession;
    }

    /**
     * Capture and analyze screenshot for visual verification
     * 
     * @param {Object} params - Screenshot parameters
     * @param {string} params.sessionId - Debug session ID
     * @param {Object} params.page - Puppeteer page object
     * @param {string} params.label - Screenshot label/description
     * @param {Array} params.expectedElements - Elements expected to be visible
     * @returns {Promise<Object>} Screenshot analysis results
     */
    async captureAndAnalyzeScreenshot(params) {
        const {
            sessionId,
            page,
            label = 'screenshot',
            expectedElements = []
        } = params;
        
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            throw new Error(`Debug session not found: ${sessionId}`);
        }
        
        try {
            // Capture screenshot
            const timestamp = Date.now();
            const filename = `${sessionId}_${label}_${timestamp}.png`;
            const filepath = path.join(this.config.screenshotDir, filename);
            
            await page.screenshot({
                path: filepath,
                fullPage: true,
                type: 'png'
            });
            
            const screenshot = {
                id: this.generateScreenshotId(),
                timestamp: new Date().toISOString(),
                filename,
                filepath,
                label,
                expectedElements,
                analysis: null
            };
            
            // Perform visual verification if enabled
            if (this.config.visualVerification && this.visualVerifier) {
                screenshot.analysis = await this.visualVerifier.analyzeScreenshot({
                    filepath,
                    expectedElements,
                    context: session.context
                });
            }
            
            // Add to session
            session.screenshots.push(screenshot);
            
            // Emit screenshot event
            this.emit('debug:screenshot:captured', { sessionId, screenshot });
            
            return screenshot;
            
        } catch (error) {
            const errorInfo = {
                timestamp: new Date().toISOString(),
                type: 'screenshot_capture',
                message: error.message,
                stack: error.stack
            };
            
            session.errors.push(errorInfo);
            this.emit('debug:error', { sessionId, error: errorInfo });
            
            throw error;
        }
    }

    /**
     * Diagnose an error in the automation
     * 
     * @param {Object} params - Diagnosis parameters
     * @param {string} params.sessionId - Debug session ID
     * @param {Error} params.error - Error object to diagnose
     * @param {Object} params.context - Additional context for diagnosis
     * @returns {Promise<Object>} Diagnosis results
     */
    async diagnoseError(params) {
        const {
            sessionId,
            error,
            context = {}
        } = params;
        
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            throw new Error(`Debug session not found: ${sessionId}`);
        }
        
        const errorInfo = {
            id: this.generateErrorId(),
            timestamp: new Date().toISOString(),
            message: error.message,
            stack: error.stack,
            name: error.name,
            context
        };
        
        // Add error to session
        session.errors.push(errorInfo);
        
        // Perform diagnosis
        const diagnosis = await this.performErrorDiagnosis(errorInfo, session);
        
        // Add diagnosis to session
        session.diagnoses.push(diagnosis);
        
        // Update error patterns
        this.updateErrorPatterns(errorInfo, diagnosis);
        
        // Emit diagnosis event
        this.emit('debug:error:diagnosed', { sessionId, error: errorInfo, diagnosis });
        
        return diagnosis;
    }

    /**
     * Attempt to fix an issue automatically
     * 
     * @param {Object} params - Fix parameters
     * @param {string} params.sessionId - Debug session ID
     * @param {Object} params.diagnosis - Diagnosis results
     * @param {Object} params.context - Additional context
     * @returns {Promise<Object>} Fix attempt results
     */
    async attemptFix(params) {
        const {
            sessionId,
            diagnosis,
            context = {}
        } = params;
        
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            throw new Error(`Debug session not found: ${sessionId}`);
        }
        
        // Check attempt limit
        if (session.attempts >= this.config.maxDebugAttempts) {
            return {
                success: false,
                reason: 'Maximum debug attempts exceeded',
                attempts: session.attempts
            };
        }
        
        session.attempts++;
        
        const fixAttempt = {
            id: this.generateFixId(),
            timestamp: new Date().toISOString(),
            attemptNumber: session.attempts,
            diagnosisId: diagnosis.id,
            strategy: this.selectFixStrategy(diagnosis),
            implementation: null,
            result: null
        };
        
        try {
            // Implement fix based on strategy
            fixAttempt.implementation = await this.implementFix(fixAttempt.strategy, diagnosis, context);
            
            // Test the fix
            fixAttempt.result = await this.testFix(fixAttempt, session);
            
            // Add to session
            session.fixes.push(fixAttempt);
            
            // Emit fix event
            this.emit('debug:fix:attempted', { sessionId, fix: fixAttempt });
            
            return fixAttempt;
            
        } catch (error) {
            fixAttempt.result = {
                success: false,
                error: error.message,
                stack: error.stack
            };
            
            session.fixes.push(fixAttempt);
            this.emit('debug:fix:failed', { sessionId, fix: fixAttempt });
            
            return fixAttempt;
        }
    }

    /**
     * Run self-debugging loop for a session
     * 
     * @param {string} sessionId - Debug session ID
     * @param {Function} testFunction - Function to test the automation
     * @returns {Promise<Object>} Self-debugging results
     */
    async runSelfDebuggingLoop(sessionId, testFunction) {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            throw new Error(`Debug session not found: ${sessionId}`);
        }
        
        const debuggingResults = {
            sessionId,
            startTime: new Date().toISOString(),
            attempts: [],
            finalResult: null,
            success: false
        };
        
        for (let attempt = 1; attempt <= this.config.maxDebugAttempts; attempt++) {
            try {
                // Run test
                const testResult = await testFunction();
                
                if (testResult.success) {
                    debuggingResults.success = true;
                    debuggingResults.finalResult = testResult;
                    session.resolved = true;
                    session.status = 'resolved';
                    
                    this.emit('debug:self:success', { sessionId, attempt, result: testResult });
                    break;
                }
                
                // If test failed, diagnose and fix
                const error = new Error(testResult.error || 'Test failed without specific error');
                const diagnosis = await this.diagnoseError({ sessionId, error });
                const fixAttempt = await this.attemptFix({ sessionId, diagnosis });
                
                debuggingResults.attempts.push({
                    attemptNumber: attempt,
                    testResult,
                    diagnosis,
                    fixAttempt
                });
                
                this.emit('debug:self:iteration', { sessionId, attempt, results: debuggingResults.attempts[attempt - 1] });
                
            } catch (error) {
                debuggingResults.attempts.push({
                    attemptNumber: attempt,
                    error: error.message,
                    stack: error.stack
                });
                
                this.emit('debug:self:error', { sessionId, attempt, error });
            }
        }
        
        debuggingResults.endTime = new Date().toISOString();
        debuggingResults.duration = this.calculateDuration(debuggingResults.startTime, debuggingResults.endTime);
        
        // Generate debug report
        await this.generateDebugReport(session, debuggingResults);
        
        // Clean up session
        this.activeSessions.delete(sessionId);
        
        return debuggingResults;
    }

    /**
     * Generate comprehensive debug report
     * 
     * @param {Object} session - Debug session
     * @param {Object} results - Debugging results
     * @returns {Promise<string>} Path to generated report
     */
    async generateDebugReport(session, results) {
        const report = {
            sessionId: session.id,
            generatedAt: new Date().toISOString(),
            taskDescription: session.taskDescription,
            modality: session.modality,
            duration: results.duration,
            success: results.success,
            attempts: session.attempts,
            summary: {
                totalErrors: session.errors.length,
                totalScreenshots: session.screenshots.length,
                totalFixes: session.fixes.length,
                resolved: session.resolved
            },
            details: {
                errors: session.errors,
                screenshots: session.screenshots,
                diagnoses: session.diagnoses,
                fixes: session.fixes,
                attempts: results.attempts
            },
            analysis: {
                errorPatterns: this.analyzeErrorPatterns(session),
                performanceImpact: this.analyzePerformanceImpact(session),
                recommendations: this.generateRecommendations(session)
            },
            metadata: session.metadata
        };
        
        // Save report
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `debug_report_${session.id}_${timestamp}.json`;
        const filepath = path.join(this.config.reportsDir, filename);
        
        await fs.writeFile(filepath, JSON.stringify(report, null, 2));
        
        // Add to history
        this.debugHistory.push({
            sessionId: session.id,
            timestamp: new Date().toISOString(),
            reportPath: filepath,
            success: results.success
        });
        
        // Emit report generation event
        this.emit('debug:report:generated', { sessionId: session.id, reportPath: filepath });
        
        return filepath;
    }

    /**
     * Set visual verifier instance
     * 
     * @param {Object} visualVerifier - Visual verifier instance
     */
    setVisualVerifier(visualVerifier) {
        this.visualVerifier = visualVerifier;
    }

    /**
     * Set logger instance
     * 
     * @param {Object} logger - Logger instance
     */
    setLogger(logger) {
        this.logger = logger;
    }

    /**
     * Get debug session status
     * 
     * @param {string} sessionId - Session ID
     * @returns {Object|null>} Session status
     */
    getSessionStatus(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (!session) return null;
        
        return {
            id: session.id,
            status: session.status,
            attempts: session.attempts,
            errors: session.errors.length,
            screenshots: session.screenshots.length,
            resolved: session.resolved,
            duration: this.calculateDuration(session.startTime, new Date().toISOString())
        };
    }

    /**
     * Get all active sessions
     * 
     * @returns {Array} Array of active sessions
     */
    getActiveSessions() {
        return Array.from(this.activeSessions.values()).map(session => ({
            id: session.id,
            taskDescription: session.taskDescription,
            modality: session.modality,
            status: session.status,
            attempts: session.attempts,
            startTime: session.startTime,
            duration: this.calculateDuration(session.startTime, new Date().toISOString())
        }));
    }

    /**
     * Get debug statistics
     * 
     * @returns {Object} Debug statistics
     */
    getDebugStatistics() {
        const totalSessions = this.debugHistory.length;
        const successfulSessions = this.debugHistory.filter(h => h.success).length;
        const activeSessions = this.activeSessions.size;
        
        return {
            totalSessions,
            successfulSessions,
            successRate: totalSessions > 0 ? (successfulSessions / totalSessions) * 100 : 0,
            activeSessions,
            errorPatterns: Array.from(this.errorPatterns.entries()).map(([pattern, count]) => ({
                pattern,
                count
            })),
            averageAttempts: this.calculateAverageAttempts()
        };
    }

    // Private helper methods

    async initializeDirectories() {
        const dirs = [
            this.config.debugDir,
            this.config.screenshotDir,
            this.config.reportsDir
        ];
        
        for (const dir of dirs) {
            try {
                await fs.access(dir);
            } catch {
                await fs.mkdir(dir, { recursive: true });
            }
        }
    }

    async loadDebugHistory() {
        try {
            const historyFile = path.join(this.config.debugDir, 'debug_history.json');
            const data = await fs.readFile(historyFile, 'utf8');
            this.debugHistory = JSON.parse(data);
        } catch {
            this.debugHistory = [];
        }
    }

    async saveDebugHistory() {
        const historyFile = path.join(this.config.debugDir, 'debug_history.json');
        await fs.writeFile(historyFile, JSON.stringify(this.debugHistory, null, 2));
    }

    generateSessionId() {
        return `debug_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }

    generateScreenshotId() {
        return `ss_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }

    generateErrorId() {
        return `err_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }

    generateFixId() {
        return `fix_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }

    async getBrowserInfo() {
        // This would be implemented based on the browser automation framework being used
        return {
            userAgent: 'Chrome/XXX',
            version: 'XXX',
            platform: process.platform
        };
    }

    async getSystemInfo() {
        return {
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            memory: process.memoryUsage(),
            uptime: process.uptime()
        };
    }

    async performErrorDiagnosis(errorInfo, session) {
        const diagnosis = {
            id: this.generateDiagnosisId(),
            timestamp: new Date().toISOString(),
            errorId: errorInfo.id,
            category: this.categorizeError(errorInfo),
            severity: this.assessSeverity(errorInfo),
            likelyCause: this.identifyLikelyCause(errorInfo, session),
            suggestedFixes: this.suggestFixes(errorInfo, session),
            confidence: this.calculateDiagnosisConfidence(errorInfo, session)
        };
        
        return diagnosis;
    }

    categorizeError(error) {
        const message = error.message.toLowerCase();
        
        if (message.includes('timeout') || message.includes('time out')) {
            return 'timeout';
        } else if (message.includes('element not found') || message.includes('selector')) {
            return 'element_not_found';
        } else if (message.includes('network') || message.includes('connection')) {
            return 'network';
        } else if (message.includes('permission') || message.includes('access denied')) {
            return 'permission';
        } else if (message.includes('navigation') || message.includes('redirect')) {
            return 'navigation';
        } else {
            return 'unknown';
        }
    }

    assessSeverity(error) {
        const message = error.message.toLowerCase();
        
        if (message.includes('crash') || message.includes('fatal')) {
            return 'critical';
        } else if (message.includes('timeout') || message.includes('not found')) {
            return 'high';
        } else if (message.includes('warning') || message.includes('deprecated')) {
            return 'medium';
        } else {
            return 'low';
        }
    }

    identifyLikelyCause(error, session) {
        // This would use more sophisticated analysis in practice
        const category = this.categorizeError(error);
        const causes = {
            timeout: 'Element or page load took too long',
            element_not_found: 'Element selector is incorrect or element not loaded',
            network: 'Network connectivity issues or server problems',
            permission: 'Insufficient permissions or authentication issues',
            navigation: 'Unexpected navigation or redirect',
            unknown: 'Unknown cause - further investigation needed'
        };
        
        return causes[category] || causes.unknown;
    }

    suggestFixes(error, session) {
        const category = this.categorizeError(error);
        const fixes = {
            timeout: [
                'Increase timeout values',
                'Wait for specific elements before proceeding',
                'Check network connectivity'
            ],
            element_not_found: [
                'Verify element selector',
                'Wait for element to be visible',
                'Check if element is in an iframe'
            ],
            network: [
                'Check network connection',
                'Retry the request',
                'Use different network endpoint'
            ],
            permission: [
                'Check authentication status',
                'Verify required permissions',
                'Use different user credentials'
            ],
            navigation: [
                'Wait for navigation to complete',
                'Handle redirects properly',
                'Check for anti-bot measures'
            ]
        };
        
        return fixes[category] || ['Investigate error further'];
    }

    calculateDiagnosisConfidence(error, session) {
        // Simple confidence calculation - would be more sophisticated in practice
        let confidence = 0.5; // Base confidence
        
        const category = this.categorizeError(error);
        if (category !== 'unknown') {
            confidence += 0.2;
        }
        
        // Check if similar errors have been seen before
        const errorPattern = `${category}:${error.message.substring(0, 50)}`;
        if (this.errorPatterns.has(errorPattern)) {
            confidence += 0.3;
        }
        
        return Math.min(confidence, 1.0);
    }

    updateErrorPatterns(error, diagnosis) {
        const pattern = `${diagnosis.category}:${error.message.substring(0, 50)}`;
        this.errorPatterns.set(pattern, (this.errorPatterns.get(pattern) || 0) + 1);
    }

    selectFixStrategy(diagnosis) {
        const strategies = {
            timeout: 'increase_timeout',
            element_not_found: 'improve_selector',
            network: 'retry_request',
            permission: 'reauthenticate',
            navigation: 'handle_navigation',
            unknown: 'general_debugging'
        };
        
        return strategies[diagnosis.category] || strategies.unknown;
    }

    async implementFix(strategy, diagnosis, context) {
        const implementations = {
            increase_timeout: () => this.increaseTimeouts(context),
            improve_selector: () => this.improveSelectors(context),
            retry_request: () => this.setupRetry(context),
            reauthenticate: () => this.reauthenticate(context),
            handle_navigation: () => this.handleNavigation(context),
            general_debugging: () => this.generalDebugging(context)
        };
        
        const implementation = implementations[strategy];
        return implementation ? await implementation() : null;
    }

    async testFix(fixAttempt, session) {
        // This would implement actual fix testing
        // For now, return a placeholder result
        return {
            success: Math.random() > 0.5, // Random for demonstration
            message: 'Fix tested successfully',
            metrics: {
                executionTime: Math.random() * 1000,
                memoryUsage: process.memoryUsage()
            }
        };
    }

    // Fix implementation methods (placeholders - would be fully implemented)
    async increaseTimeouts(context) {
        return { action: 'increase_timeouts', newTimeout: 30000 };
    }

    async improveSelectors(context) {
        return { action: 'improve_selectors', strategy: 'wait_for_element' };
    }

    async setupRetry(context) {
        return { action: 'setup_retry', maxRetries: 3 };
    }

    async reauthenticate(context) {
        return { action: 'reauthenticate', method: 'refresh_token' };
    }

    async handleNavigation(context) {
        return { action: 'handle_navigation', waitFor: 'networkidle' };
    }

    async generalDebugging(context) {
        return { action: 'general_debugging', steps: ['log_state', 'capture_screenshot'] };
    }

    calculateDuration(startTime, endTime) {
        const start = new Date(startTime);
        const end = new Date(endTime);
        return (end - start) / 1000; // Duration in seconds
    }

    analyzeErrorPatterns(session) {
        const patterns = {};
        session.errors.forEach(error => {
            const category = this.categorizeError(error);
            patterns[category] = (patterns[category] || 0) + 1;
        });
        return patterns;
    }

    analyzePerformanceImpact(session) {
        return {
            totalDuration: this.calculateDuration(session.startTime, new Date().toISOString()),
            averageAttemptTime: session.attempts > 0 ? this.calculateDuration(session.startTime, new Date().toISOString()) / session.attempts : 0,
            resourceUsage: {
                screenshots: session.screenshots.length,
                diagnoses: session.diagnoses.length,
                fixes: session.fixes.length
            }
        };
    }

    generateRecommendations(session) {
        const recommendations = [];
        
        if (session.attempts >= this.config.maxDebugAttempts) {
            recommendations.push({
                type: 'process',
                priority: 'high',
                message: 'Consider increasing max debug attempts or improving error handling'
            });
        }
        
        const errorPatterns = this.analyzeErrorPatterns(session);
        Object.keys(errorPatterns).forEach(category => {
            if (errorPatterns[category] > 2) {
                recommendations.push({
                    type: 'prevention',
                    priority: 'medium',
                    message: `Multiple ${category} errors detected - consider preventive measures`
                });
            }
        });
        
        return recommendations;
    }

    calculateAverageAttempts() {
        if (this.debugHistory.length === 0) return 0;
        
        const totalAttempts = this.debugHistory.reduce((sum, session) => {
            return sum + (session.attempts || 1);
        }, 0);
        
        return totalAttempts / this.debugHistory.length;
    }

    generateDiagnosisId() {
        return `diag_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }
}

module.exports = DebugManager;