/**
 * Test Reporter Utility
 * 
 * Provides comprehensive logging and reporting functionality
 * for test execution, results, and analysis.
 */

const fs = require('fs').promises;
const path = require('path');
const { createWriteStream } = require('fs');

class TestReporter {
    constructor(options = {}) {
        this.options = {
            outputDir: options.outputDir || './test-results',
            testName: options.testName || 'test',
            logLevel: options.logLevel || 'info',
            includeScreenshots: options.includeScreenshots !== false,
            ...options
        };
        
        this.logFile = null;
        this.logStream = null;
        this.testData = {
            startTime: new Date().toISOString(),
            endTime: null,
            phases: [],
            steps: [],
            errors: [],
            metrics: {},
            screenshots: []
        };
        
        this.initializeLogging();
    }

    /**
     * Initialize logging system
     */
    async initializeLogging() {
        try {
            // Ensure output directory exists
            await fs.mkdir(this.options.outputDir, { recursive: true });
            
            // Create log file
            const logFileName = `${this.options.testName}-${Date.now()}.log`;
            this.logFile = path.join(this.options.outputDir, logFileName);
            this.logStream = createWriteStream(this.logFile, { flags: 'a' });
            
            // Write initial log entry
            this.writeLog('info', `Test started: ${this.testData.startTime}`);
            
        } catch (error) {
            console.error('Failed to initialize logging:', error);
        }
    }

    /**
     * Write entry to log file
     */
    writeLog(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level: level.toUpperCase(),
            message,
            data
        };
        
        const logLine = JSON.stringify(logEntry) + '\n';
        
        if (this.logStream) {
            this.logStream.write(logLine);
        }
        
        // Also log to console with appropriate formatting
        const levelEmoji = {
            info: 'ℹ️',
            warn: '⚠️',
            error: '❌',
            debug: '🔍'
        };
        
        console.log(`${levelEmoji[level] || ''} ${message}`);
    }

    /**
     * Log test step
     */
    async logStep(stepName, details = null) {
        const step = {
            name: stepName,
            timestamp: new Date().toISOString(),
            details
        };
        
        this.testData.steps.push(step);
        this.writeLog('info', `Step: ${stepName}`, details);
    }

    /**
     * Log phase result
     */
    async logPhaseResult(phaseNumber, phaseName, results) {
        const phase = {
            number: phaseNumber,
            name: phaseName,
            timestamp: new Date().toISOString(),
            success: results.success,
            duration: results.duration,
            checks: results.checks || [],
            errors: results.errors || [],
            metrics: results.metrics || {}
        };
        
        this.testData.phases.push(phase);
        
        this.writeLog('info', `Phase ${phaseNumber} (${phaseName}): ${results.success ? 'PASSED' : 'FAILED'}`, {
            duration: results.duration,
            checks: results.checks?.length || 0,
            errors: results.errors?.length || 0
        });
    }

    /**
     * Log tool execution
     */
    async logToolExecution(toolName, input, output, duration) {
        const execution = {
            tool: toolName,
            input,
            output: output.isError ? null : output.content[0].text,
            error: output.isError ? output.content[0].text : null,
            duration,
            timestamp: new Date().toISOString()
        };
        
        this.testData.metrics[toolName] = this.testData.metrics[toolName] || [];
        this.testData.metrics[toolName].push(execution);
        
        this.writeLog('info', `Tool execution: ${toolName}`, {
            duration,
            success: !output.isError
        });
    }

    /**
     * Log error
     */
    async logError(message, error = null) {
        const errorEntry = {
            message,
            error: error ? {
                name: error.name,
                message: error.message,
                stack: error.stack
            } : null,
            timestamp: new Date().toISOString()
        };
        
        this.testData.errors.push(errorEntry);
        this.writeLog('error', message, error);
    }

    /**
     * Log screenshot
     */
    async logScreenshot(description, screenshotData) {
        if (!this.options.includeScreenshots) return;
        
        const screenshot = {
            description,
            data: screenshotData,
            timestamp: new Date().toISOString()
        };
        
        this.testData.screenshots.push(screenshot);
        
        // Save screenshot to file
        const fileName = `screenshot-${Date.now()}.png`;
        const filePath = path.join(this.options.outputDir, fileName);
        
        try {
            if (typeof screenshotData === 'string') {
                // Base64 data
                const buffer = Buffer.from(screenshotData, 'base64');
                await fs.writeFile(filePath, buffer);
            } else {
                // Buffer data
                await fs.writeFile(filePath, screenshotData);
            }
            
            this.writeLog('info', `Screenshot saved: ${fileName}`);
            
        } catch (error) {
            this.writeLog('error', `Failed to save screenshot: ${error.message}`);
        }
    }

    /**
     * Log performance metrics
     */
    async logMetrics(category, metrics) {
        this.testData.metrics[category] = {
            ...this.testData.metrics[category],
            ...metrics,
            timestamp: new Date().toISOString()
        };
        
        this.writeLog('info', `Metrics: ${category}`, metrics);
    }

    /**
     * Generate comprehensive test report
     */
    async generateReport(reportData) {
        const reportFileName = `${this.options.testName}-report-${Date.now()}.json`;
        const reportPath = path.join(this.options.outputDir, reportFileName);
        
        const report = {
            ...reportData,
            testExecution: {
                ...this.testData,
                endTime: new Date().toISOString()
            },
            reportGeneration: {
                timestamp: new Date().toISOString(),
                fileName: reportFileName,
                version: '1.0.0'
            }
        };
        
        try {
            // Save JSON report
            await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
            
            // Generate HTML report
            await this.generateHTMLReport(report);
            
            // Generate summary text report
            await this.generateTextSummary(report);
            
            this.writeLog('info', `Report generated: ${reportPath}`);
            
            return reportPath;
            
        } catch (error) {
            this.writeLog('error', `Failed to generate report: ${error.message}`);
            throw error;
        }
    }

    /**
     * Generate HTML report
     */
    async generateHTMLReport(report) {
        const htmlFileName = `${this.options.testName}-report-${Date.now()}.html`;
        const htmlPath = path.join(this.options.outputDir, htmlFileName);
        
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${report.testInfo.name} Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e0e0e0;
        }
        .success { color: #28a745; }
        .failure { color: #dc3545; }
        .warning { color: #ffc107; }
        .info { color: #17a2b8; }
        
        .phase {
            margin: 20px 0;
            padding: 15px;
            border-left: 4px solid #007bff;
            background-color: #f8f9fa;
        }
        .phase.success { border-left-color: #28a745; }
        .phase.failure { border-left-color: #dc3545; }
        
        .metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        .metric {
            padding: 15px;
            background-color: #f8f9fa;
            border-radius: 6px;
            text-align: center;
        }
        .metric-value {
            font-size: 2em;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .metric-label {
            color: #666;
            font-size: 0.9em;
        }
        
        .check-list {
            list-style: none;
            padding: 0;
        }
        .check-item {
            padding: 8px 0;
            border-bottom: 1px solid #eee;
        }
        .check-item:last-child {
            border-bottom: none;
        }
        
        .error-list {
            background-color: #f8d7da;
            padding: 15px;
            border-radius: 6px;
            margin: 10px 0;
        }
        
        .timeline {
            position: relative;
            padding-left: 30px;
        }
        .timeline::before {
            content: '';
            position: absolute;
            left: 10px;
            top: 0;
            bottom: 0;
            width: 2px;
            background-color: #007bff;
        }
        .timeline-item {
            position: relative;
            margin-bottom: 20px;
            padding: 10px 15px;
            background-color: #f8f9fa;
            border-radius: 6px;
        }
        .timeline-item::before {
            content: '';
            position: absolute;
            left: -25px;
            top: 15px;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background-color: #007bff;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background-color: #f8f9fa;
            font-weight: 600;
        }
        
        .badge {
            display: inline-block;
            padding: 4px 8px;
            font-size: 0.8em;
            font-weight: 600;
            border-radius: 12px;
            text-transform: uppercase;
        }
        .badge.success { background-color: #d4edda; color: #155724; }
        .badge.failure { background-color: #f8d7da; color: #721c24; }
        .badge.warning { background-color: #fff3cd; color: #856404; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${report.testInfo.name}</h1>
            <p>Generated: ${report.reportGeneration.timestamp}</p>
            <p>Duration: ${(report.testInfo.duration / 1000).toFixed(2)}s</p>
            <div class="badge ${report.summary.overallSuccess ? 'success' : 'failure'}">
                ${report.summary.overallSuccess ? 'SUCCESS' : 'FAILURE'}
            </div>
        </div>
        
        <div class="metrics">
            <div class="metric">
                <div class="metric-value ${report.summary.criteriaMet >= 4 ? 'success' : 'failure'}">
                    ${report.summary.criteriaMet}/4
                </div>
                <div class="metric-label">Success Criteria Met</div>
            </div>
            <div class="metric">
                <div class="metric-value ${report.summary.passedPhases > 0 ? 'success' : 'failure'}">
                    ${report.summary.passedPhases}
                </div>
                <div class="metric-label">Phases Passed</div>
            </div>
            <div class="metric">
                <div class="metric-value ${report.summary.failedPhases === 0 ? 'success' : 'failure'}">
                    ${report.summary.failedPhases}
                </div>
                <div class="metric-label">Phases Failed</div>
            </div>
            <div class="metric">
                <div class="metric-value info">
                    ${(report.testInfo.duration / 1000).toFixed(1)}s
                </div>
                <div class="metric-label">Total Duration</div>
            </div>
        </div>
        
        <h2>Success Criteria</h2>
        <table>
            <thead>
                <tr>
                    <th>Criteria</th>
                    <th>Required</th>
                    <th>Achieved</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Gmail Login Success</td>
                    <td>True</td>
                    <td>${report.successCriteria.gmailLoginSuccess}</td>
                    <td class="${report.successCriteria.gmailLoginSuccess ? 'success' : 'failure'}">
                        ${report.successCriteria.gmailLoginSuccess ? '✅' : '❌'}
                    </td>
                </tr>
                <tr>
                    <td>Detection Bypass Rate</td>
                    <td>≥95%</td>
                    <td>${(report.successCriteria.detectionBypassRate * 100).toFixed(1)}%</td>
                    <td class="${report.successCriteria.detectionBypassRate >= 0.95 ? 'success' : 'failure'}">
                        ${report.successCriteria.detectionBypassRate >= 0.95 ? '✅' : '❌'}
                    </td>
                </tr>
                <tr>
                    <td>Execution Speed Improvement</td>
                    <td>≥8x</td>
                    <td>${(report.successCriteria.executionSpeedImprovement || 0).toFixed(1)}x</td>
                    <td class="${(report.successCriteria.executionSpeedImprovement || 0) >= 8 ? 'success' : 'failure'}">
                        ${(report.successCriteria.executionSpeedImprovement || 0) >= 8 ? '✅' : '❌'}
                    </td>
                </tr>
                <tr>
                    <td>Modality Optimizer Accuracy</td>
                    <td>≥85%</td>
                    <td>${(report.successCriteria.modalityOptimizerAccuracy * 100).toFixed(1)}%</td>
                    <td class="${report.successCriteria.modalityOptimizerAccuracy >= 0.85 ? 'success' : 'failure'}">
                        ${report.successCriteria.modalityOptimizerAccuracy >= 0.85 ? '✅' : '❌'}
                    </td>
                </tr>
            </tbody>
        </table>
        
        <h2>Phase Results</h2>
        <div class="timeline">
            ${report.testExecution.phases.map(phase => `
                <div class="timeline-item">
                    <h3>Phase ${phase.number}: ${phase.name}</h3>
                    <div class="badge ${phase.success ? 'success' : 'failure'}">
                        ${phase.success ? 'PASSED' : 'FAILED'}
                    </div>
                    <p>Duration: ${(phase.duration / 1000).toFixed(2)}s</p>
                    ${phase.errors.length > 0 ? `
                        <div class="error-list">
                            <strong>Errors:</strong>
                            <ul>
                                ${phase.errors.map(error => `<li>${error}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>
        
        ${report.testExecution.errors.length > 0 ? `
            <h2 class="failure">Errors</h2>
            <div class="error-list">
                ${report.testExecution.errors.map(error => `
                    <div>
                        <strong>${error.message}</strong>
                        <br>
                        <small>${error.timestamp}</small>
                        ${error.error ? `<pre>${error.error.stack}</pre>` : ''}
                    </div>
                `).join('')}
            </div>
        ` : ''}
        
        <div class="footer">
            <p><em>Report generated by CDP Automation Test Suite v1.0.0</em></p>
        </div>
    </div>
</body>
</html>`;
        
        await fs.writeFile(htmlPath, html);
        this.writeLog('info', `HTML report generated: ${htmlFileName}`);
    }

    /**
     * Generate text summary report
     */
    async generateTextSummary(report) {
        const summaryFileName = `${this.options.testName}-summary-${Date.now()}.txt`;
        const summaryPath = path.join(this.options.outputDir, summaryFileName);
        
        const summary = `
═══════════════════════════════════════════════════════════
${report.testInfo.name} - TEST SUMMARY
═══════════════════════════════════════════════════════════

Generated: ${report.reportGeneration.timestamp}
Duration: ${(report.testInfo.duration / 1000).toFixed(2)}s
Overall Status: ${report.summary.overallSuccess ? 'SUCCESS ✅' : 'FAILURE ❌'}

SUCCESS CRITERIA
───────────────────────────────────────────────────────────────
✅ Gmail Login Success: ${report.successCriteria.gmailLoginSuccess}
${(report.successCriteria.detectionBypassRate || 0) >= 0.95 ? '✅' : '❌'} Detection Bypass Rate: ${((report.successCriteria.detectionBypassRate || 0) * 100).toFixed(1)}% (required: ≥95%)
${(report.successCriteria.executionSpeedImprovement || 0) >= 8 ? '✅' : '❌'} Execution Speed Improvement: ${(report.successCriteria.executionSpeedImprovement || 0).toFixed(1)}x (required: ≥8x)
${(report.successCriteria.modalityOptimizerAccuracy || 0) >= 0.85 ? '✅' : '❌'} Modality Optimizer Accuracy: ${((report.successCriteria.modalityOptimizerAccuracy || 0) * 100).toFixed(1)}% (required: ≥85%)

Criteria Met: ${report.summary.criteriaMet}/4

PHASE RESULTS
───────────────────────────────────────────────────────────────
${report.testExecution.phases.map(phase => `
Phase ${phase.number}: ${phase.name}
  Status: ${phase.success ? 'PASSED ✅' : 'FAILED ❌'}
  Duration: ${(phase.duration / 1000).toFixed(2)}s
  Checks: ${phase.checks?.length || 0}
  Errors: ${phase.errors?.length || 0}
${phase.errors.length > 0 ? `  Errors:\n${phase.errors.map(error => `    - ${error}`).join('\n')}` : ''}
`).join('')}

${report.testExecution.errors.length > 0 ? `
ERRORS
───────────────────────────────────────────────────────────────
${report.testExecution.errors.map(error => `
${error.message}
${error.timestamp}
${error.error ? `Stack: ${error.error.stack}` : ''}
`).join('\n\n')}
` : ''}

═══════════════════════════════════════════════════════════
FINAL SCORE: ${report.summary.criteriaMet}/4 criteria met
SYSTEM STATUS: ${report.summary.overallSuccess ? 'FULLY OPERATIONAL - READY FOR PRODUCTION' : 'NOT READY - CRITICAL ISSUES REMAIN'}
═══════════════════════════════════════════════════════════
`;
        
        await fs.writeFile(summaryPath, summary);
        this.writeLog('info', `Text summary generated: ${summaryFileName}`);
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            if (this.logStream) {
                this.logStream.end();
                this.writeLog('info', 'Test completed, logging closed');
            }
        } catch (error) {
            console.error('Failed to cleanup reporter:', error);
        }
    }
}

module.exports = TestReporter;