# Browser State Capture and Replay System

This document describes the comprehensive browser state capture and replay functionality implemented in the CDP automation system.

## Overview

The browser state capture and replay system consists of four main components:

1. **BrowserStateCapture** (`browser-state-capture.js`) - Captures complete browser state
2. **StateReplay** (`state-replay.js`) - Restores state to new browser instances
3. **SessionManager** (`session-manager.js`) - Manages session lifecycle and persistence
4. **ReplayEngine** (`replay-engine.js`) - Replays action sequences with timing

## Features

### BrowserStateCapture

- **Complete State Capture**: Captures cookies, localStorage, sessionStorage, IndexedDB, Cache Storage, Service Workers, and DOM state
- **State Serialization**: Supports compression and encryption for large states
- **State Validation**: Integrity checking with checksums and validation rules
- **Cross-browser Compatibility**: Handles differences between browser implementations
- **State Comparison**: Diff utilities to compare states and identify changes
- **Performance Optimization**: Batch processing and efficient handling of large states

### StateReplay

- **Step-by-step Restoration**: Ordered restoration of browser state components
- **Error Handling**: Retry mechanisms and recovery strategies
- **State Verification**: Post-restoration validation to ensure accuracy
- **Performance Optimization**: Optimized restoration for large states
- **Cross-browser Support**: Adapts to different browser environments

### SessionManager

- **Session Lifecycle**: Create, load, update, and delete sessions
- **Persistence**: Automatic saving and loading of session data
- **Metadata Management**: Rich metadata with tags, descriptions, and versioning
- **Sharing & Export**: Export sessions for sharing and import
- **Cleanup & Maintenance**: Automatic cleanup of old sessions
- **Statistics**: Comprehensive session analytics and storage usage

### ReplayEngine

- **Action Sequence Replay**: Accurate replay of recorded actions with timing
- **Screenshot Comparison**: Visual verification with similarity scoring
- **Error Recovery**: Intelligent recovery strategies for failed actions
- **Speed Control**: Adjustable replay speed with dry-run mode
- **Visual Verification**: Integration with GLM-4.5V for visual analysis

## Usage Examples

### Basic Browser State Capture

```javascript
const BrowserStateCapture = require('./browser-state-capture');

const capture = new BrowserStateCapture({
  tempDir: './temp',
  compressionEnabled: true,
  validationEnabled: true
});

// Capture complete browser state
const state = await capture.captureBrowserState(page, {
  includeScreenshot: true
});

// Compare two states
const comparison = capture.compareStates(state1, state2);
console.log(`Differences found: ${comparison.summary.totalDifferences}`);
```

### State Replay

```javascript
const StateReplay = require('./state-replay');

const replay = new StateReplay({
  tempDir: './temp',
  validationEnabled: true,
  retryAttempts: 3
});

// Apply state to new page
const results = await replay.applyBrowserState(page, state, {
  verify: true,
  restoreIndexedDB: true
});

console.log(`State applied successfully: ${results.success}`);
```

### Session Management

```javascript
const SessionManager = require('./session-manager');

const sessionManager = new SessionManager({
  sessionsDir: './sessions',
  maxSessions: 100,
  autoCleanup: true
});

// Create new session
const session = await sessionManager.createSession({
  title: 'Login Test',
  description: 'Testing login functionality',
  tags: ['test', 'login'],
  domain: 'example.com'
});

// Add action to session
await sessionManager.addAction(session.sessionId, {
  type: 'CDP_COMMAND',
  method: 'Page.navigate',
  params: { url: 'https://example.com' }
});

// Export session for sharing
const exportResult = await sessionManager.exportSession(session.sessionId);
console.log(`Session exported to: ${exportResult.exportPath}`);
```

### Action Replay

```javascript
const ReplayEngine = require('./replay-engine');

const replayEngine = new ReplayEngine({
  tempDir: './temp',
  screenshotComparisonEnabled: true,
  visualVerificationEnabled: true,
  glmApiKey: 'your-glm-api-key'
});

// Replay session with options
const replayResults = await replayEngine.replaySession(page, session, {
  speedMultiplier: 2.0,
  skipScreenshots: false,
  dryRun: false,
  enableErrorRecovery: true
});

// Generate report
const report = replayEngine.generateReplayReport(replayResults);
console.log(`Replay success rate: ${report.summary.successRate}`);
```

## State Structure

The captured browser state includes the following components:

```javascript
{
  version: "1.0.0",
  timestamp: "2025-11-19T21:59:00.000Z",
  pageInfo: {
    url: "https://example.com",
    title: "Example Page",
    userAgent: "Mozilla/5.0...",
    // ... more page info
  },
  cookies: [
    {
      name: "session_id",
      value: "abc123",
      domain: ".example.com",
      // ... more cookie properties
    }
  ],
  localStorage: {
    storage: {
      key1: "value1",
      key2: "value2"
    },
    metadata: {
      itemCount: 2,
      size: 24
    }
  },
  sessionStorage: {
    // Similar structure to localStorage
  },
  indexedDB: {
    databases: [
      {
        name: "mydb",
        version: 1,
        objectStores: [
          {
            name: "users",
            data: [...]
          }
        ]
      }
    ]
  },
  // ... more state components
}
```

## Configuration Options

### BrowserStateCapture Options

```javascript
{
  tempDir: './temp',           // Temporary directory for files
  compressionEnabled: true,     // Enable state compression
  validationEnabled: true,      // Enable state validation
  maxStateSize: 52428800,    // Maximum state size (50MB)
  logger: console              // Logger instance
}
```

### StateReplay Options

```javascript
{
  tempDir: './temp',           // Temporary directory
  validationEnabled: true,      // Enable state validation
  retryAttempts: 3,           // Number of retry attempts
  retryDelay: 1000,           // Delay between retries (ms)
  maxStateSize: 52428800,    // Maximum state size
  logger: console              // Logger instance
}
```

### SessionManager Options

```javascript
{
  sessionsDir: './sessions',    // Sessions directory
  maxSessions: 100,           // Maximum sessions to keep
  maxSessionAge: 2592000000,  // Maximum session age (30 days)
  compressionEnabled: true,    // Enable compression
  encryptionEnabled: false,     // Enable encryption
  autoCleanup: true,           // Enable automatic cleanup
  cleanupInterval: 3600000,    // Cleanup interval (1 hour)
  logger: console              // Logger instance
}
```

### ReplayEngine Options

```javascript
{
  tempDir: './temp',                    // Temporary directory
  screenshotComparisonEnabled: true,      // Enable screenshot comparison
  visualVerificationEnabled: true,        // Enable visual verification
  errorRecoveryEnabled: true,            // Enable error recovery
  speedMultiplier: 1.0,                // Default replay speed
  maxRetryAttempts: 3,                  // Maximum retry attempts
  retryDelay: 1000,                    // Delay between retries
  screenshotThreshold: 0.95,            // Screenshot similarity threshold
  glmApiKey: 'your-api-key',            // GLM API key for visual verification
  logger: console                       // Logger instance
}
```

## Error Handling

All modules include comprehensive error handling:

- **Validation Errors**: Invalid state data or parameters
- **File System Errors**: Disk space, permissions, I/O issues
- **Network Errors**: Connection issues, timeouts
- **Browser Errors**: Element not found, JavaScript errors
- **Recovery Strategies**: Automatic retry with different approaches

## Performance Considerations

### Large State Handling

- **Compression**: Automatic compression for states > 1MB
- **Batch Processing**: Cookies and storage items processed in batches
- **Memory Management**: Streaming for large files
- **Parallel Processing**: Non-critical steps executed in parallel

### Optimization Strategies

- **Selective Restoration**: Option to restore only critical components
- **Caching**: Frequently used states cached in memory
- **Cleanup**: Automatic cleanup of temporary files
- **Monitoring**: Performance metrics and warnings

## Security Features

### Data Protection

- **Encryption**: Optional AES-256 encryption for sensitive data
- **Sanitization**: Sensitive data masked in shared sessions
- **Access Control**: Permission-based session sharing
- **Token Security**: Secure share tokens with expiration

### Privacy

- **Local Storage**: All data stored locally by default
- **Data Minimization**: Only capture necessary data
- **Secure Cleanup**: Secure deletion of temporary files
- **Audit Logging**: Complete audit trail of operations

## Integration with CDP Extension

The browser state capture system integrates seamlessly with the CDP extension:

1. **Extension Communication**: Direct communication with CDP extension
2. **State Synchronization**: Real-time state synchronization
3. **Event Handling**: Browser events captured and processed
4. **Command Execution**: CDP commands executed through extension

## Troubleshooting

### Common Issues

1. **State Capture Fails**
   - Check browser permissions
   - Verify extension is loaded
   - Ensure sufficient disk space

2. **State Replay Fails**
   - Verify state integrity
   - Check browser compatibility
   - Review error logs

3. **Session Management Issues**
   - Check file permissions
   - Verify directory structure
   - Review storage limits

### Debug Mode

Enable debug logging for detailed troubleshooting:

```javascript
const debugOptions = {
  logger: {
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error
  }
};
```

## API Reference

### BrowserStateCapture Methods

- `captureBrowserState(page, options)` - Capture complete browser state
- `serializeState(state, options)` - Serialize and compress state
- `deserializeState(serializedData, options)` - Deserialize and decompress state
- `compareStates(state1, state2)` - Compare two states
- `validateState(state)` - Validate state integrity

### StateReplay Methods

- `applyBrowserState(page, state, options)` - Apply state to page
- `createRestorationPlan(state, options)` - Create restoration plan
- `verifyStateApplication(page, originalState, results)` - Verify state application

### SessionManager Methods

- `createSession(sessionData)` - Create new session
- `loadSession(sessionId)` - Load existing session
- `updateSession(sessionId, updates)` - Update session
- `deleteSession(sessionId)` - Delete session
- `exportSession(sessionId, options)` - Export session
- `importSession(exportPath, options)` - Import session
- `shareSession(sessionId, options)` - Share session

### ReplayEngine Methods

- `replaySession(page, session, options)` - Replay complete session
- `replayAction(page, action, options)` - Replay single action
- `compareScreenshots(original, new, options)` - Compare screenshots
- `generateReplayReport(results)` - Generate replay report

## Best Practices

1. **State Capture**
   - Capture state before critical actions
   - Include screenshots for visual verification
   - Validate state after capture

2. **Session Management**
   - Use descriptive titles and tags
   - Regular cleanup of old sessions
   - Export important sessions for backup

3. **Replay Operations**
   - Start with dry-run mode
   - Use appropriate speed multiplier
   - Monitor error recovery attempts

4. **Performance**
   - Enable compression for large states
   - Use selective restoration when possible
   - Monitor storage usage regularly

## Future Enhancements

- **Cloud Storage**: Integration with cloud storage providers
- **Collaboration**: Multi-user session sharing
- **Advanced Analytics**: Machine learning for pattern recognition
- **Mobile Support**: Extension to mobile browsers
- **API Integration**: REST API for remote management