const fs = require('fs');
const path = require('path');
const { getConfig } = require('./test-config');
const testLogger = require('./test-logger');

class ResultAnalyzer {
  constructor() {
    this.config = getConfig();
    this.analysisResults = {
      startTime: new Date().toISOString(),
      endTime: null,
      duration: 0,
      testResults: {},
      overallSuccess: false,
      successCriteria: {
        met: [],
        failed: [],
        totalScore: 0,
        maxScore: 4
      },
      performance: {
        executionTimes: [],
        averageExecutionTime: 0,
        successRate: 0,
        detectionRate: 0
      },
      recommendations: [],
      summary: ''
    };
  }

  // Load test results from files
  async loadTestResults() {
    const testName = 'ResultAnalyzer';
    testLogger.startTest(testName, { phase: 'loading_results' });

    try {
      const debugDir = this.config.screenshots.directory;
      const files = fs.readdirSync(debugDir);
      
      // Find the most recent test result files
      const resultFiles = {
        gmailLogin: this.findLatestFile(files, debugDir, 'gmail-login-test-', '.json'),
        runtimePatching: this.findLatestFile(files, debugDir, 'runtime-patching-test-', '.json'),
        extension: this.findLatestFile(files, debugDir, 'extension-test-', '.json'),
        stealthFlags: this.findLatestFile(files, debugDir, 'stealth-verification-', '.json')
      };

      // Load each test result
      for (const [testType, filename] of Object.entries(resultFiles)) {
        if (filename) {
          const filePath = path.join(debugDir, filename);
          try {
            const content = fs.readFileSync(filePath, 'utf8');
            this.analysisResults.testResults[testType] = JSON.parse(content);
            testLogger.logStep(testName, `Loaded ${testType} results`, 'success', { filename });
          } catch (error) {
            testLogger.logError(testName, error, { phase: 'load_results', testType, filename });
            this.analysisResults.testResults[testType] = { error: error.message, success: false };
          }
        } else {
          testLogger.logStep(testName, `No results found for ${testType}`, 'warning');
          this.analysisResults.testResults[testType] = { error: 'No results file found', success: false };
        }
      }

      testLogger.logStep(testName, 'Test results loading completed', 'success');
      return true;
    } catch (error) {
      testLogger.logError(testName, error, { phase: 'loading_results' });
      return false;
    }
  }

  // Find the latest file matching a pattern
  findLatestFile(files, directory, prefix, extension) {
    const matchingFiles = files.filter(file => 
      file.startsWith(prefix) && file.endsWith(extension)
    );
    
    if (matchingFiles.length === 0) return null;
    
    // Sort by filename (which includes timestamp) to get the latest
    matchingFiles.sort();
    return matchingFiles[matchingFiles.length - 1];
  }

  // Analyze Gmail login test results
  analyzeGmailLoginResults() {
    const testName = 'ResultAnalyzer';
    const results = this.analysisResults.testResults.gmailLogin;
    
    if (!results || results.error) {
      testLogger.logStep(testName, 'Gmail login results not available for analysis', 'warning');
      return false;
    }

    testLogger.logStep(testName, 'Analyzing Gmail login results', 'info');

    const criteria = this.config.successCriteria;
    const criteriaResults = [];

    // Check login completion
    const loginCompleted = criteria.loginCompleted.validator(results);
    criteriaResults.push({
      name: criteria.loginCompleted.name,
      passed: loginCompleted,
      actual: results.isLoggedIn,
      expected: true
    });

    // Check no detection
    const noDetection = criteria.noDetection.validator(results);
    criteriaResults.push({
      name: criteria.noDetection.name,
      passed: noDetection,
      actual: results.detectionAttempts,
      expected: 0
    });

    // Check no errors
    const noErrors = criteria.noErrors.validator(results);
    criteriaResults.push({
      name: criteria.noErrors.name,
      passed: noErrors,
      actual: results.errors?.length || 0,
      expected: 0
    });

    // Check fast execution
    const fastExecution = criteria.fastExecution.validator(results);
    criteriaResults.push({
      name: criteria.fastExecution.name,
      passed: fastExecution,
      actual: results.duration,
      expected: `< ${criteria.fastExecution.threshold}ms`
    });

    // Update success criteria
    criteriaResults.forEach(criteria => {
      if (criteria.passed) {
        this.analysisResults.successCriteria.met.push(criteria);
      } else {
        this.analysisResults.successCriteria.failed.push(criteria);
      }
    });

    // Add performance data
    this.analysisResults.performance.executionTimes.push({
      test: 'gmailLogin',
      duration: results.duration,
      success: results.success
    });

    const passedCount = criteriaResults.filter(c => c.passed).length;
    testLogger.logStep(testName, `Gmail login analysis: ${passedCount}/4 criteria met`, 
                      passedCount === 4 ? 'success' : 'warning');

    return passedCount === 4;
  }

  // Analyze runtime patching test results
  analyzeRuntimePatchingResults() {
    const testName = 'ResultAnalyzer';
    const results = this.analysisResults.testResults.runtimePatching;
    
    if (!results || results.error) {
      testLogger.logStep(testName, 'Runtime patching results not available for analysis', 'warning');
      return false;
    }

    testLogger.logStep(testName, 'Analyzing runtime patching results', 'info');

    const testResults = results.tests || [];
    const passedTests = testResults.filter(test => test.success);
    const successRate = (passedTests.length / testResults.length) * 100;

    // Check critical tests
    const criticalTests = ['addBinding Mode Test', 'Detection After CDP Commands', 'No Runtime.enable Detection Window'];
    const criticalTestResults = testResults.filter(test => criticalTests.includes(test.name));
    const criticalPassed = criticalTestResults.filter(test => test.success);

    const analysis = {
      totalTests: testResults.length,
      passedTests: passedTests.length,
      successRate: Math.round(successRate),
      criticalTests: criticalTests.length,
      criticalPassed: criticalPassed.length,
      detectionAttempts: results.detectionAttempts || 0,
      patchingMode: results.patchingMode
    };

    // Add performance data
    this.analysisResults.performance.executionTimes.push({
      test: 'runtimePatching',
      duration: results.duration,
      success: results.success
    });

    const success = analysis.successRate >= 75 && analysis.criticalPassed === analysis.criticalTests;
    
    testLogger.logStep(testName, `Runtime patching analysis: ${analysis.successRate}% success rate`, 
                      success ? 'success' : 'warning');

    return success;
  }

  // Analyze extension test results
  analyzeExtensionResults() {
    const testName = 'ResultAnalyzer';
    const results = this.analysisResults.testResults.extension;
    
    if (!results || results.error) {
      testLogger.logStep(testName, 'Extension results not available for analysis', 'warning');
      return false;
    }

    testLogger.logStep(testName, 'Analyzing extension results', 'info');

    const testResults = results.tests || [];
    const passedTests = testResults.filter(test => test.success);
    const successRate = (passedTests.length / testResults.length) * 100;

    // Check critical functionality
    const criticalFunctions = ['CDP Functionality', 'State Capture and Injection', 'Debugger API Integration'];
    const criticalResults = testResults.filter(test => criticalFunctions.includes(test.name));
    const criticalPassed = criticalResults.filter(test => test.success);

    const analysis = {
      extensionLoaded: results.extensionLoaded,
      totalTests: testResults.length,
      passedTests: passedTests.length,
      successRate: Math.round(successRate),
      criticalFunctions: criticalFunctions.length,
      criticalPassed: criticalPassed.length,
      cdpFunctional: results.cdpFunctional,
      stateCaptureWorking: results.stateCaptureWorking,
      debuggerAPIWorking: results.debuggerAPIWorking
    };

    // Add performance data
    this.analysisResults.performance.executionTimes.push({
      test: 'extension',
      duration: results.duration,
      success: results.success
    });

    const success = analysis.extensionLoaded && analysis.successRate >= 75 && analysis.criticalPassed === analysis.criticalFunctions;
    
    testLogger.logStep(testName, `Extension analysis: ${analysis.successRate}% success rate`, 
                      success ? 'success' : 'warning');

    return success;
  }

  // Calculate overall performance metrics
  calculatePerformanceMetrics() {
    const testName = 'ResultAnalyzer';
    testLogger.logStep(testName, 'Calculating performance metrics', 'info');

    const executionTimes = this.analysisResults.performance.executionTimes;
    
    if (executionTimes.length === 0) {
      testLogger.logStep(testName, 'No execution times available for analysis', 'warning');
      return;
    }

    // Calculate average execution time
    const totalTime = executionTimes.reduce((sum, test) => sum + test.duration, 0);
    this.analysisResults.performance.averageExecutionTime = Math.round(totalTime / executionTimes.length);

    // Calculate success rate
    const successfulTests = executionTimes.filter(test => test.success).length;
    this.analysisResults.performance.successRate = Math.round((successfulTests / executionTimes.length) * 100);

    // Calculate detection rate
    const gmailResults = this.analysisResults.testResults.gmailLogin;
    const runtimeResults = this.analysisResults.testResults.runtimePatching;
    const totalDetections = (gmailResults?.detectionAttempts || 0) + (runtimeResults?.detectionAttempts || 0);
    this.analysisResults.performance.detectionRate = totalDetections;

    testLogger.logStep(testName, 'Performance metrics calculated', 'success', {
      averageTime: this.analysisResults.performance.averageExecutionTime,
      successRate: this.analysisResults.performance.successRate,
      detectionRate: this.analysisResults.performance.detectionRate
    });
  }

  // Generate recommendations based on analysis
  generateRecommendations() {
    const testName = 'ResultAnalyzer';
    testLogger.logStep(testName, 'Generating recommendations', 'info');

    const recommendations = [];
    const criteria = this.analysisResults.successCriteria;
    const performance = this.analysisResults.performance;

    // Success criteria recommendations
    if (criteria.failed.length > 0) {
      criteria.failed.forEach(failure => {
        switch (failure.name) {
          case 'Login completed':
            recommendations.push({
              type: 'critical',
              category: 'login',
              message: 'Gmail login failed - check credentials and network connectivity',
              action: 'Verify email/password and test network connection'
            });
            break;
          case 'No detection':
            recommendations.push({
              type: 'critical',
              category: 'detection',
              message: 'Detection attempts detected - review stealth configuration',
              action: 'Check Chrome flags and runtime patching setup'
            });
            break;
          case 'No errors':
            recommendations.push({
              type: 'warning',
              category: 'errors',
              message: 'Errors occurred during execution',
              action: 'Review error logs and fix underlying issues'
            });
            break;
          case 'Fast execution':
            recommendations.push({
              type: 'performance',
              category: 'speed',
              message: `Execution too slow: ${failure.actual}ms`,
              action: 'Optimize timeouts and reduce unnecessary waits'
            });
            break;
        }
      });
    }

    // Performance recommendations
    if (performance.averageExecutionTime > this.config.performance.warningThreshold) {
      recommendations.push({
        type: 'performance',
        category: 'optimization',
        message: `Average execution time ${performance.averageExecutionTime}ms exceeds recommended threshold`,
        action: 'Consider optimizing test flow and reducing delays'
      });
    }

    if (performance.successRate < this.config.performance.minSuccessRate) {
      recommendations.push({
        type: 'critical',
        category: 'reliability',
        message: `Success rate ${performance.successRate}% below required ${this.config.performance.minSuccessRate}%`,
        action: 'Review test configuration and fix failing components'
      });
    }

    if (performance.detectionRate > this.config.performance.maxDetectionRate) {
      recommendations.push({
        type: 'critical',
        category: 'stealth',
        message: `Detection rate ${performance.detectionRate} exceeds acceptable threshold`,
        action: 'Review and enhance stealth configuration'
      });
    }

    // Component-specific recommendations
    const gmailResults = this.analysisResults.testResults.gmailLogin;
    if (gmailResults && gmailResults.steps) {
      const failedSteps = gmailResults.steps.filter(step => !step.success);
      if (failedSteps.length > 0) {
        recommendations.push({
          type: 'warning',
          category: 'gmail_flow',
          message: `${failedSteps.length} Gmail login steps failed`,
          action: `Review failed steps: ${failedSteps.map(s => s.step).join(', ')}`
        });
      }
    }

    const runtimeResults = this.analysisResults.testResults.runtimePatching;
    if (runtimeResults && !runtimeResults.success) {
      recommendations.push({
        type: 'critical',
        category: 'runtime_patching',
        message: 'Runtime patching tests failed',
        action: 'Verify rebrowser-patches installation and configuration'
      });
    }

    const extensionResults = this.analysisResults.testResults.extension;
    if (extensionResults && !extensionResults.extensionLoaded) {
      recommendations.push({
        type: 'critical',
        category: 'extension',
        message: 'Extension failed to load',
        action: 'Check extension manifest and loading configuration'
      });
    }

    this.analysisResults.recommendations = recommendations;
    
    testLogger.logStep(testName, `Generated ${recommendations.length} recommendations`, 'success');
  }

  // Generate comprehensive summary
  generateSummary() {
    const testName = 'ResultAnalyzer';
    testLogger.logStep(testName, 'Generating comprehensive summary', 'info');

    const criteria = this.analysisResults.successCriteria;
    const performance = this.analysisResults.performance;
    const recommendations = this.analysisResults.recommendations;

    const score = criteria.met.length;
    const maxScore = criteria.maxScore;
    const successRate = performance.successRate;
    const avgTime = performance.averageExecutionTime;

    let summary = `TEST SUITE ANALYSIS COMPLETE\n`;
    summary += `═══════════════════════════════════════════════════════════\n\n`;
    
    summary += `OVERALL SCORE: ${score}/${maxScore} criteria met\n`;
    summary += `SUCCESS RATE: ${successRate}%\n`;
    summary += `AVERAGE EXECUTION TIME: ${avgTime}ms\n`;
    summary += `DETECTION ATTEMPTS: ${performance.detectionRate}\n\n`;

    summary += `SUCCESS CRITERIA STATUS:\n`;
    criteria.met.forEach(criteria => {
      summary += `✅ ${criteria.name}\n`;
    });
    criteria.failed.forEach(criteria => {
      summary += `❌ ${criteria.name} (Expected: ${criteria.expected}, Actual: ${criteria.actual})\n`;
    });

    summary += `\nCOMPONENT STATUS:\n`;
    const components = [
      { name: 'Gmail Login', key: 'gmailLogin', field: 'success' },
      { name: 'Runtime Patching', key: 'runtimePatching', field: 'success' },
      { name: 'Extension', key: 'extension', field: 'success' }
    ];

    components.forEach(component => {
      const result = this.analysisResults.testResults[component.key];
      const status = result && result[component.field] ? '✅' : '❌';
      summary += `${status} ${component.name}\n`;
    });

    if (recommendations.length > 0) {
      summary += `\nRECOMMENDATIONS:\n`;
      const criticalRecs = recommendations.filter(r => r.type === 'critical');
      const warningRecs = recommendations.filter(r => r.type === 'warning');
      const perfRecs = recommendations.filter(r => r.type === 'performance');

      if (criticalRecs.length > 0) {
        summary += `\nCRITICAL:\n`;
        criticalRecs.forEach(rec => {
          summary += `• ${rec.message}\n  Action: ${rec.action}\n`;
        });
      }

      if (warningRecs.length > 0) {
        summary += `\nWARNINGS:\n`;
        warningRecs.forEach(rec => {
          summary += `• ${rec.message}\n  Action: ${rec.action}\n`;
        });
      }

      if (perfRecs.length > 0) {
        summary += `\nPERFORMANCE:\n`;
        perfRecs.forEach(rec => {
          summary += `• ${rec.message}\n  Action: ${rec.action}\n`;
        });
      }
    }

    // Final status
    if (score === maxScore && successRate >= 95 && performance.detectionRate === 0) {
      summary += `\n🎉 SYSTEM FULLY OPERATIONAL - READY FOR PRODUCTION\n`;
      this.analysisResults.overallSuccess = true;
    } else {
      summary += `\n⚠️  SYSTEM NEEDS ADJUSTMENT BEFORE PRODUCTION\n`;
      this.analysisResults.overallSuccess = false;
    }

    this.analysisResults.summary = summary;
    
    testLogger.logStep(testName, 'Summary generated', 'success');
  }

  // Run complete analysis
  async runAnalysis() {
    const testName = 'ResultAnalyzer';
    this.analysisResults.startTime = new Date().toISOString();
    
    testLogger.startTest(testName, { phase: 'complete_analysis' });

    try {
      // Load test results
      await this.loadTestResults();

      // Analyze each component
      this.analyzeGmailLoginResults();
      this.analyzeRuntimePatchingResults();
      this.analyzeExtensionResults();

      // Calculate performance metrics
      this.calculatePerformanceMetrics();

      // Generate recommendations
      this.generateRecommendations();

      // Generate summary
      this.generateSummary();

      // Finalize analysis
      this.analysisResults.endTime = new Date().toISOString();
      this.analysisResults.duration = new Date(this.analysisResults.endTime) - new Date(this.analysisResults.startTime);

      // Save analysis results
      await this.saveAnalysisResults();

      // Log completion
      testLogger.endTest(testName, this.analysisResults, {
        duration: this.analysisResults.duration,
        overallSuccess: this.analysisResults.overallSuccess,
        criteriaMet: this.analysisResults.successCriteria.met.length,
        criteriaTotal: this.analysisResults.successCriteria.maxScore
      });

      return this.analysisResults;

    } catch (error) {
      testLogger.logError(testName, error, { phase: 'analysis_execution' });
      this.analysisResults.errors = this.analysisResults.errors || [];
      this.analysisResults.errors.push(`Analysis failed: ${error.message}`);
      this.analysisResults.overallSuccess = false;
      
      this.analysisResults.endTime = new Date().toISOString();
      this.analysisResults.duration = new Date(this.analysisResults.endTime) - new Date(this.analysisResults.startTime);
      
      testLogger.endTest(testName, this.analysisResults);
      return this.analysisResults;
    }
  }

  // Save analysis results to file
  async saveAnalysisResults() {
    const testName = 'ResultAnalyzer';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsPath = path.join(this.config.screenshots.directory, `test-analysis-${timestamp}.json`);
    
    try {
      fs.writeFileSync(resultsPath, JSON.stringify(this.analysisResults, null, 2));
      testLogger.logStep(testName, `Analysis results saved: ${resultsPath}`, 'info');
      return resultsPath;
    } catch (error) {
      testLogger.logError(testName, error, { phase: 'save_results' });
      return null;
    }
  }

  // Print analysis results to console
  printResults() {
    console.log(this.analysisResults.summary);
  }
}

// Export for use in test runner
module.exports = ResultAnalyzer;

// Run analysis if called directly
if (require.main === module) {
  const analyzer = new ResultAnalyzer();
  analyzer.runAnalysis()
    .then(results => {
      analyzer.printResults();
      process.exit(results.overallSuccess ? 0 : 1);
    })
    .catch(error => {
      console.error('Analysis failed:', error);
      process.exit(1);
    });
}