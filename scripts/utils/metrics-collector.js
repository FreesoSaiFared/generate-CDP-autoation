/**
 * Metrics Collector Utility
 * 
 * This utility provides comprehensive metrics collection for CDP Stealth system,
 * including performance data, resource usage, and operational statistics.
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const { EventEmitter } = require('events');

class MetricsCollector extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.projectRoot = path.resolve(__dirname, '../..');
    this.options = {
      enableRealTimeCollection: options.enableRealTimeCollection || false,
      collectionInterval: options.collectionInterval || 5000,
      maxHistorySize: options.maxHistorySize || 1000,
      persistToDisk: options.persistToDisk !== false,
      ...options
    };
    
    this.metrics = {
      timestamp: new Date().toISOString(),
      system: {},
      performance: {},
      resources: {},
      operations: {},
      custom: {}
    };
    
    this.history = [];
    this.collectionTimer = null;
    this.isCollecting = false;
    
    if (this.options.enableRealTimeCollection) {
      this.startRealTimeCollection();
    }
  }

  /**
   * Start real-time metrics collection
   */
  startRealTimeCollection() {
    if (this.isCollecting) {
      return;
    }
    
    this.isCollecting = true;
    console.log('📊 Starting real-time metrics collection...');
    
    this.collectionTimer = setInterval(() => {
      this.collectRealTimeMetrics();
    }, this.options.collectionInterval);
  }

  /**
   * Stop real-time metrics collection
   */
  stopRealTimeCollection() {
    if (!this.isCollecting) {
      return;
    }
    
    this.isCollecting = false;
    console.log('⏹️ Stopping real-time metrics collection...');
    
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = null;
    }
  }

  /**
   * Collect real-time metrics
   */
  async collectRealTimeMetrics() {
    try {
      const timestamp = Date.now();
      const metrics = {
        timestamp,
        resources: this.getResourceMetrics(),
        performance: this.getPerformanceMetrics()
      };
      
      // Add to history
      this.history.push(metrics);
      
      // Trim history if needed
      if (this.history.length > this.options.maxHistorySize) {
        this.history = this.history.slice(-this.options.maxHistorySize);
      }
      
      // Emit event
      this.emit('metrics', metrics);
      
      // Persist to disk if enabled
      if (this.options.persistToDisk) {
        await this.persistMetrics(metrics);
      }
      
    } catch (error) {
      console.error('   ❌ Error collecting real-time metrics:', error.message);
    }
  }

  /**
   * Collect comprehensive system metrics
   */
  async collectSystemMetrics() {
    try {
      const systemMetrics = {
        platform: require('os').platform(),
        arch: require('os').arch(),
        release: require('os').release(),
        hostname: require('os').hostname(),
        uptime: require('os').uptime(),
        loadAverage: require('os').loadavg(),
        cpus: require('os').cpus().map(cpu => ({
          model: cpu.model,
          speed: cpu.speed,
          cores: cpu.cores || 1
        })),
        memory: {
          total: require('os').totalmem(),
          free: require('os').freemem(),
          available: require('os').freemem(),
          used: require('os').totalmem() - require('os').freemem()
        },
        networkInterfaces: require('os').networkInterfaces(),
        nodeVersion: process.version,
        process: {
          pid: process.pid,
          ppid: process.ppid,
          uptime: process.uptime(),
          version: process.version,
          title: process.title,
          execPath: process.execPath
        }
      };
      
      this.metrics.system = systemMetrics;
      this.emit('systemMetrics', systemMetrics);
      
      return systemMetrics;
      
    } catch (error) {
      console.error('   ❌ Error collecting system metrics:', error.message);
      return {};
    }
  }

  /**
   * Collect performance metrics
   */
  async collectPerformanceMetrics() {
    try {
      const performanceMetrics = {
        node: {
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage(),
          hrTime: process.hrtime(),
          resourceUsage: process.resourceUsage()
        },
        eventLoop: this.getEventLoopMetrics(),
        gc: this.getGCMetrics(),
        timing: this.getTimingMetrics()
      };
      
      this.metrics.performance = performanceMetrics;
      this.emit('performanceMetrics', performanceMetrics);
      
      return performanceMetrics;
      
    } catch (error) {
      console.error('   ❌ Error collecting performance metrics:', error.message);
      return {};
    }
  }

  /**
   * Collect resource usage metrics
   */
  async collectResourceMetrics() {
    try {
      const resourceMetrics = {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        handles: process._getActiveHandles().length,
        requests: process._getActiveRequests().length,
        fileDescriptors: this.getFileDescriptorCount(),
        diskUsage: this.getDiskUsage(),
        networkUsage: this.getNetworkUsage()
      };
      
      this.metrics.resources = resourceMetrics;
      this.emit('resourceMetrics', resourceMetrics);
      
      return resourceMetrics;
      
    } catch (error) {
      console.error('   ❌ Error collecting resource metrics:', error.message);
      return {};
    }
  }

  /**
   * Collect operational metrics
   */
  async collectOperationalMetrics() {
    try {
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
      this.emit('operationalMetrics', operationalMetrics);
      
      return operationalMetrics;
      
    } catch (error) {
      console.error('   ❌ Error collecting operational metrics:', error.message);
      return {};
    }
  }

  /**
   * Record custom metric
   */
  recordCustomMetric(name, value, tags = {}) {
    if (!this.metrics.custom[name]) {
      this.metrics.custom[name] = {
        values: [],
        tags: {},
        timestamp: Date.now()
      };
    }
    
    this.metrics.custom[name].values.push({
      value,
      timestamp: Date.now(),
      tags
    });
    
    // Trim values if needed
    if (this.metrics.custom[name].values.length > this.options.maxHistorySize) {
      this.metrics.custom[name].values = this.metrics.custom[name].values.slice(-this.options.maxHistorySize);
    }
    
    this.emit('customMetric', { name, value, tags });
  }

  /**
   * Get current resource metrics
   */
  getResourceMetrics() {
    return {
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      timestamp: Date.now()
    };
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics() {
    return {
      eventLoop: this.getEventLoopMetrics(),
      timestamp: Date.now()
    };
  }

  /**
   * Get event loop metrics
   */
  getEventLoopMetrics() {
    const start = process.hrtime.bigint();
    
    setImmediate(() => {
      const delay = Number(process.hrtime.bigint() - start) / 1000000; // Convert to milliseconds
      return delay;
    });
    
    return {
      delay: 0, // Would be measured in the setImmediate callback
      timestamp: Date.now()
    };
  }

  /**
   * Get garbage collection metrics
   */
  getGCMetrics() {
    if (!global.gc) {
      return { available: false };
    }
    
    try {
      const stats = require('v8').getHeapStatistics();
      return {
        available: true,
        heapSizeLimit: stats.heap_size_limit,
        totalHeapSize: stats.total_heap_size,
        usedHeapSize: stats.used_heap_size,
        heapSizeLimitPercentage: (stats.used_heap_size / stats.heap_size_limit) * 100
      };
    } catch (error) {
      return { available: false, error: error.message };
    }
  }

  /**
   * Get timing metrics
   */
  getTimingMetrics() {
    return {
      uptime: process.uptime(),
      timestamp: Date.now(),
      hrtime: process.hrtime()
    };
  }

  /**
   * Get file descriptor count
   */
  getFileDescriptorCount() {
    try {
      const { execSync } = require('child_process');
      const output = execSync('lsof -p ' + process.pid, { encoding: 'utf8' });
      return output.split('\n').length - 1; // Subtract 1 for header line
    } catch (error) {
      return -1; // Not available
    }
  }

  /**
   * Get disk usage
   */
  getDiskUsage() {
    try {
      const { execSync } = require('child_process');
      const output = execSync('df -h .', { encoding: 'utf8' });
      const lines = output.split('\n');
      
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
      // Ignore errors
    }
    
    return null;
  }

  /**
   * Get network usage
   */
  getNetworkUsage() {
    try {
      const { execSync } = require('child_process');
      const output = execSync('cat /proc/net/dev', { encoding: 'utf8' });
      const lines = output.split('\n');
      
      const interfaces = {};
      for (let i = 2; i < lines.length; i++) {
        const parts = lines[i].trim().split(/\s+/);
        if (parts.length >= 17) {
          const interfaceName = parts[0].replace(':', '');
          interfaces[interfaceName] = {
            rxBytes: parseInt(parts[1]),
            txBytes: parseInt(parts[9])
          };
        }
      }
      
      return interfaces;
    } catch (error) {
      return {};
    }
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

  /**
   * Persist metrics to disk
   */
  async persistMetrics(metrics) {
    try {
      const metricsDir = path.join(this.projectRoot, 'metrics');
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(metricsDir)) {
        fs.mkdirSync(metricsDir, { recursive: true });
      }
      
      // Write metrics to file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filePath = path.join(metricsDir, `realtime-${timestamp}.json`);
      
      fs.writeFileSync(filePath, JSON.stringify(metrics, null, 2));
      
    } catch (error) {
      console.error('   ❌ Error persisting metrics:', error.message);
    }
  }

  /**
   * Get metrics history
   */
  getHistory(timeRange = null) {
    if (!timeRange) {
      return this.history;
    }
    
    const now = Date.now();
    const startTime = now - timeRange;
    
    return this.history.filter(metric => metric.timestamp >= startTime);
  }

  /**
   * Get aggregated metrics
   */
  getAggregatedMetrics(timeRange = 60000) { // Default 1 minute
    const history = this.getHistory(timeRange);
    
    if (history.length === 0) {
      return {};
    }
    
    const aggregated = {
      count: history.length,
      timeRange,
      resources: {
        memory: {
          avg: 0,
          min: Infinity,
          max: -Infinity
        },
        cpu: {
          avg: 0,
          min: Infinity,
          max: -Infinity
        }
      }
    };
    
    // Calculate aggregates
    for (const metric of history) {
      if (metric.resources) {
        const { memory, cpu } = metric.resources;
        
        // Memory aggregates
        aggregated.resources.memory.avg += memory.heapUsed || 0;
        aggregated.resources.memory.min = Math.min(aggregated.resources.memory.min, memory.heapUsed || 0);
        aggregated.resources.memory.max = Math.max(aggregated.resources.memory.max, memory.heapUsed || 0);
        
        // CPU aggregates
        aggregated.resources.cpu.avg += cpu.user || 0;
        aggregated.resources.cpu.min = Math.min(aggregated.resources.cpu.min, cpu.user || 0);
        aggregated.resources.cpu.max = Math.max(aggregated.resources.cpu.max, cpu.user || 0);
      }
    }
    
    // Calculate averages
    aggregated.resources.memory.avg /= history.length;
    aggregated.resources.cpu.avg /= history.length;
    
    return aggregated;
  }

  /**
   * Get all current metrics
   */
  getAllMetrics() {
    return {
      ...this.metrics,
      history: this.history,
      aggregated: this.getAggregatedMetrics()
    };
  }

  /**
   * Clear metrics history
   */
  clearHistory() {
    this.history = [];
    this.emit('historyCleared');
  }

  /**
   * Export metrics to JSON
   */
  exportToJson(filePath = null) {
    const metrics = this.getAllMetrics();
    
    if (!filePath) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      filePath = path.join(this.projectRoot, `metrics-export-${timestamp}.json`);
    }
    
    fs.writeFileSync(filePath, JSON.stringify(metrics, null, 2));
    return filePath;
  }

  /**
   * Cleanup and stop collection
   */
  destroy() {
    this.stopRealTimeCollection();
    this.removeAllListeners();
    
    if (this.options.persistToDisk) {
      this.exportToJson();
    }
  }
}

module.exports = MetricsCollector;