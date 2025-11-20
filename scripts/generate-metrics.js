#!/usr/bin/env node

/**
 * System Metrics Collection Script
 * 
 * This script collects comprehensive system metrics for the CDP Stealth system,
 * including performance data, resource usage, and operational statistics.
 * 
 * Based on specifications from document.pdf for monitoring system health
 * and ensuring production readiness.
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const { execSync } = require('child_process');
const os = require('os');

// Import utility modules
const MetricsCollector = require('./utils/metrics-collector');
const ReportGenerator = require('./utils/report-generator');

class MetricsGenerator {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.metricsCollector = new MetricsCollector();
    this.reportGenerator = new ReportGenerator();
    this.metrics = {
      timestamp: new Date().toISOString(),
      system: {},
      performance: {},
      resources: {},
      operations: {},
      health: {}
    };
  }

  /**
   * Main metrics collection workflow
   */
  async generateMetrics() {
    console.log('📊 Starting System Metrics Collection');
    console.log('='.repeat(60));
    
    const startTime = performance.now();
    
    try {
      // 1. Collect system information
      await this.collectSystemMetrics();
      
      // 2. Collect performance metrics
      await this.collectPerformanceMetrics();
      
      // 3. Collect resource usage metrics
      await this.collectResourceMetrics();
      
      // 4. Collect operational metrics
      await this.collectOperationalMetrics();
      
      // 5. Collect health metrics
      await this.collectHealthMetrics();
      
      // 6. Generate metrics report
      await this.generateMetricsReport();
      
      const totalTime = (performance.now() - startTime) / 1000;
      console.log(`✅ Metrics collection completed in ${totalTime.toFixed(2)}s`);
      
      return this.metrics;
      
    } catch (error) {
      console.error('❌ Metrics collection failed:', error.message);
      throw error;
    }
  }

  /**
   * Collect system information metrics
   */
  async collectSystemMetrics() {
    console.log('\n💻 Collecting System Metrics...');
    
    const systemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      hostname: os.hostname(),
      uptime: os.uptime(),
      loadAverage: os.loadavg(),
      cpus: os.cpus().map(cpu => ({
        model: cpu.model,
        speed: cpu.speed,
        cores: cpu.cores || 1
      })),
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        available: os.freemem(), // Approximation
        used: os.totalmem() - os.freemem()
      },
      networkInterfaces: os.networkInterfaces(),
      nodeVersion: process.version,
      process: {
        pid: process.pid,
        ppid: process.ppid,
        uptime: process.uptime(),
        version: process.version,
        title: process.title,
        execPath: process.execPath,
        execArgv: process.execArgv,
        argv: process.argv
      }
    };
    
    // Add disk usage information
    try {
      const diskUsage = execSync('df -h .', { encoding: 'utf8' });
      systemInfo.disk = {
        usage: diskUsage.trim(),
        available: this.parseDiskUsage(diskUsage)
      };
    } catch (error) {
      console.warn('   ⚠️ Could not get disk usage information');
    }
    
    // Add Chrome/Chromium version
    try {
      const chromeVersion = execSync('google-chrome --version 2>/dev/null || chromium --version 2>/dev/null || echo "Not found"', { encoding: 'utf8' });
      systemInfo.chrome = {
        version: chromeVersion.trim(),
        available: chromeVersion.trim() !== 'Not found'
      };
    } catch (error) {
      systemInfo.chrome = {
        version: 'Not found',
        available: false
      };
    }
    
    this.metrics.system = systemInfo;
    
    console.log(`   📊 System: ${systemInfo.platform}-${systemInfo.arch}`);
    console.log(`   💾 Memory: ${(systemInfo.memory.used / 1024 / 1024 / 1024).toFixed(1)}GB/${(systemInfo.memory.total / 1024 / 1024 / 1024).toFixed(1)}GB`);
    console.log(`   🖥️ CPUs: ${systemInfo.cpus.length} cores`);
    console.log(`   🌐 Chrome: ${systemInfo.chrome.version}`);
  }

  /**
   * Collect performance metrics
   */
  async collectPerformanceMetrics() {
    console.log('\n⚡ Collecting Performance Metrics...');
    
    const performanceMetrics = {
      chromeLaunch: await this.measureChromeLaunchPerformance(),
      cdpExecution: await this.measureCDPPerformance(),
      pageLoad: await this.measurePageLoadPerformance(),
      scriptExecution: await this.measureScriptExecutionPerformance()
    };
    
    this.metrics.performance = performanceMetrics;
    
    console.log(`   🚀 Chrome launch: ${performanceMetrics.chromeLaunch.mean.toFixed(2)}s`);
    console.log(`   ⚡ CDP execution: ${performanceMetrics.cdpExecution.mean.toFixed(3)}s`);
    console.log(`   📄 Page load: ${performanceMetrics.pageLoad.mean.toFixed(2)}s`);
    console.log(`   🧪 Script execution: ${performanceMetrics.scriptExecution.mean.toFixed(3)}s`);
  }

  /**
   * Collect resource usage metrics
   */
  async collectResourceMetrics() {
    console.log('\n💾 Collecting Resource Metrics...');
    
    const resourceMetrics = {
      current: process.memoryUsage(),
      system: {
        cpuUsage: process.cpuUsage(),
        hrTime: process.hrtime(),
        resourceUsage: process.resourceUsage()
      }
    };
    
    // Add historical resource usage if available
    const metricsDir = path.join(this.projectRoot, 'metrics');
    if (fs.existsSync(metricsDir)) {
      try {
        const historicalFiles = fs.readdirSync(metricsDir)
          .filter(file => file.endsWith('.json'))
          .sort()
          .slice(-10); // Last 10 metrics files
        
        resourceMetrics.historical = historicalFiles.map(file => {
          const filePath = path.join(metricsDir, file);
          try {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
          } catch (error) {
            return null;
          }
        }).filter(Boolean);
      } catch (error) {
        console.warn('   ⚠️ Could not load historical metrics');
      }
    }
    
    this.metrics.resources = resourceMetrics;
    
    console.log(`   💾 Current RSS: ${(resourceMetrics.current.rss / 1024 / 1024).toFixed(1)}MB`);
    console.log(`   🧠 Heap used: ${(resourceMetrics.current.heapUsed / 1024 / 1024).toFixed(1)}MB`);
    console.log(`   📊 External: ${(resourceMetrics.current.external / 1024 / 1024).toFixed(1)}MB`);
  }

  /**
   * Collect operational metrics
   */
  async collectOperationalMetrics() {
    console.log('\n🔧 Collecting Operational Metrics...');
    
    const operationalMetrics = {
      project: {
        name: 'CDP Stealth System',
        version: '1.0.0',
        root: this.projectRoot,
        lastModified: this.getProjectLastModified()
      },
      files: {
        total: this.countFiles(this.projectRoot),
        byType: this.countFilesByType(this.projectRoot),
        size: this.getProjectSize()
      },
      dependencies: {
        npm: this.getNpmDependencies(),
        python: this.getPythonDependencies()
      },
      configuration: {
        chromeFlags: this.getChromeFlags(),
        extension: this.getExtensionInfo(),
        tests: this.getTestInfo()
      }
    };
    
    this.metrics.operations = operationalMetrics;
    
    console.log(`   📁 Project files: ${operationalMetrics.files.total}`);
    console.log(`   📦 NPM dependencies: ${operationalMetrics.dependencies.npm.length}`);
    console.log(`   🐍 Python dependencies: ${operationalMetrics.dependencies.python.length}`);
    console.log(`   🧪 Test files: ${operationalMetrics.configuration.tests.length}`);
  }

  /**
   * Collect health metrics
   */
  async collectHealthMetrics() {
    console.log('\n🏥 Collecting Health Metrics...');
    
    const healthMetrics = {
      status: 'unknown',
      checks: {},
      score: 0,
      issues: []
    };
    
    // Check critical components
    const checks = [
      { name: 'Chrome executable', check: () => this.checkChromeExecutable() },
      { name: 'CDP module', check: () => this.checkCDPModule() },
      { name: 'Extension manifest', check: () => this.checkExtensionManifest() },
      { name: 'Test files', check: () => this.checkTestFiles() },
      { name: 'Debug directory', check: () => this.checkDebugDirectory() },
      { name: 'Integuru integration', check: () => this.checkInteguruIntegration() },
      { name: 'MCP server', check: () => this.checkMCPServer() }
    ];
    
    let passedChecks = 0;
    
    for (const { name, check } of checks) {
      try {
        const result = await check();
        healthMetrics.checks[name] = {
          status: result ? 'pass' : 'fail',
          details: result
        };
        
        if (result) {
          passedChecks++;
          console.log(`   ✅ ${name}`);
        } else {
          console.log(`   ❌ ${name}`);
          healthMetrics.issues.push(`${name} check failed`);
        }
      } catch (error) {
        healthMetrics.checks[name] = {
          status: 'error',
          error: error.message
        };
        console.log(`   💥 ${name}: ${error.message}`);
        healthMetrics.issues.push(`${name} check error: ${error.message}`);
      }
    }
    
    healthMetrics.score = (passedChecks / checks.length) * 100;
    healthMetrics.status = healthMetrics.score >= 80 ? 'healthy' : 
                          healthMetrics.score >= 60 ? 'warning' : 'unhealthy';
    
    this.metrics.health = healthMetrics;
    
    console.log(`   📊 Health score: ${healthMetrics.score.toFixed(1)}%`);
    console.log(`   🏥 Status: ${healthMetrics.status.toUpperCase()}`);
  }

  /**
   * Measure Chrome launch performance
   */
  async measureChromeLaunchPerformance() {
    const times = [];
    const iterations = 3;
    
    for (let i = 0; i < iterations; i++) {
      try {
        const startTime = performance.now();
        
        const { launchStealthBrowser } = require('../cdp-stealth/src/index');
        const browser = await launchStealthBrowser({ headless: true });
        
        const endTime = performance.now();
        const launchTime = (endTime - startTime) / 1000;
        times.push(launchTime);
        
        await browser.close();
      } catch (error) {
        console.warn(`   ⚠️ Chrome launch test ${i + 1} failed: ${error.message}`);
      }
    }
    
    return this.calculateStatistics(times);
  }

  /**
   * Measure CDP performance
   */
  async measureCDPPerformance() {
    const times = [];
    const iterations = 5;
    
    for (let i = 0; i < iterations; i++) {
      try {
        const startTime = performance.now();
        
        const { launchStealthBrowser } = require('../cdp-stealth/src/index');
        const browser = await launchStealthBrowser({ headless: true });
        const page = await browser.newPage();
        
        await page.evaluate(() => document.title);
        
        const endTime = performance.now();
        const executionTime = (endTime - startTime) / 1000;
        times.push(executionTime);
        
        await browser.close();
      } catch (error) {
        console.warn(`   ⚠️ CDP performance test ${i + 1} failed: ${error.message}`);
      }
    }
    
    return this.calculateStatistics(times);
  }

  /**
   * Measure page load performance
   */
  async measurePageLoadPerformance() {
    const times = [];
    const iterations = 3;
    
    for (let i = 0; i < iterations; i++) {
      try {
        const startTime = performance.now();
        
        const { launchStealthBrowser } = require('../cdp-stealth/src/index');
        const browser = await launchStealthBrowser({ headless: true });
        const page = await browser.newPage();
        
        await page.goto('https://example.com', { waitUntil: 'networkidle2' });
        
        const endTime = performance.now();
        const loadTime = (endTime - startTime) / 1000;
        times.push(loadTime);
        
        await browser.close();
      } catch (error) {
        console.warn(`   ⚠️ Page load test ${i + 1} failed: ${error.message}`);
      }
    }
    
    return this.calculateStatistics(times);
  }

  /**
   * Measure script execution performance
   */
  async measureScriptExecutionPerformance() {
    const times = [];
    const iterations = 10;
    
    for (let i = 0; i < iterations; i++) {
      try {
        const startTime = performance.now();
        
        // Simple computation test
        let result = 0;
        for (let j = 0; j < 1000000; j++) {
          result += Math.random();
        }
        
        const endTime = performance.now();
        const executionTime = (endTime - startTime) / 1000;
        times.push(executionTime);
      } catch (error) {
        console.warn(`   ⚠️ Script execution test ${i + 1} failed: ${error.message}`);
      }
    }
    
    return this.calculateStatistics(times);
  }

  /**
   * Calculate statistics for an array of numbers
   */
  calculateStatistics(numbers) {
    if (numbers.length === 0) {
      return { mean: 0, median: 0, min: 0, max: 0, stdDev: 0, count: 0 };
    }
    
    const sorted = [...numbers].sort((a, b) => a - b);
    const sum = numbers.reduce((a, b) => a + b, 0);
    const mean = sum / numbers.length;
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
    
    const variance = numbers.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / numbers.length;
    const stdDev = Math.sqrt(variance);
    
    return {
      mean,
      median,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      stdDev,
      count: numbers.length
    };
  }

  /**
   * Parse disk usage output
   */
  parseDiskUsage(diskOutput) {
    try {
      const lines = diskOutput.split('\n');
      if (lines.length >= 2) {
        const parts = lines[1].split(/\s+/);
        return {
          total: parts[1],
          used: parts[2],
          available: parts[3],
          percentage: parts[4],
          mount: parts[5]
        };
      }
    } catch (error) {
      // Ignore parsing errors
    }
    return null;
  }

  /**
   * Get project last modified time
   */
  getProjectLastModified() {
    try {
      const stats = fs.statSync(this.projectRoot);
      return stats.mtime.toISOString();
    } catch (error) {
      return null;
    }
  }

  /**
   * Count files in project
   */
  countFiles(dir) {
    let count = 0;
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stats = fs.statSync(fullPath);
        if (stats.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          count += this.countFiles(fullPath);
        } else if (stats.isFile()) {
          count++;
        }
      }
    } catch (error) {
      // Ignore errors
    }
    return count;
  }

  /**
   * Count files by type
   */
  countFilesByType(dir) {
    const types = {};
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stats = fs.statSync(fullPath);
        if (stats.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          const subTypes = this.countFilesByType(fullPath);
          for (const [type, count] of Object.entries(subTypes)) {
            types[type] = (types[type] || 0) + count;
          }
        } else if (stats.isFile()) {
          const ext = path.extname(item).toLowerCase() || 'no-extension';
          types[ext] = (types[ext] || 0) + 1;
        }
      }
    } catch (error) {
      // Ignore errors
    }
    return types;
  }

  /**
   * Get project size
   */
  getProjectSize() {
    let totalSize = 0;
    try {
      const items = fs.readdirSync(this.projectRoot);
      for (const item of items) {
        const fullPath = path.join(this.projectRoot, item);
        const stats = fs.statSync(fullPath);
        if (stats.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          totalSize += this.getDirectorySize(fullPath);
        } else if (stats.isFile()) {
          totalSize += stats.size;
        }
      }
    } catch (error) {
      // Ignore errors
    }
    return totalSize;
  }

  /**
   * Get directory size
   */
  getDirectorySize(dir) {
    let totalSize = 0;
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stats = fs.statSync(fullPath);
        if (stats.isDirectory()) {
          totalSize += this.getDirectorySize(fullPath);
        } else if (stats.isFile()) {
          totalSize += stats.size;
        }
      }
    } catch (error) {
      // Ignore errors
    }
    return totalSize;
  }

  /**
   * Get NPM dependencies
   */
  getNpmDependencies() {
    try {
      const packageJsonPath = path.join(this.projectRoot, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        return {
          dependencies: Object.keys(packageJson.dependencies || {}),
          devDependencies: Object.keys(packageJson.devDependencies || {}),
          total: Object.keys(packageJson.dependencies || {}).length + Object.keys(packageJson.devDependencies || {}).length
        };
      }
    } catch (error) {
      // Ignore errors
    }
    return { dependencies: [], devDependencies: [], total: 0 };
  }

  /**
   * Get Python dependencies
   */
  getPythonDependencies() {
    try {
      const requirementsPath = path.join(this.projectRoot, 'requirements.txt');
      if (fs.existsSync(requirementsPath)) {
        const requirements = fs.readFileSync(requirementsPath, 'utf8');
        const lines = requirements.split('\n').filter(line => line.trim() && !line.startsWith('#'));
        return lines;
      }
    } catch (error) {
      // Ignore errors
    }
    return [];
  }

  /**
   * Get Chrome flags
   */
  getChromeFlags() {
    try {
      const chromeStartPath = path.join(this.projectRoot, 'cdp-stealth/chrome_start.sh');
      if (fs.existsSync(chromeStartPath)) {
        const content = fs.readFileSync(chromeStartPath, 'utf8');
        const flags = content.match(/--[\w-]+/g) || [];
        return flags;
      }
    } catch (error) {
      // Ignore errors
    }
    return [];
  }

  /**
   * Get extension info
   */
  getExtensionInfo() {
    try {
      const manifestPath = path.join(this.projectRoot, 'extensions/cdp-stealth/manifest.json');
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        return {
          name: manifest.name,
          version: manifest.version,
          manifestVersion: manifest.manifest_version,
          permissions: manifest.permissions || [],
          hasBackground: !!manifest.background
        };
      }
    } catch (error) {
      // Ignore errors
    }
    return null;
  }

  /**
   * Get test info
   */
  getTestInfo() {
    const testFiles = [];
    const testDirs = ['src/test', 'scripts', 'cdp-stealth/src/test'];
    
    for (const testDir of testDirs) {
      const fullPath = path.join(this.projectRoot, testDir);
      if (fs.existsSync(fullPath)) {
        try {
          const files = fs.readdirSync(fullPath);
          for (const file of files) {
            if (file.endsWith('.js') && (file.includes('test') || file.includes('verify'))) {
              testFiles.push(path.join(testDir, file));
            }
          }
        } catch (error) {
          // Ignore errors
        }
      }
    }
    
    return testFiles;
  }

  // Health check methods
  async checkChromeExecutable() {
    const { getChromeExecutable } = require('../cdp-stealth/src/config/environment');
    const chromePath = getChromeExecutable();
    return fs.existsSync(chromePath);
  }

  async checkCDPModule() {
    try {
      const modulePath = path.join(this.projectRoot, 'cdp-stealth/src/index.js');
      return fs.existsSync(modulePath);
    } catch (error) {
      return false;
    }
  }

  async checkExtensionManifest() {
    try {
      const manifestPath = path.join(this.projectRoot, 'extensions/cdp-stealth/manifest.json');
      return fs.existsSync(manifestPath);
    } catch (error) {
      return false;
    }
  }

  async checkTestFiles() {
    try {
      const testDir = path.join(this.projectRoot, 'cdp-stealth/src/test');
      return fs.existsSync(testDir) && fs.readdirSync(testDir).length > 0;
    } catch (error) {
      return false;
    }
  }

  async checkDebugDirectory() {
    try {
      const debugDir = path.join(this.projectRoot, 'debug');
      return fs.existsSync(debugDir);
    } catch (error) {
      return false;
    }
  }

  async checkInteguruIntegration() {
    try {
      const integuruPath = path.join(this.projectRoot, 'Integuru');
      return fs.existsSync(integuruPath);
    } catch (error) {
      return false;
    }
  }

  async checkMCPServer() {
    try {
      const serverPath = path.join(this.projectRoot, 'mcp-server/server.ts');
      return fs.existsSync(serverPath);
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate metrics report
   */
  async generateMetricsReport() {
    console.log('\n📄 Generating Metrics Report...');
    
    // Save metrics to file
    const metricsDir = path.join(this.projectRoot, 'metrics');
    if (!fs.existsSync(metricsDir)) {
      fs.mkdirSync(metricsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonPath = path.join(metricsDir, `metrics-${timestamp}.json`);
    
    fs.writeFileSync(jsonPath, JSON.stringify(this.metrics, null, 2));
    
    // Generate HTML report
    const reportData = {
      timestamp: this.metrics.timestamp,
      system: this.metrics.system,
      performance: this.metrics.performance,
      resources: this.metrics.resources,
      operations: this.metrics.operations,
      health: this.metrics.health
    };
    
    const htmlReport = await this.reportGenerator.generateHTMLReport(reportData, 'system-metrics');
    
    console.log(`   📊 JSON metrics: ${jsonPath}`);
    console.log(`   📄 HTML report: ${htmlReport.path}`);
    
    // Print summary
    console.log('\n📋 Metrics Summary:');
    console.log(`   Health Score: ${this.metrics.health.score.toFixed(1)}%`);
    console.log(`   Status: ${this.metrics.health.status.toUpperCase()}`);
    console.log(`   Issues: ${this.metrics.health.issues.length}`);
    
    return { jsonPath, htmlReport };
  }
}

// CLI execution
if (require.main === module) {
  const generator = new MetricsGenerator();
  
  generator.generateMetrics()
    .then(metrics => {
      console.log('\n🎉 Metrics collection completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Metrics collection failed:', error.message);
      process.exit(1);
    });
}

module.exports = MetricsGenerator;