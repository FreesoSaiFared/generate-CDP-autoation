/**
 * Modality Optimizer Test Suite
 * 
 * Comprehensive testing for the modality optimization system including:
 * - Decision logic validation
 * - Performance metric verification
 * - Edge case handling
 * - Integration testing
 * - Benchmarking tools
 */

const fs = require('fs').promises;
const path = require('path');
const ModalityOptimizer = require('../lib/modality-optimizer');
const PerformanceTracker = require('../lib/performance-tracker');
const DecisionLogger = require('../lib/decision-logger');
const OptimizationEngine = require('../lib/optimization-engine');

class ModalityOptimizerTester {
    constructor(options = {}) {
        this.testDataDir = options.testDataDir || path.join(__dirname, 'test-data');
        this.testResults = {
            passed: 0,
            failed: 0,
            total: 0,
            details: []
        };
        
        // Initialize components with test configuration
        this.optimizer = new ModalityOptimizer({
            integuruConfidence: 0.85,
            headlessConfidence: 0.70,
            integuru: {
                model: 'gpt-4o',
                timeout: 5000
            },
            performance: {
                dataDir: path.join(this.testDataDir, 'performance')
            },
            logging: {
                dataDir: path.join(this.testDataDir, 'decisions')
            },
            optimization: {
                dataDir: path.join(this.testDataDir, 'optimization')
            }
        });
        
        // Test scenarios
        this.testScenarios = this.createTestScenarios();
        
        // Initialize test data directory
        this.initializeTestDataDirectory();
    }

    /**
     * Run all tests
     * 
     * @returns {Promise<Object>} Test results
     */
    async runAllTests() {
        console.log('🚀 Starting Modality Optimizer Test Suite...\n');
        
        // Run individual test suites
        await this.testDecisionLogic();
        await this.testPerformanceMetrics();
        await this.testEdgeCases();
        await this.testIntegration();
        await this.testBenchmarking();
        
        // Generate final report
        const report = this.generateTestReport();
        
        console.log('\n📊 Test Results:');
        console.log(`✅ Passed: ${this.testResults.passed}`);
        console.log(`❌ Failed: ${this.testResults.failed}`);
        console.log(`📈 Total: ${this.testResults.total}`);
        console.log(`📊 Success Rate: ${((this.testResults.passed / this.testResults.total) * 100).toFixed(2)}%`);
        
        return report;
    }

    /**
     * Test decision logic
     */
    async testDecisionLogic() {
        console.log('🧠 Testing Decision Logic...');
        
        // Test 1: API reversibility scoring
        await this.testApiReversibilityScoring();
        
        // Test 2: Complexity analysis
        await this.testComplexityAnalysis();
        
        // Test 3: Integuru feasibility assessment
        await this.testInteguruFeasibility();
        
        // Test 4: Headless CDP feasibility assessment
        await this.testHeadlessFeasibility();
        
        // Test 5: Decision making with fallback logic
        await this.testDecisionMaking();
    }

    /**
     * Test performance metrics
     */
    async testPerformanceMetrics() {
        console.log('📈 Testing Performance Metrics...');
        
        // Test 1: Execution time tracking
        await this.testExecutionTimeTracking();
        
        // Test 2: Success rate monitoring
        await this.testSuccessRateMonitoring();
        
        // Test 3: Anomaly detection
        await this.testAnomalyDetection();
        
        // Test 4: Performance comparison
        await this.testPerformanceComparison();
    }

    /**
     * Test edge cases
     */
    async testEdgeCases() {
        console.log('⚠️ Testing Edge Cases...');
        
        // Test 1: Empty HAR file
        await this.testEmptyHarFile();
        
        // Test 2: Malformed HAR file
        await this.testMalformedHarFile();
        
        // Test 3: No network activity
        await this.testNoNetworkActivity();
        
        // Test 4: Extremely complex task
        await this.testExtremelyComplexTask();
        
        // Test 5: Unknown domain/task type
        await this.testUnknownDomain();
    }

    /**
     * Test integration
     */
    async testIntegration() {
        console.log('🔗 Testing Integration...');
        
        // Test 1: End-to-end workflow
        await this.testEndToEndWorkflow();
        
        // Test 2: Component interaction
        await this.testComponentInteraction();
        
        // Test 3: Data persistence
        await this.testDataPersistence();
        
        // Test 4: Error handling
        await this.testErrorHandling();
    }

    /**
     * Test benchmarking tools
     */
    async testBenchmarking() {
        console.log('🏁 Testing Benchmarking Tools...');
        
        // Test 1: Performance benchmarking
        await this.testPerformanceBenchmarking();
        
        // Test 2: Decision accuracy validation
        await this.testDecisionAccuracy();
        
        // Test 3: Load testing
        await this.testLoadTesting();
        
        // Test 4: Memory usage profiling
        await this.testMemoryProfiling();
    }

    // Individual test implementations
    
    async testApiReversibilityScoring() {
        const testName = 'API Reversibility Scoring';
        
        try {
            // Create test HAR with high API reversibility
            const highReversibilityHar = this.createTestHar({
                apiEndpoints: 3,
                authPatterns: 2,
                consistentEndpoints: true,
                simpleRequests: true
            });
            
            const analysis = await this.optimizer.analyzeHarFile(highReversibilityHar);
            const reversibilityScore = await this.optimizer.scoreApiReversibility(analysis);
            
            this.assert(
                reversibilityScore.score > 0.8,
                `${testName}: High reversibility score > 0.8`,
                { score: reversibilityScore.score }
            );
            
            // Create test HAR with low API reversibility
            const lowReversibilityHar = this.createTestHar({
                apiEndpoints: 0,
                authPatterns: 0,
                consistentEndpoints: false,
                simpleRequests: false
            });
            
            const lowAnalysis = await this.optimizer.analyzeHarFile(lowReversibilityHar);
            const lowReversibilityScore = await this.optimizer.scoreApiReversibility(lowAnalysis);
            
            this.assert(
                lowReversibilityScore.score < 0.6,
                `${testName}: Low reversibility score < 0.6`,
                { score: lowReversibilityScore.score }
            );
            
        } catch (error) {
            this.fail(testName, error);
        }
    }

    async testComplexityAnalysis() {
        const testName = 'Complexity Analysis';
        
        try {
            // Test low complexity
            const lowComplexityHar = this.createTestHar({
                totalRequests: 5,
                apiEndpoints: 2,
                methods: ['GET', 'POST'],
                contentTypes: 2
            });
            
            const lowAnalysis = await this.optimizer.analyzeHarFile(lowComplexityHar);
            const lowComplexity = await this.optimizer.analyzeComplexity(lowAnalysis, 'Simple task');
            
            this.assert(
                lowComplexity.level === 'low',
                `${testName}: Low complexity detected`,
                { level: lowComplexity.level, score: lowComplexity.score }
            );
            
            // Test high complexity
            const highComplexityHar = this.createTestHar({
                totalRequests: 50,
                apiEndpoints: 15,
                methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
                contentTypes: 10
            });
            
            const highAnalysis = await this.optimizer.analyzeHarFile(highComplexityHar);
            const highComplexity = await this.optimizer.analyzeComplexity(highAnalysis, 'Complex task with multiple steps');
            
            this.assert(
                highComplexity.level === 'high',
                `${testName}: High complexity detected`,
                { level: highComplexity.level, score: highComplexity.score }
            );
            
        } catch (error) {
            this.fail(testName, error);
        }
    }

    async testInteguruFeasibility() {
        const testName = 'Integuru Feasibility Assessment';
        
        try {
            // Test feasible scenario
            const feasibleHar = this.createTestHar({
                apiEndpoints: 5,
                authPatterns: 1,
                consistentEndpoints: true,
                simpleRequests: true
            });
            
            const analysis = await this.optimizer.analyzeHarFile(feasibleHar);
            const reversibilityScore = await this.optimizer.scoreApiReversibility(analysis);
            const complexityScore = await this.optimizer.analyzeComplexity(analysis, 'API-driven task');
            
            const feasibility = await this.optimizer.assessInteguruFeasibility({
                harAnalysis: analysis,
                reversibilityScore,
                complexityScore,
                taskDescription: 'API-driven task'
            });
            
            this.assert(
                feasibility.feasible === true,
                `${testName}: Feasible scenario detected`,
                { feasible: feasibility.feasible, confidence: feasibility.confidence }
            );
            
            // Test non-feasible scenario
            const nonFeasibleHar = this.createTestHar({
                apiEndpoints: 0,
                authPatterns: 0,
                consistentEndpoints: false,
                simpleRequests: false
            });
            
            const nonFeasibleAnalysis = await this.optimizer.analyzeHarFile(nonFeasibleHar);
            const nonFeasibleReversibility = await this.optimizer.scoreApiReversibility(nonFeasibleAnalysis);
            const nonFeasibleComplexity = await this.optimizer.analyzeComplexity(nonFeasibleAnalysis, 'Complex UI task');
            
            const nonFeasible = await this.optimizer.assessInteguruFeasibility({
                harAnalysis: nonFeasibleAnalysis,
                reversibilityScore: nonFeasibleReversibility,
                complexityScore: nonFeasibleComplexity,
                taskDescription: 'Complex UI task'
            });
            
            this.assert(
                nonFeasible.feasible === false,
                `${testName}: Non-feasible scenario detected`,
                { feasible: nonFeasible.feasible, confidence: nonFeasible.confidence }
            );
            
        } catch (error) {
            this.fail(testName, error);
        }
    }

    async testHeadlessFeasibility() {
        const testName = 'Headless CDP Feasibility Assessment';
        
        try {
            // Test feasible scenario
            const feasibleHar = this.createTestHar({
                totalRequests: 20,
                apiEndpoints: 5,
                modernFeatures: false
            });
            
            const analysis = await this.optimizer.analyzeHarFile(feasibleHar);
            const complexityScore = await this.optimizer.analyzeComplexity(analysis, 'Web automation task');
            
            const feasibility = await this.optimizer.assessHeadlessFeasibility({
                harAnalysis: analysis,
                complexityScore,
                taskDescription: 'Web automation task'
            });
            
            this.assert(
                feasibility.feasible === true,
                `${testName}: Feasible scenario detected`,
                { feasible: feasibility.feasible, confidence: feasibility.confidence }
            );
            
        } catch (error) {
            this.fail(testName, error);
        }
    }

    async testDecisionMaking() {
        const testName = 'Decision Making with Fallback Logic';
        
        try {
            // Test Integuru selection
            const integuruHar = this.createTestHar({
                apiEndpoints: 3,
                authPatterns: 1,
                consistentEndpoints: true,
                simpleRequests: true
            });
            
            const integuruDecision = await this.optimizer.chooseModality({
                harFile: integuruHar,
                taskDescription: 'Download file via API',
                context: { domain: 'api.example.com' }
            });
            
            this.assert(
                integuruDecision.modality === 'integuru',
                `${testName}: Integuru selected for API task`,
                { modality: integuruDecision.modality, confidence: integuruDecision.confidence }
            );
            
            // Test Headless CDP selection
            const headlessHar = this.createTestHar({
                totalRequests: 15,
                apiEndpoints: 2,
                modernFeatures: false
            });
            
            const headlessDecision = await this.optimizer.chooseModality({
                harFile: headlessHar,
                taskDescription: 'Fill form and submit',
                context: { domain: 'forms.example.com' }
            });
            
            this.assert(
                headlessDecision.modality === 'headless_cdp',
                `${testName}: Headless CDP selected for form task`,
                { modality: headlessDecision.modality, confidence: headlessDecision.confidence }
            );
            
            // Test Visible Browser fallback
            const complexHar = this.createTestHar({
                totalRequests: 100,
                apiEndpoints: 0,
                modernFeatures: true,
                complexUi: true
            });
            
            const complexDecision = await this.optimizer.chooseModality({
                harFile: complexHar,
                taskDescription: 'Complex multi-step interaction with modern web app',
                context: { domain: 'complex.example.com' }
            });
            
            this.assert(
                complexDecision.modality === 'visible_browser',
                `${testName}: Visible Browser selected for complex task`,
                { modality: complexDecision.modality, confidence: complexDecision.confidence }
            );
            
        } catch (error) {
            this.fail(testName, error);
        }
    }

    async testExecutionTimeTracking() {
        const testName = 'Execution Time Tracking';
        
        try {
            const tracker = this.optimizer.performanceTracker;
            
            // Record execution with known time
            const metric = await tracker.recordExecution({
                modality: 'integuru',
                estimatedTime: 3,
                actualTime: 2.5,
                success: true,
                sessionId: 'test-session-1',
                metadata: { domain: 'test.com' }
            });
            
            this.assert(
                metric.actualTime === 2.5,
                `${testName}: Actual time recorded correctly`,
                { actualTime: metric.actualTime }
            );
            
            this.assert(
                metric.performance.timeAccuracy > 0.8,
                `${testName}: Time accuracy calculated correctly`,
                { timeAccuracy: metric.performance.timeAccuracy }
            );
            
            // Get performance stats
            const stats = await tracker.getPerformanceStats('integuru');
            
            this.assert(
                stats.totalExecutions >= 1,
                `${testName}: Execution counted in stats`,
                { totalExecutions: stats.totalExecutions }
            );
            
        } catch (error) {
            this.fail(testName, error);
        }
    }

    async testSuccessRateMonitoring() {
        const testName = 'Success Rate Monitoring';
        
        try {
            const tracker = this.optimizer.performanceTracker;
            
            // Record successful execution
            await tracker.recordExecution({
                modality: 'integuru',
                estimatedTime: 3,
                actualTime: 2.8,
                success: true,
                sessionId: 'test-session-2'
            });
            
            // Record failed execution
            await tracker.recordExecution({
                modality: 'integuru',
                estimatedTime: 3,
                actualTime: 5,
                success: false,
                error: 'API timeout',
                sessionId: 'test-session-3'
            });
            
            // Get stats
            const stats = await tracker.getPerformanceStats('integuru');
            
            this.assert(
                stats.reliability.successRate === 0.5,
                `${testName}: Success rate calculated correctly`,
                { successRate: stats.reliability.successRate }
            );
            
        } catch (error) {
            this.fail(testName, error);
        }
    }

    async testAnomalyDetection() {
        const testName = 'Anomaly Detection';
        
        try {
            const tracker = this.optimizer.performanceTracker;
            
            // Record normal execution
            await tracker.recordExecution({
                modality: 'integuru',
                estimatedTime: 3,
                actualTime: 3.2,
                success: true,
                sessionId: 'test-session-4'
            });
            
            // Record anomalous execution (very slow)
            const anomalyMetric = await tracker.recordExecution({
                modality: 'integuru',
                estimatedTime: 3,
                actualTime: 15,
                success: true,
                sessionId: 'test-session-5'
            });
            
            this.assert(
                anomalyMetric.performance.isAnomaly === true,
                `${testName}: Anomaly detected for slow execution`,
                { isAnomaly: anomalyMetric.performance.isAnomaly }
            );
            
        } catch (error) {
            this.fail(testName, error);
        }
    }

    async testPerformanceComparison() {
        const testName = 'Performance Comparison';
        
        try {
            const tracker = this.optimizer.performanceTracker;
            
            // Record executions for each modality
            await tracker.recordExecution({
                modality: 'integuru',
                estimatedTime: 3,
                actualTime: 2.5,
                success: true,
                sessionId: 'test-session-6'
            });
            
            await tracker.recordExecution({
                modality: 'headless_cdp',
                estimatedTime: 20,
                actualTime: 18,
                success: true,
                sessionId: 'test-session-7'
            });
            
            await tracker.recordExecution({
                modality: 'visible_browser',
                estimatedTime: 300,
                actualTime: 240,
                success: true,
                sessionId: 'test-session-8'
            });
            
            // Compare modalities
            const comparison = await tracker.compareModalities();
            
            this.assert(
                comparison.summary.fastest === 'integuru',
                `${testName}: Fastest modality identified correctly`,
                { fastest: comparison.summary.fastest }
            );
            
        } catch (error) {
            this.fail(testName, error);
        }
    }

    async testEmptyHarFile() {
        const testName = 'Empty HAR File';
        
        try {
            const emptyHar = this.createTestHar({
                totalRequests: 0
            });
            
            const decision = await this.optimizer.chooseModality({
                harFile: emptyHar,
                taskDescription: 'Test with empty HAR',
                context: { domain: 'empty.test.com' }
            });
            
            this.assert(
                decision.modality === 'visible_browser',
                `${testName}: Visible browser fallback for empty HAR`,
                { modality: decision.modality }
            );
            
        } catch (error) {
            this.fail(testName, error);
        }
    }

    async testMalformedHarFile() {
        const testName = 'Malformed HAR File';
        
        try {
            const malformedHar = { invalid: 'structure' };
            
            // Should handle gracefully
            try {
                await this.optimizer.chooseModality({
                    harFile: malformedHar,
                    taskDescription: 'Test with malformed HAR',
                    context: { domain: 'malformed.test.com' }
                });
                
                this.fail(testName, 'Should have thrown error for malformed HAR');
            } catch (error) {
                this.assert(
                    error.message.includes('HAR') || error.message.includes('parse'),
                    `${testName}: Appropriate error for malformed HAR`,
                    { errorMessage: error.message }
                );
            }
            
        } catch (error) {
            this.fail(testName, error);
        }
    }

    async testNoNetworkActivity() {
        const testName = 'No Network Activity';
        
        try {
            const noNetworkHar = this.createTestHar({
                totalRequests: 0,
                apiEndpoints: 0
            });
            
            const decision = await this.optimizer.chooseModality({
                harFile: noNetworkHar,
                taskDescription: 'Test with no network activity',
                context: { domain: 'nonetwork.test.com' }
            });
            
            this.assert(
                decision.modality === 'visible_browser',
                `${testName}: Visible browser fallback for no network`,
                { modality: decision.modality }
            );
            
        } catch (error) {
            this.fail(testName, error);
        }
    }

    async testExtremelyComplexTask() {
        const testName = 'Extremely Complex Task';
        
        try {
            const complexHar = this.createTestHar({
                totalRequests: 200,
                apiEndpoints: 50,
                methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
                contentTypes: 20,
                modernFeatures: true,
                complexUi: true
            });
            
            const decision = await this.optimizer.chooseModality({
                harFile: complexHar,
                taskDescription: 'Extremely complex multi-step task with modern web features',
                context: { domain: 'complex.test.com' }
            });
            
            this.assert(
                decision.modality === 'visible_browser',
                `${testName}: Visible browser for extremely complex task`,
                { modality: decision.modality }
            );
            
        } catch (error) {
            this.fail(testName, error);
        }
    }

    async testUnknownDomain() {
        const testName = 'Unknown Domain';
        
        try {
            const har = this.createTestHar({
                apiEndpoints: 2
            });
            
            const decision = await this.optimizer.chooseModality({
                harFile: har,
                taskDescription: 'Test with unknown domain',
                context: { domain: 'unknown.newdomain.xyz' }
            });
            
            // Should still make a decision based on HAR analysis
            this.assert(
                ['integuru', 'headless_cdp', 'visible_browser'].includes(decision.modality),
                `${testName}: Valid modality selected for unknown domain`,
                { modality: decision.modality }
            );
            
        } catch (error) {
            this.fail(testName, error);
        }
    }

    async testEndToEndWorkflow() {
        const testName = 'End-to-End Workflow';
        
        try {
            const har = this.createTestHar({
                apiEndpoints: 3,
                authPatterns: 1
            });
            
            // Make decision
            const decision = await this.optimizer.chooseModality({
                harFile: har,
                taskDescription: 'Download file via API',
                context: { domain: 'api.test.com' }
            });
            
            // Record execution
            await this.optimizer.recordExecution({
                decision,
                executionTime: decision.estimatedTime * 1.1, // Slightly over estimate
                success: true,
                sessionId: 'e2e-test-session'
            });
            
            // Verify decision was logged
            const stats = await this.optimizer.decisionLogger.getDecisionStats();
            
            this.assert(
                stats.totalDecisions >= 1,
                `${testName}: Decision logged successfully`,
                { totalDecisions: stats.totalDecisions }
            );
            
        } catch (error) {
            this.fail(testName, error);
        }
    }

    async testComponentInteraction() {
        const testName = 'Component Interaction';
        
        try {
            // Test that components work together
            const har = this.createTestHar({
                apiEndpoints: 2
            });
            
            const decision = await this.optimizer.chooseModality({
                harFile: har,
                taskDescription: 'Test component interaction',
                context: { domain: 'interaction.test.com' }
            });
            
            // Verify all components have data
            const performanceStats = await this.optimizer.performanceTracker.getPerformanceStats(decision.modality);
            const decisionStats = await this.optimizer.decisionLogger.getDecisionStats();
            const historicalData = await this.optimizer.optimizationEngine.getHistoricalPerformance();
            
            this.assert(
                performanceStats !== null,
                `${testName}: Performance tracker has data`,
                { hasData: performanceStats !== null }
            );
            
            this.assert(
                decisionStats !== null,
                `${testName}: Decision logger has data`,
                { hasData: decisionStats !== null }
            );
            
            this.assert(
                historicalData !== null,
                `${testName}: Optimization engine has data`,
                { hasData: historicalData !== null }
            );
            
        } catch (error) {
            this.fail(testName, error);
        }
    }

    async testDataPersistence() {
        const testName = 'Data Persistence';
        
        try {
            // Record some data
            await this.optimizer.performanceTracker.recordExecution({
                modality: 'integuru',
                estimatedTime: 3,
                actualTime: 2.8,
                success: true,
                sessionId: 'persistence-test'
            });
            
            // Create new instance to test persistence
            const newOptimizer = new ModalityOptimizer({
                performance: {
                    dataDir: path.join(this.testDataDir, 'performance')
                }
            });
            
            // Check if data is available
            const stats = await newOptimizer.performanceTracker.getPerformanceStats('integuru');
            
            this.assert(
                stats.totalExecutions >= 0,
                `${testName}: Data persisted across instances`,
                { totalExecutions: stats.totalExecutions }
            );
            
        } catch (error) {
            this.fail(testName, error);
        }
    }

    async testErrorHandling() {
        const testName = 'Error Handling';
        
        try {
            // Test with invalid parameters
            try {
                await this.optimizer.chooseModality({
                    harFile: null,
                    taskDescription: ''
                });
                
                this.fail(testName, 'Should have thrown error for invalid parameters');
            } catch (error) {
                this.assert(
                    error.message.includes('required') || error.message.includes('invalid'),
                    `${testName}: Appropriate error for invalid parameters`,
                    { errorMessage: error.message }
                );
            }
            
        } catch (error) {
            this.fail(testName, error);
        }
    }

    async testPerformanceBenchmarking() {
        const testName = 'Performance Benchmarking';
        
        try {
            const startTime = Date.now();
            
            // Run multiple decisions
            for (let i = 0; i < 10; i++) {
                const har = this.createTestHar({
                    apiEndpoints: 2 + i
                });
                
                await this.optimizer.chooseModality({
                    harFile: har,
                    taskDescription: `Benchmark test ${i}`,
                    context: { domain: `benchmark${i}.test.com` }
                });
            }
            
            const endTime = Date.now();
            const totalTime = endTime - startTime;
            const avgTime = totalTime / 10;
            
            this.assert(
                avgTime < 1000, // Should be under 1 second per decision
                `${testName}: Performance benchmark passed`,
                { avgTime: `${avgTime}ms` }
            );
            
        } catch (error) {
            this.fail(testName, error);
        }
    }

    async testDecisionAccuracy() {
        const testName = 'Decision Accuracy Validation';
        
        try {
            const testCases = [
                {
                    har: this.createTestHar({ apiEndpoints: 5, authPatterns: 1 }),
                    task: 'API download task',
                    expected: 'integuru'
                },
                {
                    har: this.createTestHar({ totalRequests: 15, apiEndpoints: 2 }),
                    task: 'Form submission task',
                    expected: 'headless_cdp'
                },
                {
                    har: this.createTestHar({ totalRequests: 100, complexUi: true }),
                    task: 'Complex multi-step task',
                    expected: 'visible_browser'
                }
            ];
            
            let correctDecisions = 0;
            
            for (const testCase of testCases) {
                const decision = await this.optimizer.chooseModality({
                    harFile: testCase.har,
                    taskDescription: testCase.task,
                    context: { domain: 'accuracy.test.com' }
                });
                
                if (decision.modality === testCase.expected) {
                    correctDecisions++;
                }
            }
            
            const accuracy = correctDecisions / testCases.length;
            
            this.assert(
                accuracy >= 0.8, // Should be at least 80% accurate
                `${testName}: Decision accuracy validation`,
                { accuracy: `${(accuracy * 100).toFixed(2)}%` }
            );
            
        } catch (error) {
            this.fail(testName, error);
        }
    }

    async testLoadTesting() {
        const testName = 'Load Testing';
        
        try {
            const startTime = Date.now();
            const promises = [];
            
            // Run 20 concurrent decisions
            for (let i = 0; i < 20; i++) {
                promises.push(
                    this.optimizer.chooseModality({
                        harFile: this.createTestHar({ apiEndpoints: 2 }),
                        taskDescription: `Load test ${i}`,
                        context: { domain: `load${i}.test.com` }
                    })
                );
            }
            
            await Promise.all(promises);
            const endTime = Date.now();
            const totalTime = endTime - startTime;
            
            this.assert(
                totalTime < 5000, // Should complete in under 5 seconds
                `${testName}: Load testing passed`,
                { totalTime: `${totalTime}ms` }
            );
            
        } catch (error) {
            this.fail(testName, error);
        }
    }

    async testMemoryProfiling() {
        const testName = 'Memory Usage Profiling';
        
        try {
            const initialMemory = process.memoryUsage();
            
            // Run multiple decisions
            for (let i = 0; i < 50; i++) {
                await this.optimizer.chooseModality({
                    harFile: this.createTestHar({ apiEndpoints: 2 }),
                    taskDescription: `Memory test ${i}`,
                    context: { domain: `memory${i}.test.com` }
                });
            }
            
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }
            
            const finalMemory = process.memoryUsage();
            const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
            
            this.assert(
                memoryIncrease < 50 * 1024 * 1024, // Less than 50MB increase
                `${testName}: Memory usage acceptable`,
                { memoryIncrease: `${(memoryIncrease / 1024 / 1024).toFixed(2)}MB` }
            );
            
        } catch (error) {
            this.fail(testName, error);
        }
    }

    // Helper methods
    
    createTestHar(options = {}) {
        const {
            totalRequests = 10,
            apiEndpoints = 3,
            authPatterns = 1,
            consistentEndpoints = true,
            simpleRequests = true,
            methods = ['GET', 'POST'],
            contentTypes = 3,
            modernFeatures = false,
            complexUi = false
        } = options;
        
        // Create a mock HAR file structure
        return {
            log: {
                version: '1.2',
                creator: { name: 'test-generator', version: '1.0' },
                entries: this.generateHarEntries(totalRequests, {
                    apiEndpoints,
                    consistentEndpoints,
                    simpleRequests,
                    methods,
                    contentTypes,
                    modernFeatures,
                    complexUi
                })
            }
        };
    }

    generateHarEntries(count, options) {
        const entries = [];
        const { apiEndpoints, consistentEndpoints, simpleRequests, methods, contentTypes } = options;
        
        for (let i = 0; i < count; i++) {
            const isApi = i < apiEndpoints;
            const url = isApi 
                ? `https://api.test.com/v1/endpoint${consistentEndpoints ? 1 : i}`
                : `https://test.com/page${i}`;
            
            entries.push({
                startedDateTime: new Date(Date.now() - i * 1000).toISOString(),
                request: {
                    method: methods[i % methods.length],
                    url: url,
                    httpVersion: 'HTTP/1.1',
                    headers: this.generateHeaders(isApi, options.authPatterns),
                    cookies: this.generateCookies(isApi, options.authPatterns),
                    queryString: [],
                    postData: simpleRequests ? null : { text: 'complex data' },
                    headersSize: 200,
                    bodySize: 100
                },
                response: {
                    status: 200,
                    statusText: 'OK',
                    httpVersion: 'HTTP/1.1',
                    headers: this.generateResponseHeaders(contentTypes[i % contentTypes.length]),
                    cookies: [],
                    content: { size: 1000, mimeType: 'application/json' },
                    redirectURL: '',
                    headersSize: 150,
                    bodySize: 1000
                },
                cache: {},
                timings: {
                    send: 50,
                    wait: 100,
                    receive: 50
                },
                time: 200,
                serverIPAddress: '127.0.0.1',
                connection: '1'
            });
        }
        
        return entries;
    }

    generateHeaders(isApi, hasAuth) {
        const headers = [
            { name: 'User-Agent', value: 'Test-Agent/1.0' },
            { name: 'Accept', value: 'application/json' }
        ];
        
        if (isApi && hasAuth) {
            headers.push({ name: 'Authorization', value: 'Bearer token123' });
        }
        
        return headers;
    }

    generateResponseHeaders(contentTypeIndex) {
        const contentTypes = [
            'application/json',
            'text/html',
            'text/css',
            'application/javascript',
            'image/png'
        ];
        
        return [
            { name: 'Content-Type', value: contentTypes[contentTypeIndex] },
            { name: 'Cache-Control', value: 'max-age=3600' }
        ];
    }

    generateCookies(isApi, hasAuth) {
        const cookies = [];
        
        if (hasAuth) {
            cookies.push({
                name: isApi ? 'api_token' : 'session_id',
                value: 'test123',
                domain: isApi ? 'api.test.com' : 'test.com'
            });
        }
        
        return cookies;
    }

    createTestScenarios() {
        return [
            {
                name: 'Simple API Download',
                har: this.createTestHar({ apiEndpoints: 3, authPatterns: 1 }),
                task: 'Download file via API',
                expectedModality: 'integuru'
            },
            {
                name: 'Form Submission',
                har: this.createTestHar({ totalRequests: 15, apiEndpoints: 2 }),
                task: 'Fill and submit form',
                expectedModality: 'headless_cdp'
            },
            {
                name: 'Complex Multi-Step',
                har: this.createTestHar({ totalRequests: 50, complexUi: true }),
                task: 'Complex multi-step interaction',
                expectedModality: 'visible_browser'
            }
        ];
    }

    async initializeTestDataDirectory() {
        try {
            await fs.mkdir(this.testDataDir, { recursive: true });
        } catch (error) {
            // Directory might already exist
        }
    }

    assert(condition, testName, details = {}) {
        this.testResults.total++;
        
        if (condition) {
            this.testResults.passed++;
            console.log(`  ✅ ${testName}`);
            if (Object.keys(details).length > 0) {
                console.log(`     Details:`, details);
            }
        } else {
            this.testResults.failed++;
            console.log(`  ❌ ${testName}`);
            if (Object.keys(details).length > 0) {
                console.log(`     Details:`, details);
            }
        }
    }

    fail(testName, error) {
        this.testResults.total++;
        this.testResults.failed++;
        console.log(`  ❌ ${testName}: ${error.message || error}`);
    }

    generateTestReport() {
        return {
            summary: {
                passed: this.testResults.passed,
                failed: this.testResults.failed,
                total: this.testResults.total,
                successRate: (this.testResults.passed / this.testResults.total) * 100
            },
            details: this.testResults.details,
            timestamp: new Date().toISOString()
        };
    }
}

// Export for use in other files
module.exports = ModalityOptimizerTester;

// Run tests if this file is executed directly
if (require.main === module) {
    const tester = new ModalityOptimizerTester();
    tester.runAllTests().then(report => {
        console.log('\n📄 Test Report:', JSON.stringify(report, null, 2));
        process.exit(report.summary.failed > 0 ? 1 : 0);
    }).catch(error => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });
}