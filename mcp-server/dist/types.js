"use strict";
/**
 * Core types for the CDP Integuru MCP Server
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MitmproxyError = exports.InteguruError = exports.ModalityExecutionError = exports.SessionNotFoundError = exports.MCPError = void 0;
// Error types
class MCPError extends Error {
    code;
    details;
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'MCPError';
    }
}
exports.MCPError = MCPError;
class SessionNotFoundError extends MCPError {
    constructor(sessionId) {
        super(`Session not found: ${sessionId}`, 'SESSION_NOT_FOUND', { sessionId });
    }
}
exports.SessionNotFoundError = SessionNotFoundError;
class ModalityExecutionError extends MCPError {
    constructor(modality, error) {
        super(`Execution failed for modality ${modality}: ${error}`, 'MODALITY_EXECUTION_ERROR', { modality, error });
    }
}
exports.ModalityExecutionError = ModalityExecutionError;
class InteguruError extends MCPError {
    constructor(message, details) {
        super(`Integuru error: ${message}`, 'INTEGURU_ERROR', details);
    }
}
exports.InteguruError = InteguruError;
class MitmproxyError extends MCPError {
    constructor(message, details) {
        super(`Mitmproxy error: ${message}`, 'MITMPROXY_ERROR', details);
    }
}
exports.MitmproxyError = MitmproxyError;
//# sourceMappingURL=types.js.map