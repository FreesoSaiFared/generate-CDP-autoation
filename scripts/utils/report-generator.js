/**
 * Report Generator Utility
 * 
 * This utility provides comprehensive report generation for CDP Stealth system,
 * including HTML and JSON reports for performance, validation, and metrics.
 */

const fs = require('fs');
const path = require('path');

class ReportGenerator {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '../..');
    this.templates = {
      html: this.getHTMLTemplate(),
      json: this.getJSONTemplate()
    };
  }

  /**
   * Generate HTML report
   */
  async generateHTMLReport(data, reportType = 'default') {
    try {
      console.log(`   📄 Generating HTML report for ${reportType}...`);
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const reportPath = path.join(this.projectRoot, 'test-results', `${reportType}-report-${timestamp}.html`);
      
      // Ensure directory exists
      const reportDir = path.dirname(reportPath);
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }
      
      // Generate HTML content
      const htmlContent = this.generateHTMLContent(data, reportType);
      
      // Write report to file
      fs.writeFileSync(reportPath, htmlContent, 'utf8');
      
      console.log(`     ✅ HTML report saved: ${reportPath}`);
      
      return {
        path: reportPath,
        type: 'html',
        size: fs.statSync(reportPath).size
      };
      
    } catch (error) {
      console.error(`   ❌ Error generating HTML report:`, error.message);
      throw error;
    }
  }

  /**
   * Generate JSON report
   */
  async generateJSONReport(data, reportType = 'default') {
    try {
      console.log(`   📄 Generating JSON report for ${reportType}...`);
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const reportPath = path.join(this.projectRoot, 'test-results', `${reportType}-report-${timestamp}.json`);
      
      // Ensure directory exists
      const reportDir = path.dirname(reportPath);
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }
      
      // Generate JSON content
      const jsonContent = JSON.stringify(data, null, 2);
      
      // Write report to file
      fs.writeFileSync(reportPath, jsonContent, 'utf8');
      
      console.log(`     ✅ JSON report saved: ${reportPath}`);
      
      return {
        path: reportPath,
        type: 'json',
        size: fs.statSync(reportPath).size
      };
      
    } catch (error) {
      console.error(`   ❌ Error generating JSON report:`, error.message);
      throw error;
    }
  }

  /**
   * Generate HTML content based on report type
   */
  generateHTMLContent(data, reportType) {
    const template = this.templates.html;
    
    // Replace placeholders
    let content = template
      .replace('{{TITLE}}', this.getReportTitle(reportType))
      .replace('{{TIMESTAMP}}', new Date().toLocaleString())
      .replace('{{REPORT_TYPE}}', reportType)
      .replace('{{CONTENT}}', this.generateReportContent(data, reportType))
      .replace('{{STYLES}}', this.getReportStyles())
      .replace('{{SCRIPTS}}', this.getReportScripts());
    
    return content;
  }

  /**
   * Get report title based on type
   */
  getReportTitle(reportType) {
    const titles = {
      'performance-optimization': 'Performance Optimization Report',
      'detection-bypass-validation': 'Detection Bypass Validation Report',
      'system-benchmark': 'System Benchmark Report',
      'system-metrics': 'System Metrics Report',
      'success-criteria-validation': 'Success Criteria Validation Report',
      'default': 'CDP Stealth System Report'
    };
    
    return titles[reportType] || titles.default;
  }

  /**
   * Generate report content based on type
   */
  generateReportContent(data, reportType) {
    switch (reportType) {
      case 'performance-optimization':
        return this.generatePerformanceOptimizationContent(data);
      case 'detection-bypass-validation':
        return this.generateDetectionBypassContent(data);
      case 'system-benchmark':
        return this.generateSystemBenchmarkContent(data);
      case 'system-metrics':
        return this.generateSystemMetricsContent(data);
      case 'success-criteria-validation':
        return this.generateSuccessCriteriaContent(data);
      default:
        return this.generateDefaultContent(data);
    }
  }

  /**
   * Generate performance optimization content
   */
  generatePerformanceOptimizationContent(data) {
    const { summary, optimizations, benchmarks, recommendations } = data;
    
    let content = `
      <div class="summary-section">
        <h2>Performance Optimization Summary</h2>
        <div class="summary-grid">
          <div class="summary-item">
            <h3>Total Optimizations</h3>
            <span class="value">${summary.totalOptimizations}</span>
          </div>
          <div class="summary-item">
            <h3>Successful</h3>
            <span class="value success">${summary.successfulOptimizations}</span>
          </div>
          <div class="summary-item">
            <h3>Benchmarks Passed</h3>
            <span class="value ${summary.passedBenchmarks >= summary.totalBenchmarks * 0.8 ? 'success' : 'warning'}">
              ${summary.passedBenchmarks}/${summary.totalBenchmarks}
            </span>
          </div>
        </div>
      </div>
    `;
    
    // Add optimizations details
    if (optimizations && optimizations.length > 0) {
      content += `
        <div class="optimizations-section">
          <h2>Optimization Details</h2>
          <div class="optimizations-grid">
      `;
      
      optimizations.forEach(opt => {
        const statusClass = opt.status === 'SUCCESS' ? 'success' : 'error';
        content += `
          <div class="optimization-card ${statusClass}">
            <h3>${opt.component}</h3>
            <div class="status">${opt.status}</div>
            <div class="details">
              <p>Improvements: ${opt.improvements || 0}</p>
              ${opt.metrics ? `<p>Metrics: ${JSON.stringify(opt.metrics, null, 2)}</p>` : ''}
            </div>
          </div>
        `;
      });
      
      content += `
          </div>
        </div>
      `;
    }
    
    // Add benchmarks
    if (benchmarks) {
      content += `
        <div class="benchmarks-section">
          <h2>Benchmark Results</h2>
          <div class="benchmarks-grid">
      `;
      
      Object.entries(benchmarks).forEach(([name, benchmark]) => {
        const statusClass = benchmark.passed ? 'success' : 'warning';
        content += `
          <div class="benchmark-card ${statusClass}">
            <h3>${name}</h3>
            <div class="improvement">${benchmark.actualImprovement?.toFixed(1) || 'N/A'}x</div>
            <div class="target">Target: ${benchmark.expectedImprovement || 'N/A'}x</div>
            <div class="status">${benchmark.passed ? 'PASSED' : 'BELOW TARGET'}</div>
          </div>
        `;
      });
      
      content += `
          </div>
        </div>
      `;
    }
    
    // Add recommendations
    if (recommendations && recommendations.length > 0) {
      content += this.generateRecommendationsContent(recommendations);
    }
    
    return content;
  }

  /**
   * Generate detection bypass validation content
   */
  generateDetectionBypassContent(data) {
    const { summary, results, recommendations } = data;
    
    let content = `
      <div class="summary-section">
        <h2>Detection Bypass Validation Summary</h2>
        <div class="summary-grid">
          <div class="summary-item">
            <h3>Overall Success Rate</h3>
            <span class="value ${summary.overallRate >= 95 ? 'success' : 'warning'}">
              ${summary.overallRate?.toFixed(1) || 'N/A'}%
            </span>
          </div>
          <div class="summary-item">
            <h3>Gmail Login Success</h3>
            <span class="value ${summary.gmailSuccessRate >= 95 ? 'success' : 'warning'}">
              ${summary.gmailSuccessRate?.toFixed(1) || 'N/A'}%
            </span>
          </div>
          <div class="summary-item">
            <h3>Detection Bypass Rate</h3>
            <span class="value ${summary.detectionBypassRate >= 95 ? 'success' : 'warning'}">
              ${summary.detectionBypassRate?.toFixed(1) || 'N/A'}%
            </span>
          </div>
        </div>
      </div>
    `;
    
    // Add detailed results
    if (results) {
      content += `
        <div class="results-section">
          <h2>Validation Results</h2>
      `;
      
      // Stealth flags
      if (results.stealthFlags) {
        content += `
          <div class="result-category">
            <h3>Stealth Flags</h3>
            <div class="score-indicator">
              <div class="score-bar" style="width: ${results.stealthFlags.score}%"></div>
              <span>${results.stealthFlags.score.toFixed(1)}%</span>
            </div>
            <div class="checks-grid">
        `;
        
        Object.entries(results.stealthFlags.checks).forEach(([name, check]) => {
          const statusClass = check.passed ? 'success' : 'error';
          content += `
            <div class="check-item ${statusClass}">
              <span class="check-name">${name}</span>
              <span class="check-status">${check.passed ? 'PASS' : 'FAIL'}</span>
            </div>
          `;
        });
        
        content += `
            </div>
          </div>
        `;
      }
      
      // Runtime patching
      if (results.runtimePatching) {
        content += `
          <div class="result-category">
            <h3>Runtime Patching</h3>
            <div class="score-indicator">
              <div class="score-bar" style="width: ${results.runtimePatching.bestScore}%"></div>
              <span>${results.runtimePatching.bestScore.toFixed(1)}%</span>
            </div>
            <p>Best Mode: <strong>${results.runtimePatching.bestMode}</strong></p>
          </div>
        `;
      }
      
      // Extension tests
      if (results.extensionTests) {
        content += `
          <div class="result-category">
            <h3>Extension Functionality</h3>
            <div class="extension-status">
              <div class="status-item ${results.extensionTests.extensionExists ? 'success' : 'error'}">
                Extension Exists: ${results.extensionTests.extensionExists ? 'YES' : 'NO'}
              </div>
              <div class="status-item ${results.extensionTests.manifestValid ? 'success' : 'error'}">
                Manifest Valid: ${results.extensionTests.manifestValid ? 'YES' : 'NO'}
              </div>
              <div class="status-item ${results.extensionTests.extensionLoaded ? 'success' : 'error'}">
                Extension Loaded: ${results.extensionTests.extensionLoaded ? 'YES' : 'NO'}
              </div>
              <div class="status-item ${results.extensionTests.cdpFunctionality ? 'success' : 'error'}">
                CDP Functionality: ${results.extensionTests.cdpFunctionality ? 'YES' : 'NO'}
              </div>
            </div>
          </div>
        `;
      }
      
      // Gmail login
      if (results.gmailLogin) {
        content += `
          <div class="result-category">
            <h3>Gmail Login Test</h3>
            <div class="login-stats">
              <div class="stat-item">
                <span class="label">Success Rate:</span>
                <span class="value ${results.gmailLogin.successRate >= 95 ? 'success' : 'warning'}">
                  ${results.gmailLogin.successRate.toFixed(1)}%
                </span>
              </div>
              <div class="stat-item">
                <span class="label">Detection Rate:</span>
                <span class="value ${results.gmailLogin.detectionRate <= 5 ? 'success' : 'warning'}">
                  ${results.gmailLogin.detectionRate.toFixed(1)}%
                </span>
              </div>
              <div class="stat-item">
                <span class="label">Average Time:</span>
                <span class="value">${results.gmailLogin.averageTime?.toFixed(2) || 'N/A'}s</span>
              </div>
              <div class="stat-item">
                <span class="label">Attempts:</span>
                <span class="value">${results.gmailLogin.attempts}</span>
              </div>
            </div>
          </div>
        `;
      }
      
      content += `
        </div>
      `;
    }
    
    // Add recommendations
    if (recommendations && recommendations.length > 0) {
      content += this.generateRecommendationsContent(recommendations);
    }
    
    return content;
  }

  /**
   * Generate system benchmark content
   */
  generateSystemBenchmarkContent(data) {
    const { systemInfo, benchmarks, comparisons, summary } = data;
    
    let content = `
      <div class="summary-section">
        <h2>System Benchmark Summary</h2>
        <div class="summary-grid">
          <div class="summary-item">
            <h3>Overall Score</h3>
            <span class="value ${summary.status === 'EXCELLENT' ? 'success' : summary.status === 'GOOD' ? 'warning' : 'error'}">
              ${summary.overallScore?.toFixed(1) || 'N/A'}%
            </span>
          </div>
          <div class="summary-item">
            <h3>Status</h3>
            <span class="value ${summary.status === 'EXCELLENT' ? 'success' : summary.status === 'GOOD' ? 'warning' : 'error'}">
              ${summary.status || 'UNKNOWN'}
            </span>
          </div>
          <div class="summary-item">
            <h3>Metrics Passed</h3>
            <span class="value">${summary.passedComparisons}/${summary.totalComparisons}</span>
          </div>
        </div>
      </div>
    `;
    
    // Add system info
    if (systemInfo) {
      content += `
        <div class="system-info-section">
          <h2>System Information</h2>
          <div class="system-info-grid">
            <div class="info-item">
              <h4>Platform</h4>
              <span>${systemInfo.platform}-${systemInfo.arch}</span>
            </div>
            <div class="info-item">
              <h4>CPU</h4>
              <span>${systemInfo.cpuCount} cores</span>
            </div>
            <div class="info-item">
              <h4>Memory</h4>
              <span>${(systemInfo.totalMemory / 1024 / 1024 / 1024).toFixed(1)}GB</span>
            </div>
            <div class="info-item">
              <h4>Node.js</h4>
              <span>${systemInfo.nodeVersion}</span>
            </div>
          </div>
        </div>
      `;
    }
    
    // Add benchmarks
    if (benchmarks) {
      content += `
        <div class="benchmarks-section">
          <h2>Benchmark Results</h2>
      `;
      
      Object.entries(benchmarks).forEach(([name, benchmark]) => {
        if (benchmark.mean !== undefined) {
          content += `
            <div class="benchmark-detail">
              <h3>${name}</h3>
              <div class="benchmark-stats">
                <div class="stat">
                  <span class="label">Mean:</span>
                  <span class="value">${benchmark.mean.toFixed(3)}s</span>
                </div>
                <div class="stat">
                  <span class="label">Median:</span>
                  <span class="value">${benchmark.median.toFixed(3)}s</span>
                </div>
                <div class="stat">
                  <span class="label">Min:</span>
                  <span class="value">${benchmark.min.toFixed(3)}s</span>
                </div>
                <div class="stat">
                  <span class="label">Max:</span>
                  <span class="value">${benchmark.max.toFixed(3)}s</span>
                </div>
                <div class="stat">
                  <span class="label">Std Dev:</span>
                  <span class="value">${benchmark.stdDev.toFixed(3)}s</span>
                </div>
              </div>
            </div>
          `;
        }
      });
      
      content += `
        </div>
      `;
    }
    
    // Add comparisons
    if (comparisons) {
      content += `
        <div class="comparisons-section">
          <h2>Target Comparisons</h2>
          <div class="comparisons-grid">
      `;
      
      Object.entries(comparisons).forEach(([metric, comparison]) => {
        const statusClass = comparison.passed ? 'success' : 'error';
        content += `
          <div class="comparison-card ${statusClass}">
            <h3>${metric}</h3>
            <div class="comparison-stats">
              <div class="stat">
                <span class="label">Target:</span>
                <span class="value">${comparison.target}${metric.includes('speed') ? 'x' : '%'}</span>
              </div>
              <div class="stat">
                <span class="label">Actual:</span>
                <span class="value">${comparison.actual?.toFixed(2) || 'N/A'}${metric.includes('speed') ? 'x' : '%'}</span>
              </div>
              <div class="stat">
                <span class="label">Difference:</span>
                <span class="value">${comparison.difference?.toFixed(2) || 'N/A'}${metric.includes('speed') ? 'x' : '%'}</span>
              </div>
            </div>
            <div class="status">${comparison.passed ? 'PASSED' : 'FAILED'}</div>
          </div>
        `;
      });
      
      content += `
          </div>
        </div>
      `;
    }
    
    return content;
  }

  /**
   * Generate system metrics content
   */
  generateSystemMetricsContent(data) {
    const { system, performance: perf, resources, operations, health } = data;
    
    let content = `
      <div class="summary-section">
        <h2>System Metrics Summary</h2>
        <div class="summary-grid">
          <div class="summary-item">
            <h3>Health Score</h3>
            <span class="value ${health?.score >= 80 ? 'success' : health?.score >= 60 ? 'warning' : 'error'}">
              ${health?.score?.toFixed(1) || 'N/A'}%
            </span>
          </div>
          <div class="summary-item">
            <h3>Status</h3>
            <span class="value ${health?.status === 'healthy' ? 'success' : health?.status === 'warning' ? 'warning' : 'error'}">
              ${health?.status?.toUpperCase() || 'UNKNOWN'}
            </span>
          </div>
          <div class="summary-item">
            <h3>Issues</h3>
            <span class="value ${health?.issues?.length === 0 ? 'success' : 'warning'}">
              ${health?.issues?.length || 0}
            </span>
          </div>
        </div>
      </div>
    `;
    
    // Add system information
    if (system) {
      content += `
        <div class="system-section">
          <h2>System Information</h2>
          <div class="system-grid">
            <div class="system-card">
              <h3>Platform</h3>
              <p>${system.platform}-${system.arch}</p>
              <p>Release: ${system.release}</p>
            </div>
            <div class="system-card">
              <h3>CPU</h3>
              <p>Cores: ${system.cpus?.length || 'N/A'}</p>
              <p>Model: ${system.cpus?.[0]?.model || 'N/A'}</p>
            </div>
            <div class="system-card">
              <h3>Memory</h3>
              <p>Total: ${(system.memory?.total / 1024 / 1024 / 1024).toFixed(1)}GB</p>
              <p>Used: ${(system.memory?.used / 1024 / 1024 / 1024).toFixed(1)}GB</p>
              <p>Free: ${(system.memory?.free / 1024 / 1024 / 1024).toFixed(1)}GB</p>
            </div>
            <div class="system-card">
              <h3>Node.js</h3>
              <p>Version: ${system.nodeVersion}</p>
              <p>PID: ${system.process?.pid}</p>
              <p>Uptime: ${(system.process?.uptime / 3600).toFixed(1)}h</p>
            </div>
          </div>
        </div>
      `;
    }
    
    // Add resource metrics
    if (resources) {
      content += `
        <div class="resources-section">
          <h2>Resource Usage</h2>
          <div class="resources-grid">
            <div class="resource-card">
              <h3>Memory Usage</h3>
              <div class="resource-stats">
                <div class="stat">
                  <span class="label">RSS:</span>
                  <span class="value">${(resources.current?.rss / 1024 / 1024).toFixed(1)}MB</span>
                </div>
                <div class="stat">
                  <span class="label">Heap Used:</span>
                  <span class="value">${(resources.current?.heapUsed / 1024 / 1024).toFixed(1)}MB</span>
                </div>
                <div class="stat">
                  <span class="label">Heap Total:</span>
                  <span class="value">${(resources.current?.heapTotal / 1024 / 1024).toFixed(1)}MB</span>
                </div>
                <div class="stat">
                  <span class="label">External:</span>
                  <span class="value">${(resources.current?.external / 1024 / 1024).toFixed(1)}MB</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }
    
    return content;
  }

  /**
   * Generate success criteria content
   */
  generateSuccessCriteriaContent(data) {
    const { criteria, summary, recommendations } = data;
    
    let content = `
      <div class="summary-section">
        <h2>Success Criteria Validation Summary</h2>
        <div class="summary-grid">
          <div class="summary-item">
            <h3>Overall Score</h3>
            <span class="value ${summary.status === 'EXCELLENT' ? 'success' : summary.status === 'GOOD' ? 'warning' : 'error'}">
              ${summary.overallScore?.toFixed(1) || 'N/A'}%
            </span>
          </div>
          <div class="summary-item">
            <h3>Status</h3>
            <span class="value ${summary.status === 'EXCELLENT' ? 'success' : summary.status === 'GOOD' ? 'warning' : 'error'}">
              ${summary.status || 'UNKNOWN'}
            </span>
          </div>
          <div class="summary-item">
            <h3>Criteria Passed</h3>
            <span class="value">${summary.passedCriteria}/${summary.totalCriteria}</span>
          </div>
        </div>
      </div>
    `;
    
    // Add criteria details
    if (criteria) {
      content += `
        <div class="criteria-section">
          <h2>Success Criteria Details</h2>
          <div class="criteria-grid">
      `;
      
      Object.values(criteria).forEach(criterion => {
        const statusClass = criterion.passed ? 'success' : 'error';
        content += `
          <div class="criterion-card ${statusClass}">
            <h3>${criterion.name}</h3>
            <div class="criterion-details">
              <p><strong>Category:</strong> ${criterion.category}</p>
              <p><strong>Weight:</strong> ${criterion.weight}%</p>
              <p><strong>Threshold:</strong> ${criterion.threshold}${criterion.id.includes('speed') ? 'x' : '%'}</p>
              <p><strong>Actual:</strong> ${criterion.actual?.toFixed(2) || 'N/A'}${criterion.id.includes('speed') ? 'x' : '%'}</p>
              <p><strong>Description:</strong> ${criterion.description}</p>
            </div>
            <div class="criterion-status">${criterion.passed ? 'PASSED' : 'FAILED'}</div>
          </div>
        `;
      });
      
      content += `
          </div>
        </div>
      `;
    }
    
    // Add recommendations
    if (recommendations && recommendations.length > 0) {
      content += this.generateRecommendationsContent(recommendations);
    }
    
    return content;
  }

  /**
   * Generate recommendations content
   */
  generateRecommendationsContent(recommendations) {
    let content = `
      <div class="recommendations-section">
        <h2>Recommendations</h2>
        <div class="recommendations-grid">
    `;
    
    recommendations.forEach(rec => {
      const priorityClass = rec.priority === 'HIGH' ? 'high' : rec.priority === 'MEDIUM' ? 'medium' : 'low';
      content += `
        <div class="recommendation-card ${priorityClass}">
          <div class="priority">${rec.priority}</div>
          <div class="category">${rec.category}</div>
          <h3>${rec.criterion || rec.category}</h3>
          <p class="description">${rec.description}</p>
          <p class="action"><strong>Action:</strong> ${rec.action}</p>
        </div>
      `;
    });
    
    content += `
        </div>
      </div>
    `;
    
    return content;
  }

  /**
   * Generate default content
   */
  generateDefaultContent(data) {
    return `
      <div class="default-section">
        <h2>Report Data</h2>
        <pre>${JSON.stringify(data, null, 2)}</pre>
      </div>
    `;
  }

  /**
   * Get HTML template
   */
  getHTMLTemplate() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{TITLE}}</title>
    <style>{{STYLES}}</style>
</head>
<body>
    <div class="container">
        <header class="header">
            <h1>CDP Stealth System</h1>
            <h2>{{TITLE}}</h2>
            <div class="timestamp">
                Generated: {{TIMESTAMP}}
            </div>
        </header>
        
        <main class="main">
            {{CONTENT}}
        </main>
        
        <footer class="footer">
            <p>CDP Stealth System Report - {{REPORT_TYPE}}</p>
            <p>Generated on {{TIMESTAMP}}</p>
        </footer>
    </div>
    
    <script>{{SCRIPTS}}</script>
</body>
</html>
    `;
  }

  /**
   * Get report styles
   */
  getReportStyles() {
    return `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        line-height: 1.6;
        color: #333;
        background-color: #f5f5f5;
      }
      
      .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
      }
      
      .header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 2rem;
        border-radius: 10px;
        margin-bottom: 2rem;
        text-align: center;
      }
      
      .header h1 {
        font-size: 2.5rem;
        margin-bottom: 0.5rem;
      }
      
      .header h2 {
        font-size: 1.8rem;
        margin-bottom: 1rem;
        opacity: 0.9;
      }
      
      .timestamp {
        font-size: 0.9rem;
        opacity: 0.8;
      }
      
      .summary-section, .optimizations-section, .benchmarks-section,
      .results-section, .system-info-section, .comparisons-section,
      .criteria-section, .recommendations-section, .system-section,
      .resources-section {
        background: white;
        border-radius: 10px;
        padding: 2rem;
        margin-bottom: 2rem;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      }
      
      .summary-grid, .optimizations-grid, .benchmarks-grid,
      .comparisons-grid, .criteria-grid, .recommendations-grid,
      .system-grid, .resources-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 1.5rem;
        margin-top: 1.5rem;
      }
      
      .summary-item, .optimization-card, .benchmark-card,
      .comparison-card, .criterion-card, .recommendation-card,
      .system-card, .resource-card {
        background: #f8f9fa;
        border-radius: 8px;
        padding: 1.5rem;
        border-left: 4px solid #ddd;
      }
      
      .summary-item h3, .optimization-card h3, .benchmark-card h3,
      .comparison-card h3, .criterion-card h3, .recommendation-card h3 {
        margin-bottom: 1rem;
        color: #333;
      }
      
      .summary-item .value {
        font-size: 2rem;
        font-weight: bold;
        display: block;
        margin-top: 0.5rem;
      }
      
      .value.success { color: #28a745; }
      .value.warning { color: #ffc107; }
      .value.error { color: #dc3545; }
      
      .optimization-card.success, .benchmark-card.success,
      .comparison-card.success, .criterion-card.success {
        border-left-color: #28a745;
      }
      
      .optimization-card.error, .benchmark-card.warning,
      .comparison-card.error, .criterion-card.error {
        border-left-color: #dc3545;
      }
      
      .score-indicator {
        margin: 1rem 0;
        background: #e9ecef;
        border-radius: 20px;
        height: 20px;
        position: relative;
        overflow: hidden;
      }
      
      .score-bar {
        height: 100%;
        background: linear-gradient(90deg, #28a745, #20c997);
        transition: width 0.3s ease;
      }
      
      .score-indicator span {
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        font-weight: bold;
        color: #333;
      }
      
      .checks-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 1rem;
        margin-top: 1rem;
      }
      
      .check-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.5rem;
        background: #f8f9fa;
        border-radius: 4px;
      }
      
      .check-item.success { border-left: 3px solid #28a745; }
      .check-item.error { border-left: 3px solid #dc3545; }
      
      .recommendation-card {
        position: relative;
      }
      
      .recommendation-card .priority {
        position: absolute;
        top: 10px;
        right: 10px;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-size: 0.8rem;
        font-weight: bold;
        color: white;
      }
      
      .recommendation-card.high .priority { background: #dc3545; }
      .recommendation-card.medium .priority { background: #ffc107; }
      .recommendation-card.low .priority { background: #6c757d; }
      
      .footer {
        text-align: center;
        padding: 2rem;
        color: #666;
        border-top: 1px solid #eee;
        margin-top: 2rem;
      }
      
      @media (max-width: 768px) {
        .container {
          padding: 10px;
        }
        
        .header {
          padding: 1.5rem;
        }
        
        .header h1 {
          font-size: 2rem;
        }
        
        .header h2 {
          font-size: 1.5rem;
        }
        
        .summary-grid, .optimizations-grid, .benchmarks-grid,
        .comparisons-grid, .criteria-grid, .recommendations-grid {
          grid-template-columns: 1fr;
        }
      }
    `;
  }

  /**
   * Get report scripts
   */
  getReportScripts() {
    return `
      // Add any interactive JavaScript here
      document.addEventListener('DOMContentLoaded', function() {
        console.log('CDP Stealth Report loaded');
      });
    `;
  }

  /**
   * Get JSON template
   */
  getJSONTemplate() {
    return '{}'; // Simple JSON template
  }
}

module.exports = ReportGenerator;