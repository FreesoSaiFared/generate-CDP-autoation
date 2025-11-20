/**
 * Enhanced Browser State Capture Module
 * Provides comprehensive browser state capture, serialization, and validation
 */

const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { promisify } = require('util');
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

class BrowserStateCapture {
  constructor(options = {}) {
    this.tempDir = options.tempDir || './temp';
    this.compressionEnabled = options.compression !== false;
    this.validationEnabled = options.validation !== false;
    this.logger = options.logger || console;
    this.maxStateSize = options.maxStateSize || 50 * 1024 * 1024; // 50MB default
    this.stateVersion = '1.0.0';
    
    this.ensureTempDir();
  }

  /**
   * Capture complete browser state including all storage mechanisms
   */
  async captureBrowserState(page, options = {}) {
    const startTime = Date.now();
    this.logger.info('Starting comprehensive browser state capture...');
    
    try {
      const state = {
        version: this.stateVersion,
        timestamp: new Date().toISOString(),
        captureOptions: options,
        metadata: {
          captureDuration: 0,
          stateSize: 0,
          checksum: null,
          compressed: this.compressionEnabled
        }
      };

      // Capture basic page information
      state.pageInfo = await this.capturePageInfo(page);
      
      // Capture all storage mechanisms
      state.cookies = await this.captureCookies(page);
      state.localStorage = await this.captureLocalStorage(page);
      state.sessionStorage = await this.captureSessionStorage(page);
      state.indexedDB = await this.captureIndexedDB(page);
      
      // Capture advanced browser state
      state.webSQL = await this.captureWebSQL(page);
      state.cacheStorage = await this.captureCacheStorage(page);
      state.serviceWorkers = await this.captureServiceWorkers(page);
      state.domState = await this.captureDOMState(page);
      
      // Capture security and authentication state
      state.authState = await this.captureAuthState(page);
      state.securityState = await this.captureSecurityState(page);
      
      // Capture screenshot if requested
      if (options.includeScreenshot !== false) {
        state.screenshot = await this.captureScreenshot(page);
      }
      
      // Calculate metadata
      state.metadata.captureDuration = Date.now() - startTime;
      state.metadata.stateSize = JSON.stringify(state).length;
      state.metadata.checksum = this.calculateChecksum(state);
      
      // Validate state if enabled
      if (this.validationEnabled) {
        await this.validateState(state);
      }
      
      this.logger.info(`Browser state captured successfully in ${state.metadata.captureDuration}ms`);
      return state;
    } catch (error) {
      this.logger.error('Failed to capture browser state:', error);
      throw new Error(`Browser state capture failed: ${error.message}`);
    }
  }

  /**
   * Capture basic page information
   */
  async capturePageInfo(page) {
    try {
      return await page.evaluate(() => ({
        url: window.location.href,
        title: document.title,
        referrer: document.referrer,
        userAgent: navigator.userAgent,
        language: navigator.language,
        languages: navigator.languages,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack,
        onLine: navigator.onLine,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        screenResolution: {
          width: screen.width,
          height: screen.height,
          availWidth: screen.availWidth,
          availHeight: screen.availHeight,
          colorDepth: screen.colorDepth,
          pixelDepth: screen.pixelDepth
        },
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          scrollX: window.scrollX,
          scrollY: window.scrollY
        }
      }));
    } catch (error) {
      this.logger.warn('Failed to capture page info:', error);
      return {};
    }
  }

  /**
   * Capture all cookies with comprehensive details
   */
  async captureCookies(page) {
    try {
      const cookies = await page.cookies();
      
      // Enhanced cookie information
      const enhancedCookies = await page.evaluate((cookies) => {
        return cookies.map(cookie => {
          // Get additional cookie information that might not be available via CDP
          const cookieString = `${cookie.name}=${cookie.value}`;
          return {
            ...cookie,
            cookieString,
            size: cookieString.length,
            classification: this.classifyCookie(cookie),
            accessInfo: this.getCookieAccessInfo(cookie)
          };
        });
      }, cookies);
      
      return enhancedCookies;
    } catch (error) {
      this.logger.warn('Failed to capture cookies:', error);
      return [];
    }
  }

  /**
   * Capture localStorage with metadata
   */
  async captureLocalStorage(page) {
    try {
      return await page.evaluate(() => {
        const storage = {};
        const metadata = {
          size: 0,
          itemCount: localStorage.length,
          quota: null,
          usage: null
        };
        
        // Try to get quota information
        if ('storage' in navigator && 'estimate' in navigator.storage) {
          navigator.storage.estimate().then(estimate => {
            metadata.quota = estimate.quota;
            metadata.usage = estimate.usage;
          });
        }
        
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            const value = localStorage.getItem(key);
            storage[key] = {
              value,
              size: value ? value.length : 0,
              lastModified: null // Not available in localStorage
            };
            metadata.size += storage[key].size;
          }
        }
        
        return { storage, metadata };
      });
    } catch (error) {
      this.logger.warn('Failed to capture localStorage:', error);
      return { storage: {}, metadata: {} };
    }
  }

  /**
   * Capture sessionStorage with metadata
   */
  async captureSessionStorage(page) {
    try {
      return await page.evaluate(() => {
        const storage = {};
        const metadata = {
          size: 0,
          itemCount: sessionStorage.length
        };
        
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key) {
            const value = sessionStorage.getItem(key);
            storage[key] = {
              value,
              size: value ? value.length : 0
            };
            metadata.size += storage[key].size;
          }
        }
        
        return { storage, metadata };
      });
    } catch (error) {
      this.logger.warn('Failed to capture sessionStorage:', error);
      return { storage: {}, metadata: {} };
    }
  }

  /**
   * Capture IndexedDB data comprehensively
   */
  async captureIndexedDB(page) {
    try {
      return await page.evaluate(() => {
        return new Promise((resolve) => {
          const indexedDBState = {
            databases: [],
            data: {},
            metadata: {
              databaseCount: 0,
              totalObjectStores: 0,
              totalRecords: 0
            }
          };
          
          // Get all databases
          if ('indexedDB' in self && 'databases' in indexedDB) {
            indexedDB.databases().then(databases => {
              indexedDBState.metadata.databaseCount = databases.length;
              
              Promise.all(databases.map(dbInfo => {
                return new Promise((dbResolve) => {
                  const request = indexedDB.open(dbInfo.name, dbInfo.version);
                  
                  request.onerror = () => dbResolve();
                  request.onsuccess = (event) => {
                    const db = event.target.result;
                    const dbState = {
                      name: dbInfo.name,
                      version: dbInfo.version,
                      objectStores: []
                    };
                    
                    const objectStores = db.objectStoreNames;
                    indexedDBState.metadata.totalObjectStores += objectStores.length;
                    
                    Promise.all(Array.from(objectStores).map(storeName => {
                      return new Promise((storeResolve) => {
                        const transaction = db.transaction(storeName, 'readonly');
                        const store = transaction.objectStore(storeName);
                        const storeState = {
                          name: storeName,
                          keyPath: store.keyPath,
                          autoIncrement: store.autoIncrement,
                          indexes: [],
                          data: []
                        };
                        
                        // Get index information
                        const indexNames = store.indexNames;
                        Array.from(indexNames).forEach(indexName => {
                          const index = store.index(indexName);
                          storeState.indexes.push({
                            name: indexName,
                            keyPath: index.keyPath,
                            unique: index.unique,
                            multiEntry: index.multiEntry
                          });
                        });
                        
                        // Get all data
                        const getAllRequest = store.getAll();
                        getAllRequest.onsuccess = (e) => {
                          storeState.data = e.target.result;
                          indexedDBState.metadata.totalRecords += storeState.data.length;
                          storeResolve();
                        };
                        
                        transaction.oncomplete = () => {
                          dbState.objectStores.push(storeState);
                          storeResolve();
                        };
                      });
                    })).then(() => {
                      indexedDBState.databases.push(dbState);
                      indexedDBState.data[dbInfo.name] = dbState;
                      dbResolve();
                    });
                  };
                });
              })).then(() => {
                resolve(indexedDBState);
              });
            }).catch(() => resolve(indexedDBState));
          } else {
            resolve(indexedDBState);
          }
        });
      });
    } catch (error) {
      this.logger.warn('Failed to capture IndexedDB:', error);
      return { databases: [], data: {}, metadata: {} };
    }
  }

  /**
   * Capture Web SQL databases (if available)
   */
  async captureWebSQL(page) {
    try {
      return await page.evaluate(() => {
        return new Promise((resolve) => {
          const webSQLState = {
            databases: [],
            metadata: {
              databaseCount: 0
            }
          };
          
          if ('openDatabase' in window) {
            // Web SQL is deprecated but might be available
            // This is a best-effort capture
            resolve(webSQLState);
          } else {
            resolve(webSQLState);
          }
        });
      });
    } catch (error) {
      this.logger.warn('Failed to capture WebSQL:', error);
      return { databases: [], metadata: {} };
    }
  }

  /**
   * Capture Cache Storage API data
   */
  async captureCacheStorage(page) {
    try {
      return await page.evaluate(() => {
        return new Promise((resolve) => {
          const cacheState = {
            caches: [],
            metadata: {
              cacheCount: 0,
              totalRequests: 0
            }
          };
          
          if ('caches' in window) {
            caches.keys().then(cacheNames => {
              cacheState.metadata.cacheCount = cacheNames.length;
              
              Promise.all(cacheNames.map(cacheName => {
                return caches.open(cacheName).then(cache => {
                  return cache.keys().then(requests => {
                    const cacheInfo = {
                      name: cacheName,
                      requestCount: requests.length,
                      requests: requests.map(request => ({
                        url: request.url,
                        method: request.method,
                        headers: Object.fromEntries(request.headers.entries())
                      }))
                    };
                    cacheState.metadata.totalRequests += requests.length;
                    return cacheInfo;
                  });
                });
              })).then(caches => {
                cacheState.caches = caches;
                resolve(cacheState);
              });
            }).catch(() => resolve(cacheState));
          } else {
            resolve(cacheState);
          }
        });
      });
    } catch (error) {
      this.logger.warn('Failed to capture CacheStorage:', error);
      return { caches: [], metadata: {} };
    }
  }

  /**
   * Capture Service Worker state
   */
  async captureServiceWorkers(page) {
    try {
      return await page.evaluate(() => {
        return new Promise((resolve) => {
          const serviceWorkerState = {
            registrations: [],
            metadata: {
              registrationCount: 0
            }
          };
          
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(registrations => {
              serviceWorkerState.metadata.registrationCount = registrations.length;
              
              serviceWorkerState.registrations = registrations.map(registration => ({
                scope: registration.scope,
                scriptURL: registration.active ? registration.active.scriptURL : null,
                state: registration.active ? registration.active.state : null,
                updateViaCache: registration.updateViaCache
              }));
              
              resolve(serviceWorkerState);
            }).catch(() => resolve(serviceWorkerState));
          } else {
            resolve(serviceWorkerState);
          }
        });
      });
    } catch (error) {
      this.logger.warn('Failed to capture Service Workers:', error);
      return { registrations: [], metadata: {} };
    }
  }

  /**
   * Capture DOM state for visual verification
   */
  async captureDOMState(page) {
    try {
      return await page.evaluate(() => {
        return {
          documentElement: {
            scrollWidth: document.documentElement.scrollWidth,
            scrollHeight: document.documentElement.scrollHeight,
            clientWidth: document.documentElement.clientWidth,
            clientHeight: document.documentElement.clientHeight
          },
          body: {
            scrollWidth: document.body ? document.body.scrollWidth : 0,
            scrollHeight: document.body ? document.body.scrollHeight : 0,
            clientWidth: document.body ? document.body.clientWidth : 0,
            clientHeight: document.body ? document.body.clientHeight : 0
          },
          forms: Array.from(document.querySelectorAll('form')).map(form => ({
            id: form.id,
            action: form.action,
            method: form.method,
            inputCount: form.querySelectorAll('input').length,
            fields: Array.from(form.querySelectorAll('input, select, textarea')).map(field => ({
              name: field.name,
              type: field.type,
              value: field.type !== 'password' ? field.value : '*****',
              checked: field.checked,
              selected: field.selected
            }))
          })),
          localStorageKeys: Object.keys(localStorage),
          sessionStorageKeys: Object.keys(sessionStorage),
          customElements: Array.from(customElements ? customElements.define : [])
        };
      });
    } catch (error) {
      this.logger.warn('Failed to capture DOM state:', error);
      return {};
    }
  }

  /**
   * Capture authentication state
   */
  async captureAuthState(page) {
    try {
      return await page.evaluate(() => {
        const authState = {
          hasWebAuthn: 'credentials' in navigator,
          hasPublicKeyCredential: 'PublicKeyCredential' in window,
          authenticationHeaders: {},
          tokens: []
        };
        
        // Look for common auth tokens in localStorage
        const authKeys = ['token', 'jwt', 'auth', 'session', 'access_token', 'refresh_token'];
        authKeys.forEach(key => {
          const foundKeys = Object.keys(localStorage).filter(k => 
            k.toLowerCase().includes(key.toLowerCase())
          );
          foundKeys.forEach(foundKey => {
            authState.tokens.push({
              key: foundKey,
              value: localStorage.getItem(foundKey),
              source: 'localStorage'
            });
          });
        });
        
        return authState;
      });
    } catch (error) {
      this.logger.warn('Failed to capture auth state:', error);
      return {};
    }
  }

  /**
   * Capture security-related state
   */
  async captureSecurityState(page) {
    try {
      return await page.evaluate(() => {
        return {
          https: location.protocol === 'https:',
          certificate: null, // Not accessible via JavaScript
          csp: {
            meta: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || null,
            header: null // Not accessible via JavaScript
          },
          permissions: navigator.permissions ? 'available' : 'unavailable',
          webRTC: {
            enabled: 'RTCPeerConnection' in window,
            connection: null // Would need active connection
          },
          webGL: this.getWebGLInfo(),
          canvas: this.getCanvasFingerprint()
        };
      });
    } catch (error) {
      this.logger.warn('Failed to capture security state:', error);
      return {};
    }
  }

  /**
   * Capture screenshot with metadata
   */
  async captureScreenshot(page) {
    try {
      const screenshotPath = path.join(this.tempDir, `screenshot-${Date.now()}.png`);
      await page.screenshot({ 
        path: screenshotPath, 
        fullPage: true,
        type: 'png'
      });
      
      const stats = await fs.stat(screenshotPath);
      return {
        path: screenshotPath,
        size: stats.size,
        timestamp: new Date().toISOString(),
        format: 'png'
      };
    } catch (error) {
      this.logger.warn('Failed to capture screenshot:', error);
      return null;
    }
  }

  /**
   * Serialize and compress browser state
   */
  async serializeState(state, options = {}) {
    try {
      const serialized = JSON.stringify(state, null, 2);
      
      if (!this.compressionEnabled || options.compress === false) {
        return {
          data: serialized,
          compressed: false,
          size: serialized.length
        };
      }
      
      // Compress large states
      if (serialized.length > 1024 * 1024) { // 1MB threshold
        const compressed = await gzip(serialized);
        return {
          data: compressed,
          compressed: true,
          size: compressed.length,
          originalSize: serialized.length,
          compressionRatio: (compressed.length / serialized.length).toFixed(2)
        };
      }
      
      return {
        data: serialized,
        compressed: false,
        size: serialized.length
      };
    } catch (error) {
      this.logger.error('Failed to serialize state:', error);
      throw new Error(`State serialization failed: ${error.message}`);
    }
  }

  /**
   * Deserialize and decompress browser state
   */
  async deserializeState(serializedData, options = {}) {
    try {
      let data;
      
      if (serializedData.compressed) {
        data = await gunzip(serializedData.data);
        data = data.toString('utf8');
      } else {
        data = serializedData.data;
      }
      
      const state = JSON.parse(data);
      
      // Validate state version compatibility
      if (this.validationEnabled) {
        this.validateStateVersion(state);
      }
      
      return state;
    } catch (error) {
      this.logger.error('Failed to deserialize state:', error);
      throw new Error(`State deserialization failed: ${error.message}`);
    }
  }

  /**
   * Validate browser state integrity
   */
  async validateState(state) {
    try {
      // Check required fields
      const requiredFields = ['version', 'timestamp', 'cookies', 'localStorage', 'sessionStorage'];
      for (const field of requiredFields) {
        if (!(field in state)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }
      
      // Validate checksum if present
      if (state.metadata && state.metadata.checksum) {
        const calculatedChecksum = this.calculateChecksum(state);
        if (calculatedChecksum !== state.metadata.checksum) {
          throw new Error('State checksum validation failed - data may be corrupted');
        }
      }
      
      // Validate state size
      const stateSize = JSON.stringify(state).length;
      if (stateSize > this.maxStateSize) {
        this.logger.warn(`State size (${stateSize}) exceeds maximum recommended size (${this.maxStateSize})`);
      }
      
      // Validate individual components
      this.validateCookies(state.cookies);
      this.validateStorage(state.localStorage);
      this.validateStorage(state.sessionStorage);
      
      return true;
    } catch (error) {
      this.logger.error('State validation failed:', error);
      throw error;
    }
  }

  /**
   * Validate cookies structure
   */
  validateCookies(cookies) {
    if (!Array.isArray(cookies)) {
      throw new Error('Cookies must be an array');
    }
    
    cookies.forEach((cookie, index) => {
      if (!cookie.name || !cookie.value) {
        throw new Error(`Cookie at index ${index} missing name or value`);
      }
    });
  }

  /**
   * Validate storage structure
   */
  validateStorage(storage) {
    if (typeof storage !== 'object' || storage === null) {
      throw new Error('Storage must be an object');
    }
  }

  /**
   * Validate state version compatibility
   */
  validateStateVersion(state) {
    if (!state.version) {
      throw new Error('State missing version information');
    }
    
    // Add version compatibility logic here
    // For now, just warn about version mismatches
    if (state.version !== this.stateVersion) {
      this.logger.warn(`State version (${state.version}) differs from current version (${this.stateVersion})`);
    }
  }

  /**
   * Calculate checksum for state integrity
   */
  calculateChecksum(state) {
    const stateCopy = { ...state };
    if (stateCopy.metadata) {
      stateCopy.metadata.checksum = null; // Remove checksum before calculation
    }
    return crypto.createHash('sha256').update(JSON.stringify(stateCopy)).digest('hex');
  }

  /**
   * Compare two browser states and return differences
   */
  compareStates(state1, state2) {
    const comparison = {
      identical: true,
      differences: {
        cookies: this.compareCookies(state1.cookies, state2.cookies),
        localStorage: this.compareStorage(state1.localStorage, state2.localStorage),
        sessionStorage: this.compareStorage(state1.sessionStorage, state2.sessionStorage),
        indexedDB: this.compareIndexedDB(state1.indexedDB, state2.indexedDB),
        pageInfo: this.comparePageInfo(state1.pageInfo, state2.pageInfo)
      },
      summary: {
        totalDifferences: 0,
        criticalDifferences: 0
      }
    };
    
    // Calculate summary
    Object.values(comparison.differences).forEach(diff => {
      if (diff && diff.total) {
        comparison.summary.totalDifferences += diff.total;
        if (diff.critical) {
          comparison.summary.criticalDifferences += diff.critical;
        }
      }
    });
    
    comparison.identical = comparison.summary.totalDifferences === 0;
    
    return comparison;
  }

  /**
   * Compare cookies between states
   */
  compareCookies(cookies1, cookies2) {
    const diff = {
      added: [],
      removed: [],
      modified: [],
      total: 0,
      critical: 0
    };
    
    const cookies1Map = new Map(cookies1.map(c => [`${c.name}|${c.domain}`, c]));
    const cookies2Map = new Map(cookies2.map(c => [`${c.name}|${c.domain}`, c]));
    
    // Find added cookies
    for (const [key, cookie] of cookies2Map) {
      if (!cookies1Map.has(key)) {
        diff.added.push(cookie);
        if (this.isCriticalCookie(cookie)) {
          diff.critical++;
        }
      }
    }
    
    // Find removed cookies
    for (const [key, cookie] of cookies1Map) {
      if (!cookies2Map.has(key)) {
        diff.removed.push(cookie);
        if (this.isCriticalCookie(cookie)) {
          diff.critical++;
        }
      }
    }
    
    // Find modified cookies
    for (const [key, cookie2] of cookies2Map) {
      const cookie1 = cookies1Map.get(key);
      if (cookie1 && cookie1.value !== cookie2.value) {
        diff.modified.push({
          name: cookie2.name,
          domain: cookie2.domain,
          oldValue: cookie1.value,
          newValue: cookie2.value
        });
        if (this.isCriticalCookie(cookie2)) {
          diff.critical++;
        }
      }
    }
    
    diff.total = diff.added.length + diff.removed.length + diff.modified.length;
    return diff;
  }

  /**
   * Compare storage between states
   */
  compareStorage(storage1, storage2) {
    const diff = {
      added: [],
      removed: [],
      modified: [],
      total: 0,
      critical: 0
    };
    
    const keys1 = new Set(Object.keys(storage1));
    const keys2 = new Set(Object.keys(storage2));
    
    // Find added keys
    for (const key of keys2) {
      if (!keys1.has(key)) {
        diff.added.push({ key, value: storage2[key] });
        if (this.isCriticalStorageKey(key)) {
          diff.critical++;
        }
      }
    }
    
    // Find removed keys
    for (const key of keys1) {
      if (!keys2.has(key)) {
        diff.removed.push({ key, value: storage1[key] });
        if (this.isCriticalStorageKey(key)) {
          diff.critical++;
        }
      }
    }
    
    // Find modified keys
    for (const key of keys2) {
      if (keys1.has(key) && storage1[key] !== storage2[key]) {
        diff.modified.push({
          key,
          oldValue: storage1[key],
          newValue: storage2[key]
        });
        if (this.isCriticalStorageKey(key)) {
          diff.critical++;
        }
      }
    }
    
    diff.total = diff.added.length + diff.removed.length + diff.modified.length;
    return diff;
  }

  /**
   * Compare IndexedDB between states
   */
  compareIndexedDB(db1, db2) {
    const diff = {
      databaseChanges: [],
      total: 0,
      critical: 0
    };
    
    if (!db1 || !db2) {
      return diff;
    }
    
    // Simplified IndexedDB comparison
    const db1Names = new Set(db1.databases?.map(db => db.name) || []);
    const db2Names = new Set(db2.databases?.map(db => db.name) || []);
    
    // Database additions/removals
    for (const name of db2Names) {
      if (!db1Names.has(name)) {
        diff.databaseChanges.push({ type: 'added', name });
        diff.total++;
      }
    }
    
    for (const name of db1Names) {
      if (!db2Names.has(name)) {
        diff.databaseChanges.push({ type: 'removed', name });
        diff.total++;
        diff.critical++;
      }
    }
    
    return diff;
  }

  /**
   * Compare page information between states
   */
  comparePageInfo(page1, page2) {
    const diff = {
      urlChanged: false,
      titleChanged: false,
      total: 0,
      critical: 0
    };
    
    if (!page1 || !page2) {
      return diff;
    }
    
    if (page1.url !== page2.url) {
      diff.urlChanged = true;
      diff.total++;
      diff.critical++;
    }
    
    if (page1.title !== page2.title) {
      diff.titleChanged = true;
      diff.total++;
    }
    
    return diff;
  }

  /**
   * Check if a cookie is critical for authentication/session
   */
  isCriticalCookie(cookie) {
    const criticalPatterns = [
      /session/i,
      /auth/i,
      /token/i,
      /jwt/i,
      /login/i,
      /csrf/i,
      /sso/i
    ];
    
    return criticalPatterns.some(pattern => pattern.test(cookie.name));
  }

  /**
   * Check if a storage key is critical
   */
  isCriticalStorageKey(key) {
    const criticalPatterns = [
      /session/i,
      /auth/i,
      /token/i,
      /jwt/i,
      /login/i,
      /user/i,
      /csrf/i,
      /sso/i
    ];
    
    return criticalPatterns.some(pattern => pattern.test(key));
  }

  /**
   * Ensure temporary directory exists
   */
  ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Helper methods for browser state capture
   */
  classifyCookie(cookie) {
    if (cookie.httpOnly || cookie.secure) {
      return 'security';
    }
    if (cookie.name.toLowerCase().includes('session')) {
      return 'session';
    }
    if (cookie.name.toLowerCase().includes('analytics')) {
      return 'analytics';
    }
    return 'general';
  }

  getCookieAccessInfo(cookie) {
    // This would need to be implemented based on specific requirements
    return {
      accessibleViaJS: !cookie.httpOnly,
      secureOnly: cookie.secure,
      sameSite: cookie.sameSite
    };
  }

  getWebGLInfo() {
    // Simplified WebGL info capture
    return {
      available: 'WebGLRenderingContext' in window,
      vendor: null, // Would need context to get this
      renderer: null
    };
  }

  getCanvasFingerprint() {
    // Simplified canvas fingerprint
    return {
      available: 'HTMLCanvasElement' in window,
      fingerprint: null // Would need actual canvas to generate
    };
  }
}

module.exports = BrowserStateCapture;