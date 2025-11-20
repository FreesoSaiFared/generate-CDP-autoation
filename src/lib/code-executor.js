/**
 * Code Executor - Safe Python code execution environment
 * 
 * This module provides functionality for:
 * - Secure Python code execution in isolated environment
 * - Timeout management and resource limits
 * - Output capture and error handling
 * - Sandboxing with restricted permissions
 * - Execution statistics and performance monitoring
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const { promisify } = require('util');
const os = require('os');

class CodeExecutor {
  constructor(options = {}) {
    this.timeout = options.timeout || 10000; // 10 seconds default
    this.tempDir = options.tempDir || path.join(os.tmpdir(), 'integuru-execution');
    this.maxMemory = options.maxMemory || '256m'; // Memory limit
    this.maxCpuTime = options.maxCpuTime || 5; // CPU time in seconds
    this.allowedModules = options.allowedModules || [
      'requests', 'json', 'time', 'datetime', 'urllib', 'http.client',
      'base64', 'hashlib', 'hmac', 'uuid', 'random', 'string'
    ];
    this.blockedModules = options.blockedModules || [
      'os', 'sys', 'subprocess', 'socket', 'threading', 'multiprocessing',
      'ctypes', 'importlib', 'eval', 'exec', 'compile', '__import__'
    ];
    
    // Ensure temp directory exists
    this.ensureTempDir();
  }

  /**
   * Execute Python code in isolated environment
   * 
   * @param {string} code - Python code to execute
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Execution result
   */
  async execute(code, options = {}) {
    const executionId = this.generateExecutionId();
    const startTime = Date.now();
    
    try {
      // Prepare execution environment
      const executionDir = await this.createExecutionDir(executionId);
      const codeFile = await this.prepareCode(code, executionDir);
      const envVars = await this.prepareEnvironment(options.env || {});
      
      // Execute the code
      const result = await this.executeInSandbox(codeFile, {
        timeout: options.timeout || this.timeout,
        env: envVars,
        workingDir: options.workingDir || executionDir
      });
      
      // Calculate execution metrics
      const executionTime = Date.now() - startTime;
      
      // Clean up
      await this.cleanup(executionDir);
      
      return {
        success: result.exitCode === 0,
        exitCode: result.exitCode,
        output: result.stdout,
        error: result.stderr,
        executionTime,
        executionId,
        memoryUsed: result.memoryUsed,
        timeout: result.timedOut
      };
      
    } catch (error) {
      return {
        success: false,
        exitCode: -1,
        output: '',
        error: error.message,
        executionTime: Date.now() - startTime,
        executionId,
        timeout: error.message.includes('timeout')
      };
    }
  }

  /**
   * Execute code with security restrictions
   * 
   * @param {string} codeFile - Path to code file
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Execution result
   */
  async executeInSandbox(codeFile, options) {
    return new Promise((resolve, reject) => {
      // Prepare security wrapper script
      const wrapperScript = this.createSecurityWrapper(codeFile);
      
      // Use resource limits (ulimit)
      const args = [
        '-c', `ulimit -t ${this.maxCpuTime} -v ${this.maxMemory} && python3 ${wrapperScript}`
      ];
      
      const child = spawn('bash', args, {
        cwd: options.workingDir,
        env: { ...process.env, ...options.env },
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false
      });
      
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      
      // Set up timeout
      const timeoutId = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
        reject(new Error(`Execution timed out after ${options.timeout}ms`));
      }, options.timeout);
      
      // Capture output
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        clearTimeout(timeoutId);
        
        if (!timedOut) {
          resolve({
            exitCode: code,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            timedOut: false,
            memoryUsed: null // TODO: Implement memory tracking
          });
        }
      });
      
      child.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  /**
   * Create security wrapper script for code execution
   * 
   * @param {string} codeFile - Path to user code file
   * @returns {string} Path to wrapper script
   */
  createSecurityWrapper(codeFile) {
    const wrapperCode = `
import sys
import importlib
import builtins

# Security: Block dangerous modules
BLOCKED_MODULES = ${JSON.stringify(this.blockedModules)}
ALLOWED_MODULES = ${JSON.stringify(this.allowedModules)}

# Override import to restrict modules
original_import = builtins.__import__

def secure_import(name, *args, **kwargs):
    # Check if module is blocked
    if name in BLOCKED_MODULES:
        raise ImportError(f"Module '{name}' is not allowed for security reasons")
    
    # Only allow specific modules
    if name not in ALLOWED_MODULES and not name.startswith('.'):
        raise ImportError(f"Module '{name}' is not in the allowed list")
    
    return original_import(name, *args, **kwargs)

# Replace built-in import
builtins.__import__ = secure_import

# Security: Disable dangerous built-ins
dangerous_builtins = ['eval', 'exec', 'compile', '__import__', 'open', 'file']
for builtin in dangerous_builtins:
    if hasattr(builtins, builtin):
        setattr(builtins, builtin, None)

# Security: Restrict file operations
import io
import types

# Create safe globals for execution
safe_globals = {
    '__builtins__': {
        'print': print,
        'len': len,
        'str': str,
        'int': int,
        'float': float,
        'bool': bool,
        'list': list,
        'dict': dict,
        'tuple': tuple,
        'set': set,
        'range': range,
        'enumerate': enumerate,
        'zip': zip,
        'map': map,
        'filter': filter,
        'sum': sum,
        'min': min,
        'max': max,
        'abs': abs,
        'round': round,
        'sorted': sorted,
        'reversed': reversed,
        'isinstance': isinstance,
        'type': type,
        'Exception': Exception,
        'ValueError': ValueError,
        'TypeError': TypeError,
        'KeyError': KeyError,
        'IndexError': IndexError,
        'AttributeError': AttributeError,
        'ImportError': ImportError,
    }
}

# Execute the user code
try:
    with open('${codeFile}', 'r') as f:
        user_code = f.read()
    
    # Execute in restricted environment
    exec(user_code, safe_globals)
    
except Exception as e:
    print(f"Execution Error: {str(e)}", file=sys.stderr)
    sys.exit(1)
`;
    
    const wrapperPath = path.join(path.dirname(codeFile), 'wrapper.py');
    fs.writeFileSync(wrapperPath, wrapperCode);
    
    return wrapperPath;
  }

  /**
   * Prepare code file for execution
   * 
   * @param {string} code - Python code
   * @param {string} executionDir - Execution directory
   * @returns {Promise<string>} Path to prepared code file
   */
  async prepareCode(code, executionDir) {
    const codeFile = path.join(executionDir, 'user_code.py');
    
    // Pre-process code to add safety checks
    const processedCode = this.preprocessCode(code);
    
    await fs.writeFile(codeFile, processedCode);
    return codeFile;
  }

  /**
   * Pre-process code for security
   * 
   * @param {string} code - Original code
   * @returns {string} Processed code
   */
  preprocessCode(code) {
    // Add import restrictions at the top
    const restrictions = `
# AUTO-GENERATED SECURITY RESTRICTIONS
# This code is executed in a restricted environment
`;
    
    // Remove potentially dangerous imports
    const lines = code.split('\n');
    const safeLines = lines.filter(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
        // Check if importing blocked module
        return !this.blockedModules.some(blocked => 
          trimmed.includes(blocked)
        );
      }
      return true;
    });
    
    return restrictions + safeLines.join('\n');
  }

  /**
   * Prepare environment variables for execution
   * 
   * @param {Object} userEnv - User-provided environment variables
   * @returns {Promise<Object>} Prepared environment variables
   */
  async prepareEnvironment(userEnv) {
    // Start with safe environment
    const safeEnv = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      TMPDIR: this.tempDir,
      PYTHONPATH: '',
      PYTHONIOENCODING: 'utf-8',
      PYTHONDONTWRITEBYTECODE: '1',
      ...userEnv
    };
    
    // Remove dangerous environment variables
    const dangerousVars = [
      'LD_PRELOAD', 'LD_LIBRARY_PATH', 'DYLD_INSERT_LIBRARIES',
      'PYTHONPATH', 'PYTHONSTARTUP', 'PYTHONHOME'
    ];
    
    dangerousVars.forEach(varName => {
      delete safeEnv[varName];
    });
    
    return safeEnv;
  }

  /**
   * Create execution directory
   * 
   * @param {string} executionId - Unique execution ID
   * @returns {Promise<string>} Path to execution directory
   */
  async createExecutionDir(executionId) {
    const executionDir = path.join(this.tempDir, executionId);
    await fs.mkdir(executionDir, { recursive: true });
    return executionDir;
  }

  /**
   * Generate unique execution ID
   * 
   * @returns {string} Unique execution ID
   */
  generateExecutionId() {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clean up execution directory
   * 
   * @param {string} executionDir - Directory to clean up
   */
  async cleanup(executionDir) {
    try {
      const files = await fs.readdir(executionDir);
      await Promise.all(
        files.map(file => fs.unlink(path.join(executionDir, file)))
      );
      await fs.rmdir(executionDir);
    } catch (error) {
      console.warn('Cleanup warning:', error.message);
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
   * Validate code for security issues
   * 
   * @param {string} code - Code to validate
   * @returns {Object} Validation result
   */
  validateCode(code) {
    const issues = [];
    const warnings = [];
    
    // Check for dangerous patterns
    const dangerousPatterns = [
      { pattern: /eval\s*\(/, message: 'Use of eval() function' },
      { pattern: /exec\s*\(/, message: 'Use of exec() function' },
      { pattern: /compile\s*\(/, message: 'Use of compile() function' },
      { pattern: /__import__\s*\(/, message: 'Use of __import__() function' },
      { pattern: /subprocess\./, message: 'Use of subprocess module' },
      { pattern: /os\.system/, message: 'Use of os.system()' },
      { pattern: /os\.popen/, message: 'Use of os.popen()' },
      { pattern: /socket\./, message: 'Use of socket module' },
      { pattern: /threading\./, message: 'Use of threading module' },
      { pattern: /multiprocessing\./, message: 'Use of multiprocessing module' }
    ];
    
    dangerousPatterns.forEach(({ pattern, message }) => {
      if (pattern.test(code)) {
        issues.push(message);
      }
    });
    
    // Check for imports of blocked modules
    this.blockedModules.forEach(module => {
      const importPattern = new RegExp(`import\\s+${module}|from\\s+${module}\\s+import`);
      if (importPattern.test(code)) {
        issues.push(`Import of blocked module: ${module}`);
      }
    });
    
    // Check for suspicious file operations
    const filePatterns = [
      { pattern: /open\s*\(['"]\//, message: 'Absolute file path access' },
      { pattern: /open\s*\(['"]\.\./, message: 'Parent directory traversal' },
      { pattern: /shutil\./, message: 'Use of shutil module' },
      { pattern: /tempfile\./, message: 'Use of tempfile module' }
    ];
    
    filePatterns.forEach(({ pattern, message }) => {
      if (pattern.test(code)) {
        warnings.push(message);
      }
    });
    
    return {
      valid: issues.length === 0,
      issues,
      warnings,
      safeToExecute: issues.length === 0
    };
  }

  /**
   * Get execution statistics
   * 
   * @returns {Object} Execution statistics
   */
  async getStats() {
    try {
      const files = await fs.readdir(this.tempDir);
      const executions = files.filter(file => file.startsWith('exec_'));
      
      return {
        totalExecutions: executions.length,
        tempDir: this.tempDir,
        timeout: this.timeout,
        maxMemory: this.maxMemory,
        maxCpuTime: this.maxCpuTime
      };
    } catch (error) {
      return {
        totalExecutions: 0,
        tempDir: this.tempDir,
        error: error.message
      };
    }
  }

  /**
   * Clean up all execution directories
   */
  async cleanupAll() {
    try {
      const files = await fs.readdir(this.tempDir);
      const executions = files.filter(file => file.startsWith('exec_'));
      
      await Promise.all(
        executions.map(async (execDir) => {
          const fullPath = path.join(this.tempDir, execDir);
          try {
            const innerFiles = await fs.readdir(fullPath);
            await Promise.all(
              innerFiles.map(file => fs.unlink(path.join(fullPath, file)))
            );
            await fs.rmdir(fullPath);
          } catch (error) {
            console.warn(`Failed to clean up ${execDir}:`, error.message);
          }
        })
      );
    } catch (error) {
      console.warn('Cleanup all warning:', error.message);
    }
  }
}

module.exports = CodeExecutor;