/**
 * Test Suite for Integuru Integration
 * 
 * This test suite validates:
 * - Integuru wrapper functionality
 * - HAR file processing
 * - Code execution in isolated environment
 * - Dependency analysis
 * - Integration with MCP server
 * - Error handling and timeout management
 */

const fs = require('fs').promises;
const path = require('path');
const assert = require('assert');
const InteguruWrapper = require('../lib/integuru-wrapper');
const HarProcessor = require('../lib/har-processor');
const CodeExecutor = require('../lib/code-executor');
const DependencyAnalyzer = require('../lib/dependency-analyzer');

class InteguruTestSuite {
  constructor(options = {}) {
    this.testDir = options.testDir || path.join(__dirname, 'test-data');
    this.tempDir = options.tempDir || path.join(__dirname, 'temp');
    this.testResults = [];
    this.verbose = options.verbose || false;
    
    // Initialize components
    this.integuruWrapper = new InteguruWrapper({
      timeout: 5000,
      tempDir: this.tempDir
    });
    this.harProcessor = new HarProcessor();
    this.codeExecutor = new CodeExecutor({
      timeout: 3000,
      tempDir: this.tempDir
    });
    this.dependencyAnalyzer = new DependencyAnalyzer();
    
    // Ensure test directories exist
    this.ensureDirectories();
  }

  /**
   * Run all tests
   * 
   * @returns {Promise<Object>} Test results
   */
  async runAllTests() {
    console.log('🧪 Starting Integuru Integration Test Suite');
    console.log('==========================================');
    
    const startTime = Date.now();
    
    try {
      // Test individual components
      await this.testHarProcessor();
      await this.testCodeExecutor();
      await this.testDependencyAnalyzer();
      await this.testInteguruWrapper();
      
      // Test integration scenarios
      await this.testKlingAIExample();
      await this.testErrorHandling();
      await this.testTimeoutManagement();
      
      // Test edge cases
      await this.testEmptyHarFile();
      await this.testMalformedHarFile();
      await this.testLargeHarFile();
      
      const duration = Date.now() - startTime;
      
      // Generate report
      const report = this.generateReport(duration);
      
      console.log('\n📊 Test Summary:');
      console.log(`Total Tests: ${report.total}`);
      console.log(`Passed: ${report.passed}`);
      console.log(`Failed: ${report.failed}`);
      console.log(`Duration: ${report.duration}ms`);
      console.log(`Success Rate: ${report.successRate}%`);
      
      if (report.failed > 0) {
        console.log('\n❌ Failed Tests:');
        report.failedTests.forEach(test => {
          console.log(`  - ${test.name}: ${test.error}`);
        });
      }
      
      return report;
      
    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      throw error;
    }
  }

  /**
   * Test HAR processor functionality
   */
  async testHarProcessor() {
    console.log('\n🔍 Testing HAR Processor...');
    
    // Test with sample HAR file
    const sampleHarPath = await this.createSampleHarFile();
    
    try {
      const result = await this.harProcessor.process(sampleHarPath);
      
      this.assert(result.entries > 0, 'HAR processor should extract entries');
      this.assert(Array.isArray(result.apiEndpoints), 'Should extract API endpoints');
      this.assert(Array.isArray(result.cookies), 'Should extract cookies');
      this.assert(typeof result.complexity === 'object', 'Should calculate complexity');
      this.assert(typeof result.dependencyGraph === 'object', 'Should build dependency graph');
      
      this.recordTest('HAR Processor - Basic Processing', true);
      
      // Test cookie extraction
      const cookies = await this.harProcessor.extractCookies(sampleHarPath);
      this.assert(Array.isArray(cookies), 'Should extract cookies array');
      
      this.recordTest('HAR Processor - Cookie Extraction', true);
      
    } catch (error) {
      this.recordTest('HAR Processor - Basic Processing', false, error.message);
      throw error;
    }
  }

  /**
   * Test code executor functionality
   */
  async testCodeExecutor() {
    console.log('\n🐍 Testing Code Executor...');
    
    // Test with simple Python code
    const simpleCode = `
print("Hello from Python")
result = 2 + 3
print(f"2 + 3 = {result}")
`;
    
    try {
      const result = await this.codeExecutor.execute(simpleCode);
      
      this.assert(result.success === true, 'Code should execute successfully');
      this.assert(result.output.includes('Hello from Python'), 'Should capture output');
      this.assert(result.output.includes('2 + 3 = 5'), 'Should calculate correctly');
      this.assert(typeof result.executionTime === 'number', 'Should measure execution time');
      
      this.recordTest('Code Executor - Simple Execution', true);
      
      // Test with code that uses allowed modules
      const requestsCode = `
import requests
import json

# Mock API call (won't actually make request due to sandbox)
response_data = {"status": "success", "data": {"id": 123}}
print(json.dumps(response_data))
`;
      
      const requestsResult = await this.codeExecutor.execute(requestsCode);
      this.assert(requestsResult.success === true, 'Should allow requests module');
      this.assert(requestsResult.output.includes('success'), 'Should handle JSON correctly');
      
      this.recordTest('Code Executor - Module Usage', true);
      
      // Test with blocked module
      const blockedCode = `
import os
print(os.getcwd())
`;
      
      const blockedResult = await this.codeExecutor.execute(blockedCode);
      this.assert(blockedResult.success === false, 'Should block os module');
      this.assert(blockedResult.error.includes('not allowed'), 'Should show security error');
      
      this.recordTest('Code Executor - Security Blocking', true);
      
    } catch (error) {
      this.recordTest('Code Executor - Simple Execution', false, error.message);
      throw error;
    }
  }

  /**
   * Test dependency analyzer functionality
   */
  async testDependencyAnalyzer() {
    console.log('\n🔗 Testing Dependency Analyzer...');
    
    try {
      // Create mock processed HAR data
      const mockHarData = {
        entries: [
          {
            request: { url: 'https://api.example.com/auth/login', method: 'POST' },
            response: { status: 200 },
            startedDateTime: '2025-01-01T10:00:00.000Z',
            time: 500,
            request: {
              url: 'https://api.example.com/auth/login',
              method: 'POST',
              headers: [{ name: 'Content-Type', value: 'application/json' }],
              cookies: []
            },
            response: {
              status: 200,
              headers: [{ name: 'Set-Cookie', value: 'session_id=abc123' }],
              content: { text: '{"token": "auth_token_123"}', mimeType: 'application/json' },
              cookies: [{ name: 'session_id', value: 'abc123' }]
            }
          },
          {
            request: { url: 'https://api.example.com/api/data', method: 'GET' },
            response: { status: 200 },
            startedDateTime: '2025-01-01T10:00:02.000Z',
            time: 300,
            request: {
              url: 'https://api.example.com/api/data',
              method: 'GET',
              headers: [{ name: 'Authorization', value: 'Bearer auth_token_123' }],
              cookies: [{ name: 'session_id', value: 'abc123' }]
            },
            response: {
              status: 200,
              headers: [],
              content: { text: '{"data": [{"id": 1, "name": "Item 1"}]}', mimeType: 'application/json' },
              cookies: []
            }
          }
        ],
        apiEndpoints: [
          { method: 'POST', path: '/auth/login', domain: 'api.example.com' },
          { method: 'GET', path: '/api/data', domain: 'api.example.com' }
        ],
        timeRange: {
          start: new Date('2025-01-01T10:00:00.000Z'),
          end: new Date('2025-01-01T10:00:02.000Z'),
          duration: 2000
        }
      };
      
      const result = await this.dependencyAnalyzer.analyze(mockHarData);
      
      this.assert(typeof result.graph === 'object', 'Should build dependency graph');
      this.assert(Array.isArray(result.sequence), 'Should create call sequence');
      this.assert(Array.isArray(result.dependencies), 'Should identify dependencies');
      this.assert(typeof result.authFlow === 'object', 'Should analyze auth flow');
      this.assert(result.authFlow.hasAuth === true, 'Should detect authentication');
      
      this.recordTest('Dependency Analyzer - Basic Analysis', true);
      
      // Test critical path identification
      this.assert(Array.isArray(result.criticalPaths), 'Should find critical paths');
      if (result.criticalPaths.length > 0) {
        this.assert(typeof result.criticalPaths[0].score === 'number', 'Should score paths');
      }
      
      this.recordTest('Dependency Analyzer - Critical Paths', true);
      
    } catch (error) {
      this.recordTest('Dependency Analyzer - Basic Analysis', false, error.message);
      throw error;
    }
  }

  /**
   * Test Integuru wrapper functionality
   */
  async testInteguruWrapper() {
    console.log('\n🎯 Testing Integuru Wrapper...');
    
    // Mock Integuru installation check
    const originalValidate = this.integuruWrapper.validateInstallation;
    this.integuruWrapper.validateInstallation = () => Promise.resolve(true);
    
    try {
      // Test with sample HAR file
      const sampleHarPath = await this.createSampleHarFile();
      const taskPrompt = "Download the generated image from KlingAI";
      
      // Mock the runInteguruAnalysis method to avoid actual Integuru dependency
      const originalRunAnalysis = this.integuruWrapper.runInteguruAnalysis;
      this.integuruWrapper.runInteguruAnalysis = async (params) => {
        return {
          generated_code: `
import requests

def download_klingai_image(auth_token, image_id):
    headers = {"Authorization": f"Bearer {auth_token}"}
    response = requests.get(
        f"https://api.klingai.com/images/{image_id}/download",
        headers=headers
    )
    return response.content

# Example usage
# result = download_klingai_image("token123", "img456")
# print(f"Downloaded {len(result)} bytes")
`,
          confidence: 0.95,
          estimated_time: 3
        };
      };
      
      const result = await this.integuruWrapper.analyzeHAR(sampleHarPath, taskPrompt, true);
      
      this.assert(typeof result.dependency_graph === 'object', 'Should return dependency graph');
      this.assert(typeof result.code === 'string', 'Should return generated code');
      this.assert(typeof result.confidence === 'number', 'Should return confidence score');
      this.assert(result.confidence > 0, 'Confidence should be positive');
      this.assert(typeof result.estimated_time_seconds === 'number', 'Should estimate execution time');
      
      this.recordTest('Integuru Wrapper - HAR Analysis', true);
      
      // Test code execution
      if (result.code) {
        const executionResult = await this.integuruWrapper.executeCode(result.code);
        this.assert(typeof executionResult.success === 'boolean', 'Should return execution success');
        this.assert(typeof executionResult.executionTime === 'number', 'Should measure execution time');
        
        this.recordTest('Integuru Wrapper - Code Execution', true);
      }
      
      // Restore original methods
      this.integuruWrapper.runInteguruAnalysis = originalRunAnalysis;
      
    } catch (error) {
      this.recordTest('Integuru Wrapper - HAR Analysis', false, error.message);
      // Restore original methods even on error
      this.integuruWrapper.validateInstallation = originalValidate;
      throw error;
    }
    
    // Restore original validation
    this.integuruWrapper.validateInstallation = originalValidate;
  }

  /**
   * Test KlingAI example from implementation guide
   */
  async testKlingAIExample() {
    console.log('\n🖼️ Testing KlingAI Example...');
    
    try {
      // Create HAR file that mimics KlingAI image download
      const klingaiHarPath = await this.createKlingAIHarFile();
      
      // Mock Integuru to return expected KlingAI code
      const originalRunAnalysis = this.integuruWrapper.runInteguruAnalysis;
      this.integuruWrapper.runInteguruAnalysis = async (params) => {
        if (params.taskPrompt.includes('KlingAI')) {
          return {
            generated_code: `
import requests
import json

def download_klingai_image(auth_token, image_id):
    """
    Download generated image from KlingAI
    """
    headers = {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }
    
    # Step 1: Verify auth
    auth_response = requests.get(
        "https://api.klingai.com/auth/verify",
        headers=headers
    )
    auth_response.raise_for_status()
    
    # Step 2: Download image
    download_response = requests.get(
        f"https://api.klingai.com/images/{image_id}/download",
        headers=headers
    )
    download_response.raise_for_status()
    
    return download_response.content

# Execute the function
result = download_klingai_image("test_token_123", "test_image_456")
print(f"Downloaded {len(result)} bytes")
`,
            confidence: 0.95,
            estimated_time: 3
          };
        }
        return { generated_code: '', confidence: 0.5, estimated_time: 1 };
      };
      
      const result = await this.integuruWrapper.analyzeHAR(
        klingaiHarPath,
        "Download the generated image from KlingAI",
        true
      );
      
      this.assert(result.code.includes('download_klingai_image'), 'Should generate KlingAI function');
      this.assert(result.code.includes('auth/verify'), 'Should include auth verification');
      this.assert(result.code.includes('images/'), 'Should include image download');
      this.assert(result.confidence > 0.9, 'Should have high confidence for clear example');
      
      this.recordTest('KlingAI Example - Code Generation', true);
      
      // Test execution of generated code
      const executionResult = await this.integuruWrapper.executeCode(result.code);
      this.assert(executionResult.success === true, 'Generated code should execute');
      this.assert(executionResult.output.includes('Downloaded'), 'Should show download message');
      
      this.recordTest('KlingAI Example - Code Execution', true);
      
      // Restore original method
      this.integuruWrapper.runInteguruAnalysis = originalRunAnalysis;
      
    } catch (error) {
      this.recordTest('KlingAI Example - Code Generation', false, error.message);
      throw error;
    }
  }

  /**
   * Test error handling
   */
  async testErrorHandling() {
    console.log('\n⚠️ Testing Error Handling...');
    
    try {
      // Test with non-existent HAR file
      try {
        await this.harProcessor.process('/non/existent/file.har');
        this.assert(false, 'Should throw error for non-existent file');
      } catch (error) {
        this.assert(error.message.includes('not found'), 'Should show file not found error');
      }
      
      this.recordTest('Error Handling - Non-existent File', true);
      
      // Test with invalid JSON
      const invalidJsonPath = await this.createInvalidJsonFile();
      try {
        await this.harProcessor.process(invalidJsonPath);
        this.assert(false, 'Should throw error for invalid JSON');
      } catch (error) {
        this.assert(error.message.includes('JSON'), 'Should show JSON error');
      }
      
      this.recordTest('Error Handling - Invalid JSON', true);
      
      // Test code execution with syntax error
      const syntaxErrorCode = 'print("unclosed string';
      const result = await this.codeExecutor.execute(syntaxErrorCode);
      this.assert(result.success === false, 'Should fail on syntax error');
      this.assert(result.error.includes('SyntaxError'), 'Should show syntax error');
      
      this.recordTest('Error Handling - Python Syntax Error', true);
      
    } catch (error) {
      this.recordTest('Error Handling - Non-existent File', false, error.message);
      throw error;
    }
  }

  /**
   * Test timeout management
   */
  async testTimeoutManagement() {
    console.log('\n⏱️ Testing Timeout Management...');
    
    try {
      // Test code execution timeout
      const longRunningCode = `
import time
time.sleep(10)  # Sleep for 10 seconds
print("This should not print due to timeout")
`;
      
      const shortTimeoutExecutor = new CodeExecutor({
        timeout: 1000, // 1 second timeout
        tempDir: this.tempDir
      });
      
      const result = await shortTimeoutExecutor.execute(longRunningCode);
      this.assert(result.success === false, 'Should timeout');
      this.assert(result.timeout === true, 'Should indicate timeout');
      this.assert(result.error.includes('timeout'), 'Should show timeout error');
      
      this.recordTest('Timeout Management - Code Execution', true);
      
    } catch (error) {
      this.recordTest('Timeout Management - Code Execution', false, error.message);
      throw error;
    }
  }

  /**
   * Test with empty HAR file
   */
  async testEmptyHarFile() {
    console.log('\n📄 Testing Empty HAR File...');
    
    try {
      const emptyHarPath = await this.createEmptyHarFile();
      const result = await this.harProcessor.process(emptyHarPath);
      
      this.assert(result.entries === 0, 'Should handle empty HAR');
      this.assert(Array.isArray(result.apiEndpoints), 'Should return empty API endpoints array');
      this.assert(result.apiEndpoints.length === 0, 'Should have no API endpoints');
      
      this.recordTest('Empty HAR File Processing', true);
      
    } catch (error) {
      this.recordTest('Empty HAR File Processing', false, error.message);
      throw error;
    }
  }

  /**
   * Test with malformed HAR file
   */
  async testMalformedHarFile() {
    console.log('\n🚫 Testing Malformed HAR File...');
    
    try {
      const malformedHarPath = await this.createMalformedHarFile();
      
      try {
        await this.harProcessor.process(malformedHarPath);
        this.assert(false, 'Should throw error for malformed HAR');
      } catch (error) {
        this.assert(error.message.includes('Invalid HAR'), 'Should show HAR format error');
      }
      
      this.recordTest('Malformed HAR File Handling', true);
      
    } catch (error) {
      this.recordTest('Malformed HAR File Handling', false, error.message);
      throw error;
    }
  }

  /**
   * Test with large HAR file
   */
  async testLargeHarFile() {
    console.log('\n📊 Testing Large HAR File...');
    
    try {
      const largeHarPath = await this.createLargeHarFile(100); // 100 entries
      const result = await this.harProcessor.process(largeHarPath);
      
      this.assert(result.entries === 100, 'Should process all entries');
      this.assert(result.complexity.score > 0, 'Should calculate complexity for large file');
      
      this.recordTest('Large HAR File Processing', true);
      
    } catch (error) {
      this.recordTest('Large HAR File Processing', false, error.message);
      throw error;
    }
  }

  // Helper methods for creating test data

  async createSampleHarFile() {
    const harData = {
      "log": {
        "version": "1.2",
        "creator": {"name": "Test Suite", "version": "1.0"},
        "entries": [
          {
            "startedDateTime": "2025-01-01T10:00:00.000Z",
            "time": 500,
            "request": {
              "method": "GET",
              "url": "https://api.example.com/test",
              "httpVersion": "HTTP/1.1",
              "headers": [
                {"name": "Accept", "value": "application/json"},
                {"name": "User-Agent", "value": "Test-Agent/1.0"}
              ],
              "cookies": [],
              "queryString": [],
              "postData": {},
              "headersSize": 150,
              "bodySize": 0
            },
            "response": {
              "status": 200,
              "statusText": "OK",
              "httpVersion": "HTTP/1.1",
              "headers": [
                {"name": "Content-Type", "value": "application/json"},
                {"name": "Set-Cookie", "value": "session_id=test123; Path=/"}
              ],
              "cookies": [
                {"name": "session_id", "value": "test123", "path": "/", "domain": "example.com"}
              ],
              "content": {
                "size": 50,
                "mimeType": "application/json",
                "text": "{\"status\": \"success\", \"data\": {\"id\": 123}}"
              },
              "redirectURL": "",
              "headersSize": 200,
              "bodySize": 50
            },
            "cache": {},
            "timings": {}
          }
        ]
      }
    };
    
    const filePath = path.join(this.testDir, 'sample.har');
    await fs.writeFile(filePath, JSON.stringify(harData, null, 2));
    return filePath;
  }

  async createKlingAIHarFile() {
    const harData = {
      "log": {
        "version": "1.2",
        "creator": {"name": "Test Suite", "version": "1.0"},
        "entries": [
          {
            "startedDateTime": "2025-01-01T10:00:00.000Z",
            "time": 300,
            "request": {
              "method": "GET",
              "url": "https://api.klingai.com/auth/verify",
              "httpVersion": "HTTP/1.1",
              "headers": [
                {"name": "Authorization", "value": "Bearer test_token_123"},
                {"name": "Content-Type", "value": "application/json"}
              ],
              "cookies": [],
              "queryString": [],
              "postData": {}
            },
            "response": {
              "status": 200,
              "statusText": "OK",
              "httpVersion": "HTTP/1.1",
              "headers": [
                {"name": "Content-Type", "value": "application/json"}
              ],
              "cookies": [],
              "content": {
                "size": 30,
                "mimeType": "application/json",
                "text": "{\"valid\": true, \"user_id\": 456}"
              }
            }
          },
          {
            "startedDateTime": "2025-01-01T10:00:01.000Z",
            "time": 800,
            "request": {
              "method": "GET",
              "url": "https://api.klingai.com/images/test_image_456/download",
              "httpVersion": "HTTP/1.1",
              "headers": [
                {"name": "Authorization", "value": "Bearer test_token_123"}
              ],
              "cookies": [],
              "queryString": [],
              "postData": {}
            },
            "response": {
              "status": 200,
              "statusText": "OK",
              "httpVersion": "HTTP/1.1",
              "headers": [
                {"name": "Content-Type", "value": "image/png"},
                {"name": "Content-Length", "value": "1024"}
              ],
              "cookies": [],
              "content": {
                "size": 1024,
                "mimeType": "image/png",
                "text": "binary-image-data-placeholder"
              }
            }
          }
        ]
      }
    };
    
    const filePath = path.join(this.testDir, 'klingai.har');
    await fs.writeFile(filePath, JSON.stringify(harData, null, 2));
    return filePath;
  }

  async createEmptyHarFile() {
    const harData = {
      "log": {
        "version": "1.2",
        "creator": {"name": "Test Suite", "version": "1.0"},
        "entries": []
      }
    };
    
    const filePath = path.join(this.testDir, 'empty.har');
    await fs.writeFile(filePath, JSON.stringify(harData, null, 2));
    return filePath;
  }

  async createInvalidJsonFile() {
    const filePath = path.join(this.testDir, 'invalid.json');
    await fs.writeFile(filePath, '{"invalid": json content}');
    return filePath;
  }

  async createMalformedHarFile() {
    const malformedData = {
      "log": {
        "version": "1.2",
        "creator": {"name": "Test Suite", "version": "1.0"}
        // Missing "entries" field
      }
    };
    
    const filePath = path.join(this.testDir, 'malformed.har');
    await fs.writeFile(filePath, JSON.stringify(malformedData, null, 2));
    return filePath;
  }

  async createLargeHarFile(entryCount) {
    const entries = [];
    
    for (let i = 0; i < entryCount; i++) {
      entries.push({
        "startedDateTime": `2025-01-01T10:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}.000Z`,
        "time": Math.floor(Math.random() * 1000) + 100,
        "request": {
          "method": ["GET", "POST", "PUT", "DELETE"][Math.floor(Math.random() * 4)],
          "url": `https://api.example.com/endpoint${i}`,
          "httpVersion": "HTTP/1.1",
          "headers": [
            {"name": "Accept", "value": "application/json"},
            {"name": "User-Agent", "value": "Test-Agent/1.0"}
          ],
          "cookies": [],
          "queryString": [],
          "postData": {}
        },
        "response": {
          "status": [200, 201, 400, 404][Math.floor(Math.random() * 4)],
          "statusText": "OK",
          "httpVersion": "HTTP/1.1",
          "headers": [
            {"name": "Content-Type", "value": "application/json"}
          ],
          "cookies": [],
          "content": {
            "size": 50,
            "mimeType": "application/json",
            "text": `{"id": ${i}, "data": "test"}`
          }
        }
      });
    }
    
    const harData = {
      "log": {
        "version": "1.2",
        "creator": {"name": "Test Suite", "version": "1.0"},
        "entries": entries
      }
    };
    
    const filePath = path.join(this.testDir, 'large.har');
    await fs.writeFile(filePath, JSON.stringify(harData, null, 2));
    return filePath;
  }

  // Utility methods

  async ensureDirectories() {
    try {
      await fs.access(this.testDir);
    } catch {
      await fs.mkdir(this.testDir, { recursive: true });
    }
    
    try {
      await fs.access(this.tempDir);
    } catch {
      await fs.mkdir(this.tempDir, { recursive: true });
    }
  }

  assert(condition, message) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
    
    if (this.verbose) {
      console.log(`  ✓ ${message}`);
    }
  }

  recordTest(testName, passed, error = null) {
    this.testResults.push({
      name: testName,
      passed,
      error,
      timestamp: new Date()
    });
    
    const status = passed ? '✅' : '❌';
    console.log(`  ${status} ${testName}`);
    
    if (error && this.verbose) {
      console.log(`    Error: ${error}`);
    }
  }

  generateReport(duration) {
    const passed = this.testResults.filter(t => t.passed).length;
    const failed = this.testResults.filter(t => !t.passed).length;
    const total = this.testResults.length;
    const successRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    
    return {
      total,
      passed,
      failed,
      duration,
      successRate,
      failedTests: this.testResults.filter(t => !t.passed),
      allTests: this.testResults
    };
  }

  async cleanup() {
    try {
      const files = await fs.readdir(this.testDir);
      await Promise.all(
        files.map(file => fs.unlink(path.join(this.testDir, file)))
      );
      
      const tempFiles = await fs.readdir(this.tempDir);
      await Promise.all(
        tempFiles.map(file => fs.unlink(path.join(this.tempDir, file)))
      );
    } catch (error) {
      console.warn('Cleanup warning:', error.message);
    }
  }
}

// Export for use in other files
module.exports = InteguruTestSuite;

// Run tests if this file is executed directly
if (require.main === module) {
  const testSuite = new InteguruTestSuite({
    verbose: true
  });
  
  testSuite.runAllTests()
    .then(report => {
      process.exit(report.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Test suite failed:', error);
      process.exit(1);
    });
}