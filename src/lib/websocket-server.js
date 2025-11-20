/**
 * WebSocket Server Integration for Live Dashboard Updates
 * 
 * This module provides WebSocket server functionality for real-time
 * communication between the debugging infrastructure and the monitoring dashboard.
 * 
 * Features:
 * - WebSocket server for real-time updates
 * - Client connection management
 * - Message routing and broadcasting
 * - Authentication and security
 * - Connection health monitoring
 * - Data streaming and throttling
 * - Integration with all debugging components
 */

const WebSocket = require('ws');
const http = require('http');
const EventEmitter = require('events');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

class WebSocketServer extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = {
            port: options.port || 3002,
            host: options.host || 'localhost',
            enableAuth: options.enableAuth || false,
            jwtSecret: options.jwtSecret || process.env.WS_JWT_SECRET || 'default-secret-key',
            maxConnections: options.maxConnections || 100,
            heartbeatInterval: options.heartbeatInterval || 30000, // 30 seconds
            messageQueueSize: options.messageQueueSize || 1000,
            enableCompression: options.enableCompression !== false,
            rateLimiting: {
                enabled: options.rateLimiting?.enabled !== false,
                windowMs: options.rateLimiting?.windowMs || 60000, // 1 minute
                maxMessages: options.rateLimiting?.maxMessages || 100
            }
        };
        
        // Server state
        this.wss = null;
        this.httpServer = null;
        this.clients = new Map();
        this.messageQueue = [];
        this.isRunning = false;
        this.stats = {
            totalConnections: 0,
            activeConnections: 0,
            messagesSent: 0,
            messagesReceived: 0,
            errors: 0,
            startTime: null
        };
        
        // Rate limiting
        this.rateLimitMap = new Map();
        
        // Message handlers
        this.messageHandlers = new Map();
        
        // Initialize default message handlers
        this.initializeDefaultHandlers();
    }

    /**
     * Start WebSocket server
     * 
     * @param {Object} options - Start options
     * @returns {Promise<void>}
     */
    async start(options = {}) {
        if (this.isRunning) {
            throw new Error('WebSocket server is already running');
        }
        
        try {
            // Create HTTP server for WebSocket upgrade
            this.httpServer = http.createServer();
            
            // Create WebSocket server
            this.wss = new WebSocket.Server({
                server: this.httpServer,
                perMessageDeflate: this.config.enableCompression,
                maxPayload: 1024 * 1024, // 1MB
                verifyClient: this.config.enableAuth ? this.verifyClient.bind(this) : null
            });
            
            // Set up WebSocket event handlers
            this.setupWebSocketHandlers();
            
            // Start listening
            await new Promise((resolve, reject) => {
                this.httpServer.listen(this.config.port, this.config.host, (error) => {
                    if (error) {
                        reject(error);
                    } else {
                        this.isRunning = true;
                        this.stats.startTime = new Date().toISOString();
                        
                        this.emit('server:started', {
                            port: this.config.port,
                            host: this.config.host,
                            url: `ws://${this.config.host}:${this.config.port}`
                        });
                        
                        console.log(`WebSocket server started on ws://${this.config.host}:${this.config.port}`);
                        resolve();
                    }
                });
            });
            
        } catch (error) {
            this.emit('server:error', { type: 'start', error });
            throw new Error(`Failed to start WebSocket server: ${error.message}`);
        }
    }

    /**
     * Stop WebSocket server
     * 
     * @returns {Promise<void>}
     */
    async stop() {
        if (!this.isRunning) {
            return;
        }
        
        try {
            // Close all client connections
            for (const [clientId, client] of this.clients.entries()) {
                this.disconnectClient(clientId, 'Server shutting down');
            }
            
            // Close WebSocket server
            if (this.wss) {
                this.wss.close();
            }
            
            // Close HTTP server
            if (this.httpServer) {
                await new Promise((resolve) => {
                    this.httpServer.close(resolve);
                });
            }
            
            this.isRunning = false;
            this.emit('server:stopped', { stats: this.getStats() });
            console.log('WebSocket server stopped');
            
        } catch (error) {
            this.emit('server:error', { type: 'stop', error });
            throw new Error(`Failed to stop WebSocket server: ${error.message}`);
        }
    }

    /**
     * Register message handler
     * 
     * @param {string} type - Message type
     * @param {Function} handler - Handler function
     */
    registerHandler(type, handler) {
        this.messageHandlers.set(type, handler);
    }

    /**
     * Unregister message handler
     * 
     * @param {string} type - Message type
     */
    unregisterHandler(type) {
        this.messageHandlers.delete(type);
    }

    /**
     * Broadcast message to all clients
     * 
     * @param {Object} message - Message to broadcast
     * @param {Object} options - Broadcast options
     */
    broadcast(message, options = {}) {
        if (!this.isRunning) {
            return;
        }
        
        const {
            excludeClients = [],
            includeClients = null,
            type = 'broadcast'
        } = options;
        
        const messageData = {
            type,
            timestamp: new Date().toISOString(),
            data: message,
            id: this.generateMessageId()
        };
        
        let sentCount = 0;
        
        for (const [clientId, client] of this.clients.entries()) {
            // Check if client should receive this message
            if (excludeClients.includes(clientId)) {
                continue;
            }
            
            if (includeClients && !includeClients.includes(clientId)) {
                continue;
            }
            
            // Check rate limiting
            if (this.isRateLimited(clientId)) {
                continue;
            }
            
            // Send message to client
            if (this.sendMessage(clientId, messageData)) {
                sentCount++;
            }
        }
        
        this.stats.messagesSent += sentCount;
        this.emit('message:broadcast', { message: messageData, sentCount });
    }

    /**
     * Send message to specific client
     * 
     * @param {string} clientId - Client ID
     * @param {Object} message - Message to send
     * @returns {boolean} Success status
     */
    sendToClient(clientId, message) {
        const client = this.clients.get(clientId);
        if (!client || client.readyState !== WebSocket.OPEN) {
            return false;
        }
        
        const messageData = {
            type: 'direct',
            timestamp: new Date().toISOString(),
            data: message,
            id: this.generateMessageId()
        };
        
        return this.sendMessage(clientId, messageData);
    }

    /**
     * Get server statistics
     * 
     * @returns {Object} Server statistics
     */
    getStats() {
        return {
            ...this.stats,
            uptime: this.stats.startTime ? 
                Date.now() - new Date(this.stats.startTime).getTime() : 0,
            activeConnections: this.clients.size,
            messageQueueSize: this.messageQueue.length,
            rateLimitActive: this.rateLimitMap.size
        };
    }

    /**
     * Get client information
     * 
     * @param {string} clientId - Client ID
     * @returns {Object|null>} Client information
     */
    getClientInfo(clientId) {
        const client = this.clients.get(clientId);
        if (!client) {
            return null;
        }
        
        return {
            id: clientId,
            connectedAt: client.connectedAt,
            lastActivity: client.lastActivity,
            messageCount: client.messageCount,
            authenticated: client.authenticated,
            userAgent: client.userAgent,
            ip: client.ip,
            readyState: client.readyState
        };
    }

    /**
     * Get all connected clients
     * 
     * @returns {Array>} Array of client information
     */
    getAllClients() {
        const clients = [];
        
        for (const [clientId, client] of this.clients.entries()) {
            clients.push(this.getClientInfo(clientId));
        }
        
        return clients;
    }

    /**
     * Disconnect specific client
     * 
     * @param {string} clientId - Client ID
     * @param {string} reason - Disconnect reason
     */
    disconnectClient(clientId, reason = 'Disconnected') {
        const client = this.clients.get(clientId);
        if (client) {
            client.terminateReason = reason;
            client.readyState = WebSocket.CLOSING;
            
            if (client.readyState === WebSocket.OPEN) {
                client.close(1000, reason);
            }
            
            this.clients.delete(clientId);
            this.stats.activeConnections = this.clients.size;
            
            this.emit('client:disconnected', { clientId, reason });
        }
    }

    // Private helper methods

    setupWebSocketHandlers() {
        this.wss.on('connection', this.handleConnection.bind(this));
        this.wss.on('error', this.handleServerError.bind(this));
        
        // Start heartbeat interval
        if (this.config.heartbeatInterval > 0) {
            setInterval(() => {
                this.sendHeartbeat();
            }, this.config.heartbeatInterval);
        }
        
        // Clean up rate limiting map periodically
        setInterval(() => {
            this.cleanupRateLimiting();
        }, this.config.rateLimiting.windowMs);
    }

    handleConnection(ws, request) {
        const clientId = this.generateClientId();
        
        // Check connection limit
        if (this.clients.size >= this.config.maxConnections) {
            ws.close(1013, 'Server connection limit exceeded');
            return;
        }
        
        // Create client object
        const client = {
            id: clientId,
            ws: ws,
            readyState: WebSocket.CONNECTING,
            connectedAt: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
            messageCount: 0,
            authenticated: false,
            terminateReason: null,
            userAgent: request.headers['user-agent'],
            ip: request.socket.remoteAddress
        };
        
        this.clients.set(clientId, client);
        this.stats.totalConnections++;
        this.stats.activeConnections = this.clients.size;
        
        // Set up client event handlers
        ws.on('open', () => {
            client.readyState = WebSocket.OPEN;
            this.emit('client:connected', { clientId, client: this.getClientInfo(clientId) });
            
            // Send welcome message
            this.sendMessage(clientId, {
                type: 'welcome',
                clientId: clientId,
                serverTime: new Date().toISOString(),
                config: {
                    heartbeatInterval: this.config.heartbeatInterval,
                    rateLimiting: this.config.rateLimiting
                }
            });
        });
        
        ws.on('message', (data) => {
            this.handleClientMessage(clientId, data);
        });
        
        ws.on('close', (code, reason) => {
            client.readyState = WebSocket.CLOSED;
            this.clients.delete(clientId);
            this.stats.activeConnections = this.clients.size;
            
            this.emit('client:disconnected', { 
                clientId, 
                code, 
                reason: reason || client.terminateReason 
            });
        });
        
        ws.on('error', (error) => {
            this.emit('client:error', { clientId, error });
            this.stats.errors++;
        });
        
        ws.on('pong', () => {
            client.lastActivity = new Date().toISOString();
        });
    }

    handleServerError(error) {
        this.emit('server:error', { type: 'websocket', error });
        this.stats.errors++;
    }

    handleClientMessage(clientId, data) {
        const client = this.clients.get(clientId);
        if (!client) {
            return;
        }
        
        try {
            const message = JSON.parse(data);
            client.lastActivity = new Date().toISOString();
            client.messageCount++;
            this.stats.messagesReceived++;
            
            // Handle different message types
            switch (message.type) {
                case 'ping':
                    this.handlePing(clientId, message);
                    break;
                case 'subscribe':
                    this.handleSubscribe(clientId, message);
                    break;
                case 'unsubscribe':
                    this.handleUnsubscribe(clientId, message);
                    break;
                case 'get_status':
                    this.handleGetStatus(clientId, message);
                    break;
                case 'start_monitoring':
                case 'stop_monitoring':
                case 'refresh_data':
                case 'export_data':
                    this.handleControlMessage(clientId, message);
                    break;
                default:
                    // Emit for custom handlers
                    this.emit('client:message', { clientId, message });
                    
                    // Check for registered handlers
                    const handler = this.messageHandlers.get(message.type);
                    if (handler) {
                        handler(clientId, message);
                    }
                    break;
            }
            
        } catch (error) {
            this.emit('client:error', { 
                clientId, 
                error: `Invalid message format: ${error.message}` 
            });
            
            this.sendMessage(clientId, {
                type: 'error',
                message: 'Invalid message format',
                details: error.message
            });
        }
    }

    handlePing(clientId, message) {
        this.sendMessage(clientId, {
            type: 'pong',
            timestamp: new Date().toISOString(),
            originalMessageId: message.id
        });
    }

    handleSubscribe(clientId, message) {
        const client = this.clients.get(clientId);
        if (!client) {
            return;
        }
        
        // Add subscription to client
        if (!client.subscriptions) {
            client.subscriptions = new Set();
        }
        
        if (message.channels && Array.isArray(message.channels)) {
            message.channels.forEach(channel => {
                client.subscriptions.add(channel);
            });
        }
        
        this.sendMessage(clientId, {
            type: 'subscription_confirmed',
            channels: Array.from(client.subscriptions),
            timestamp: new Date().toISOString()
        });
        
        this.emit('client:subscribed', { clientId, channels: message.channels });
    }

    handleUnsubscribe(clientId, message) {
        const client = this.clients.get(clientId);
        if (!client || !client.subscriptions) {
            return;
        }
        
        if (message.channels && Array.isArray(message.channels)) {
            message.channels.forEach(channel => {
                client.subscriptions.delete(channel);
            });
        }
        
        this.sendMessage(clientId, {
            type: 'unsubscription_confirmed',
            channels: Array.from(client.subscriptions),
            timestamp: new Date().toISOString()
        });
        
        this.emit('client:unsubscribed', { clientId, channels: message.channels });
    }

    handleGetStatus(clientId, message) {
        const status = {
            server: this.getStats(),
            client: this.getClientInfo(clientId)
        };
        
        this.sendMessage(clientId, {
            type: 'status_response',
            status,
            timestamp: new Date().toISOString()
        });
    }

    handleControlMessage(clientId, message) {
        // Emit control messages for other components to handle
        this.emit('control:message', { clientId, message });
    }

    sendMessage(clientId, messageData) {
        const client = this.clients.get(clientId);
        if (!client || client.readyState !== WebSocket.OPEN) {
            return false;
        }
        
        try {
            client.ws.send(JSON.stringify(messageData));
            return true;
        } catch (error) {
            this.emit('client:error', { 
                clientId, 
                error: `Failed to send message: ${error.message}` 
            });
            this.stats.errors++;
            return false;
        }
    }

    sendHeartbeat() {
        const heartbeatMessage = {
            type: 'heartbeat',
            timestamp: new Date().toISOString(),
            serverStats: this.getStats()
        };
        
        this.broadcast(heartbeatMessage);
    }

    verifyClient(info) {
        if (!this.config.enableAuth) {
            return true;
        }
        
        try {
            const token = this.extractTokenFromRequest(info);
            if (!token) {
                return false;
            }
            
            const decoded = jwt.verify(token, this.config.jwtSecret);
            return decoded && decoded.authorized;
            
        } catch (error) {
            return false;
        }
    }

    extractTokenFromRequest(request) {
        // Try to get token from query parameters
        const url = require('url').parse(request.url, true);
        return url.query.token || null;
    }

    isRateLimited(clientId) {
        if (!this.config.rateLimiting.enabled) {
            return false;
        }
        
        const now = Date.now();
        const clientLimit = this.rateLimitMap.get(clientId);
        
        if (!clientLimit) {
            this.rateLimitMap.set(clientId, {
                count: 1,
                windowStart: now
            });
            return false;
        }
        
        // Check if we're outside the time window
        if (now - clientLimit.windowStart > this.config.rateLimiting.windowMs) {
            clientLimit.count = 1;
            clientLimit.windowStart = now;
        } else {
            clientLimit.count++;
        }
        
        return clientLimit.count > this.config.rateLimiting.maxMessages;
    }

    cleanupRateLimiting() {
        const now = Date.now();
        const cutoffTime = now - this.config.rateLimiting.windowMs;
        
        for (const [clientId, limit] of this.rateLimitMap.entries()) {
            if (limit.windowStart < cutoffTime) {
                this.rateLimitMap.delete(clientId);
            }
        }
    }

    generateClientId() {
        return `client_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    }

    generateMessageId() {
        return `msg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }

    initializeDefaultHandlers() {
        // System metrics handler
        this.registerHandler('system_metrics', (clientId, message) => {
            // Broadcast system metrics to all subscribed clients
            this.broadcast({
                type: 'system_metrics',
                payload: message.data
            }, {
                includeClients: this.getSubscribedClients('system_metrics')
            });
        });
        
        // Performance metrics handler
        this.registerHandler('performance_metrics', (clientId, message) => {
            this.broadcast({
                type: 'performance_metrics',
                payload: message.data
            }, {
                includeClients: this.getSubscribedClients('performance_metrics')
            });
        });
        
        // Error analysis handler
        this.registerHandler('error_analysis', (clientId, message) => {
            this.broadcast({
                type: 'error_analysis',
                payload: message.data
            }, {
                includeClients: this.getSubscribedClients('error_analysis')
            });
        });
        
        // Debug sessions handler
        this.registerHandler('debug_sessions', (clientId, message) => {
            this.broadcast({
                type: 'debug_sessions',
                payload: message.data
            }, {
                includeClients: this.getSubscribedClients('debug_sessions')
            });
        });
        
        // Log entry handler
        this.registerHandler('log_entry', (clientId, message) => {
            this.broadcast({
                type: 'log_entry',
                payload: message.data
            }, {
                includeClients: this.getSubscribedClients('logs')
            });
        });
        
        // Alert handler
        this.registerHandler('alert', (clientId, message) => {
            this.broadcast({
                type: 'alert',
                payload: message.data
            }, {
                includeClients: this.getSubscribedClients('alerts')
            });
        });
    }

    getSubscribedClients(channel) {
        const subscribedClients = [];
        
        for (const [clientId, client] of this.clients.entries()) {
            if (client.subscriptions && client.subscriptions.has(channel)) {
                subscribedClients.push(clientId);
            }
        }
        
        return subscribedClients;
    }
}

module.exports = WebSocketServer;