# Integuru Integration for CDP Automation

A powerful Chrome DevTools Protocol (CDP) automation system with Integuru integration that reverse-engineers web APIs from HAR files to generate executable Python code with 8-15x speed improvements over traditional browser automation.

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd cdp-integuru-automation

# Install dependencies
npm install

# Install Integuru (automated)
npm run install:integuru

# Set up environment
cp .env.example .env
# Edit .env with your OpenAI API key
```

### Basic Usage

```javascript
const InteguruWrapper = require('./src/lib/integuru-wrapper');

async function automateWorkflow() {
  const integuru = new InteguruWrapper();
  
  // Analyze HAR file and generate code
  const result = await integuru.analyzeHAR(
    './network_requests.har',
    'Download the generated image from KlingAI',
    true
  );
  
  console.log(`Confidence: ${result.confidence}`);
  console.log(`Generated code:\n${result.code}`);
  
  // Execute the generated code
  const execution = await integuru.executeCode(result.code);
  console.log(`Execution successful: ${execution.success}`);
}

automateWorkflow();
```

## ✨ Features

- **🔄 API Reverse-Engineering**: Analyzes HAR files to understand internal APIs
- **🐍 Python Code Generation**: Generates executable Python code (8-15x faster)
- **🔒 Secure Execution**: Sandboxed Python environment with security restrictions
- **📊 Dependency Analysis**: Builds dependency graphs and identifies critical paths
- **🍪 Cookie Handling**: Extracts and manages authentication cookies
- **⚡ Performance Optimization**: Optimizes execution order and parallel processing
- **🛡️ Security Validation**: Validates generated code for security issues
- **📈 Confidence Scoring**: Provides confidence scores for generated code
- **🧪 Comprehensive Testing**: Full test suite with sample HAR files

## 📁 Project Structure

```
├── src/
│   ├── lib/
│   │   ├── integuru-wrapper.js    # Main wrapper class
│   │   ├── har-processor.js       # HAR file processing
│   │   ├── code-executor.js       # Secure Python execution
│   │   └── dependency-analyzer.js # API dependency analysis
│   └── test/
│       ├── test-integuru.js      # Test suite
│       ├── validate-generated-code.js # Code validation
│       └── sample-hars/          # Sample HAR files
│           ├── klingai-image-download.har
│           └── ecommerce-checkout.har
├── scripts/
│   └── install-integuru.sh      # Installation script
├── docs/
│   └── integuru-integration.md   # Full documentation
├── extensions/
│   └── cdp-stealth/            # Chrome extension
├── package.json                 # Node.js dependencies
└── README-integuru.md          # This file
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file:

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
```

### Configuration Options

```javascript
const integuru = new InteguruWrapper({
  model: 'gpt-4o',           // OpenAI model (gpt-4o, o1-mini, gpt-3.5-turbo)
  timeout: 30000,             // Request timeout in ms
  tempDir: './temp',          // Temporary directory
  integuruDir: './Integuru'  // Integuru installation directory
});
```

## 📖 Examples

### Example 1: KlingAI Image Download

```javascript
const InteguruWrapper = require('./src/lib/integuru-wrapper');

async function downloadKlingAIImage() {
  const integuru = new InteguruWrapper();
  
  const result = await integuru.analyzeHAR(
    './src/test/sample-hars/klingai-image-download.har',
    'Download the generated image from KlingAI',
    true
  );
  
  if (result.confidence > 0.8) {
    console.log('High confidence in generated code!');
    
    const execution = await integuru.executeCode(result.code);
    if (execution.success) {
      console.log('✅ Image downloaded successfully!');
    }
  }
}

downloadKlingAIImage();
```

### Example 2: E-commerce Checkout

```javascript
const InteguruWrapper = require('./src/lib/integuru-wrapper');

async function automateCheckout() {
  const integuru = new InteguruWrapper({
    model: 'gpt-4o',
    timeout: 60000 // Longer timeout for complex workflow
  });
  
  const result = await integuru.analyzeHAR(
    './src/test/sample-hars/ecommerce-checkout.har',
    'Complete e-commerce checkout process',
    true
  );
  
  console.log(`📊 Dependency graph depth: ${result.dependency_graph.depth}`);
  console.log(`🔗 API endpoints: ${result.api_endpoints.length}`);
  console.log(`🔐 Authentication: ${result.auth_flow.hasAuth ? 'Yes' : 'No'}`);
  
  if (result.auth_flow.hasAuth) {
    console.log('🔑 Auth endpoints:', result.auth_flow.authEndpoints);
  }
  
  return await integuru.executeCode(result.code);
}
```

### Example 3: Batch Processing

```javascript
const fs = require('fs').promises;
const path = require('path');
const InteguruWrapper = require('./src/lib/integuru-wrapper');

async function batchProcess() {
  const integuru = new InteguruWrapper();
  const harDir = './har-files';
  const files = await fs.readdir(harDir);
  const harFiles = files.filter(file => file.endsWith('.har'));
  
  console.log(`Processing ${harFiles.length} HAR files...`);
  
  for (const harFile of harFiles) {
    const harPath = path.join(harDir, harFile);
    
    try {
      const result = await integuru.analyzeHAR(harPath, `Automate ${harFile}`, true);
      console.log(`✅ ${harFile}: Confidence ${result.confidence}`);
    } catch (error) {
      console.error(`❌ ${harFile}: ${error.message}`);
    }
  }
}

batchProcess();
```

## 🧪 Testing

### Run Tests

```bash
# Run all tests
npm test

# Run Integuru-specific tests
npm run test:integuru

# Validate generated code
npm run test:validate
```

### Test with Sample HAR Files

```javascript
const InteguruWrapper = require('./src/lib/integuru-wrapper');

async function testWithSamples() {
  const integuru = new InteguruWrapper();
  
  // Test KlingAI example
  const klingaiResult = await integuru.analyzeHAR(
    './src/test/sample-hars/klingai-image-download.har',
    'Download image from KlingAI',
    true
  );
  
  console.log('KlingAI Result:', klingaiResult.confidence);
  
  // Test e-commerce example
  const checkoutResult = await integuru.analyzeHAR(
    './src/test/sample-hars/ecommerce-checkout.har',
    'Complete checkout process',
    true
  );
  
  console.log('Checkout Result:', checkoutResult.confidence);
}

testWithSamples();
```

## 🔒 Security

### Code Execution Safety

The system implements multiple security layers:

1. **Sandboxing**: Code runs in isolated process with resource limits
2. **Module Restrictions**: Only allowed modules can be imported
3. **API Blocking**: Dangerous functions like `eval()` and `exec()` are blocked
4. **Resource Limits**: Memory and CPU time are constrained
5. **File System Isolation**: Limited file system access

### Security Best Practices

```javascript
// Validate generated code before execution
const { validateAgainstHar } = require('./src/test/validate-generated-code');

const validation = await validateAgainstHar(generatedCode, harFile);
if (!validation.valid) {
  console.error('Security issues detected:', validation.issues);
  return;
}

// Execute with minimal permissions
const execution = await integuru.executeCode(generatedCode, {
  env: {
    // Only provide necessary environment variables
  },
  timeout: 10000 // Set appropriate timeout
});
```

## 📊 Performance

### Speed Improvements

| Task | Traditional CDP | Integuru API | Speedup |
|------|----------------|---------------|----------|
| KlingAI image download | 20-30s | 2-3s | 8-10x |
| Form submission | 10-15s | 1-2s | 10-15x |
| Multi-step workflow | 60-90s | 5-10s | 12-18x |

### Optimization Tips

1. **Use Appropriate Models**: `o1-mini` for simple tasks, `gpt-4o` for complex ones
2. **Optimize HAR Files**: Remove unnecessary requests before analysis
3. **Cache Results**: Reuse successful analyses when possible
4. **Parallel Processing**: Process independent workflows in parallel

## 🛠️ Advanced Usage

### Custom HAR Processing

```javascript
const HarProcessor = require('./src/lib/har-processor');

const processor = new HarProcessor({
  apiPatterns: ['/api/', '/v1/', '/graphql'],
  excludeExtensions: ['.js', '.css', '.png']
});

const analysis = await processor.process('./network.har');
console.log('Complexity:', analysis.complexity);
```

### Dependency Analysis

```javascript
const DependencyAnalyzer = require('./src/lib/dependency-analyzer');

const analyzer = new DependencyAnalyzer();
const analysis = await analyzer.analyze(processedHarData);

console.log('Critical paths:', analysis.criticalPaths);
console.log('Recommendations:', analysis.recommendations);
```

### Code Validation

```javascript
const { CodeValidator } = require('./src/test/validate-generated-code');

const validator = new CodeValidator();
const validation = await validator.validate(pythonCode);

if (!validation.valid) {
  console.log('Issues:', validation.issues);
  console.log('Score:', validation.score);
}
```

## 📚 Documentation

- **Full Documentation**: [docs/integuru-integration.md](./docs/integuru-integration.md)
- **API Reference**: See inline JSDoc comments
- **Examples**: Check `src/test/` directory
- **Installation Guide**: See `scripts/install-integuru.sh`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

### Development Setup

```bash
# Install development dependencies
npm install --dev

# Run tests in watch mode
npm run test:watch

# Start development server
npm run dev

# Lint code
npm run lint
```

## 🐛 Troubleshooting

### Common Issues

#### Integuru Installation Failed

```bash
# Check Python version
python3 --version  # Should be 3.8+

# Install Poetry manually
curl -sSL https://install.python-poetry.org | python3 -

# Verify installation
poetry --version
```

#### Code Execution Timeout

```javascript
// Increase timeout
const integuru = new InteguruWrapper({
  timeout: 60000, // 60 seconds
  codeTimeout: 30000 // 30 seconds for code execution
});
```

#### Low Confidence Scores

- Ensure HAR file contains complete requests and responses
- Check that authentication flows are properly captured
- Verify API calls are not obfuscated or encrypted
- Try more specific task prompts

#### Memory Issues

```javascript
// Limit memory usage
const executor = new CodeExecutor({
  maxMemory: '128m', // Reduce memory limit
  timeout: 5000      // Shorter timeout
});
```

### Debug Mode

```javascript
const integuru = new InteguruWrapper({
  debug: true,
  verbose: true
});

// Enable detailed logging
console.log('Debug mode enabled');
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Integuru](https://github.com/Integuru-AI/Integuru) - API reverse-engineering
- [mitmproxy](https://mitmproxy.org/) - Network interception
- [rebrowser-patches](https://github.com/rebrowser/rebrowser-patches) - CDP stealth
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/) - Browser automation

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-org/cdp-integuru-automation/issues)
- **Documentation**: [Wiki](https://github.com/your-org/cdp-integuru-automation/wiki)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/cdp-integuru-automation/discussions)

---

**⚡ Transform your browser automation with API-first approach - 8-15x faster execution!**