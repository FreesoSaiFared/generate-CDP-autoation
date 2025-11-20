/**
 * Example Usage of Debug Infrastructure
 * 
 * This file demonstrates how to use the comprehensive debugging and logging
 * infrastructure for CDP automation with GLM-4.5V integration.
 */

const DebugIntegration = require('./debug-integration');
const path = require('path');

async function main() {
    console.log('🚀 Starting Debug Infrastructure Example...\n');

    // Initialize the debug integration
    const debug = new DebugIntegration({
        autoStart: true,
        enableMonitoring: true,
        enableAlerting: true,
        configPath: path.join(__dirname, 'debug-config.json'),
        dataDir: path.join(__dirname, 'debug-data')
    });

    try {
        // Example 1: Basic Debugging Session
        console.log('📊 Example 1: Creating Debug Session');
        const session = await debug.createDebugSession({
            sessionId: 'example-session-1',
            enableVisualVerification: true,
            enablePerformanceMonitoring: true,
            enableErrorAnalysis: true
        });
        console.log('✅ Session created:', session.id);
        console.log('📅 Started at:', session.startTime);

        // Example 2: Performance Monitoring
        console.log('\n⚡ Example 2: Performance Monitoring');
        if (debug.components.performanceMonitor) {
            const metrics = await debug.components.performanceMonitor.getCurrentMetrics();
            console.log('📈 Current Metrics:');
            console.log(`   CPU: ${metrics.system?.cpu?.usage || 'N/A'}%`);
            console.log(`   Memory: ${metrics.system?.memory?.usagePercent || 'N/A'}%`);
            console.log(`   Uptime: ${metrics.system?.uptime || 'N/A'}s`);
        }

        // Example 3: Visual Verification (Mock)
        console.log('\n👁️  Example 3: Visual Verification');
        if (debug.components.visualVerifier) {
            // Mock visual verification (would normally take a real screenshot)
            const mockResult = {
                success: true,
                elements: {
                    detected: ['header', 'navigation', 'content', 'footer'],
                    missing: [],
                    unexpected: []
                },
                uiState: {
                    loaded: true,
                    responsive: true,
                    accessible: true
                },
                confidence: 0.95,
                analysis: 'UI elements detected successfully'
            };
            console.log('🖼️  Visual verification result:', mockResult.success ? '✅ PASSED' : '❌ FAILED');
            console.log(`   Confidence: ${(mockResult.confidence * 100).toFixed(1)}%`);
            console.log(`   Elements detected: ${mockResult.elements.detected.length}`);
        }

        // Example 4: Error Analysis
        console.log('\n🔍 Example 4: Error Analysis');
        if (debug.components.errorAnalyzer) {
            // Mock error analysis
            const mockErrors = [
                {
                    type: 'timeout',
                    message: 'Element not found within timeout',
                    frequency: 3,
                    lastOccurrence: new Date().toISOString()
                }
            ];
            
            console.log('📊 Error Analysis:');
            console.log(`   Total errors: ${mockErrors.length}`);
            mockErrors.forEach(error => {
                console.log(`   - ${error.type}: ${error.message} (${error.frequency} occurrences)`);
            });
        }

        // Example 5: Self-Debugging Loop (Mock)
        console.log('\n🔄 Example 5: Self-Debugging Loop');
        if (debug.components.selfDebuggingLoop) {
            // Mock self-debugging execution
            const mockDebugResult = {
                sessionId: session.id,
                attempts: 2,
                success: true,
                strategy: 'adaptive',
                issuesFound: ['element_timeout', 'network_latency'],
                solutionsApplied: ['increased_timeout', 'retry_mechanism'],
                learningData: {
                    pattern: 'timeout_issues',
                    confidence: 0.85,
                    recommendedAction: 'increase_wait_times'
                }
            };
            
            console.log('🤖 Self-Debugging Result:', mockDebugResult.success ? '✅ RESOLVED' : '❌ FAILED');
            console.log(`   Attempts: ${mockDebugResult.attempts}`);
            console.log(`   Strategy: ${mockDebugResult.strategy}`);
            console.log(`   Issues found: ${mockDebugResult.issuesFound.length}`);
            console.log(`   Solutions applied: ${mockDebugResult.solutionsApplied.length}`);
        }

        // Example 6: Log Analysis
        console.log('\n📝 Example 6: Log Analysis');
        if (debug.components.logger) {
            // Mock log analysis
            const mockLogStats = {
                totalLogs: 1250,
                errorLogs: 15,
                warningLogs: 32,
                infoLogs: 892,
                debugLogs: 311,
                timeRange: {
                    start: new Date(Date.now() - 3600000).toISOString(),
                    end: new Date().toISOString()
                }
            };
            
            console.log('📊 Log Statistics:');
            console.log(`   Total logs: ${mockLogStats.totalLogs}`);
            console.log(`   Errors: ${mockLogStats.errorLogs} (${((mockLogStats.errorLogs / mockLogStats.totalLogs) * 100).toFixed(1)}%)`);
            console.log(`   Warnings: ${mockLogStats.warningLogs} (${((mockLogStats.warningLogs / mockLogStats.totalLogs) * 100).toFixed(1)}%)`);
            console.log(`   Time range: Last 1 hour`);
        }

        // Example 7: Generate Report
        console.log('\n📄 Example 7: Generating Report');
        const report = await debug.generateSessionReport(session.id, {
            format: 'json',
            includeScreenshots: true,
            includeMetrics: true,
            includeErrors: true
        });
        console.log('📋 Report generated:');
        console.log(`   Session ID: ${report.sessionId}`);
        console.log(`   Duration: ${report.summary.duration}ms`);
        console.log(`   Errors: ${report.summary.errors}`);
        console.log(`   Timestamp: ${report.timestamp}`);

        // Example 8: System Diagnostics
        console.log('\n🏥 Example 8: System Diagnostics');
        if (debug.components.diagnosticTools) {
            // Mock diagnostic results
            const mockDiagnostics = {
                overall: 'healthy',
                checks: {
                    filesystem: { status: 'healthy', usage: '45%' },
                    memory: { status: 'healthy', available: '2.1GB' },
                    network: { status: 'healthy', latency: '12ms' },
                    dependencies: { status: 'healthy', missing: [] }
                },
                recommendations: [
                    'Consider increasing log rotation frequency',
                    'Monitor memory usage during peak hours'
                ]
            };
            
            console.log('🏥 System Health:', mockDiagnostics.overall.toUpperCase());
            console.log('📋 Check Results:');
            Object.entries(mockDiagnostics.checks).forEach(([check, result]) => {
                console.log(`   ${check}: ${result.status} (${result.usage || result.available || result.latency || result.missing.length + ' missing'})`);
            });
            console.log(`💡 Recommendations: ${mockDiagnostics.recommendations.length}`);
        }

        // Close the session
        console.log('\n🔚 Closing Debug Session...');
        const closedSession = await debug.closeDebugSession(session.id, {
            generateReport: true,
            includeSteps: true
        });
        console.log('✅ Session closed successfully');
        console.log(`📊 Session duration: ${Date.now() - new Date(closedSession.startTime).getTime()}ms`);

    } catch (error) {
        console.error('❌ Error during debugging:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        // Get final status
        const status = debug.getStatus();
        console.log('\n📊 Final Status:');
        console.log(`   Components initialized: ${Object.keys(status.components).length}`);
        console.log(`   Total sessions: ${status.metrics.totalSessions}`);
        console.log(`   Active sessions: ${status.metrics.activeSessions}`);
        console.log(`   Total errors: ${status.metrics.totalErrors}`);

        // Stop the debug integration
        console.log('\n🛑 Stopping Debug Infrastructure...');
        await debug.stop();
        console.log('✅ Debug Infrastructure stopped');
    }
}

// Example: Advanced Usage with Custom Configuration
async function advancedExample() {
    console.log('\n🚀 Advanced Example with Custom Configuration...\n');

    const customConfig = {
        debugManager: {
            enableGLMIntegration: true,
            screenshotFormat: 'png',
            visualAnalysis: true,
            elementDetection: true
        },
        logger: {
            level: 'debug',
            transports: ['console', 'file'],
            rotation: {
                maxSize: '5MB',
                maxFiles: 10
            }
        },
        visualVerifier: {
            screenshotQuality: 95,
            elementDetection: true,
            uiValidation: true,
            comparisonThreshold: 0.9
        },
        selfDebuggingLoop: {
            maxAttempts: 5,
            strategy: 'adaptive',
            learningEnabled: true,
            timeoutMs: 30000
        },
        performanceMonitor: {
            samplingInterval: 500,
            alertThreshold: 85,
            enableRealTimeAlerts: true
        }
    };

    const debug = new DebugIntegration({
        ...customConfig,
        autoStart: true,
        enableMonitoring: true,
        enableAlerting: true
    });

    try {
        // Run comprehensive debugging with all features
        const results = await debug.runDebugging({
            sessionId: 'advanced-example-session',
            enableSelfDebugging: true,
            enableVisualVerification: true,
            enablePerformanceMonitoring: true,
            enableErrorAnalysis: true,
            enableDiagnostics: true,
            maxAttempts: 5,
            timeout: 60000
        });

        console.log('🎯 Comprehensive Debugging Results:');
        console.log(`   Success: ${results.success ? '✅' : '❌'}`);
        console.log(`   Duration: ${results.duration}ms`);
        console.log(`   Steps completed: ${results.steps.length}`);
        console.log(`   Errors encountered: ${results.errors.length}`);

        // Display step results
        results.steps.forEach(step => {
            console.log(`   ${step.step}: ${step.success ? '✅' : '❌'}`);
        });

        if (results.errors.length > 0) {
            console.log('\n❌ Errors:');
            results.errors.forEach(error => {
                console.log(`   ${error.step}: ${error.error}`);
            });
        }

    } catch (error) {
        console.error('❌ Advanced example failed:', error.message);
    } finally {
        await debug.stop();
    }
}

// Example: Dashboard Integration
async function dashboardExample() {
    console.log('\n🌐 Dashboard Integration Example...\n');

    const debug = new DebugIntegration({
        autoStart: true,
        enableMonitoring: true,
        webSocketServer: {
            port: 3001,
            enableAuth: false,
            maxConnections: 50
        }
    });

    try {
        // Simulate real-time data updates
        console.log('📡 Starting real-time monitoring...');
        
        // Create multiple sessions to simulate activity
        const sessions = [];
        for (let i = 1; i <= 3; i++) {
            const session = await debug.createDebugSession({
                sessionId: `dashboard-session-${i}`,
                enablePerformanceMonitoring: true
            });
            sessions.push(session);
            console.log(`📊 Created session ${i}: ${session.id}`);
        }

        // Simulate some activity
        console.log('⏳ Simulating debugging activity...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Close all sessions
        for (const session of sessions) {
            await debug.closeDebugSession(session.id);
            console.log(`🔚 Closed session: ${session.id}`);
        }

        console.log('✅ Dashboard example completed');
        console.log('🌐 Dashboard available at: http://localhost:3000');
        console.log('📡 WebSocket server running on: ws://localhost:3001');

    } catch (error) {
        console.error('❌ Dashboard example failed:', error.message);
    } finally {
        await debug.stop();
    }
}

// Run examples
async function runAllExamples() {
    try {
        await main();
        await advancedExample();
        await dashboardExample();
        
        console.log('\n🎉 All examples completed successfully!');
        console.log('\n📚 Next Steps:');
        console.log('   1. Start the dashboard: npm run dashboard');
        console.log('   2. View logs: npm run logs');
        console.log('   3. Run diagnostics: npm run run-diagnostics');
        console.log('   4. Generate reports: npm run generate-report');
        
    } catch (error) {
        console.error('❌ Examples failed:', error.message);
        process.exit(1);
    }
}

// Run if this file is executed directly
if (require.main === module) {
    runAllExamples();
}

module.exports = {
    main,
    advancedExample,
    dashboardExample,
    runAllExamples
};