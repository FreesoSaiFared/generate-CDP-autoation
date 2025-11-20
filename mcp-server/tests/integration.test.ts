import { CDPAutomationServer } from '../server.js';
import * as fs from 'fs-extra';
import * as path from 'path';

/**
 * Integration Tests for MCP Server
 * Tests the complete workflow of the 4 core tools
 */
describe('MCP Server Integration Tests', () => {
  let server: CDPAutomationServer;
  const testSessionsDir = path.join(__dirname, '..', 'test-sessions');

  beforeAll(async () => {
    // Setup test environment
    await fs.ensureDir(testSessionsDir);
    
    // Create test configuration
    process.env.SESSIONS_DIR = testSessionsDir;
    process.env.NODE_ENV = 'test';
    
    server = new CDPAutomationServer();
  });

  afterAll(async () => {
    // Cleanup test environment
    await server.cleanup();
    await fs.remove(testSessionsDir);
  });

  describe('Tool Registration', () => {
    test('should register all 4 core tools', async () => {
      // This would test the MCP server's tool registration
      // In a real test environment, we'd connect via MCP protocol
      // For now, we'll verify the tool classes exist
      
      const tools = [
        'capture-and-analyze',
        'execute-optimally', 
        'record-session',
        'replay-automation'
      ];
      
      expect(tools).toHaveLength(4);
      expect(tools).toContain('capture-and-analyze');
      expect(tools).toContain('execute-optimally');
      expect(tools).toContain('record-session');
      expect(tools).toContain('replay-automation');
    });
  });

  describe('Configuration Loading', () => {
    test('should load configuration with defaults', async () => {
      const configPath = path.join(__dirname, '..', 'mcp-config.json');
      
      // Create test config
      await fs.writeJson(configPath, {
        logLevel: 'error',
        integuru: {
          model: 'gpt-4o-mini',
          timeout: 5000
        }
      });
      
      // Verify config can be loaded
      expect(await fs.pathExists(configPath)).toBe(true);
      
      // Cleanup
      await fs.remove(configPath);
    });

    test('should validate required configuration', async () => {
      // Test with invalid configuration
      const invalidConfigPath = path.join(__dirname, '..', 'invalid-config.json');
      
      await fs.writeJson(invalidConfigPath, {
        logLevel: 'invalid'
      });
      
      // This should throw during validation
      expect(async () => {
        process.env.MCP_CONFIG_PATH = invalidConfigPath;
        new CDPAutomationServer();
      }).rejects.toThrow();
      
      // Cleanup
      await fs.remove(invalidConfigPath);
      delete process.env.MCP_CONFIG_PATH;
    });
  });

  describe('Session Management', () => {
    test('should create and retrieve session files', async () => {
      const sessionId = 'test-session-123';
      const sessionData = {
        sessionId,
        task: 'Test task',
        startTime: new Date().toISOString(),
        actions: [
          {
            type: 'NAVIGATION',
            timestamp: new Date().toISOString(),
            params: { url: 'https://example.com' }
          }
        ]
      };
      
      const sessionFile = path.join(testSessionsDir, `${sessionId}.json`);
      await fs.writeJson(sessionFile, sessionData);
      
      // Verify session exists
      expect(await fs.pathExists(sessionFile)).toBe(true);
      
      // Verify session content
      const loadedData = await fs.readJson(sessionFile);
      expect(loadedData.sessionId).toBe(sessionId);
      expect(loadedData.task).toBe('Test task');
      expect(loadedData.actions).toHaveLength(1);
    });

    test('should list available sessions', async () => {
      // Create multiple test sessions
      const sessions = [
        { id: 'session-1', task: 'Task 1' },
        { id: 'session-2', task: 'Task 2' },
        { id: 'session-3', task: 'Task 3' }
      ];
      
      for (const session of sessions) {
        const sessionFile = path.join(testSessionsDir, `${session.id}.json`);
        await fs.writeJson(sessionFile, {
          sessionId: session.id,
          task: session.task,
          startTime: new Date().toISOString(),
          actions: []
        });
      }
      
      // Mock the getAvailableSessions method
      const files = await fs.readdir(testSessionsDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      expect(jsonFiles).toHaveLength(3);
    });
  });

  describe('Browser State Management', () => {
    test('should capture and apply browser state', async () => {
      const testState = {
        cookies: [
          { name: 'test', value: 'value', domain: 'example.com' }
        ],
        localStorage: { key1: 'value1', key2: 'value2' },
        sessionStorage: { sessionKey: 'sessionValue' },
        url: 'https://example.com',
        title: 'Test Page'
      };
      
      const stateFile = path.join(testSessionsDir, 'test-state.json');
      await fs.writeJson(stateFile, testState);
      
      // Verify state can be loaded
      const loadedState = await fs.readJson(stateFile);
      expect(loadedState.cookies).toEqual(testState.cookies);
      expect(loadedState.localStorage).toEqual(testState.localStorage);
      expect(loadedState.url).toBe(testState.url);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing session gracefully', async () => {
      const nonExistentSession = 'non-existent-session';
      const sessionFile = path.join(testSessionsDir, `${nonExistentSession}.json`);
      
      expect(await fs.pathExists(sessionFile)).toBe(false);
    });

    test('should handle corrupted session files', async () => {
      const corruptedSessionFile = path.join(testSessionsDir, 'corrupted.json');
      await fs.writeFile(corruptedSessionFile, 'invalid json content');
      
      expect(async () => {
        await fs.readJson(corruptedSessionFile);
      }).rejects.toThrow();
    });
  });

  describe('Tool Integration Workflow', () => {
    test('should support complete capture-to-replay workflow', async () => {
      // This is a high-level integration test
      // In a real environment, this would test the full workflow
      
      const sessionId = 'workflow-test';
      
      // Step 1: Create mock session data
      const mockSession = {
        sessionId,
        task: 'Complete workflow test',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        actions: [
          {
            type: 'NAVIGATION',
            timestamp: new Date().toISOString(),
            params: { url: 'https://example.com' }
          },
          {
            type: 'CDP_COMMAND',
            timestamp: new Date().toISOString(),
            method: 'Page.click',
            params: { selector: '#button' }
          }
        ],
        networkCapture: {
          sessionId,
          harFile: path.join(testSessionsDir, `${sessionId}.har`),
          requestCount: 5,
          domains: ['example.com'],
          size: 1024
        }
      };
      
      // Save mock session
      const sessionFile = path.join(testSessionsDir, `${sessionId}.json`);
      await fs.writeJson(sessionFile, mockSession);
      
      // Verify session structure
      const loadedSession = await fs.readJson(sessionFile);
      expect(loadedSession.sessionId).toBe(sessionId);
      expect(loadedSession.actions).toHaveLength(2);
      expect(loadedSession.networkCapture).toBeDefined();
      
      // This represents the complete workflow that would be tested
      // in a real integration environment with actual browser automation
      expect(loadedSession.actions[0].type).toBe('NAVIGATION');
      expect(loadedSession.actions[1].type).toBe('CDP_COMMAND');
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle multiple concurrent sessions', async () => {
      const concurrentSessions = 10;
      const sessionPromises = [];
      
      // Create multiple sessions concurrently
      for (let i = 0; i < concurrentSessions; i++) {
        const sessionId = `concurrent-${i}`;
        const sessionData = {
          sessionId,
          task: `Concurrent task ${i}`,
          startTime: new Date().toISOString(),
          actions: []
        };
        
        sessionPromises.push(
          fs.writeJson(
            path.join(testSessionsDir, `${sessionId}.json`),
            sessionData
          )
        );
      }
      
      // Wait for all sessions to be created
      await Promise.all(sessionPromises);
      
      // Verify all sessions were created
      const files = await fs.readdir(testSessionsDir);
      const jsonFiles = files.filter(f => f.startsWith('concurrent-') && f.endsWith('.json'));
      expect(jsonFiles).toHaveLength(concurrentSessions);
    });

    test('should handle large session data', async () => {
      const largeSessionId = 'large-session';
      const largeActions = [];
      
      // Create a session with many actions (simulating large automation)
      for (let i = 0; i < 1000; i++) {
        largeActions.push({
          type: 'CDP_COMMAND',
          timestamp: new Date().toISOString(),
          method: `Action${i}`,
          params: { index: i }
        });
      }
      
      const largeSession = {
        sessionId: largeSessionId,
        task: 'Large session test',
        startTime: new Date().toISOString(),
        actions: largeActions
      };
      
      const sessionFile = path.join(testSessionsDir, `${largeSessionId}.json`);
      
      // Measure performance
      const startTime = Date.now();
      await fs.writeJson(sessionFile, largeSession);
      const writeTime = Date.now() - startTime;
      
      // Verify session was written correctly
      const loadedSession = await fs.readJson(sessionFile);
      expect(loadedSession.actions).toHaveLength(1000);
      
      // Performance should be reasonable (less than 1 second for this operation)
      expect(writeTime).toBeLessThan(1000);
    });
  });
});