// CDP Stealth Extension Background Service Worker
// Handles Chrome Debugger API integration and state management

class CDPStealthBackground {
  constructor() {
    this.attachedTabs = new Set();
    this.capturedStates = new Map();
    this.debuggerTargets = new Map();
    this.messageHandlers = new Map();
    
    this.initializeMessageHandlers();
    this.setupEventListeners();
  }

  initializeMessageHandlers() {
    // Register message handlers
    this.messageHandlers.set('attachDebugger', this.attachDebugger.bind(this));
    this.messageHandlers.set('detachDebugger', this.detachDebugger.bind(this));
    this.messageHandlers.set('captureState', this.captureState.bind(this));
    this.messageHandlers.set('injectState', this.injectState.bind(this));
    this.messageHandlers.set('executeCDPCommand', this.executeCDPCommand.bind(this));
    this.messageHandlers.set('getAttachedTabs', this.getAttachedTabs.bind(this));
    this.messageHandlers.set('getStatus', this.getStatus.bind(this));
  }

  setupEventListeners() {
    // Listen for messages from popup and content scripts
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep the message channel open for async response
    });

    // Listen for tab updates
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && this.attachedTabs.has(tabId)) {
        this.reattachDebugger(tabId);
      }
    });

    // Listen for tab removal
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.detachDebugger({ tabId });
    });
  }

  async handleMessage(message, sender, sendResponse) {
    const { action, data } = message;
    const handler = this.messageHandlers.get(action);
    
    if (!handler) {
      sendResponse({ success: false, error: `Unknown action: ${action}` });
      return;
    }

    try {
      const result = await handler(data, sender);
      sendResponse({ success: true, data: result });
    } catch (error) {
      console.error(`Error handling ${action}:`, error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async attachDebugger({ tabId }, sender) {
    if (this.attachedTabs.has(tabId)) {
      return { status: 'already_attached' };
    }

    try {
      // Attach debugger to the target tab
      await chrome.debugger.attach({ tabId }, '1.3');
      this.attachedTabs.add(tabId);
      
      // Enable required domains
      await this.enableCDPDomains(tabId);
      
      // Store debugger target info
      this.debuggerTargets.set(tabId, {
        tabId,
        attached: true,
        attachedAt: Date.now()
      });

      console.log(`Debugger attached to tab ${tabId}`);
      return { status: 'attached', tabId };
    } catch (error) {
      console.error(`Failed to attach debugger to tab ${tabId}:`, error);
      throw error;
    }
  }

  async detachDebugger({ tabId }) {
    if (!this.attachedTabs.has(tabId)) {
      return { status: 'not_attached' };
    }

    try {
      await chrome.debugger.detach({ tabId });
      this.attachedTabs.delete(tabId);
      this.debuggerTargets.delete(tabId);
      
      console.log(`Debugger detached from tab ${tabId}`);
      return { status: 'detached', tabId };
    } catch (error) {
      console.error(`Failed to detach debugger from tab ${tabId}:`, error);
      throw error;
    }
  }

  async enableCDPDomains(tabId) {
    const domains = [
      'Network',
      'Runtime',
      'Page',
      'DOM',
      'Storage',
      'IndexedDB',
      'Database'
    ];

    for (const domain of domains) {
      try {
        await chrome.debugger.sendCommand({ tabId }, `${domain}.enable`);
      } catch (error) {
        console.warn(`Failed to enable ${domain} domain:`, error);
      }
    }
  }

  async executeCDPCommand({ tabId, method, params }) {
    if (!this.attachedTabs.has(tabId)) {
      throw new Error('Debugger not attached to tab');
    }

    try {
      const result = await chrome.debugger.sendCommand({ tabId }, method, params);
      return result;
    } catch (error) {
      console.error(`CDP command failed: ${method}`, error);
      throw error;
    }
  }

  async captureState({ tabId, includeIndexedDB = true }) {
    if (!this.attachedTabs.has(tabId)) {
      throw new Error('Debugger not attached to tab');
    }

    try {
      const tab = await chrome.tabs.get(tabId);
      const url = new URL(tab.url);
      const domain = url.origin;
      
      const state = {
        url: tab.url,
        domain,
        timestamp: Date.now(),
        cookies: await this.captureCookies(domain),
        localStorage: await this.captureLocalStorage(tabId),
        sessionStorage: await this.captureSessionStorage(tabId)
      };

      if (includeIndexedDB) {
        state.indexedDB = await this.captureIndexedDB(tabId);
      }

      // Store captured state
      const stateId = `state_${Date.now()}_${tabId}`;
      this.capturedStates.set(stateId, state);
      
      // Also persist to chrome.storage for persistence
      await chrome.storage.local.set({ [stateId]: state });

      return { stateId, state };
    } catch (error) {
      console.error('Failed to capture state:', error);
      throw error;
    }
  }

  async injectState({ tabId, stateId, state }) {
    if (!this.attachedTabs.has(tabId)) {
      throw new Error('Debugger not attached to tab');
    }

    try {
      // Get state either from ID or provided state object
      const targetState = state || this.capturedStates.get(stateId) || 
                        (await chrome.storage.local.get(stateId))[stateId];
      
      if (!targetState) {
        throw new Error('State not found');
      }

      // Inject cookies
      if (targetState.cookies) {
        await this.injectCookies(targetState.cookies);
      }

      // Inject localStorage
      if (targetState.localStorage) {
        await this.injectLocalStorage(tabId, targetState.localStorage);
      }

      // Inject sessionStorage
      if (targetState.sessionStorage) {
        await this.injectSessionStorage(tabId, targetState.sessionStorage);
      }

      // Inject IndexedDB
      if (targetState.indexedDB) {
        await this.injectIndexedDB(tabId, targetState.indexedDB);
      }

      return { success: true, injectedState: targetState.url };
    } catch (error) {
      console.error('Failed to inject state:', error);
      throw error;
    }
  }

  async captureCookies(domain) {
    try {
      const cookies = await chrome.cookies.getAll({ domain });
      return cookies.map(cookie => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
        expirationDate: cookie.expirationDate
      }));
    } catch (error) {
      console.error('Failed to capture cookies:', error);
      return [];
    }
  }

  async injectCookies(cookies) {
    for (const cookie of cookies) {
      try {
        await chrome.cookies.set(cookie);
      } catch (error) {
        console.warn(`Failed to set cookie ${cookie.name}:`, error);
      }
    }
  }

  async captureLocalStorage(tabId) {
    try {
      const result = await this.executeCDPCommand({
        tabId,
        method: 'Runtime.evaluate',
        params: {
          expression: `
            (() => {
              const storage = {};
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                storage[key] = localStorage.getItem(key);
              }
              return storage;
            })()
          `,
          returnByValue: true
        }
      });
      return result.result.value;
    } catch (error) {
      console.error('Failed to capture localStorage:', error);
      return {};
    }
  }

  async injectLocalStorage(tabId, localStorageData) {
    try {
      await this.executeCDPCommand({
        tabId,
        method: 'Runtime.evaluate',
        params: {
          expression: `
            ((data) => {
              Object.keys(data).forEach(key => {
                localStorage.setItem(key, data[key]);
              });
              return true;
            })(${JSON.stringify(localStorageData)})
          `,
          returnByValue: true
        }
      });
    } catch (error) {
      console.error('Failed to inject localStorage:', error);
    }
  }

  async captureSessionStorage(tabId) {
    try {
      const result = await this.executeCDPCommand({
        tabId,
        method: 'Runtime.evaluate',
        params: {
          expression: `
            (() => {
              const storage = {};
              for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                storage[key] = sessionStorage.getItem(key);
              }
              return storage;
            })()
          `,
          returnByValue: true
        }
      });
      return result.result.value;
    } catch (error) {
      console.error('Failed to capture sessionStorage:', error);
      return {};
    }
  }

  async injectSessionStorage(tabId, sessionStorageData) {
    try {
      await this.executeCDPCommand({
        tabId,
        method: 'Runtime.evaluate',
        params: {
          expression: `
            ((data) => {
              Object.keys(data).forEach(key => {
                sessionStorage.setItem(key, data[key]);
              });
              return true;
            })(${JSON.stringify(sessionStorageData)})
          `,
          returnByValue: true
        }
      });
    } catch (error) {
      console.error('Failed to inject sessionStorage:', error);
    }
  }

  async captureIndexedDB(tabId) {
    try {
      const result = await this.executeCDPCommand({
        tabId,
        method: 'Runtime.evaluate',
        params: {
          expression: `
            (async () => {
              const databases = [];
              if (window.indexedDB) {
                const dbNames = await indexedDB.databases();
                for (const dbName of dbNames) {
                  // Note: Full IndexedDB capture requires more complex implementation
                  // This is a placeholder for the database names
                  databases.push({
                    name: dbName.name,
                    version: dbName.version
                  });
                }
              }
              return databases;
            })()
          `,
          returnByValue: true,
          awaitPromise: true
        }
      });
      return result.result.value;
    } catch (error) {
      console.error('Failed to capture IndexedDB:', error);
      return [];
    }
  }

  async injectIndexedDB(tabId, indexedDBData) {
    // Placeholder for IndexedDB injection
    // Full implementation would require complex database recreation logic
    console.log('IndexedDB injection not fully implemented');
  }

  async getAttachedTabs() {
    const tabs = [];
    for (const tabId of this.attachedTabs) {
      try {
        const tab = await chrome.tabs.get(tabId);
        tabs.push({
          tabId,
          url: tab.url,
          title: tab.title,
          attachedAt: this.debuggerTargets.get(tabId)?.attachedAt
        });
      } catch (error) {
        // Tab might have been closed
        this.attachedTabs.delete(tabId);
        this.debuggerTargets.delete(tabId);
      }
    }
    return tabs;
  }

  async getStatus() {
    return {
      attachedTabsCount: this.attachedTabs.size,
      capturedStatesCount: this.capturedStates.size,
      version: chrome.runtime.getManifest().version
    };
  }

  async reattachDebugger(tabId) {
    try {
      // Detach and reattach to ensure debugger is still working
      await chrome.debugger.detach({ tabId });
      await chrome.debugger.attach({ tabId }, '1.3');
      await this.enableCDPDomains(tabId);
    } catch (error) {
      console.error(`Failed to reattach debugger to tab ${tabId}:`, error);
      this.attachedTabs.delete(tabId);
      this.debuggerTargets.delete(tabId);
    }
  }
}

// Initialize the background service
const cdpStealth = new CDPStealthBackground();