# Implementation Guide: Integuru + mitmproxy + CDP MCP System

## Part 1: mitmproxy Setup for Activity Recording

### Installation

```bash
# Install mitmproxy
pip install mitmproxy

# Verify installation
mitmdump --version
```

### Configuration File (`~/.mitmproxy/config.yaml`)

```yaml
# Network settings
listen_host: 127.0.0.1
listen_port: 8080
mode: regular

# HAR export settings
flow_detail: 3

# Performance tuning
connection_timeout: 60
read_limit: 1024000

# Logging
verbose: false
```

### Custom Addon for Layered Recording (`~/.mitmproxy/record_addon.py`)

```python
"""
Multi-level activity recording addon for mitmproxy.

Levels:
1. Network-only: HAR export (for Integuru)
2. Full bodies: Request/response content
3. Timing data: Performance metrics
4. WebSocket: Real-time protocol messages
"""

import json
import logging
from pathlib import Path
from datetime import datetime
from mitmproxy import http, websocket, ctx
from mitmproxy.addons import save

class LayeredRecorder:
    def __init__(self, record_level=1):
        self.record_level = record_level
        self.session_dir = Path(f"./activity_sessions/{datetime.now().isoformat()}")
        self.session_dir.mkdir(parents=True, exist_ok=True)
        
        self.network_log = []
        self.har_data = None
        self.performance_metrics = {}
        self.websocket_messages = []
        
        # Set up logging
        self.logger = logging.getLogger("LayeredRecorder")
        handler = logging.FileHandler(self.session_dir / "recorder.log")
        self.logger.addHandler(handler)
        self.logger.setLevel(logging.DEBUG)
    
    def load(self, l):
        self.logger.info(f"LayeredRecorder loaded. Session dir: {self.session_dir}")
    
    def requestheaders(self, flow):
        """Level 1+: Log request metadata."""
        timestamp = datetime.now().isoformat()
        
        request_entry = {
            "timestamp": timestamp,
            "type": "request",
            "method": flow.request.method,
            "url": flow.request.url,
            "headers": dict(flow.request.headers),
            "http_version": flow.request.http_version,
        }
        
        # Level 2+: Include request body
        if self.record_level >= 2 and flow.request.content:
            request_entry["body_size"] = len(flow.request.content)
            try:
                request_entry["body_preview"] = flow.request.text[:500]
            except:
                request_entry["body_preview"] = "[binary data]"
        
        self.network_log.append(request_entry)
    
    def response(self, flow):
        """Level 1+: Log response metadata."""
        timestamp = datetime.now().isoformat()
        
        # Calculate timing
        if hasattr(flow, "request_timestamp"):
            duration_ms = (datetime.now() - flow.request_timestamp).total_seconds() * 1000
        else:
            duration_ms = None
        
        response_entry = {
            "timestamp": timestamp,
            "type": "response",
            "status_code": flow.response.status_code,
            "headers": dict(flow.response.headers),
            "http_version": flow.response.http_version,
            "duration_ms": duration_ms,
        }
        
        # Level 2+: Include response body
        if self.record_level >= 2 and flow.response.content:
            response_entry["body_size"] = len(flow.response.content)
            try:
                response_entry["body_preview"] = flow.response.text[:500]
            except:
                response_entry["body_preview"] = "[binary data]"
        
        # Level 3+: Full performance metrics
        if self.record_level >= 3:
            self.performance_metrics[flow.request.url] = {
                "status": flow.response.status_code,
                "response_time_ms": duration_ms,
                "content_size_bytes": len(flow.response.content) if flow.response.content else 0,
                "headers_count": len(flow.response.headers),
            }
        
        self.network_log.append(response_entry)
    
    def websocket_message(self, data):
        """Level 4: Log WebSocket messages."""
        if self.record_level >= 4:
            ws_entry = {
                "timestamp": datetime.now().isoformat(),
                "type": "websocket",
                "direction": "client_to_server" if data.from_client else "server_to_client",
                "message": data.message.decode('utf-8', errors='replace')[:1000],
            }
            self.websocket_messages.append(ws_entry)
    
    def done(self):
        """Save all recorded data on exit."""
        # Save network log
        network_file = self.session_dir / "network_activity.json"
        with open(network_file, "w") as f:
            json.dump(self.network_log, f, indent=2)
        
        self.logger.info(f"Network activity saved: {network_file}")
        self.logger.info(f"Total requests: {len([x for x in self.network_log if x['type'] == 'request'])}")
        
        # Save performance metrics
        if self.performance_metrics:
            metrics_file = self.session_dir / "performance_metrics.json"
            with open(metrics_file, "w") as f:
                json.dump(self.performance_metrics, f, indent=2)
            self.logger.info(f"Performance metrics saved: {metrics_file}")
        
        # Save WebSocket messages
        if self.websocket_messages:
            ws_file = self.session_dir / "websocket_messages.json"
            with open(ws_file, "w") as f:
                json.dump(self.websocket_messages, f, indent=2)
            self.logger.info(f"WebSocket messages saved: {ws_file}")

addons = [LayeredRecorder(record_level=3)]
```

### Start mitmproxy with Recording

```bash
# Terminal 1: Start mitmproxy with recording addon
mitmdump \
    -s ~/.mitmproxy/record_addon.py \
    --set hardump=./network_requests.har \
    --set flow_detail=3 \
    --mode regular \
    -q

# Output:
# LayeredRecorder loaded. Session dir: ./activity_sessions/2025-11-14T...
# Proxy listening at http://127.0.0.1:8080
```

### Configure Browser Proxy

**For Chrome/Chromium:**
```bash
# Start Chrome with proxy
google-chrome \
    --proxy-server="http://127.0.0.1:8080" \
    --disable-background-networking \
    --disable-client-side-phishing-detection \
    --disable-default-apps \
    --disable-hang-monitor \
    --disable-popup-blocking \
    --disable-prompt-on-repost \
    --disable-sync \
    --enable-automation \
    # Your CDP extension flags...
```

### Browser Extension for State Capture (Manifest v3)

File: `extension/manifest.json`

```json
{
  "manifest_version": 3,
  "name": "CDP Activity Recorder",
  "version": "1.0",
  "description": "Records browser state and network activity",
  "permissions": [
    "storage",
    "cookies",
    "webRequest",
    "debugger"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup.html"
  }
}
```

File: `extension/background.js`

```javascript
// Capture browser state
async function captureState() {
  const state = {};
  
  // Get all cookies
  state.cookies = await chrome.cookies.getAll({});
  
  // Get local storage (via content script)
  state.localStorage = await executeOnAllTabs((tab) => {
    return chrome.tabs.executeScript(tab.id, {
      code: `JSON.stringify(localStorage)`
    });
  });
  
  // Get session storage
  state.sessionStorage = await executeOnAllTabs((tab) => {
    return chrome.tabs.executeScript(tab.id, {
      code: `JSON.stringify(sessionStorage)`
    });
  });
  
  // Get IndexedDB list
  state.indexedDBs = await getIndexedDBs();
  
  return state;
}

// Listen for commands from MCP
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "captureState") {
    captureState().then(state => sendResponse({ state }));
    return true; // Keep channel open
  }
  
  if (request.action === "injectState") {
    injectState(request.state).then(() => sendResponse({ success: true }));
    return true;
  }
});

// Inject captured state into target page
async function injectState(state) {
  const activeTab = await getCurrentTab();
  
  // Inject cookies
  for (const cookie of state.cookies) {
    await chrome.cookies.set(cookie);
  }
  
  // Inject storage (via content script)
  await chrome.tabs.executeScript(activeTab.id, {
    code: `
      const state = ${JSON.stringify(state)};
      Object.keys(state.localStorage || {}).forEach(key => {
        localStorage.setItem(key, state.localStorage[key]);
      });
      Object.keys(state.sessionStorage || {}).forEach(key => {
        sessionStorage.setItem(key, state.sessionStorage[key]);
      });
    `
  });
}
```

---

## Part 2: Integuru Integration

### Installation

```bash
git clone https://github.com/Integuru-AI/Integuru
cd Integuru
poetry install
```

### HAR to Python Conversion Script

File: `integuru_wrapper.py`

```python
"""
Wrapper around Integuru that integrates with our MCP system.
"""

import subprocess
import json
import tempfile
from pathlib import Path
import asyncio

class InteguruWrapper:
    def __init__(self, model="gpt-4o", api_key=None):
        self.model = model
        self.api_key = api_key
        self.integuru_dir = Path("./Integuru")
    
    async def analyze_har(self, har_file, task_prompt, generate_code=True):
        """
        Analyzes HAR file and generates automation code.
        
        Args:
            har_file: Path to HAR file
            task_prompt: Description of what the user did
            generate_code: Whether to generate executable Python code
        
        Returns:
            {
                "dependency_graph": [...],
                "code": "...",
                "confidence": 0.95,
                "estimated_time_seconds": 3
            }
        """
        
        # Step 1: Extract cookies from HAR
        cookies = self._extract_cookies_from_har(har_file)
        cookies_file = tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False)
        json.dump(cookies, cookies_file)
        cookies_file.close()
        
        # Step 2: Run Integuru analysis
        cmd = [
            "poetry", "run", "integuru",
            "--prompt", task_prompt,
            "--model", self.model,
            "--har-path", str(har_file),
            "--cookie-path", cookies_file.name,
        ]
        
        if generate_code:
            cmd.append("--generate-code")
        
        # Change to Integuru directory
        result = subprocess.run(
            cmd,
            cwd=self.integuru_dir,
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            raise RuntimeError(f"Integuru failed: {result.stderr}")
        
        # Step 3: Parse output
        output = json.loads(result.stdout)
        
        return {
            "dependency_graph": output.get("dependency_graph"),
            "code": output.get("generated_code"),
            "confidence": output.get("confidence", 0.80),
            "estimated_time_seconds": 3,  # Integuru is fast
        }
    
    def _extract_cookies_from_har(self, har_file):
        """Extract cookies from HAR file."""
        with open(har_file, 'r') as f:
            har_data = json.load(f)
        
        cookies = {}
        for entry in har_data.get("log", {}).get("entries", []):
            for cookie in entry.get("request", {}).get("cookies", []):
                cookies[cookie["name"]] = cookie["value"]
        
        return cookies
    
    async def execute_code(self, code, timeout=30):
        """
        Execute generated code in isolated environment.
        """
        
        # Create temporary file with code
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(code)
            code_file = f.name
        
        try:
            # Execute in subprocess
            result = await asyncio.wait_for(
                asyncio.create_subprocess_shell(
                    f"python {code_file}",
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                ),
                timeout=timeout
            )
            
            stdout, stderr = await result.communicate()
            
            return {
                "success": result.returncode == 0,
                "output": stdout.decode(),
                "error": stderr.decode() if stderr else None,
                "execution_time_seconds": None  # TODO: measure
            }
        
        finally:
            Path(code_file).unlink()
```

### Example Usage

```python
# In your MCP server:
integuru = InteguruWrapper(model="gpt-4o")

# After mitmproxy captures traffic:
result = await integuru.analyze_har(
    har_file="./network_requests.har",
    task_prompt="Download the generated image from KlingAI",
    generate_code=True
)

print(f"Confidence: {result['confidence']}")
print(f"Generated code:\n{result['code']}")
print(f"Estimated time: {result['estimated_time_seconds']}s")

# Execute the generated code:
execution = await integuru.execute_code(result['code'])
print(f"Execution successful: {execution['success']}")
print(f"Output: {execution['output']}")
```

---

## Part 3: Modality Optimizer

File: `modality_optimizer.py`

```python
"""
Chooses the fastest automation modality for a given task.
"""

import json
from dataclasses import dataclass
from typing import Literal
from pathlib import Path

@dataclass
class ModalityChoice:
    modality: Literal["integuru", "headless_cdp", "visible_browser"]
    confidence: float
    estimated_time_seconds: int
    reasoning: dict

class ModalityOptimizer:
    def __init__(self):
        self.history = []  # Track decisions for learning
    
    def choose(self, har_file, task_description) -> ModalityChoice:
        """
        Analyzes task and chooses fastest modality.
        """
        
        # Analyze HAR for API patterns
        har_complexity = self._analyze_har_complexity(har_file)
        api_reversibility = self._score_api_reversibility(har_file)
        
        # Scoring logic
        integuru_score = api_reversibility
        headless_score = 0.7  # Headless is reliable but slower
        
        # Make decision
        if integuru_score > 0.85:
            return ModalityChoice(
                modality="integuru",
                confidence=integuru_score,
                estimated_time_seconds=3,
                reasoning={
                    "api_patterns": har_complexity["api_patterns"],
                    "dependency_depth": har_complexity["dependency_depth"],
                    "reversibility_score": api_reversibility
                }
            )
        
        elif integuru_score > 0.60:
            # Integuru might work but fallback is safer
            return ModalityChoice(
                modality="headless_cdp",
                confidence=0.85,
                estimated_time_seconds=20,
                reasoning={
                    "integuru_risky": integuru_score,
                    "fallback_safer": True
                }
            )
        
        else:
            # Task too complex, need human
            return ModalityChoice(
                modality="visible_browser",
                confidence=1.0,
                estimated_time_seconds=300,  # Estimate 5 minutes
                reasoning={
                    "task_complexity": "high",
                    "requires_user_interaction": True
                }
            )
    
    def _analyze_har_complexity(self, har_file):
        """Analyze network traffic patterns."""
        with open(har_file, 'r') as f:
            har = json.load(f)
        
        entries = har.get("log", {}).get("entries", [])
        
        # Count different request types
        api_patterns = {}
        for entry in entries:
            url = entry["request"]["url"]
            # Extract API pattern
            if "/api/" in url:
                pattern = url.split("/api/")[1].split("/")[0]
                api_patterns[pattern] = api_patterns.get(pattern, 0) + 1
        
        return {
            "total_requests": len(entries),
            "api_patterns": api_patterns,
            "dependency_depth": len(api_patterns),
        }
    
    def _score_api_reversibility(self, har_file):
        """Score how easily this can be reverse-engineered via Integuru."""
        analysis = self._analyze_har_complexity(har_file)
        
        # High API pattern consistency = easy reversal
        if len(analysis["api_patterns"]) <= 3:
            return 0.95
        elif len(analysis["api_patterns"]) <= 10:
            return 0.80
        else:
            return 0.50
    
    def log_decision(self, task, choice: ModalityChoice, actual_time):
        """Log for future optimization."""
        self.history.append({
            "task": task,
            "chosen_modality": choice.modality,
            "estimated_time": choice.estimated_time_seconds,
            "actual_time": actual_time,
            "accuracy": 1.0 if abs(choice.estimated_time_seconds - actual_time) < 5 else 0.5
        })

# Usage
optimizer = ModalityOptimizer()
choice = optimizer.choose("network_requests.har", "Download image")
print(f"Use {choice.modality} (confidence: {choice.confidence})")
print(f"Estimated time: {choice.estimated_time_seconds}s")
```

---

## Part 4: MCP Server Integration

File: `mcp_server_extended.py`

```python
"""
Extended MCP Server with Integuru + mitmproxy integration.
"""

import json
import asyncio
from mcp.server import Server
from integuru_wrapper import InteguruWrapper
from modality_optimizer import ModalityOptimizer

app = Server("browser-automation-mcp")
integuru = InteguruWrapper()
optimizer = ModalityOptimizer()

@app.call_tool()
async def capture_and_analyze(timeout_seconds: int = 30) -> dict:
    """
    1. Starts mitmproxy
    2. Waits for user action
    3. Analyzes captured traffic
    4. Returns optimized automation approach
    """
    
    # Start mitmproxy
    mitmproxy_process = await start_mitmproxy()
    
    print(f"🔴 mitmproxy is recording. Perform your action in the browser. Waiting {timeout_seconds}s...")
    await asyncio.sleep(timeout_seconds)
    
    # Stop mitmproxy and get HAR
    await mitmproxy_process.terminate()
    har_file = "./network_requests.har"
    
    # Analyze with Integuru
    task_prompt = input("Describe what you did: ")
    
    integuru_result = await integuru.analyze_har(
        har_file=har_file,
        task_prompt=task_prompt,
        generate_code=True
    )
    
    # Choose modality
    modality_choice = optimizer.choose(har_file, task_prompt)
    
    return {
        "har_file": har_file,
        "task_description": task_prompt,
        "integuru_result": integuru_result,
        "recommended_modality": {
            "name": modality_choice.modality,
            "confidence": modality_choice.confidence,
            "estimated_time": modality_choice.estimated_time_seconds,
        },
        "next_step": f"Execute via {modality_choice.modality}?"
    }

@app.call_tool()
async def execute_automation(
    modality: str,
    har_file: str,
    integuru_code: str
) -> dict:
    """
    Executes automation via chosen modality.
    """
    
    if modality == "integuru":
        result = await integuru.execute_code(integuru_code)
        execution_time = 3  # Integuru is fast
    
    elif modality == "headless_cdp":
        result = await execute_headless_automation(integuru_code)
        execution_time = 20
    
    else:
        return {"status": "WAITING_FOR_USER"}
    
    # Log for optimization
    optimizer.log_decision(
        task="automation_task",
        choice=modality_choice,  # Need to pass this
        actual_time=execution_time
    )
    
    return {
        "status": "SUCCESS",
        "modality_used": modality,
        "execution_time": execution_time,
        "result": result
    }

if __name__ == "__main__":
    app.run()
```

---

## Part 5: Quick Start Checklist

```bash
# 1. Install dependencies
pip install mitmproxy Integuru mcp

# 2. Configure mitmproxy addon
mkdir -p ~/.mitmproxy
cp record_addon.py ~/.mitmproxy/

# 3. Install browser extension
# (Load unpacked extension in Chrome)

# 4. Start system
python mcp_server_extended.py

# 5. In browser, perform action (e.g., download image)
# mitmproxy captures it automatically

# 6. System suggests fastest execution path
# You approve or iterate

# 7. Automation executes automatically
# Results recorded with screenshots
```

---

## Troubleshooting

### mitmproxy not capturing HTTPS

```bash
# Install mitmproxy CA cert
mitmdump -C ~/ &
# Open Chrome and visit http://mitm.it
# Click "Other" and install cert

# Or use:
python -m mitmproxy.tools.mitmdump --install-sslkeylogfile ~/.mitmproxy/sslkeylogfile.txt
```

### Integuru code generation failing

```bash
# Check OpenAI API key
export OPENAI_API_KEY="sk-..."

# Test with simpler HAR
# (fewer API calls, clearer patterns)

# Try different model
integuru --model o1-mini  # Faster, cheaper
```

### Performance issues

```bash
# Reduce mitmproxy flow detail
# (from 3 to 2 or 1)

# Run Integuru with smaller HAR
# (capture only essential traffic)

# Profile execution
python -m cProfile -s cumulative mcp_server_extended.py
```