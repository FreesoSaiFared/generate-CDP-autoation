/**
 * Core types for the CDP Integuru MCP Server
 */

export interface ServerConfig {
  port?: number;
  host?: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  integuru: {
    model: string;
    timeout: number;
    tempDir: string;
    integuruDir: string;
  };
  mitmproxy: {
    port: number;
    host: string;
    harOutput: string;
  };
  chrome: {
    headless: boolean;
    userDataDir: string;
    extensions: string[];
  };
  sessions: {
    storageDir: string;
    maxAge: number;
  };
}

export interface BrowserState {
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires?: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'Strict' | 'Lax' | 'None';
  }>;
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  indexedDB?: any;
  screenshot?: string;
  url?: string;
  title?: string;
  userAgent?: string;
}

export interface NetworkCapture {
  sessionId: string;
  harFile: string;
  startTime: Date;
  endTime: Date;
  requestCount: number;
  domains: string[];
  size: number;
}

export interface InteguruAnalysis {
  success: boolean;
  confidence: number;
  code?: string;
  analysis: string;
  recommendations: string[];
  apiEndpoints: Array<{
    url: string;
    method: string;
    description: string;
  }>;
  estimatedTime: number;
}

export interface ModalityChoice {
  modality: 'integuru' | 'headless_cdp' | 'visible_browser';
  confidence: number;
  estimatedTimeSeconds: number;
  reasoning: string;
  metadata: {
    [key: string]: any;
  };
}

export interface ExecutionResult {
  success: boolean;
  modality: string;
  executionTime: number;
  output?: any;
  error?: string;
  screenshots?: string[];
  logs?: string[];
  metadata: {
    [key: string]: any;
  };
}

export interface SessionRecording {
  sessionId: string;
  task: string;
  startTime: Date;
  endTime?: Date;
  modalityUsed?: string;
  networkCapture?: NetworkCapture;
  browserState?: BrowserState;
  integuruAnalysis?: InteguruAnalysis;
  executionResult?: ExecutionResult;
  initialBrowserState?: BrowserState;
  finalBrowserState?: BrowserState;
  screenshots: Array<{
    timestamp: Date;
    data: string;
    actionIndex: number;
  }>;
  actions: Array<{
    timestamp: Date;
    type: 'CDP_COMMAND' | 'WAIT' | 'SCREENSHOT_ANALYSIS' | 'NAVIGATION' | 'CONSOLE_LOG' | 'PAGE_ERROR' | 'REQUEST' | 'RESPONSE' | 'CDP_CONSOLE';
    method?: string;
    params?: any;
    response?: any;
    screenshot?: string;
    duration?: number;
    success?: boolean;
    error?: string;
    data?: any;
  }>;
  metadata: {
    [key: string]: any;
  };
}

export interface ToolCall {
  name: string;
  arguments: {
    [key: string]: any;
  };
}

export interface ToolResponse {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: {
      [key: string]: {
        type: string;
        description?: string;
        enum?: string[];
        items?: any;
        properties?: any;
        required?: string[];
      };
    };
    required?: string[];
  };
}

// Tool-specific input types
export interface CaptureAndAnalyzeInput {
  timeoutSeconds?: number;
  taskDescription?: string;
  captureLevel?: 1 | 2 | 3 | 4;
  includeScreenshots?: boolean;
}

export interface ExecuteOptimallyInput {
  taskDescription: string;
  sessionId?: string;
  harFile?: string;
  forceModality?: 'integuru' | 'headless_cdp' | 'visible_browser';
  browserState?: BrowserState;
}

export interface RecordSessionInput {
  taskDescription: string;
  sessionId?: string;
  captureLevel?: 1 | 2 | 3 | 4;
  includeScreenshots?: boolean;
  autoStop?: boolean;
  timeoutMinutes?: number;
}

export interface ReplayAutomationInput {
  sessionId: string;
  actionIndex?: number;
  speedMultiplier?: number;
  skipScreenshots?: boolean;
  dryRun?: boolean;
}

// Error types
export class MCPError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

export class SessionNotFoundError extends MCPError {
  constructor(sessionId: string) {
    super(`Session not found: ${sessionId}`, 'SESSION_NOT_FOUND', { sessionId });
  }
}

export class ModalityExecutionError extends MCPError {
  constructor(modality: string, error: string) {
    super(`Execution failed for modality ${modality}: ${error}`, 'MODALITY_EXECUTION_ERROR', { modality, error });
  }
}

export class InteguruError extends MCPError {
  constructor(message: string, details?: any) {
    super(`Integuru error: ${message}`, 'INTEGURU_ERROR', details);
  }
}

export class MitmproxyError extends MCPError {
  constructor(message: string, details?: any) {
    super(`Mitmproxy error: ${message}`, 'MITMPROXY_ERROR', details);
  }
}

// Event types
export interface ServerEvent {
  type: 'session_started' | 'session_completed' | 'tool_called' | 'error' | 'modality_selected';
  timestamp: Date;
  data: any;
}

export interface SessionEvent {
  sessionId: string;
  type: 'started' | 'captured' | 'analyzed' | 'executed' | 'completed' | 'error';
  timestamp: Date;
  data: any;
}

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;