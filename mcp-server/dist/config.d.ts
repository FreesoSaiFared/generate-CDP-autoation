import { ServerConfig } from './types';
/**
 * Default configuration for the MCP server
 */
export declare const defaultConfig: ServerConfig;
/**
 * Load configuration from environment variables and config files
 */
export declare function loadConfig(): ServerConfig;
/**
 * Validate configuration
 */
export declare function validateConfig(config: ServerConfig): void;
/**
 * Get configuration for specific environments
 */
export declare function getEnvironmentConfig(): Partial<ServerConfig>;
/**
 * Export configuration as JSON for debugging
 */
export declare function exportConfig(config: ServerConfig): string;
/**
 * Save configuration to file
 */
export declare function saveConfig(config: ServerConfig, filePath?: string): void;
//# sourceMappingURL=config.d.ts.map