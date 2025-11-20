# MCP Server Documentation

The MCP (Model Context Protocol) Server provides the orchestration layer for the CDP automation system, exposing four core tools for browser automation with intelligent modality selection. It integrates seamlessly with Claude Desktop and other MCP-compatible AI assistants.

## Overview

The MCP server acts as the central coordinator for all automation activities, providing:

- **Network Capture & Analysis** - Record and analyze browser activity
- **Optimal Execution** - Choose best automation modality (API/CDP/Manual)
- **Session Recording** - Save complete automation sessions for replay
- **Session Replay** - Execute saved sessions with identical reproduction

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP SERVER                              │
│ ┌─────────────────┐ ┌─────────────────┐ ┌──────────────┐ │
│ │ Capture &       │ │ Execute         │ │ Record      │ │
│ │ Analyze Tool   │ │ Optimally Tool  │ │ Session Tool │ │
│ └─────────────────┘ └─────────────────┘ └──────────────┘ │
│                                                         │
│ ┌─────────────────┐ ┌─────────────────┐ ┌──────────────┐ │
│ │ Replay          │ │ Modality        │ │ Browser      │ │
│ │ Automation Tool │ │ Optimizer      │ │ State Mgmt   │ │
│ └─────────────────┘ └─────────────────┘ └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Integuru    │    │ CDP Stealth │    │ mitmproxy   │
│ Analysis    │    │ Browser     │    │ Recording   │
└─────────────┘    └─────────────┘    └─────────────┘
```

## Installation

### Prerequisites

- Node.js 18.0+
- npm 8.0+
- TypeScript 5.0+
- MCP SDK

### Installation Steps

```bash
# Navigate to MCP server directory
cd mcp-server

# Install dependencies
npm install

# Build TypeScript
npm run build

# Start server
npm start
```

### Claude Desktop Integration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "cdp-automation": {
      "command": "node",
      "args": ["/path/to/cdp-automation/mcp-server/dist/server.js"]
    }
  }
}
```

## Server Configuration

### Main Server File

**Location**: [`mcp-server/server.ts`](../mcp-server/server.ts)

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from '@modelcontextprotocol/sdk/types.js';

class CDPAutomationServer {
  private server: Server;
  private config: ServerConfig;
  private logger: winston.Logger;
  
  constructor() {
    this.config = loadConfig();
    this.setupLogger();
    this.setupServer();
    this.setupTools();
  }
  
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
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        this.logger.error(`Tool execution failed: ${name}`, error);
        throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${error.message}`);
      }
    });
  }
}
```

### Configuration Management

**Location**: [`mcp-server/config.ts`](../mcp-server/config.ts)

```typescript
export interface ServerConfig {
  integuru: {
    model: string;
    timeout: number;
    tempDir: string;
    integuruDir: string;
  };
  cdpStealth: {
    chromePath: string;
    userDataDir: string;
    stealthFlags: string[];
  };
  mitmproxy: {
    port: number;
    recordAddonPath: string;
    harOutputPath: string;
  };
  logging: {
    level: string;
    file: string;
    console: boolean;
  };
}

export function loadConfig(): ServerConfig {
  return {
    integuru: {
      model: process.env.INTEGURU_MODEL || 'gpt-4o',
      timeout: parseInt(process.env.INTEGURU_TIMEOUT || '30000'),
      tempDir: process.env.INTEGURU_TEMP_DIR || './temp',
      integuruDir: process.env.INTEGURU_DIR || './Integuru'
    },
    cdpStealth: {
      chromePath: process.env.CHROME_PATH || 'google-chrome',
      userDataDir: process.env.CHROME_USER_DATA_DIR || './chrome-user-data',
      stealthFlags: [
        '--disable-blink-features=AutomationControlled',
        '--exclude-switches=enable-automation',
        '--disable-automation'
      ]
    },
    mitmproxy: {
      port: parseInt(process.env.MITMPROXY_PORT || '8080'),
      recordAddonPath: process.env.MITMPROXY_ADDON_PATH || './.mitmproxy/record_addon.py',
      harOutputPath: process.env.HAR_OUTPUT_PATH || './network.har'
    },
    logging: {
      level: process.env.LOG_LEVEL || 'info',
      file: process.env.LOG_FILE || './logs/mcp-server.log',
      console: process.env.LOG_CONSOLE !== 'false'
    }
  };
}
```

## Core Tools

### 1. capture-and-analyze Tool

Records network activity and analyzes with Integuru to determine optimal automation modality.

#### Tool Definition

```typescript
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
```

#### Implementation

**Location**: [`mcp-server/tools/capture-and-analyze.ts`](../mcp-server/tools/capture-and-analyze.ts)

```typescript
export class CaptureAndAnalyzeTool {
  constructor(
    private config: ServerConfig,
    private logger: winston.Logger
  ) {}
  
  async execute(input: CaptureAndAnalyzeInput): Promise<CaptureAndAnalyzeResult> {
    this.logger.info('Starting capture and analyze', { 
      task: input.taskDescription,
      timeout: input.timeoutSeconds 
    });
    
    // 1. Start mitmproxy recording
    const sessionId = await this.startNetworkRecording(input.captureLevel);
    
    try {
      // 2. Wait for user action or timeout
      await this.waitForUserAction(input.timeoutSeconds);
      
      // 3. Stop recording and process HAR
      const harData = await this.stopNetworkRecording(sessionId);
      
      // 4. Analyze with Integuru
      const integuruResult = await this.analyzeWithInteguru(
        harData,
        input.taskDescription
      );
      
      // 5. Choose optimal modality
      const modalityChoice = this.chooseOptimalModality({
        har: harData,
        integuruConfidence: integuruResult.confidence,
        complexity: integuruResult.complexity
      });
      
      return {
        sessionId,
        harFile: harData.filePath,
        integuruAnalysis: integuruResult,
        recommendedModality: modalityChoice.modality,
        confidence: modalityChoice.confidence,
        estimatedTime: modalityChoice.estimatedTimeSeconds,
        reasoning: modalityChoice.reasoning
      };
      
    } catch (error) {
      await this.cleanup(sessionId);
      throw error;
    }
  }
  
  private async startNetworkRecording(captureLevel: number): Promise<string> {
    const sessionId = uuidv4();
    
    // Start mitmproxy process
    const mitmproxyProcess = spawn('mitmdump', [
      '-s', this.config.mitmproxy.recordAddonPath,
      '--set', `hardump=./sessions/${sessionId}/network.har`,
      '--set', `flow_detail=${captureLevel}`,
      '-q'
    ]);
    
    // Store process reference for cleanup
    this.activeProcesses.set(sessionId, mitmproxyProcess);
    
    return sessionId;
  }
  
  private async analyzeWithInteguru(
    harData: any,
    taskDescription: string
  ): Promise<InteguruResult> {
    const integuruWrapper = new InteguruWrapper(this.config.integuru);
    
    return await integuruWrapper.analyzeHAR(
      harData.filePath,
      taskDescription,
      true // generate code
    );
  }
  
  private chooseOptimalModality(options: ModalityChoiceOptions): ModalityChoice {
    const optimizer = new ModalityOptimizer();
    return optimizer.choose(options);
  }
}
```

### 2. execute-optimally Tool

Executes automation using the optimal modality (Integuru/CDP/Manual).

#### Tool Definition

```typescript
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
```

#### Implementation

**Location**: [`mcp-server/tools/execute-optimally.ts`](../mcp-server/tools/execute-optimally.ts)

```typescript
export class ExecuteOptimallyTool {
  async execute(input: ExecuteOptimallyInput): Promise<ExecuteOptimallyResult> {
    const startTime = Date.now();
    
    try {
      // Determine execution modality
      const modality = input.forceModality || 
        await this.determineOptimalModality(input);
      
      this.logger.info(`Executing task with modality: ${modality}`);
      
      switch (modality) {
        case 'integuru':
          return await this.executeWithInteguru(input);
        case 'headless_cdp':
          return await this.executeWithCDP(input, true);
        case 'visible_browser':
          return await this.executeWithCDP(input, false);
        default:
          throw new Error(`Unknown modality: ${modality}`);
      }
      
    } catch (error) {
      this.logger.error('Execution failed', { error: error.message });
      return {
        status: 'FAILED',
        error: error.message,
        executionTime: (Date.now() - startTime) / 1000
      };
    }
  }
  
  private async executeWithInteguru(input: ExecuteOptimallyInput): Promise<ExecuteOptimallyResult> {
    const integuruWrapper = new InteguruWrapper(this.config.integuru);
    
    // Execute generated Python code
    const result = await integuruWrapper.executeCode(
      input.integuruCode || await this.generateInteguruCode(input)
    );
    
    return {
      status: result.success ? 'SUCCESS' : 'FAILED',
      modality: 'integuru',
      executionTime: result.executionTime,
      output: result.output,
      error: result.error
    };
  }
  
  private async executeWithCDP(input: ExecuteOptimallyInput, headless: boolean): Promise<ExecuteOptimallyResult> {
    const { launchStealthBrowser } = require('../../cdp-stealth/src/index.js');
    
    // Launch stealth browser
    const browser = await launchStealthBrowser({
      headless,
      proxy: `http://127.0.0.1:${this.config.mitmproxy.port}`
    });
    
    try {
      // Apply browser state if provided
      if (input.browserState) {
        await this.applyBrowserState(browser, input.browserState);
      }
      
      // Execute automation script
      const result = await this.executeAutomationScript(browser, input);
      
      return {
        status: 'SUCCESS',
        modality: headless ? 'headless_cdp' : 'visible_browser',
        executionTime: result.executionTime,
        screenshots: result.screenshots,
        output: result.output
      };
      
    } finally {
      await browser.close();
    }
  }
}
```

### 3. record-session Tool

Records complete automation session for replay.

#### Tool Definition

```typescript
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
```

#### Implementation

**Location**: [`mcp-server/tools/record-session.ts`](../mcp-server/tools/record-session.ts)

```typescript
export class RecordSessionTool {
  async execute(input: RecordSessionInput): Promise<RecordSessionResult> {
    const sessionId = input.sessionId || uuidv4();
    const sessionPath = path.join(this.config.sessionsDir, sessionId);
    
    await fs.ensureDir(sessionPath);
    
    this.logger.info(`Starting session recording: ${sessionId}`);
    
    // Initialize recording state
    const recordingState: RecordingState = {
      sessionId,
      startTime: Date.now(),
      taskDescription: input.taskDescription,
      actions: [],
      screenshots: [],
      networkEvents: []
    };
    
    // Start all recording components
    await this.startNetworkRecording(sessionId, input.captureLevel);
    await this.startBrowserRecording(sessionId, input.includeScreenshots);
    
    try {
      // Wait for recording completion or timeout
      await this.waitForRecordingCompletion(recordingState, input);
      
      // Stop all recording components
      await this.stopNetworkRecording(sessionId);
      await this.stopBrowserRecording(sessionId);
      
      // Process and save session
      const sessionData = await this.processRecording(recordingState);
      await this.saveSession(sessionPath, sessionData);
      
      return {
        sessionId,
        status: 'COMPLETED',
        duration: (Date.now() - recordingState.startTime) / 1000,
        actionCount: sessionData.actions.length,
        screenshotCount: sessionData.screenshots.length,
        networkEventCount: sessionData.networkEvents.length,
        sessionPath
      };
      
    } catch (error) {
      await this.cleanup(sessionId);
      throw error;
    }
  }
  
  private async startBrowserRecording(sessionId: string, includeScreenshots: boolean): Promise<void> {
    const { launchStealthBrowser } = require('../../cdp-stealth/src/index.js');
    
    const browser = await launchStealthBrowser({
      headless: false,
      extensionPath: path.join(__dirname, '../../extensions/cdp-stealth')
    });
    
    const page = await browser.newPage();
    
    // Set up event listeners for action recording
    await page.evaluateOnNewDocument(() => {
      window.CDPRecorder = {
        actions: [],
        
        recordAction(type, details) {
          this.actions.push({
            type,
            timestamp: Date.now(),
            details
          });
        }
      };
      
      // Record clicks
      document.addEventListener('click', (event) => {
        window.CDPRecorder.recordAction('click', {
          selector: this.getSelector(event.target),
          x: event.clientX,
          y: event.clientY
        });
      });
      
      // Record typing
      document.addEventListener('input', (event) => {
        window.CDPRecorder.recordAction('input', {
          selector: this.getSelector(event.target),
          value: event.target.value
        });
      });
      
      // Helper function to generate CSS selector
      this.getSelector = (element) => {
        // Generate unique CSS selector for element
        // Implementation details...
      };
    });
    
    // Store browser instance for later use
    this.activeBrowsers.set(sessionId, { browser, page });
  }
}
```

### 4. replay-automation Tool

Replays a previously recorded automation session.

#### Tool Definition

```typescript
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
```

#### Implementation

**Location**: [`mcp-server/tools/replay-automation.ts`](../mcp-server/tools/replay-automation.ts)

```typescript
export class ReplayAutomationTool {
  async execute(input: ReplayAutomationInput): Promise<ReplayAutomationResult> {
    const sessionPath = path.join(this.config.sessionsDir, input.sessionId);
    
    // Load session data
    const sessionData = await this.loadSession(sessionPath);
    
    this.logger.info(`Replaying session: ${input.sessionId}`);
    
    const startTime = Date.now();
    const results: ActionResult[] = [];
    
    try {
      // Launch stealth browser
      const browser = await launchStealthBrowser({
        headless: input.dryRun,
        extensionPath: path.join(__dirname, '../../extensions/cdp-stealth')
      });
      
      const page = await browser.newPage();
      
      // Restore initial state
      if (sessionData.initialState) {
        await this.restoreBrowserState(page, sessionData.initialState);
      }
      
      // Replay actions
      const actionsToReplay = input.actionIndex !== undefined 
        ? [sessionData.actions[input.actionIndex]]
        : sessionData.actions;
      
      for (const action of actionsToReplay) {
        const result = await this.replayAction(page, action, {
          speedMultiplier: input.speedMultiplier,
          skipScreenshots: input.skipScreenshots,
          dryRun: input.dryRun
        });
        
        results.push(result);
        
        if (!result.success && !input.dryRun) {
          this.logger.warn(`Action failed: ${action.type}`, result.error);
          break;
        }
      }
      
      await browser.close();
      
      return {
        sessionId: input.sessionId,
        status: 'COMPLETED',
        duration: (Date.now() - startTime) / 1000,
        actionsReplayed: results.length,
        successCount: results.filter(r => r.success).length,
        failureCount: results.filter(r => !r.success).length,
        results
      };
      
    } catch (error) {
      return {
        sessionId: input.sessionId,
        status: 'FAILED',
        error: error.message,
        duration: (Date.now() - startTime) / 1000
      };
    }
  }
  
  private async replayAction(
    page: any, 
    action: RecordedAction, 
    options: ReplayOptions
  ): Promise<ActionResult> {
    const startTime = Date.now();
    
    try {
      // Apply speed multiplier
      const delay = action.delay ? action.delay / options.speedMultiplier : 0;
      
      if (!options.dryRun) {
        switch (action.type) {
          case 'click':
            await page.waitForTimeout(delay);
            await page.click(action.details.selector);
            break;
            
          case 'input':
            await page.waitForTimeout(delay);
            await page.type(action.details.selector, action.details.value);
            break;
            
          case 'navigate':
            await page.goto(action.details.url);
            break;
            
          case 'scroll':
            await page.evaluate((x, y) => {
              window.scrollTo(x, y);
            }, action.details.x, action.details.y);
            break;
            
          default:
            throw new Error(`Unknown action type: ${action.type}`);
        }
        
        // Take screenshot if not skipped
        if (!options.skipScreenshots) {
          const screenshot = await page.screenshot({ encoding: 'base64' });
          return {
            success: true,
            action: action,
            executionTime: (Date.now() - startTime) / 1000,
            screenshot
          };
        }
      }
      
      return {
        success: true,
        action: action,
        executionTime: (Date.now() - startTime) / 1000
      };
      
    } catch (error) {
      return {
        success: false,
        action: action,
        error: error.message,
        executionTime: (Date.now() - startTime) / 1000
      };
    }
  }
}
```

## Modality Optimizer

**Location**: [`mcp-server/lib/modality-optimizer.ts`](../mcp-server/lib/modality-optimizer.ts)

```typescript
export class ModalityOptimizer {
  choose(options: ModalityChoiceOptions): ModalityChoice {
    const complexity = this.analyzeComplexity(options.har);
    
    // API-first approach
    if (options.integuruConfidence > 0.85 && complexity.apiDepth < 5) {
      return {
        modality: 'integuru',
        confidence: options.integuruConfidence,
        estimatedTimeSeconds: 3,
        reasoning: 'API patterns simple and well-defined'
      };
    }
    
    // CDP fallback
    if (options.integuruConfidence > 0.60) {
      return {
        modality: 'headless_cdp',
        confidence: 0.85,
        estimatedTimeSeconds: 20,
        reasoning: 'Integuru marginal, CDP safer'
      };
    }
    
    // Human required
    return {
      modality: 'visible_browser',
      confidence: 1.0,
      estimatedTimeSeconds: 300,
      reasoning: 'Task too complex for automation'
    };
  }
  
  private analyzeComplexity(har: any): ComplexityAnalysis {
    const entries = har.log.entries || [];
    
    return {
      apiDepth: this.calculateAPIDepth(entries),
      authenticationRequired: this.hasAuthenticationFlow(entries),
      dynamicContent: this.hasDynamicContent(entries),
      javascriptHeavy: this.isJavaScriptHeavy(entries),
      totalRequests: entries.length,
      uniqueDomains: this.countUniqueDomains(entries)
    };
  }
  
  private calculateAPIDepth(entries: any[]): number {
    // Calculate the depth of API call dependencies
    const apiCalls = entries.filter(e => this.isAPIEndpoint(e.request.url));
    const dependencies = this.buildDependencyGraph(apiCalls);
    return this.findMaxDepth(dependencies);
  }
  
  private hasAuthenticationFlow(entries: any[]): boolean {
    return entries.some(entry => 
      this.isAuthEndpoint(entry.request.url) ||
      entry.response.status === 401 ||
      entry.response.status === 403
    );
  }
}
```

## Usage Examples

### Basic Usage with Claude Desktop

```bash
# Start MCP server
node mcp-server/dist/server.js

# In Claude Desktop, use the tools:

# 1. Capture and analyze
"Please capture and analyze the process of logging into Gmail"

# 2. Execute optimally
"Execute the Gmail login using the optimal method"

# 3. Record session
"Record a session of checking Gmail inbox and composing an email"

# 4. Replay automation
"Replay the Gmail session we recorded earlier"
```

### Programmatic Usage

```typescript
import { CDPAutomationServer } from './mcp-server/server.js';

// Start server
const server = new CDPAutomationServer();
await server.start();

// Use tools directly
const captureTool = new CaptureAndAnalyzeTool(config, logger);
const result = await captureTool.execute({
  taskDescription: 'Login to Gmail',
  timeoutSeconds: 30,
  captureLevel: 3
});

console.log('Recommended modality:', result.recommendedModality);
```

## Configuration

### Environment Variables

```bash
# Integuru Configuration
export INTEGURU_MODEL=gpt-4o
export INTEGURU_TIMEOUT=30000
export INTEGURU_TEMP_DIR=./temp

# CDP Stealth Configuration
export CHROME_PATH=google-chrome
export CHROME_USER_DATA_DIR=./chrome-user-data

# mitmproxy Configuration
export MITMPROXY_PORT=8080
export HAR_OUTPUT_PATH=./network.har

# Logging Configuration
export LOG_LEVEL=info
export LOG_FILE=./logs/mcp-server.log
```

### Configuration File

Create `mcp-server/config.json`:

```json
{
  "integuru": {
    "model": "gpt-4o",
    "timeout": 30000,
    "tempDir": "./temp",
    "integuruDir": "./Integuru"
  },
  "cdpStealth": {
    "chromePath": "google-chrome",
    "userDataDir": "./chrome-user-data",
    "stealthFlags": [
      "--disable-blink-features=AutomationControlled",
      "--exclude-switches=enable-automation",
      "--disable-automation"
    ]
  },
  "mitmproxy": {
    "port": 8080,
    "recordAddonPath": "./.mitmproxy/record_addon.py",
    "harOutputPath": "./network.har"
  },
  "logging": {
    "level": "info",
    "file": "./logs/mcp-server.log",
    "console": true
  }
}
```

## Troubleshooting

### Common Issues

#### Server Won't Start

```bash
# Check Node.js version
node --version  # Should be 18.0+

# Check TypeScript compilation
npm run build

# Check configuration
node -e "console.log(JSON.parse(require('fs').readFileSync('config.json', 'utf8')))"
```

#### Tool Execution Fails

```typescript
// Enable debug logging
const server = new CDPAutomationServer();
server.setLogLevel('debug');

// Check tool definitions
const tools = await server.listTools();
console.log('Available tools:', tools);
```

#### Integration Issues

```bash
# Verify Claude Desktop configuration
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json

# Test MCP connection
echo '{"jsonrpc": "2.0", "method": "tools/list", "params": {}, "id": 1}' | node dist/server.js
```

## References

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)
- [Claude Desktop Integration](https://docs.anthropic.com/claude/docs/mcp)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)