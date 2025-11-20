/**
 * State Replay Module
 * Handles state injection into new browser instances with step-by-step restoration
 */

const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

class StateReplay {
  constructor(options = {}) {
    this.tempDir = options.tempDir || './temp';
    this.logger = options.logger || console;
    this.validationEnabled = options.validation !== false;
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.maxStateSize = options.maxStateSize || 50 * 1024 * 1024; // 50MB default
    
    this.ensureTempDir();
  }

  /**
   * Apply complete browser state to a new page
   */
  async applyBrowserState(page, state, options = {}) {
    const startTime = Date.now();
    this.logger.info('Starting browser state application...');
    
    try {
      // Validate state before application
      if (this.validationEnabled) {
        await this.validateState(state);
      }
      
      // Create restoration plan
      const restorationPlan = this.createRestorationPlan(state, options);
      
      // Execute restoration steps
      const results = {
        success: true,
        steps: [],
        errors: [],
        duration: 0,
        verification: null
      };
      
      for (const step of restorationPlan.steps) {
        const stepResult = await this.executeRestorationStep(page, step, state);
        results.steps.push(stepResult);
        
        if (!stepResult.success) {
          results.success = false;
          results.errors.push(stepResult.error);
          
          if (step.critical) {
            this.logger.error(`Critical restoration step failed: ${step.type}`);
            break;
          }
        }
        
        // Wait between steps for stability
        if (step.delay && step.delay > 0) {
          await this.sleep(step.delay);
        }
      }
      
      // Verify state application
      if (options.verify !== false) {
        results.verification = await this.verifyStateApplication(page, state, results);
      }
      
      results.duration = Date.now() - startTime;
      
      if (results.success) {
        this.logger.info(`Browser state applied successfully in ${results.duration}ms`);
      } else {
        this.logger.error(`Browser state application failed after ${results.duration}ms`);
      }
      
      return results;
    } catch (error) {
      this.logger.error('Failed to apply browser state:', error);
      throw new Error(`State application failed: ${error.message}`);
    }
  }

  /**
   * Create a restoration plan based on state and options
   */
  createRestorationPlan(state, options = {}) {
    const plan = {
      version: '1.0.0',
      totalSteps: 0,
      estimatedDuration: 0,
      steps: []
    };
    
    // Step 1: Navigate to original URL (critical)
    if (state.pageInfo && state.pageInfo.url) {
      plan.steps.push({
        type: 'navigation',
        critical: true,
        delay: 1000,
        description: 'Navigate to original URL',
        data: { url: state.pageInfo.url }
      });
    }
    
    // Step 2: Set cookies (critical)
    if (state.cookies && state.cookies.length > 0) {
      plan.steps.push({
        type: 'cookies',
        critical: true,
        delay: 500,
        description: 'Restore cookies',
        data: { cookies: state.cookies }
      });
    }
    
    // Step 3: Set localStorage (important)
    if (state.localStorage && state.localStorage.storage) {
      plan.steps.push({
        type: 'localStorage',
        critical: false,
        delay: 200,
        description: 'Restore localStorage',
        data: { storage: state.localStorage.storage }
      });
    }
    
    // Step 4: Set sessionStorage (important)
    if (state.sessionStorage && state.sessionStorage.storage) {
      plan.steps.push({
        type: 'sessionStorage',
        critical: false,
        delay: 200,
        description: 'Restore sessionStorage',
        data: { storage: state.sessionStorage.storage }
      });
    }
    
    // Step 5: Restore IndexedDB (complex, optional)
    if (state.indexedDB && state.indexedDB.databases && options.restoreIndexedDB !== false) {
      plan.steps.push({
        type: 'indexedDB',
        critical: false,
        delay: 1000,
        description: 'Restore IndexedDB databases',
        data: { indexedDB: state.indexedDB }
      });
    }
    
    // Step 6: Restore Cache Storage (optional)
    if (state.cacheStorage && options.restoreCache !== false) {
      plan.steps.push({
        type: 'cacheStorage',
        critical: false,
        delay: 500,
        description: 'Restore Cache Storage',
        data: { cacheStorage: state.cacheStorage }
      });
    }
    
    // Step 7: Restore DOM state (optional)
    if (state.domState && options.restoreDOM !== false) {
      plan.steps.push({
        type: 'domState',
        critical: false,
        delay: 300,
        description: 'Restore DOM state',
        data: { domState: state.domState }
      });
    }
    
    // Step 8: Final verification (critical)
    plan.steps.push({
      type: 'verification',
      critical: true,
      delay: 1000,
      description: 'Verify state restoration',
      data: {}
    });
    
    plan.totalSteps = plan.steps.length;
    plan.estimatedDuration = plan.steps.reduce((sum, step) => sum + (step.delay || 0), 0);
    
    return plan;
  }

  /**
   * Execute a single restoration step
   */
  async executeRestorationStep(page, step, state) {
    const stepResult = {
      type: step.type,
      success: false,
      duration: 0,
      error: null,
      details: {}
    };
    
    const startTime = Date.now();
    
    try {
      switch (step.type) {
        case 'navigation':
          await this.executeNavigationStep(page, step, state);
          break;
        case 'cookies':
          await this.executeCookiesStep(page, step, state);
          break;
        case 'localStorage':
          await this.executeLocalStorageStep(page, step, state);
          break;
        case 'sessionStorage':
          await this.executeSessionStorageStep(page, step, state);
          break;
        case 'indexedDB':
          await this.executeIndexedDBStep(page, step, state);
          break;
        case 'cacheStorage':
          await this.executeCacheStorageStep(page, step, state);
          break;
        case 'domState':
          await this.executeDOMStateStep(page, step, state);
          break;
        case 'verification':
          await this.executeVerificationStep(page, step, state);
          break;
        default:
          throw new Error(`Unknown restoration step type: ${step.type}`);
      }
      
      stepResult.success = true;
      stepResult.details = { message: `${step.type} restoration completed successfully` };
    } catch (error) {
      stepResult.error = error.message;
      this.logger.warn(`Restoration step failed: ${step.type} - ${error.message}`);
      
      // Retry for non-critical steps
      if (!step.critical) {
        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
          this.logger.info(`Retrying ${step.type} restoration (attempt ${attempt}/${this.retryAttempts})`);
          await this.sleep(this.retryDelay * attempt);
          
          try {
            // Retry the step
            await this.retryRestorationStep(page, step, state);
            stepResult.success = true;
            stepResult.error = null;
            stepResult.details.retryAttempts = attempt;
            break;
          } catch (retryError) {
            stepResult.error = retryError.message;
          }
        }
      }
    }
    
    stepResult.duration = Date.now() - startTime;
    return stepResult;
  }

  /**
   * Execute navigation step
   */
  async executeNavigationStep(page, step, state) {
    const { url } = step.data;
    
    if (!url) {
      throw new Error('No URL provided for navigation step');
    }
    
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Wait for page to fully load
    await page.waitForTimeout(1000);
  }

  /**
   * Execute cookies restoration step
   */
  async executeCookiesStep(page, step, state) {
    const { cookies } = step.data;
    
    if (!cookies || cookies.length === 0) {
      throw new Error('No cookies provided for restoration');
    }
    
    // Clear existing cookies first
    const existingCookies = await page.cookies();
    if (existingCookies.length > 0) {
      await page.deleteCookie(...existingCookies);
    }
    
    // Set cookies in batches to avoid overwhelming the browser
    const batchSize = 50;
    for (let i = 0; i < cookies.length; i += batchSize) {
      const batch = cookies.slice(i, i + batchSize);
      await page.setCookie(...batch);
      await page.waitForTimeout(100);
    }
    
    this.logger.debug(`Restored ${cookies.length} cookies`);
  }

  /**
   * Execute localStorage restoration step
   */
  async executeLocalStorageStep(page, step, state) {
    const { storage } = step.data;
    
    if (!storage) {
      throw new Error('No localStorage data provided for restoration');
    }
    
    await page.evaluate((storageData) => {
      // Clear existing localStorage
      localStorage.clear();
      
      // Restore localStorage data
      Object.entries(storageData).forEach(([key, value]) => {
        if (typeof value === 'object' && value.value !== undefined) {
          localStorage.setItem(key, value.value);
        } else {
          localStorage.setItem(key, value);
        }
      });
      
      return Object.keys(storageData).length;
    }, storage);
    
    this.logger.debug(`Restored ${Object.keys(storage).length} localStorage items`);
  }

  /**
   * Execute sessionStorage restoration step
   */
  async executeSessionStorageStep(page, step, state) {
    const { storage } = step.data;
    
    if (!storage) {
      throw new Error('No sessionStorage data provided for restoration');
    }
    
    await page.evaluate((storageData) => {
      // Clear existing sessionStorage
      sessionStorage.clear();
      
      // Restore sessionStorage data
      Object.entries(storageData).forEach(([key, value]) => {
        if (typeof value === 'object' && value.value !== undefined) {
          sessionStorage.setItem(key, value.value);
        } else {
          sessionStorage.setItem(key, value);
        }
      });
      
      return Object.keys(storageData).length;
    }, storage);
    
    this.logger.debug(`Restored ${Object.keys(storage).length} sessionStorage items`);
  }

  /**
   * Execute IndexedDB restoration step
   */
  async executeIndexedDBStep(page, step, state) {
    const { indexedDB } = step.data;
    
    if (!indexedDB || !indexedDB.databases) {
      throw new Error('No IndexedDB data provided for restoration');
    }
    
    await page.evaluate((indexedDBData) => {
      return new Promise((resolve) => {
        const restorePromises = indexedDBData.databases.map(dbInfo => {
          return new Promise((dbResolve) => {
            const request = indexedDB.open(dbInfo.name, dbInfo.version);
            
            request.onupgradeneeded = (event) => {
              const db = event.target.result;
              
              // Create object stores
              dbInfo.objectStores.forEach(storeInfo => {
                if (!db.objectStoreNames.contains(storeInfo.name)) {
                  const store = db.createObjectStore(storeInfo.name, {
                    keyPath: storeInfo.keyPath,
                        autoIncrement: storeInfo.autoIncrement
                      });
                      
                      // Create indexes
                      storeInfo.indexes.forEach(indexInfo => {
                        store.createIndex(indexInfo.name, indexInfo.keyPath, {
                          unique: indexInfo.unique,
                          multiEntry: indexInfo.multiEntry
                        });
                      });
                    }
                  });
                };
                
                request.onsuccess = (event) => {
                  const db = event.target.result;
                  
                  // Restore data
                  const dataPromises = dbInfo.objectStores.map(storeInfo => {
                    if (!storeInfo.data || storeInfo.data.length === 0) {
                      return Promise.resolve();
                    }
                    
                    return new Promise((storeResolve) => {
                      const transaction = db.transaction(storeInfo.name, 'readwrite');
                      const store = transaction.objectStore(storeInfo.name);
                      
                      storeInfo.data.forEach(item => {
                        store.put(item);
                      });
                      
                      transaction.oncomplete = storeResolve;
                      transaction.onerror = () => storeResolve(); // Continue even if data restore fails
                    });
                  });
                  
                  Promise.all(dataPromises).then(() => {
                    db.close();
                    dbResolve();
                  });
                };
                
                request.onerror = () => dbResolve(); // Continue even if database creation fails
              });
            });
            
            Promise.all(restorePromises).then(resolve);
          });
        });
      }, indexedDB);
    
    this.logger.debug(`Attempted to restore ${indexedDB.databases.length} IndexedDB databases`);
  }

  /**
   * Execute Cache Storage restoration step
   */
  async executeCacheStorageStep(page, step, state) {
    const { cacheStorage } = step.data;
    
    if (!cacheStorage || !cacheStorage.caches) {
      throw new Error('No Cache Storage data provided for restoration');
    }
    
    await page.evaluate((cacheData) => {
      return new Promise((resolve) => {
        const restorePromises = cacheData.caches.map(cacheInfo => {
          return caches.open(cacheInfo.name).then(cache => {
            // Cache restoration is complex and may not be fully possible
            // This is a best-effort implementation
            return Promise.resolve();
          });
        });
        
        Promise.all(restorePromises).then(resolve);
      });
    }, cacheStorage);
    
    this.logger.debug(`Attempted to restore ${cacheStorage.caches.length} cache storages`);
  }

  /**
   * Execute DOM state restoration step
   */
  async executeDOMStateStep(page, step, state) {
    const { domState } = step.data;
    
    if (!domState) {
      throw new Error('No DOM state data provided for restoration');
    }
    
    await page.evaluate((domData) => {
      // Restore form values
      if (domData.forms) {
        domData.forms.forEach(form => {
          const formElement = document.querySelector(`form#${form.id}, form[action="${form.action}"]`);
          if (formElement) {
            form.fields.forEach(field => {
              const fieldElement = formElement.querySelector(`[name="${field.name}"]`);
              if (fieldElement) {
                if (field.type === 'checkbox' || field.type === 'radio') {
                  fieldElement.checked = field.checked;
                } else if (field.type !== 'password') {
                  fieldElement.value = field.value;
                }
              }
            });
          }
        });
      }
      
      // Restore scroll position
      if (domData.documentElement) {
        window.scrollTo(domData.viewport?.scrollX || 0, domData.viewport?.scrollY || 0);
      }
    }, domState);
    
    this.logger.debug('DOM state restoration completed');
  }

  /**
   * Execute verification step
   */
  async executeVerificationStep(page, step, state) {
    // Basic verification - more comprehensive verification happens in verifyStateApplication
    const currentUrl = page.url();
    const currentTitle = await page.title();
    
    if (state.pageInfo) {
      if (state.pageInfo.url && currentUrl !== state.pageInfo.url) {
        throw new Error(`URL mismatch: expected ${state.pageInfo.url}, got ${currentUrl}`);
      }
    }
    
    return true;
  }

  /**
   * Retry a restoration step with error handling
   */
  async retryRestorationStep(page, step, state) {
    // Implement retry logic specific to step type
    switch (step.type) {
      case 'cookies':
        // For cookies, try a smaller batch size
        const { cookies } = step.data;
        const smallBatchSize = 10;
        for (let i = 0; i < cookies.length; i += smallBatchSize) {
          const batch = cookies.slice(i, i + smallBatchSize);
          await page.setCookie(...batch);
          await page.waitForTimeout(200);
        }
        break;
      
      case 'localStorage':
      case 'sessionStorage':
        // For storage, try with a delay
        await page.waitForTimeout(500);
        await this.executeRestorationStep(page, step, state);
        break;
      
      default:
        // For other steps, just retry the original execution
        await this.executeRestorationStep(page, step, state);
        break;
    }
  }

  /**
   * Verify that state was applied correctly
   */
  async verifyStateApplication(page, originalState, restorationResults) {
    this.logger.info('Verifying state application...');
    
    const verification = {
      success: true,
      checks: {},
      summary: {
        passed: 0,
        failed: 0,
        warnings: 0
      },
      issues: []
    };
    
    try {
      // Check URL
      if (originalState.pageInfo && originalState.pageInfo.url) {
        const currentUrl = page.url();
        verification.checks.url = {
          expected: originalState.pageInfo.url,
          actual: currentUrl,
          passed: currentUrl === originalState.pageInfo.url
        };
        
        if (verification.checks.url.passed) {
          verification.summary.passed++;
        } else {
          verification.summary.failed++;
          verification.issues.push('URL mismatch after restoration');
        }
      }
      
      // Check cookies
      if (originalState.cookies && originalState.cookies.length > 0) {
        const currentCookies = await page.cookies();
        const cookieCheck = this.verifyCookies(originalState.cookies, currentCookies);
        verification.checks.cookies = cookieCheck;
        
        if (cookieCheck.passed) {
          verification.summary.passed++;
        } else {
          verification.summary.failed++;
          verification.issues.push(`Cookie verification failed: ${cookieCheck.missing} missing, ${cookieCheck.modified} modified`);
        }
      }
      
      // Check localStorage
      if (originalState.localStorage && originalState.localStorage.storage) {
        const localStorageCheck = await this.verifyStorage(page, 'localStorage', originalState.localStorage.storage);
        verification.checks.localStorage = localStorageCheck;
        
        if (localStorageCheck.passed) {
          verification.summary.passed++;
        } else {
          verification.summary.failed++;
          verification.issues.push(`localStorage verification failed: ${localStorageCheck.missing} missing, ${localStorageCheck.modified} modified`);
        }
      }
      
      // Check sessionStorage
      if (originalState.sessionStorage && originalState.sessionStorage.storage) {
        const sessionStorageCheck = await this.verifyStorage(page, 'sessionStorage', originalState.sessionStorage.storage);
        verification.checks.sessionStorage = sessionStorageCheck;
        
        if (sessionStorageCheck.passed) {
          verification.summary.passed++;
        } else {
          verification.summary.failed++;
          verification.issues.push(`sessionStorage verification failed: ${sessionStorageCheck.missing} missing, ${sessionStorageCheck.modified} modified`);
        }
      }
      
      verification.success = verification.summary.failed === 0;
      
      if (verification.success) {
        this.logger.info('State verification passed');
      } else {
        this.logger.warn(`State verification failed with ${verification.summary.failed} issues`);
      }
      
      return verification;
    } catch (error) {
      this.logger.error('State verification failed:', error);
      verification.success = false;
      verification.issues.push(`Verification error: ${error.message}`);
      return verification;
    }
  }

  /**
   * Verify cookies were restored correctly
   */
  verifyCookies(originalCookies, currentCookies) {
    const check = {
      passed: true,
      total: originalCookies.length,
      restored: currentCookies.length,
      missing: 0,
      modified: 0,
      details: []
    };
    
    const originalMap = new Map(originalCookies.map(c => [`${c.name}|${c.domain}`, c]));
    const currentMap = new Map(currentCookies.map(c => [`${c.name}|${c.domain}`, c]));
    
    for (const [key, originalCookie] of originalMap) {
      const currentCookie = currentMap.get(key);
      
      if (!currentCookie) {
        check.missing++;
        check.details.push({
          type: 'missing',
          name: originalCookie.name,
          domain: originalCookie.domain
        });
        check.passed = false;
      } else if (currentCookie.value !== originalCookie.value) {
        check.modified++;
        check.details.push({
          type: 'modified',
          name: originalCookie.name,
          domain: originalCookie.domain,
          originalValue: originalCookie.value,
          currentValue: currentCookie.value
        });
        check.passed = false;
      }
    }
    
    return check;
  }

  /**
   * Verify storage was restored correctly
   */
  async verifyStorage(page, storageType, originalStorage) {
    const check = {
      passed: true,
      total: Object.keys(originalStorage).length,
      restored: 0,
      missing: 0,
      modified: 0,
      details: []
    };
    
    const currentStorage = await page.evaluate((type) => {
      const storage = type === 'localStorage' ? localStorage : sessionStorage;
      const result = {};
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key) {
          result[key] = storage.getItem(key);
        }
      }
      return result;
    }, storageType);
    
    for (const [key, originalValue] of Object.entries(originalStorage)) {
      const currentValue = currentStorage[key];
      
      if (currentValue === undefined || currentValue === null) {
        check.missing++;
        check.details.push({
          type: 'missing',
          key
        });
        check.passed = false;
      } else {
        check.restored++;
        const originalVal = typeof originalValue === 'object' ? originalValue.value : originalValue;
        if (currentValue !== originalVal) {
          check.modified++;
          check.details.push({
            type: 'modified',
            key,
            originalValue: originalVal,
            currentValue
          });
          check.passed = false;
        }
      }
    }
    
    return check;
  }

  /**
   * Validate state before application
   */
  async validateState(state) {
    if (!state) {
      throw new Error('No state provided for validation');
    }
    
    if (!state.version) {
      throw new Error('State version is missing');
    }
    
    if (!state.timestamp) {
      throw new Error('State timestamp is missing');
    }
    
    // Check state size
    const stateSize = JSON.stringify(state).length;
    if (stateSize > this.maxStateSize) {
      this.logger.warn(`State size (${stateSize}) exceeds maximum recommended size (${this.maxStateSize})`);
    }
    
    return true;
  }

  /**
   * Apply state with performance optimization for large states
   */
  async applyLargeState(page, state, options = {}) {
    this.logger.info('Applying large state with performance optimizations...');
    
    // Enable performance optimizations
    const optimizedOptions = {
      ...options,
      batchSize: options.batchSize || 10,
      stepDelay: options.stepDelay || 100,
      parallelSteps: options.parallelSteps || false,
      prioritizeCritical: options.prioritizeCritical !== false
    };
    
    // Create optimized restoration plan
    const plan = this.createOptimizedRestorationPlan(state, optimizedOptions);
    
    // Execute optimized restoration
    return await this.executeOptimizedRestoration(page, plan, state, optimizedOptions);
  }

  /**
   * Create optimized restoration plan for large states
   */
  createOptimizedRestorationPlan(state, options) {
    const plan = this.createRestorationPlan(state, options);
    
    // Optimize step order for performance
    if (options.prioritizeCritical) {
      plan.steps.sort((a, b) => {
        if (a.critical && !b.critical) return -1;
        if (!a.critical && b.critical) return 1;
        return 0;
      });
    }
    
    // Adjust delays for performance
    plan.steps.forEach(step => {
      if (!step.critical) {
        step.delay = Math.min(step.delay, options.stepDelay || 100);
      }
    });
    
    return plan;
  }

  /**
   * Execute optimized restoration
   */
  async executeOptimizedRestoration(page, plan, state, options) {
    const results = {
      success: true,
      steps: [],
      errors: [],
      duration: 0,
      optimization: {
        batchSize: options.batchSize,
        parallelSteps: options.parallelSteps,
        totalTimeSaved: 0
      }
    };
    
    const startTime = Date.now();
    
    if (options.parallelSteps) {
      // Execute non-critical steps in parallel
      const criticalSteps = plan.steps.filter(step => step.critical);
      const nonCriticalSteps = plan.steps.filter(step => !step.critical);
      
      // Execute critical steps first
      for (const step of criticalSteps) {
        const stepResult = await this.executeRestorationStep(page, step, state);
        results.steps.push(stepResult);
        
        if (!stepResult.success && step.critical) {
          results.success = false;
          break;
        }
      }
      
      // Execute non-critical steps in parallel batches
      if (results.success && nonCriticalSteps.length > 0) {
        for (let i = 0; i < nonCriticalSteps.length; i += options.batchSize) {
          const batch = nonCriticalSteps.slice(i, i + options.batchSize);
          const batchPromises = batch.map(step => 
            this.executeRestorationStep(page, step, state)
          );
          
          const batchResults = await Promise.all(batchPromises);
          results.steps.push(...batchResults);
        }
      }
    } else {
      // Execute sequentially with optimizations
      for (const step of plan.steps) {
        const stepResult = await this.executeRestorationStep(page, step, state);
        results.steps.push(stepResult);
        
        if (!stepResult.success && step.critical) {
          results.success = false;
          break;
        }
      }
    }
    
    results.duration = Date.now() - startTime;
    return results;
  }

  /**
   * Sleep helper function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Ensure temporary directory exists
   */
  ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }
}

module.exports = StateReplay;