/**
 * Debug Configuration and Settings Management
 * 
 * This module provides comprehensive configuration management for the
 * debugging and logging infrastructure, including settings validation,
 * environment-specific configurations, and dynamic configuration updates.
 * 
 * Features:
 * - Centralized configuration management
 * - Environment-specific settings
 * - Configuration validation
 * - Dynamic configuration updates
 * - Settings persistence and backup
 * - Configuration versioning
 * - Security-sensitive settings handling
 * - Configuration templates and presets
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const EventEmitter = require('events');
const Joi = require('joi');

class DebugConfig extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = {
            configDir: options.configDir || path.join(process.cwd(), 'config'),
            configFile: options.configFile || 'debug-config.json',
            backupDir: options.backupDir || path.join(process.cwd(), 'config', 'backups'),
            environment: options.environment || process.env.NODE_ENV || 'development',
            enableEncryption: options.enableEncryption !== false,
            encryptionKey: options.encryptionKey || process.env.CONFIG_ENCRYPTION_KEY,
            autoBackup: options.autoBackup !== false,
            maxBackups: options.maxBackups || 10,
            validationEnabled: options.validationEnabled !== false
        };
        
        // Default configuration schema
        this.configSchema = Joi.object({
            version: Joi.string().default('1.0.0'),
            environment: Joi.string().valid('development', 'staging', 'production').default('development'),
            debug: Joi.object({
                enabled: Joi.boolean().default(true),
                level: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
                autoStart: Joi.boolean().default(true)
            }).default(),
            logging: Joi.object({
                level: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
                structured: Joi.boolean().default(true),
                console: Joi.boolean().default(true),
                file: Joi.boolean().default(true),
                rotation: Joi.object({
                    enabled: Joi.boolean().default(true),
                    maxSize: Joi.string().default('10MB'),
                    maxFiles: Joi.number().integer().min(1).max(100).default(30)
                }).default()
            }).default(),
            performance: Joi.object({
                monitoring: Joi.boolean().default(true),
                interval: Joi.number().integer().min(100).max(60000).default(1000),
                historySize: Joi.number().integer().min(100).max(10000).default(3600),
                alerts: Joi.object({
                    cpu: Joi.number().min(0).max(100).default(80),
                    memory: Joi.number().min(0).max(100).default(85),
                    disk: Joi.number().min(0).max(100).default(90),
                    responseTime: Joi.number().min(100).max(60000).default(5000)
                }).default()
            }).default(),
            visual: Joi.object({
                enabled: Joi.boolean().default(true),
                autoCapture: Joi.boolean().default(true),
                analysis: Joi.object({
                    enabled: Joi.boolean().default(true),
                    confidence: Joi.number().min(0).max(1).default(0.8),
                    cache: Joi.boolean().default(true)
                }).default(),
                regression: Joi.object({
                    enabled: Joi.boolean().default(true),
                    baselineDir: Joi.string().default('./debug/baselines'),
                    tolerance: Joi.number().min(0).max(1).default(0.05)
                }).default()
            }).default(),
            glm: Joi.object({
                apiKey: Joi.string().default(''),
                endpoint: Joi.string().default('https://api.openai.com/v1/chat/completions'),
                model: Joi.string().default('gpt-4-vision-preview'),
                maxTokens: Joi.number().integer().min(100).max(8000).default(1000),
                temperature: Joi.number().min(0).max(2).default(0.1),
                timeout: Joi.number().integer().min(5000).max(120000).default(30000)
            }).default(),
            diagnostics: Joi.object({
                enabled: Joi.boolean().default(true),
                interval: Joi.number().integer().min(10000).max(300000).default(60000),
                autoHealing: Joi.boolean().default(true),
                thresholds: Joi.object({
                    cpu: Joi.number().min(0).max(100).default(80),
                    memory: Joi.number().min(0).max(100).default(85),
                    disk: Joi.number().min(0).max(100).default(90),
                    networkLatency: Joi.number().min(100).max(10000).default(1000)
                }).default()
            }).default(),
            dashboard: Joi.object({
                enabled: Joi.boolean().default(true),
                port: Joi.number().integer().min(3000).max(65535).default(3001),
                websocket: Joi.object({
                    enabled: Joi.boolean().default(true),
                    port: Joi.number().integer().min(3000).max(65535).default(3002)
                }).default(),
                auth: Joi.object({
                    enabled: Joi.boolean().default(false),
                    username: Joi.string().default(''),
                    password: Joi.string().default('')
                }).default()
            }).default(),
            alerts: Joi.object({
                enabled: Joi.boolean().default(true),
                channels: Joi.array().items(Joi.string()).default(['console', 'file']),
                email: Joi.object({
                    enabled: Joi.boolean().default(false),
                    smtp: Joi.object({
                        host: Joi.string().default(''),
                        port: Joi.number().integer().min(1).max(65535).default(587),
                        secure: Joi.boolean().default(true),
                        username: Joi.string().default(''),
                        password: Joi.string().default('')
                    }).default(),
                    from: Joi.string().default(''),
                    to: Joi.array().items(Joi.string()).default([])
                }).default(),
                webhook: Joi.object({
                    enabled: Joi.boolean().default(false),
                    url: Joi.string().default(''),
                    timeout: Joi.number().integer().min(1000).max(30000).default(10000)
                }).default()
            }).default()
        }).default();
        
        // Configuration presets
        this.presets = {
            development: {
                debug: { enabled: true, level: 'debug', autoStart: true },
                logging: { level: 'debug', console: true, file: true },
                performance: { monitoring: true, interval: 1000 },
                visual: { enabled: true, autoCapture: true },
                dashboard: { enabled: true, auth: { enabled: false } }
            },
            staging: {
                debug: { enabled: true, level: 'info', autoStart: true },
                logging: { level: 'info', console: true, file: true },
                performance: { monitoring: true, interval: 5000 },
                visual: { enabled: true, autoCapture: false },
                dashboard: { enabled: true, auth: { enabled: true } }
            },
            production: {
                debug: { enabled: false, level: 'error', autoStart: false },
                logging: { level: 'warn', console: false, file: true },
                performance: { monitoring: true, interval: 10000 },
                visual: { enabled: false, autoCapture: false },
                dashboard: { enabled: true, auth: { enabled: true } }
            }
        };
        
        // Current configuration state
        this.currentConfig = null;
        this.isLoaded = false;
        
        // Initialize configuration
        this.initializeConfiguration();
    }

    /**
     * Load configuration from file
     * 
     * @param {Object} options - Load options
     * @returns {Promise<Object>} Loaded configuration
     */
    async loadConfig(options = {}) {
        const {
            environment = this.config.environment,
            validate = this.config.validationEnabled,
            mergeWithDefaults = true
        } = options;
        
        try {
            const configPath = this.getConfigPath(environment);
            
            // Check if config file exists
            try {
                await fs.access(configPath);
            } catch {
                // Config file doesn't exist, create from defaults
                const defaultConfig = this.getDefaultConfiguration(environment);
                await this.saveConfig(defaultConfig, { environment });
                return defaultConfig;
            }
            
            // Read and parse config file
            const configData = await fs.readFile(configPath, 'utf8');
            let config = JSON.parse(configData);
            
            // Decrypt if encryption is enabled
            if (this.config.enableEncryption && config.encrypted) {
                config = this.decryptConfig(config.data);
            }
            
            // Validate configuration
            if (validate) {
                const validation = this.validateConfiguration(config);
                if (!validation.valid) {
                    throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
                }
            }
            
            // Merge with defaults if requested
            if (mergeWithDefaults) {
                const defaultConfig = this.getDefaultConfiguration(environment);
                config = this.mergeConfigurations(defaultConfig, config);
            }
            
            // Set as current configuration
            this.currentConfig = config;
            this.isLoaded = true;
            
            // Create backup if enabled
            if (this.config.autoBackup) {
                await this.createBackup(config, environment);
            }
            
            this.emit('config:loaded', { config, environment });
            return config;
            
        } catch (error) {
            this.emit('config:error', { type: 'load', error });
            throw new Error(`Failed to load configuration: ${error.message}`);
        }
    }

    /**
     * Save configuration to file
     * 
     * @param {Object} config - Configuration to save
     * @param {Object} options - Save options
     * @returns {Promise<string>} Path to saved config file
     */
    async saveConfig(config, options = {}) {
        const {
            environment = this.config.environment,
            createBackup = this.config.autoBackup,
            validate = this.config.validationEnabled
        } = options;
        
        try {
            // Validate configuration
            if (validate) {
                const validation = this.validateConfiguration(config);
                if (!validation.valid) {
                    throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
                }
            }
            
            // Add metadata
            const configWithMetadata = {
                ...config,
                version: config.version || '1.0.0',
                environment: environment || this.config.environment,
                lastModified: new Date().toISOString(),
                encrypted: this.config.enableEncryption
            };
            
            let finalConfig = configWithMetadata;
            
            // Encrypt if encryption is enabled
            if (this.config.enableEncryption) {
                finalConfig = {
                    ...configWithMetadata,
                    data: this.encryptConfig(config),
                    encrypted: true
                };
            }
            
            // Create backup if requested
            if (createBackup && this.currentConfig) {
                await this.createBackup(this.currentConfig, environment);
            }
            
            // Save configuration
            const configPath = this.getConfigPath(environment);
            await fs.writeFile(configPath, JSON.stringify(finalConfig, null, 2));
            
            // Update current configuration
            this.currentConfig = config;
            
            this.emit('config:saved', { config, environment, path: configPath });
            return configPath;
            
        } catch (error) {
            this.emit('config:error', { type: 'save', error });
            throw new Error(`Failed to save configuration: ${error.message}`);
        }
    }

    /**
     * Get configuration value
     * 
     * @param {string} path - Configuration path (dot notation)
     * @param {*} defaultValue - Default value if path doesn't exist
     * @returns {*} Configuration value
     */
    get(path, defaultValue = undefined) {
        if (!this.isLoaded || !this.currentConfig) {
            return defaultValue;
        }
        
        return this.getNestedValue(this.currentConfig, path, defaultValue);
    }

    /**
     * Set configuration value
     * 
     * @param {string} path - Configuration path (dot notation)
     * @param {*} value - Value to set
     * @param {Object} options - Set options
     * @returns {Promise<boolean>} Success status
     */
    async set(path, value, options = {}) {
        const {
            persist = true,
            validate = this.config.validationEnabled
        } = options;
        
        if (!this.isLoaded) {
            await this.loadConfig();
        }
        
        try {
            // Create a copy of current config
            const newConfig = JSON.parse(JSON.stringify(this.currentConfig));
            
            // Set the nested value
            this.setNestedValue(newConfig, path, value);
            
            // Validate the new configuration
            if (validate) {
                const validation = this.validateConfiguration(newConfig);
                if (!validation.valid) {
                    throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
                }
            }
            
            // Update current configuration
            this.currentConfig = newConfig;
            
            // Persist if requested
            if (persist) {
                await this.saveConfig(newConfig);
            }
            
            this.emit('config:updated', { path, value, config: newConfig });
            return true;
            
        } catch (error) {
            this.emit('config:error', { type: 'set', path, value, error });
            throw new Error(`Failed to set configuration value: ${error.message}`);
        }
    }

    /**
     * Apply configuration preset
     * 
     * @param {string} presetName - Preset name
     * @param {Object} options - Apply options
     * @returns {Promise<Object>} Updated configuration
     */
    async applyPreset(presetName, options = {}) {
        const {
            merge = true,
            save = true
        } = options;
        
        if (!this.presets[presetName]) {
            throw new Error(`Unknown preset: ${presetName}`);
        }
        
        try {
            const preset = this.presets[presetName];
            let newConfig;
            
            if (merge && this.currentConfig) {
                newConfig = this.mergeConfigurations(this.currentConfig, preset);
            } else {
                newConfig = this.getDefaultConfiguration(presetName);
                newConfig = this.mergeConfigurations(newConfig, preset);
            }
            
            // Set environment
            newConfig.environment = presetName;
            
            // Save if requested
            if (save) {
                await this.saveConfig(newConfig, { environment: presetName });
            } else {
                this.currentConfig = newConfig;
            }
            
            this.emit('config:preset_applied', { presetName, config: newConfig });
            return newConfig;
            
        } catch (error) {
            this.emit('config:error', { type: 'preset', presetName, error });
            throw new Error(`Failed to apply preset: ${error.message}`);
        }
    }

    /**
     * Validate configuration
     * 
     * @param {Object} config - Configuration to validate
     * @returns {Object} Validation result
     */
    validateConfiguration(config) {
        try {
            const { error, value } = this.configSchema.validate(config);
            
            return {
                valid: !error,
                errors: error ? error.details.map(d => d.message) : [],
                validated: value
            };
        } catch (validationError) {
            return {
                valid: false,
                errors: [`Validation schema error: ${validationError.message}`],
                validated: null
            };
        }
    }

    /**
     * Get configuration schema
     * 
     * @returns {Object} Configuration schema
     */
    getSchema() {
        return this.configSchema.describe();
    }

    /**
     * Get available presets
     * 
     * @returns {Object} Available presets
     */
    getPresets() {
        return { ...this.presets };
    }

    /**
     * Create configuration backup
     * 
     * @param {Object} config - Configuration to backup
     * @param {string} environment - Environment name
     * @returns {Promise<string>} Backup file path
     */
    async createBackup(config, environment) {
        try {
            await fs.access(this.config.backupDir);
        } catch {
            await fs.mkdir(this.config.backupDir, { recursive: true });
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFilename = `config_${environment}_${timestamp}.json`;
        const backupPath = path.join(this.config.backupDir, backupFilename);
        
        const backupData = {
            ...config,
            backupMetadata: {
                timestamp: new Date().toISOString(),
                environment,
                version: config.version || '1.0.0'
            }
        };
        
        await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2));
        
        // Clean up old backups
        await this.cleanupOldBackups();
        
        this.emit('config:backup_created', { path: backupPath, environment });
        return backupPath;
    }

    /**
     * Restore configuration from backup
     * 
     * @param {string} backupFilename - Backup filename
     * @returns {Promise<Object>} Restored configuration
     */
    async restoreFromBackup(backupFilename) {
        try {
            const backupPath = path.join(this.config.backupDir, backupFilename);
            const backupData = JSON.parse(await fs.readFile(backupPath, 'utf8'));
            
            // Remove backup metadata
            const { backupMetadata, ...config } = backupData;
            
            // Validate restored configuration
            const validation = this.validateConfiguration(config);
            if (!validation.valid) {
                throw new Error(`Backup configuration validation failed: ${validation.errors.join(', ')}`);
            }
            
            // Save as current configuration
            await this.saveConfig(config, { 
                environment: backupMetadata.environment,
                createBackup: false 
            });
            
            this.emit('config:restored', { backupFilename, config });
            return config;
            
        } catch (error) {
            this.emit('config:error', { type: 'restore', backupFilename, error });
            throw new Error(`Failed to restore from backup: ${error.message}`);
        }
    }

    /**
     * Get list of available backups
     * 
     * @returns {Promise<Array>} List of backup files
     */
    async listBackups() {
        try {
            await fs.access(this.config.backupDir);
            const files = await fs.readdir(this.config.backupDir);
            
            const backupFiles = files
                .filter(file => file.startsWith('config_') && file.endsWith('.json'))
                .map(file => {
                    const filePath = path.join(this.config.backupDir, file);
                    return {
                        filename: file,
                        path: filePath,
                        environment: this.extractEnvironmentFromFilename(file),
                        timestamp: this.extractTimestampFromFilename(file)
                    };
                })
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            return backupFiles;
            
        } catch (error) {
            this.emit('config:error', { type: 'list_backups', error });
            return [];
        }
    }

    // Private helper methods

    async initializeConfiguration() {
        try {
            await this.loadConfig();
        } catch (error) {
            console.warn('Failed to load configuration, using defaults:', error.message);
            this.currentConfig = this.getDefaultConfiguration(this.config.environment);
        }
    }

    getConfigPath(environment) {
        return path.join(this.config.configDir, `debug-config-${environment}.json`);
    }

    getDefaultConfiguration(environment) {
        const baseConfig = {
            version: '1.0.0',
            environment: environment
        };
        
        // Apply environment-specific defaults
        const preset = this.presets[environment] || this.presets.development;
        return this.mergeConfigurations(baseConfig, preset);
    }

    mergeConfigurations(base, override) {
        return {
            ...base,
            ...override,
            debug: { ...base.debug, ...override.debug },
            logging: { ...base.logging, ...override.logging },
            performance: { ...base.performance, ...override.performance },
            visual: { ...base.visual, ...override.visual },
            glm: { ...base.glm, ...override.glm },
            diagnostics: { ...base.diagnostics, ...override.diagnostics },
            dashboard: { ...base.dashboard, ...override.dashboard },
            alerts: { ...base.alerts, ...override.alerts }
        };
    }

    getNestedValue(obj, path, defaultValue) {
        return path.split('.').reduce((current, key) => {
            return current && typeof current === 'object' ? current[key] : defaultValue;
        }, obj);
    }

    setNestedValue(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        
        const target = keys.reduce((current, key) => {
            if (!current[key] || typeof current[key] !== 'object') {
                current[key] = {};
            }
            return current[key];
        }, obj);
        
        target[lastKey] = value;
    }

    encryptConfig(config) {
        if (!this.config.encryptionKey) {
            throw new Error('Encryption key not provided');
        }
        
        const algorithm = 'aes-256-cbc';
        const key = crypto.createHash('sha256').update(this.config.encryptionKey).digest();
        const iv = crypto.randomBytes(16);
        
        const cipher = crypto.createCipher(algorithm, key);
        cipher.setAutoPadding(true);
        
        let encrypted = cipher.update(JSON.stringify(config), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        return {
            data: encrypted,
            iv: iv.toString('hex'),
            algorithm
        };
    }

    decryptConfig(encryptedData) {
        if (!this.config.encryptionKey) {
            throw new Error('Encryption key not provided');
        }
        
        const { data, iv, algorithm } = encryptedData;
        const key = crypto.createHash('sha256').update(this.config.encryptionKey).digest();
        
        const decipher = crypto.createDecipher(algorithm, key);
        decipher.setAutoPadding(true);
        
        let decrypted = decipher.update(data, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return JSON.parse(decrypted);
    }

    extractEnvironmentFromFilename(filename) {
        const match = filename.match(/config_(.+?)_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{3}Z\.json/);
        return match ? match[1] : 'unknown';
    }

    extractTimestampFromFilename(filename) {
        const match = filename.match(/config_.+?_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{3}Z)\.json/);
        return match ? match[1] : null;
    }

    async cleanupOldBackups() {
        try {
            const backups = await this.listBackups();
            
            if (backups.length > this.config.maxBackups) {
                const backupsToDelete = backups.slice(this.config.maxBackups);
                
                for (const backup of backupsToDelete) {
                    await fs.unlink(backup.path);
                }
                
                this.emit('config:backups_cleaned', { 
                    deleted: backupsToDelete.length,
                    remaining: backups.length - backupsToDelete.length
                });
            }
        } catch (error) {
            console.error('Failed to cleanup old backups:', error);
        }
    }
}

module.exports = DebugConfig;