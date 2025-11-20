/**
 * Integuru Wrapper - Integration layer for Integuru API reverse-engineering
 * 
 * This wrapper provides a clean interface for:
 * - HAR file analysis and cookie extraction
 * - Task prompt analysis for code generation
 * - Python code execution in isolated environment
 * - Error handling and timeout management
 * - Integration with the MCP server
 * 
 * Based on the specifications from implementation_guide.md and document.pdf
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const { promisify } = require('util');
const { exec } = require('child_process');
const execAsync = promisify(exec);
const HarProcessor = require('./har-processor');
const CodeExecutor = require('./code-executor');
const DependencyAnalyzer = require('./dependency-analyzer');

class InteguruWrapper {
  constructor(options = {}) {
    this.model = options.model || 'gpt-4o';
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY;
    this.integuruDir = options.integuruDir || path.join(process.cwd(), 'Integuru');
    this.timeout = options.timeout || 30000; // 30 seconds default
    this.tempDir = options.tempDir || path.join(process.cwd(), 'temp');
    
    // Initialize helper modules
    this.harProcessor = new HarProcessor();
    this.codeExecutor = new CodeExecutor({
      timeout: options.codeTimeout || 10000,
      tempDir: this.tempDir
    });
    this.dependencyAnalyzer = new DependencyAnalyzer();
    
    // Ensure temp directory exists
    this.ensureTempDir();
  }

  /**
   * Analyze HAR file and generate automation code
   * 
   * @param {string} harFile - Path to HAR file
   * @param {string} taskPrompt - Description of what the user did
   * @param {boolean} generateCode - Whether to generate executable Python code
   * @returns {Promise<Object>} Analysis result with dependency graph, code, confidence
   */
  async analyzeHAR(harFile, taskPrompt, generateCode = true) {
    try {
      // Validate inputs
      if (!await this.fileExists(harFile)) {
        throw new Error(`HAR file not found: ${harFile}`);
      }
      
      // Step 1: Preprocess HAR file
      const processedHar = await this.harProcessor.process(harFile);
      
      // Step 2: Extract cookies from HAR
      const cookies = await this.harProcessor.extractCookies(harFile);
      const cookiesFile = await this.saveTempFile(cookies, 'cookies', '.json');
      
      // Step 3: Analyze dependencies
      const dependencyGraph = await this.dependencyAnalyzer.analyze(processedHar);
      
      // Step 4: Run Integuru analysis
      const integuruResult = await this.runInteguruAnalysis({
        harPath: harFile,
        cookiesPath: cookiesFile,
        taskPrompt,
        generateCode,
        model: this.model
      });
      
      // Step 5: Calculate confidence score
      const confidence = this.calculateConfidence({
        dependencyGraph,
        integuruConfidence: integuruResult.confidence,
        harComplexity: processedHar.complexity
      });
      
      return {
        dependency_graph: dependencyGraph,
        code: integuruResult.generated_code,
        confidence,
        estimated_time_seconds: integuruResult.estimated_time || 3,
        cookies_extracted: cookies.length,
        api_endpoints: processedHar.apiEndpoints,
        complexity_score: processedHar.complexity,
        raw_integuru_output: integuruResult
      };
      
    } catch (error) {
      throw new Error(`Integuru analysis failed: ${error.message}`);
    }
  }

  /**
   * Execute generated Python code in isolated environment
   * 
   * @param {string} code - Python code to execute
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Execution result
   */
  async executeCode(code, options = {}) {
    try {
      return await this.codeExecutor.execute(code, {
        timeout: options.timeout || this.timeout,
        env: options.env || {},
        workingDir: options.workingDir || this.tempDir
      });
    } catch (error) {
      throw new Error(`Code execution failed: ${error.message}`);
    }
  }

  /**
   * Run Integuru analysis command
   * 
   * @param {Object} params - Analysis parameters
   * @returns {Promise<Object>} Integuru output
   */
  async runInteguruAnalysis(params) {
    const { harPath, cookiesPath, taskPrompt, generateCode, model } = params;
    
    // Build command
    const cmd = [
      'poetry', 'run', 'integuru',
      '--prompt', taskPrompt,
      '--model', model,
      '--har-path', harPath,
      '--cookie-path', cookiesPath
    ];
    
    if (generateCode) {
      cmd.push('--generate-code');
    }
    
    try {
      // Execute in Integuru directory
      const { stdout, stderr } = await execAsync(cmd.join(' '), {
        cwd: this.integuruDir,
        timeout: this.timeout
      });
      
      if (stderr && stderr.includes('ERROR')) {
        throw new Error(`Integuru error: ${stderr}`);
      }
      
      // Parse JSON output
      try {
        return JSON.parse(stdout);
      } catch (parseError) {
        // If output is not JSON, return as raw output
        return {
          generated_code: stdout,
          confidence: 0.80,
          estimated_time: 3,
          raw_output: stdout
        };
      }
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('Integuru not found. Please install Integuru first.');
      }
      throw error;
    }
  }

  /**
   * Calculate confidence score based on multiple factors
   * 
   * @param {Object} factors - Factors affecting confidence
   * @returns {number} Confidence score between 0 and 1
   */
  calculateConfidence(factors) {
    const { dependencyGraph, integuruConfidence, harComplexity } = factors;
    
    let confidence = integuruConfidence || 0.80;
    
    // Adjust based on dependency depth
    if (dependencyGraph && dependencyGraph.depth) {
      if (dependencyGraph.depth <= 3) {
        confidence = Math.min(1.0, confidence + 0.10);
      } else if (dependencyGraph.depth > 10) {
        confidence = Math.max(0.3, confidence - 0.20);
      }
    }
    
    // Adjust based on HAR complexity
    if (harComplexity) {
      if (harComplexity.apiCount <= 5) {
        confidence = Math.min(1.0, confidence + 0.05);
      } else if (harComplexity.apiCount > 20) {
        confidence = Math.max(0.4, confidence - 0.15);
      }
    }
    
    return Math.round(confidence * 100) / 100;
  }

  /**
   * Save data to temporary file
   * 
   * @param {*} data - Data to save
   * @param {string} prefix - File prefix
   * @param {string} suffix - File suffix
   * @returns {Promise<string>} Path to saved file
   */
  async saveTempFile(data, prefix, suffix) {
    await this.ensureTempDir();
    const fileName = `${prefix}_${Date.now()}${suffix}`;
    const filePath = path.join(this.tempDir, fileName);
    
    if (typeof data === 'object') {
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } else {
      await fs.writeFile(filePath, data.toString());
    }
    
    return filePath;
  }

  /**
   * Check if file exists
   * 
   * @param {string} filePath - Path to file
   * @returns {Promise<boolean>} Whether file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Ensure temp directory exists
   */
  async ensureTempDir() {
    try {
      await fs.access(this.tempDir);
    } catch {
      await fs.mkdir(this.tempDir, { recursive: true });
    }
  }

  /**
   * Clean up temporary files
   */
  async cleanup() {
    try {
      const files = await fs.readdir(this.tempDir);
      await Promise.all(
        files.map(file => fs.unlink(path.join(this.tempDir, file)))
      );
    } catch (error) {
      console.warn('Cleanup warning:', error.message);
    }
  }

  /**
   * Get available models from Integuru
   * 
   * @returns {Promise<string[]>} List of available models
   */
  async getAvailableModels() {
    try {
      const { stdout } = await execAsync('poetry run integuru --help', {
        cwd: this.integuruDir
      });
      
      // Parse help output to extract models
      const modelMatch = stdout.match(/--model\s+\[(.*?)\]/);
      if (modelMatch) {
        return modelMatch[1].split(',').map(m => m.trim());
      }
      
      return ['gpt-4o', 'o1-mini', 'gpt-3.5-turbo']; // Default fallback
    } catch (error) {
      return ['gpt-4o', 'o1-mini', 'gpt-3.5-turbo']; // Default fallback
    }
  }

  /**
   * Validate Integuru installation
   * 
   * @returns {Promise<boolean>} Whether Integuru is properly installed
   */
  async validateInstallation() {
    try {
      await execAsync('poetry run integuru --version', {
        cwd: this.integuruDir
      });
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = InteguruWrapper;