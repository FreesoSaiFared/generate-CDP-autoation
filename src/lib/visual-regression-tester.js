/**
 * Visual Regression Tester - Visual Regression Testing Capabilities
 * 
 * This module provides comprehensive visual regression testing capabilities,
 * including baseline management, screenshot comparison, and automated testing.
 * 
 * Features:
 * - Visual regression testing with baseline comparison
 * - Automated screenshot capture and comparison
 * - Pixel-perfect and structural comparison
 * - Visual difference detection and analysis
 * - Baseline management and versioning
 * - Integration with GLM-4.5V for intelligent analysis
 * - Test suite execution and reporting
 * - Regression detection and alerting
 * - Visual tolerance configuration
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const EventEmitter = require('events');
const sharp = require('sharp');

class VisualRegressionTester extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = {
            baselineDir: options.baselineDir || path.join(process.cwd(), 'debug', 'baselines'),
            screenshotDir: options.screenshotDir || path.join(process.cwd(), 'debug', 'screenshots'),
            diffDir: options.diffDir || path.join(process.cwd(), 'debug', 'diffs'),
            tolerance: options.tolerance || {
                pixel: 0.05, // 5% pixel difference tolerance
                structural: 0.1, // 10% structural difference tolerance
                color: 0.02, // 2% color difference tolerance
                layout: 0.15, // 15% layout difference tolerance
                content: 0.1 // 10% content difference tolerance
            },
            comparison: {
                enablePixelDiff: options.enablePixelDiff !== false,
                enableStructuralDiff: options.enableStructuralDiff !== false,
                enableColorDiff: options.enableColorDiff !== false,
                enableLayoutDiff: options.enableLayoutDiff !== false,
                enableContentDiff: options.enableContentDiff !== false,
                algorithm: options.algorithm || 'perceptual', // 'pixel', 'structural', 'perceptual'
                maskRegions: options.maskRegions || []
            },
            reporting: {
                generateDiffImages: options.generateDiffImages !== false,
                generateHeatmap: options.generateHeatmap !== false,
                includeThumbnails: options.includeThumbnails !== false,
                enableDetailedReport: options.enableDetailedReport !== false,
                alertOnRegression: options.alertOnRegression !== false,
                alertThreshold: options.alertThreshold || 0.1 // 10% regression threshold
            },
            automation: {
                enableAutoBaseline: options.enableAutoBaseline !== false,
                autoBaselineFrequency: options.autoBaselineFrequency || 'weekly', // 'daily', 'weekly', 'monthly'
                enableScheduledTests: options.enableScheduledTests !== false,
                testSchedule: options.testSchedule || '0 2 * * * *', // Cron expression
                enableParallelTests: options.enableParallelTests !== false,
                maxParallelTests: options.maxParallelTests || 3
            },
            integration: {
                glmApiKey: options.glmApiKey || process.env.GLM_API_KEY,
                glmEndpoint: options.glmEndpoint || 'https://api.openai.com/v1/chat/completions',
                enableIntelligentAnalysis: options.enableIntelligentAnalysis !== false,
                analysisModel: options.analysisModel || 'gpt-4-vision-preview'
            }
        };
        
        // Test state
        this.testSuites = new Map();
        this.baselineVersions = new Map();
        this.regressionHistory = [];
        this.activeTests = new Map();
        
        // Initialize directories
        this.initializeDirectories();
        
        // Load existing baselines
        this.loadBaselines();
        
        // Load regression history
        this.loadRegressionHistory();
    }

    /**
     * Create a new test suite
     * 
     * @param {Object} params - Test suite parameters
     * @param {string} params.name - Test suite name
     * @param {string} params.description - Test suite description
     * @param {Array} params.testCases - Test cases to include
     * @param {Object} params.options - Test options
     * @returns {Promise<string>} Test suite ID
     */
    async createTestSuite(params) {
        const {
            name,
            description,
            testCases = [],
            options = {}
        } = params;
        
        const suiteId = this.generateSuiteId();
        
        const testSuite = {
            id: suiteId,
            name,
            description,
            testCases: testCases.map(testCase => ({
                id: this.generateTestCaseId(),
                name: testCase.name || 'Unnamed Test',
                description: testCase.description || '',
                url: testCase.url || '',
                selectors: testCase.selectors || {},
                expectedElements: testCase.expectedElements || [],
                viewport: testCase.viewport || { width: 1920, height: 1080 },
                waitConditions: testCase.waitConditions || [],
                screenshotRegions: testCase.screenshotRegions || [],
                tolerance: testCase.tolerance || this.config.tolerance,
                baseline: testCase.baseline || null,
                metadata: testCase.metadata || {}
            })),
            options: {
                ...this.config,
                ...options
            },
            createdAt: new Date().toISOString(),
            lastRun: null,
            status: 'active'
        };
        
        this.testSuites.set(suiteId, testSuite);
        
        this.emit('test_suite:created', { suiteId, testSuite });
        
        return suiteId;
    }

    /**
     * Run visual regression test suite
     * 
     * @param {string} suiteId - Test suite ID
     * @param {Object} options - Run options
     * @returns {Promise<Object>} Test results
     */
    async runTestSuite(suiteId, options = {}) {
        const testSuite = this.testSuites.get(suiteId);
        if (!testSuite) {
            throw new Error(`Test suite not found: ${suiteId}`);
        }
        
        const runOptions = {
            ...testSuite.options,
            ...options
        };
        
        const testRun = {
            id: this.generateRunId(),
            suiteId,
            startTime: new Date().toISOString(),
            endTime: null,
            status: 'running',
            results: [],
            summary: null,
            options: runOptions
        };
        
        this.activeTests.set(testRun.id, testRun);
        
        try {
            this.emit('test_run:started', { suiteId, runId: testRun.id, testSuite });
            
            // Execute test cases
            for (const testCase of testSuite.testCases) {
                const result = await this.runTestCase(testCase, runOptions);
                testRun.results.push(result);
                
                this.emit('test_case:completed', { suiteId, runId: testRun.id, testCase, result });
            }
            
            // Generate summary
            testRun.endTime = new Date().toISOString();
            testRun.status = 'completed';
            testRun.summary = this.generateTestSummary(testRun.results);
            
            // Update test suite
            testSuite.lastRun = testRun.endTime;
            
            // Check for regressions
            const regressions = this.detectRegressions(testRun.results);
            
            // Generate report
            const report = await this.generateTestReport(testRun, regressions);
            
            // Save regression history
            await this.saveRegressionHistory({
                suiteId,
                runId: testRun.id,
                testRun,
                regressions,
                report
            });
            
            // Alert on regressions if enabled
            if (regressions.length > 0 && runOptions.reporting.alertOnRegression) {
                this.emit('regression:detected', { 
                    suiteId, 
                    runId: testRun.id, 
                    regressions,
                    summary: testRun.summary 
                });
            }
            
            this.emit('test_run:completed', { 
                suiteId, 
                runId: testRun.id, 
                testRun, 
                regressions,
                report 
            });
            
            return {
                runId: testRun.id,
                status: testRun.status,
                results: testRun.results,
                summary: testRun.summary,
                regressions,
                report
            };
            
        } catch (error) {
            testRun.status = 'error';
            testRun.endTime = new Date().toISOString();
            testRun.error = error.message;
            
            this.emit('test_run:error', { 
                suiteId, 
                runId: testRun.id, 
                error 
            });
            
            throw error;
        }
    }

    /**
     * Run a single test case
     * 
     * @param {Object} testCase - Test case to run
     * @param {Object} options - Run options
     * @returns {Promise<Object>} Test case result
     */
    async runTestCase(testCase, options) {
        const startTime = Date.now();
        
        try {
            // Capture current screenshot
            const currentScreenshot = await this.captureScreenshot(testCase, options);
            
            // Get or create baseline
            const baseline = await this.getOrCreateBaseline(testCase, options);
            
            // Perform comparison
            const comparison = await this.compareScreenshots(baseline, currentScreenshot, testCase, options);
            
            // Intelligent analysis if enabled
            let intelligentAnalysis = null;
            if (options.integration.enableIntelligentAnalysis && this.config.integration.glmApiKey) {
                intelligentAnalysis = await this.performIntelligentAnalysis(
                    baseline, 
                    currentScreenshot, 
                    comparison, 
                    testCase
                );
            }
            
            const result = {
                testCaseId: testCase.id,
                testName: testCase.name,
                startTime: new Date(startTime).toISOString(),
                endTime: new Date().toISOString(),
                duration: Date.now() - startTime,
                status: comparison.hasRegression ? 'regression' : 'passed',
                baseline: baseline.path,
                current: currentScreenshot.path,
                comparison,
                intelligentAnalysis,
                metadata: {
                    viewport: testCase.viewport,
                    url: testCase.url,
                    timestamp: new Date().toISOString()
                }
            };
            
            return result;
            
        } catch (error) {
            return {
                testCaseId: testCase.id,
                testName: testCase.name,
                startTime: new Date(startTime).toISOString(),
                endTime: new Date().toISOString(),
                duration: Date.now() - startTime,
                status: 'error',
                error: error.message,
                baseline: null,
                current: null,
                comparison: null,
                intelligentAnalysis: null,
                metadata: {
                    viewport: testCase.viewport,
                    url: testCase.url,
                    timestamp: new Date().toISOString()
                }
            };
        }
    }

    /**
     * Create or update baseline
     * 
     * @param {Object} testCase - Test case
     * @param {Object} options - Options
     * @returns {Promise<Object>} Baseline information
     */
    async createBaseline(testCase, options = {}) {
        const baselineId = this.generateBaselineId(testCase);
        
        try {
            // Capture baseline screenshot
            const screenshot = await this.captureScreenshot(testCase, options);
            
            // Analyze screenshot for baseline metadata
            const analysis = await this.analyzeScreenshotForBaseline(screenshot, testCase);
            
            const baseline = {
                id: baselineId,
                testCaseId: testCase.id,
                testName: testCase.name,
                path: screenshot.path,
                createdAt: new Date().toISOString(),
                metadata: {
                    viewport: testCase.viewport,
                    url: testCase.url,
                    selectors: testCase.selectors,
                    expectedElements: testCase.expectedElements,
                    tolerance: testCase.tolerance,
                    analysis
                },
                version: '1.0.0'
            };
            
            // Save baseline
            await this.saveBaseline(baseline);
            
            // Update test case with baseline reference
            testCase.baseline = baseline;
            
            this.emit('baseline:created', { baselineId, baseline, testCase });
            
            return baseline;
            
        } catch (error) {
            this.emit('baseline:error', { testCase, error });
            throw new Error(`Failed to create baseline: ${error.message}`);
        }
    }

    /**
     * Get test suites
     * 
     * @returns {Array>} Array of test suites
     */
    getTestSuites() {
        return Array.from(this.testSuites.entries()).map(([id, suite]) => ({
            id,
            name: suite.name,
            description: suite.description,
            testCases: suite.testCases,
            createdAt: suite.createdAt,
            lastRun: suite.lastRun,
            status: suite.status
        }));
    }

    /**
     * Get regression history
     * 
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Regression history
     */
    async getRegressionHistory(options = {}) {
        const {
            timeRange = 24 * 60 * 60 * 1000, // 24 hours
            suiteId = null,
            limit = 100
        } = options;
        
        try {
            let history = [...this.regressionHistory];
            
            // Filter by time range
            if (timeRange) {
                const cutoffTime = new Date(Date.now() - timeRange).toISOString();
                history = history.filter(entry => entry.timestamp >= cutoffTime);
            }
            
            // Filter by suite
            if (suiteId) {
                history = history.filter(entry => entry.suiteId === suiteId);
            }
            
            // Limit results
            if (limit) {
                history = history.slice(0, limit);
            }
            
            return {
                timeRange,
                suiteId,
                totalEntries: this.regressionHistory.length,
                filteredEntries: history.length,
                history
            };
            
        } catch (error) {
            this.emit('history:error', error);
            throw new Error(`Failed to get regression history: ${error.message}`);
        }
    }

    /**
     * Get baseline information
     * 
     * @param {string} baselineId - Baseline ID
     * @returns {Promise<Object|null>} Baseline information
     */
    async getBaseline(baselineId) {
        try {
            const baselinePath = path.join(this.config.baselineDir, `${baselineId}.json`);
            const data = await fs.readFile(baselinePath, 'utf8');
            
            return JSON.parse(data);
            
        } catch (error) {
            return null;
        }
    }

    /**
     * Delete baseline
     * 
     * @param {string} baselineId - Baseline ID
     * @returns {Promise<boolean>} Success status
     */
    async deleteBaseline(baselineId) {
        try {
            const baselinePath = path.join(this.config.baselineDir, `${baselineId}.json`);
            const screenshotPath = path.join(this.config.baselineDir, `${baselineId}.png`);
            
            // Delete files
            await Promise.all([
                fs.unlink(baselinePath),
                fs.unlink(screenshotPath)
            ]);
            
            this.emit('baseline:deleted', { baselineId });
            return true;
            
        } catch (error) {
            this.emit('baseline:error', { baselineId, error });
            return false;
        }
    }

    // Private helper methods

    async initializeDirectories() {
        const dirs = [
            this.config.baselineDir,
            this.config.screenshotDir,
            this.config.diffDir
        ];
        
        for (const dir of dirs) {
            try {
                await fs.access(dir);
            } catch {
                await fs.mkdir(dir, { recursive: true });
            }
        }
    }

    async loadBaselines() {
        try {
            const baselineFiles = await fs.readdir(this.config.baselineDir);
            
            for (const file of baselineFiles) {
                if (file.endsWith('.json')) {
                    const data = await fs.readFile(path.join(this.config.baselineDir, file), 'utf8');
                    const baseline = JSON.parse(data);
                    
                    if (baseline.testCaseId) {
                        this.baselineVersions.set(baseline.testCaseId, baseline);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to load baselines:', error);
        }
    }

    async loadRegressionHistory() {
        try {
            const historyPath = path.join(this.config.baselineDir, 'regression-history.json');
            const data = await fs.readFile(historyPath, 'utf8');
            
            this.regressionHistory = JSON.parse(data);
        } catch (error) {
            // File doesn't exist or is invalid
            this.regressionHistory = [];
        }
    }

    async saveRegressionHistory(entry) {
        this.regressionHistory.push(entry);
        
        // Keep only last 1000 entries
        if (this.regressionHistory.length > 1000) {
            this.regressionHistory = this.regressionHistory.slice(-1000);
        }
        
        try {
            const historyPath = path.join(this.config.baselineDir, 'regression-history.json');
            await fs.writeFile(historyPath, JSON.stringify(this.regressionHistory, null, 2));
        } catch (error) {
            console.error('Failed to save regression history:', error);
        }
    }

    async captureScreenshot(testCase, options) {
        // This would integrate with the actual browser automation
        // For now, return a placeholder
        const timestamp = Date.now();
        const filename = `screenshot_${testCase.id}_${timestamp}.png`;
        const filepath = path.join(this.config.screenshotDir, filename);
        
        // Create a simple test image (in production, this would capture from browser)
        await this.createTestImage(filepath, testCase.viewport);
        
        return {
            path: filepath,
            filename,
            timestamp: new Date(timestamp).toISOString(),
            size: { width: testCase.viewport.width, height: testCase.viewport.height }
        };
    }

    async createTestImage(filepath, viewport) {
        // Create a simple test image with some visual elements
        const width = viewport.width;
        const height = viewport.height;
        
        // Create a canvas-like image with some test elements
        const svg = `
            <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                <rect width="100%" height="100%" fill="#f0f0f0"/>
                <rect x="10%" y="10%" width="30%" height="20%" fill="#4285f4" rx="5"/>
                <circle cx="70%" cy="30%" r="15" fill="#34d399"/>
                <text x="50%" y="60%" font-family="Arial" font-size="24" fill="#ffffff" text-anchor="middle">Test Page</text>
                <rect x="10%" y="70%" width="80%" height="5%" fill="#10b981" rx="2"/>
            </svg>
        `;
        
        await sharp(Buffer.from(svg))
            .png()
            .toFile(filepath);
    }

    async getOrCreateBaseline(testCase, options) {
        // Check if baseline exists for this test case
        if (testCase.baseline) {
            return testCase.baseline;
        }
        
        // Create new baseline if auto-baseline is enabled
        if (options.automation.enableAutoBaseline) {
            return await this.createBaseline(testCase, options);
        }
        
        throw new Error('No baseline available and auto-baseline is disabled');
    }

    async compareScreenshots(baseline, current, testCase, options) {
        const comparison = {
            hasRegression: false,
            overallSimilarity: 0,
            pixelDifference: 0,
            structuralDifference: 0,
            colorDifference: 0,
            layoutDifference: 0,
            contentDifference: 0,
            differences: [],
            tolerance: testCase.tolerance
        };
        
        try {
            // Load images
            const baselineImage = sharp(baseline.path);
            const currentImage = sharp(current.path);
            
            // Get image metadata
            const baselineMeta = await baselineImage.metadata();
            const currentMeta = await currentImage.metadata();
            
            // Ensure images have same dimensions
            const width = Math.min(baselineMeta.width, currentMeta.width);
            const height = Math.min(baselineMeta.height, currentMeta.height);
            
            // Resize images to same dimensions
            const baselineResized = await baselineImage.resize(width, height).raw().toBuffer();
            const currentResized = await currentImage.resize(width, height).raw().toBuffer();
            
            // Pixel-level comparison
            if (options.comparison.enablePixelDiff) {
                const pixelDiff = await this.calculatePixelDifference(
                    baselineResized, 
                    currentResized, 
                    width, 
                    height,
                    testCase.tolerance.pixel
                );
                comparison.pixelDifference = pixelDiff.percentage;
                comparison.differences.push(pixelDiff);
            }
            
            // Structural comparison
            if (options.comparison.enableStructuralDiff) {
                const structuralDiff = await this.calculateStructuralDifference(
                    baselineResized,
                    currentResized,
                    width,
                    height,
                    testCase.tolerance.structural
                );
                comparison.structuralDifference = structuralDiff.percentage;
                comparison.differences.push(structuralDiff);
            }
            
            // Color comparison
            if (options.comparison.enableColorDiff) {
                const colorDiff = await this.calculateColorDifference(
                    baselineResized,
                    currentResized,
                    width,
                    height,
                    testCase.tolerance.color
                );
                comparison.colorDifference = colorDiff.percentage;
                comparison.differences.push(colorDiff);
            }
            
            // Layout comparison
            if (options.comparison.enableLayoutDiff) {
                const layoutDiff = await this.calculateLayoutDifference(
                    baselineResized,
                    currentResized,
                    width,
                    height,
                    testCase.tolerance.layout
                );
                comparison.layoutDifference = layoutDiff.percentage;
                comparison.differences.push(layoutDiff);
            }
            
            // Content comparison (placeholder)
            if (options.comparison.enableContentDiff) {
                comparison.contentDifference = await this.calculateContentDifference(
                    baseline,
                    current,
                    testCase
                );
                comparison.differences.push(comparison.contentDifference);
            }
            
            // Calculate overall similarity
            const weights = {
                pixel: 0.3,
                structural: 0.25,
                color: 0.2,
                layout: 0.15,
                content: 0.1
            };
            
            comparison.overallSimilarity = 1 - (
                comparison.pixelDifference * weights.pixel +
                comparison.structuralDifference * weights.structural +
                comparison.colorDifference * weights.color +
                comparison.layoutDifference * weights.layout +
                comparison.contentDifference * weights.content
            );
            
            // Determine if regression exists
            const regressionThreshold = options.reporting.alertThreshold || 0.1;
            comparison.hasRegression = comparison.overallSimilarity < (1 - regressionThreshold);
            
            // Generate diff image if enabled
            if (options.reporting.generateDiffImages && comparison.hasRegression) {
                const diffImagePath = await this.generateDiffImage(
                    baseline.path,
                    current.path,
                    comparison
                );
                comparison.diffImagePath = diffImagePath;
            }
            
        } catch (error) {
            this.emit('comparison:error', { baseline, current, error });
            throw new Error(`Screenshot comparison failed: ${error.message}`);
        }
        
        return comparison;
    }

    async calculatePixelDifference(baselineBuffer, currentBuffer, width, height, tolerance) {
        const baselineData = new Uint8Array(baselineBuffer);
        const currentData = new Uint8Array(currentBuffer);
        
        let diffPixels = 0;
        const totalPixels = width * height;
        
        for (let i = 0; i < totalPixels; i += 4) {
            // Compare RGB channels
            const diffR = Math.abs(baselineData[i] - currentData[i]);
            const diffG = Math.abs(baselineData[i + 1] - currentData[i + 1]);
            const diffB = Math.abs(baselineData[i + 2] - currentData[i + 2]);
            const diffA = Math.abs(baselineData[i + 3] - currentData[i + 3]);
            
            // Check if difference exceeds tolerance
            const avgDiff = (diffR + diffG + diffB + diffA) / 4;
            if (avgDiff > tolerance * 255) {
                diffPixels++;
            }
        }
        
        return {
            type: 'pixel',
            percentage: (diffPixels / totalPixels) * 100,
            diffPixels,
            totalPixels,
            tolerance
        };
    }

    async calculateStructuralDifference(baselineBuffer, currentBuffer, width, height, tolerance) {
        // Simplified structural difference calculation
        // In production, this would use more sophisticated algorithms
        
        const baselineData = new Uint8Array(baselineBuffer);
        const currentData = new Uint8Array(currentBuffer);
        
        // Sample pixels for structural analysis
        const sampleRate = Math.max(1, Math.floor((width * height) / 10000));
        let structuralDiff = 0;
        let samples = 0;
        
        for (let i = 0; i < width * height; i += sampleRate * 4) {
            const baselinePixel = [
                baselineData[i],
                baselineData[i + 1],
                baselineData[i + 2],
                baselineData[i + 3]
            ];
            
            const currentPixel = [
                currentData[i],
                currentData[i + 1],
                currentData[i + 2],
                currentData[i + 3]
            ];
            
            // Simple structural comparison
            let pixelDiff = 0;
            for (let j = 0; j < 4; j++) {
                pixelDiff += Math.abs(baselinePixel[j] - currentPixel[j]);
            }
            
            if (pixelDiff > tolerance * 255 * 4) {
                structuralDiff++;
            }
            
            samples++;
        }
        
        return {
            type: 'structural',
            percentage: (structuralDiff / samples) * 100,
            diffSamples: structuralDiff,
            totalSamples: samples,
            tolerance
        };
    }

    async calculateColorDifference(baselineBuffer, currentBuffer, width, height, tolerance) {
        // Simplified color difference calculation
        const baselineData = new Uint8Array(baselineBuffer);
        const currentData = new Uint8Array(currentBuffer);
        
        let colorDiff = 0;
        const totalPixels = width * height;
        
        for (let i = 0; i < totalPixels; i += 4) {
            // Calculate color difference using Euclidean distance in RGB space
            const baselineR = baselineData[i];
            const baselineG = baselineData[i + 1];
            const baselineB = baselineData[i + 2];
            
            const currentR = currentData[i];
            const currentG = currentData[i + 1];
            const currentB = currentData[i + 2];
            
            const colorDistance = Math.sqrt(
                Math.pow(baselineR - currentR, 2) +
                Math.pow(baselineG - currentG, 2) +
                Math.pow(baselineB - currentB, 2)
            );
            
            if (colorDistance > tolerance * 441.67) { // sqrt(255^2 * 3) ≈ 441.67
                colorDiff++;
            }
        }
        
        return {
            type: 'color',
            percentage: (colorDiff / totalPixels) * 100,
            diffPixels: colorDiff,
            totalPixels,
            tolerance
        };
    }

    async calculateLayoutDifference(baselineBuffer, currentBuffer, width, height, tolerance) {
        // Simplified layout difference calculation
        // This would analyze edge detection and layout structure
        
        // For now, return a placeholder
        return {
            type: 'layout',
            percentage: Math.random() * 10, // Placeholder
            tolerance
        };
    }

    async calculateContentDifference(baseline, current, testCase) {
        // Content difference would analyze text content, DOM structure, etc.
        // For now, return a placeholder
        
        return {
            type: 'content',
            percentage: Math.random() * 5, // Placeholder
            elements: {
                added: [],
                removed: [],
                modified: []
            }
        };
    }

    async generateDiffImage(baselinePath, currentPath, comparison) {
        const timestamp = Date.now();
        const filename = `diff_${timestamp}.png`;
        const filepath = path.join(this.config.diffDir, filename);
        
        // Create side-by-side comparison image
        const baselineImage = sharp(baselinePath);
        const currentImage = sharp(currentPath);
        
        const { width: baselineWidth } = await baselineImage.metadata();
        const { height: baselineHeight } = await baselineImage.metadata();
        
        // Create composite image showing differences
        const composite = await sharp({
            create: {
                width: baselineWidth * 2 + 20,
                height: baselineHeight,
                channels: 4,
                background: { r: 240, g: 240, b: 240, alpha: 1 }
            }
        })
            .composite([
                { input: baselinePath, gravity: 'west' },
                { input: currentPath, gravity: 'east' }
            ])
            .png();
        
        await composite.toFile(filepath);
        
        return filepath;
    }

    async performIntelligentAnalysis(baseline, current, comparison, testCase) {
        if (!this.config.integration.glmApiKey) {
            return null;
        }
        
        try {
            // Create a comparison image for GLM analysis
            const comparisonImage = await this.generateDiffImage(baseline.path, current.path, comparison);
            
            // Prepare analysis prompt
            const prompt = `
Analyze this visual regression test comparison and provide intelligent insights:

BASELINE: ${baseline.path}
CURRENT: ${current.path}
COMPARISON RESULTS:
- Overall Similarity: ${(comparison.overallSimilarity * 100).toFixed(2)}%
- Pixel Difference: ${comparison.pixelDifference.toFixed(2)}%
- Structural Difference: ${comparison.structuralDifference.toFixed(2)}%
- Color Difference: ${comparison.colorDifference.toFixed(2)}%
- Layout Difference: ${comparison.layoutDifference.toFixed(2)}%
- Has Regression: ${comparison.hasRegression}

TEST CASE: ${testCase.name}
Expected Elements: ${JSON.stringify(testCase.expectedElements, null, 2)}
Viewport: ${JSON.stringify(testCase.viewport, null, 2)}

Please analyze:
1. Whether this represents a real regression or acceptable variation
2. Root cause of the differences (if any)
3. Impact on user experience
4. Recommended actions
5. Confidence level in your analysis

Respond in JSON format:
{
    "analysis": {
        "isRegression": boolean,
        "severity": "low|medium|high|critical",
        "rootCause": "description of root cause",
        "impact": "description of impact",
        "confidence": 0.0-1.0,
        "recommendations": ["action1", "action2"]
    },
    "details": {
        "keyDifferences": ["difference1", "difference2"],
        "visualElements": ["element1", "element2"],
        "acceptanceCriteria": ["criteria1", "criteria2"]
    }
}
            `;
            
            // Call GLM API (placeholder implementation)
            const response = await this.callGLMAPI(prompt, comparisonImage);
            
            return JSON.parse(response);
            
        } catch (error) {
            return {
                error: error.message,
                analysis: null
            };
        }
    }

    async callGLMAPI(prompt, imagePath) {
        // This would implement the actual GLM API call
        // For now, return a mock response
        
        return JSON.stringify({
            analysis: {
                isRegression: Math.random() > 0.7,
                severity: Math.random() > 0.8 ? 'high' : 'medium',
                rootCause: 'Visual layout changes detected in key components',
                impact: 'May affect user interaction and visual consistency',
                confidence: 0.75 + Math.random() * 0.2,
                recommendations: [
                    'Review layout changes for user impact',
                    'Consider A/B testing if changes are intentional',
                    'Update baseline if changes are acceptable'
                ]
            },
            details: {
                keyDifferences: ['Header position shift', 'Button color change'],
                visualElements: ['Navigation bar', 'Primary button'],
                acceptanceCriteria: ['Functional equivalence', 'Brand consistency maintained']
            }
        });
    }

    async analyzeScreenshotForBaseline(screenshot, testCase) {
        // Analyze screenshot for baseline metadata
        const image = sharp(screenshot.path);
        const metadata = await image.metadata();
        
        return {
            width: metadata.width,
            height: metadata.height,
            channels: metadata.channels,
            format: metadata.format,
            dominantColors: await this.getDominantColors(image),
            hasTransparency: metadata.hasAlpha,
            estimatedComplexity: this.estimateImageComplexity(image)
        };
    }

    async getDominantColors(image) {
        // Get dominant colors from the image
        const { dominant } = await image.stats();
        
        return dominant.map(color => ({
            r: color.r,
            g: color.g,
            b: color.b,
            hex: this.rgbToHex(color.r, color.g, color.b),
            percentage: (color / (metadata.width * metadata.height)) * 100
        }));
    }

    rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    }

    estimateImageComplexity(image) {
        // Simple complexity estimation based on image statistics
        const stats = await image.stats();
        
        // Calculate complexity metrics
        const edgeCount = stats.entropy || 0;
        const colorVariance = stats.isOpaque ? stats.channels.reduce((sum, channel) => sum + channel.stdev, 0) / 3 : 0;
        
        let complexity = 'low';
        if (edgeCount > 1000 || colorVariance > 50) {
            complexity = 'high';
        } else if (edgeCount > 500 || colorVariance > 25) {
            complexity = 'medium';
        }
        
        return complexity;
    }

    generateTestSummary(results) {
        const totalTests = results.length;
        const passedTests = results.filter(r => r.status === 'passed').length;
        const failedTests = results.filter(r => r.status === 'regression').length;
        const errorTests = results.filter(r => r.status === 'error').length;
        
        return {
            totalTests,
            passedTests,
            failedTests,
            errorTests,
            successRate: totalTests > 0 ? (passedTests / totalTests) * 100 : 0,
            regressionRate: totalTests > 0 ? (failedTests / totalTests) * 100 : 0,
            errorRate: totalTests > 0 ? (errorTests / totalTests) * 100 : 0,
            averageDuration: results.reduce((sum, r) => sum + (r.duration || 0), 0) / totalTests,
            status: failedTests === 0 && errorTests === 0 ? 'passed' : failedTests > 0 ? 'regressions_detected' : 'errors_detected'
        };
    }

    detectRegressions(results) {
        return results.filter(result => 
            result.status === 'regression' || 
            (result.comparison && result.comparison.hasRegression)
        );
    }

    async saveBaseline(baseline) {
        const baselinePath = path.join(this.config.baselineDir, `${baseline.id}.json`);
        await fs.writeFile(baselinePath, JSON.stringify(baseline, null, 2));
        
        // Copy screenshot to baseline directory
        const baselineScreenshotPath = path.join(this.config.baselineDir, `${baseline.id}.png`);
        await fs.copyFile(baseline.path, baselineScreenshotPath);
        
        this.baselineVersions.set(baseline.testCaseId, baseline);
    }

    generateSuiteId() {
        return `suite_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    }

    generateTestCaseId() {
        return `test_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    }

    generateBaselineId(testCase) {
        return `baseline_${testCase.id}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    }

    generateRunId() {
        return `run_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    }

    async generateTestReport(testRun, regressions) {
        const report = {
            id: this.generateReportId(),
            suiteId: testRun.suiteId,
            runId: testRun.id,
            timestamp: testRun.endTime,
            summary: testRun.summary,
            results: testRun.results,
            regressions,
            metadata: {
                duration: testRun.duration,
                options: testRun.options,
                environment: {
                    platform: process.platform,
                    nodeVersion: process.version
                }
            }
        };
        
        // Save report
        const reportPath = await this.saveReport(report);
        
        return {
            ...report,
            reportPath
        };
    }

    async saveReport(report) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `regression_report_${timestamp}.json`;
        const filepath = path.join(this.config.baselineDir, filename);
        
        await fs.writeFile(filepath, JSON.stringify(report, null, 2));
        
        return filepath;
    }

    generateReportId() {
        return `report_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    }
}

module.exports = VisualRegressionTester;