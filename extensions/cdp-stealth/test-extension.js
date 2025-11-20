// Simple test script to verify extension structure and basic functionality
// This can be run in Node.js to check the extension files

const fs = require('fs');
const path = require('path');

console.log('CDP Stealth Extension Structure Test');
console.log('=====================================\n');

const extensionDir = __dirname;
const requiredFiles = [
  'manifest.json',
  'background.js',
  'popup.html',
  'popup.css',
  'popup.js',
  'content-script.js',
  'injected-script.js',
  'README.md',
  'INSTALL.md'
];

const optionalFiles = [
  'icons/icon.svg',
  'icons/icon16.png',
  'icons/icon32.png',
  'icons/icon48.png',
  'icons/icon128.png',
  'icons/icon-generator.html',
  'icons/generate-icons.js'
];

console.log('Checking required files...');
let allRequiredFilesPresent = true;

requiredFiles.forEach(file => {
  const filePath = path.join(extensionDir, file);
  const exists = fs.existsSync(filePath);
  console.log(`  ${file}: ${exists ? '✓' : '✗'}`);
  if (!exists) {
    allRequiredFilesPresent = false;
  }
});

console.log('\nChecking optional files...');
optionalFiles.forEach(file => {
  const filePath = path.join(extensionDir, file);
  const exists = fs.existsSync(filePath);
  console.log(`  ${file}: ${exists ? '✓' : '○'}`);
});

console.log('\nValidating manifest.json...');
try {
  const manifestPath = path.join(extensionDir, 'manifest.json');
  const manifestContent = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestContent);
  
  console.log('  Valid JSON: ✓');
  console.log(`  Manifest version: ${manifest.manifest_version}`);
  console.log(`  Extension name: ${manifest.name}`);
  console.log(`  Extension version: ${manifest.version}`);
  
  // Check required permissions
  const requiredPermissions = ['debugger', 'storage', 'cookies', 'tabs'];
  const hasAllPermissions = requiredPermissions.every(perm => 
    manifest.permissions && manifest.permissions.includes(perm)
  );
  console.log(`  Required permissions: ${hasAllPermissions ? '✓' : '✗'}`);
  
  // Check host permissions
  const hasHostPermissions = manifest.host_permissions && 
    manifest.host_permissions.includes('<all_urls>');
  console.log(`  Host permissions: ${hasHostPermissions ? '✓' : '✗'}`);
  
  // Check background script
  const hasBackground = manifest.background && manifest.background.service_worker;
  console.log(`  Background service worker: ${hasBackground ? '✓' : '✗'}`);
  
  // Check action popup
  const hasAction = manifest.action && manifest.action.default_popup;
  console.log(`  Action popup: ${hasAction ? '✓' : '✗'}`);
  
} catch (error) {
  console.log(`  Error: ${error.message}`);
  allRequiredFilesPresent = false;
}

console.log('\nValidating JavaScript files...');
const jsFiles = [
  'background.js',
  'popup.js',
  'content-script.js',
  'injected-script.js'
];

jsFiles.forEach(file => {
  try {
    const filePath = path.join(extensionDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Basic syntax check
    new Function(content);
    console.log(`  ${file}: ✓ Valid syntax`);
    
    // Check for common patterns
    if (file === 'background.js') {
      const hasChromeAPI = content.includes('chrome.debugger') && 
                          content.includes('chrome.runtime');
      console.log(`    Chrome API usage: ${hasChromeAPI ? '✓' : '✗'}`);
    }
    
    if (file === 'content-script.js') {
      const hasMessageListener = content.includes('chrome.runtime.onMessage');
      console.log(`    Message listener: ${hasMessageListener ? '✓' : '✗'}`);
    }
    
  } catch (error) {
    console.log(`  ${file}: ✗ Syntax error - ${error.message}`);
    allRequiredFilesPresent = false;
  }
});

console.log('\nValidating HTML files...');
try {
  const popupPath = path.join(extensionDir, 'popup.html');
  const popupContent = fs.readFileSync(popupPath, 'utf8');
  
  const hasHTMLStructure = popupContent.includes('<!DOCTYPE html>') &&
                          popupContent.includes('<html') &&
                          popupContent.includes('</html>');
  console.log(`  popup.html: ${hasHTMLStructure ? '✓' : '✗'}`);
  
  const referencesCSS = popupContent.includes('popup.css');
  const referencesJS = popupContent.includes('popup.js');
  console.log(`    References CSS: ${referencesCSS ? '✓' : '✗'}`);
  console.log(`    References JS: ${referencesJS ? '✓' : '✗'}`);
  
} catch (error) {
  console.log(`  popup.html: ✗ Error - ${error.message}`);
  allRequiredFilesPresent = false;
}

console.log('\nSummary:');
console.log(`All required files present: ${allRequiredFilesPresent ? '✓' : '✗'}`);
console.log(`Extension structure: ${allRequiredFilesPresent ? 'VALID' : 'INVALID'}`);

if (allRequiredFilesPresent) {
  console.log('\n✓ Extension is ready for installation!');
  console.log('\nNext steps:');
  console.log('1. Generate PNG icons using icons/icon-generator.html');
  console.log('2. Load the extension in Chrome (chrome://extensions/)');
  console.log('3. Test basic functionality');
} else {
  console.log('\n✗ Extension has issues that need to be resolved.');
}

console.log('\nFor detailed installation instructions, see INSTALL.md');
console.log('For usage documentation, see README.md');