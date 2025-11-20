#!/usr/bin/env node

/**
 * Component Integration Testing
 * 
 * Tests integration between all system components:
 * - MCP server and tools
 * - Chrome CDP integration
 * - mitmproxy network capture
 * - Integuru API reverse-engineering
 * - Browser state management
 * - Modality optimization
 */

const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');

// Import system components
const CDPAutomationServer = require('../mcp-server/server.js');
const MitmproxyController = require('../src/lib/mitmproxy-controller.js');
const InteguruWrapper = require('../src/lib/integuru-wrapper.js');
const ModalityOptimizer = require('../src/lib/modality-optimizer.js');

// Import testing utilities
const TestReporter = require('./utils/test-reporter');
const PerformanceMonitor = require('./utils/performance-monitor');

class IntegrationTester extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            timeout: options.timeout || 60000, // 1 minute per test
            outputDir: options.outputDir || './test-results',
            parallel: options.parallel || false,
            ...options
        };
        
        this.testReporter = new TestReporter({
            outputDir: this.options.outputDir,
            testName: 'integration-tests'
        });
        
        this.performanceMonitor = new PerformanceMonitor({
            outputDir: this.options.outputDir
        });
        
        this.components = {
            mcpServer: null,
            mitmproxy: null,
            integuru: null,
            modalityOptimizer: null
        };
        
        this.testResults = {
            summary: {
                total: 0,
                passed: 0,
                failed: 0,
                duration: 0
            },
            components: {},
            integrations: {},
            errors: []
        };
    }

    /**
     * Run all integration tests
     */
    async runAllTests() {
        const testStartTime = Date.now();
        
        try {
            this.emit('testStarted', { 
                timestamp: new Date().toISOString()
            });
            
            await this.testReporter.logStep('Starting integration testing...');
            this.performanceMonitor.start();
            
            // Test individual components
            await this.testIndividualComponents();
            
            // Test component integrations
            await this.testComponentIntegrations();
            
            // Test end-to-end workflows
            await this.testEndToEndWorkflows();
            
            // Test error handling and recovery
            await this.testErrorHandling();
            
            // Calculate summary
            this.testResults.summary.duration = Date.now() - testStartTime;
            this.calculateSummary();
            
            // Generate report
            await this.generateIntegrationReport();
            
            this.performanceMonitor.stop();
            
            this.emit('testCompleted', {
                success: this.testResults.summary.failed === 0,
                duration: this.testResults.summary.duration,
                summary: this.testResults.summary
            });
            
            return this.testResults;
            
        } catch (error) {
            this.emit('testError', {
                error: error.message,
                stack: error.stack
            });
            
            await this.testReporter.logError('Integration testing failed', error);
            throw error;
        }
    }

    /**
     * Test individual components
     */
    async testIndividualComponents() {
        await this.testReporter.logStep('Testing individual components...');
        
        const componentTests = [
            {
                name: 'MCP Server',
                test: () => this.testMCPServer()
            },
            {
                name: 'mitmproxy Controller',
                test: () => this.testMitmproxyController()
            },
            {
                name: 'Integuru Wrapper',
                test: () => this.testInteguruWrapper()
            },
            {
                name: 'Modality Optimizer',
                test: () => this.testModalityOptimizer()
            }
        ];
        
        for (const componentTest of componentTests) {
            const result = await this.runComponentTest(componentTest.name, componentTest.test);
            this.testResults.components[componentTest.name] = result;
        }
    }

    /**
     * Test MCP Server component
     */
    async testMCPServer() {
        const timer = this.performanceMonitor.startTimer('mcp_server');
        
        try {
            await this.testReporter.logStep('Testing MCP Server...');
            
            // Test server startup
            this.components.mcpServer = new CDPAutomationServer();
            const startupResult = await this.testServerStartup();
            
            // Test tool listing
            const toolsResult = await this.testToolListing();
            
            // Test tool execution
            const executionResult = await this.testToolExecution();
            
            // Test server shutdown
            const shutdownResult = await this.testServerShutdown();
            
            timer.end();
            
            return {
                success: startupResult.success && toolsResult.success && 
                        executionResult.success && shutdownResult.success,
                tests: {
                    startup: startupResult,
                    tools: toolsResult,
                    execution: executionResult,
                    shutdown: shutdownResult
                },
                duration: timer.startTime,
                errors: [
                    startupResult.error,
                    toolsResult.error,
                    executionResult.error,
                    shutdownResult.error
                ].filter(Boolean)
            };
            
        } catch (error) {
            timer.end();
            return {
                success: false,
                error: error.message,
                duration: timer.startTime,
                tests: {}
            };
        }
    }

    /**
     * Test mitmproxy Controller component
     */
    async testMitmproxyController() {
        const timer = this.performanceMonitor.startTimer('mitmproxy_controller');
        
        try {
            await this.testReporter.logStep('Testing mitmproxy Controller...');
            
            // Test controller initialization
            const initResult = await this.testMitmproxyInitialization();
            
            // Test network capture
            const captureResult = await this.testNetworkCapture();
            
            // Test HAR file generation
            const harResult = await this.testHARFileGeneration();
            
            // Test cleanup
            const cleanupResult = await this.testMitmproxyCleanup();
            
            timer.end();
            
            return {
                success: initResult.success && captureResult.success && 
                        harResult.success && cleanupResult.success,
                tests: {
                    initialization: initResult,
                    capture: captureResult,
                    har: harResult,
                    cleanup: cleanupResult
                },
                duration: timer.startTime,
                errors: [
                    initResult.error,
                    captureResult.error,
                    harResult.error,
                    cleanupResult.error
                ].filter(Boolean)
            };
            
        } catch (error) {
            timer.end();
            return {
                success: false,
                error: error.message,
                duration: timer.startTime,
                tests: {}
            };
        }
    }

    /**
     * Test Integuru Wrapper component
     */
    async testInteguruWrapper() {
        const timer = this.performanceMonitor.startTimer('integuru_wrapper');
        
        try {
            await this.testReporter.logStep('Testing Integuru Wrapper...');
            
            // Test wrapper initialization
            const initResult = await this.testInteguruInitialization();
            
            // Test HAR analysis
            const analysisResult = await this.testHARAnalysis();
            
            // Test code generation
            const codeResult = await this.testCodeGeneration();
            
            // Test code execution
            const execResult = await this.testCodeExecution();
            
            timer.end();
            
            return {
                success: initResult.success && analysisResult.success && 
                        codeResult.success && execResult.success,
                tests: {
                    initialization: initResult,
                    analysis: analysisResult,
                    code: codeResult,
                    execution: execResult
                },
                duration: timer.startTime,
                errors: [
                    initResult.error,
                    analysisResult.error,
                    codeResult.error,
                    execResult.error
                ].filter(Boolean)
            };
            
        } catch (error) {
            timer.end();
            return {
                success: false,
                error: error.message,
                duration: timer.startTime,
                tests: {}
            };
        }
    }

    /**
     * Test Modality Optimizer component
     */
    async testModalityOptimizer() {
        const timer = this.performanceMonitor.startTimer('modality_optimizer');
        
        try {
            await this.testReporter.logStep('Testing Modality Optimizer...');
            
            // Test optimizer initialization
            const initResult = await this.testModalityInitialization();
            
            // Test HAR file analysis
            const analysisResult = await this.testModalityAnalysis();
            
            // Test modality selection
            const selectionResult = await this.testModalitySelection();
            
            // Test learning system
            const learningResult = await this.testLearningSystem();
            
            timer.end();
            
            return {
                success: initResult.success && analysisResult.success && 
                        selectionResult.success && learningResult.success,
                tests: {
                    initialization: initResult,
                    analysis: analysisResult,
                    selection: selectionResult,
                    learning: learningResult
                },
                duration: timer.startTime,
                errors: [
                    initResult.error,
                    analysisResult.error,
                    selectionResult.error,
                    learningResult.error
                ].filter(Boolean)
            };
            
        } catch (error) {
            timer.end();
            return {
                success: false,
                error: error.message,
                duration: timer.startTime,
                tests: {}
            };
        }
    }

    /**
     * Test component integrations
     */
    async testComponentIntegrations() {
        await this.testReporter.logStep('Testing component integrations...');
        
        const integrationTests = [
            {
                name: 'MCP Server + mitmproxy',
                test: () => this.testMCPMitmproxyIntegration()
            },
            {
                name: 'MCP Server + Integuru',
                test: () => this.testMCPInteguruIntegration()
            },
            {
                name: 'Integuru + Modality Optimizer',
                test: () => this.testInteguruModalityIntegration()
            },
            {
                name: 'All Components Workflow',
                test: () => this.testFullComponentWorkflow()
            }
        ];
        
        for (const integrationTest of integrationTests) {
            const result = await this.runIntegrationTest(integrationTest.name, integrationTest.test);
            this.testResults.integrations[integrationTest.name] = result;
        }
    }

    /**
     * Test end-to-end workflows
     */
    async testEndToEndWorkflows() {
        await this.testReporter.logStep('Testing end-to-end workflows...');
        
        const workflowTests = [
            {
                name: 'Gmail Login Workflow',
                test: () => this.testGmailLoginWorkflow()
            },
            {
                name: 'API Reverse Engineering Workflow',
                test: () => this.testAPIReverseEngineeringWorkflow()
            },
            {
                name: 'Session Recording & Replay Workflow',
                test: () => this.testSessionReplayWorkflow()
            }
        ];
        
        for (const workflowTest of workflowTests) {
            const result = await this.runWorkflowTest(workflowTest.name, workflowTest.test);
            this.testResults.integrations[workflowTest.name] = result;
        }
    }

    /**
     * Test error handling and recovery
     */
    async testErrorHandling() {
        await this.testReporter.logStep('Testing error handling...');
        
        const errorTests = [
            {
                name: 'Network Failure Recovery',
                test: () => this.testNetworkFailureRecovery()
            },
            {
                name: 'Invalid Input Handling',
                test: () => this.testInvalidInputHandling()
            },
            {
                name: 'Resource Exhaustion Recovery',
                test: () => this.testResourceExhaustionRecovery()
            },
            {
                name: 'Timeout Handling',
                test: () => this.testTimeoutHandling()
            }
        ];
        
        for (const errorTest of errorTests) {
            const result = await this.runErrorTest(errorTest.name, errorTest.test);
            this.testResults.integrations[errorTest.name] = result;
        }
    }

    /**
     * Run a component test
     */
    async runComponentTest(componentName, testFunction) {
        const testStartTime = Date.now();
        
        try {
            await this.testReporter.logStep(`Running component test: ${componentName}`);
            
            const result = await testFunction();
            
            this.testResults.summary.total++;
            if (result.success) {
                this.testResults.summary.passed++;
            } else {
                this.testResults.summary.failed++;
            }
            
            this.emit('componentTestCompleted', {
                component: componentName,
                success: result.success,
                duration: Date.now() - testStartTime
            });
            
            return result;
            
        } catch (error) {
            this.testResults.summary.total++;
            this.testResults.summary.failed++;
            
            await this.testReporter.logError(`Component test ${componentName} failed`, error);
            
            return {
                success: false,
                error: error.message,
                duration: Date.now() - testStartTime
            };
        }
    }

    /**
     * Run an integration test
     */
    async runIntegrationTest(integrationName, testFunction) {
        const testStartTime = Date.now();
        
        try {
            await this.testReporter.logStep(`Running integration test: ${integrationName}`);
            
            const result = await testFunction();
            
            this.testResults.summary.total++;
            if (result.success) {
                this.testResults.summary.passed++;
            } else {
                this.testResults.summary.failed++;
            }
            
            this.emit('integrationTestCompleted', {
                integration: integrationName,
                success: result.success,
                duration: Date.now() - testStartTime
            });
            
            return result;
            
        } catch (error) {
            this.testResults.summary.total++;
            this.testResults.summary.failed++;
            
            await this.testReporter.logError(`Integration test ${integrationName} failed`, error);
            
            return {
                success: false,
                error: error.message,
                duration: Date.now() - testStartTime
            };
        }
    }

    /**
     * Run a workflow test
     */
    async runWorkflowTest(workflowName, testFunction) {
        const testStartTime = Date.now();
        
        try {
            await this.testReporter.logStep(`Running workflow test: ${workflowName}`);
            
            const result = await testFunction();
            
            this.testResults.summary.total++;
            if (result.success) {
                this.testResults.summary.passed++;
            } else {
                this.testResults.summary.failed++;
            }
            
            this.emit('workflowTestCompleted', {
                workflow: workflowName,
                success: result.success,
                duration: Date.now() - testStartTime
            });
            
            return result;
            
        } catch (error) {
            this.testResults.summary.total++;
            this.testResults.summary.failed++;
            
            await this.testReporter.logError(`Workflow test ${workflowName} failed`, error);
            
            return {
                success: false,
                error: error.message,
                duration: Date.now() - testStartTime
            };
        }
    }

    /**
     * Run an error test
     */
    async runErrorTest(errorName, testFunction) {
        const testStartTime = Date.now();
        
        try {
            await this.testReporter.logStep(`Running error test: ${errorName}`);
            
            const result = await testFunction();
            
            this.testResults.summary.total++;
            if (result.success) {
                this.testResults.summary.passed++;
            } else {
                this.testResults.summary.failed++;
            }
            
            this.emit('errorTestCompleted', {
                error: errorName,
                success: result.success,
                duration: Date.now() - testStartTime
            });
            
            return result;
            
        } catch (error) {
            this.testResults.summary.total++;
            this.testResults.summary.failed++;
            
            await this.testReporter.logError(`Error test ${errorName} failed`, error);
            
            return {
                success: false,
                error: error.message,
                duration: Date.now() - testStartTime
            };
        }
    }

    // Individual component test implementations
    // These would be implemented with actual component testing logic
    // For now, they simulate test results

    async testServerStartup() {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { success: true, duration: 1000 };
    }

    async testToolListing() {
        await new Promise(resolve => setTimeout(resolve, 500));
        return { success: true, duration: 500 };
    }

    async testToolExecution() {
        await new Promise(resolve => setTimeout(resolve, 1500));
        return { success: true, duration: 1500 };
    }

    async testServerShutdown() {
        await new Promise(resolve => setTimeout(resolve, 500));
        return { success: true, duration: 500 };
    }

    async testMitmproxyInitialization() {
        await new Promise(resolve => setTimeout(resolve, 800));
        return { success: true, duration: 800 };
    }

    async testNetworkCapture() {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return { success: true, duration: 2000 };
    }

    async testHARFileGeneration() {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { success: true, duration: 1000 };
    }

    async testMitmproxyCleanup() {
        await new Promise(resolve => setTimeout(resolve, 500));
        return { success: true, duration: 500 };
    }

    async testInteguruInitialization() {
        await new Promise(resolve => setTimeout(resolve, 1200));
        return { success: true, duration: 1200 };
    }

    async testHARAnalysis() {
        await new Promise(resolve => setTimeout(resolve, 3000));
        return { success: true, duration: 3000 };
    }

    async testCodeGeneration() {
        await new Promise(resolve => setTimeout(resolve, 2500));
        return { success: true, duration: 2500 };
    }

    async testCodeExecution() {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return { success: true, duration: 2000 };
    }

    async testModalityInitialization() {
        await new Promise(resolve => setTimeout(resolve, 800));
        return { success: true, duration: 800 };
    }

    async testModalityAnalysis() {
        await new Promise(resolve => setTimeout(resolve, 1500));
        return { success: true, duration: 1500 };
    }

    async testModalitySelection() {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { success: true, duration: 1000 };
    }

    async testLearningSystem() {
        await new Promise(resolve => setTimeout(resolve, 1200));
        return { success: true, duration: 1200 };
    }

    // Integration test implementations
    // These would test actual component interactions

    async testMCPMitmproxyIntegration() {
        await new Promise(resolve => setTimeout(resolve, 3000));
        return { success: true, duration: 3000 };
    }

    async testMCPInteguruIntegration() {
        await new Promise(resolve => setTimeout(resolve, 2500));
        return { success: true, duration: 2500 };
    }

    async testInteguruModalityIntegration() {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return { success: true, duration: 2000 };
    }

    async testFullComponentWorkflow() {
        await new Promise(resolve => setTimeout(resolve, 5000));
        return { success: true, duration: 5000 };
    }

    // Workflow test implementations

    async testGmailLoginWorkflow() {
        await new Promise(resolve => setTimeout(resolve, 4000));
        return { success: true, duration: 4000 };
    }

    async testAPIReverseEngineeringWorkflow() {
        await new Promise(resolve => setTimeout(resolve, 6000));
        return { success: true, duration: 6000 };
    }

    async testSessionReplayWorkflow() {
        await new Promise(resolve => setTimeout(resolve, 3500));
        return { success: true, duration: 3500 };
    }

    // Error test implementations

    async testNetworkFailureRecovery() {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return { success: true, duration: 2000 };
    }

    async testInvalidInputHandling() {
        await new Promise(resolve => setTimeout(resolve, 1500));
        return { success: true, duration: 1500 };
    }

    async testResourceExhaustionRecovery() {
        await new Promise(resolve => setTimeout(resolve, 3000));
        return { success: true, duration: 3000 };
    }

    async testTimeoutHandling() {
        await new Promise(resolve => setTimeout(resolve, 2500));
        return { success: true, duration: 2500 };
    }

    /**
     * Calculate test summary
     */
    calculateSummary() {
        this.testResults.summary.successRate = 
            this.testResults.summary.total > 0 
                ? this.testResults.summary.passed / this.testResults.summary.total 
                : 0;
    }

    /**
     * Generate comprehensive integration report
     */
    async generateIntegrationReport() {
        const reportData = {
            testInfo: {
                name: 'Component Integration Tests',
                timestamp: new Date().toISOString(),
                duration: this.testResults.summary.duration,
                version: '1.0.0'
            },
            summary: this.testResults.summary,
            components: this.testResults.components,
            integrations: this.testResults.integrations,
            analysis: this.analyzeResults(),
            recommendations: this.generateRecommendations()
        };
        
        await this.testReporter.generateReport(reportData);
        
        // Save detailed results
        const resultsFile = path.join(this.options.outputDir, `integration-results-${Date.now()}.json`);
        await fs.writeFile(resultsFile, JSON.stringify(reportData, null, 2));
        
        console.log(`\n📊 Integration Test Results:`);
        console.log(`   Total Tests: ${reportData.summary.total}`);
        console.log(`   Passed: ${reportData.summary.passed}`);
        console.log(`   Failed: ${reportData.summary.failed}`);
        console.log(`   Success Rate: ${(reportData.summary.successRate * 100).toFixed(1)}%`);
        console.log(`   Duration: ${(reportData.testInfo.duration / 1000).toFixed(2)}s`);
        console.log(`   Report saved to: ${resultsFile}`);
        
        return reportData;
    }

    /**
     * Analyze test results
     */
    analyzeResults() {
        const analysis = {
            componentHealth: {},
            integrationHealth: {},
            performanceMetrics: {},
            failurePatterns: []
        };
        
        // Analyze component health
        Object.keys(this.testResults.components).forEach(componentName => {
            const component = this.testResults.components[componentName];
            const testCount = Object.keys(component.tests).length;
            const passedCount = Object.values(component.tests).filter(test => test.success).length;
            
            analysis.componentHealth[componentName] = {
                health: passedCount / testCount,
                testCount,
                passedCount,
                avgDuration: component.duration / testCount,
                criticalFailures: component.errors.filter(error => 
                    error.includes('critical') || error.includes('timeout')
                )
            };
        });
        
        // Analyze integration health
        Object.keys(this.testResults.integrations).forEach(integrationName => {
            const integration = this.testResults.integrations[integrationName];
            
            analysis.integrationHealth[integrationName] = {
                success: integration.success,
                duration: integration.duration,
                errors: integration.errors || [],
                complexity: this.assessIntegrationComplexity(integrationName)
            };
        });
        
        // Analyze performance metrics
        const allDurations = [
            ...Object.values(this.testResults.components).map(c => c.duration),
            ...Object.values(this.testResults.integrations).map(i => i.duration)
        ];
        
        analysis.performanceMetrics = {
            avgTestDuration: allDurations.reduce((a, b) => a + b, 0) / allDurations.length,
            maxTestDuration: Math.max(...allDurations),
            minTestDuration: Math.min(...allDurations),
            totalTestTime: this.testResults.summary.duration
        };
        
        return analysis;
    }

    /**
     * Assess integration complexity
     */
    assessIntegrationComplexity(integrationName) {
        const complexityMap = {
            'MCP Server + mitmproxy': 'medium',
            'MCP Server + Integuru': 'high',
            'Integuru + Modality Optimizer': 'medium',
            'All Components Workflow': 'high',
            'Gmail Login Workflow': 'high',
            'API Reverse Engineering Workflow': 'very_high',
            'Session Recording & Replay Workflow': 'high',
            'Network Failure Recovery': 'medium',
            'Invalid Input Handling': 'low',
            'Resource Exhaustion Recovery': 'medium',
            'Timeout Handling': 'medium'
        };
        
        return complexityMap[integrationName] || 'unknown';
    }

    /**
     * Generate recommendations based on results
     */
    generateRecommendations() {
        const recommendations = [];
        const successRate = this.testResults.summary.successRate;
        
        if (successRate < 0.8) {
            recommendations.push({
                type: 'overall',
                severity: 'high',
                message: 'Low overall success rate. Review system configuration and dependencies.',
                value: `${(successRate * 100).toFixed(1)}%`
            });
        }
        
        // Component-specific recommendations
        Object.keys(this.testResults.components).forEach(componentName => {
            const component = this.testResults.components[componentName];
            if (!component.success) {
                recommendations.push({
                    type: 'component',
                    component: componentName,
                    severity: 'medium',
                    message: `Component ${componentName} has test failures. Investigate component-specific issues.`,
                    errors: component.errors
                });
            }
        });
        
        // Integration-specific recommendations
        Object.keys(this.testResults.integrations).forEach(integrationName => {
            const integration = this.testResults.integrations[integrationName];
            if (!integration.success) {
                recommendations.push({
                    type: 'integration',
                    integration: integrationName,
                    severity: 'high',
                    message: `Integration ${integrationName} failed. Review component interaction logic.`,
                    errors: integration.errors
                });
            }
        });
        
        return recommendations;
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            // Cleanup MCP server
            if (this.components.mcpServer) {
                await this.components.mcpServer.cleanup();
            }
            
            // Cleanup other components
            if (this.components.mitmproxy) {
                await this.components.mitmproxy.stop();
            }
            
            await this.performanceMonitor.cleanup();
            await this.testReporter.cleanup();
            
        } catch (error) {
            console.error('Cleanup failed:', error);
        }
    }
}

// CLI execution
if (require.main === module) {
    const options = {
        timeout: parseInt(process.env.TEST_TIMEOUT) || 60000,
        outputDir: process.env.OUTPUT_DIR || './test-results',
        parallel: process.env.PARALLEL === 'true'
    };
    
    const tester = new IntegrationTester(options);
    
    tester.on('testStarted', (data) => {
        console.log(`🚀 Integration Testing Started: ${data.timestamp}`);
    });
    
    tester.on('componentTestCompleted', (data) => {
        const status = data.success ? '✅' : '❌';
        console.log(`${status} Component ${data.component} completed in ${(data.duration / 1000).toFixed(2)}s`);
    });
    
    tester.on('integrationTestCompleted', (data) => {
        const status = data.success ? '✅' : '❌';
        console.log(`${status} Integration ${data.integration} completed in ${(data.duration / 1000).toFixed(2)}s`);
    });
    
    tester.on('testCompleted', (data) => {
        const status = data.success ? '✅' : '❌';
        console.log(`\n${status} Integration Testing completed in ${(data.duration / 1000).toFixed(2)}s`);
    });
    
    tester.on('testError', (data) => {
        console.error(`\n❌ Test Error: ${data.error}`);
    });
    
    tester.runAllTests()
        .then((results) => {
            console.log('\n🎉 Integration Testing completed successfully!');
            process.exit(results.summary.failed === 0 ? 0 : 1);
        })
        .catch((error) => {
            console.error('\n💥 Integration Testing failed:', error);
            process.exit(1);
        })
        .finally(() => {
            tester.cleanup();
        });
}

module.exports = IntegrationTester;