# mitmproxy Recording Addon Implementation

This document describes the complete mitmproxy recording addon implementation for the CDP automation system.

## Overview

The mitmproxy recording addon provides multi-level activity recording capabilities for network traffic analysis and automation. It supports:

- **Level 1**: Network-only HAR export for Integuru
- **Level 2**: Full request/response body analysis
- **Level 3**: Performance metrics (latency, size, timing)
- **Level 4**: WebSocket and Server-Sent Events monitoring

## Components

### 1. mitmproxy Addon (`.mitmproxy/record_addon.py`)

The core Python addon that hooks into mitmproxy's event system to capture network activity.

**Features:**
- Multi-level recording with configurable detail
- Session management with timestamped directories
- Comprehensive logging
- HAR export compatibility
- WebSocket message capture
- Performance metrics collection

**Usage:**
```bash
mitmdump -s ~/.mitmproxy/record_addon.py --set hardump=./network_requests.har --set flow_detail=3 -q
```

### 2. Configuration (`.mitmproxy/config.yaml`)

Configuration file that optimizes mitmproxy for HAR export and performance monitoring.

**Key Settings:**
- Network settings (host, port, mode)
- HAR export settings with flow_detail=3
- Performance tuning parameters
- SSL/TLS configuration
- WebSocket support

### 3. Node.js Controller (`src/lib/mitmproxy-controller.js`)

Programmatic control over mitmproxy instances from Node.js.

**Features:**
- Start/stop mitmproxy programmatically
- HAR file management
- Session directory handling
- Integration with the MCP server
- Error handling and process management

**Example:**
```javascript
const MitmproxyController = require('./mitmproxy-controller');

const controller = new MitmproxyController({
    recordLevel: 3,
    host: '127.0.0.1',
    port: 8080
});

// Start recording
const sessionId = await controller.start();

// Stop recording
const sessionSummary = await controller.stop();
```

### 4. HAR Parser (`src/lib/har-parser.js`)

Utility for parsing, validating, and extracting information from HAR files.

**Features:**
- HAR structure validation
- Statistics extraction
- API endpoint detection
- Header analysis
- Integuru compatibility validation

**Example:**
```javascript
const HarParser = require('./har-parser');

const parser = new HarParser();
const stats = await parser.getHarStatistics('network_requests.har');
const validation = await parser.validateForInteguru('network_requests.har');
```

### 5. Cookie Extractor (`src/lib/cookie-extractor.js`)

Specialized utility for extracting and analyzing cookies from HAR files.

**Features:**
- Cookie extraction by domain
- Integuru format conversion
- Browser extension format
- Session vs persistent cookie analysis
- Authentication cookie detection
- Security analysis

**Example:**
```javascript
const CookieExtractor = require('./cookie-extractor');

const extractor = new CookieExtractor();
const cookies = await extractor.extractCookiesForInteguru('network_requests.har');
const authCookies = await extractor.extractAuthCookies('network_requests.har');
```

### 6. Network Analyzer (`src/lib/network-analyzer.js`)

Comprehensive network traffic analysis tool.

**Features:**
- Domain analysis
- Performance metrics
- Security assessment
- Traffic pattern analysis
- Content type analysis
- Error analysis

**Example:**
```javascript
const NetworkAnalyzer = require('./network-analyzer');

const analyzer = new NetworkAnalyzer();
const analysis = await analyzer.analyzeNetworkActivity('network_requests.har');
```

### 7. Performance Collector (`src/lib/performance-collector.js`)

Performance metrics collection and reporting.

**Features:**
- Network performance metrics
- Timing analysis
- Resource optimization recommendations
- User experience scoring
- HTML report generation

**Example:**
```javascript
const PerformanceCollector = require('./performance-collector');

const collector = new PerformanceCollector();
const metrics = await collector.collectMetrics('network_requests.har');
const report = collector.generateReport(metrics);
```

## Installation

1. Install mitmproxy:
```bash
pip install mitmproxy
```

2. Ensure the addon and configuration files are in place:
```bash
.mitmproxy/
├── config.yaml
└── record_addon.py
```

3. Install Node.js dependencies (if using the controller):
```bash
npm install
```

## Usage

### Basic Recording

1. Start mitmproxy with the addon:
```bash
mitmdump -s ~/.mitmproxy/record_addon.py --set hardump=./network_requests.har --set flow_detail=3 -q
```

2. Configure your browser to use the proxy (127.0.0.1:8080)

3. Perform the actions you want to record

4. Stop mitmproxy (Ctrl+C)

### Programmatic Control

```javascript
const MitmproxyController = require('./mitmproxy-controller');

async function recordTraffic() {
    const controller = new MitmproxyController({
        recordLevel: 3,
        host: '127.0.0.1',
        port: 8080
    });
    
    // Start recording
    const sessionId = await controller.start();
    console.log(`Recording started with session ID: ${sessionId}`);
    
    // Wait for user actions
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    // Stop recording
    const summary = await controller.stop();
    console.log('Recording stopped:', summary);
    
    // Get session files
    const files = await controller.getSessionFiles();
    console.log('Session files:', files);
}

recordTraffic().catch(console.error);
```

### Analysis

```javascript
const HarParser = require('./har-parser');
const CookieExtractor = require('./cookie-extractor');
const NetworkAnalyzer = require('./network-analyzer');
const PerformanceCollector = require('./performance-collector');

async function analyzeRecording(harFile) {
    // Parse HAR
    const parser = new HarParser();
    const stats = await parser.getHarStatistics(harFile);
    console.log('HAR Statistics:', stats);
    
    // Extract cookies
    const extractor = new CookieExtractor();
    const cookies = await extractor.extractCookiesForInteguru(harFile);
    console.log('Cookies for Integuru:', cookies);
    
    // Analyze network
    const analyzer = new NetworkAnalyzer();
    const analysis = await analyzer.analyzeNetworkActivity(harFile);
    console.log('Network Analysis:', analysis);
    
    // Collect performance metrics
    const collector = new PerformanceCollector();
    const metrics = await collector.collectMetrics(harFile);
    console.log('Performance Metrics:', metrics);
    
    return { stats, cookies, analysis, metrics };
}

analyzeRecording('./network_requests.har').catch(console.error);
```

## Recording Levels

### Level 1: Network-only
- Basic request/response metadata
- HAR export for Integuru
- Minimal performance impact

### Level 2: Full Bodies
- Request/response content
- Body size tracking
- Content previews

### Level 3: Performance Metrics
- Detailed timing information
- Size analysis
- Performance bottlenecks

### Level 4: WebSocket/SSE
- WebSocket message capture
- Server-Sent Events
- Real-time protocol analysis

## Integration with Integuru

The system is designed to work seamlessly with Integuru for API reverse-engineering:

1. Record network traffic with Level 1+ recording
2. Extract cookies in Integuru format
3. Validate HAR file for Integuru compatibility
4. Pass HAR and cookies to Integuru for analysis

## Testing

Run the test suite to verify the implementation:

```bash
cd src/lib
node test-mitmproxy.js
```

The test suite verifies:
- mitmproxy installation
- HAR parsing and validation
- Cookie extraction
- Network analysis
- Performance collection
- Controller functionality

## Session Management

Recordings are organized in timestamped sessions:

```
activity_sessions/
└── 2025-01-01T12-00-00-000Z/
    ├── network_activity.json
    ├── performance_metrics.json
    ├── websocket_messages.json
    ├── recorder.log
    └── session_summary.json
```

## Troubleshooting

### mitmproxy not capturing HTTPS
- Install mitmproxy CA certificate: `mitmdump -C ~/`
- Visit http://mitm.it in your browser
- Install the certificate for your platform

### Performance issues
- Reduce flow_detail from 3 to 2 or 1
- Limit recording level if not needed
- Use hardware acceleration if available

### Large HAR files
- Filter recordings to specific domains
- Use Level 1 recording for basic needs
- Implement HAR file rotation

## Security Considerations

- All network traffic is intercepted and logged
- Sensitive data may be captured in recordings
- Store session files securely
- Clean up old sessions regularly
- Use encryption for stored recordings

## Future Enhancements

- Real-time analysis dashboard
- Automated threat detection
- Machine learning-based pattern recognition
- Cloud storage integration
- Multi-proxy support
- Advanced filtering capabilities