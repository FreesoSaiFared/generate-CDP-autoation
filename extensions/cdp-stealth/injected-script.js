// CDP Stealth Extension Injected Script
// Executes in the page context for direct DOM manipulation and storage access

(function() {
  'use strict';
  
  class CDPPageScript {
    constructor() {
      this.initialized = false;
      this.eventListeners = new Map();
      this.originalMethods = new Map();
      
      this.init();
    }

    init() {
      if (this.initialized) return;
      
      // Setup communication with content script
      this.setupCommunication();
      
      // Override storage methods for monitoring
      this.setupStorageOverrides();
      
      // Setup page-level monitoring
      this.setupPageMonitoring();
      
      // Expose API for content script
      this.exposeAPI();
      
      this.initialized = true;
      console.log('[CDP Stealth Page] Injected script initialized');
    }

    setupCommunication() {
      // Listen for messages from content script
      window.addEventListener('message', (event) => {
        if (event.source !== window) return;
        
        if (event.data.type === 'CDP_STEALTH_COMMAND') {
          this.handleCommand(event.data);
        }
      });
    }

    handleCommand(data) {
      const { command, id, params } = data;
      
      try {
        let result;
        
        switch (command) {
          case 'getLocalStorage':
            result = this.getLocalStorage();
            break;
          case 'getSessionStorage':
            result = this.getSessionStorage();
            break;
          case 'setLocalStorage':
            result = this.setLocalStorage(params.key, params.value);
            break;
          case 'setSessionStorage':
            result = this.setSessionStorage(params.key, params.value);
            break;
          case 'removeLocalStorage':
            result = this.removeLocalStorage(params.key);
            break;
          case 'removeSessionStorage':
            result = this.removeSessionStorage(params.key);
            break;
          case 'clearLocalStorage':
            result = this.clearLocalStorage();
            break;
          case 'clearSessionStorage':
            result = this.clearSessionStorage();
            break;
          case 'getCookies':
            result = this.getCookies();
            break;
          case 'setCookie':
            result = this.setCookie(params.name, params.value, params.options);
            break;
          case 'removeCookie':
            result = this.removeCookie(params.name, params.options);
            break;
          case 'executeFunction':
            result = this.executeFunction(params.functionString, params.args);
            break;
          case 'getFormValues':
            result = this.getFormValues(params.selector);
            break;
          case 'setFormValues':
            result = this.setFormValues(params.selector, params.values);
            break;
          case 'clickElement':
            result = this.clickElement(params.selector);
            break;
          case 'scrollTo':
            result = this.scrollTo(params.x, params.y);
            break;
          case 'getElementInfo':
            result = this.getElementInfo(params.selector);
            break;
          case 'waitForElement':
            result = this.waitForElement(params.selector, params.timeout);
            break;
          default:
            throw new Error(`Unknown command: ${command}`);
        }
        
        // Send result back
        window.postMessage({
          type: 'CDP_STEALTH_RESPONSE',
          id,
          success: true,
          result
        }, '*');
        
      } catch (error) {
        window.postMessage({
          type: 'CDP_STEALTH_RESPONSE',
          id,
          success: false,
          error: error.message
        }, '*');
      }
    }

    setupStorageOverrides() {
      // Override localStorage methods
      const originalSetItem = localStorage.setItem;
      this.originalMethods.set('localStorage.setItem', originalSetItem);
      
      localStorage.setItem = (key, value) => {
        const result = originalSetItem.call(localStorage, key, value);
        this.notifyStorageChange('localStorage', 'set', key, value);
        return result;
      };

      const originalRemoveItem = localStorage.removeItem;
      this.originalMethods.set('localStorage.removeItem', originalRemoveItem);
      
      localStorage.removeItem = (key) => {
        const result = originalRemoveItem.call(localStorage, key);
        this.notifyStorageChange('localStorage', 'remove', key);
        return result;
      };

      const originalClear = localStorage.clear;
      this.originalMethods.set('localStorage.clear', originalClear);
      
      localStorage.clear = () => {
        const result = originalClear.call(localStorage);
        this.notifyStorageChange('localStorage', 'clear');
        return result;
      };

      // Override sessionStorage methods
      const originalSetItemSession = sessionStorage.setItem;
      this.originalMethods.set('sessionStorage.setItem', originalSetItemSession);
      
      sessionStorage.setItem = (key, value) => {
        const result = originalSetItemSession.call(sessionStorage, key, value);
        this.notifyStorageChange('sessionStorage', 'set', key, value);
        return result;
      };

      const originalRemoveItemSession = sessionStorage.removeItem;
      this.originalMethods.set('sessionStorage.removeItem', originalRemoveItemSession);
      
      sessionStorage.removeItem = (key) => {
        const result = originalRemoveItemSession.call(sessionStorage, key);
        this.notifyStorageChange('sessionStorage', 'remove', key);
        return result;
      };

      const originalClearSession = sessionStorage.clear;
      this.originalMethods.set('sessionStorage.clear', originalClearSession);
      
      sessionStorage.clear = () => {
        const result = originalClearSession.call(sessionStorage);
        this.notifyStorageChange('sessionStorage', 'clear');
        return result;
      };
    }

    notifyStorageChange(storageType, action, key, value) {
      window.postMessage({
        type: 'CDP_STEALTH_STORAGE_CHANGE',
        storageType,
        action,
        key,
        value,
        timestamp: Date.now()
      }, '*');
    }

    setupPageMonitoring() {
      // Monitor DOM changes
      const observer = new MutationObserver((mutations) => {
        const significantChanges = mutations.filter(mutation => {
          return mutation.type === 'childList' && 
                 (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0);
        });
        
        if (significantChanges.length > 0) {
          window.postMessage({
            type: 'CDP_STEALTH_DOM_CHANGE',
            mutations: significantChanges.map(mutation => ({
              type: mutation.type,
              target: mutation.target.nodeName,
              addedNodes: mutation.addedNodes.length,
              removedNodes: mutation.removedNodes.length,
              timestamp: Date.now()
            }))
          }, '*');
        }
      });

      observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
      });

      // Monitor navigation
      const originalPushState = history.pushState;
      history.pushState = function(state, title, url) {
        const result = originalPushState.call(this, state, title, url);
        window.postMessage({
          type: 'CDP_STEALTH_NAVIGATION',
          url: window.location.href,
          state,
          timestamp: Date.now()
        }, '*');
        return result;
      };

      const originalReplaceState = history.replaceState;
      history.replaceState = function(state, title, url) {
        const result = originalReplaceState.call(this, state, title, url);
        window.postMessage({
          type: 'CDP_STEALTH_NAVIGATION',
          url: window.location.href,
          state,
          timestamp: Date.now()
        }, '*');
        return result;
      };

      window.addEventListener('popstate', (event) => {
        window.postMessage({
          type: 'CDP_STEALTH_NAVIGATION',
          url: window.location.href,
          state: event.state,
          timestamp: Date.now()
        }, '*');
      });
    }

    exposeAPI() {
      // Expose API for content script to call
      window.CDP_STEALTH_API = {
        getLocalStorage: () => this.getLocalStorage(),
        getSessionStorage: () => this.getSessionStorage(),
        setLocalStorage: (key, value) => this.setLocalStorage(key, value),
        setSessionStorage: (key, value) => this.setSessionStorage(key, value),
        removeLocalStorage: (key) => this.removeLocalStorage(key),
        removeSessionStorage: (key) => this.removeSessionStorage(key),
        clearLocalStorage: () => this.clearLocalStorage(),
        clearSessionStorage: () => this.clearSessionStorage(),
        getCookies: () => this.getCookies(),
        setCookie: (name, value, options) => this.setCookie(name, value, options),
        removeCookie: (name, options) => this.removeCookie(name, options),
        executeFunction: (functionString, args) => this.executeFunction(functionString, args),
        getFormValues: (selector) => this.getFormValues(selector),
        setFormValues: (selector, values) => this.setFormValues(selector, values),
        clickElement: (selector) => this.clickElement(selector),
        scrollTo: (x, y) => this.scrollTo(x, y),
        getElementInfo: (selector) => this.getElementInfo(selector),
        waitForElement: (selector, timeout) => this.waitForElement(selector, timeout)
      };
    }

    // Storage methods
    getLocalStorage() {
      const data = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        data[key] = localStorage.getItem(key);
      }
      return data;
    }

    getSessionStorage() {
      const data = {};
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        data[key] = sessionStorage.getItem(key);
      }
      return data;
    }

    setLocalStorage(key, value) {
      localStorage.setItem(key, value);
      return true;
    }

    setSessionStorage(key, value) {
      sessionStorage.setItem(key, value);
      return true;
    }

    removeLocalStorage(key) {
      localStorage.removeItem(key);
      return true;
    }

    removeSessionStorage(key) {
      sessionStorage.removeItem(key);
      return true;
    }

    clearLocalStorage() {
      localStorage.clear();
      return true;
    }

    clearSessionStorage() {
      sessionStorage.clear();
      return true;
    }

    getCookies() {
      const cookies = {};
      document.cookie.split(';').forEach(cookie => {
        const [name, value] = cookie.trim().split('=');
        if (name && value) {
          cookies[name] = decodeURIComponent(value);
        }
      });
      return cookies;
    }

    setCookie(name, value, options = {}) {
      let cookieString = `${name}=${encodeURIComponent(value)}`;
      
      if (options.domain) {
        cookieString += `; domain=${options.domain}`;
      }
      
      if (options.path) {
        cookieString += `; path=${options.path}`;
      }
      
      if (options.expires) {
        cookieString += `; expires=${options.expires.toUTCString()}`;
      }
      
      if (options.maxAge) {
        cookieString += `; max-age=${options.maxAge}`;
      }
      
      if (options.secure) {
        cookieString += '; secure';
      }
      
      if (options.sameSite) {
        cookieString += `; samesite=${options.sameSite}`;
      }
      
      document.cookie = cookieString;
      return true;
    }

    removeCookie(name, options = {}) {
      let cookieString = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      
      if (options.domain) {
        cookieString += `; domain=${options.domain}`;
      }
      
      if (options.path) {
        cookieString += `; path=${options.path}`;
      }
      
      document.cookie = cookieString;
      return true;
    }

    // DOM manipulation methods
    executeFunction(functionString, args = []) {
      const func = new Function('return ' + functionString)();
      return func.apply(null, args);
    }

    getFormValues(selector = 'form') {
      const form = document.querySelector(selector);
      if (!form) throw new Error(`Form not found: ${selector}`);
      
      const values = {};
      const elements = form.elements;
      
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        if (element.name) {
          if (element.type === 'checkbox' || element.type === 'radio') {
            values[element.name] = element.checked;
          } else if (element.type === 'select-multiple') {
            values[element.name] = Array.from(element.selectedOptions).map(option => option.value);
          } else {
            values[element.name] = element.value;
          }
        }
      }
      
      return values;
    }

    setFormValues(selector, values) {
      const form = document.querySelector(selector);
      if (!form) throw new Error(`Form not found: ${selector}`);
      
      Object.entries(values).forEach(([name, value]) => {
        const element = form.elements[name];
        if (element) {
          if (element.type === 'checkbox' || element.type === 'radio') {
            element.checked = Boolean(value);
          } else if (element.type === 'select-multiple') {
            Array.from(element.options).forEach(option => {
              option.selected = Array.isArray(value) ? value.includes(option.value) : value === option.value;
            });
          } else {
            element.value = value;
          }
          
          // Trigger change event
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      
      return true;
    }

    clickElement(selector) {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`Element not found: ${selector}`);
      
      element.click();
      return true;
    }

    scrollTo(x, y) {
      window.scrollTo(x, y);
      return true;
    }

    getElementInfo(selector) {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`Element not found: ${selector}`);
      
      const rect = element.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(element);
      
      return {
        tagName: element.tagName,
        id: element.id,
        className: element.className,
        textContent: element.textContent?.substring(0, 200),
        innerHTML: element.innerHTML?.substring(0, 200),
        value: element.value,
        href: element.href,
        src: element.src,
        visible: computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden',
        position: {
          x: rect.left + window.scrollX,
          y: rect.top + window.scrollY,
          width: rect.width,
          height: rect.height
        },
        attributes: Array.from(element.attributes).map(attr => ({
          name: attr.name,
          value: attr.value
        }))
      };
    }

    waitForElement(selector, timeout = 10000) {
      return new Promise((resolve, reject) => {
        const element = document.querySelector(selector);
        if (element) {
          resolve(element);
          return;
        }
        
        const observer = new MutationObserver(() => {
          const element = document.querySelector(selector);
          if (element) {
            observer.disconnect();
            clearTimeout(timeoutId);
            resolve(element);
          }
        });
        
        observer.observe(document.body || document.documentElement, {
          childList: true,
          subtree: true
        });
        
        const timeoutId = setTimeout(() => {
          observer.disconnect();
          reject(new Error(`Element not found within timeout: ${selector}`));
        }, timeout);
      });
    }
  }

  // Initialize the page script
  new CDPPageScript();
})();