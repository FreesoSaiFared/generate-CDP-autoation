/**
 * Mock MCP Server for Testing
 * 
 * This is a simplified mock version of the MCP server for testing purposes.
 * It simulates the behavior of the real MCP server without requiring TypeScript compilation.
 */

const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs');

class MockMCPServer extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            port: options.port || 3000,
            host: options.host || 'localhost',
            ...options
        };
        
        this.tools = {
            'capture-and-analyze': {
                name: 'capture-and-analyze',
                description: 'Capture browser state and analyze for automation',
                inputSchema: {
                    type: 'object',
                    properties: {
                        url: { type: 'string' },
                        description: { type: 'string' }
                    }
                }
            },
            'execute-optimally': {
                name: 'execute-optimally',
                description: 'Execute automation using optimal modality',
                inputSchema: {
                    type: 'object',
                    properties: {
                        taskDescription: { type: 'string' },
                        url: { type: 'string' }
                    }
                }
            },
            'record-session': {
                name: 'record-session',
                description: 'Record browser session for replay',
                inputSchema: {
                    type: 'object',
                    properties: {
                        taskDescription: { type: 'string' },
                        url: { type: 'string' }
                    }
                }
            },
            'replay-automation': {
                name: 'replay-automation',
                description: 'Replay recorded automation',
                inputSchema: {
                    type: 'object',
                    properties: {
                        sessionId: { type: 'string' }
                    }
                }
            }
        };
        
        this.sessions = new Map();
        this.isRunning = false;
    }

    async start() {
        console.log(`🚀 Mock MCP Server starting on ${this.options.host}:${this.options.port}`);
        
        // Simulate server startup
        setTimeout(() => {
            this.isRunning = true;
            this.emit('started', { port: this.options.port });
            console.log(`✅ Mock MCP Server started successfully`);
        }, 1000);
        
        return true;
    }

    async stop() {
        console.log(`🛑 Mock MCP Server stopping...`);
        
        this.isRunning = false;
        this.emit('stopped');
        console.log(`✅ Mock MCP Server stopped`);
        
        return true;
    }

    async callTool(toolName, args = {}) {
        console.log(`🔧 Calling tool: ${toolName} with args:`, args);
        
        if (!this.tools[toolName]) {
            throw new Error(`Unknown tool: ${toolName}`);
        }
        
        // Simulate tool execution
        const startTime = Date.now();
        
        try {
            let result;
            
            switch (toolName) {
                case 'capture-and-analyze':
                    result = await this.mockCaptureAndAnalyze(args);
                    break;
                    
                case 'execute-optimally':
                    result = await this.mockExecuteOptimally(args);
                    break;
                    
                case 'record-session':
                    result = await this.mockRecordSession(args);
                    break;
                    
                case 'replay-automation':
                    result = await this.mockReplayAutomation(args);
                    break;
                    
                default:
                    throw new Error(`Tool ${toolName} not implemented`);
            }
            
            const duration = Date.now() - startTime;
            
            const response = {
                success: true,
                result,
                duration,
                tool: toolName,
                timestamp: new Date().toISOString()
            };
            
            console.log(`✅ Tool ${toolName} completed in ${duration}ms`);
            this.emit('toolCompleted', { tool: toolName, result: response });
            
            return response;
            
        } catch (error) {
            const duration = Date.now() - startTime;
            
            const response = {
                success: false,
                error: error.message,
                duration,
                tool: toolName,
                timestamp: new Date().toISOString()
            };
            
            console.log(`❌ Tool ${toolName} failed in ${duration}ms:`, error.message);
            this.emit('toolFailed', { tool: toolName, error: response });
            
            return response;
        }
    }

    async mockCaptureAndAnalyze(args) {
        // Simulate browser state capture and analysis
        await this.delay(2000 + Math.random() * 1000);
        
        const url = args.url || 'https://gmail.com';
        
        return {
            capturedState: {
                url,
                title: 'Gmail',
                elements: [
                    { type: 'input', selector: '#identifierId', label: 'Email' },
                    { type: 'input', selector: '#password', label: 'Password' },
                    { type: 'button', selector: '#identifierNext', label: 'Next' }
                ]
            },
            analysis: {
                taskType: 'login',
                complexity: 'medium',
                estimatedSteps: 3,
                recommendedModality: 'cdp',
                confidence: 0.95
            },
            harData: {
                entries: [
                    { url: 'https://gmail.com', status: 200 },
                    { url: 'https://accounts.google.com', status: 200 }
                ]
            }
        };
    }

    async mockExecuteOptimally(args) {
        // Simulate optimal execution
        await this.delay(3000 + Math.random() * 2000);
        
        const taskDescription = args.taskDescription || 'Gmail login';
        const url = args.url || 'https://gmail.com';
        
        // Simulate Gmail login success
        const success = Math.random() > 0.05; // 95% success rate
        
        if (!success) {
            throw new Error('Login failed due to invalid credentials or detection');
        }
        
        return {
            taskDescription,
            url,
            modality: 'cdp',
            steps: [
                { action: 'navigate', target: url, status: 'completed' },
                { action: 'type', target: '#identifierId', value: 'kijkwijs@gmail.com', status: 'completed' },
                { action: 'click', target: '#identifierNext', status: 'completed' },
                { action: 'type', target: '#password', value: '[REDACTED]', status: 'completed' },
                { action: 'click', target: '#passwordNext', status: 'completed' }
            ],
            result: {
                success: true,
                message: 'Successfully logged into Gmail',
                detectionBypassed: true,
                executionTime: 3000 + Math.random() * 2000,
                performanceGain: 8 + Math.random() * 7 // 8-15x improvement
            }
        };
    }

    async mockRecordSession(args) {
        // Simulate session recording
        await this.delay(2000 + Math.random() * 1000);
        
        const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const taskDescription = args.taskDescription || 'Gmail login';
        const url = args.url || 'https://gmail.com';
        
        const session = {
            id: sessionId,
            taskDescription,
            url,
            startTime: new Date().toISOString(),
            endTime: new Date(Date.now() + 5000).toISOString(),
            events: [
                { type: 'navigation', url, timestamp: Date.now() },
                { type: 'input', selector: '#identifierId', value: 'kijkwijs@gmail.com', timestamp: Date.now() + 1000 },
                { type: 'click', selector: '#identifierNext', timestamp: Date.now() + 2000 },
                { type: 'input', selector: '#password', value: '[REDACTED]', timestamp: Date.now() + 3000 },
                { type: 'click', selector: '#passwordNext', timestamp: Date.now() + 4000 }
            ],
            metadata: {
                duration: 5000,
                steps: 5,
                success: true,
                detectionBypassed: true
            }
        };
        
        this.sessions.set(sessionId, session);
        
        return {
            sessionId,
            session,
            recordingPath: `/tmp/recordings/${sessionId}.json`,
            message: 'Session recorded successfully'
        };
    }

    async mockReplayAutomation(args) {
        // Simulate automation replay
        await this.delay(2000 + Math.random() * 1000);
        
        const sessionId = args.sessionId;
        
        if (!sessionId) {
            throw new Error('Session ID is required');
        }
        
        const session = this.sessions.get(sessionId);
        
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }
        
        // Simulate replay success
        const success = Math.random() > 0.05; // 95% success rate
        
        if (!success) {
            throw new Error('Replay failed due to environment changes');
        }
        
        return {
            sessionId,
            replayed: true,
            fidelity: 0.95 + Math.random() * 0.04, // 95-99% fidelity
            steps: session.events.length,
            result: {
                success: true,
                message: 'Session replayed successfully',
                executionTime: 2000 + Math.random() * 1000,
                accuracy: 0.95 + Math.random() * 0.04
            }
        };
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getTools() {
        return Object.values(this.tools);
    }

    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }

    getAllSessions() {
        return Array.from(this.sessions.values());
    }
}

// Create and export server instance
const server = new MockMCPServer();

// Auto-start server if this file is run directly
if (require.main === module) {
    server.start()
        .then(() => {
            console.log('Mock MCP Server is running...');
            console.log('Available tools:', Object.keys(server.tools));
            
            // Keep the process running
            process.on('SIGINT', async () => {
                console.log('\nShutting down Mock MCP Server...');
                await server.stop();
                process.exit(0);
            });
        })
        .catch(error => {
            console.error('Failed to start Mock MCP Server:', error);
            process.exit(1);
        });
}

module.exports = MockMCPServer;
module.exports.server = server;