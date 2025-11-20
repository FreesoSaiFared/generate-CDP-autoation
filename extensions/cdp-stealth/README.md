# CDP Stealth Extension

A Chrome extension that provides browser control capabilities using the Chrome DevTools Protocol (CDP) without exposing remote debugging ports. This extension enables state capture and injection across browser instances for automated testing and session replication.

## Features

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

### Steps

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

## Usage

### Basic Operations

1. **Attach Debugger to Current Tab**:
   - Open the extension popup
   - Click "Attach to Current Tab"
   - The status indicator should turn green when connected

2. **Capture Browser State**:
   - Ensure debugger is attached to the target tab
   - Select which storage types to capture (cookies, localStorage, etc.)
   - Click "Capture Current State"
   - The captured state will be saved and available for injection

3. **Inject Browser State**:
   - Navigate to the target tab where you want to inject state
   - Ensure debugger is attached
   - Select a previously captured state from the dropdown
   - Click "Inject Selected State"

4. **Execute CDP Commands**:
   - Enter the CDP method (e.g., `Page.navigate`)
   - Provide parameters in JSON format (e.g., `{"url": "https://example.com"}`)
   - Click "Execute CDP Command"
   - Results will appear in the output area

### Advanced Features

#### Multi-tab Management
- The extension can attach to multiple tabs simultaneously
- Each tab maintains its own debugger connection
- View attached tabs in the "Tab Management" section
- Detach from individual tabs as needed

#### State Storage
- Captured states are persisted in Chrome's local storage
- States include timestamp and source URL for identification
- States can be exported/imported manually through Chrome storage inspection

#### Event Monitoring
- Monitor DOM changes, storage modifications, and user interactions
- Events are logged in the activity log
- Useful for debugging and understanding page behavior

## API Reference

### Background Script Commands

The extension's background script responds to the following commands:

- `attachDebugger` - Attach debugger to a tab
- `detachDebugger` - Detach debugger from a tab
- `captureState` - Capture browser state from a tab
- `injectState` - Inject captured state into a tab
- `executeCDPCommand` - Execute a CDP command on a tab
- `getAttachedTabs` - Get list of attached tabs
- `getStatus` - Get extension status information

### Content Script Commands

The content script provides these capabilities:

- `getPageInfo` - Get basic page information
- `getStorageData` - Get storage data (localStorage, sessionStorage, cookies)
- `setStorageData` - Set storage data
- `executeScript` - Execute JavaScript in page context
- `captureDOM` - Capture DOM structure and elements
- `monitorEvents` - Start monitoring page events
- `stopMonitoring` - Stop event monitoring

### Page Script API

The injected page script provides these methods:

- `getLocalStorage()` / `setLocalStorage(key, value)`
- `getSessionStorage()` / `setSessionStorage(key, value)`
- `getCookies()` / `setCookie(name, value, options)`
- `getFormValues(selector)` / `setFormValues(selector, values)`
- `clickElement(selector)`
- `getElementInfo(selector)`
- `waitForElement(selector, timeout)`

## Security Considerations

- This extension requires powerful permissions including debugger access
- Only install from trusted sources
- Review the source code before installation
- Be cautious when capturing sensitive data (passwords, personal information)
- Use responsibly and in accordance with website terms of service

## Troubleshooting

### Common Issues

1. **Extension won't load**:
   - Ensure Developer mode is enabled
   - Check for manifest.json syntax errors
   - Verify all required files are present

2. **Debugger attachment fails**:
   - Check if the tab URL is supported (chrome:// pages may not work)
   - Ensure no other extensions are conflicting
   - Try refreshing the page and reattaching

3. **State capture incomplete**:
   - Some websites may block storage access
   - Check browser console for security errors
   - Verify permissions are granted

4. **CDP commands fail**:
   - Ensure debugger is attached to the target tab
   - Check CDP method spelling and parameter format
   - Verify the target domain supports the requested CDP method

### Debug Information

- Check the browser console for error messages
- Review the activity log in the extension popup
- Use Chrome's extension inspection tools:
  - Go to `chrome://extensions/`
  - Find "CDP Stealth Extension"
  - Click "Inspect views: background page" for background script debugging
  - Click "Inspect views: popup" for popup debugging

## Development

### File Structure
```
extensions/cdp-stealth/
├── manifest.json          # Extension manifest (Manifest v3)
├── background.js           # Service worker with CDP integration
├── popup.html             # Extension popup interface
├── popup.css              # Popup styling
├── popup.js               # Popup functionality
├── content-script.js      # Content script for DOM interaction
├── injected-script.js     # Page context script
├── icons/                 # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md              # This file
```

### Modifying the Extension

1. Make changes to the source files
2. Go to `chrome://extensions/`
3. Find the CDP Stealth Extension
4. Click the reload button
5. Test the changes

### Contributing

When contributing to this extension:
- Follow JavaScript best practices
- Ensure Manifest v3 compliance
- Test across different websites
- Update documentation for new features
- Consider security implications of changes

## License

This extension is provided for educational and research purposes. Use responsibly and in accordance with applicable laws and website terms of service.

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review the browser console for error messages
3. Verify all prerequisites are met
4. Test with a simple website first