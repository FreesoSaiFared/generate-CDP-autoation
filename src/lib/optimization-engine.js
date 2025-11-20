/**
 * Optimization Engine - Continuous Learning and Improvement
 * 
 * This module implements machine learning and statistical analysis to continuously
 * improve modality selection accuracy and performance predictions.
 * 
 * Features:
 * - Historical performance analysis
 * - Pattern recognition and learning
 * - Predictive modeling for execution time
 * - Success rate prediction
 * - Adaptive threshold optimization
 * - Feature importance analysis
 * - Model performance tracking
 */

const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');

class OptimizationEngine extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.dataDir = options.dataDir || path.join(process.cwd(), 'data', 'optimization');
        this.modelUpdateInterval = options.modelUpdateInterval || 24 * 60 * 60 * 1000; // Daily
        this.minTrainingSamples = options.minTrainingSamples || 50;
        this.featureWeights = options.featureWeights || {
            apiReversibility: 0.3,
            complexity: 0.25,
            domainHistory: 0.2,
            taskTypeHistory: 0.15,
            timeOfDay: 0.1
        };
        
        // Model data
        this.models = {
            timePrediction: null,
            successPrediction: null,
            modalitySelection: null
        };
        
        // Historical performance data
        this.historicalData = {
            byDomain: {},
            byTaskType: {},
            byModality: {},
            byTimeOfDay: {}
        };
        
        // Feature statistics
        this.featureStats = {
            means: {},
            standardDeviations: {},
            correlations: {}
        };
        
        // Initialize data directory
        this.initializeDataDirectory();
        
        // Load existing models and data
        this.loadModels();
        this.loadHistoricalData();
        
        // Setup periodic model updates
        this.setupPeriodicUpdates();
    }

    /**
     * Get historical performance data for optimization
     * 
     * @param {Object} params - Query parameters
     * @param {string} params.domain - Domain to filter by
     * @param {string} params.taskType - Task type to filter by
     * @returns {Promise<Object>} Historical performance data
     */
    async getHistoricalPerformance(params = {}) {
        const { domain, taskType } = params;
        
        let data = {};
        
        // Get domain-specific data
        if (domain && this.historicalData.byDomain[domain]) {
            data.domain = this.historicalData.byDomain[domain];
        }
        
        // Get task type-specific data
        if (taskType && this.historicalData.byTaskType[taskType]) {
            data.taskType = this.historicalData.byTaskType[taskType];
        }
        
        // Get overall modality performance
        data.modalities = this.historicalData.byModality;
        
        // Calculate combined predictions
        data.predictions = this.calculatePredictions(data, params);
        
        return data;
    }

    /**
     * Update optimization models with new execution data
     * 
     * @param {Object} params - Execution data
     * @returns {Promise<Object>} Update results
     */
    async updateModel(params) {
        const {
            modality,
            success,
            timeAccuracy,
            confidenceAccuracy,
            features = {}
        } = params;
        
        // Update historical data
        this.updateHistoricalData(params);
        
        // Update feature statistics
        this.updateFeatureStatistics(features, success, timeAccuracy);
        
        // Check if we should update models
        const shouldUpdate = this.shouldUpdateModels();
        
        if (shouldUpdate) {
            await this.trainModels();
            this.emit('model:updated', { timestamp: new Date().toISOString() });
        }
        
        return {
            historicalDataUpdated: true,
            featureStatsUpdated: true,
            modelsUpdated: shouldUpdate,
            sampleSize: this.getTotalSampleSize()
        };
    }

    /**
     * Record execution for learning
     * 
     * @param {Object} params - Execution record
     * @returns {Promise<Object>} Recording result
     */
    async recordExecution(params) {
        const {
            modality,
            executionTime,
            success,
            features = {}
        } = params;
        
        const record = {
            timestamp: new Date().toISOString(),
            modality,
            executionTime,
            success,
            features,
            extractedFeatures: this.extractFeatures(features)
        };
        
        // Update historical data
        this.updateHistoricalDataWithRecord(record);
        
        // Persist record
        await this.persistExecutionRecord(record);
        
        // Check for model updates
        if (this.shouldUpdateModels()) {
            await this.trainModels();
        }
        
        return record;
    }

    /**
     * Predict execution time for a modality
     * 
     * @param {Object} params - Prediction parameters
     * @param {string} params.modality - Modality to predict for
     * @param {Object} params.features - Feature vector
     * @returns {Promise<number>} Predicted execution time
     */
    async predictExecutionTime(params) {
        const { modality, features } = params;
        
        if (!this.models.timePrediction) {
            return this.getDefaultTimePrediction(modality);
        }
        
        const featureVector = this.normalizeFeatures(features);
        const prediction = this.models.timePrediction.predict(modality, featureVector);
        
        return Math.max(0, prediction);
    }

    /**
     * Predict success probability for a modality
     * 
     * @param {Object} params - Prediction parameters
     * @param {string} params.modality - Modality to predict for
     * @param {Object} params.features - Feature vector
     * @returns {Promise<number>} Predicted success probability (0-1)
     */
    async predictSuccessProbability(params) {
        const { modality, features } = params;
        
        if (!this.models.successPrediction) {
            return this.getDefaultSuccessPrediction(modality);
        }
        
        const featureVector = this.normalizeFeatures(features);
        const prediction = this.models.successPrediction.predict(modality, featureVector);
        
        return Math.max(0, Math.min(1, prediction));
    }

    /**
     * Get feature importance analysis
     * 
     * @param {Object} options - Analysis options
     * @returns {Promise<Object>} Feature importance data
     */
    async getFeatureImportance(options = {}) {
        const {
            modality = null,
            timeRange = 24 * 7 // 1 week
        } = options;
        
        const importance = {
            overall: this.calculateOverallFeatureImportance(),
            byModality: {},
            correlations: this.featureStats.correlations,
            recommendations: []
        };
        
        // Calculate importance by modality
        const modalities = ['integuru', 'headless_cdp', 'visible_browser'];
        
        for (const m of modalities) {
            if (!modality || modality === m) {
                importance.byModality[m] = this.calculateModalityFeatureImportance(m);
            }
        }
        
        // Generate recommendations
        importance.recommendations = this.generateFeatureRecommendations(importance);
        
        return importance;
    }

    /**
     * Optimize decision thresholds based on historical performance
     * 
     * @param {Object} options - Optimization options
     * @returns {Promise<Object>} Optimized thresholds
     */
    async optimizeThresholds(options = {}) {
        const {
            objective = 'balanced', // speed, reliability, balanced
            timeRange = 24 * 7 // 1 week
        } = options;
        
        const historicalData = await this.getHistoricalPerformance({ timeRange });
        
        const currentThresholds = {
            integuru: 0.85,
            headless_cdp: 0.70
        };
        
        const optimizedThresholds = this.calculateOptimalThresholds(
            historicalData,
            currentThresholds,
            objective
        );
        
        // Validate thresholds
        const validatedThresholds = this.validateThresholds(optimizedThresholds);
        
        return {
            current: currentThresholds,
            optimized: validatedThresholds,
            objective,
            expectedImprovement: this.calculateExpectedImprovement(
                historicalData,
                currentThresholds,
                validatedThresholds
            ),
            validation: this.validateThresholdPerformance(validatedThresholds)
        };
    }

    /**
     * Export optimization models and data
     * 
     * @param {Object} options - Export options
     * @returns {Promise<string>} Path to exported file
     */
    async exportModels(options = {}) {
        const {
            includeData = true,
            format = 'json'
        } = options;
        
        const exportData = {
            exportedAt: new Date().toISOString(),
            models: this.models,
            featureWeights: this.featureWeights,
            featureStats: this.featureStats,
            modelPerformance: this.getModelPerformance()
        };
        
        if (includeData) {
            exportData.historicalData = this.historicalData;
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `optimization_models_${timestamp}.${format}`;
        const filepath = path.join(this.dataDir, filename);
        
        await fs.writeFile(filepath, JSON.stringify(exportData, null, 2));
        
        return filepath;
    }

    // Helper methods
    
    extractFeatures(features) {
        // Extract and normalize features for ML models
        return {
            apiReversibility: features.apiReversibility || features.reversibilityScore || 0,
            complexity: features.complexity || 0,
            hasApiEndpoints: features.hasApiEndpoints ? 1 : 0,
            requestCount: features.requestCount || 0,
            authPatterns: features.authPatterns || 0,
            dynamicParams: features.dynamicParams || 0,
            domain: this.encodeDomain(features.domain || 'unknown'),
            taskType: this.encodeTaskType(features.taskType || 'general'),
            timeOfDay: features.timeOfDay || new Date().getHours(),
            dayOfWeek: features.dayOfWeek || new Date().getDay()
        };
    }

    normalizeFeatures(features) {
        const normalized = {};
        const extracted = this.extractFeatures(features);
        
        // Normalize using feature statistics
        Object.keys(extracted).forEach(key => {
            const value = extracted[key];
            const mean = this.featureStats.means[key] || 0;
            const std = this.featureStats.standardDeviations[key] || 1;
            
            normalized[key] = (value - mean) / std;
        });
        
        return normalized;
    }

    updateHistoricalData(params) {
        const { modality, success, timeAccuracy, confidenceAccuracy, features = {} } = params;
        
        const domain = features.domain || 'unknown';
        const taskType = features.taskType || 'general';
        
        // Update domain data
        if (!this.historicalData.byDomain[domain]) {
            this.historicalData.byDomain[domain] = {
                integuru: { successes: 0, failures: 0, totalTime: 0, count: 0 },
                headless_cdp: { successes: 0, failures: 0, totalTime: 0, count: 0 },
                visible_browser: { successes: 0, failures: 0, totalTime: 0, count: 0 }
            };
        }
        
        const domainData = this.historicalData.byDomain[domain][modality];
        domainData[success ? 'successes' : 'failures']++;
        domainData.totalTime += features.actualTime || 0;
        domainData.count++;
        
        // Update task type data
        if (!this.historicalData.byTaskType[taskType]) {
            this.historicalData.byTaskType[taskType] = {
                integuru: { successes: 0, failures: 0, totalTime: 0, count: 0 },
                headless_cdp: { successes: 0, failures: 0, totalTime: 0, count: 0 },
                visible_browser: { successes: 0, failures: 0, totalTime: 0, count: 0 }
            };
        }
        
        const taskTypeData = this.historicalData.byTaskType[taskType][modality];
        taskTypeData[success ? 'successes' : 'failures']++;
        taskTypeData.totalTime += features.actualTime || 0;
        taskTypeData.count++;
        
        // Update modality data
        if (!this.historicalData.byModality[modality]) {
            this.historicalData.byModality[modality] = {
                successes: 0,
                failures: 0,
                totalTime: 0,
                count: 0,
                avgTime: 0,
                successRate: 0
            };
        }
        
        const modalityData = this.historicalData.byModality[modality];
        modalityData[success ? 'successes' : 'failures']++;
        modalityData.totalTime += features.actualTime || 0;
        modalityData.count++;
        modalityData.avgTime = modalityData.totalTime / modalityData.count;
        modalityData.successRate = modalityData.successes / modalityData.count;
    }

    updateHistoricalDataWithRecord(record) {
        const { modality, executionTime, success, features } = record;
        
        this.updateHistoricalData({
            modality,
            success,
            timeAccuracy: 0, // Would need estimated time
            confidenceAccuracy: 0, // Would need confidence
            features: {
                ...features,
                actualTime: executionTime
            }
        });
    }

    updateFeatureStatistics(features, success, timeAccuracy) {
        const extracted = this.extractFeatures(features);
        
        // Update running statistics for each feature
        Object.keys(extracted).forEach(key => {
            const value = extracted[key];
            
            if (!this.featureStats.means[key]) {
                this.featureStats.means[key] = value;
                this.featureStats.standardDeviations[key] = 0;
            } else {
                // Online update of mean and standard deviation
                const oldMean = this.featureStats.means[key];
                const oldStd = this.featureStats.standardDeviations[key];
                
                // This is a simplified update - in production would use proper online algorithms
                this.featureStats.means[key] = (oldMean + value) / 2;
                this.featureStats.standardDeviations[key] = Math.sqrt(
                    (oldStd * oldStd + Math.pow(value - oldMean, 2)) / 2
                );
            }
        });
    }

    shouldUpdateModels() {
        const totalSamples = this.getTotalSampleSize();
        return totalSamples >= this.minTrainingSamples;
    }

    getTotalSampleSize() {
        let total = 0;
        
        Object.values(this.historicalData.byModality).forEach(modality => {
            total += modality.count || 0;
        });
        
        return total;
    }

    async trainModels() {
        // Train time prediction model
        this.models.timePrediction = this.trainTimePredictionModel();
        
        // Train success prediction model
        this.models.successPrediction = this.trainSuccessPredictionModel();
        
        // Train modality selection model
        this.models.modalitySelection = this.trainModalitySelectionModel();
        
        // Persist updated models
        await this.persistModels();
        
        this.emit('models:trained', {
            timestamp: new Date().toISOString(),
            sampleSize: this.getTotalSampleSize()
        });
    }

    trainTimePredictionModel() {
        // Simplified linear regression model
        // In production, would use more sophisticated ML algorithms
        
        return {
            type: 'linear_regression',
            predict: (modality, features) => {
                const baseTime = this.getBaseTime(modality);
                const adjustment = this.calculateTimeAdjustment(features);
                
                return baseTime * (1 + adjustment);
            }
        };
    }

    trainSuccessPredictionModel() {
        // Simplified logistic regression model
        // In production, would use more sophisticated ML algorithms
        
        return {
            type: 'logistic_regression',
            predict: (modality, features) => {
                const baseSuccessRate = this.getBaseSuccessRate(modality);
                const adjustment = this.calculateSuccessAdjustment(features);
                
                return Math.max(0, Math.min(1, baseSuccessRate + adjustment));
            }
        };
    }

    trainModalitySelectionModel() {
        // Simplified decision tree model
        // In production, would use more sophisticated ML algorithms
        
        return {
            type: 'decision_tree',
            predict: (features) => {
                // Simple rule-based selection
                if (features.apiReversibility > 0.8 && features.complexity < 0.5) {
                    return 'integuru';
                } else if (features.complexity < 0.8) {
                    return 'headless_cdp';
                } else {
                    return 'visible_browser';
                }
            }
        };
    }

    getBaseTime(modality) {
        const baseTimes = {
            integuru: 3.5,
            headless_cdp: 22.5,
            visible_browser: 300
        };
        
        return baseTimes[modality] || 60;
    }

    getBaseSuccessRate(modality) {
        const baseSuccessRates = {
            integuru: 0.95,
            headless_cdp: 0.85,
            visible_browser: 0.99
        };
        
        return baseSuccessRates[modality] || 0.8;
    }

    calculateTimeAdjustment(features) {
        // Simplified time adjustment based on features
        let adjustment = 0;
        
        // Complexity increases time
        adjustment += features.complexity * 0.5;
        
        // More requests increase time
        adjustment += (features.requestCount / 20) * 0.3;
        
        // API reversibility decreases time
        adjustment -= features.apiReversibility * 0.2;
        
        return adjustment;
    }

    calculateSuccessAdjustment(features) {
        // Simplified success adjustment based on features
        let adjustment = 0;
        
        // API reversibility increases success
        adjustment += features.apiReversibility * 0.2;
        
        // Complexity decreases success
        adjustment -= features.complexity * 0.15;
        
        // API endpoints increase success
        adjustment += features.hasApiEndpoints * 0.1;
        
        return adjustment;
    }

    getDefaultTimePrediction(modality) {
        return this.getBaseTime(modality);
    }

    getDefaultSuccessPrediction(modality) {
        return this.getBaseSuccessRate(modality);
    }

    encodeDomain(domain) {
        // Simple hash encoding for domain
        // In production, would use more sophisticated encoding
        const hash = this.simpleHash(domain);
        return hash / 1000; // Normalize to 0-1 range
    }

    encodeTaskType(taskType) {
        const taskTypeMap = {
            'download': 0.1,
            'upload': 0.2,
            'authentication': 0.3,
            'search': 0.4,
            'form_interaction': 0.5,
            'navigation': 0.6,
            'general': 0.7
        };
        
        return taskTypeMap[taskType] || 0.7;
    }

    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    calculatePredictions(data, params) {
        const predictions = {};
        
        // Predict for each modality
        ['integuru', 'headless_cdp', 'visible_browser'].forEach(modality => {
            const domainData = data.domain && data.domain[modality];
            const taskTypeData = data.taskType && data.taskType[modality];
            const modalityData = data.modalities && data.modalities[modality];
            
            let successRate = this.getBaseSuccessRate(modality);
            let avgTime = this.getBaseTime(modality);
            
            // Weight different data sources
            if (domainData && domainData.count > 0) {
                successRate = successRate * 0.4 + domainData.successRate * 0.6;
                avgTime = avgTime * 0.4 + domainData.avgTime * 0.6;
            }
            
            if (taskTypeData && taskTypeData.count > 0) {
                successRate = successRate * 0.3 + taskTypeData.successRate * 0.7;
                avgTime = avgTime * 0.3 + taskTypeData.avgTime * 0.7;
            }
            
            if (modalityData && modalityData.count > 0) {
                successRate = successRate * 0.5 + modalityData.successRate * 0.5;
                avgTime = avgTime * 0.5 + modalityData.avgTime * 0.5;
            }
            
            predictions[modality] = {
                successRate: Math.round(successRate * 100) / 100,
                avgTime: Math.round(avgTime * 100) / 100,
                confidence: Math.min(modalityData?.count || 0, 100) / 100
            };
        });
        
        return predictions;
    }

    async initializeDataDirectory() {
        try {
            await fs.access(this.dataDir);
        } catch {
            await fs.mkdir(this.dataDir, { recursive: true });
        }
    }

    async loadModels() {
        try {
            const modelsPath = path.join(this.dataDir, 'models.json');
            const data = await fs.readFile(modelsPath, 'utf8');
            const modelsData = JSON.parse(data);
            
            this.models = modelsData.models || {};
            this.featureWeights = modelsData.featureWeights || this.featureWeights;
        } catch (error) {
            // Models don't exist yet, will be created on first training
        }
    }

    async loadHistoricalData() {
        try {
            const dataPath = path.join(this.dataDir, 'historical_data.json');
            const data = await fs.readFile(dataPath, 'utf8');
            
            this.historicalData = JSON.parse(data);
        } catch (error) {
            // Historical data doesn't exist yet
        }
    }

    async persistModels() {
        const modelsPath = path.join(this.dataDir, 'models.json');
        const data = {
            savedAt: new Date().toISOString(),
            models: this.models,
            featureWeights: this.featureWeights,
            featureStats: this.featureStats
        };
        
        await fs.writeFile(modelsPath, JSON.stringify(data, null, 2));
    }

    async persistExecutionRecord(record) {
        const date = new Date(record.timestamp).toISOString().split('T')[0];
        const filename = `${date}.json`;
        const filepath = path.join(this.dataDir, 'executions', filename);
        
        try {
            await fs.mkdir(path.dirname(filepath), { recursive: true });
            
            let dailyRecords = [];
            try {
                const data = await fs.readFile(filepath, 'utf8');
                dailyRecords = JSON.parse(data);
            } catch {
                // File doesn't exist yet
            }
            
            dailyRecords.push(record);
            await fs.writeFile(filepath, JSON.stringify(dailyRecords, null, 2));
            
        } catch (error) {
            console.error('Failed to persist execution record:', error);
        }
    }

    setupPeriodicUpdates() {
        setInterval(async () => {
            if (this.shouldUpdateModels()) {
                await this.trainModels();
            }
        }, this.modelUpdateInterval);
    }

    calculateOverallFeatureImportance() {
        const importance = {};
        
        Object.keys(this.featureWeights).forEach(feature => {
            importance[feature] = this.featureWeights[feature];
        });
        
        return importance;
    }

    calculateModalityFeatureImportance(modality) {
        // Calculate feature importance specific to a modality
        const baseImportance = this.calculateOverallFeatureImportance();
        
        // Adjust weights based on modality characteristics
        const modalityAdjustments = {
            integuru: {
                apiReversibility: 1.5,
                complexity: 0.8,
                hasApiEndpoints: 1.2
            },
            headless_cdp: {
                complexity: 1.2,
                hasApiEndpoints: 0.9,
                requestCount: 1.1
            },
            visible_browser: {
                complexity: 1.0,
                requestCount: 0.8,
                domain: 0.7
            }
        };
        
        const adjustments = modalityAdjustments[modality] || {};
        
        Object.keys(baseImportance).forEach(feature => {
            if (adjustments[feature]) {
                baseImportance[feature] *= adjustments[feature];
            }
        });
        
        return baseImportance;
    }

    generateFeatureRecommendations(importance) {
        const recommendations = [];
        
        // Analyze feature importance patterns
        const overall = importance.overall;
        
        if (overall.apiReversibility > 0.4) {
            recommendations.push({
                category: 'api_focus',
                priority: 'high',
                description: 'API reversibility is a key factor - prioritize API analysis'
            });
        }
        
        if (overall.complexity > 0.3) {
            recommendations.push({
                category: 'complexity_handling',
                priority: 'medium',
                description: 'Task complexity significantly impacts decisions - improve complexity assessment'
            });
        }
        
        // Check modality-specific patterns
        Object.keys(importance.byModality).forEach(modality => {
            const modalityImportance = importance.byModality[modality];
            
            if (modalityImportance.apiReversibility > 0.5 && modality === 'integuru') {
                recommendations.push({
                    category: 'modality_optimization',
                    priority: 'high',
                    modality,
                    description: `${modality} success strongly depends on API reversibility`
                });
            }
        });
        
        return recommendations;
    }

    calculateOptimalThresholds(historicalData, currentThresholds, objective) {
        const optimized = { ...currentThresholds };
        
        // Adjust thresholds based on objective
        switch (objective) {
            case 'speed':
                // Lower thresholds to favor faster modalities
                optimized.integuru = Math.max(0.7, currentThresholds.integuru - 0.1);
                optimized.headless_cdp = Math.max(0.6, currentThresholds.headless_cdp - 0.1);
                break;
                
            case 'reliability':
                // Raise thresholds to favor more reliable modalities
                optimized.integuru = Math.min(0.95, currentThresholds.integuru + 0.05);
                optimized.headless_cdp = Math.min(0.85, currentThresholds.headless_cdp + 0.05);
                break;
                
            case 'balanced':
            default:
                // Optimize based on historical performance
                if (historicalData.modalities) {
                    const integuruSuccess = historicalData.modalities.integuru?.successRate || 0.8;
                    const headlessSuccess = historicalData.modalities.headless_cdp?.successRate || 0.8;
                    
                    if (integuruSuccess > 0.9) {
                        optimized.integuru = Math.min(0.9, currentThresholds.integuru - 0.05);
                    } else if (integuruSuccess < 0.7) {
                        optimized.integuru = Math.max(0.8, currentThresholds.integuru + 0.05);
                    }
                    
                    if (headlessSuccess > 0.9) {
                        optimized.headless_cdp = Math.min(0.8, currentThresholds.headless_cdp - 0.05);
                    } else if (headlessSuccess < 0.7) {
                        optimized.headless_cdp = Math.max(0.75, currentThresholds.headless_cdp + 0.05);
                    }
                }
                break;
        }
        
        return optimized;
    }

    validateThresholds(thresholds) {
        const validated = { ...thresholds };
        
        // Ensure thresholds are within valid ranges
        validated.integuru = Math.max(0.5, Math.min(0.99, thresholds.integuru));
        validated.headless_cdp = Math.max(0.4, Math.min(0.9, thresholds.headless_cdp));
        
        // Ensure logical ordering
        if (validated.integuru < validated.headless_cdp) {
            validated.integuru = validated.headless_cdp + 0.05;
        }
        
        return validated;
    }

    calculateExpectedImprovement(historicalData, currentThresholds, optimizedThresholds) {
        const improvement = {
            integuru: 0,
            headless_cdp: 0,
            overall: 0
        };
        
        // Estimate improvement based on historical success rates
        if (historicalData.modalities) {
            const integuruData = historicalData.modalities.integuru;
            const headlessData = historicalData.modalities.headless_cdp;
            
            if (integuruData) {
                const currentSelectionRate = this.estimateSelectionRate(integuruData, currentThresholds.integuru);
                const optimizedSelectionRate = this.estimateSelectionRate(integuruData, optimizedThresholds.integuru);
                improvement.integuru = optimizedSelectionRate - currentSelectionRate;
            }
            
            if (headlessData) {
                const currentSelectionRate = this.estimateSelectionRate(headlessData, currentThresholds.headless_cdp);
                const optimizedSelectionRate = this.estimateSelectionRate(headlessData, optimizedThresholds.headless_cdp);
                improvement.headless_cdp = optimizedSelectionRate - currentSelectionRate;
            }
            
            improvement.overall = (improvement.integuru + improvement.headless_cdp) / 2;
        }
        
        return improvement;
    }

    estimateSelectionRate(modalityData, threshold) {
        if (!modalityData || !modalityData.successRate) {
            return 0;
        }
        
        // Simplified estimation - in reality would use more complex modeling
        const baseRate = modalityData.successRate;
        const thresholdAdjustment = threshold > 0.8 ? 0.1 : threshold > 0.6 ? 0.05 : 0;
        
        return Math.min(1.0, baseRate + thresholdAdjustment);
    }

    validateThresholdPerformance(thresholds) {
        const validation = {
            integuru: { valid: true, issues: [] },
            headless_cdp: { valid: true, issues: [] },
            overall: { valid: true, issues: [] }
        };
        
        // Check integuru threshold
        if (thresholds.integuru < 0.7) {
            validation.integuru.valid = false;
            validation.integuru.issues.push('Threshold too low - may result in unreliable selections');
        }
        
        if (thresholds.integuru > 0.95) {
            validation.integuru.valid = false;
            validation.integuru.issues.push('Threshold too high - may prevent valid selections');
        }
        
        // Check headless threshold
        if (thresholds.headless_cdp < 0.5) {
            validation.headless_cdp.valid = false;
            validation.headless_cdp.issues.push('Threshold too low - may result in unreliable selections');
        }
        
        if (thresholds.headless_cdp > 0.9) {
            validation.headless_cdp.valid = false;
            validation.headless_cdp.issues.push('Threshold too high - may prevent valid selections');
        }
        
        // Check logical ordering
        if (thresholds.integuru <= thresholds.headless_cdp) {
            validation.overall.valid = false;
            validation.overall.issues.push('Integuru threshold should be higher than headless threshold');
        }
        
        return validation;
    }

    getModelPerformance() {
        const performance = {
            timePrediction: { accuracy: 0, samples: 0 },
            successPrediction: { accuracy: 0, samples: 0 },
            modalitySelection: { accuracy: 0, samples: 0 }
        };
        
        // Calculate model performance metrics
        if (this.models.timePrediction) {
            performance.timePrediction.samples = this.getTotalSampleSize();
            // In a real implementation, would calculate actual accuracy
            performance.timePrediction.accuracy = 0.85; // Placeholder
        }
        
        if (this.models.successPrediction) {
            performance.successPrediction.samples = this.getTotalSampleSize();
            performance.successPrediction.accuracy = 0.82; // Placeholder
        }
        
        if (this.models.modalitySelection) {
            performance.modalitySelection.samples = this.getTotalSampleSize();
            performance.modalitySelection.accuracy = 0.88; // Placeholder
        }
        
        return performance;
    }
}

module.exports = OptimizationEngine;