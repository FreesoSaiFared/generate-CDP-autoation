/**
 * Visual Verifier - GLM-4.5V Integration for Visual Verification
 * 
 * This module provides visual verification capabilities using GLM-4.5V for
 * screenshot analysis, visual element detection, UI state validation, and
 * visual regression testing.
 * 
 * Features:
 * - GLM-4.5V integration for screenshot analysis
 * - Visual element detection and verification
 * - UI state validation
 * - Screenshot comparison and diff analysis
 * - Visual regression testing
 * - Element visibility verification
 * - Layout and design consistency checking
 */

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const EventEmitter = require('events');
const crypto = require('crypto');
const sharp = require('sharp');

class VisualVerifier extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = {
            glmApiKey: options.glmApiKey || process.env.GLM_API_KEY,
            glmEndpoint: options.glmEndpoint || 'https://api.openai.com/v1/chat/completions',
            model: options.model || 'gpt-4-vision-preview',
            maxTokens: options.maxTokens || 1000,
            temperature: options.temperature || 0.1,
            timeout: options.timeout || 30000,
            screenshotDir: options.screenshotDir || path.join(process.cwd(), 'debug', 'screenshots'),
            baselineDir: options.baselineDir || path.join(process.cwd(), 'debug', 'baselines'),
            diffDir: options.diffDir || path.join(process.cwd(), 'debug', 'diffs'),
            enableCache: options.enableCache !== false,
            cacheDir: options.cacheDir || path.join(process.cwd(), 'debug', 'cache'),
            confidenceThreshold: options.confidenceThreshold || 0.8
        };
        
        // Analysis cache
        this.analysisCache = new Map();
        
        // Element detection patterns
        this.elementPatterns = {
            buttons: [
                'button', 'input[type="button"]', 'input[type="submit"]', '[role="button"]',
                '.btn', '.button', '[class*="button"]', '[class*="btn"]'
            ],
            forms: [
                'form', 'input', 'textarea', 'select', '[role="form"]',
                '.form', '[class*="form"]'
            ],
            navigation: [
                'nav', 'navbar', '.nav', '.navigation', '[role="navigation"]',
                'menu', '.menu', '[role="menu"]'
            ],
            headers: [
                'h1', 'h2', 'h3', 'h4', 'h5', 'h6', '.header', '.title',
                '[role="heading"]', '[class*="header"]', '[class*="title"]'
            ],
            links: [
                'a', 'link', '[role="link"]', '.link', '[href]'
            ],
            images: [
                'img', 'image', 'picture', '[role="img"]', '.image'
            ],
            tables: [
                'table', '.table', '[role="table"]', '[class*="table"]'
            ],
            lists: [
                'ul', 'ol', 'li', 'list', '.list', '[role="list"]', '[role="listitem"]'
            ]
        };
        
        // Initialize directories
        this.initializeDirectories();
        
        // Load cache if enabled
        if (this.config.enableCache) {
            this.loadCache();
        }
    }

    /**
     * Analyze screenshot for visual verification
     * 
     * @param {Object} params - Analysis parameters
     * @param {string} params.filepath - Path to screenshot file
     * @param {Array} params.expectedElements - Elements expected to be visible
     * @param {Object} params.context - Additional context for analysis
     * @returns {Promise<Object>} Analysis results
     */
    async analyzeScreenshot(params) {
        const {
            filepath,
            expectedElements = [],
            context = {}
        } = params;
        
        try {
            // Check cache first
            const cacheKey = this.generateCacheKey(filepath, expectedElements, context);
            if (this.config.enableCache && this.analysisCache.has(cacheKey)) {
                return this.analysisCache.get(cacheKey);
            }
            
            // Read screenshot as base64
            const imageBase64 = await this.imageToBase64(filepath);
            
            // Prepare analysis prompt
            const prompt = this.buildAnalysisPrompt(expectedElements, context);
            
            // Call GLM-4.5V API
            const analysis = await this.callGLMAPI({
                image: imageBase64,
                prompt,
                maxTokens: this.config.maxTokens
            });
            
            // Parse and structure the analysis
            const structuredAnalysis = this.parseAnalysisResponse(analysis);
            
            // Add metadata
            structuredAnalysis.metadata = {
                filepath,
                expectedElements,
                context,
                timestamp: new Date().toISOString(),
                confidence: this.calculateConfidence(structuredAnalysis)
            };
            
            // Cache the result
            if (this.config.enableCache) {
                this.analysisCache.set(cacheKey, structuredAnalysis);
                this.saveCache();
            }
            
            // Emit analysis event
            this.emit('visual:analysis:completed', {
                filepath,
                analysis: structuredAnalysis
            });
            
            return structuredAnalysis;
            
        } catch (error) {
            const errorAnalysis = {
                success: false,
                error: error.message,
                metadata: {
                    filepath,
                    timestamp: new Date().toISOString()
                }
            };
            
            this.emit('visual:analysis:error', { filepath, error });
            throw error;
        }
    }

    /**
     * Detect visual elements in screenshot
     * 
     * @param {Object} params - Detection parameters
     * @param {string} params.filepath - Path to screenshot file
     * @param {Array} params.elementTypes - Types of elements to detect
     * @returns {Promise<Object>} Detection results
     */
    async detectElements(params) {
        const {
            filepath,
            elementTypes = Object.keys(this.elementPatterns)
        } = params;
        
        const prompt = `
Analyze this screenshot and identify all visible UI elements. For each element type specified, provide:
1. Count of elements found
2. Approximate positions (x, y coordinates)
3. Visibility status (visible, partially visible, hidden)
4. Text content if readable
5. Any interactive elements

Element types to detect: ${elementTypes.join(', ')}

Respond in JSON format:
{
  "elements": {
    "buttons": {"count": 0, "positions": [], "visible": true, "text": []},
    "forms": {"count": 0, "positions": [], "visible": true, "fields": []},
    "navigation": {"count": 0, "positions": [], "visible": true, "items": []},
    "headers": {"count": 0, "positions": [], "visible": true, "text": []},
    "links": {"count": 0, "positions": [], "visible": true, "text": []},
    "images": {"count": 0, "positions": [], "visible": true, "alts": []},
    "tables": {"count": 0, "positions": [], "visible": true, "rows": 0},
    "lists": {"count": 0, "positions": [], "visible": true, "items": []}
  },
  "layout": {
    "viewport": {"width": 0, "height": 0},
    "scrollable": false,
    "responsive": false
  },
  "interactivity": {
    "clickable_elements": 0,
    "form_fields": 0,
    "navigation_items": 0
  }
}
        `;
        
        try {
            const imageBase64 = await this.imageToBase64(filepath);
            const response = await this.callGLMAPI({
                image: imageBase64,
                prompt,
                maxTokens: 1500
            });
            
            const detection = this.parseAnalysisResponse(response);
            detection.metadata = {
                filepath,
                elementTypes,
                timestamp: new Date().toISOString()
            };
            
            this.emit('visual:detection:completed', { filepath, detection });
            return detection;
            
        } catch (error) {
            this.emit('visual:detection:error', { filepath, error });
            throw error;
        }
    }

    /**
     * Verify UI state against expected conditions
     * 
     * @param {Object} params - Verification parameters
     * @param {string} params.filepath - Path to screenshot file
     * @param {Object} params.expectedState - Expected UI state
     * @param {Object} params.context - Verification context
     * @returns {Promise<Object>} Verification results
     */
    async verifyUIState(params) {
        const {
            filepath,
            expectedState,
            context = {}
        } = params;
        
        const prompt = `
Analyze this screenshot and verify the UI state against the expected conditions.

Expected state:
${JSON.stringify(expectedState, null, 2)}

For each expected condition, verify:
1. Whether the condition is met
2. Confidence level (0-1)
3. Any discrepancies found
4. Recommendations for fixes

Respond in JSON format:
{
  "verification": {
    "overall_status": "pass|fail|partial",
    "confidence": 0.0,
    "conditions": [
      {
        "condition": "condition_description",
        "expected": "expected_value",
        "actual": "actual_value",
        "status": "pass|fail|partial",
        "confidence": 0.0,
        "discrepancies": [],
        "recommendations": []
      }
    ]
  },
  "ui_analysis": {
    "page_title": "",
    "current_url": "",
    "loading_state": "loaded|loading|error",
    "error_messages": [],
    "success_messages": []
  }
}
        `;
        
        try {
            const imageBase64 = await this.imageToBase64(filepath);
            const response = await this.callGLMAPI({
                image: imageBase64,
                prompt,
                maxTokens: 1200
            });
            
            const verification = this.parseAnalysisResponse(response);
            verification.metadata = {
                filepath,
                expectedState,
                context,
                timestamp: new Date().toISOString()
            };
            
            this.emit('visual:verification:completed', { filepath, verification });
            return verification;
            
        } catch (error) {
            this.emit('visual:verification:error', { filepath, error });
            throw error;
        }
    }

    /**
     * Compare two screenshots and generate diff analysis
     * 
     * @param {Object} params - Comparison parameters
     * @param {string} params.beforeFilepath - Path to "before" screenshot
     * @param {string} params.afterFilepath - Path to "after" screenshot
     * @param {Object} params.options - Comparison options
     * @returns {Promise<Object>} Comparison results
     */
    async compareScreenshots(params) {
        const {
            beforeFilepath,
            afterFilepath,
            options = {}
        } = params;
        
        const {
            generateDiffImage = true,
            sensitivity = 'medium' // low, medium, high
        } = options;
        
        try {
            // Generate visual diff using image comparison
            let diffImage = null;
            let diffStats = {};
            
            if (generateDiffImage) {
                const diffResult = await this.generateImageDiff(beforeFilepath, afterFilepath, sensitivity);
                diffImage = diffResult.diffPath;
                diffStats = diffResult.stats;
            }
            
            // Read both images as base64
            const beforeBase64 = await this.imageToBase64(beforeFilepath);
            const afterBase64 = await this.imageToBase64(afterFilepath);
            
            const prompt = `
Compare these two screenshots and identify all visual differences.

Before screenshot: First image
After screenshot: Second image

Analyze:
1. Layout changes
2. Content changes (text, images)
3. Style changes (colors, fonts, sizes)
4. Element additions/removals
5. Position changes
6. Visibility changes

Respond in JSON format:
{
  "comparison": {
    "overall_similarity": 0.0,
    "has_significant_changes": false,
    "change_categories": {
      "layout": {"changed": false, "details": []},
      "content": {"changed": false, "details": []},
      "style": {"changed": false, "details": []},
      "elements": {"added": [], "removed": [], "modified": []}
    }
  },
  "differences": [
    {
      "type": "layout|content|style|element",
      "description": "description of change",
      "location": {"x": 0, "y": 0, "width": 0, "height": 0},
      "severity": "low|medium|high",
      "confidence": 0.0
    }
  ],
  "summary": {
    "total_differences": 0,
    "breaking_changes": 0,
    "cosmetic_changes": 0,
    "recommendation": "accept|review|reject"
  }
}
            `;
            
            const response = await this.callGLMAPI({
                images: [beforeBase64, afterBase64],
                prompt,
                maxTokens: 1500
            });
            
            const comparison = this.parseAnalysisResponse(response);
            
            // Add diff image and stats
            comparison.diffImage = diffImage;
            comparison.diffStats = diffStats;
            comparison.metadata = {
                beforeFilepath,
                afterFilepath,
                options,
                timestamp: new Date().toISOString()
            };
            
            this.emit('visual:comparison:completed', {
                beforeFilepath,
                afterFilepath,
                comparison
            });
            
            return comparison;
            
        } catch (error) {
            this.emit('visual:comparison:error', { beforeFilepath, afterFilepath, error });
            throw error;
        }
    }

    /**
     * Perform visual regression testing
     * 
     * @param {Object} params - Regression test parameters
     * @param {string} params.currentFilepath - Current screenshot
     * @param {string} params.baselineName - Baseline image name
     * @param {Object} params.testConfig - Test configuration
     * @returns {Promise<Object>} Regression test results
     */
    async performRegressionTest(params) {
        const {
            currentFilepath,
            baselineName,
            testConfig = {}
        } = params;
        
        const {
            tolerance = 0.05, // 5% tolerance for differences
            ignoreRegions = [], // Regions to ignore in comparison
            updateBaseline = false
        } = testConfig;
        
        try {
            // Find baseline image
            const baselineFilepath = path.join(this.config.baselineDir, `${baselineName}.png`);
            
            let baselineExists = true;
            try {
                await fs.access(baselineFilepath);
            } catch {
                baselineExists = false;
            }
            
            if (!baselineExists || updateBaseline) {
                // Create new baseline
                await fs.copyFile(currentFilepath, baselineFilepath);
                
                const result = {
                    status: 'baseline_created',
                    baselineFilepath,
                    message: updateBaseline ? 'Baseline updated' : 'New baseline created',
                    metadata: {
                        currentFilepath,
                        baselineName,
                        timestamp: new Date().toISOString()
                    }
                };
                
                this.emit('visual:regression:baseline_created', result);
                return result;
            }
            
            // Compare with baseline
            const comparison = await this.compareScreenshots({
                beforeFilepath: baselineFilepath,
                afterFilepath: currentFilepath,
                options: { generateDiffImage: true }
            });
            
            // Determine test result
            const similarity = comparison.comparison.overall_similarity;
            const hasSignificantChanges = comparison.comparison.has_significant_changes;
            
            let testStatus = 'pass';
            let testMessage = 'No significant changes detected';
            
            if (similarity < (1 - tolerance) || hasSignificantChanges) {
                const breakingChanges = comparison.differences.filter(d => d.severity === 'high').length;
                if (breakingChanges > 0) {
                    testStatus = 'fail';
                    testMessage = `Breaking changes detected: ${breakingChanges} high-severity differences`;
                } else {
                    testStatus = 'review';
                    testMessage = 'Cosmetic changes detected - manual review recommended';
                }
            }
            
            const result = {
                status: testStatus,
                similarity,
                tolerance,
                baselineFilepath,
                currentFilepath,
                comparison,
                message: testMessage,
                metadata: {
                    baselineName,
                    testConfig,
                    timestamp: new Date().toISOString()
                }
            };
            
            this.emit('visual:regression:completed', result);
            return result;
            
        } catch (error) {
            this.emit('visual:regression:error', { currentFilepath, baselineName, error });
            throw error;
        }
    }

    /**
     * Validate element visibility
     * 
     * @param {Object} params - Validation parameters
     * @param {string} params.filepath - Path to screenshot
     * @param {Array} params.elements - Elements to validate
     * @returns {Promise<Object>} Validation results
     */
    async validateElementVisibility(params) {
        const {
            filepath,
            elements = []
        } = params;
        
        const prompt = `
Analyze this screenshot and validate the visibility of the specified elements:

Elements to validate:
${elements.map(el => `- ${JSON.stringify(el)}`).join('\n')}

For each element, provide:
1. Whether the element is visible
2. Approximate position and size
3. Any visibility issues (obscured, clipped, etc.)
4. Readability assessment for text elements

Respond in JSON format:
{
  "validation": {
    "overall_status": "pass|fail|partial",
    "total_elements": 0,
    "visible_elements": 0,
    "hidden_elements": 0
  },
  "elements": [
    {
      "selector": "element_selector",
      "expected": {"visible": true, "text": "expected_text"},
      "actual": {"visible": true, "position": {"x": 0, "y": 0, "width": 0, "height": 0}, "text": "actual_text"},
      "status": "pass|fail|partial",
      "issues": [],
      "confidence": 0.0
    }
  ]
}
        `;
        
        try {
            const imageBase64 = await this.imageToBase64(filepath);
            const response = await this.callGLMAPI({
                image: imageBase64,
                prompt,
                maxTokens: 1200
            });
            
            const validation = this.parseAnalysisResponse(response);
            validation.metadata = {
                filepath,
                elements,
                timestamp: new Date().toISOString()
            };
            
            this.emit('visual:visibility:completed', { filepath, validation });
            return validation;
            
        } catch (error) {
            this.emit('visual:visibility:error', { filepath, error });
            throw error;
        }
    }

    // Private helper methods

    async initializeDirectories() {
        const dirs = [
            this.config.screenshotDir,
            this.config.baselineDir,
            this.config.diffDir,
            this.config.cacheDir
        ];
        
        for (const dir of dirs) {
            try {
                await fs.access(dir);
            } catch {
                await fs.mkdir(dir, { recursive: true });
            }
        }
    }

    async imageToBase64(filepath) {
        const imageBuffer = await fs.readFile(filepath);
        return imageBuffer.toString('base64');
    }

    buildAnalysisPrompt(expectedElements, context) {
        let prompt = 'Analyze this screenshot and provide detailed visual analysis.\n\n';
        
        if (expectedElements.length > 0) {
            prompt += `Expected elements to verify:\n`;
            expectedElements.forEach(el => {
                prompt += `- ${JSON.stringify(el)}\n`;
            });
            prompt += '\n';
        }
        
        if (Object.keys(context).length > 0) {
            prompt += `Context information:\n`;
            prompt += `${JSON.stringify(context, null, 2)}\n\n`;
        }
        
        prompt += `
Provide analysis in the following JSON format:
{
  "page_analysis": {
    "title": "page title if visible",
    "url": "url if visible in address bar",
    "loading_state": "loaded|loading|error",
    "viewport": {"width": 0, "height": 0}
  },
  "elements_found": {
    "expected": [{"element": "description", "found": true, "position": {"x": 0, "y": 0}, "confidence": 0.0}],
    "unexpected": [{"element": "description", "position": {"x": 0, "y": 0}, "type": "error|notification|modal"}]
  },
  "visual_quality": {
    "clarity": "clear|blurry|partial",
    "readability": "good|fair|poor",
    "layout_issues": [],
    "color_contrast": "good|fair|poor"
  },
  "issues": [
    {
      "type": "missing_element|layout_issue|visual_error",
      "severity": "low|medium|high",
      "description": "description of issue",
      "recommendation": "how to fix"
    }
  ],
  "confidence": 0.0
}
        `;
        
        return prompt;
    }

    async callGLMAPI(params) {
        const { image, images, prompt, maxTokens = this.config.maxTokens } = params;
        
        const messages = [
            {
                role: 'user',
                content: [
                    { type: 'text', text: prompt }
                ]
            }
        ];
        
        // Add image(s) to the message
        if (image) {
            messages[0].content.push({
                type: 'image_url',
                image_url: {
                    url: `data:image/png;base64,${image}`
                }
            });
        } else if (images && images.length > 0) {
            images.forEach((img, index) => {
                messages[0].content.push({
                    type: 'image_url',
                    image_url: {
                        url: `data:image/png;base64,${img}`
                    }
                });
            });
        }
        
        const requestBody = {
            model: this.config.model,
            messages,
            max_tokens: maxTokens,
            temperature: this.config.temperature
        };
        
        try {
            const response = await axios.post(this.config.glmEndpoint, requestBody, {
                headers: {
                    'Authorization': `Bearer ${this.config.glmApiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: this.config.timeout
            });
            
            return response.data.choices[0].message.content;
            
        } catch (error) {
            throw new Error(`GLM API call failed: ${error.message}`);
        }
    }

    parseAnalysisResponse(response) {
        try {
            // Extract JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON found in response');
            }
        } catch (error) {
            // Fallback parsing
            return {
                success: false,
                error: 'Failed to parse analysis response',
                rawResponse: response
            };
        }
    }

    calculateConfidence(analysis) {
        // Simple confidence calculation based on analysis structure
        let confidence = 0.5; // Base confidence
        
        if (analysis.page_analysis && Object.keys(analysis.page_analysis).length > 0) {
            confidence += 0.2;
        }
        
        if (analysis.elements_found && analysis.elements_found.expected) {
            const foundElements = analysis.elements_found.expected.filter(el => el.found).length;
            const totalElements = analysis.elements_found.expected.length;
            if (totalElements > 0) {
                confidence += (foundElements / totalElements) * 0.3;
            }
        }
        
        return Math.min(confidence, 1.0);
    }

    async generateImageDiff(beforePath, afterPath, sensitivity) {
        try {
            const before = sharp(beforePath);
            const after = sharp(afterPath);
            
            const beforeMetadata = await before.metadata();
            const afterMetadata = await after.metadata();
            
            // Ensure both images have the same dimensions
            const width = Math.max(beforeMetadata.width, afterMetadata.width);
            const height = Math.max(beforeMetadata.height, afterMetadata.height);
            
            const beforeResized = await before.resize(width, height).raw().toBuffer();
            const afterResized = await after.resize(width, height).raw().toBuffer();
            
            // Calculate pixel differences
            const diffBuffer = Buffer.alloc(beforeResized.length);
            let diffPixels = 0;
            
            for (let i = 0; i < beforeResized.length; i += 3) { // RGB
                const diff = Math.abs(beforeResized[i] - afterResized[i]) +
                            Math.abs(beforeResized[i + 1] - afterResized[i + 1]) +
                            Math.abs(beforeResized[i + 2] - afterResized[i + 2]);
                
                const threshold = sensitivity === 'low' ? 30 : sensitivity === 'high' ? 10 : 20;
                
                if (diff > threshold) {
                    diffPixels++;
                    diffBuffer[i] = 255;     // Red
                    diffBuffer[i + 1] = 0;   // Green
                    diffBuffer[i + 2] = 0;   // Blue
                } else {
                    diffBuffer[i] = 0;
                    diffBuffer[i + 1] = 0;
                    diffBuffer[i + 2] = 0;
                }
            }
            
            // Create diff image
            const timestamp = Date.now();
            const diffFilename = `diff_${timestamp}.png`;
            const diffPath = path.join(this.config.diffDir, diffFilename);
            
            await sharp(diffBuffer, {
                raw: {
                    width,
                    height,
                    channels: 3
                }
            }).toFile(diffPath);
            
            const totalPixels = width * height;
            const diffPercentage = (diffPixels / totalPixels) * 100;
            
            return {
                diffPath,
                stats: {
                    totalPixels,
                    diffPixels,
                    diffPercentage,
                    sensitivity
                }
            };
            
        } catch (error) {
            throw new Error(`Failed to generate image diff: ${error.message}`);
        }
    }

    generateCacheKey(filepath, expectedElements, context) {
        const key = {
            filepath,
            expectedElements,
            context
        };
        return crypto.createHash('md5').update(JSON.stringify(key)).digest('hex');
    }

    async loadCache() {
        try {
            const cacheFile = path.join(this.config.cacheDir, 'analysis_cache.json');
            const data = await fs.readFile(cacheFile, 'utf8');
            const cache = JSON.parse(data);
            
            this.analysisCache = new Map(Object.entries(cache));
        } catch {
            // Cache file doesn't exist or is invalid
            this.analysisCache = new Map();
        }
    }

    async saveCache() {
        try {
            const cacheFile = path.join(this.config.cacheDir, 'analysis_cache.json');
            const cacheObject = Object.fromEntries(this.analysisCache);
            await fs.writeFile(cacheFile, JSON.stringify(cacheObject, null, 2));
        } catch (error) {
            console.error('Failed to save cache:', error);
        }
    }
}

module.exports = VisualVerifier;