"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CDPAutomationServer = void 0;
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const winston = __importStar(require("winston"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs-extra"));
const config_js_1 = require("./config.js");
// Import tools
const capture_and_analyze_js_1 = require("./tools/capture-and-analyze.js");
const execute_optimally_js_1 = require("./tools/execute-optimally.js");
const record_session_js_1 = require("./tools/record-session.js");
const replay_automation_js_1 = require("./tools/replay-automation.js");
// Import libraries
const browser_state_capture_js_1 = require("./lib/browser-state-capture.js");
/**
 * Main MCP Server for CDP Integuru Automation
 * Exposes 4 core tools for browser automation with intelligent modality selection
 */
class CDPAutomationServer {
    server;
    config;
    logger;
    browserStateCapture;
    // Tool instances
    captureAndAnalyzeTool;
    executeOptimallyTool;
    recordSessionTool;
    replayAutomationTool;
    constructor() {
        this.config = (0, config_js_1.loadConfig)();
        (0, config_js_1.validateConfig)(this.config);
        this.setupLogger();
        this.setupServer();
        this.setupTools();
        this.setupBrowserStateCapture();
        this.logger.info('CDP Automation Server initialized');
    }
    /**
     * Setup Winston logger
     */
    setupLogger() {
        this.logger = winston.createLogger({
            level: this.config.logLevel,
            format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
            defaultMeta: { service: 'cdp-automation-mcp' },
            transports: [
                new winston.transports.File({
                    filename: path.join(process.cwd(), 'logs', 'error.log'),
                    level: 'error'
                }),
                new winston.transports.File({
                    filename: path.join(process.cwd(), 'logs', 'combined.log')
                }),
                new winston.transports.Console({
                    format: winston.format.combine(winston.format.colorize(), winston.format.simple())
                })
            ]
        });
        // Ensure logs directory exists
        fs.ensureDirSync(path.join(process.cwd(), 'logs'));
    }
    /**
     * Setup MCP server
     */
    setupServer() {
        this.server = new index_js_1.Server({
            name: 'cdp-integuru-automation',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        // Handle tool listing
        this.server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
            return {
                tools: [
                    this.getCaptureAndAnalyzeToolDefinition(),
                    this.getExecuteOptimallyToolDefinition(),
                    this.getRecordSessionToolDefinition(),
                    this.getReplayAutomationToolDefinition()
                ]
            };
        });
        // Handle tool calls
        this.server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            try {
                this.logger.info(`Tool called: ${name}`, { args });
                switch (name) {
                    case 'capture-and-analyze':
                        return await this.handleCaptureAndAnalyze(args);
                    case 'execute-optimally':
                        return await this.handleExecuteOptimally(args);
                    case 'record-session':
                        return await this.handleRecordSession(args);
                    case 'replay-automation':
                        return await this.handleReplayAutomation(args);
                    default:
                        throw new types_js_1.McpError(types_js_1.ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
                }
            }
            catch (error) {
                this.logger.error(`Tool execution failed: ${name}`, error);
                if (error instanceof types_js_1.McpError) {
                    throw error;
                }
                throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
        // Setup error handling
        this.server.onerror = (error) => {
            this.logger.error('MCP Server error:', error);
        };
        // Setup cleanup on exit
        process.on('SIGINT', async () => {
            this.logger.info('Shutting down server...');
            await this.cleanup();
            process.exit(0);
        });
    }
    /**
     * Setup tool instances
     */
    setupTools() {
        this.captureAndAnalyzeTool = new capture_and_analyze_js_1.CaptureAndAnalyzeTool(this.config, this.logger);
        this.executeOptimallyTool = new execute_optimally_js_1.ExecuteOptimallyTool(this.config, this.logger);
        this.recordSessionTool = new record_session_js_1.RecordSessionTool(this.config, this.logger);
        this.replayAutomationTool = new replay_automation_js_1.ReplayAutomationTool(this.config, this.logger);
    }
    /**
     * Setup browser state capture
     */
    setupBrowserStateCapture() {
        this.browserStateCapture = new browser_state_capture_js_1.BrowserStateCapture(this.config.integuru.tempDir, this.logger);
    }
    /**
     * Get tool definition for capture-and-analyze
     */
    getCaptureAndAnalyzeToolDefinition() {
        return {
            name: 'capture-and-analyze',
            description: 'Record network activity and analyze with Integuru to determine optimal automation modality',
            inputSchema: {
                type: 'object',
                properties: {
                    timeoutSeconds: {
                        type: 'number',
                        description: 'Timeout in seconds for capture (default: 30)',
                        default: 30
                    },
                    taskDescription: {
                        type: 'string',
                        description: 'Description of the task to analyze'
                    },
                    captureLevel: {
                        type: 'number',
                        description: 'Capture level (1-4, higher = more detailed)',
                        enum: [1, 2, 3, 4],
                        default: 2
                    },
                    includeScreenshots: {
                        type: 'boolean',
                        description: 'Include screenshots in capture',
                        default: true
                    }
                },
                required: ['taskDescription']
            }
        };
    }
    /**
     * Get tool definition for execute-optimally
     */
    getExecuteOptimallyToolDefinition() {
        return {
            name: 'execute-optimally',
            description: 'Execute automation using the optimal modality (Integuru/CDP/Manual)',
            inputSchema: {
                type: 'object',
                properties: {
                    taskDescription: {
                        type: 'string',
                        description: 'Description of the task to execute'
                    },
                    sessionId: {
                        type: 'string',
                        description: 'Session ID from previous capture-and-analyze'
                    },
                    harFile: {
                        type: 'string',
                        description: 'Path to HAR file to analyze'
                    },
                    forceModality: {
                        type: 'string',
                        description: 'Force specific modality',
                        enum: ['integuru', 'headless_cdp', 'visible_browser']
                    },
                    browserState: {
                        type: 'object',
                        description: 'Browser state to apply'
                    }
                },
                required: ['taskDescription']
            }
        };
    }
    /**
     * Get tool definition for record-session
     */
    getRecordSessionToolDefinition() {
        return {
            name: 'record-session',
            description: 'Record complete automation session for replay',
            inputSchema: {
                type: 'object',
                properties: {
                    taskDescription: {
                        type: 'string',
                        description: 'Description of the task being recorded'
                    },
                    sessionId: {
                        type: 'string',
                        description: 'Session ID (auto-generated if not provided)'
                    },
                    captureLevel: {
                        type: 'number',
                        description: 'Capture level (1-4, higher = more detailed)',
                        enum: [1, 2, 3, 4],
                        default: 3
                    },
                    includeScreenshots: {
                        type: 'boolean',
                        description: 'Include screenshots in recording',
                        default: true
                    },
                    autoStop: {
                        type: 'boolean',
                        description: 'Automatically stop recording on inactivity',
                        default: true
                    },
                    timeoutMinutes: {
                        type: 'number',
                        description: 'Maximum recording time in minutes',
                        default: 30
                    }
                },
                required: ['taskDescription']
            }
        };
    }
    /**
     * Get tool definition for replay-automation
     */
    getReplayAutomationToolDefinition() {
        return {
            name: 'replay-automation',
            description: 'Replay a previously recorded automation session',
            inputSchema: {
                type: 'object',
                properties: {
                    sessionId: {
                        type: 'string',
                        description: 'Session ID to replay'
                    },
                    actionIndex: {
                        type: 'number',
                        description: 'Specific action index to replay (optional)'
                    },
                    speedMultiplier: {
                        type: 'number',
                        description: 'Speed multiplier for replay (1.0 = normal speed)',
                        default: 1.0
                    },
                    skipScreenshots: {
                        type: 'boolean',
                        description: 'Skip screenshots during replay',
                        default: false
                    },
                    dryRun: {
                        type: 'boolean',
                        description: 'Dry run without executing actions',
                        default: false
                    }
                },
                required: ['sessionId']
            }
        };
    }
    /**
     * Handle capture-and-analyze tool call
     */
    async handleCaptureAndAnalyze(args) {
        const result = await this.captureAndAnalyzeTool.execute(args);
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(result, null, 2)
                }
            ]
        };
    }
    /**
     * Handle execute-optimally tool call
     */
    async handleExecuteOptimally(args) {
        const result = await this.executeOptimallyTool.execute(args);
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(result, null, 2)
                }
            ]
        };
    }
    /**
     * Handle record-session tool call
     */
    async handleRecordSession(args) {
        const result = await this.recordSessionTool.execute(args);
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(result, null, 2)
                }
            ]
        };
    }
    /**
     * Handle replay-automation tool call
     */
    async handleReplayAutomation(args) {
        const result = await this.replayAutomationTool.execute(args);
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(result, null, 2)
                }
            ]
        };
    }
    /**
     * Start the server
     */
    async start() {
        const transport = new stdio_js_1.StdioServerTransport();
        await this.server.connect(transport);
        this.logger.info('CDP Automation Server started');
    }
    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            await this.browserStateCapture.cleanup();
            // Cleanup tools
            if (this.captureAndAnalyzeTool) {
                await this.captureAndAnalyzeTool.cleanup();
            }
            if (this.executeOptimallyTool) {
                await this.executeOptimallyTool.cleanup();
            }
            if (this.recordSessionTool) {
                await this.recordSessionTool.cleanup();
            }
            if (this.replayAutomationTool) {
                await this.replayAutomationTool.cleanup();
            }
            this.logger.info('Cleanup completed');
        }
        catch (error) {
            this.logger.error('Cleanup failed:', error);
        }
    }
}
exports.CDPAutomationServer = CDPAutomationServer;
/**
 * Main entry point
 */
async function main() {
    const server = new CDPAutomationServer();
    await server.start();
}
// Start the server if this file is run directly
if (require.main === module) {
    main().catch((error) => {
        console.error('Failed to start server:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=server.js.map