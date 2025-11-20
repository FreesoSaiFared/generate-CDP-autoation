// CDP Stealth Extension Popup Script
// Handles UI interactions and communication with background script

class CDPPopup {
  constructor() {
    this.currentTab = null;
    this.attachedTabs = [];
    this.capturedStates = [];
    
    this.initializeElements();
    this.setupEventListeners();
    this.loadInitialData();
  }

  initializeElements() {
    // Status elements
    this.statusDot = document.getElementById('status-dot');
    this.statusText = document.getElementById('status-text');
    this.attachedCount = document.getElementById('attached-count');
    this.statesCount = document.getElementById('states-count');
    this.version = document.getElementById('version');

    // Tab management elements
    this.attachCurrentBtn = document.getElementById('attach-current');
    this.detachCurrentBtn = document.getElementById('detach-current');
    this.tabsContainer = document.getElementById('tabs-container');

    // State management elements
    this.includeCookies = document.getElementById('include-cookies');
    this.includeLocalStorage = document.getElementById('include-localstorage');
    this.includeSessionStorage = document.getElementById('include-sessionstorage');
    this.includeIndexedDB = document.getElementById('include-indexeddb');
    this.captureStateBtn = document.getElementById('capture-state');
    this.stateSelect = document.getElementById('state-select');
    this.injectStateBtn = document.getElementById('inject-state');

    // CDP command elements
    this.cdpMethod = document.getElementById('cdp-method');
    this.cdpParams = document.getElementById('cdp-params');
    this.executeCdpBtn = document.getElementById('execute-cdp');
    this.cdpOutput = document.getElementById('cdp-output');

    // Log elements
    this.logContainer = document.getElementById('log-container');
    this.clearLogsBtn = document.getElementById('clear-logs');
  }

  setupEventListeners() {
    // Tab management
    this.attachCurrentBtn.addEventListener('click', () => this.attachToCurrentTab());
    this.detachCurrentBtn.addEventListener('click', () => this.detachFromCurrentTab());

    // State management
    this.captureStateBtn.addEventListener('click', () => this.captureCurrentState());
    this.injectStateBtn.addEventListener('click', () => this.injectSelectedState());

    // CDP commands
    this.executeCdpBtn.addEventListener('click', () => this.executeCDPCommand());

    // Logs
    this.clearLogsBtn.addEventListener('click', () => this.clearLogs());

    // Update status periodically
    setInterval(() => this.updateStatus(), 2000);
  }

  async loadInitialData() {
    try {
      // Get current tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tabs[0];

      // Load initial status
      await this.updateStatus();
      await this.loadCapturedStates();

      this.log('Extension popup initialized');
    } catch (error) {
      this.log(`Error loading initial data: ${error.message}`, 'error');
    }
  }

  async updateStatus() {
    try {
      const response = await this.sendMessage('getStatus');
      
      if (response.success) {
        const { attachedTabsCount, capturedStatesCount, version } = response.data;
        
        this.attachedCount.textContent = attachedTabsCount;
        this.statesCount.textContent = capturedStatesCount;
        this.version.textContent = version;

        // Update status indicator
        if (attachedTabsCount > 0) {
          this.statusDot.classList.add('connected');
          this.statusText.textContent = 'Connected';
        } else {
          this.statusDot.classList.remove('connected');
          this.statusText.textContent = 'Disconnected';
        }
      }

      // Update attached tabs list
      await this.updateAttachedTabs();
    } catch (error) {
      this.log(`Error updating status: ${error.message}`, 'error');
    }
  }

  async updateAttachedTabs() {
    try {
      const response = await this.sendMessage('getAttachedTabs');
      
      if (response.success) {
        this.attachedTabs = response.data;
        this.renderAttachedTabs();
      }
    } catch (error) {
      this.log(`Error updating attached tabs: ${error.message}`, 'error');
    }
  }

  renderAttachedTabs() {
    if (this.attachedTabs.length === 0) {
      this.tabsContainer.innerHTML = '<p class="no-tabs">No tabs attached</p>';
      return;
    }

    const tabsHTML = this.attachedTabs.map(tab => `
      <div class="tab-item">
        <div class="tab-info">
          <div>${tab.title || 'Untitled'}</div>
          <small>${new URL(tab.url).hostname}</small>
        </div>
        <div class="tab-actions">
          <button class="btn btn-small btn-secondary" data-tab-id="${tab.tabId}" data-action="detach">Detach</button>
        </div>
      </div>
    `).join('');

    this.tabsContainer.innerHTML = tabsHTML;

    // Add event listeners to detach buttons
    this.tabsContainer.querySelectorAll('[data-action="detach"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabId = parseInt(e.target.dataset.tabId);
        this.detachFromTab(tabId);
      });
    });
  }

  async attachToCurrentTab() {
    if (!this.currentTab) {
      this.log('No current tab found', 'error');
      return;
    }

    try {
      const response = await this.sendMessage('attachDebugger', { tabId: this.currentTab.id });
      
      if (response.success) {
        this.log(`Attached debugger to tab ${this.currentTab.id}`);
        await this.updateStatus();
      } else {
        this.log(`Failed to attach debugger: ${response.error}`, 'error');
      }
    } catch (error) {
      this.log(`Error attaching debugger: ${error.message}`, 'error');
    }
  }

  async detachFromCurrentTab() {
    if (!this.currentTab) {
      this.log('No current tab found', 'error');
      return;
    }

    await this.detachFromTab(this.currentTab.id);
  }

  async detachFromTab(tabId) {
    try {
      const response = await this.sendMessage('detachDebugger', { tabId });
      
      if (response.success) {
        this.log(`Detached debugger from tab ${tabId}`);
        await this.updateStatus();
      } else {
        this.log(`Failed to detach debugger: ${response.error}`, 'error');
      }
    } catch (error) {
      this.log(`Error detaching debugger: ${error.message}`, 'error');
    }
  }

  async captureCurrentState() {
    if (!this.currentTab) {
      this.log('No current tab found', 'error');
      return;
    }

    try {
      const includeIndexedDB = this.includeIndexedDB.checked;
      const response = await this.sendMessage('captureState', { 
        tabId: this.currentTab.id,
        includeIndexedDB 
      });
      
      if (response.success) {
        const { stateId, state } = response.data;
        this.log(`State captured: ${stateId}`);
        this.log(`Captured ${Object.keys(state.cookies || {}).length} cookies, ${Object.keys(state.localStorage || {}).length} localStorage items`);
        
        await this.loadCapturedStates();
      } else {
        this.log(`Failed to capture state: ${response.error}`, 'error');
      }
    } catch (error) {
      this.log(`Error capturing state: ${error.message}`, 'error');
    }
  }

  async loadCapturedStates() {
    try {
      const items = await chrome.storage.local.get(null);
      const states = Object.entries(items)
        .filter(([key]) => key.startsWith('state_'))
        .map(([key, value]) => ({ id: key, ...value }))
        .sort((a, b) => b.timestamp - a.timestamp);

      this.capturedStates = states;
      this.renderStateOptions();
    } catch (error) {
      this.log(`Error loading captured states: ${error.message}`, 'error');
    }
  }

  renderStateOptions() {
    const currentValue = this.stateSelect.value;
    
    this.stateSelect.innerHTML = '<option value="">Select captured state...</option>';
    
    this.capturedStates.forEach(state => {
      const option = document.createElement('option');
      option.value = state.id;
      option.textContent = `${new URL(state.url).hostname} - ${new Date(state.timestamp).toLocaleString()}`;
      this.stateSelect.appendChild(option);
    });

    // Restore previous selection if it still exists
    if (currentValue && this.capturedStates.find(s => s.id === currentValue)) {
      this.stateSelect.value = currentValue;
    }
  }

  async injectSelectedState() {
    const selectedStateId = this.stateSelect.value;
    
    if (!selectedStateId) {
      this.log('No state selected', 'error');
      return;
    }

    if (!this.currentTab) {
      this.log('No current tab found', 'error');
      return;
    }

    try {
      const response = await this.sendMessage('injectState', { 
        tabId: this.currentTab.id,
        stateId: selectedStateId 
      });
      
      if (response.success) {
        this.log(`State injected: ${selectedStateId}`);
        this.log(`Injected state into current tab`);
      } else {
        this.log(`Failed to inject state: ${response.error}`, 'error');
      }
    } catch (error) {
      this.log(`Error injecting state: ${error.message}`, 'error');
    }
  }

  async executeCDPCommand() {
    const method = this.cdpMethod.value.trim();
    const paramsText = this.cdpParams.value.trim();
    
    if (!method) {
      this.log('CDP method is required', 'error');
      return;
    }

    if (!this.currentTab) {
      this.log('No current tab found', 'error');
      return;
    }

    let params = {};
    if (paramsText) {
      try {
        params = JSON.parse(paramsText);
      } catch (error) {
        this.log(`Invalid JSON parameters: ${error.message}`, 'error');
        return;
      }
    }

    try {
      const response = await this.sendMessage('executeCDPCommand', {
        tabId: this.currentTab.id,
        method,
        params
      });
      
      if (response.success) {
        const result = response.data;
        this.cdpOutput.textContent = JSON.stringify(result, null, 2);
        this.log(`CDP command executed: ${method}`);
      } else {
        this.cdpOutput.textContent = `Error: ${response.error}`;
        this.log(`CDP command failed: ${response.error}`, 'error');
      }
    } catch (error) {
      this.cdpOutput.textContent = `Error: ${error.message}`;
      this.log(`Error executing CDP command: ${error.message}`, 'error');
    }
  }

  sendMessage(action, data = {}) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action, data }, resolve);
    });
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    
    const timestampSpan = document.createElement('span');
    timestampSpan.className = 'timestamp';
    timestampSpan.textContent = `[${timestamp}]`;
    
    const messageSpan = document.createElement('span');
    messageSpan.className = 'message';
    messageSpan.textContent = message;
    
    if (type === 'error') {
      messageSpan.style.color = '#d32f2f';
    } else if (type === 'success') {
      messageSpan.style.color = '#388e3c';
    }
    
    logEntry.appendChild(timestampSpan);
    logEntry.appendChild(messageSpan);
    
    this.logContainer.appendChild(logEntry);
    this.logContainer.scrollTop = this.logContainer.scrollHeight;
    
    // Limit log entries to prevent memory issues
    while (this.logContainer.children.length > 50) {
      this.logContainer.removeChild(this.logContainer.firstChild);
    }
  }

  clearLogs() {
    this.logContainer.innerHTML = '';
    this.log('Logs cleared');
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new CDPPopup();
});