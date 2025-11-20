import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs-extra';

import { loadConfig, validateConfig } from './config.js';
import { 
  CaptureAndAnalyzeInput, 
  ExecuteOptimallyInput, 
  RecordSessionInput, 
  ReplayAutomationInput,
  ToolResponse,
  ServerConfig 
} from './types.js';

// Import tools
import { CaptureAndAnalyzeTool } from './tools/capture-and-analyze.js';
import { ExecuteOptimallyTool } from './tools/execute-optimally.js';
import { RecordSessionTool } from './tools/record-session.js';
import { ReplayAutomationTool } from './tools/replay-automation.js';

// Import libraries
import { BrowserStateCapture } from './lib/browser-state-capture.js';

/**
 * Main MCP Server for CDP Integuru Automation
 * Exposes 4 core tools for browser automation with intelligent modality selection
 */
class CDPAutomationServer {
  private server: Server;
  private config: ServerConfig;
  private logger: winston.Logger;
  private browserStateCapture: BrowserStateCapture;
  
  // Tool instances
  private captureAndAnalyzeTool!: CaptureAndAnalyzeTool;
  private executeOptimallyTool!: ExecuteOptimallyTool;
  private recordSessionTool!: RecordSessionTool;
  private replayAutomationTool!: ReplayAutomationTool;

  constructor() {
    this.config = loadConfig();
    validateConfig(this.config);
    
    this.setupLogger();
    this.setupServer();
    this.setupTools();
    this.setupBrowserStateCapture();
    
    this.logger.info('CDP Automation Server initialized');
  }

  /**
   * Setup Winston logger
   */
  private setupLogger(): void {
    this.logger = winston.createLogger({
      level: this.config.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
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
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });

    // Ensure logs directory exists
    fs.ensureDirSync(path.join(process.cwd(), 'logs'));
  }

  /**
   * Setup MCP server
   */
  private setupServer(): void {
    this.server = new Server(
      {
        name: 'cdp-integuru-automation',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Handle tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
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
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        this.logger.info(`Tool called: ${name}`, { args });

        switch (name) {
          case 'capture-and-analyze':
            return await this.handleCaptureAndAnalyze(args as CaptureAndAnalyzeInput);
          
          case 'execute-optimally':
            return await this.handleExecuteOptimally(args as ExecuteOptimallyInput);
          
          case 'record-session':
            return await this.handleRecordSession(args as RecordSessionInput);
          
          case 'replay-automation':
            return await this.handleReplayAutomation(args as ReplayAutomationInput);
          
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        this.logger.error(`Tool execution failed: ${name}`, error);
        
        if (error instanceof McpError) {
          throw error;
        }

        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
        );
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
  private setupTools(): void {
    this.captureAndAnalyzeTool = new CaptureAndAnalyzeTool(this.config, this.logger);
    this.executeOptimallyTool = new ExecuteOptimallyTool(this.config, this.logger);
    this.recordSessionTool = new RecordSessionTool(this.config, this.logger);
    this.replayAutomationTool = new ReplayAutomationTool(this.config, this.logger);
  }

  /**
   * Setup browser state capture
   */
  private setupBrowserStateCapture(): void {
    this.browserStateCapture = new BrowserStateCapture(
      this.config.integuru.tempDir,
      this.logger
    );
  }

  /**
   * Get tool definition for capture-and-analyze
   */
  private getCaptureAndAnalyzeToolDefinition() {
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
  private getExecuteOptimallyToolDefinition() {
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
  private getRecordSessionToolDefinition() {
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
  private getReplayAutomationToolDefinition() {
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
  private async handleCaptureAndAnalyze(args: CaptureAndAnalyzeInput): Promise<ToolResponse> {
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
  private async handleExecuteOptimally(args: ExecuteOptimallyInput): Promise<ToolResponse> {
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
  private async handleRecordSession(args: RecordSessionInput): Promise<ToolResponse> {
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
  private async handleReplayAutomation(args: ReplayAutomationInput): Promise<ToolResponse> {
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
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.logger.info('CDP Automation Server started');
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
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
    } catch (error) {
      this.logger.error('Cleanup failed:', error);
    }
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
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

export { CDPAutomationServer };