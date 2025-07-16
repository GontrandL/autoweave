export interface DebuggerConfig {
  captureConsole: boolean;
  captureErrors: boolean;
  captureNetwork: boolean;
  networkErrorThreshold: number;
  maxLogSize: number;
  autoAnalyze: boolean;
}

export interface LogEntry {
  type: string;
  text: string;
  timestamp: number;
  location?: {
    url: string;
    lineNumber: number;
    columnNumber: number;
  };
  args: unknown[];
}

export interface ErrorEntry {
  name: string;
  message: string;
  stack: string;
  timestamp: number;
  url: string;
}

export interface NetworkIssue {
  url: string;
  status: number;
  statusText: string;
  timestamp: number;
  method: string;
  headers: Record<string, string>;
}

export interface FixSuggestion {
  type: 'variable_declaration' | 'null_check' | 'type_check' | 'resource_missing' | 'server_error' | 'cors_error' | 'custom';
  severity: 'error' | 'warning' | 'info';
  message: string;
  fix: string;
  location?: string;
  metadata?: Record<string, unknown>;
}

export interface DebugReport {
  timestamp: number;
  url: string;
  logs: LogEntry[];
  errors: ErrorEntry[];
  networkIssues: NetworkIssue[];
  suggestions: FixSuggestion[];
  summary: {
    totalLogs: number;
    totalErrors: number;
    totalNetworkIssues: number;
    errorTypes: Record<string, number>;
    criticalIssues: string[];
  };
}

export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface MCPCapability {
  name: string;
  version: string;
  methods: string[];
}

export interface BrowserConfig {
  headless?: boolean;
  devtools?: boolean;
  slowMo?: number;
  timeout?: number;
  viewport?: {
    width: number;
    height: number;
  };
}

export interface AutoDebugSession {
  id: string;
  startTime: number;
  endTime?: number;
  url: string;
  report?: DebugReport;
  status: 'active' | 'completed' | 'failed';
}