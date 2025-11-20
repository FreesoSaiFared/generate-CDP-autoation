# CDP Extension Documentation

The CDP Stealth Extension provides browser control capabilities using the Chrome DevTools Protocol (CDP) without exposing remote debugging ports. This enables state capture and injection across browser instances for automated testing and session replication.

## Overview

The extension uses Chrome's internal Debugger API to communicate with browser tabs without the security risks associated with exposed debugging ports. This approach is completely invisible to detection systems while providing full CDP functionality.

### Key Features

- **Stealth CDP Integration**: Uses Chrome Debugger API internally without exposing remote debugging ports
- **State Capture**: Captures complete browser state including cookies, localStorage, sessionStorage, and IndexedDB
- **State Injection**: Injects captured state into new browser instances
- **Multi-tab Support**: Manages multiple tabs with independent debugger attachments
- **DOM Interaction**: Provides DOM manipulation capabilities through content scripts
- **Event Monitoring**: Captures user interactions and DOM changes
- **Visual Interface**: User-friendly popup interface for manual control

## Installation

### Prerequisites

- Google Chrome (version 88 or later)
- Extension installation permissions

### Installation Steps

1. **Download or clone this repository** to your local machine

2. **Open Chrome Extension Management**:
   - Open Chrome
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" using the toggle in the top right

3. **Load the Extension**:
   - Click "Load unpacked"
   - Select the `extensions/cdp-stealth` directory
   - The extension should appear in your extensions list

4. **Verify Installation**:
   - Look for the CDP Stealth icon in your Chrome toolbar
   - Click the icon to open the popup interface

## Extension Architecture

### Manifest Configuration

**Location**: [`extensions/cdp-stealth/manifest.json`](../extensions/cdp-stealth/manifest.json)

```json
{
  "manifest_version": 3,
  "name": "CDP Stealth Extension",
  "version": "1.0.0",
  "description": "Chrome DevTools Protocol extension for browser control without exposing remote debugging port",
  
  "permissions": [
    "debugger",      // Required for CDP communication
    "storage",       // For extension data persistence
    "cookies",       // For cookie management
    "tabs",          // For tab management
    "activeTab",     // For current tab access
    "scripting"      // For content script injection
  ],
  
  "host_permissions": ["<all_urls>"],
  
  "background": {
    "service_worker": "background.js",
    "type": "module"
  }
}
```

### Component Structure

```
extensions/cdp-stealth/
├── manifest.json          # Extension manifest (Manifest v3)
├── background.js          # Service worker with CDP integration
├── popup.html             # Extension popup interface
├── popup.css              # Popup styling
├── popup.js               # Popup functionality
├── content-script.js      # Content script for DOM interaction
├── injected-script.js     # Page context script
├── icons/                 # Extension icons
└── README.md              # Component documentation
```

## Background Service Worker

**Location**: [`extensions/cdp-stealth/background.js`](../extensions/cdp-stealth/background.js)

The background service worker handles CDP communication and extension logic:

```javascript
// Attach debugger to tab
chrome.debugger.attach({ tabId: tabId }, "1.3", () => {
  // Send CDP commands without exposing port
  chrome.debugger.sendCommand(
    { tabId: tabId },
    "Runtime.evaluate",
    { expression: "document.title" },
    (result) => {
      console.log("Title:", result.result.value);
    }
  );
});

// Capture state
async function captureState() {
  const cookies = await chrome.cookies.getAll({});
  const tabs = await chrome.tabs.query({});
  
  // Execute in page context to get storage
  const storage = await chrome.scripting.executeScript({
    target: { tabId: tabs[0].id },
    func: () => ({
      localStorage: {...localStorage},
      sessionStorage: {...sessionStorage}
    })
  });
  
  return { cookies, storage: storage[0].result };
}
```

### Key Functions

#### Debugger Attachment

```javascript
async function attachDebugger(tabId) {
  return new Promise((resolve, reject) => {
    chrome.debugger.attach({ tabId }, "1.3", () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}
```

#### CDP Command Execution

```javascript
async function executeCDPCommand(tabId, method, params = {}) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand(
      { tabId, method, params },
      (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result);
        }
      }
    );
  });
}
```

#### State Capture

```javascript
async function captureBrowserState(tabId) {
  const [cookies, storage, screenshot] = await Promise.all([
    chrome.cookies.getAll({}),
    captureStorageData(tabId),
    executeCDPCommand(tabId, "Page.captureScreenshot")
  ]);
  
  return {
    timestamp: Date.now(),
    url: (await chrome.tabs.get(tabId)).url,
    cookies,
    storage,
    screenshot: screenshot.result.data
  };
}
```

## Popup Interface

**Location**: [`extensions/cdp-stealth/popup.html`](../extensions/cdp-stealth/popup.html)

The popup provides a user-friendly interface for manual control:

```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="container">
    <h1>CDP Stealth Control</h1>
    
    <div class="section">
      <h3>Debugger Status</h3>
      <div id="status" class="status-indicator">Not Connected</div>
    </div>
    
    <div class="section">
      <h3>Actions</h3>
      <button id="attach-btn">Attach to Current Tab</button>
      <button id="capture-btn">Capture State</button>
      <button id="inject-btn">Inject State</button>
    </div>
    
    <div class="section">
      <h3>CDP Command</h3>
      <input type="text" id="method" placeholder="Method (e.g., Page.navigate)">
      <textarea id="params" placeholder='{"url": "https://example.com"}'></textarea>
      <button id="execute-btn">Execute</button>
    </div>
  </div>
  <script src="popup.js"></script>
</body>
</html>
```

**Location**: [`extensions/cdp-stealth/popup.js`](../extensions/cdp-stealth/popup.js)

```javascript
document.addEventListener('DOMContentLoaded', function() {
  const attachBtn = document.getElementById('attach-btn');
  const captureBtn = document.getElementById('capture-btn');
  const injectBtn = document.getElementById('inject-btn');
  const executeBtn = document.getElementById('execute-btn');
  
  attachBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    chrome.runtime.sendMessage({
      action: 'attachDebugger',
      tabId: tab.id
    }, response => {
      updateStatus(response.success ? 'Connected' : 'Failed');
    });
  });
  
  captureBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    chrome.runtime.sendMessage({
      action: 'captureState',
      tabId: tab.id
    }, response => {
      console.log('Captured state:', response.state);
    });
  });
});

function updateStatus(status) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = status;
  statusEl.className = `status-indicator ${status.toLowerCase()}`;
}
```

## Content Script

**Location**: [`extensions/cdp-stealth/content-script.js`](../extensions/cdp-stealth/content-script.js)

The content script bridges the extension and page context:

```javascript
// Message listener for popup communication
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getPageInfo':
      sendResponse(getPageInfo());
      break;
      
    case 'getStorageData':
      sendResponse(getStorageData());
      break;
      
    case 'setStorageData':
      setStorageData(request.data);
      sendResponse({ success: true });
      break;
      
    case 'executeScript':
      executeScript(request.code);
      sendResponse({ success: true });
      break;
  }
});

function getPageInfo() {
  return {
    url: window.location.href,
    title: document.title,
    userAgent: navigator.userAgent,
    timestamp: Date.now()
  };
}

function getStorageData() {
  return {
    localStorage: { ...localStorage },
    sessionStorage: { ...sessionStorage },
    cookies: document.cookie
  };
}

function setStorageData(data) {
  if (data.localStorage) {
    Object.keys(data.localStorage).forEach(key => {
      localStorage.setItem(key, data.localStorage[key]);
    });
  }
  
  if (data.sessionStorage) {
    Object.keys(data.sessionStorage).forEach(key => {
      sessionStorage.setItem(key, data.sessionStorage[key]);
    });
  }
}
```

## Injected Script

**Location**: [`extensions/cdp-stealth/injected-script.js`](../extensions/cdp-stealth/injected-script.js)

The injected script runs in page context for direct DOM manipulation:

```javascript
// Page script API
window.CDPStealthAPI = {
  // Storage management
  getLocalStorage() {
    return { ...localStorage };
  },
  
  setLocalStorage(key, value) {
    localStorage.setItem(key, value);
  },
  
  getSessionStorage() {
    return { ...sessionStorage };
  },
  
  setSessionStorage(key, value) {
    sessionStorage.setItem(key, value);
  },
  
  // DOM manipulation
  getElementInfo(selector) {
    const element = document.querySelector(selector);
    if (!element) return null;
    
    return {
      tagName: element.tagName,
      text: element.textContent,
      value: element.value,
      attributes: Array.from(element.attributes).map(attr => ({
        name: attr.name,
        value: attr.value
      }))
    };
  },
  
  clickElement(selector) {
    const element = document.querySelector(selector);
    if (element) {
      element.click();
      return true;
    }
    return false;
  },
  
  // Form manipulation
  getFormValues(selector) {
    const form = document.querySelector(selector);
    if (!form) return {};
    
    const values = {};
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      values[input.name || input.id] = input.value;
    });
    
    return values;
  },
  
  setFormValues(selector, values) {
    const form = document.querySelector(selector);
    if (!form) return false;
    
    Object.keys(values).forEach(key => {
      const input = form.querySelector(`[name="${key}"], #${key}`);
      if (input) {
        input.value = values[key];
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    
    return true;
  }
};
```

## Usage Examples

### Basic Operations

```javascript
// Attach debugger to current tab
chrome.runtime.sendMessage({
  action: 'attachDebugger',
  tabId: tabId
});

// Capture browser state
chrome.runtime.sendMessage({
  action: 'captureState',
  tabId: tabId
}, response => {
  console.log('Captured state:', response.state);
});

// Execute CDP command
chrome.runtime.sendMessage({
  action: 'executeCDPCommand',
  tabId: tabId,
  method: 'Page.navigate',
  params: { url: 'https://example.com' }
});
```

### State Management

```javascript
// Save current state
const state = await captureBrowserState(tabId);
await chrome.storage.local.set({
  savedStates: [...existingStates, state]
});

// Restore state
const savedStates = await chrome.storage.local.get('savedStates');
const stateToRestore = savedStates.savedStates[0];
await injectBrowserState(tabId, stateToRestore);
```

### DOM Interaction

```javascript
// Get element information
const elementInfo = await chrome.scripting.executeScript({
  target: { tabId },
  func: () => window.CDPStealthAPI.getElementInfo('#username')
});

// Fill form
await chrome.scripting.executeScript({
  target: { tabId },
  func: (data) => window.CDPStealthAPI.setFormValues('#login-form', data),
  args: [{ username: 'user@example.com', password: 'secret' }]
});

// Click button
await chrome.scripting.executeScript({
  target: { tabId },
  func: () => window.CDPStealthAPI.clickElement('#submit-btn')
});
```

## API Reference

### Background Script Commands

| Command | Parameters | Description |
|---------|------------|-------------|
| `attachDebugger` | `{ tabId }` | Attach debugger to tab |
| `detachDebugger` | `{ tabId }` | Detach debugger from tab |
| `captureState` | `{ tabId, options }` | Capture browser state |
| `injectState` | `{ tabId, state }` | Inject captured state |
| `executeCDPCommand` | `{ tabId, method, params }` | Execute CDP command |
| `getAttachedTabs` | - | Get list of attached tabs |
| `getStatus` | - | Get extension status |

### Content Script Commands

| Command | Parameters | Description |
|---------|------------|-------------|
| `getPageInfo` | - | Get basic page information |
| `getStorageData` | - | Get storage data |
| `setStorageData` | `{ data }` | Set storage data |
| `executeScript` | `{ code }` | Execute JavaScript |
| `captureDOM` | - | Capture DOM structure |
| `monitorEvents` | - | Start event monitoring |

### Page Script API

| Method | Parameters | Returns | Description |
|---------|------------|----------|-------------|
| `getLocalStorage()` | - | Object | Get localStorage contents |
| `setLocalStorage(key, value)` | key, value | void | Set localStorage item |
| `getSessionStorage()` | - | Object | Get sessionStorage contents |
| `setSessionStorage(key, value)` | key, value | void | Set sessionStorage item |
| `getElementInfo(selector)` | selector | Object | Get element information |
| `clickElement(selector)` | selector | boolean | Click element |
| `getFormValues(selector)` | selector | Object | Get form values |
| `setFormValues(selector, values)` | selector, values | boolean | Set form values |

## Security Considerations

### Permissions

The extension requires powerful permissions for CDP access:

- `debugger`: Core CDP functionality
- `storage`: State persistence
- `cookies`: Cookie management
- `tabs`: Tab management
- `scripting`: Content script injection

### Data Privacy

- State data includes sensitive information (cookies, tokens)
- All data is stored locally in Chrome extension storage
- No data is transmitted to external servers
- Consider sanitizing state data before sharing

### Best Practices

1. **Review source code** before installation
2. **Use only from trusted sources**
3. **Be cautious with sensitive data**
4. **Follow website terms of service**
5. **Regular security audits** of extension code

## Troubleshooting

### Common Issues

#### Extension won't load

```bash
# Check manifest syntax
cat extensions/cdp-stealth/manifest.json | python3 -m json.tool

# Verify required files
ls -la extensions/cdp-stealth/

# Check Chrome console for errors
# chrome://extensions/ -> Click "Inspect views: background page"
```

#### Debugger attachment fails

```javascript
// Check tab URL compatibility
const tab = await chrome.tabs.get(tabId);
console.log('Tab URL:', tab.url); // chrome:// pages may not work

// Verify no other extensions conflict
// Disable other debugging extensions temporarily
```

#### State capture incomplete

```javascript
// Check storage permissions
const hasPermission = await chrome.permissions.contains({
  permissions: ['storage']
});

// Verify page access
try {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: () => document.readyState
  });
} catch (error) {
  console.error('Script execution failed:', error);
}
```

### Debug Mode

Enable debug logging:

```javascript
// In background.js
console.log('CDP Extension Debug Mode Enabled');

// In popup.js
chrome.runtime.sendMessage({
  action: 'debug',
  message: 'Popup initialized'
});

// Monitor extension activity
chrome://extensions/ -> Find extension -> Click "Inspect views"
```

## Development

### Building the Extension

```bash
# Navigate to extension directory
cd extensions/cdp-stealth

# Validate manifest
python3 -m json.tool manifest.json > /dev/null

# Check for syntax errors
eslint *.js

# Test in development mode
# Load as unpacked extension in Chrome
```

### Modifying the Extension

1. Make changes to source files
2. Go to `chrome://extensions/`
3. Find CDP Stealth Extension
4. Click the reload button
5. Test the changes

### Testing

```javascript
// Unit tests for background script
function testDebuggerAttachment() {
  return new Promise((resolve) => {
    chrome.debugger.attach({ tabId: 1 }, "1.3", () => {
      resolve(!chrome.runtime.lastError);
    });
  });
}

// Integration tests
async function testStateCapture() {
  const state = await captureBrowserState(tabId);
  console.assert(state.cookies, 'Cookies not captured');
  console.assert(state.storage, 'Storage not captured');
}
```

## References

- [Chrome Extension Manifest v3](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Chrome Debugger API](https://developer.chrome.com/docs/extensions/reference/debugger/)
- [Chrome Scripting API](https://developer.chrome.com/docs/extensions/reference/scripting/)
- [Content Scripts](https://developer.chrome.com/docs/extensions/mv3/content_scripts/)