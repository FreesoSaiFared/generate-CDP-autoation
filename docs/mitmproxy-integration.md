# mitmproxy Integration Documentation

The mitmproxy integration provides comprehensive network interception and recording capabilities for the CDP automation system. It captures HTTP/HTTPS traffic, generates HAR files for analysis, and integrates seamlessly with Integuru for API reverse-engineering.

## Overview

mitmproxy serves as the network layer between the browser and the internet, capturing all requests and responses for analysis. This captured data is essential for:

- HAR file generation for Integuru analysis
- Network activity logging and debugging
- Request/response inspection and modification
- API endpoint identification and documentation
- Authentication flow analysis

## Installation

### Prerequisites

- Python 3.8+
- pip package manager
- Administrative privileges (for SSL certificate installation)

### Installation Steps

```bash
# Install mitmproxy
pip install mitmproxy

# Verify installation
mitmdump --version

# Install additional dependencies
pip install requests websocket-client
```

### SSL Certificate Setup

```bash
# Start mitmproxy to generate certificates
mitmproxy

# Navigate to http://mitm.it in Chrome
# Download and install the certificate for your platform
# Chrome: Settings -> Privacy and security -> Manage certificates -> Import
```

## Configuration

### mitmproxy Configuration File

**Location**: [`.mitmproxy/config.yaml`](../.mitmproxy/config.yaml)

```yaml
# mitmproxy configuration
server:
  # Listen on all interfaces
  listen_host: 0.0.0.0
  listen_port: 8080
  
  # SSL/TLS settings
  ssl_insecure: true
  add_upstream_certs_to_client_chain: false
  certs: []
  
# Flow detail level (0-4)
flow_detail: 3

# HAR export settings
hardump:
  path: "./network_requests.har"
  format: "json"
  
# Console settings
console:
  eventlog_verbosity: info
  focus_follow: true
  
# Script settings
scripts:
  - "~/.mitmproxy/record_addon.py"
```

### Custom Recording Addon

**Location**: [`.mitmproxy/record_addon.py`](../.mitmproxy/record_addon.py)

```python
"""Multi-level activity recording for mitmproxy."""

import json
import os
from pathlib import Path
from datetime import datetime
from mitmproxy import http, ctx
from typing import Dict, List, Any

class LayeredRecorder:
    """Advanced network activity recorder with multiple capture levels."""
    
    def __init__(self):
        self.session_dir = None
        self.network_log = []
        self.api_endpoints = set()
        self.auth_flows = []
        self.current_flow = None
        self.capture_level = 2
        
    def load(self, loader):
        """Initialize the addon."""
        ctx.log.info("LayeredRecorder addon loaded")
        
    def configure(self, updated):
        """Handle configuration updates."""
        if "capture_level" in updated:
            self.capture_level = updated.capture_level
            
    def running(self):
        """Start recording session."""
        self.session_dir = Path(f"./sessions/{datetime.now().isoformat()}")
        self.session_dir.mkdir(parents=True, exist_ok=True)
        self.network_log = []
        ctx.log.info(f"Recording session to: {self.session_dir}")
        
    def request(self, flow: http.HTTPFlow) -> None:
        """Capture incoming request."""
        if self.should_capture_request(flow):
            request_data = self.extract_request_data(flow)
            self.network_log.append(request_data)
            self.current_flow = flow
            
            # Track API endpoints
            if self.is_api_endpoint(flow.request.url):
                self.api_endpoints.add(flow.request.url)
                
    def response(self, flow: http.HTTPFlow) -> None:
        """Capture outgoing response."""
        if self.current_flow == flow and self.should_capture_response(flow):
            response_data = self.extract_response_data(flow)
            self.network_log.append(response_data)
            
            # Track authentication flows
            if self.is_auth_flow(flow):
                self.auth_flows.append({
                    'url': flow.request.url,
                    'method': flow.request.method,
                    'status': flow.response.status_code,
                    'timestamp': datetime.now().isoformat()
                })
                
    def should_capture_request(self, flow: http.HTTPFlow) -> bool:
        """Determine if request should be captured based on level."""
        if self.capture_level <= 1:
            return False
            
        # Level 2: Capture API requests only
        if self.capture_level == 2:
            return self.is_api_endpoint(flow.request.url)
            
        # Level 3+: Capture all requests except static assets
        excluded_extensions = ['.js', '.css', '.png', '.jpg', '.gif', '.ico', '.woff']
        return not any(flow.request.url.endswith(ext) for ext in excluded_extensions)
        
    def should_capture_response(self, flow: http.HTTPFlow) -> bool:
        """Determine if response should be captured."""
        return self.should_capture_request(flow)
        
    def extract_request_data(self, flow: http.HTTPFlow) -> Dict[str, Any]:
        """Extract relevant request data."""
        request = flow.request
        
        data = {
            "timestamp": datetime.now().isoformat(),
            "type": "request",
            "method": request.method,
            "url": request.url,
            "headers": dict(request.headers),
            "query": dict(request.query) if request.query else {},
            "cookies": dict(request.cookies) if request.cookies else {}
        }
        
        # Add body data for POST/PUT requests
        if request.method in ["POST", "PUT", "PATCH"] and request.content:
            try:
                if "application/json" in request.headers.get("content-type", ""):
                    data["body"] = json.loads(request.content.decode())
                else:
                    data["body"] = request.content.decode()
            except Exception:
                data["body"] = request.content.decode(errors="ignore")
                
        return data
        
    def extract_response_data(self, flow: http.HTTPFlow) -> Dict[str, Any]:
        """Extract relevant response data."""
        response = flow.response
        
        data = {
            "timestamp": datetime.now().isoformat(),
            "type": "response",
            "url": flow.request.url,
            "status": response.status_code,
            "status_text": response.reason,
            "headers": dict(response.headers),
            "size": len(response.content) if response.content else 0
        }
        
        # Add response body for successful responses
        if response.status_code < 400 and response.content:
            try:
                if "application/json" in response.headers.get("content-type", ""):
                    data["body"] = json.loads(response.content.decode())
                else:
                    data["body"] = response.content.decode(errors="ignore")
            except Exception:
                data["body"] = response.content.decode(errors="ignore")
                
        return data
        
    def is_api_endpoint(self, url: str) -> bool:
        """Check if URL is an API endpoint."""
        api_patterns = ["/api/", "/v1/", "/v2/", "/graphql", "/rest/"]
        return any(pattern in url for pattern in api_patterns)
        
    def is_auth_flow(self, flow: http.HTTPFlow) -> bool:
        """Check if flow is part of authentication."""
        auth_indicators = ["login", "auth", "signin", "token", "session", "oauth"]
        url_lower = flow.request.url.lower()
        return any(indicator in url_lower for indicator in auth_indicators)
        
    def done(self):
        """Save recorded data."""
        if not self.session_dir:
            return
            
        # Save network log
        network_file = self.session_dir / "network.json"
        with open(network_file, "w") as f:
            json.dump(self.network_log, f, indent=2)
            
        # Save API endpoints
        api_file = self.session_dir / "api_endpoints.json"
        with open(api_file, "w") as f:
            json.dump(list(self.api_endpoints), f, indent=2)
            
        # Save authentication flows
        auth_file = self.session_dir / "auth_flows.json"
        with open(auth_file, "w") as f:
            json.dump(self.auth_flows, f, indent=2)
            
        # Generate HAR file
        har_file = self.session_dir / "network.har"
        self.generate_har_file(har_file)
        
        ctx.log.info(f"Recording saved to: {self.session_dir}")
        
    def generate_har_file(self, output_path: Path):
        """Generate HAR file from captured data."""
        har_data = {
            "log": {
                "version": "1.2",
                "creator": {
                    "name": "mitmproxy-layered-recorder",
                    "version": "1.0.0"
                },
                "entries": []
            }
        }
        
        # Process network log into HAR format
        requests = {}
        for entry in self.network_log:
            if entry["type"] == "request":
                requests[entry["url"]] = entry
                
        for entry in self.network_log:
            if entry["type"] == "response":
                request = requests.get(entry["url"])
                if request:
                    har_entry = self.convert_to_har_entry(request, entry)
                    har_data["log"]["entries"].append(har_entry)
                    
        with open(output_path, "w") as f:
            json.dump(har_data, f, indent=2)
            
    def convert_to_har_entry(self, request: Dict, response: Dict) -> Dict:
        """Convert request/response pair to HAR entry."""
        return {
            "startedDateTime": request["timestamp"],
            "time": 0,  # Calculate actual timing
            "request": {
                "method": request["method"],
                "url": request["url"],
                "httpVersion": "HTTP/1.1",
                "headers": [
                    {"name": k, "value": v} for k, v in request["headers"].items()
                ],
                "queryString": [
                    {"name": k, "value": v} for k, v in request.get("query", {}).items()
                ],
                "postData": {
                    "text": request.get("body", ""),
                    "mimeType": request["headers"].get("content-type", "")
                } if request.get("body") else None,
                "headersSize": -1,
                "bodySize": len(request.get("body", ""))
            },
            "response": {
                "status": response["status"],
                "statusText": response["status_text"],
                "httpVersion": "HTTP/1.1",
                "headers": [
                    {"name": k, "value": v} for k, v in response["headers"].items()
                ],
                "content": {
                    "text": response.get("body", ""),
                    "size": response.get("size", 0),
                    "mimeType": response["headers"].get("content-type", "")
                },
                "headersSize": -1,
                "bodySize": response.get("size", 0)
            },
            "cache": {},
            "timings": {
                "send": 0,
                "wait": 0,
                "receive": 0
            }
        }

# Instantiate addon
addons = [LayeredRecorder()]
```

## Usage

### Basic Network Recording

```bash
# Start mitmproxy with default settings
mitmdump -s .mitmproxy/record_addon.py --set hardump=./network.har

# Start with custom configuration
mitmdump -s .mitmproxy/record_addon.py \
  --set hardump=./network.har \
  --set flow_detail=3 \
  --set console_eventlog_verbosity=info
```

### Chrome Proxy Configuration

```bash
# Launch Chrome with proxy settings
google-chrome \
  --proxy-server=http://127.0.0.1:8080 \
  --ignore-certificate-errors \
  --user-data-dir=./chrome-profile
```

### Using with Chrome Stealth Launcher

Modify [`chrome_start.sh`](../cdp-stealth/chrome_start.sh) to include proxy:

```bash
# Add proxy configuration
if [[ -n "$MITMPROXY_ENABLED" ]]; then
    CHROME_ARGS+=(--proxy-server=http://127.0.0.1:8080)
    CHROME_ARGS+=(--ignore-certificate-errors)
fi
```

Then launch with proxy:

```bash
export MITMPROXY_ENABLED=true
bash chrome_start.sh
```

## Integration with CDP Automation

### Network Capture Integration

```javascript
// In CDP automation script
const { spawn } = require('child_process');
const path = require('path');

class MitmproxyController {
  constructor(options = {}) {
    this.process = null;
    this.recording = false;
    this.sessionDir = options.sessionDir || './sessions';
    this.harPath = options.harPath || './network.har';
  }
  
  async startRecording(options = {}) {
    if (this.recording) {
      throw new Error('Recording already in progress');
    }
    
    const args = [
      '-s', path.join(__dirname, '../.mitmproxy/record_addon.py'),
      '--set', `hardump=${this.harPath}`,
      '--set', `flow_detail=${options.level || 3}`,
      '--set', 'console_eventlog_verbosity=info',
      '-q'  # Quiet mode
    ];
    
    this.process = spawn('mitmdump', args);
    
    return new Promise((resolve, reject) => {
      this.process.stdout.on('data', (data) => {
        console.log(`mitmproxy: ${data}`);
      });
      
      this.process.stderr.on('data', (data) => {
        console.error(`mitmproxy error: ${data}`);
      });
      
      this.process.on('spawn', () => {
        this.recording = true;
        resolve();
      });
      
      this.process.on('error', reject);
    });
  }
  
  async stopRecording() {
    if (!this.recording || !this.process) {
      return;
    }
    
    return new Promise((resolve) => {
      this.process.on('close', (code) => {
        this.recording = false;
        console.log(`mitmproxy exited with code ${code}`);
        resolve();
      });
      
      this.process.kill('SIGTERM');
    });
  }
  
  isRecording() {
    return this.recording;
  }
}

// Usage example
const mitmproxy = new MitmproxyController();

// Start recording
await mitmproxy.startRecording({ level: 3 });

// Perform browser automation
// ... your automation code here ...

// Stop recording
await mitmproxy.stopRecording();
```

### HAR File Processing

```javascript
const fs = require('fs').promises;
const path = require('path');

class HARProcessor {
  constructor(harPath) {
    this.harPath = harPath;
    this.data = null;
  }
  
  async load() {
    const content = await fs.readFile(this.harPath, 'utf8');
    this.data = JSON.parse(content);
    return this;
  }
  
  getAPIEndpoints() {
    if (!this.data) return [];
    
    const entries = this.data.log.entries;
    const apiEndpoints = [];
    
    for (const entry of entries) {
      const url = entry.request.url;
      if (this.isAPIEndpoint(url)) {
        apiEndpoints.push({
          url,
          method: entry.request.method,
          status: entry.response.status,
          size: entry.response.bodySize,
          contentType: entry.response.content.mimeType
        });
      }
    }
    
    return apiEndpoints;
  }
  
  getAuthenticationFlows() {
    if (!this.data) return [];
    
    const entries = this.data.log.entries;
    const authFlows = [];
    
    for (const entry of entries) {
      if (this.isAuthFlow(entry)) {
        authFlows.push({
          url: entry.request.url,
          method: entry.request.method,
          status: entry.response.status,
          headers: entry.request.headers,
          timestamp: entry.startedDateTime
        });
      }
    }
    
    return authFlows;
  }
  
  getCookies() {
    if (!this.data) return [];
    
    const entries = this.data.log.entries;
    const cookies = new Set();
    
    for (const entry of entries) {
      const setCookieHeaders = entry.response.headers.filter(
        h => h.name.toLowerCase() === 'set-cookie'
      );
      
      for (const header of setCookieHeaders) {
        cookies.add(header.value);
      }
    }
    
    return Array.from(cookies);
  }
  
  isAPIEndpoint(url) {
    const apiPatterns = ['/api/', '/v1/', '/v2/', '/graphql', '/rest/'];
    return apiPatterns.some(pattern => url.includes(pattern));
  }
  
  isAuthFlow(entry) {
    const authIndicators = ['login', 'auth', 'signin', 'token', 'session'];
    const url = entry.request.url.toLowerCase();
    return authIndicators.some(indicator => url.includes(indicator));
  }
}

// Usage example
async function analyzeNetwork() {
  const processor = new HARProcessor('./network.har');
  await processor.load();
  
  const apiEndpoints = processor.getAPIEndpoints();
  console.log(`Found ${apiEndpoints.length} API endpoints`);
  
  const authFlows = processor.getAuthenticationFlows();
  console.log(`Found ${authFlows.length} authentication flows`);
  
  const cookies = processor.getCookies();
  console.log(`Found ${cookies.length} cookies`);
  
  return { apiEndpoints, authFlows, cookies };
}
```

## Advanced Features

### Request/Response Modification

```python
# Add to record_addon.py
def requestheaders(self, flow: http.HTTPFlow):
    """Modify request headers."""
    # Add custom headers
    flow.request.headers["X-Custom-Header"] = "CDP-Automation"
    
    # Remove automation headers
    if "X-Automated" in flow.request.headers:
        del flow.request.headers["X-Automated"]

def responseheaders(self, flow: http.HTTPFlow):
    """Modify response headers."""
    # Add security headers
    flow.response.headers["X-Content-Type-Options"] = "nosniff"
```

### WebSocket Support

```python
def websocket_start(self, flow: http.HTTPFlow):
    """Handle WebSocket connection start."""
    ctx.log.info(f"WebSocket connection established: {flow.request.url}")

def websocket_message(self, flow: http.HTTPFlow):
    """Handle WebSocket messages."""
    for message in flow.websocket.messages:
        ctx.log.info(f"WebSocket {message.type}: {message.content}")
```

### SSL/TLS Inspection

```python
def tls_clienthello(self, data: tls.ClientHelloData):
    """Handle TLS Client Hello."""
    ctx.log.info(f"TLS connection to {data.client_hello.sni}")

def tls_established(self, data: tls.TlsData):
    """Handle established TLS connection."""
    ctx.log.info(f"TLS established with {data.conn.address}")
```

## Performance Optimization

### Memory Management

```python
# In record_addon.py
def __init__(self):
    self.max_entries = 10000  # Limit entries to prevent memory issues
    self.network_log = []
    self.session_count = 0
    
def should_capture_request(self, flow: http.HTTPFlow) -> bool:
    """Limit capture to prevent memory overflow."""
    if len(self.network_log) >= self.max_entries:
        # Save current batch and start new one
        self.save_batch()
        self.network_log = []
        self.session_count += 1
        
    return super().should_capture_request(flow)
```

### Disk Usage Optimization

```python
def done(self):
    """Compress saved data to save disk space."""
    import gzip
    import shutil
    
    # Compress network log
    network_file = self.session_dir / "network.json"
    compressed_file = self.session_dir / "network.json.gz"
    
    with open(network_file, 'rb') as f_in:
        with gzip.open(compressed_file, 'wb') as f_out:
            shutil.copyfileobj(f_in, f_out)
    
    # Remove uncompressed file
    network_file.unlink()
```

## Troubleshooting

### Common Issues

#### Certificate Errors

```bash
# Symptoms: SSL certificate errors in browser
# Solution: Reinstall mitmproxy certificate

# Generate new certificate
mitmproxy

# Navigate to http://mitm.it
# Download and install certificate for your platform

# Clear browser SSL cache
chrome://settings/clearBrowserData -> Select "Cached images and files"
```

#### Proxy Connection Refused

```bash
# Symptoms: Connection refused errors
# Solution: Check mitmproxy is running and accessible

# Check if mitmproxy is running
ps aux | grep mitmproxy

# Check port availability
netstat -tlnp | grep 8080

# Restart mitmproxy
pkill -f mitmproxy
mitmdump -s .mitmproxy/record_addon.py
```

#### HAR File Generation Issues

```python
# Symptoms: Empty or corrupted HAR files
# Solution: Add error handling and validation

def generate_har_file(self, output_path: Path):
    """Generate HAR file with error handling."""
    try:
        # ... HAR generation code ...
    except Exception as e:
        ctx.log.error(f"HAR generation failed: {e}")
        # Save raw data as fallback
        raw_file = output_path.with_suffix('.json')
        with open(raw_file, 'w') as f:
            json.dump(self.network_log, f, indent=2)
```

### Debug Mode

Enable verbose logging:

```bash
# Start mitmproxy with debug output
mitmdump -s .mitmproxy/record_addon.py \
  --set console_eventlog_verbosity=debug \
  --set flow_detail=4 \
  -v
```

Add debug logging to addon:

```python
def request(self, flow: http.HTTPFlow) -> None:
    """Debug request capture."""
    ctx.log.debug(f"Capturing request: {flow.request.method} {flow.request.url}")
    ctx.log.debug(f"Headers: {dict(flow.request.headers)}")
    
    # Continue with normal processing
    super().request(flow)
```

## References

- [mitmproxy Documentation](https://docs.mitmproxy.org/)
- [HAR File Format Specification](http://www.softwareishard.com/blog/har-12-spec/)
- [mitmproxy Python API](https://docs.mitmproxy.org/stable/addons-overview/)
- [WebSocket Support](https://docs.mitmproxy.org/stable/concepts-howmitmproxyworks/#websocket-support)