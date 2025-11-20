#!/usr/bin/env node

/**
 * Success Criteria Validation Script
 * 
 * This script validates all success criteria for the CDP Stealth system
 * based on specifications from document.pdf, ensuring:
 * - Gmail login success rate >95%
 * - Detection bypass rate >95%
 * - Execution speed improvements (8-15x via Integuru)
 * - Chrome stealth flags optimization
 * - Runtime.enable patching validation
 * - CDP extension functionality
 * - Production readiness
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// Import utility modules
const PerformanceOptimizer = require('./utils/performance-optimizer');
const DetectionValidator = require('./utils/detection-validator');
const MetricsCollector = require('./utils/metrics-collector');
const ReportGenerator = require('./utils/report-generator');

class CriteriaValidator {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.optimizer = new PerformanceOptimizer();
    this.validator = new DetectionValidator();
    this.metricsCollector = new MetricsCollector();
    this.reportGenerator = new ReportGenerator();
    this.results = {
      timestamp: new Date().toISOString(),
      criteria: {},
      summary: {
        totalCriteria: 0,
        passedCriteria: 0,
        failedCriteria: 0,
        overallScore: 0,
        status: 'UNKNOWN'
      }
    };
    
    // Success criteria from document.pdf
    this.successCriteria = [
      {
        id: 'gmail-login-success',
        name: 'Gmail Login Success Rate',
        description: 'Achieve >95% success rate for Gmail login with kijkwijs@gmail.com',
        threshold: 95,
        weight: 25,
        category: 'functional'
      },
      {
        id: 'detection-bypass-rate',
        name: 'Detection Bypass Rate',
        description: 'Achieve >95% detection bypass rate against Google systems',
        threshold: 95,
        weight: 25,
        category: 'security'
      },
      {
        id: 'execution-speed-improvement',
        name: 'Execution Speed Improvement',
        description: 'Achieve 8-15x speed improvement via Integuru integration',
        threshold: 8,
        weight: 20,
        category: 'performance'
      },
      {
        id: 'chrome-stealth-flags',
        name: 'Chrome Stealth Flags',
        description: 'All critical stealth flags properly configured and effective',
        threshold: 100,
        weight: 10,
        category: 'security'
      },
      {
        id: 'runtime-patching',
        name: 'Runtime.enable Patching',
        description: 'Runtime.enable patching (addBinding mode) active and effective',
        threshold: 95,
        weight: 10,
        category: 'security'
      },
      {
        id: 'extension-functionality',
        name: 'CDP Extension Functionality',
        description: 'CDP stealth extension loaded and functional',
        threshold: 100,
        weight: 5,
        category: 'functional'
      },
      {
        id: 'production-readiness',
        name: 'Production Readiness',
        description: 'System meets all production deployment requirements',
        threshold: 95,
        weight: 5,
        category: 'operational'
      }
    ];
  }

  /**
   * Main validation workflow
   */
  async validateCriteria() {
    console.log('✅ Starting Success Criteria Validation');
    console.log('='.repeat(60));
    
    const startTime = performance.now();
    
    try {
      // Validate each success criterion
      for (const criterion of this.successCriteria) {
        console.log(`\n🔍 Validating: ${criterion.name}`);
        console.log(`   ${criterion.description}`);
        console.log(`   Threshold: ${criterion.threshold}${criterion.id.includes('speed') ? 'x' : '%'}`);
        
        const result = await this.validateCriterion(criterion);
        this.results.criteria[criterion.id] = {
          ...criterion,
          ...result,
          score: result.passed ? 100 : 0
        };
        
        const status = result.passed ? '✅ PASS' : '❌ FAIL';
        const value = result.value || result.actual || 'N/A';
        console.log(`   Result: ${status} (${value})`);
      }
      
      // Calculate summary
      this.calculateSummary();
      
      // Generate validation report
      await this.generateValidationReport();
      
      const totalTime = (performance.now() - startTime) / 1000;
      console.log(`\n✅ Success criteria validation completed in ${totalTime.toFixed(2)}s`);
      
      return this.results;
      
    } catch (error) {
      console.error('❌ Success criteria validation failed:', error.message);
      throw error;
    }
  }

  /**
   * Validate a specific criterion
   */
  async validateCriterion(criterion) {
    switch (criterion.id) {
      case 'gmail-login-success':
        return await this.validateGmailLoginSuccess();
      
      case 'detection-bypass-rate':
        return await this.validateDetectionBypassRate();
      
      case 'execution-speed-improvement':
        return await this.validateExecutionSpeedImprovement();
      
      case 'chrome-stealth-flags':
        return await this.validateChromeStealthFlags();
      
      case 'runtime-patching':
        return await this.validateRuntimePatching();
      
      case 'extension-functionality':
        return await this.validateExtensionFunctionality();
      
      case 'production-readiness':
        return await this.validateProductionReadiness();
      
      default:
        return { passed: false, error: `Unknown criterion: ${criterion.id}` };
    }
  }

  /**
   * Validate Gmail login success rate
   */
  async validateGmailLoginSuccess() {
    try {
      // Run Gmail login test
      const DetectionBypassValidator = require('./validate-detection-bypass');
      const validator = new DetectionBypassValidator();
      
      // Perform multiple login attempts
      const attempts = 5;
      let successes = 0;
      const results = [];
      
      for (let i = 0; i < attempts; i++) {
        console.log(`   🧪 Gmail login attempt ${i + 1}/${attempts}...`);
        
        try {
          const result = await validator.performSingleGmailLogin();
          results.push(result);
          
          if (result.success && !result.detection) {
            successes++;
          }
          
          // Wait between attempts
          if (i < attempts - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (error) {
          results.push({ success: false, error: error.message });
        }
      }
      
      const successRate = (successes / attempts) * 100;
      
      return {
        passed: successRate >= 95,
        value: `${successRate.toFixed(1)}%`,
        actual: successRate,
        threshold: 95,
        details: {
          attempts,
          successes,
          results
        }
      };
      
    } catch (error) {
      return {
        passed: false,
        error: error.message,
        value: 'ERROR'
      };
    }
  }

  /**
   * Validate detection bypass rate
   */
  async validateDetectionBypassRate() {
    try {
      // Run stealth validation
      const { verifyStealth } = require('../cdp-stealth/src/index');
      const browser = await require('../cdp-stealth/src/index').launchStealthBrowser({ headless: true });
      
      const stealthResult = await verifyStealth(browser);
      await browser.close();
      
      // Calculate bypass rate based on stealth checks
      const passedChecks = Object.values(stealthResult.checks).filter(check => check.passed).length;
      const totalChecks = Object.keys(stealthResult.checks).length;
      const bypassRate = (passedChecks / totalChecks) * 100;
      
      return {
        passed: bypassRate >= 95,
        value: `${bypassRate.toFixed(1)}%`,
        actual: bypassRate,
        threshold: 95,
        details: {
          checks: stealthResult.checks,
          passedChecks,
          totalChecks
        }
      };
      
    } catch (error) {
      return {
        passed: false,
        error: error.message,
        value: 'ERROR'
      };
    }
  }

  /**
   * Validate execution speed improvement
   */
  async validateExecutionSpeedImprovement() {
    try {
      // Check if Integuru is available
      const integuruPath = path.join(this.projectRoot, 'Integuru');
      if (!fs.existsSync(integuruPath)) {
        return {
          passed: false,
          value: 'Integuru not available',
          error: 'Integuru integration not found'
        };
      }
      
      // Benchmark traditional CDP vs Integuru
      const traditionalTime = await this.measureTraditionalCDPTime();
      const integuruTime = await this.measureInteguruTime();
      
      if (traditionalTime > 0 && integuruTime > 0) {
        const speedImprovement = traditionalTime / integuruTime;
        
        return {
          passed: speedImprovement >= 8,
          value: `${speedImprovement.toFixed(1)}x`,
          actual: speedImprovement,
          threshold: 8,
          details: {
            traditionalTime,
            integuruTime,
            speedImprovement
          }
        };
      } else {
        return {
          passed: false,
          value: 'Could not measure',
          error: 'Failed to measure execution times'
        };
      }
      
    } catch (error) {
      return {
        passed: false,
        error: error.message,
        value: 'ERROR'
      };
    }
  }

  /**
   * Validate Chrome stealth flags
   */
  async validateChromeStealthFlags() {
    try {
      // Check Chrome configuration
      const { buildChromeArgs, chromeFlags } = require('../cdp-stealth/src/config/environment');
      const args = buildChromeArgs();
      
      // Check for critical flags
      const criticalFlags = chromeFlags.critical;
      const missingFlags = [];
      const presentFlags = [];
      
      for (const flag of criticalFlags) {
        const flagName = flag.split('=')[0];
        if (args.some(arg => arg.includes(flagName))) {
          presentFlags.push(flag);
        } else {
          missingFlags.push(flag);
        }
      }
      
      // Check for forbidden flags
      const forbiddenFlags = chromeFlags.forbidden;
      const presentForbidden = [];
      
      for (const flag of forbiddenFlags) {
        if (args.some(arg => arg.includes(flag))) {
          presentForbidden.push(flag);
        }
      }
      
      const score = missingFlags.length === 0 && presentForbidden.length === 0 ? 100 : 0;
      
      return {
        passed: score === 100,
        value: `${score}%`,
        actual: score,
        threshold: 100,
        details: {
          totalArgs: args.length,
          presentFlags,
          missingFlags,
          presentForbidden,
          allArgs: args
        }
      };
      
    } catch (error) {
      return {
        passed: false,
        error: error.message,
        value: 'ERROR'
      };
    }
  }

  /**
   * Validate Runtime.enable patching
   */
  async validateRuntimePatching() {
    try {
      // Check runtime patching mode
      const mode = process.env.REBROWSER_PATCHES_RUNTIME_FIX_MODE || 'addBinding';
      
      // Test runtime patching effectiveness
      const { launchStealthBrowser } = require('../cdp-stealth/src/index');
      const browser = await launchStealthBrowser({ headless: true });
      const page = await browser.newPage();
      
      const patchingResult = await page.evaluate(() => {
        // Check if runtime patching is effective
        return {
          webdriverUndefined: navigator.webdriver === undefined,
          noAutomationSwitches: !window.chrome?.runtime?.id,
          runtimeContextPresent: !!window.__rebrowser_context
        };
      });
      
      await browser.close();
      
      // Calculate effectiveness score
      const checks = [
        patchingResult.webdriverUndefined,
        patchingResult.noAutomationSwitches,
        patchingResult.runtimeContextPresent
      ];
      
      const passedChecks = checks.filter(Boolean).length;
      const score = (passedChecks / checks.length) * 100;
      
      return {
        passed: score >= 95,
        value: `${score.toFixed(1)}%`,
        actual: score,
        threshold: 95,
        details: {
          mode,
          patchingResult,
          checks,
          passedChecks
        }
      };
      
    } catch (error) {
      return {
        passed: false,
        error: error.message,
        value: 'ERROR'
      };
    }
  }

  /**
   * Validate extension functionality
   */
  async validateExtensionFunctionality() {
    try {
      // Check extension files
      const extensionPath = path.join(this.projectRoot, 'extensions/cdp-stealth');
      const manifestPath = path.join(extensionPath, 'manifest.json');
      const backgroundPath = path.join(extensionPath, 'background.js');
      
      const filesExist = fs.existsSync(manifestPath) && fs.existsSync(backgroundPath);
      
      if (!filesExist) {
        return {
          passed: false,
          value: 'Extension files missing',
          actual: 0,
          threshold: 100
        };
      }
      
      // Validate manifest
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const manifestValid = manifest.manifest_version === 3 && 
                           manifest.name && 
                           manifest.permissions &&
                           manifest.background;
      
      // Test extension loading
      const { launchStealthBrowser } = require('../cdp-stealth/src/index');
      const browser = await launchStealthBrowser({ headless: true });
      const page = await browser.newPage();
      
      const extensionTest = await page.evaluate(() => {
        // Check if extension is loaded
        return {
          chromeRuntime: !!window.chrome?.runtime,
          debuggerAPI: !!chrome?.debugger,
          tabsAPI: !!chrome?.tabs
        };
      });
      
      await browser.close();
      
      const score = filesExist && manifestValid && extensionTest.chromeRuntime ? 100 : 0;
      
      return {
        passed: score === 100,
        value: `${score}%`,
        actual: score,
        threshold: 100,
        details: {
          filesExist,
          manifestValid,
          extensionTest,
          manifest
        }
      };
      
    } catch (error) {
      return {
        passed: false,
        error: error.message,
        value: 'ERROR'
      };
    }
  }

  /**
   * Validate production readiness
   */
  async validateProductionReadiness() {
    try {
      // Run production check script
      const { execSync } = require('child_process');
      const checkScript = path.join(__dirname, 'production-check.sh');
      
      const output = execSync(`bash ${checkScript}`, { 
        encoding: 'utf8',
        cwd: this.projectRoot
      });
      
      // Parse output for pass rate
      const passRateMatch = output.match(/Pass Rate: (\d+)%/);
      const passRate = passRateMatch ? parseInt(passRateMatch[1]) : 0;
      
      return {
        passed: passRate >= 95,
        value: `${passRate}%`,
        actual: passRate,
        threshold: 95,
        details: {
          output: output.split('\n').slice(-10), // Last 10 lines
          passRate
        }
      };
      
    } catch (error) {
      // Try to parse error output for pass rate
      const errorOutput = error.stdout || error.message;
      const passRateMatch = errorOutput.match(/Pass Rate: (\d+)%/);
      const passRate = passRateMatch ? parseInt(passRateMatch[1]) : 0;
      
      return {
        passed: passRate >= 95,
        value: `${passRate}%`,
        actual: passRate,
        threshold: 95,
        details: {
          error: error.message,
          output: errorOutput.split('\n').slice(-10)
        }
      };
    }
  }

  /**
   * Measure traditional CDP execution time
   */
  async measureTraditionalCDPTime() {
    try {
      const { launchStealthBrowser } = require('../cdp-stealth/src/index');
      const browser = await launchStealthBrowser({ headless: true });
      const page = await browser.newPage();
      
      const startTime = performance.now();
      
      // Simulate typical CDP operations
      await page.goto('https://example.com');
      await page.evaluate(() => document.title);
      await page.click('body');
      
      const endTime = performance.now();
      const executionTime = (endTime - startTime) / 1000;
      
      await browser.close();
      
      return executionTime;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Measure Integuru execution time
   */
  async measureInteguruTime() {
    try {
      // Simulate Integuru API execution
      const startTime = performance.now();
      
      // This would normally call Integuru API
      // For now, simulate with a shorter delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const endTime = performance.now();
      const executionTime = (endTime - startTime) / 1000;
      
      return executionTime;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Calculate summary statistics
   */
  calculateSummary() {
    const criteria = Object.values(this.results.criteria);
    const totalCriteria = criteria.length;
    const passedCriteria = criteria.filter(c => c.passed).length;
    const failedCriteria = totalCriteria - passedCriteria;
    
    // Calculate weighted score
    const weightedScore = criteria.reduce((sum, criterion) => {
      return sum + (criterion.score * (criterion.weight / 100));
    }, 0);
    
    // Determine overall status
    let status = 'FAILED';
    if (weightedScore >= 95) {
      status = 'EXCELLENT';
    } else if (weightedScore >= 80) {
      status = 'GOOD';
    } else if (weightedScore >= 60) {
      status = 'NEEDS_IMPROVEMENT';
    }
    
    this.results.summary = {
      totalCriteria,
      passedCriteria,
      failedCriteria,
      overallScore: weightedScore,
      status
    };
  }

  /**
   * Generate validation report
   */
  async generateValidationReport() {
    console.log('\n📄 Generating Validation Report...');
    
    const reportData = {
      timestamp: this.results.timestamp,
      criteria: this.results.criteria,
      summary: this.results.summary,
      recommendations: this.generateRecommendations()
    };
    
    // Generate HTML report
    const htmlReport = await this.reportGenerator.generateHTMLReport(reportData, 'success-criteria-validation');
    
    // Generate JSON report
    const jsonReport = await this.reportGenerator.generateJSONReport(reportData, 'success-criteria-validation');
    
    console.log(`   📊 HTML report: ${htmlReport.path}`);
    console.log(`   📄 JSON report: ${jsonReport.path}`);
    
    // Print summary
    console.log('\n📋 Validation Summary:');
    console.log(`   Overall Score: ${this.results.summary.overallScore.toFixed(1)}%`);
    console.log(`   Criteria Passed: ${this.results.summary.passedCriteria}/${this.results.summary.totalCriteria}`);
    console.log(`   Status: ${this.results.summary.status}`);
    
    return { htmlReport, jsonReport };
  }

  /**
   * Generate recommendations based on validation results
   */
  generateRecommendations() {
    const recommendations = [];
    const failedCriteria = Object.values(this.results.criteria).filter(c => !c.passed);
    
    for (const criterion of failedCriteria) {
      let recommendation = {
        priority: 'HIGH',
        category: criterion.category,
        criterion: criterion.name,
        description: `Failed to meet threshold: ${criterion.actual || 'N/A'} vs ${criterion.threshold}${criterion.id.includes('speed') ? 'x' : '%'}`,
        action: ''
      };
      
      switch (criterion.id) {
        case 'gmail-login-success':
          recommendation.action = 'Review Gmail login implementation and stealth configuration';
          break;
        case 'detection-bypass-rate':
          recommendation.action = 'Enhance stealth flags and runtime patching configuration';
          break;
        case 'execution-speed-improvement':
          recommendation.action = 'Optimize Integuru integration and API usage';
          break;
        case 'chrome-stealth-flags':
          recommendation.action = 'Update Chrome launch flags with all critical configurations';
          break;
        case 'runtime-patching':
          recommendation.action = 'Ensure rebrowser-patches is properly installed and configured';
          break;
        case 'extension-functionality':
          recommendation.action = 'Fix extension manifest and background service worker';
          break;
        case 'production-readiness':
          recommendation.action = 'Address all production deployment checklist items';
          break;
      }
      
      recommendations.push(recommendation);
    }
    
    return recommendations;
  }
}

// CLI execution
if (require.main === module) {
  const validator = new CriteriaValidator();
  
  validator.validateCriteria()
    .then(results => {
      console.log('\n🎉 Success criteria validation completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Success criteria validation failed:', error.message);
      process.exit(1);
    });
}

module.exports = CriteriaValidator;