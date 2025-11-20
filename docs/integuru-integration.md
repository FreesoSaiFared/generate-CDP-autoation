# Integuru Integration Documentation

## Overview

The Integuru integration provides a powerful API reverse-engineering system that analyzes HAR (HTTP Archive) files to generate executable Python code for automating web interactions. This integration offers 8-15x speed improvements over traditional browser automation by directly calling APIs instead of simulating user interactions.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   HAR Files    │───▶│  HarProcessor   │───▶│ InteguruWrapper │
│                 │    │                 │    │                 │
│ - Network logs  │    │ - Validation    │    │ - Code gen      │
│ - API calls    │    │ - Extraction    │    │ - Execution     │
│ - Cookies      │    │ - Analysis      │    │ - Error handling│
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                                                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ CodeExecutor   │◀───│ DependencyAnalyzer│◀───│ Generated Code  │
│                 │    │                 │    │                 │
│ - Sandbox      │    │ - Graph build   │    │ - Python        │
│ - Security     │    │ - Critical path │    │ - APIs          │
│ - Timeouts     │    │ - Optimization │    │ - Auth          │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Components

### 1. InteguruWrapper (`src/lib/integuru-wrapper.js`)

The main wrapper class that orchestrates the entire analysis and execution process.

**Key Features:**
- HAR file analysis and preprocessing
- Cookie extraction and management
- Python code generation via Integuru
- Safe code execution in isolated environment
- Error handling and timeout management
- Confidence scoring and optimization

**Basic Usage:**

```javascript
const InteguruWrapper = require('./src/lib/integuru-wrapper');

const integuru = new InteguruWrapper({
  model: 'gpt-4o',
  timeout: 30000,
  tempDir: './temp'
});

// Analyze HAR file and generate code
const result = await integuru.analyzeHAR(
  './network_requests.har',
  'Download the generated image from KlingAI',
  true // generate code
);

console.log(`Confidence: ${result.confidence}`);
console.log(`Generated code:\n${result.code}`);

// Execute the generated code
const execution = await integuru.executeCode(result.code);
console.log(`Execution successful: ${execution.success}`);
```

### 2. HarProcessor (`src/lib/har-processor.js`)

Handles HAR file validation, preprocessing, and analysis.

**Key Features:**
- HAR format validation
- API endpoint identification
- Cookie extraction and processing
- Dynamic parameter detection
- Authentication token extraction
- Dependency graph building
- Complexity scoring

**Usage:**

```javascript
const HarProcessor = require('./src/lib/har-processor');

const processor = new HarProcessor();
const analysis = await processor.process('./network_requests.har');

console.log(`Found ${analysis.apiEndpoints.length} API endpoints`);
console.log(`Complexity score: ${analysis.complexity.score}`);
```

### 3. CodeExecutor (`src/lib/code-executor.js`)

Provides secure Python code execution in an isolated environment.

**Key Features:**
- Sandboxed execution with resource limits
- Security restrictions and module blocking
- Timeout management
- Output capture and error handling
- Memory and CPU limits
- Temporary file management

**Usage:**

```javascript
const CodeExecutor = require('./src/lib/code-executor');

const executor = new CodeExecutor({
  timeout: 10000,
  maxMemory: '256m'
});

const result = await executor.execute(pythonCode);
console.log(`Success: ${result.success}`);
console.log(`Output: ${result.output}`);
```

### 4. DependencyAnalyzer (`src/lib/dependency-analyzer.js`)

Analyzes API call dependencies and builds execution graphs.

**Key Features:**
- Dependency graph construction
- Critical path identification
- Authentication flow analysis
- Session dependency detection
- Execution order optimization
- Performance recommendations

**Usage:**

```javascript
const DependencyAnalyzer = require('./src/lib/dependency-analyzer');

const analyzer = new DependencyAnalyzer();
const analysis = await analyzer.analyze(processedHarData);

console.log(`Critical paths: ${analysis.criticalPaths.length}`);
console.log(`Auth flow: ${analysis.authFlow.hasAuth}`);
```

## Installation

### Prerequisites

- Node.js 18.0+
- Python 3.8+
- Poetry (for Python dependency management)
- Git

### Automated Installation

```bash
# Run the installation script
./scripts/install-integuru.sh

# This will:
# 1. Install Python dependencies
# 2. Install Poetry
# 3. Clone Integuru repository
# 4. Set up Python environment
# 5. Create helper scripts
```

### Manual Installation

```bash
# 1. Install Node.js dependencies
npm install

# 2. Install Poetry
curl -sSL https://install.python-poetry.org | python3 -

# 3. Clone Integuru
git clone https://github.com/Integuru-AI/Integuru.git
cd Integuru
poetry install
cd ..

# 4. Set up environment
cp .env.example .env
# Edit .env with your OpenAI API key
```

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# OpenAI API Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Integuru Configuration
INTEGURU_MODEL=gpt-4o
INTEGURU_TIMEOUT=30
INTEGURU_TEMP_DIR=./temp

# Code Execution Configuration
CODE_EXECUTOR_TIMEOUT=10
CODE_EXECUTOR_MAX_MEMORY=256m

# HAR Processing Configuration
HAR_PROCESSOR_MAX_ENTRIES=1000
HAR_PROCESSOR_EXCLUDE_EXTENSIONS=.js,.css,.png,.jpg,.gif
```

### Configuration File

You can also use a JSON configuration file:

```json
{
  "integuru": {
    "model": "gpt-4o",
    "timeout": 30000,
    "tempDir": "./temp",
    "integuruDir": "./Integuru"
  },
  "codeExecutor": {
    "timeout": 10000,
    "maxMemory": "256m",
    "maxCpuTime": 5,
    "allowedModules": ["requests", "json", "time", "datetime"],
    "blockedModules": ["os", "sys", "subprocess", "socket"]
  },
  "harProcessor": {
    "apiPatterns": ["/api/", "/v1/", "/graphql"],
    "excludeExtensions": [".js", ".css", ".png", ".jpg", ".gif"]
  }
}
```

## Usage Examples

### Example 1: KlingAI Image Download

```javascript
const InteguruWrapper = require('./src/lib/integuru-wrapper');

async function downloadKlingAIImage() {
  const integuru = new InteguruWrapper();
  
  // Analyze HAR file from KlingAI image generation
  const result = await integuru.analyzeHAR(
    './src/test/sample-hars/klingai-image-download.har',
    'Download the generated image from KlingAI',
    true
  );
  
  if (result.confidence > 0.8) {
    console.log('High confidence in generated code!');
    console.log('Generated Python code:');
    console.log(result.code);
    
    // Execute the code
    const execution = await integuru.executeCode(result.code);
    if (execution.success) {
      console.log('Image downloaded successfully!');
      console.log(`Output: ${execution.output}`);
    } else {
      console.error('Execution failed:', execution.error);
    }
  } else {
    console.log('Low confidence, manual review recommended');
  }
}

downloadKlingAIImage();
```

### Example 2: E-commerce Checkout Automation

```javascript
const InteguruWrapper = require('./src/lib/integuru-wrapper');

async function automateCheckout() {
  const integuru = new InteguruWrapper({
    model: 'gpt-4o',
    timeout: 60000 // Longer timeout for complex workflow
  });
  
  // Analyze checkout workflow
  const result = await integuru.analyzeHAR(
    './src/test/sample-hars/ecommerce-checkout.har',
    'Complete e-commerce checkout process',
    true
  );
  
  console.log(`Dependency graph depth: ${result.dependency_graph.depth}`);
  console.log(`API endpoints: ${result.api_endpoints.length}`);
  console.log(`Confidence: ${result.confidence}`);
  
  // Check for authentication requirements
  if (result.auth_flow.hasAuth) {
    console.log('Authentication flow detected');
    console.log('Auth endpoints:', result.auth_flow.authEndpoints);
  }
  
  // Execute with custom environment
  const execution = await integuru.executeCode(result.code, {
    env: {
      USER_EMAIL: 'user@example.com',
      USER_PASSWORD: 'secure_password'
    }
  });
  
  return execution;
}
```

### Example 3: Batch Processing

```javascript
const fs = require('fs').promises;
const path = require('path');
const InteguruWrapper = require('./src/lib/integuru-wrapper');

async function batchProcessHARFiles(harDirectory) {
  const integuru = new InteguruWrapper();
  const files = await fs.readdir(harDirectory);
  const harFiles = files.filter(file => file.endsWith('.har'));
  
  const results = [];
  
  for (const harFile of harFiles) {
    const harPath = path.join(harDirectory, harFile);
    const taskPrompt = `Automate the workflow captured in ${harFile}`;
    
    try {
      const result = await integuru.analyzeHAR(harPath, taskPrompt, true);
      results.push({
        file: harFile,
        success: true,
        confidence: result.confidence,
        endpoints: result.api_endpoints.length
      });
    } catch (error) {
      results.push({
        file: harFile,
        success: false,
        error: error.message
      });
    }
  }
  
  return results;
}
```

## Testing

### Running Tests

```bash
# Run all tests
npm run test

# Run Integuru-specific tests
npm run test:integuru

# Run code validation
npm run test:validate
```

### Test Suite

The test suite includes:

1. **Unit Tests**: Individual component testing
2. **Integration Tests**: End-to-end workflow testing
3. **Security Tests**: Sandbox and security validation
4. **Performance Tests**: Timeout and resource limit testing
5. **Edge Case Tests**: Error handling and malformed input

### Sample HAR Files

Sample HAR files are provided in `src/test/sample-hars/`:

- `klingai-image-download.har`: Image download workflow
- `ecommerce-checkout.har`: Complete checkout process

### Code Validation

Validate generated Python code:

```bash
node src/test/validate-generated-code.js generated_code.py network.har
```

## Security Considerations

### Code Execution Safety

The CodeExecutor implements multiple security layers:

1. **Sandboxing**: Code runs in isolated process with resource limits
2. **Module Restrictions**: Only allowed modules can be imported
3. **API Blocking**: Dangerous functions like `eval()` and `exec()` are blocked
4. **Resource Limits**: Memory and CPU time are constrained
5. **File System Isolation**: Limited file system access

### Data Privacy

- HAR files may contain sensitive data (cookies, tokens)
- Temporary files are automatically cleaned up
- No data is sent to external services except Integuru API
- Consider sanitizing HAR files before processing

### Best Practices

1. **Review Generated Code**: Always review generated code before execution
2. **Use Sandboxes**: Execute in isolated environments
3. **Limit Permissions**: Run with minimal required permissions
4. **Monitor Resources**: Watch for excessive resource usage
5. **Validate Inputs**: Validate all inputs and outputs

## Troubleshooting

### Common Issues

#### Integuru Installation Failed

```bash
# Check Python version
python3 --version  # Should be 3.8+

# Install Poetry manually
curl -sSL https://install.python-poetry.org | python3 -

# Verify Poetry installation
poetry --version
```

#### Code Execution Timeout

```javascript
// Increase timeout
const executor = new CodeExecutor({
  timeout: 30000, // 30 seconds
  maxMemory: '512m'
});
```

#### HAR File Validation Errors

```bash
# Validate HAR format
node -e "console.log(JSON.parse(require('fs').readFileSync('test.har', 'utf8')))"
```

#### Low Confidence Scores

- Check HAR file quality (complete requests/responses)
- Ensure authentication flows are captured
- Verify API calls are not obfuscated
- Consider providing more specific task prompts

### Debug Mode

Enable debug logging:

```javascript
const integuru = new InteguruWrapper({
  debug: true,
  verbose: true
});
```

## Performance Optimization

### Improving Execution Speed

1. **Use Appropriate Models**: `o1-mini` for simple tasks, `gpt-4o` for complex ones
2. **Optimize HAR Files**: Remove unnecessary requests
3. **Cache Results**: Reuse successful analyses
4. **Parallel Processing**: Process independent workflows in parallel

### Memory Management

```javascript
// Clean up temporary files
await integuru.cleanup();

// Get execution statistics
const stats = await integuru.getStats();
console.log('Memory usage:', stats.memoryUsed);
```

## API Reference

### InteguruWrapper

#### Constructor Options

| Option | Type | Default | Description |
|---------|------|---------|-------------|
| model | string | 'gpt-4o' | OpenAI model to use |
| apiKey | string | process.env.OPENAI_API_KEY | OpenAI API key |
| timeout | number | 30000 | Request timeout in ms |
| tempDir | string | './temp' | Temporary directory |

#### Methods

##### `analyzeHAR(harFile, taskPrompt, generateCode)`

Analyzes a HAR file and generates automation code.

**Parameters:**
- `harFile` (string): Path to HAR file
- `taskPrompt` (string): Description of the task
- `generateCode` (boolean): Whether to generate executable code

**Returns:** Promise<Object> with analysis results

##### `executeCode(code, options)`

Executes Python code in isolated environment.

**Parameters:**
- `code` (string): Python code to execute
- `options` (Object): Execution options

**Returns:** Promise<Object> with execution results

### HarProcessor

#### Methods

##### `process(harPath)`

Processes and analyzes HAR file.

**Returns:** Promise<Object> with processed data

##### `extractCookies(harPath)`

Extracts cookies from HAR file.

**Returns:** Promise<Array> of cookie objects

### CodeExecutor

#### Constructor Options

| Option | Type | Default | Description |
|---------|------|---------|-------------|
| timeout | number | 10000 | Execution timeout in ms |
| maxMemory | string | '256m' | Memory limit |
| allowedModules | Array | ['requests', 'json'] | Allowed Python modules |

#### Methods

##### `execute(code, options)`

Executes Python code securely.

**Returns:** Promise<Object> with execution results

##### `validateCode(code)`

Validates code for security issues.

**Returns:** Object with validation results

### DependencyAnalyzer

#### Methods

##### `analyze(processedHar)`

Analyzes dependencies in processed HAR data.

**Returns:** Promise<Object> with dependency analysis

## Contributing

### Development Setup

```bash
# Clone repository
git clone <repository-url>
cd cdp-integuru-automation

# Install dependencies
npm install

# Run tests
npm test

# Start development server
npm run dev
```

### Code Style

- Use ESLint configuration
- Follow JavaScript Standard Style
- Add JSDoc comments for public methods
- Write unit tests for new features

### Submitting Changes

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

- Issues: [GitHub Issues](https://github.com/your-org/cdp-integuru-automation/issues)
- Documentation: [Wiki](https://github.com/your-org/cdp-integuru-automation/wiki)
- Discussions: [GitHub Discussions](https://github.com/your-org/cdp-integuru-automation/discussions)

## Changelog

### v1.0.0 (2025-01-19)

- Initial release
- Integuru integration
- HAR processing and analysis
- Secure code execution
- Dependency analysis
- Comprehensive test suite
- Documentation and examples