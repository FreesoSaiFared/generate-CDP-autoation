# MCP Tools API Reference

This document provides detailed API reference for all MCP (Model Context Protocol) tools exposed by the CDP automation server.

## Overview

The MCP server exposes four core tools for browser automation orchestration:

1. **capture-and-analyze** - Record network activity and analyze with Integuru
2. **execute-optimally** - Execute automation using optimal modality
3. **record-session** - Record complete automation sessions
4. **replay-automation** - Replay previously recorded sessions

## Tool Specifications

### 1. capture-and-analyze

Records network activity and analyzes with Integuru to determine optimal automation modality.

#### Tool Definition

```json
{
  "name": "capture-and-analyze",
  "description": "Record network activity and analyze with Integuru to determine optimal automation modality",
  "inputSchema": {
    "type": "object",
    "properties": {
      "timeoutSeconds": {
        "type": "number",
        "description": "Timeout in seconds for capture (default: 30)",
        "default": 30,
        "minimum": 5,
        "maximum": 300
      },
      "taskDescription": {
        "type": "string",
        "description": "Description of the task to analyze",
        "minLength": 10,
        "maxLength": 1000
      },
      "captureLevel": {
        "type": "number",
        "description": "Capture level (1-4, higher = more detailed)",
        "enum": [1, 2, 3, 4],
        "default": 2
      },
      "includeScreenshots": {
        "type": "boolean",
        "description": "Include screenshots in capture",
        "default": true
      },
      "targetUrl": {
        "type": "string",
        "description": "Target URL to navigate to before capture",
        "format": "uri"
      },
      "browserState": {
        "type": "object",
        "description": "Browser state to apply before capture",
        "properties": {
          "cookies": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "name": {"type": "string"},
                "value": {"type": "string"},
                "domain": {"type": "string"}
              }
            }
          },
          "localStorage": {
            "type": "object",
            "additionalProperties": {"type": "string"}
          },
          "sessionStorage": {
            "type": "object",
            "additionalProperties": {"type": "string"}
          }
        }
      }
    },
    "required": ["taskDescription"]
  }
}
```

#### Response Schema

```typescript
interface CaptureAndAnalyzeResponse {
  sessionId: string;
  harFile: string;
  integuruAnalysis: {
    confidence: number;
    complexity: {
      score: number;
      apiDepth: number;
      authenticationRequired: boolean;
      dynamicContent: boolean;
    };
    generatedCode?: string;
    apiEndpoints: Array<{
      url: string;
      method: string;
      parameters: Record<string, any>;
    }>;
  };
  recommendedModality: 'integuru' | 'headless_cdp' | 'visible_browser';
  confidence: number;
  estimatedTime: number;
  reasoning: string;
  screenshots?: string[];
}
```

#### Usage Examples

```javascript
// Basic usage
const result = await captureAndAnalyze({
  taskDescription: "Login to Gmail and check inbox"
});

// Advanced usage with all options
const result = await captureAndAnalyze({
  taskDescription: "Download generated image from KlingAI",
  timeoutSeconds: 60,
  captureLevel: 3,
  includeScreenshots: true,
  targetUrl: "https://klingai.com",
  browserState: {
    cookies: [
      {
        name: "session_token",
        value: "abc123",
        domain: "klingai.com"
      }
    ],
    localStorage: {
      user_preferences: JSON.stringify({ theme: "dark" })
    }
  }
});

console.log(`Recommended modality: ${result.recommendedModality}`);
console.log(`Confidence: ${result.confidence}`);
console.log(`Estimated time: ${result.estimatedTime} seconds`);
```

### 2. execute-optimally

Executes automation using the optimal modality (Integuru/CDP/Manual).

#### Tool Definition

```json
{
  "name": "execute-optimally",
  "description": "Execute automation using the optimal modality (Integuru/CDP/Manual)",
  "inputSchema": {
    "type": "object",
    "properties": {
      "taskDescription": {
        "type": "string",
        "description": "Description of the task to execute",
        "minLength": 10,
        "maxLength": 1000
      },
      "sessionId": {
        "type": "string",
        "description": "Session ID from previous capture-and-analyze",
        "pattern": "^[a-f0-9-]{8}-[a-f0-9-]{4}-[a-f0-9-]{4}-[a-f0-9-]{4}-[a-f0-9-]{12}$"
      },
      "harFile": {
        "type": "string",
        "description": "Path to HAR file to analyze",
        "format": "uri"
      },
      "forceModality": {
        "type": "string",
        "description": "Force specific modality",
        "enum": ["integuru", "headless_cdp", "visible_browser"]
      },
      "browserState": {
        "type": "object",
        "description": "Browser state to apply"
      },
      "integuruCode": {
        "type": "string",
        "description": "Pre-generated Integuru code to execute"
      },
      "timeout": {
        "type": "number",
        "description": "Execution timeout in seconds",
        "default": 300,
        "minimum": 30,
        "maximum": 1800
      },
      "retryPolicy": {
        "type": "object",
        "description": "Retry policy for failed executions",
        "properties": {
          "maxRetries": {
            "type": "number",
            "default": 3,
            "minimum": 0,
            "maximum": 10
          },
          "backoffMs": {
            "type": "number",
            "default": 5000,
            "minimum": 1000,
            "maximum": 60000
          }
        }
      }
    },
    "required": ["taskDescription"]
  }
}
```

#### Response Schema

```typescript
interface ExecuteOptimallyResponse {
  status: 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'REQUIRES_USER';
  modality: 'integuru' | 'headless_cdp' | 'visible_browser';
  executionTime: number;
  output?: any;
  screenshots?: string[];
  error?: string;
  details?: {
    steps: Array<{
      action: string;
      status: 'SUCCESS' | 'FAILED';
      duration: number;
      error?: string;
    }>;
    resources: {
      memoryUsed: number;
      cpuTime: number;
      networkRequests: number;
    };
  };
}
```

#### Usage Examples

```javascript
// Execute with automatic modality selection
const result = await executeOptimally({
  taskDescription: "Check Gmail inbox for new emails",
  sessionId: "abc-123-def-456"
});

// Force specific modality
const result = await executeOptimally({
  taskDescription: "Download generated image",
  forceModality: "integuru",
  integuruCode: `
import requests

def download_image(auth_token, image_id):
    headers = {"Authorization": f"Bearer {auth_token}"}
    response = requests.get(
        f"https://api.klingai.com/images/{image_id}/download",
        headers=headers
    )
    return response.content
  `
});

// Execute with custom browser state
const result = await executeOptimally({
  taskDescription: "Access authenticated dashboard",
  browserState: {
    cookies: [
      {
        name: "auth_token",
        value: "eyJhbGciOiJIUzI1NiIs...",
        domain: "example.com"
      }
    ]
  },
  timeout: 120
});
```

### 3. record-session

Records complete automation session for replay.

#### Tool Definition

```json
{
  "name": "record-session",
  "description": "Record complete automation session for replay",
  "inputSchema": {
    "type": "object",
    "properties": {
      "taskDescription": {
        "type": "string",
        "description": "Description of the task being recorded",
        "minLength": 10,
        "maxLength": 1000
      },
      "sessionId": {
        "type": "string",
        "description": "Session ID (auto-generated if not provided)",
        "pattern": "^[a-f0-9-]{8}-[a-f0-9-]{4}-[a-f0-9-]{4}-[a-f0-9-]{4}-[a-f0-9-]{12}$"
      },
      "captureLevel": {
        "type": "number",
        "description": "Capture level (1-4, higher = more detailed)",
        "enum": [1, 2, 3, 4],
        "default": 3
      },
      "includeScreenshots": {
        "type": "boolean",
        "description": "Include screenshots in recording",
        "default": true
      },
      "autoStop": {
        "type": "boolean",
        "description": "Automatically stop recording on inactivity",
        "default": true
      },
      "timeoutMinutes": {
        "type": "number",
        "description": "Maximum recording time in minutes",
        "default": 30,
        "minimum": 5,
        "maximum": 180
      },
      "inactivityTimeoutSeconds": {
        "type": "number",
        "description": "Inactivity timeout in seconds",
        "default": 120,
        "minimum": 30,
        "maximum": 600
      },
      "captureNetwork": {
        "type": "boolean",
        "description": "Capture network activity",
        "default": true
      },
      "captureConsole": {
        "type": "boolean",
        "description": "Capture console output",
        "default": true
      }
    },
    "required": ["taskDescription"]
  }
}
```

#### Response Schema

```typescript
interface RecordSessionResponse {
  sessionId: string;
  status: 'RECORDING' | 'COMPLETED' | 'STOPPED' | 'ERROR';
  duration: number;
  actionCount: number;
  screenshotCount: number;
  networkEventCount: number;
  consoleEntryCount: number;
  sessionPath: string;
  metadata: {
    startTime: string;
    endTime?: string;
    taskDescription: string;
    captureLevel: number;
    browserInfo: {
      userAgent: string;
      viewport: {
        width: number;
        height: number;
      };
    };
  };
}
```

#### Usage Examples

```javascript
// Start recording session
const result = await recordSession({
  taskDescription: "Complete Gmail login and check inbox",
  captureLevel: 3,
  includeScreenshots: true,
  timeoutMinutes: 15
});

console.log(`Recording started: ${result.sessionId}`);
console.log(`Session path: ${result.sessionPath}`);

// Monitor recording progress
const checkProgress = async (sessionId) => {
  const status = await getRecordingStatus(sessionId);
  console.log(`Actions recorded: ${status.actionCount}`);
  console.log(`Duration: ${status.duration}s`);
};

// Stop recording manually
const stopResult = await stopRecording(sessionId);
console.log(`Recording completed: ${stopResult.status}`);
```

### 4. replay-automation

Replays a previously recorded automation session.

#### Tool Definition

```json
{
  "name": "replay-automation",
  "description": "Replay a previously recorded automation session",
  "inputSchema": {
    "type": "object",
    "properties": {
      "sessionId": {
        "type": "string",
        "description": "Session ID to replay",
        "pattern": "^[a-f0-9-]{8}-[a-f0-9-]{4}-[a-f0-9-]{4}-[a-f0-9-]{4}-[a-f0-9-]{12}$"
      },
      "actionIndex": {
        "type": "number",
        "description": "Specific action index to replay (optional)",
        "minimum": 0
      },
      "speedMultiplier": {
        "type": "number",
        "description": "Speed multiplier for replay (1.0 = normal speed)",
        "default": 1.0,
        "minimum": 0.1,
        "maximum": 5.0
      },
      "skipScreenshots": {
        "type": "boolean",
        "description": "Skip screenshots during replay",
        "default": false
      },
      "dryRun": {
        "type": "boolean",
        "description": "Dry run without executing actions",
        "default": false
      },
      "pauseOnError": {
        "type": "boolean",
        "description": "Pause execution on error",
        "default": true
      },
      "overrideParameters": {
        "type": "object",
        "description": "Override parameters for specific actions",
        "additionalProperties": {
          "type": "object"
        }
      }
    },
    "required": ["sessionId"]
  }
}
```

#### Response Schema

```typescript
interface ReplayAutomationResponse {
  sessionId: string;
  status: 'COMPLETED' | 'FAILED' | 'PAUSED' | 'CANCELLED';
  duration: number;
  actionsReplayed: number;
  successCount: number;
  failureCount: number;
  results: Array<{
    action: RecordedAction;
    success: boolean;
    executionTime: number;
    screenshot?: string;
    error?: string;
  }>;
  summary: {
    totalActions: number;
    successRate: number;
    averageExecutionTime: number;
    errors: Array<{
      actionIndex: number;
      error: string;
      timestamp: string;
    }>;
  };
}
```

#### Usage Examples

```javascript
// Replay entire session
const result = await replayAutomation({
  sessionId: "abc-123-def-456-ghi-789-jkl012"
});

// Replay with speed multiplier
const result = await replayAutomation({
  sessionId: "abc-123-def-456-ghi-789-jkl012",
  speedMultiplier: 2.0
});

// Replay specific action
const result = await replayAutomation({
  sessionId: "abc-123-def-456-ghi-789-jkl012",
  actionIndex: 5
});

// Dry run to validate actions
const result = await replayAutomation({
  sessionId: "abc-123-def-456-ghi-789-jkl012",
  dryRun: true
});

// Replay with parameter overrides
const result = await replayAutomation({
  sessionId: "abc-123-def-456-ghi-789-jkl012",
  overrideParameters: {
    "action-3": {
      "username": "new-user@example.com",
      "password": "new-password"
    }
  }
});
```

## Advanced Features

### Session Management

#### List Sessions

```javascript
const sessions = await listSessions({
  limit: 10,
  offset: 0,
  filter: {
    taskDescription: "gmail",
    dateRange: {
      start: "2025-01-01",
      end: "2025-01-31"
    }
  }
});
```

#### Delete Session

```javascript
const result = await deleteSession("abc-123-def-456-ghi-789-jkl012");
```

#### Export Session

```javascript
const exportData = await exportSession("abc-123-def-456-ghi-789-jkl012", {
  format: "json",
  includeScreenshots: true,
  includeNetworkData: true
});
```

### Batch Operations

#### Batch Execute

```javascript
const results = await batchExecute([
  {
    tool: "execute-optimally",
    parameters: {
      taskDescription: "Check Gmail inbox",
      sessionId: "session-1"
    }
  },
  {
    tool: "execute-optimally",
    parameters: {
      taskDescription: "Compose email",
      sessionId: "session-2"
    }
  }
]);
```

#### Parallel Execution

```javascript
const results = await parallelExecute([
  {
    tool: "capture-and-analyze",
    parameters: {
      taskDescription: "Analyze login flow",
      targetUrl: "https://gmail.com"
    }
  },
  {
    tool: "capture-and-analyze",
    parameters: {
      taskDescription: "Analyze checkout flow",
      targetUrl: "https://example.com/checkout"
    }
  }
], {
  maxConcurrency: 3,
  timeout: 300
});
```

## Error Handling

### Error Types

```typescript
interface MCPError {
  code: ErrorCode;
  message: string;
  details?: any;
  tool?: string;
  timestamp: string;
}

enum ErrorCode {
  // General errors
  InvalidParams = -32602,
  InternalError = -32603,
  Timeout = -32604,
  
  // Tool-specific errors
  BrowserLaunchFailed = -32001,
  ExtensionNotFound = -32002,
  InteguruAnalysisFailed = -32003,
  SessionNotFound = -32004,
  ReplayFailed = -32005,
  
  // Network errors
  NetworkCaptureFailed = -32101,
  HarFileInvalid = -32102,
  ProxyConnectionFailed = -32103,
  
  // Resource errors
  InsufficientMemory = -32201,
  DiskSpaceExhausted = -32202,
  CpuLimitExceeded = -32203
}
```

### Error Response Format

```json
{
  "content": [
    {
      "type": "text",
      "text": JSON.stringify({
        "success": false,
        "error": {
          "code": -32001,
          "message": "Browser launch failed: Chrome executable not found",
          "details": {
            "executablePath": "/usr/bin/google-chrome",
            "error": "ENOENT"
          },
          "tool": "execute-optimally",
          "timestamp": "2025-01-19T10:30:00Z"
        }
      })
    }
  ]
}
```

### Retry Logic

```javascript
const executeWithRetry = async (tool, parameters, maxRetries = 3) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await executeTool(tool, parameters);
      return result;
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt - 1) * 1000; // Exponential backoff
        console.log(`Attempt ${attempt} failed, retrying in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }
  
  throw lastError;
};
```

## Performance Optimization

### Caching

```javascript
// Enable result caching
const cachedResult = await getCachedResult(cacheKey, {
  ttl: 3600, // 1 hour
  maxSize: 100 // Max cache entries
});

if (cachedResult) {
  return cachedResult;
}

const result = await executeTool(tool, parameters);
await setCachedResult(cacheKey, result);
```

### Resource Pooling

```javascript
// Configure browser pool
const poolConfig = {
  maxBrowsers: 5,
  minBrowsers: 1,
  idleTimeoutMs: 300000, // 5 minutes
  launchTimeoutMs: 30000
};

const pool = new BrowserPool(poolConfig);
const browser = await pool.acquire();
```

## Monitoring & Analytics

### Usage Metrics

```typescript
interface ToolMetrics {
  toolName: string;
  executionCount: number;
  successCount: number;
  failureCount: number;
  averageExecutionTime: number;
  lastExecutionTime: string;
  errorRate: number;
}
```

### Performance Metrics

```typescript
interface PerformanceMetrics {
  timestamp: string;
  system: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
  };
  tools: {
    activeExecutions: number;
    queuedRequests: number;
    averageResponseTime: number;
  };
  errors: {
    totalErrors: number;
    errorsByTool: Record<string, number>;
    errorsByCode: Record<number, number>;
  };
}
```

## Security & Authentication

### API Authentication

```javascript
// Configure authentication
const authConfig = {
  type: 'bearer',
  token: process.env.MCP_API_TOKEN,
  expiresIn: 3600
};

const client = new MCPClient({
  serverUrl: 'http://localhost:8080',
  authentication: authConfig
});
```

### Rate Limiting

```typescript
interface RateLimitConfig {
  requestsPerSecond: number;
  burstLimit: number;
  windowSizeMs: number;
}

const rateLimits = {
  'capture-and-analyze': {
    requestsPerSecond: 1,
    burstLimit: 5,
    windowSizeMs: 60000
  },
  'execute-optimally': {
    requestsPerSecond: 2,
    burstLimit: 10,
    windowSizeMs: 60000
  }
};
```

## SDK Integration

### JavaScript SDK

```bash
npm install cdp-automation-mcp-sdk
```

```javascript
import { MCPClient } from 'cdp-automation-mcp-sdk';

const client = new MCPClient({
  serverUrl: 'http://localhost:8080',
  timeout: 30000
});

// Execute tool
const result = await client.executeTool('capture-and-analyze', {
  taskDescription: 'Analyze login flow'
});

// Listen for events
client.on('tool-executed', (event) => {
  console.log(`Tool ${event.tool} executed in ${event.duration}ms`);
});
```

### Python SDK

```bash
pip install cdp-automation-mcp-python
```

```python
from cdp_automation_mcp import MCPClient

client = MCPClient(
    server_url='http://localhost:8080',
    timeout=30
)

# Execute tool
result = await client.execute_tool('capture-and-analyze', {
    'task_description': 'Analyze login flow'
})

# Listen for events
@client.on('tool_executed')
def handle_tool_executed(event):
    print(f"Tool {event.tool} executed in {event.duration}ms")
```

## Testing

### Tool Testing Framework

```javascript
import { MCPTestSuite } from 'cdp-automation-mcp-test';

const testSuite = new MCPTestSuite({
  serverUrl: 'http://localhost:8080'
});

// Test tool execution
testSuite.test('capture-and-analyze', {
  taskDescription: 'Test task',
  timeoutSeconds: 30
}, {
  expectedStatus: 'SUCCESS',
  expectedFields: ['sessionId', 'recommendedModality'],
  timeout: 60000
});

// Run all tests
const results = await testSuite.run();
console.log(`Tests passed: ${results.passed}/${results.total}`);
```

## References

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)
- [Tool Implementation Guide](../mcp-server.md)
- [Error Handling Best Practices](../troubleshooting.md#error-handling)
- [Performance Optimization](../performance-optimization.md)