# CDP Stealth Extension Installation Guide

## Quick Start

### 1. Generate Icons (Optional)

The extension references PNG icons that need to be generated from the SVG file:

1. Open `extensions/cdp-stealth/icons/icon-generator.html` in your browser
2. Click "Generate Icons" button
3. Right-click each generated icon and save as:
   - `icon16.png`
   - `icon32.png`
   - `icon48.png`
   - `icon128.png`

Alternatively, you can temporarily modify `manifest.json` to remove icon references if you want to test without icons.

### 2. Install the Extension

1. **Open Chrome Extension Management**:
   - Launch Google Chrome
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" using the toggle in the top right corner

2. **Load the Extension**:
   - Click the "Load unpacked" button
   - Navigate to and select the `extensions/cdp-stealth` directory
   - Click "Select Folder"

3. **Verify Installation**:
   - The CDP Stealth Extension should appear in your extensions list
   - Look for the extension icon in your Chrome toolbar
   - If you don't see the icon, click the puzzle piece icon and pin it to your toolbar

### 3. Test the Extension

1. **Open the Popup**:
   - Click the CDP Stealth extension icon in your toolbar
   - The popup interface should open

2. **Attach to Current Tab**:
   - Navigate to any website (e.g., https://example.com)
   - Open the extension popup
   - Click "Attach to Current Tab"
   - The status indicator should turn green

3. **Capture State**:
   - With debugger attached, click "Capture Current State"
   - Check the activity log for confirmation

4. **Execute CDP Command**:
   - Enter `Page.navigate` in the Method field
   - Enter `{"url": "https://google.com"}` in the Parameters field
   - Click "Execute CDP Command"
   - The page should navigate to Google

## Troubleshooting

### Extension Won't Load

**Symptoms**: Error message when loading the extension

**Solutions**:
1. Ensure "Developer mode" is enabled
2. Check that all files are present in the `cdp-stealth` directory
3. Verify `manifest.json` has valid JSON syntax
4. Check Chrome's developer console for detailed error messages

### Debugger Attachment Fails

**Symptoms**: "Attach to Current Tab" doesn't work or shows error

**Solutions**:
1. Try refreshing the page and reattaching
2. Ensure you're not on a restricted page (chrome://, chrome-extension://)
3. Check if other extensions might be conflicting
4. Restart Chrome and try again

### Icons Not Displaying

**Symptoms**: Extension icon doesn't appear in toolbar

**Solutions**:
1. Generate the PNG icons using the icon-generator.html tool
2. Or temporarily remove icon references from manifest.json
3. Check that icon files are in the correct `icons/` subdirectory

### Popup Interface Issues

**Symptoms**: Popup doesn't open or shows blank page

**Solutions**:
1. Check browser console for JavaScript errors
2. Verify all popup files (popup.html, popup.css, popup.js) are present
3. Try reloading the extension

## Advanced Usage

### Using with Chrome's Developer Tools

1. **Inspect Background Script**:
   - Go to `chrome://extensions/`
   - Find "CDP Stealth Extension"
   - Click "Inspect views: background page"
   - This opens the background script's developer console

2. **Inspect Popup**:
   - Open the extension popup
   - Right-click inside the popup
   - Select "Inspect"
   - This opens the popup's developer console

3. **Debug Content Scripts**:
   - Open the target webpage
   - Open Chrome DevTools (F12)
   - Check the Console for content script messages
   - Use the "Elements" tab to inspect DOM modifications

### Security Considerations

1. **Permissions**: This extension requires powerful permissions including debugger access
2. **Data Privacy**: Be cautious when capturing sensitive data
3. **Website Compatibility**: Some websites may block certain operations
4. **Responsible Use**: Use only on websites you own or have permission to test

## Getting Help

1. Check the browser console for error messages
2. Review the activity log in the extension popup
3. Ensure all prerequisites are met
4. Test with simple websites first (e.g., example.com)

## File Structure

After installation, your extension directory should contain:

```
extensions/cdp-stealth/
├── manifest.json          # Extension manifest
├── background.js           # Service worker
├── popup.html             # Popup interface
├── popup.css              # Popup styling
├── popup.js               # Popup functionality
├── content-script.js      # Content script
├── injected-script.js     # Page context script
├── icons/                 # Extension icons
│   ├── icon.svg           # Source SVG
│   ├── icon16.png         # 16x16 PNG
│   ├── icon32.png         # 32x32 PNG
│   ├── icon48.png         # 48x48 PNG
│   ├── icon128.png        # 128x128 PNG
│   ├── icon-generator.html # Icon generator tool
│   └── generate-icons.js  # Icon generation script
├── README.md              # Documentation
└── INSTALL.md             # This file
```

## Next Steps

Once installed, refer to `README.md` for detailed usage instructions and API documentation.