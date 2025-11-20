/**
 * HAR Processor - Utilities for preprocessing and analyzing HAR files
 * 
 * This module provides functionality for:
 * - HAR file validation and normalization
 * - Cookie extraction and processing
 * - API endpoint identification
 * - Request/response analysis
 * - Complexity scoring
 * - Dynamic parameter extraction
 */

const fs = require('fs').promises;
const path = require('path');
const { URL } = require('url');

class HarProcessor {
  constructor(options = {}) {
    this.apiPatterns = options.apiPatterns || [
      '/api/', '/v1/', '/v2/', '/graphql', '/rest/', '/_api/', '/ajax/'
    ];
    this.excludeExtensions = options.excludeExtensions || [
      '.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2'
    ];
  }

  /**
   * Process and analyze HAR file
   * 
   * @param {string} harPath - Path to HAR file
   * @returns {Promise<Object>} Processed HAR data with analysis
   */
  async process(harPath) {
    try {
      const harData = await this.loadHar(harPath);
      const entries = this.getEntries(harData);
      
      // Extract and analyze various aspects
      const apiEndpoints = this.extractApiEndpoints(entries);
      const cookies = this.extractCookiesFromEntries(entries);
      const dynamicParams = this.extractDynamicParameters(entries);
      const authTokens = this.extractAuthTokens(entries);
      
      // Calculate complexity metrics
      const complexity = this.calculateComplexity(entries, apiEndpoints);
      
      // Build dependency graph
      const dependencyGraph = this.buildDependencyGraph(entries, apiEndpoints);
      
      return {
        entries: entries.length,
        apiEndpoints,
        cookies,
        dynamicParams,
        authTokens,
        complexity,
        dependencyGraph,
        timeRange: this.getTimeRange(entries),
        domains: this.getUniqueDomains(entries),
        methods: this.getHttpMethods(entries),
        statusCodes: this.getStatusCodeDistribution(entries)
      };
      
    } catch (error) {
      throw new Error(`HAR processing failed: ${error.message}`);
    }
  }

  /**
   * Load and validate HAR file
   * 
   * @param {string} harPath - Path to HAR file
   * @returns {Promise<Object>} Validated HAR data
   */
  async loadHar(harPath) {
    try {
      const harContent = await fs.readFile(harPath, 'utf8');
      const harData = JSON.parse(harContent);
      
      // Validate HAR structure
      if (!harData.log || !harData.log.entries) {
        throw new Error('Invalid HAR format: missing log.entries');
      }
      
      if (!Array.isArray(harData.log.entries)) {
        throw new Error('Invalid HAR format: entries must be an array');
      }
      
      return harData;
      
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('Invalid HAR format: malformed JSON');
      }
      throw error;
    }
  }

  /**
   * Get entries from HAR data
   * 
   * @param {Object} harData - HAR data
   * @returns {Array} Array of HAR entries
   */
  getEntries(harData) {
    return harData.log.entries.filter(entry => {
      // Filter out static assets
      const url = entry.request?.url || '';
      const hasExcludedExtension = this.excludeExtensions.some(ext => 
        url.toLowerCase().includes(ext)
      );
      
      // Filter out data URLs and blob URLs
      const isDataUrl = url.startsWith('data:') || url.startsWith('blob:');
      
      return !hasExcludedExtension && !isDataUrl;
    });
  }

  /**
   * Extract API endpoints from entries
   * 
   * @param {Array} entries - HAR entries
   * @returns {Array} Array of API endpoints with metadata
   */
  extractApiEndpoints(entries) {
    const endpoints = new Map();
    
    entries.forEach(entry => {
      const url = entry.request?.url || '';
      const method = entry.request?.method || 'GET';
      
      // Check if this looks like an API endpoint
      if (this.isApiEndpoint(url)) {
        const parsedUrl = new URL(url);
        const endpoint = `${method} ${parsedUrl.pathname}`;
        
        if (!endpoints.has(endpoint)) {
          endpoints.set(endpoint, {
            method,
            path: parsedUrl.pathname,
            domain: parsedUrl.hostname,
            fullUrl: url,
            count: 0,
            statusCodes: new Set(),
            params: new Set(),
            headers: new Set(),
            responses: []
          });
        }
        
        const endpointData = endpoints.get(endpoint);
        endpointData.count++;
        
        // Track status codes
        if (entry.response?.status) {
          endpointData.statusCodes.add(entry.response.status);
        }
        
        // Extract query parameters
        if (parsedUrl.searchParams) {
          parsedUrl.searchParams.forEach((value, key) => {
            endpointData.params.add(key);
          });
        }
        
        // Extract important headers
        const importantHeaders = ['authorization', 'content-type', 'accept', 'x-api-key'];
        importantHeaders.forEach(header => {
          if (entry.request?.headers?.find(h => h.name.toLowerCase() === header.toLowerCase())) {
            endpointData.headers.add(header);
          }
        });
        
        // Store sample response (first one)
        if (endpointData.responses.length < 3 && entry.response?.content?.text) {
          try {
            const responseText = entry.response.content.text;
            if (responseText.length < 1000) { // Only store small responses
              endpointData.responses.push({
                status: entry.response.status,
                content: responseText,
                contentType: entry.response.content.mimeType
              });
            }
          } catch (e) {
            // Ignore response parsing errors
          }
        }
      }
    });
    
    // Convert Sets to Arrays for JSON serialization
    return Array.from(endpoints.values()).map(endpoint => ({
      ...endpoint,
      statusCodes: Array.from(endpoint.statusCodes),
      params: Array.from(endpoint.params),
      headers: Array.from(endpoint.headers)
    }));
  }

  /**
   * Check if URL is likely an API endpoint
   * 
   * @param {string} url - URL to check
   * @returns {boolean} Whether URL is likely an API endpoint
   */
  isApiEndpoint(url) {
    const lowercaseUrl = url.toLowerCase();
    
    // Check for API patterns
    if (this.apiPatterns.some(pattern => lowercaseUrl.includes(pattern))) {
      return true;
    }
    
    // Check for JSON responses
    if (lowercaseUrl.includes('.json')) {
      return true;
    }
    
    // Check for common API methods
    const apiMethods = ['post', 'put', 'delete', 'patch'];
    // Note: We can't check method here since we only have URL
    
    return false;
  }

  /**
   * Extract cookies from HAR file
   * 
   * @param {string} harPath - Path to HAR file
   * @returns {Promise<Array>} Array of cookies
   */
  async extractCookies(harPath) {
    try {
      const harData = await this.loadHar(harPath);
      const entries = this.getEntries(harData);
      return this.extractCookiesFromEntries(entries);
    } catch (error) {
      throw new Error(`Cookie extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract cookies from HAR entries
   * 
   * @param {Array} entries - HAR entries
   * @returns {Array} Array of cookies
   */
  extractCookiesFromEntries(entries) {
    const cookies = new Map();
    
    entries.forEach(entry => {
      // Extract request cookies
      if (entry.request?.cookies) {
        entry.request.cookies.forEach(cookie => {
          const key = `${cookie.name || cookie.name}`;
          if (!cookies.has(key)) {
            cookies.set(key, {
              name: cookie.name,
              value: cookie.value,
              domain: cookie.domain || '',
              path: cookie.path || '/',
              httpOnly: cookie.httpOnly || false,
              secure: cookie.secure || false,
              sameSite: cookie.sameSite || ''
            });
          }
        });
      }
      
      // Extract response cookies (Set-Cookie headers)
      if (entry.response?.headers) {
        const setCookieHeaders = entry.response.headers.filter(
          header => header.name.toLowerCase() === 'set-cookie'
        );
        
        setCookieHeaders.forEach(header => {
          try {
            const cookieParts = header.value.split(';');
            const [nameValue] = cookieParts[0].split('=');
            const name = nameValue.trim();
            const value = cookieParts[0].substring(name.length + 1).trim();
            
            if (name && !cookies.has(name)) {
              cookies.set(name, {
                name,
                value,
                domain: '',
                path: '/',
                httpOnly: false,
                secure: false,
                sameSite: ''
              });
            }
          } catch (e) {
            // Ignore malformed cookies
          }
        });
      }
    });
    
    return Array.from(cookies.values());
  }

  /**
   * Extract dynamic parameters from responses
   * 
   * @param {Array} entries - HAR entries
   * @returns {Array} Array of dynamic parameters
   */
  extractDynamicParameters(entries) {
    const dynamicParams = new Set();
    
    entries.forEach(entry => {
      if (entry.response?.content?.text) {
        try {
          // Try to parse as JSON
          const jsonData = JSON.parse(entry.response.content.text);
          this.extractDynamicParamsFromObject(jsonData, '', dynamicParams);
        } catch (e) {
          // Not JSON, skip
        }
      }
    });
    
    return Array.from(dynamicParams);
  }

  /**
   * Recursively extract dynamic parameters from object
   * 
   * @param {*} obj - Object to analyze
   * @param {string} prefix - Current path prefix
   * @param {Set} params - Set to collect parameters
   */
  extractDynamicParamsFromObject(obj, prefix, params) {
    if (typeof obj === 'object' && obj !== null) {
      Object.keys(obj).forEach(key => {
        const fullPath = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];
        
        // Check if this looks like a dynamic parameter
        if (this.isDynamicParameter(key, value)) {
          params.add(fullPath);
        }
        
        // Recurse into nested objects
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          this.extractDynamicParamsFromObject(value, fullPath, params);
        }
      });
    }
  }

  /**
   * Check if parameter is likely dynamic
   * 
   * @param {string} key - Parameter key
   * @param {*} value - Parameter value
   * @returns {boolean} Whether parameter is likely dynamic
   */
  isDynamicParameter(key, value) {
    const dynamicPatterns = [
      /id$/i, /uuid/i, /token/i, /hash/i, /nonce/i, /timestamp/i, /session/i,
      /csrf/i, /xsrf/i, /signature/i, /expires/i, /created/i, /updated/i
    ];
    
    // Check key patterns
    if (dynamicPatterns.some(pattern => pattern.test(key))) {
      return true;
    }
    
    // Check value patterns
    if (typeof value === 'string') {
      // UUID pattern
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
        return true;
      }
      
      // JWT token pattern
      if (/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/.test(value) && value.length > 50) {
        return true;
      }
      
      // Timestamp pattern (Unix timestamp)
      if (/^\d{10,13}$/.test(value)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Extract authentication tokens
   * 
   * @param {Array} entries - HAR entries
   * @returns {Object} Authentication tokens by type
   */
  extractAuthTokens(entries) {
    const tokens = {
      bearer: [],
      apiKey: [],
      cookie: [],
      custom: []
    };
    
    entries.forEach(entry => {
      if (entry.request?.headers) {
        entry.request.headers.forEach(header => {
          const name = header.name.toLowerCase();
          const value = header.value;
          
          // Bearer tokens
          if (name === 'authorization' && value.startsWith('Bearer ')) {
            tokens.bearer.push(value.substring(7));
          }
          
          // API keys
          if (name.includes('api-key') || name.includes('x-api-key')) {
            tokens.apiKey.push(value);
          }
          
          // Custom auth headers
          if (name.includes('auth') || name.includes('token')) {
            tokens.custom.push({ header: name, value });
          }
        });
      }
    });
    
    return tokens;
  }

  /**
   * Calculate complexity score for HAR data
   * 
   * @param {Array} entries - HAR entries
   * @param {Array} apiEndpoints - API endpoints
   * @returns {Object} Complexity metrics
   */
  calculateComplexity(entries, apiEndpoints) {
    const uniqueDomains = this.getUniqueDomains(entries);
    const methods = this.getHttpMethods(entries);
    const statusCodes = this.getStatusCodeDistribution(entries);
    
    // Base complexity score (0-100)
    let score = 0;
    
    // Number of requests (max 30 points)
    score += Math.min(30, entries.length * 0.5);
    
    // Number of unique domains (max 20 points)
    score += Math.min(20, uniqueDomains.length * 5);
    
    // Number of API endpoints (max 30 points)
    score += Math.min(30, apiEndpoints.length * 3);
    
    // HTTP method diversity (max 10 points)
    score += Math.min(10, methods.length * 2);
    
    // Status code diversity (max 10 points)
    score += Math.min(10, Object.keys(statusCodes).length * 2);
    
    return {
      score: Math.round(score),
      level: this.getComplexityLevel(score),
      requestCount: entries.length,
      apiCount: apiEndpoints.length,
      domainCount: uniqueDomains.length,
      methodDiversity: methods.length,
      statusCodeDiversity: Object.keys(statusCodes).length
    };
  }

  /**
   * Get complexity level from score
   * 
   * @param {number} score - Complexity score
   * @returns {string} Complexity level
   */
  getComplexityLevel(score) {
    if (score < 30) return 'low';
    if (score < 60) return 'medium';
    if (score < 80) return 'high';
    return 'very_high';
  }

  /**
   * Build dependency graph from entries
   * 
   * @param {Array} entries - HAR entries
   * @param {Array} apiEndpoints - API endpoints
   * @returns {Object} Dependency graph
   */
  buildDependencyGraph(entries, apiEndpoints) {
    const graph = {
      nodes: [],
      edges: [],
      depth: 0,
      criticalPath: []
    };
    
    // Create nodes for each API endpoint
    apiEndpoints.forEach((endpoint, index) => {
      graph.nodes.push({
        id: index,
        method: endpoint.method,
        path: endpoint.path,
        domain: endpoint.domain,
        frequency: endpoint.count,
        critical: endpoint.count > 1 || endpoint.statusCodes.includes(200)
      });
    });
    
    // Simple dependency analysis based on timing
    const sortedEntries = entries
      .filter(entry => this.isApiEndpoint(entry.request.url))
      .sort((a, b) => (a.startedDateTime || 0) - (b.startedDateTime || 0));
    
    // Create edges based on sequential calls
    for (let i = 0; i < sortedEntries.length - 1; i++) {
      const current = sortedEntries[i];
      const next = sortedEntries[i + 1];
      
      const currentNode = graph.nodes.find(node => 
        node.path === new URL(current.request.url).pathname
      );
      const nextNode = graph.nodes.find(node => 
        node.path === new URL(next.request.url).pathname
      );
      
      if (currentNode && nextNode) {
        graph.edges.push({
          from: currentNode.id,
          to: nextNode.id,
          type: 'sequential',
          timing: (Date.parse(next.startedDateTime) - Date.parse(current.startedDateTime)) / 1000
        });
      }
    }
    
    // Calculate depth
    graph.depth = this.calculateGraphDepth(graph);
    
    return graph;
  }

  /**
   * Calculate depth of dependency graph
   * 
   * @param {Object} graph - Dependency graph
   * @returns {number} Maximum depth
   */
  calculateGraphDepth(graph) {
    if (graph.nodes.length === 0) return 0;
    
    const visited = new Set();
    const depths = new Map();
    
    // Initialize all nodes with depth 1
    graph.nodes.forEach(node => {
      depths.set(node.id, 1);
    });
    
    // Calculate depths based on edges
    let changed = true;
    while (changed) {
      changed = false;
      graph.edges.forEach(edge => {
        const newDepth = depths.get(edge.from) + 1;
        if (newDepth > depths.get(edge.to)) {
          depths.set(edge.to, newDepth);
          changed = true;
        }
      });
    }
    
    return Math.max(...depths.values());
  }

  /**
   * Get time range from entries
   * 
   * @param {Array} entries - HAR entries
   * @returns {Object} Time range info
   */
  getTimeRange(entries) {
    if (entries.length === 0) return { start: null, end: null, duration: 0 };
    
    const timestamps = entries
      .map(entry => Date.parse(entry.startedDateTime))
      .filter(ts => !isNaN(ts));
    
    if (timestamps.length === 0) return { start: null, end: null, duration: 0 };
    
    const start = Math.min(...timestamps);
    const end = Math.max(...timestamps);
    
    return {
      start: new Date(start),
      end: new Date(end),
      duration: end - start
    };
  }

  /**
   * Get unique domains from entries
   * 
   * @param {Array} entries - HAR entries
   * @returns {Array} Array of unique domains
   */
  getUniqueDomains(entries) {
    const domains = new Set();
    
    entries.forEach(entry => {
      try {
        const url = new URL(entry.request.url);
        domains.add(url.hostname);
      } catch (e) {
        // Invalid URL, skip
      }
    });
    
    return Array.from(domains);
  }

  /**
   * Get HTTP methods from entries
   * 
   * @param {Array} entries - HAR entries
   * @returns {Array} Array of HTTP methods
   */
  getHttpMethods(entries) {
    const methods = new Set();
    
    entries.forEach(entry => {
      if (entry.request?.method) {
        methods.add(entry.request.method);
      }
    });
    
    return Array.from(methods);
  }

  /**
   * Get status code distribution from entries
   * 
   * @param {Array} entries - HAR entries
   * @returns {Object} Status code distribution
   */
  getStatusCodeDistribution(entries) {
    const distribution = {};
    
    entries.forEach(entry => {
      if (entry.response?.status) {
        const status = entry.response.status;
        distribution[status] = (distribution[status] || 0) + 1;
      }
    });
    
    return distribution;
  }
}

module.exports = HarProcessor;