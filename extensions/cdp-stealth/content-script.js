// CDP Stealth Extension Content Script
// Handles DOM interaction, storage access, and communication between page and extension

class CDPContentScript {
  constructor() {
    this.isReady = false;
    this.eventListeners = new Map();
    this.storageObservers = new Map();
    this.domObserver = null;
    
    this.initialize();
  }

  async initialize() {
    try {
      // Setup message handlers
      this.setupMessageHandlers();
      
      // Setup DOM observer
      this.setupDOMObserver();
      
      // Setup storage observers
      this.setupStorageObservers();
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Inject script into page context
      this.injectPageScript();
      
      this.isReady = true;
      this.sendMessage('contentScriptReady', { 
        url: window.location.href,
        title: document.title
      });
      
      console.log('[CDP Stealth] Content script initialized');
    } catch (error) {
      console.error('[CDP Stealth] Failed to initialize content script:', error);
    }
  }

  setupMessageHandlers() {
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async response
    });
  }

  async handleMessage(message, sender, sendResponse) {
    const { action, data } = message;
    
    try {
      switch (action) {
        case 'getPageInfo':
          sendResponse({ success: true, data: this.getPageInfo() });
          break;
          
        case 'getStorageData':
          sendResponse({ success: true, data: await this.getStorageData(data.type) });
          break;
          
        case 'setStorageData':
          sendResponse({ success: true, data: await this.setStorageData(data.type, data.key, data.value) });
          break;
          
        case 'executeScript':
          sendResponse({ success: true, data: await this.executeInPageContext(data.script, data.args) });
          break;
          
        case 'captureDOM':
          sendResponse({ success: true, data: this.captureDOM() });
          break;
          
        case 'monitorEvents':
          this.monitorEvents(data.events);
          sendResponse({ success: true });
          break;
          
        case 'stopMonitoring':
          this.stopMonitoring();
          sendResponse({ success: true });
          break;
          
        default:
          sendResponse({ success: false, error: `Unknown action: ${action}` });
      }
    } catch (error) {
      console.error('[CDP Stealth] Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  sendMessage(action, data = {}) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action, data }, resolve);
    });
  }

  getPageInfo() {
    return {
      url: window.location.href,
      title: document.title,
      domain: window.location.hostname,
      userAgent: navigator.userAgent,
      cookies: document.cookie,
      referrer: document.referrer,
      timestamp: Date.now()
    };
  }

  async getStorageData(type) {
    switch (type) {
      case 'localStorage':
        return this.getLocalStorageData();
      case 'sessionStorage':
        return this.getSessionStorageData();
      case 'cookies':
        return this.getCookiesData();
      default:
        throw new Error(`Unknown storage type: ${type}`);
    }
  }

  getLocalStorageData() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      data[key] = localStorage.getItem(key);
    }
    return data;
  }

  getSessionStorageData() {
    const data = {};
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      data[key] = sessionStorage.getItem(key);
    }
    return data;
  }

  getCookiesData() {
    const cookies = {};
    document.cookie.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        cookies[name] = decodeURIComponent(value);
      }
    });
    return cookies;
  }

  async setStorageData(type, key, value) {
    switch (type) {
      case 'localStorage':
        localStorage.setItem(key, value);
        return true;
      case 'sessionStorage':
        sessionStorage.setItem(key, value);
        return true;
      case 'cookies':
        document.cookie = `${key}=${encodeURIComponent(value)}; path=/`;
        return true;
      default:
        throw new Error(`Unknown storage type: ${type}`);
    }
  }

  executeInPageContext(script, args = []) {
    return new Promise((resolve, reject) => {
      const scriptId = `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create a function that will be executed in page context
      const executeScript = `
        (function() {
          try {
            const scriptFunction = ${script.toString()};
            const args = ${JSON.stringify(args)};
            const result = scriptFunction.apply(null, args);
            
            // Send result back to content script
            window.postMessage({
              type: 'CDP_STEALTH_SCRIPT_RESULT',
              scriptId: '${scriptId}',
              result: result,
              success: true
            }, '*');
          } catch (error) {
            window.postMessage({
              type: 'CDP_STEALTH_SCRIPT_RESULT',
              scriptId: '${scriptId}',
              error: error.message,
              success: false
            }, '*');
          }
        })()
      `;
      
      // Listen for the result
      const messageHandler = (event) => {
        if (event.data.type === 'CDP_STEALTH_SCRIPT_RESULT' && event.data.scriptId === scriptId) {
          window.removeEventListener('message', messageHandler);
          
          if (event.data.success) {
            resolve(event.data.result);
          } else {
            reject(new Error(event.data.error));
          }
        }
      };
      
      window.addEventListener('message', messageHandler);
      
      // Execute the script
      const scriptElement = document.createElement('script');
      scriptElement.textContent = executeScript;
      (document.head || document.documentElement).appendChild(scriptElement);
      scriptElement.remove();
      
      // Set timeout
      setTimeout(() => {
        window.removeEventListener('message', messageHandler);
        reject(new Error('Script execution timeout'));
      }, 10000);
    });
  }

  captureDOM() {
    return {
      html: document.documentElement.outerHTML,
      title: document.title,
      forms: Array.from(document.forms).map(form => ({
        id: form.id,
        action: form.action,
        method: form.method,
        fields: Array.from(form.elements).map(element => ({
          name: element.name,
          type: element.type,
          value: element.value,
          id: element.id
        }))
      })),
      links: Array.from(document.links).map(link => ({
        href: link.href,
        text: link.textContent.trim(),
        id: link.id
      })),
      images: Array.from(document.images).map(img => ({
        src: img.src,
        alt: img.alt,
        id: img.id
      })),
      scripts: Array.from(document.scripts).map(script => ({
        src: script.src,
        type: script.type,
        id: script.id
      })),
      stylesheets: Array.from(document.styleSheets).map(stylesheet => ({
        href: stylesheet.href,
        ownerNode: stylesheet.ownerNode?.id
      }))
    };
  }

  setupDOMObserver() {
    this.domObserver = new MutationObserver((mutations) => {
      const significantChanges = mutations.filter(mutation => {
        return mutation.type === 'childList' && 
               (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0);
      });
      
      if (significantChanges.length > 0) {
        this.sendMessage('domChanged', {
          mutations: significantChanges.map(mutation => ({
            type: mutation.type,
            target: mutation.target.nodeName,
            addedNodes: mutation.addedNodes.length,
            removedNodes: mutation.removedNodes.length
          }))
        });
      }
    });

    this.domObserver.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false
    });
  }

  setupStorageObservers() {
    // Observe localStorage changes
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = (key, value) => {
      const result = originalSetItem.call(localStorage, key, value);
      this.sendMessage('storageChanged', {
        type: 'localStorage',
        action: 'set',
        key,
        value
      });
      return result;
    };

    const originalRemoveItem = localStorage.removeItem;
    localStorage.removeItem = (key) => {
      const result = originalRemoveItem.call(localStorage, key);
      this.sendMessage('storageChanged', {
        type: 'localStorage',
        action: 'remove',
        key
      });
      return result;
    };

    // Observe sessionStorage changes
    const originalSetItemSession = sessionStorage.setItem;
    sessionStorage.setItem = (key, value) => {
      const result = originalSetItemSession.call(sessionStorage, key, value);
      this.sendMessage('storageChanged', {
        type: 'sessionStorage',
        action: 'set',
        key,
        value
      });
      return result;
    };

    const originalRemoveItemSession = sessionStorage.removeItem;
    sessionStorage.removeItem = (key) => {
      const result = originalRemoveItemSession.call(sessionStorage, key);
      this.sendMessage('storageChanged', {
        type: 'sessionStorage',
        action: 'remove',
        key
      });
      return result;
    };
  }

  setupEventListeners() {
    // Listen for page navigation
    window.addEventListener('beforeunload', () => {
      this.sendMessage('pageUnloading', {
        url: window.location.href
      });
    });

    window.addEventListener('load', () => {
      this.sendMessage('pageLoaded', {
        url: window.location.href,
        title: document.title
      });
    });

    // Listen for focus/blur events
    window.addEventListener('focus', () => {
      this.sendMessage('windowFocus', {
        url: window.location.href
      });
    });

    window.addEventListener('blur', () => {
      this.sendMessage('windowBlur', {
        url: window.location.href
      });
    });

    // Listen for error events
    window.addEventListener('error', (event) => {
      this.sendMessage('pageError', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.stack
      });
    });
  }

  monitorEvents(events) {
    // Clear existing event listeners
    this.stopMonitoring();

    events.forEach(eventType => {
      const handler = (event) => {
        const eventData = {
          type: eventType,
          timestamp: Date.now(),
          target: {
            tagName: event.target?.tagName,
            id: event.target?.id,
            className: event.target?.className,
            value: event.target?.value,
            textContent: event.target?.textContent?.substring(0, 100)
          }
        };

        // Add event-specific data
        if (eventType === 'click') {
          eventData.button = event.button;
          eventData.clientX = event.clientX;
          eventData.clientY = event.clientY;
        } else if (eventType === 'keydown') {
          eventData.key = event.key;
          eventData.keyCode = event.keyCode;
          eventData.ctrlKey = event.ctrlKey;
          eventData.shiftKey = event.shiftKey;
        } else if (eventType === 'scroll') {
          eventData.scrollX = window.scrollX;
          eventData.scrollY = window.scrollY;
        }

        this.sendMessage('userEvent', eventData);
      };

      document.addEventListener(eventType, handler, true);
      this.eventListeners.set(eventType, handler);
    });
  }

  stopMonitoring() {
    this.eventListeners.forEach((handler, eventType) => {
      document.removeEventListener(eventType, handler, true);
    });
    this.eventListeners.clear();
  }

  injectPageScript() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected-script.js');
    script.onload = function() {
      this.remove();
    };
    (document.head || document.documentElement).appendChild(script);
  }
}

// Initialize the content script
const cdpContentScript = new CDPContentScript();