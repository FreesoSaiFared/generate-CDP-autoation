# API Documentation

This section provides comprehensive API documentation for all components of the CDP automation system, including MCP tools, JavaScript APIs, and TypeScript definitions.

## API Overview

The CDP automation system exposes multiple APIs:

- **MCP Server API** - Model Context Protocol tools for Claude integration
- **JavaScript API** - Browser automation and stealth functionality
- **Extension API** - Chrome extension communication interfaces
- **Python API** - Integuru integration and code execution
- **TypeScript Definitions** - Type definitions for all interfaces

## Quick Reference

| API | Purpose | Location |
|------|-----------|----------|
| [MCP Tools](mcp-tools.md) | Claude integration tools | `mcp-server/tools/` |
| [JavaScript API](javascript-api.md) | Browser automation | `cdp-stealth/src/` |
| [TypeScript Types](typescript-types.md) | Type definitions | `mcp-server/types/` |
| [Extension API](../cdp-extension.md#api-reference) | Extension communication | `extensions/cdp-stealth/` |
| [Python API](../integuru-integration.md#api-reference) | Integuru integration | `Integuru/` |

## MCP Server API

The MCP server exposes four core tools for automation orchestration:

### Core Tools

1. **capture-and-analyze** - Record network activity and analyze with Integuru
2. **execute-optimally** - Execute automation using optimal modality
3. **record-session** - Record complete automation sessions
4. **replay-automation** - Replay recorded sessions

### Tool Response Format

```typescript
interface ToolResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}
```

### Error Handling

```typescript
interface MCPError {
  code: ErrorCode;
  message: string;
  data?: any;
}

enum ErrorCode {
  MethodNotFound = -32601;
  InvalidParams = -32602;
  InternalError = -32603;
}
```

## JavaScript API

### Core Classes

#### StealthBrowser

```javascript
const { launchStealthBrowser } = require('./cdp-stealth/src/index.js');

// Launch browser with stealth configuration
const browser = await launchStealthBrowser({
  headless: false,
  proxy: 'http://127.0.0.1:8080',
  userAgent: 'Custom User Agent'
});
```

#### StealthPage

```javascript
// Create enhanced page with stealth features
const page = await browser.newPage();

// Human-like interactions
await page.stealth.humanType('input[name="email"]', 'user@example.com');
await page.stealth.humanClick('button[type="submit"]');

// Human-like waiting
await page.stealth.waitHumanTime(100, 300);
```

### Configuration Options

```typescript
interface LaunchOptions {
  headless?: boolean;
  proxy?: string;
  userAgent?: string;
  windowSize?: string;
  stealth?: StealthConfig;
}

interface StealthConfig {
  runtimePatchingMode?: 'addBinding' | 'alwaysIsolated' | 'enableDisable';
  randomizeUserAgent?: boolean;
  emulateDevice?: 'desktop' | 'mobile' | 'tablet';
}
```

## Extension API

### Background Script Commands

```javascript
// Send command to background script
chrome.runtime.sendMessage({
  action: 'attachDebugger',
  tabId: tabId
}, response => {
  console.log('Response:', response);
});
```

### Content Script API

```javascript
// Page script API
window.CDPStealthAPI.getElementInfo('#username');
window.CDPStealthAPI.setFormValues('#login-form', {
  username: 'user@example.com',
  password: 'secret'
});
```

## Python API

### Integuru Integration

```python
from integuru import call_agent

# Analyze HAR file
result = await call_agent(
    model='gpt-4o',
    prompt='Download generated image',
    har_file_path='./network.har',
    to_generate_code=True
)
```

### Code Execution

```python
from integuru.util.LLM import llm

# Execute generated code
execution_result = await llm.execute_code(
    code=generated_code,
    timeout=30,
    max_memory='256m'
)
```

## Type Definitions

### Core Interfaces

```typescript
// Browser configuration
interface BrowserConfig {
  executable: string;
  args: string[];
  userDataDir: string;
  stealthFlags: string[];
}

// Session data
interface SessionData {
  sessionId: string;
  timestamp: string;
  actions: RecordedAction[];
  screenshots: Screenshot[];
  networkEvents: NetworkEvent[];
}

// Modality choice
interface ModalityChoice {
  modality: 'integuru' | 'headless_cdp' | 'visible_browser';
  confidence: number;
  estimatedTimeSeconds: number;
  reasoning: string;
}
```

## Authentication & Security

### API Keys

```bash
# OpenAI API for Integuru
export OPENAI_API_KEY=your_openai_api_key

# Claude API for MCP integration
export CLAUDE_API_KEY=your_claude_api_key
```

### Security Headers

```javascript
// Add security headers to requests
const headers = {
  'Authorization': `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
  'X-Custom-Security': 'cdp-automation-v1'
};
```

## Error Handling

### Common Error Codes

| Code | Description | Solution |
|-------|-------------|----------|
| 1001 | Browser launch failed | Check Chrome installation and flags |
| 1002 | Extension not loaded | Verify extension installation |
| 1003 | Runtime patching failed | Check REBROWSER_PATCHES_RUNTIME_FIX_MODE |
| 2001 | HAR file invalid | Validate HAR format |
| 2002 | Integuru analysis failed | Check OpenAI API key and model |
| 3001 | MCP server error | Check server logs and configuration |

### Error Response Format

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: number;
    message: string;
    details?: any;
    timestamp: string;
  };
}
```

## Rate Limiting

### API Limits

| API | Rate Limit | Burst Limit |
|------|-------------|-------------|
| MCP Tools | 100 requests/hour | 10 requests/minute |
| Integuru Analysis | 50 requests/hour | 5 requests/minute |
| Code Execution | 200 executions/hour | 20 executions/minute |

### Rate Limit Headers

```javascript
// Check rate limit status
const rateLimitHeaders = {
  'X-RateLimit-Limit': '100',
  'X-RateLimit-Remaining': '95',
  'X-RateLimit-Reset': '1640995200'
};
```

## Versioning

### API Versioning

The API follows semantic versioning:

- **Major (X.0.0)** - Breaking changes
- **Minor (X.Y.0)** - New features, backward compatible
- **Patch (X.Y.Z)** - Bug fixes, backward compatible

### Version Detection

```javascript
// Get API version
const response = await fetch('/api/version');
const { version } = await response.json();

console.log(`API Version: ${version}`);
// Expected: "1.0.0"
```

## SDKs & Libraries

### JavaScript SDK

```bash
npm install cdp-automation-sdk
```

```javascript
import { CDPAutomation } from 'cdp-automation-sdk';

const automation = new CDPAutomation({
  apiKey: 'your-api-key',
  serverUrl: 'http://localhost:8080'
});

await automation.captureAndAnalyze({
  taskDescription: 'Login to Gmail',
  timeoutSeconds: 30
});
```

### Python SDK

```bash
pip install cdp-automation-python
```

```python
from cdp_automation import CDPAutomation

automation = CDPAutomation(
    api_key='your-api-key',
    server_url='http://localhost:8080'
)

result = await automation.capture_and_analyze(
    task_description='Login to Gmail',
    timeout_seconds=30
)
```

### TypeScript SDK

```bash
npm install cdp-automation-types
```

```typescript
import { CDPAutomation, CaptureAndAnalyzeInput } from 'cdp-automation-types';

const automation: CDPAutomation = new CDPAutomation(config);

const input: CaptureAndAnalyzeInput = {
  taskDescription: 'Login to Gmail',
  timeoutSeconds: 30
};

const result = await automation.captureAndAnalyze(input);
```

## Webhooks

### Configuration

```typescript
interface WebhookConfig {
  url: string;
  events: string[];
  secret: string;
  retryPolicy: {
    maxRetries: number;
    backoffMs: number;
  };
}
```

### Event Types

- `session.started` - Session recording started
- `session.completed` - Session recording completed
- `automation.started` - Automation execution started
- `automation.completed` - Automation execution completed
- `error.occurred` - Error occurred during operation

### Webhook Payload

```json
{
  "event": "session.completed",
  "timestamp": "2025-01-19T10:30:00Z",
  "data": {
    "sessionId": "abc-123",
    "duration": 45.2,
    "actionCount": 12,
    "status": "success"
  },
  "signature": "sha256=abc123..."
}
```

## Testing

### API Testing Tools

#### Postman Collection

Import the provided Postman collection for API testing:

```bash
# Import collection
postman collection import cdp-automation-api.postman_collection.json

# Set environment variables
postman environment set cdp-automation-api-env.json
```

#### curl Examples

```bash
# Test MCP server
curl -X POST http://localhost:8080/tools/capture-and-analyze \
  -H "Content-Type: application/json" \
  -d '{"taskDescription": "Test automation", "timeoutSeconds": 30}'

# Test JavaScript API
node -e "
const { launchStealthBrowser } = require('./cdp-stealth/src/index.js');
launchStealthBrowser().then(browser => console.log('Browser launched:', browser.process().pid));
"
```

## Monitoring & Analytics

### Usage Metrics

```typescript
interface UsageMetrics {
  timestamp: string;
  requests: {
    total: number;
    successful: number;
    failed: number;
  };
  performance: {
    averageResponseTime: number;
    p95ResponseTime: number;
    errorRate: number;
  };
  resources: {
    cpuUsage: number;
    memoryUsage: number;
    activeConnections: number;
  };
}
```

### Health Check Endpoint

```bash
# Check API health
curl http://localhost:8080/health

# Expected response
{
  "status": "healthy",
  "timestamp": "2025-01-19T10:30:00Z",
  "version": "1.0.0",
  "uptime": 3600
}
```

## Support & Resources

### API Documentation

- **[MCP Tools API](mcp-tools.md)** - Detailed MCP tool documentation
- **[JavaScript API Reference](javascript-api.md)** - Complete JavaScript API
- **[TypeScript Definitions](typescript-types.md)** - All TypeScript interfaces
- **[Extension API](../cdp-extension.md#api-reference)** - Extension communication

### Code Examples

- **[Basic Usage Examples](../quick-start.md#basic-usage)** - Getting started examples
- **[Advanced Examples](../advanced-usage.md)** - Complex scenarios
- **[Integration Examples](../integuru-integration.md#usage-examples)** - Integuru integration

### Troubleshooting

- **[API Troubleshooting](../troubleshooting.md#api-issues)** - Common API issues
- **[Debug Guide](../debugging.md)** - Debugging infrastructure
- **[Error Reference](../troubleshooting.md#error-codes)** - Complete error reference

## Changelog

### v1.0.0 (2025-01-19)

- Initial API release
- MCP server with 4 core tools
- JavaScript automation API
- Extension communication API
- Integuru integration API
- Complete TypeScript definitions

### Upcoming Features

- WebSocket API for real-time updates
- GraphQL API endpoint
- Enhanced webhook system
- Advanced analytics dashboard

---

**API Version**: 1.0.0  
**Last Updated**: 2025-01-19  
**Compatibility**: Node.js 18+, Python 3.8+, Chrome 143+