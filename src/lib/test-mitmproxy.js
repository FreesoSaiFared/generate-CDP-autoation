/**
 * Test script for mitmproxy recording addon implementation
 * 
 * This script tests the various components of the mitmproxy recording system
 * to ensure they work correctly together.
 */

const MitmproxyController = require('./mitmproxy-controller');
const HarParser = require('./har-parser');
const CookieExtractor = require('./cookie-extractor');
const NetworkAnalyzer = require('./network-analyzer');
const PerformanceCollector = require('./performance-collector');
const fs = require('fs').promises;
const path = require('path');

class MitmproxyTester {
    constructor() {
        this.testResults = {
            passed: 0,
            failed: 0,
            tests: []
        };
    }
    
    /**
     * Run all tests
     */
    async runAllTests() {
        console.log('Starting mitmproxy implementation tests...\n');
        
        // Test 1: Check if mitmproxy is installed
        await this.testMitmproxyInstallation();
        
        // Test 2: Test HAR parser
        await this.testHarParser();
        
        // Test 3: Test cookie extractor
        await this.testCookieExtractor();
        
        // Test 4: Test network analyzer
        await this.testNetworkAnalyzer();
        
        // Test 5: Test performance collector
        await this.testPerformanceCollector();
        
        // Test 6: Test mitmproxy controller
        await this.testMitmproxyController();
        
        // Print results
        this.printResults();
    }
    
    /**
     * Test if mitmproxy is installed
     */
    async testMitmproxyInstallation() {
        const testName = 'mitmproxy installation';
        
        try {
            const isInstalled = await MitmproxyController.isInstalled();
            const version = await MitmproxyController.getVersion();
            
            if (isInstalled) {
                this.addTestResult(testName, true, `mitmproxy ${version} is installed`);
            } else {
                this.addTestResult(testName, false, 'mitmproxy is not installed');
            }
        } catch (error) {
            this.addTestResult(testName, false, `Error: ${error.message}`);
        }
    }
    
    /**
     * Test HAR parser
     */
    async testHarParser() {
        const testName = 'HAR parser';
        
        try {
            const harParser = new HarParser();
            
            // Create a minimal HAR file for testing
            const testHar = {
                log: {
                    version: '1.2',
                    creator: { name: 'test' },
                    entries: [
                        {
                            startedDateTime: '2025-01-01T00:00:00.000Z',
                            request: {
                                method: 'GET',
                                url: 'https://example.com/api/test',
                                httpVersion: 'HTTP/1.1',
                                headers: [],
                                cookies: [],
                                queryString: [],
                                headersSize: 0,
                                bodySize: 0
                            },
                            response: {
                                status: 200,
                                statusText: 'OK',
                                httpVersion: 'HTTP/1.1',
                                headers: [],
                                cookies: [],
                                content: { size: 0, mimeType: 'application/json' },
                                redirectURL: '',
                                headersSize: 0,
                                bodySize: 0
                            },
                            cache: {},
                            timings: { send: 0, wait: 100, receive: 0 },
                            time: 100
                        }
                    ]
                }
            };
            
            // Test parsing
            const stats = await harParser.getHarStatistics(testHar);
            
            if (stats.totalRequests === 1 && stats.averageRequestTime === 100) {
                this.addTestResult(testName, true, 'HAR parser works correctly');
            } else {
                this.addTestResult(testName, false, 'HAR parser returned incorrect statistics');
            }
            
            // Test validation
            const validation = await harParser.validateForInteguru(testHar);
            if (validation.isValid) {
                this.addTestResult(`${testName} - validation`, true, 'HAR validation works');
            } else {
                this.addTestResult(`${testName} - validation`, false, 'HAR validation failed');
            }
            
        } catch (error) {
            this.addTestResult(testName, false, `Error: ${error.message}`);
        }
    }
    
    /**
     * Test cookie extractor
     */
    async testCookieExtractor() {
        const testName = 'Cookie extractor';
        
        try {
            const cookieExtractor = new CookieExtractor();
            
            // Create test HAR with cookies
            const testHar = {
                log: {
                    version: '1.2',
                    creator: { name: 'test' },
                    entries: [
                        {
                            startedDateTime: '2025-01-01T00:00:00.000Z',
                            request: {
                                method: 'GET',
                                url: 'https://example.com/api/test',
                                httpVersion: 'HTTP/1.1',
                                headers: [],
                                cookies: [
                                    { name: 'session_id', value: 'abc123', domain: 'example.com' },
                                    { name: 'auth_token', value: 'xyz789', domain: 'example.com' }
                                ],
                                queryString: [],
                                headersSize: 0,
                                bodySize: 0
                            },
                            response: {
                                status: 200,
                                statusText: 'OK',
                                httpVersion: 'HTTP/1.1',
                                headers: [],
                                cookies: [
                                    { name: 'csrf_token', value: 'def456', domain: 'example.com' }
                                ],
                                content: { size: 0, mimeType: 'application/json' },
                                redirectURL: '',
                                headersSize: 0,
                                bodySize: 0
                            },
                            cache: {},
                            timings: { send: 0, wait: 100, receive: 0 },
                            time: 100
                        }
                    ]
                }
            };
            
            // Test cookie extraction
            const cookies = await cookieExtractor.extractCookies(testHar);
            
            if (cookies.allCookies['example.com'] && 
                Object.keys(cookies.allCookies['example.com']).length === 3) {
                this.addTestResult(testName, true, 'Cookie extraction works correctly');
            } else {
                this.addTestResult(testName, false, 'Cookie extraction returned incorrect results');
            }
            
            // Test Integuru format
            const integuruCookies = await cookieExtractor.extractCookiesForInteguru(testHar);
            
            if (integuruCookies.session_id === 'abc123' && integuruCookies.auth_token === 'xyz789') {
                this.addTestResult(`${testName} - Integuru format`, true, 'Integuru cookie format works');
            } else {
                this.addTestResult(`${testName} - Integuru format`, false, 'Integuru cookie format failed');
            }
            
        } catch (error) {
            this.addTestResult(testName, false, `Error: ${error.message}`);
        }
    }
    
    /**
     * Test network analyzer
     */
    async testNetworkAnalyzer() {
        const testName = 'Network analyzer';
        
        try {
            const networkAnalyzer = new NetworkAnalyzer();
            
            // Create test HAR with multiple entries
            const testHar = {
                log: {
                    version: '1.2',
                    creator: { name: 'test' },
                    entries: [
                        {
                            startedDateTime: '2025-01-01T00:00:00.000Z',
                            request: {
                                method: 'GET',
                                url: 'https://api.example.com/v1/users',
                                httpVersion: 'HTTP/1.1',
                                headers: [],
                                cookies: [],
                                queryString: [],
                                headersSize: 0,
                                bodySize: 0
                            },
                            response: {
                                status: 200,
                                statusText: 'OK',
                                httpVersion: 'HTTP/1.1',
                                headers: [
                                    { name: 'content-type', value: 'application/json' }
                                ],
                                cookies: [],
                                content: { size: 1024, mimeType: 'application/json' },
                                redirectURL: '',
                                headersSize: 0,
                                bodySize: 1024
                            },
                            cache: {},
                            timings: { send: 0, wait: 150, receive: 0 },
                            time: 150
                        },
                        {
                            startedDateTime: '2025-01-01T00:00:01.000Z',
                            request: {
                                method: 'POST',
                                url: 'https://api.example.com/v1/auth/login',
                                httpVersion: 'HTTP/1.1',
                                headers: [],
                                cookies: [],
                                queryString: [],
                                headersSize: 0,
                                bodySize: 512
                            },
                            response: {
                                status: 201,
                                statusText: 'Created',
                                httpVersion: 'HTTP/1.1',
                                headers: [
                                    { name: 'content-type', value: 'application/json' }
                                ],
                                cookies: [],
                                content: { size: 256, mimeType: 'application/json' },
                                redirectURL: '',
                                headersSize: 0,
                                bodySize: 256
                            },
                            cache: {},
                            timings: { send: 10, wait: 200, receive: 10 },
                            time: 220
                        }
                    ]
                }
            };
            
            // Test network analysis
            const analysis = await networkAnalyzer.analyzeNetworkActivity(testHar);
            
            if (analysis.summary.totalRequests === 2 && 
                Object.keys(analysis.apiEndpoints).length > 0) {
                this.addTestResult(testName, true, 'Network analysis works correctly');
            } else {
                this.addTestResult(testName, false, 'Network analysis returned incorrect results');
            }
            
        } catch (error) {
            this.addTestResult(testName, false, `Error: ${error.message}`);
        }
    }
    
    /**
     * Test performance collector
     */
    async testPerformanceCollector() {
        const testName = 'Performance collector';
        
        try {
            const performanceCollector = new PerformanceCollector();
            
            // Create test HAR with timing data
            const testHar = {
                log: {
                    version: '1.2',
                    creator: { name: 'test' },
                    entries: [
                        {
                            startedDateTime: '2025-01-01T00:00:00.000Z',
                            request: {
                                method: 'GET',
                                url: 'https://example.com/',
                                httpVersion: 'HTTP/1.1',
                                headers: [],
                                cookies: [],
                                queryString: [],
                                headersSize: 0,
                                bodySize: 0
                            },
                            response: {
                                status: 200,
                                statusText: 'OK',
                                httpVersion: 'HTTP/1.1',
                                headers: [
                                    { name: 'content-type', value: 'text/html' },
                                    { name: 'content-encoding', value: 'gzip' }
                                ],
                                cookies: [],
                                content: { size: 10240, mimeType: 'text/html' },
                                redirectURL: '',
                                headersSize: 0,
                                bodySize: 2048
                            },
                            cache: {},
                            timings: { 
                                dns: 50, 
                                connect: 100, 
                                ssl: 50, 
                                send: 10, 
                                wait: 300, 
                                receive: 20 
                            },
                            time: 530
                        }
                    ]
                }
            };
            
            // Test performance collection
            const metrics = await performanceCollector.collectMetrics(testHar);
            
            if (metrics.network.totalRequests === 1 && 
                metrics.timing.averageRequestTime === 530) {
                this.addTestResult(testName, true, 'Performance collection works correctly');
            } else {
                this.addTestResult(testName, false, 'Performance collection returned incorrect results');
            }
            
        } catch (error) {
            this.addTestResult(testName, false, `Error: ${error.message}`);
        }
    }
    
    /**
     * Test mitmproxy controller
     */
    async testMitmproxyController() {
        const testName = 'Mitmproxy controller';
        
        try {
            const controller = new MitmproxyController({
                host: '127.0.0.1',
                port: 8081  // Use different port to avoid conflicts
            });
            
            // Test status
            const status = controller.getStatus();
            
            if (status.options.host === '127.0.0.1' && 
                status.options.port === 8081 &&
                !status.isRunning) {
                this.addTestResult(testName, true, 'Mitmproxy controller initialized correctly');
            } else {
                this.addTestResult(testName, false, 'Mitmproxy controller initialization failed');
            }
            
            // Test session ID generation
            const sessionId = controller.generateSessionId();
            
            if (sessionId && sessionId.startsWith('session-')) {
                this.addTestResult(`${testName} - session ID`, true, 'Session ID generation works');
            } else {
                this.addTestResult(`${testName} - session ID`, false, 'Session ID generation failed');
            }
            
        } catch (error) {
            this.addTestResult(testName, false, `Error: ${error.message}`);
        }
    }
    
    /**
     * Add test result
     */
    addTestResult(testName, passed, message) {
        this.testResults.tests.push({
            name: testName,
            passed,
            message
        });
        
        if (passed) {
            this.testResults.passed++;
            console.log(`✅ ${testName}: ${message}`);
        } else {
            this.testResults.failed++;
            console.log(`❌ ${testName}: ${message}`);
        }
    }
    
    /**
     * Print test results
     */
    printResults() {
        console.log('\n' + '='.repeat(50));
        console.log('TEST RESULTS');
        console.log('='.repeat(50));
        console.log(`Total tests: ${this.testResults.passed + this.testResults.failed}`);
        console.log(`Passed: ${this.testResults.passed}`);
        console.log(`Failed: ${this.testResults.failed}`);
        console.log(`Success rate: ${((this.testResults.passed / (this.testResults.passed + this.testResults.failed)) * 100).toFixed(1)}%`);
        
        if (this.testResults.failed > 0) {
            console.log('\nFailed tests:');
            this.testResults.tests
                .filter(test => !test.passed)
                .forEach(test => {
                    console.log(`  - ${test.name}: ${test.message}`);
                });
        }
        
        console.log('\n' + '='.repeat(50));
        
        if (this.testResults.failed === 0) {
            console.log('🎉 All tests passed! The mitmproxy implementation is ready.');
        } else {
            console.log('⚠️  Some tests failed. Please review the implementation.');
        }
    }
}

// Run tests if this script is executed directly
if (require.main === module) {
    const tester = new MitmproxyTester();
    tester.runAllTests().catch(error => {
        console.error('Error running tests:', error);
        process.exit(1);
    });
}

module.exports = MitmproxyTester;