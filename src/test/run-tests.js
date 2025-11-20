const GmailLoginTest = require('./gmail-login-test');
const RuntimePatchingTest = require('./verify-runtime-patching');
const ExtensionTest = require('./verify-extension');
const ResultAnalyzer = require('./analyze-results');
const testLogger = require('./test-logger');
const { getConfig } = require('./test-config');

class TestRunner {
  constructor() {
    this.config = getConfig();
    this.testResults = {
      startTime: new Date().toISOString(),
      endTime: null,
      duration: 0,
      tests: {},
      overallSuccess: false,
      errors: []
    };
  }

  // Run a single test with error handling
  async runTest(testName, TestClass, options = {}) {
    const startTime = Date.now();
    
    testLogger.startTest(testName, options);
    
    try {
      const test = new TestClass();
      const result = await test.runAllTests();
      
      const duration = Date.now() - startTime;
      testLogger.logPerformance(testName, 'total_execution', duration);
      
      // Save results if available
      if (test.saveResults) {
        await test.saveResults();
      }
      
      this.testResults.tests[testName] = {
        success: result.success || false,
        duration: result.duration || duration,
        result
      };
      
      testLogger.endTest(testName, result, { duration });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      testLogger.logError(testName, error, { phase: 'test_execution' });
      
      this.testResults.tests[testName] = {
        success: false,
        duration,
        error: error.message
      };
      
      this.testResults.errors.push(`${testName} failed: ${error.message}`);
      
      testLogger.endTest(testName, { success: false, error: error.message }, { duration });
      
      return { success: false, error: error.message, duration };
    }
  }

  // Run all tests in sequence
  async runAllTests() {
    const suiteName = 'CompleteTestSuite';
    this.testResults.startTime = new Date().toISOString();
    
    testLogger.startTest(suiteName, { 
      phase: 'complete_suite',
      tests: ['StealthFlags', 'RuntimePatching', 'Extension', 'GmailLogin']
    });

    try {
      // Test 1: Verify stealth flags (pre-test validation)
      testLogger.logStep(suiteName, 'Starting stealth flags verification', 'info');
      const stealthResult = await this.runStealthFlagsTest();
      
      // Test 2: Runtime patching verification
      testLogger.logStep(suiteName, 'Starting runtime patching tests', 'info');
      const runtimeResult = await this.runTest('RuntimePatchingTest', RuntimePatchingTest);
      
      // Test 3: Extension functionality tests
      testLogger.logStep(suiteName, 'Starting extension tests', 'info');
      const extensionResult = await this.runTest('ExtensionTest', ExtensionTest);
      
      // Test 4: Gmail login test (main test)
      testLogger.logStep(suiteName, 'Starting Gmail login test', 'info');
      const gmailResult = await this.runTest('GmailLoginTest', GmailLoginTest);
      
      // Calculate overall success
      const testResults = {
        stealthFlags: stealthResult,
        runtimePatching: runtimeResult,
        extension: extensionResult,
        gmailLogin: gmailResult
      };
      
      const successfulTests = Object.values(testResults).filter(result => result.success).length;
      const totalTests = Object.keys(testResults).length;
      this.testResults.overallSuccess = successfulTests === totalTests;
      
      // Test 5: Analyze results
      testLogger.logStep(suiteName, 'Starting result analysis', 'info');
      const analyzer = new ResultAnalyzer();
      const analysisResult = await analyzer.runAnalysis();
      
      // Update test results with analysis
      this.testResults.analysis = analysisResult;
      
      // Finalize suite results
      this.testResults.endTime = new Date().toISOString();
      this.testResults.duration = new Date(this.testResults.endTime) - new Date(this.testResults.startTime);
      
      // Log performance metrics
      testLogger.logPerformance(suiteName, 'total_suite_execution', this.testResults.duration);
      
      // Print summary
      this.printSummary(testResults, analysisResult);
      
      // End suite
      testLogger.endTest(suiteName, this.testResults, {
        duration: this.testResults.duration,
        overallSuccess: this.testResults.overallSuccess,
        successfulTests,
        totalTests
      });
      
      return this.testResults;
      
    } catch (error) {
      testLogger.logError(suiteName, error, { phase: 'suite_execution' });
      this.testResults.errors.push(`Suite execution failed: ${error.message}`);
      this.testResults.overallSuccess = false;
      
      this.testResults.endTime = new Date().toISOString();
      this.testResults.duration = new Date(this.testResults.endTime) - new Date(this.testResults.startTime);
      
      testLogger.endTest(suiteName, this.testResults);
      return this.testResults;
    }
  }

  // Run stealth flags verification
  async runStealthFlagsTest() {
    const testName = 'StealthFlagsTest';
    
    try {
      // Import and run stealth flags test
      const { runVerification } = require('./verify-stealth-flags');
      const result = await runVerification();
      
      this.testResults.tests[testName] = {
        success: result.success || false,
        duration: result.duration || 0,
        result
      };
      
      return result;
    } catch (error) {
      testLogger.logError(testName, error, { phase: 'stealth_flags_test' });
      
      this.testResults.tests[testName] = {
        success: false,
        duration: 0,
        error: error.message
      };
      
      this.testResults.errors.push(`${testName} failed: ${error.message}`);
      
      return { success: false, error: error.message };
    }
  }

  // Print comprehensive test summary
  printSummary(testResults, analysisResult) {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('COMPLETE TEST SUITE REPORT');
    console.log('═══════════════════════════════════════════════════════════');
    
    // Overall status
    const overallStatus = this.testResults.overallSuccess ? '✅ PASSED' : '❌ FAILED';
    console.log(`\nOVERALL STATUS: ${overallStatus}`);
    console.log(`Total Duration: ${(this.testResults.duration / 1000).toFixed(2)} seconds`);
    console.log(`Tests Completed: ${Object.keys(testResults).length}`);
    
    // Individual test results
    console.log('\nINDIVIDUAL TEST RESULTS:');
    Object.entries(testResults).forEach(([testName, result]) => {
      const status = result.success ? '✅' : '❌';
      const duration = ((result.duration || 0) / 1000).toFixed(2);
      console.log(`  ${status} ${testName}: ${duration}s`);
      
      if (result.error) {
        console.log(`    Error: ${result.error}`);
      }
    });
    
    // Success criteria from analysis
    if (analysisResult && analysisResult.successCriteria) {
      console.log('\nSUCCESS CRITERIA:');
      const criteria = analysisResult.successCriteria;
      criteria.met.forEach(criterion => {
        console.log(`  ✅ ${criterion.name}`);
      });
      criteria.failed.forEach(criterion => {
        console.log(`  ❌ ${criterion.name} (Expected: ${criterion.expected}, Actual: ${criterion.actual})`);
      });
      
      const score = criteria.met.length;
      const maxScore = criteria.maxScore;
      console.log(`\nFINAL SCORE: ${score}/${maxScore} criteria met`);
    }
    
    // Performance metrics
    if (analysisResult && analysisResult.performance) {
      console.log('\nPERFORMANCE METRICS:');
      const perf = analysisResult.performance;
      console.log(`  Average Execution Time: ${perf.averageExecutionTime}ms`);
      console.log(`  Success Rate: ${perf.successRate}%`);
      console.log(`  Detection Attempts: ${perf.detectionRate}`);
    }
    
    // Recommendations
    if (analysisResult && analysisResult.recommendations && analysisResult.recommendations.length > 0) {
      console.log('\nRECOMMENDATIONS:');
      const criticalRecs = analysisResult.recommendations.filter(r => r.type === 'critical');
      const warningRecs = analysisResult.recommendations.filter(r => r.type === 'warning');
      const perfRecs = analysisResult.recommendations.filter(r => r.type === 'performance');
      
      if (criticalRecs.length > 0) {
        console.log('\n  CRITICAL:');
        criticalRecs.forEach(rec => {
          console.log(`    • ${rec.message}`);
          console.log(`      Action: ${rec.action}`);
        });
      }
      
      if (warningRecs.length > 0) {
        console.log('\n  WARNINGS:');
        warningRecs.forEach(rec => {
          console.log(`    • ${rec.message}`);
          console.log(`      Action: ${rec.action}`);
        });
      }
      
      if (perfRecs.length > 0) {
        console.log('\n  PERFORMANCE:');
        perfRecs.forEach(rec => {
          console.log(`    • ${rec.message}`);
          console.log(`      Action: ${rec.action}`);
        });
      }
    }
    
    // Final verdict
    if (this.testResults.overallSuccess && analysisResult && analysisResult.overallSuccess) {
      console.log('\n🎉 SYSTEM FULLY OPERATIONAL - READY FOR PRODUCTION');
    } else {
      console.log('\n⚠️  SYSTEM NEEDS ADJUSTMENT BEFORE PRODUCTION');
    }
    
    console.log('\n═══════════════════════════════════════════════════════════');
  }

  // Run specific test by name
  async runSpecificTest(testName) {
    const testMap = {
      'stealth': () => this.runStealthFlagsTest(),
      'runtime': () => this.runTest('RuntimePatchingTest', RuntimePatchingTest),
      'extension': () => this.runTest('ExtensionTest', ExtensionTest),
      'gmail': () => this.runTest('GmailLoginTest', GmailLoginTest),
      'analyze': async () => {
        const analyzer = new ResultAnalyzer();
        return await analyzer.runAnalysis();
      }
    };
    
    if (testMap[testName]) {
      return await testMap[testName]();
    } else {
      throw new Error(`Unknown test: ${testName}. Available tests: ${Object.keys(testMap).join(', ')}`);
    }
  }
}

// Export for use in other modules
module.exports = TestRunner;

// Run tests if called directly
if (require.main === module) {
  const runner = new TestRunner();
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const testToRun = args[0];
  
  if (testToRun) {
    // Run specific test
    console.log(`Running specific test: ${testToRun}`);
    runner.runSpecificTest(testToRun)
      .then(result => {
        if (result.success !== undefined) {
          process.exit(result.success ? 0 : 1);
        } else {
          process.exit(0);
        }
      })
      .catch(error => {
        console.error('Test execution failed:', error);
        process.exit(1);
      });
  } else {
    // Run all tests
    console.log('Running complete test suite...');
    runner.runAllTests()
      .then(results => {
        process.exit(results.overallSuccess ? 0 : 1);
      })
      .catch(error => {
        console.error('Test suite execution failed:', error);
        process.exit(1);
      });
  }
}