/**
 * Diagnostic Tools - System Diagnostics Utilities
 * 
 * This module provides comprehensive system diagnostics capabilities for the
 * automation platform, including health checks, resource monitoring,
 * dependency validation, and environment analysis.
 * 
 * Features:
 * - System health monitoring
 * - Resource utilization tracking
 * - Dependency validation
 * - Environment diagnostics
 * - Network connectivity checks
 * - Browser automation health
 * - Performance bottleneck detection
 * - Automated troubleshooting recommendations
 */

const os = require('os');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const EventEmitter = require('events');
const axios = require('axios');

const execAsync = promisify(exec);

class DiagnosticTools extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = {
            checkInterval: options.checkInterval || 60000, // 1 minute
            resourceThresholds: {
                cpu: options.cpuThreshold || 80, // 80%
                memory: options.memoryThreshold || 85, // 85%
                disk: options.diskThreshold || 90, // 90%
                networkLatency: options.networkLatencyThreshold || 1000 // 1000ms
            },
            endpoints: {
                healthCheck: options.healthCheckEndpoint || 'https://www.google.com',
                apiTest: options.apiTestEndpoint || 'https://httpbin.org/get'
            },
            browserConfig: options.browserConfig || {},
            enableAutoHealing: options.enableAutoHealing !== false,
            diagnosticsDir: options.diagnosticsDir || path.join(process.cwd(), 'debug', 'diagnostics')
        };
        
        // Diagnostic state
        this.systemHealth = {
            status: 'unknown',
            lastCheck: null,
            issues: [],
            metrics: {}
        };
        
        this.resourceHistory = [];
        this.dependencyStatus = new Map();
        this.networkStatus = {
            connected: false,
            latency: null,
            lastCheck: null
        };
        
        // Health check intervals
        this.healthCheckInterval = null;
        this.resourceCheckInterval = null;
        
        // Initialize diagnostics
        this.initializeDiagnostics();
        
        // Start monitoring
        this.startMonitoring();
    }

    /**
     * Run comprehensive system diagnostics
     * 
     * @param {Object} options - Diagnostic options
     * @returns {Promise<Object>} Complete diagnostic results
     */
    async runFullDiagnostics(options = {}) {
        const {
            includeResourceCheck = true,
            includeDependencyCheck = true,
            includeNetworkCheck = true,
            includeBrowserCheck = true,
            includeEnvironmentCheck = true,
            generateReport = true
        } = options;
        
        const diagnosticResults = {
            timestamp: new Date().toISOString(),
            overallStatus: 'healthy',
            checks: {},
            recommendations: [],
            summary: {}
        };
        
        try {
            // System resource diagnostics
            if (includeResourceCheck) {
                diagnosticResults.checks.resources = await this.checkSystemResources();
            }
            
            // Dependency diagnostics
            if (includeDependencyCheck) {
                diagnosticResults.checks.dependencies = await this.checkDependencies();
            }
            
            // Network diagnostics
            if (includeNetworkCheck) {
                diagnosticResults.checks.network = await this.checkNetworkConnectivity();
            }
            
            // Browser automation diagnostics
            if (includeBrowserCheck) {
                diagnosticResults.checks.browser = await this.checkBrowserHealth();
            }
            
            // Environment diagnostics
            if (includeEnvironmentCheck) {
                diagnosticResults.checks.environment = await this.checkEnvironment();
            }
            
            // Calculate overall status
            diagnosticResults.overallStatus = this.calculateOverallStatus(diagnosticResults.checks);
            
            // Generate recommendations
            diagnosticResults.recommendations = this.generateRecommendations(diagnosticResults.checks);
            
            // Generate summary
            diagnosticResults.summary = this.generateDiagnosticSummary(diagnosticResults);
            
            // Save diagnostic report
            if (generateReport) {
                await this.saveDiagnosticReport(diagnosticResults);
            }
            
            // Update system health
            this.systemHealth = {
                status: diagnosticResults.overallStatus,
                lastCheck: new Date().toISOString(),
                issues: this.extractIssues(diagnosticResults.checks),
                metrics: diagnosticResults.checks.resources?.metrics || {}
            };
            
            // Emit diagnostic completion
            this.emit('diagnostics:completed', diagnosticResults);
            
            return diagnosticResults;
            
        } catch (error) {
            const errorResults = {
                timestamp: new Date().toISOString(),
                overallStatus: 'error',
                error: error.message,
                stack: error.stack
            };
            
            this.emit('diagnostics:error', errorResults);
            throw error;
        }
    }

    /**
     * Check system resources (CPU, memory, disk)
     * 
     * @returns {Promise<Object>} Resource check results
     */
    async checkSystemResources() {
        try {
            const startTime = Date.now();
            
            // CPU usage
            const cpuUsage = await this.getCPUUsage();
            
            // Memory usage
            const memoryUsage = this.getMemoryUsage();
            
            // Disk usage
            const diskUsage = await this.getDiskUsage();
            
            // System load
            const systemLoad = this.getSystemLoad();
            
            // Process information
            const processInfo = this.getProcessInfo();
            
            const endTime = Date.now();
            
            const resourceCheck = {
                timestamp: new Date().toISOString(),
                duration: endTime - startTime,
                status: 'healthy',
                metrics: {
                    cpu: cpuUsage,
                    memory: memoryUsage,
                    disk: diskUsage,
                    load: systemLoad,
                    process: processInfo
                },
                alerts: []
            };
            
            // Check for resource alerts
            if (cpuUsage.percentage > this.config.resourceThresholds.cpu) {
                resourceCheck.alerts.push({
                    type: 'cpu_high',
                    severity: 'warning',
                    message: `CPU usage (${cpuUsage.percentage}%) exceeds threshold (${this.config.resourceThresholds.cpu}%)`,
                    value: cpuUsage.percentage,
                    threshold: this.config.resourceThresholds.cpu
                });
                resourceCheck.status = 'warning';
            }
            
            if (memoryUsage.percentage > this.config.resourceThresholds.memory) {
                resourceCheck.alerts.push({
                    type: 'memory_high',
                    severity: 'warning',
                    message: `Memory usage (${memoryUsage.percentage}%) exceeds threshold (${this.config.resourceThresholds.memory}%)`,
                    value: memoryUsage.percentage,
                    threshold: this.config.resourceThresholds.memory
                });
                resourceCheck.status = 'warning';
            }
            
            if (diskUsage.percentage > this.config.resourceThresholds.disk) {
                resourceCheck.alerts.push({
                    type: 'disk_high',
                    severity: 'critical',
                    message: `Disk usage (${diskUsage.percentage}%) exceeds threshold (${this.config.resourceThresholds.disk}%)`,
                    value: diskUsage.percentage,
                    threshold: this.config.resourceThresholds.disk
                });
                resourceCheck.status = 'critical';
            }
            
            // Update resource history
            this.resourceHistory.push({
                timestamp: resourceCheck.timestamp,
                cpu: cpuUsage.percentage,
                memory: memoryUsage.percentage,
                disk: diskUsage.percentage
            });
            
            // Keep only last 100 entries
            if (this.resourceHistory.length > 100) {
                this.resourceHistory.shift();
            }
            
            return resourceCheck;
            
        } catch (error) {
            return {
                timestamp: new Date().toISOString(),
                status: 'error',
                error: error.message,
                metrics: null
            };
        }
    }

    /**
     * Check system dependencies
     * 
     * @returns {Promise<Object>} Dependency check results
     */
    async checkDependencies() {
        const dependencies = [
            { name: 'Node.js', command: 'node --version', required: true },
            { name: 'npm', command: 'npm --version', required: true },
            { name: 'Python', command: 'python3 --version', required: true },
            { name: 'pip', command: 'pip --version', required: true },
            { name: 'Chrome', command: 'google-chrome --version', required: true },
            { name: 'mitmproxy', command: 'mitmdump --version', required: false },
            { name: 'Integuru', command: 'cd Integuru && poetry --version', required: false }
        ];
        
        const dependencyCheck = {
            timestamp: new Date().toISOString(),
            status: 'healthy',
            dependencies: [],
            missing: [],
            issues: []
        };
        
        for (const dep of dependencies) {
            try {
                const { stdout } = await execAsync(dep.command);
                const version = stdout.trim();
                
                const dependency = {
                    name: dep.name,
                    version,
                    required: dep.required,
                    status: 'installed',
                    command: dep.command
                };
                
                dependencyCheck.dependencies.push(dependency);
                this.dependencyStatus.set(dep.name, dependency);
                
            } catch (error) {
                const dependency = {
                    name: dep.name,
                    version: null,
                    required: dep.required,
                    status: 'missing',
                    command: dep.command,
                    error: error.message
                };
                
                dependencyCheck.dependencies.push(dependency);
                this.dependencyStatus.set(dep.name, dependency);
                
                if (dep.required) {
                    dependencyCheck.missing.push(dep.name);
                    dependencyCheck.status = 'error';
                } else {
                    dependencyCheck.issues.push(`${dep.name} is not installed (optional)`);
                }
            }
        }
        
        // Check npm packages
        try {
            const packageJsonPath = path.join(process.cwd(), 'package.json');
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
            
            for (const [packageName, version] of Object.entries(packageJson.dependencies || {})) {
                try {
                    await execAsync(`npm list ${packageName}`);
                    dependencyCheck.dependencies.push({
                        name: `npm: ${packageName}`,
                        version,
                        required: true,
                        status: 'installed',
                        type: 'npm_package'
                    });
                } catch {
                    dependencyCheck.issues.push(`npm package ${packageName} not properly installed`);
                    dependencyCheck.status = 'warning';
                }
            }
        } catch (error) {
            dependencyCheck.issues.push(`Could not read package.json: ${error.message}`);
        }
        
        return dependencyCheck;
    }

    /**
     * Check network connectivity
     * 
     * @returns {Promise<Object>} Network check results
     */
    async checkNetworkConnectivity() {
        const networkCheck = {
            timestamp: new Date().toISOString(),
            status: 'healthy',
            connectivity: {},
            latency: {},
            dns: {},
            issues: []
        };
        
        try {
            // Basic connectivity test
            const connectivityStart = Date.now();
            const response = await axios.get(this.config.endpoints.healthCheck, {
                timeout: 10000
            });
            const connectivityTime = Date.now() - connectivityStart;
            
            networkCheck.connectivity = {
                status: 'connected',
                responseTime: connectivityTime,
                statusCode: response.status,
                endpoint: this.config.endpoints.healthCheck
            };
            
            // Latency test to multiple endpoints
            const endpoints = [
                'https://www.google.com',
                'https://www.github.com',
                'https://httpbin.org'
            ];
            
            const latencyTests = [];
            for (const endpoint of endpoints) {
                try {
                    const start = Date.now();
                    await axios.get(endpoint, { timeout: 5000 });
                    const latency = Date.now() - start;
                    latencyTests.push({ endpoint, latency });
                } catch (error) {
                    latencyTests.push({ endpoint, latency: null, error: error.message });
                }
            }
            
            const validLatencies = latencyTests.filter(t => t.latency !== null);
            if (validLatencies.length > 0) {
                const avgLatency = validLatencies.reduce((sum, t) => sum + t.latency, 0) / validLatencies.length;
                networkCheck.latency = {
                    average: Math.round(avgLatency),
                    tests: latencyTests,
                    threshold: this.config.resourceThresholds.networkLatency
                };
                
                if (avgLatency > this.config.resourceThresholds.networkLatency) {
                    networkCheck.issues.push({
                        type: 'high_latency',
                        severity: 'warning',
                        message: `Average latency (${avgLatency}ms) exceeds threshold (${this.config.resourceThresholds.networkLatency}ms)`
                    });
                    networkCheck.status = 'warning';
                }
            }
            
            // DNS resolution test
            try {
                const dnsStart = Date.now();
                await axios.get('https://dns.google/resolve?name=google.com', { timeout: 5000 });
                const dnsTime = Date.now() - dnsStart;
                
                networkCheck.dns = {
                    status: 'working',
                    resolutionTime: dnsTime
                };
            } catch (error) {
                networkCheck.dns = {
                    status: 'error',
                    error: error.message
                };
                networkCheck.issues.push({
                    type: 'dns_error',
                    severity: 'warning',
                    message: `DNS resolution failed: ${error.message}`
                });
                networkCheck.status = 'warning';
            }
            
            // Update network status
            this.networkStatus = {
                connected: networkCheck.connectivity.status === 'connected',
                latency: networkCheck.latency.average,
                lastCheck: networkCheck.timestamp
            };
            
        } catch (error) {
            networkCheck.connectivity = {
                status: 'disconnected',
                error: error.message
            };
            networkCheck.status = 'error';
            networkCheck.issues.push({
                type: 'connectivity_error',
                severity: 'critical',
                message: `Network connectivity failed: ${error.message}`
            });
            
            this.networkStatus = {
                connected: false,
                latency: null,
                lastCheck: networkCheck.timestamp
            };
        }
        
        return networkCheck;
    }

    /**
     * Check browser automation health
     * 
     * @returns {Promise<Object>} Browser health check results
     */
    async checkBrowserHealth() {
        const browserCheck = {
            timestamp: new Date().toISOString(),
            status: 'healthy',
            chrome: {},
            extensions: {},
            stealth: {},
            issues: []
        };
        
        try {
            // Check Chrome installation and version
            try {
                const { stdout } = await execAsync('google-chrome --version');
                browserCheck.chrome = {
                    installed: true,
                    version: stdout.trim(),
                    path: await this.findChromePath()
                };
            } catch (error) {
                browserCheck.chrome = {
                    installed: false,
                    error: error.message
                };
                browserCheck.status = 'error';
                browserCheck.issues.push({
                    type: 'chrome_missing',
                    severity: 'critical',
                    message: 'Chrome browser not found'
                });
            }
            
            // Check CDP extension
            const extensionPath = path.join(process.cwd(), 'extensions', 'cdp-stealth');
            try {
                await fs.access(extensionPath);
                const manifestPath = path.join(extensionPath, 'manifest.json');
                const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
                
                browserCheck.extensions = {
                    cdpStealth: {
                        installed: true,
                        version: manifest.version,
                        path: extensionPath,
                        manifest: manifest
                    }
                };
            } catch (error) {
                browserCheck.extensions = {
                    cdpStealth: {
                        installed: false,
                        error: error.message
                    }
                };
                browserCheck.issues.push({
                    type: 'extension_missing',
                    severity: 'warning',
                    message: 'CDP stealth extension not found'
                });
                if (browserCheck.status === 'healthy') {
                    browserCheck.status = 'warning';
                }
            }
            
            // Check stealth configuration
            const chromeStartPath = path.join(process.cwd(), 'chrome_start.sh');
            try {
                const chromeStartContent = await fs.readFile(chromeStartPath, 'utf8');
                const stealthFlags = [
                    '--disable-blink-features=AutomationControlled',
                    '--exclude-switches=enable-automation',
                    '--disable-automation'
                ];
                
                const flagsFound = stealthFlags.filter(flag => chromeStartContent.includes(flag));
                
                browserCheck.stealth = {
                    configFile: chromeStartPath,
                    flagsFound,
                    flagsMissing: stealthFlags.filter(flag => !flagsFound.includes(flag)),
                    coverage: (flagsFound.length / stealthFlags.length) * 100
                };
                
                if (browserCheck.stealth.coverage < 100) {
                    browserCheck.issues.push({
                        type: 'incomplete_stealth',
                        severity: 'warning',
                        message: `Missing stealth flags: ${browserCheck.stealth.flagsMissing.join(', ')}`
                    });
                    if (browserCheck.status === 'healthy') {
                        browserCheck.status = 'warning';
                    }
                }
            } catch (error) {
                browserCheck.stealth = {
                    error: error.message
                };
                browserCheck.issues.push({
                    type: 'stealth_config_missing',
                    severity: 'warning',
                    message: 'Chrome stealth configuration not found'
                });
                if (browserCheck.status === 'healthy') {
                    browserCheck.status = 'warning';
                }
            }
            
        } catch (error) {
            browserCheck.status = 'error';
            browserCheck.error = error.message;
        }
        
        return browserCheck;
    }

    /**
     * Check environment configuration
     * 
     * @returns {Promise<Object>} Environment check results
     */
    async checkEnvironment() {
        const envCheck = {
            timestamp: new Date().toISOString(),
            status: 'healthy',
            system: {},
            node: {},
            permissions: {},
            configuration: {},
            issues: []
        };
        
        try {
            // System information
            envCheck.system = {
                platform: os.platform(),
                arch: os.arch(),
                release: os.release(),
                hostname: os.hostname(),
                totalMemory: os.totalmem(),
                freeMemory: os.freemem(),
                cpuCount: os.cpus().length,
                cpuInfo: os.cpus()[0]
            };
            
            // Node.js information
            envCheck.node = {
                version: process.version,
                pid: process.pid,
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                cpuUsage: process.cpuUsage(),
                cwd: process.cwd(),
                env: {
                    NODE_ENV: process.env.NODE_ENV,
                    PATH: process.env.PATH ? 'SET' : 'NOT_SET'
                }
            };
            
            // Permission checks
            const criticalDirs = [
                path.join(process.cwd(), 'debug'),
                path.join(process.cwd(), 'logs'),
                path.join(process.cwd(), 'data'),
                '/tmp'
            ];
            
            const permissionChecks = [];
            for (const dir of criticalDirs) {
                try {
                    await fs.access(dir, fs.constants.W_OK);
                    permissionChecks.push({ dir, status: 'writable' });
                } catch {
                    permissionChecks.push({ dir, status: 'not_writable' });
                    envCheck.issues.push({
                        type: 'permission_error',
                        severity: 'warning',
                        message: `Directory not writable: ${dir}`
                    });
                }
            }
            
            envCheck.permissions = {
                directories: permissionChecks,
                user: {
                    uid: process.getuid(),
                    gid: process.getgid()
                }
            };
            
            // Configuration checks
            const configFiles = [
                'package.json',
                'chrome_start.sh',
                'src/config/environment.js'
            ];
            
            const configChecks = [];
            for (const configFile of configFiles) {
                const configPath = path.join(process.cwd(), configFile);
                try {
                    await fs.access(configPath);
                    configChecks.push({ file: configFile, status: 'exists' });
                } catch {
                    configChecks.push({ file: configFile, status: 'missing' });
                    envCheck.issues.push({
                        type: 'config_missing',
                        severity: 'warning',
                        message: `Configuration file missing: ${configFile}`
                    });
                }
            }
            
            envCheck.configuration = {
                files: configChecks,
                workingDirectory: process.cwd()
            };
            
            if (envCheck.issues.length > 0 && envCheck.status === 'healthy') {
                envCheck.status = 'warning';
            }
            
        } catch (error) {
            envCheck.status = 'error';
            envCheck.error = error.message;
        }
        
        return envCheck;
    }

    /**
     * Get current system health status
     * 
     * @returns {Object} Current health status
     */
    getSystemHealth() {
        return {
            ...this.systemHealth,
            resourceHistory: this.resourceHistory.slice(-10),
            networkStatus: this.networkStatus,
            dependencyStatus: Object.fromEntries(this.dependencyStatus)
        };
    }

    /**
     * Start continuous monitoring
     */
    startMonitoring() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        
        // Run full diagnostics every 5 minutes
        this.healthCheckInterval = setInterval(async () => {
            try {
                await this.runFullDiagnostics({
                    generateReport: false
                });
            } catch (error) {
                this.emit('monitoring:error', error);
            }
        }, 5 * 60 * 1000);
        
        // Run resource checks every minute
        this.resourceCheckInterval = setInterval(async () => {
            try {
                const resourceCheck = await this.checkSystemResources();
                this.emit('monitoring:resource', resourceCheck);
                
                // Auto-healing if enabled
                if (this.config.enableAutoHealing && resourceCheck.status !== 'healthy') {
                    await this.attemptAutoHealing(resourceCheck);
                }
            } catch (error) {
                this.emit('monitoring:error', error);
            }
        }, this.config.checkInterval);
    }

    /**
     * Stop continuous monitoring
     */
    stopMonitoring() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        
        if (this.resourceCheckInterval) {
            clearInterval(this.resourceCheckInterval);
            this.resourceCheckInterval = null;
        }
    }

    // Private helper methods

    async initializeDiagnostics() {
        try {
            await fs.access(this.config.diagnosticsDir);
        } catch {
            await fs.mkdir(this.config.diagnosticsDir, { recursive: true });
        }
    }

    async getCPUUsage() {
        return new Promise((resolve) => {
            const startUsage = process.cpuUsage();
            const startTime = process.hrtime();
            
            setTimeout(() => {
                const endUsage = process.cpuUsage(startUsage);
                const endTime = process.hrtime(startTime);
                
                const userCPU = endUsage.user / (endTime[0] * 1000000 + endTime[1]) * 100;
                const systemCPU = endUsage.system / (endTime[0] * 1000000 + endTime[1]) * 100;
                
                resolve({
                    percentage: Math.round((userCPU + systemCPU) * 100) / 100,
                    user: userCPU,
                    system: systemCPU
                });
            }, 100);
        });
    }

    getMemoryUsage() {
        const usage = process.memoryUsage();
        const totalMemory = os.totalmem();
        const percentage = (usage.rss / totalMemory) * 100;
        
        return {
            rss: usage.rss,
            heapTotal: usage.heapTotal,
            heapUsed: usage.heapUsed,
            external: usage.external,
            percentage: Math.round(percentage * 100) / 100,
            total: totalMemory,
            available: os.freemem()
        };
    }

    async getDiskUsage() {
        try {
            const { stdout } = await execAsync('df -h .');
            const lines = stdout.split('\n');
            const dataLine = lines[1];
            const parts = dataLine.split(/\s+/);
            
            const used = parseInt(parts[2]);
            const total = parseInt(parts[1]);
            const percentage = parseInt(parts[4]);
            
            return {
                used,
                total,
                available: total - used,
                percentage
            };
        } catch {
            return {
                used: 0,
                total: 0,
                available: 0,
                percentage: 0
            };
        }
    }

    getSystemLoad() {
        return {
            loadavg: os.loadavg(),
            uptime: os.uptime()
        };
    }

    getProcessInfo() {
        return {
            pid: process.pid,
            ppid: process.ppid,
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            cpuUsage: process.cpuUsage()
        };
    }

    async findChromePath() {
        const possiblePaths = [
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium-browser',
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
        ];
        
        for (const chromePath of possiblePaths) {
            try {
                await fs.access(chromePath);
                return chromePath;
            } catch {
                // Continue checking
            }
        }
        
        return null;
    }

    calculateOverallStatus(checks) {
        const statuses = Object.values(checks).map(check => check.status);
        
        if (statuses.includes('error')) {
            return 'error';
        } else if (statuses.includes('critical')) {
            return 'critical';
        } else if (statuses.includes('warning')) {
            return 'warning';
        } else {
            return 'healthy';
        }
    }

    extractIssues(checks) {
        const issues = [];
        
        Object.values(checks).forEach(check => {
            if (check.issues && Array.isArray(check.issues)) {
                issues.push(...check.issues);
            }
            if (check.alerts && Array.isArray(check.alerts)) {
                issues.push(...check.alerts);
            }
        });
        
        return issues;
    }

    generateRecommendations(checks) {
        const recommendations = [];
        
        // Resource recommendations
        if (checks.resources?.alerts) {
            checks.resources.alerts.forEach(alert => {
                if (alert.type === 'cpu_high') {
                    recommendations.push({
                        category: 'performance',
                        priority: 'medium',
                        message: 'Consider optimizing CPU-intensive operations or scaling horizontally',
                        action: 'optimize_cpu'
                    });
                } else if (alert.type === 'memory_high') {
                    recommendations.push({
                        category: 'performance',
                        priority: 'high',
                        message: 'Memory usage is high - consider optimizing memory usage or increasing available memory',
                        action: 'optimize_memory'
                    });
                } else if (alert.type === 'disk_high') {
                    recommendations.push({
                        category: 'maintenance',
                        priority: 'high',
                        message: 'Disk space is low - clean up old files or increase storage',
                        action: 'cleanup_disk'
                    });
                }
            });
        }
        
        // Dependency recommendations
        if (checks.dependencies?.missing?.length > 0) {
            recommendations.push({
                category: 'dependencies',
                priority: 'critical',
                message: `Install missing dependencies: ${checks.dependencies.missing.join(', ')}`,
                action: 'install_dependencies'
            });
        }
        
        // Network recommendations
        if (checks.network?.issues) {
            checks.network.issues.forEach(issue => {
                if (issue.type === 'high_latency') {
                    recommendations.push({
                        category: 'network',
                        priority: 'medium',
                        message: 'Network latency is high - check network connection or use closer endpoints',
                        action: 'optimize_network'
                    });
                } else if (issue.type === 'connectivity_error') {
                    recommendations.push({
                        category: 'network',
                        priority: 'critical',
                        message: 'Network connectivity issues detected - check internet connection',
                        action: 'fix_connectivity'
                    });
                }
            });
        }
        
        return recommendations;
    }

    generateDiagnosticSummary(results) {
        return {
            totalChecks: Object.keys(results.checks).length,
            healthyChecks: Object.values(results.checks).filter(check => check.status === 'healthy').length,
            warningChecks: Object.values(results.checks).filter(check => check.status === 'warning').length,
            errorChecks: Object.values(results.checks).filter(check => check.status === 'error').length,
            totalIssues: results.recommendations.length,
            criticalIssues: results.recommendations.filter(r => r.priority === 'critical').length,
            duration: Date.now() - new Date(results.timestamp).getTime()
        };
    }

    async saveDiagnosticReport(results) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `diagnostic_report_${timestamp}.json`;
        const filepath = path.join(this.config.diagnosticsDir, filename);
        
        await fs.writeFile(filepath, JSON.stringify(results, null, 2));
        
        this.emit('diagnostics:report_saved', { filepath, results });
        return filepath;
    }

    async attemptAutoHealing(resourceCheck) {
        // Simple auto-healing logic
        if (resourceCheck.alerts) {
            for (const alert of resourceCheck.alerts) {
                if (alert.type === 'memory_high') {
                    // Force garbage collection
                    if (global.gc) {
                        global.gc();
                        this.emit('auto_healing:memory_gc', {
                            message: 'Forced garbage collection due to high memory usage',
                            before: resourceCheck.metrics.memory.percentage
                        });
                    }
                }
            }
        }
    }
}

module.exports = DiagnosticTools;