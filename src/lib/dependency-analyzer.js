/**
 * Dependency Analyzer - API dependency graph analysis
 * 
 * This module provides functionality for:
 * - Building dependency graphs from API calls
 * - Identifying critical paths and bottlenecks
 * - Analyzing request/response relationships
 * - Detecting authentication and session dependencies
 * - Optimizing execution order for API calls
 * - Visualizing dependency structures
 */

class DependencyAnalyzer {
  constructor(options = {}) {
    this.sessionTimeout = options.sessionTimeout || 300000; // 5 minutes
    this.authPatterns = options.authPatterns || [
      /login/i, /auth/i, /signin/i, /token/i, /session/i, /oauth/i
    ];
    this.criticalStatusCodes = options.criticalStatusCodes || [200, 201, 202];
    this.errorStatusCodes = options.errorStatusCodes || [400, 401, 403, 404, 500, 502, 503];
  }

  /**
   * Analyze HAR data to build dependency graph
   * 
   * @param {Object} processedHar - Processed HAR data from HarProcessor
   * @returns {Promise<Object>} Dependency graph analysis
   */
  async analyze(processedHar) {
    try {
      const { entries, apiEndpoints, timeRange } = processedHar;
      
      // Build chronological sequence of API calls
      const sequence = this.buildChronologicalSequence(entries);
      
      // Identify dependencies between calls
      const dependencies = this.identifyDependencies(sequence, apiEndpoints);
      
      // Build dependency graph
      const graph = this.buildDependencyGraph(dependencies);
      
      // Identify critical paths
      const criticalPaths = this.findCriticalPaths(graph);
      
      // Analyze authentication flow
      const authFlow = this.analyzeAuthenticationFlow(sequence, apiEndpoints);
      
      // Detect session dependencies
      const sessionDeps = this.detectSessionDependencies(sequence);
      
      // Optimize execution order
      const optimizedOrder = this.optimizeExecutionOrder(graph, authFlow);
      
      return {
        graph,
        sequence,
        dependencies,
        criticalPaths,
        authFlow,
        sessionDependencies: sessionDeps,
        optimizedOrder,
        metrics: this.calculateDependencyMetrics(graph, sequence),
        recommendations: this.generateRecommendations(graph, authFlow, criticalPaths)
      };
      
    } catch (error) {
      throw new Error(`Dependency analysis failed: ${error.message}`);
    }
  }

  /**
   * Build chronological sequence of API calls
   * 
   * @param {Array} entries - HAR entries
   * @returns {Array} Chronological sequence of API calls
   */
  buildChronologicalSequence(entries) {
    return entries
      .filter(entry => entry.request && entry.response)
      .map(entry => ({
        id: this.generateCallId(entry),
        url: entry.request.url,
        method: entry.request.method,
        timestamp: new Date(entry.startedDateTime),
        status: entry.response.status,
        duration: entry.time || 0,
        requestHeaders: this.extractHeaders(entry.request.headers),
        responseHeaders: this.extractHeaders(entry.response.headers),
        requestData: this.extractData(entry.request),
        responseData: this.extractData(entry.response),
        cookies: this.extractCookies(entry.request.cookies || []),
        responseCookies: this.extractCookies(entry.response.cookies || [])
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Identify dependencies between API calls
   * 
   * @param {Array} sequence - Chronological sequence of API calls
   * @param {Array} apiEndpoints - API endpoints metadata
   * @returns {Array} Array of dependencies
   */
  identifyDependencies(sequence, apiEndpoints) {
    const dependencies = [];
    
    for (let i = 0; i < sequence.length; i++) {
      const current = sequence[i];
      
      // Check data dependencies (response data used in subsequent requests)
      for (let j = i + 1; j < sequence.length; j++) {
        const next = sequence[j];
        
        // Time-based dependency (calls within reasonable time window)
        const timeDiff = next.timestamp - current.timestamp;
        if (timeDiff > this.sessionTimeout) break;
        
        // Check for data flow dependency
        const dataDep = this.checkDataDependency(current, next);
        if (dataDep) {
          dependencies.push({
            type: 'data',
            from: current.id,
            to: next.id,
            strength: dataDep.strength,
            description: dataDep.description,
            timeDiff
          });
        }
        
        // Check for session/cookie dependency
        const sessionDep = this.checkSessionDependency(current, next);
        if (sessionDep) {
          dependencies.push({
            type: 'session',
            from: current.id,
            to: next.id,
            strength: sessionDep.strength,
            description: sessionDep.description,
            timeDiff
          });
        }
        
        // Check for authentication dependency
        const authDep = this.checkAuthDependency(current, next);
        if (authDep) {
          dependencies.push({
            type: 'auth',
            from: current.id,
            to: next.id,
            strength: authDep.strength,
            description: authDep.description,
            timeDiff
          });
        }
      }
    }
    
    return dependencies;
  }

  /**
   * Check for data dependency between two API calls
   * 
   * @param {Object} from - Source API call
   * @param {Object} to - Target API call
   * @returns {Object|null} Dependency information or null
   */
  checkDataDependency(from, to) {
    // Extract potential data tokens from response
    const responseTokens = this.extractDataTokens(from.responseData);
    if (responseTokens.length === 0) return null;
    
    // Check if these tokens appear in the next request
    const requestData = JSON.stringify(to.requestData) + to.url;
    const matchedTokens = responseTokens.filter(token => 
      requestData.includes(token)
    );
    
    if (matchedTokens.length === 0) return null;
    
    return {
      strength: matchedTokens.length / responseTokens.length,
      description: `Response data from ${from.method} ${from.url} used in ${to.method} ${to.url}`,
      tokens: matchedTokens
    };
  }

  /**
   * Check for session dependency between two API calls
   * 
   * @param {Object} from - Source API call
   * @param {Object} to - Target API call
   * @returns {Object|null} Dependency information or null
   */
  checkSessionDependency(from, to) {
    // Check for session cookies
    const sessionCookies = from.responseCookies.filter(cookie => 
      this.isSessionCookie(cookie)
    );
    
    if (sessionCookies.length === 0) return null;
    
    // Check if session cookies are used in next request
    const usedSessionCookies = sessionCookies.filter(cookie => 
      to.cookies.some(reqCookie => reqCookie.name === cookie.name)
    );
    
    if (usedSessionCookies.length === 0) return null;
    
    return {
      strength: usedSessionCookies.length / sessionCookies.length,
      description: `Session cookies from ${from.url} used in ${to.url}`,
      cookies: usedSessionCookies.map(c => c.name)
    };
  }

  /**
   * Check for authentication dependency between two API calls
   * 
   * @param {Object} from - Source API call
   * @param {Object} to - Target API call
   * @returns {Object|null} Dependency information or null
   */
  checkAuthDependency(from, to) {
    // Check if first call is an authentication call
    if (!this.isAuthCall(from)) return null;
    
    // Check if second call uses auth tokens
    const authTokens = this.extractAuthTokens(from.responseData);
    if (authTokens.length === 0) return null;
    
    // Check if auth tokens are used in next request
    const requestData = JSON.stringify(to.requestData) + JSON.stringify(to.requestHeaders);
    const usedTokens = authTokens.filter(token => 
      requestData.includes(token)
    );
    
    if (usedTokens.length === 0) return null;
    
    return {
      strength: usedTokens.length / authTokens.length,
      description: `Auth tokens from ${from.url} used in ${to.url}`,
      tokens: usedTokens
    };
  }

  /**
   * Build dependency graph from dependencies
   * 
   * @param {Array} dependencies - Array of dependencies
   * @returns {Object} Dependency graph
   */
  buildDependencyGraph(dependencies) {
    const graph = {
      nodes: new Map(),
      edges: [],
      adjacencyList: new Map()
    };
    
    // Build nodes and edges
    dependencies.forEach(dep => {
      // Add nodes if not exists
      if (!graph.nodes.has(dep.from)) {
        graph.nodes.set(dep.from, {
          id: dep.from,
          dependencies: [],
          dependents: [],
          types: new Set()
        });
      }
      
      if (!graph.nodes.has(dep.to)) {
        graph.nodes.set(dep.to, {
          id: dep.to,
          dependencies: [],
          dependents: [],
          types: new Set()
        });
      }
      
      // Add edge
      graph.edges.push({
        from: dep.from,
        to: dep.to,
        type: dep.type,
        strength: dep.strength,
        description: dep.description
      });
      
      // Update adjacency lists
      const fromNode = graph.nodes.get(dep.from);
      const toNode = graph.nodes.get(dep.to);
      
      fromNode.dependents.push(dep.to);
      toNode.dependencies.push(dep.from);
      
      fromNode.types.add(dep.type);
      toNode.types.add(dep.type);
      
      // Update adjacency list
      if (!graph.adjacencyList.has(dep.from)) {
        graph.adjacencyList.set(dep.from, []);
      }
      graph.adjacencyList.get(dep.from).push({
        node: dep.to,
        type: dep.type,
        strength: dep.strength
      });
    });
    
    // Calculate graph metrics
    graph.metrics = this.calculateGraphMetrics(graph);
    
    return graph;
  }

  /**
   * Find critical paths in dependency graph
   * 
   * @param {Object} graph - Dependency graph
   * @returns {Array} Array of critical paths
   */
  findCriticalPaths(graph) {
    const paths = [];
    const visited = new Set();
    
    // Find all paths from root nodes (nodes with no dependencies)
    const rootNodes = Array.from(graph.nodes.values()).filter(node => 
      node.dependencies.length === 0
    );
    
    rootNodes.forEach(root => {
      const allPaths = this.findAllPaths(graph, root.id, visited);
      paths.push(...allPaths);
    });
    
    // Score paths by importance
    return paths
      .map(path => ({
        nodes: path,
        length: path.length,
        score: this.scorePath(graph, path)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10); // Top 10 critical paths
  }

  /**
   * Analyze authentication flow
   * 
   * @param {Array} sequence - Chronological sequence of API calls
   * @param {Array} apiEndpoints - API endpoints metadata
   * @returns {Object} Authentication flow analysis
   */
  analyzeAuthenticationFlow(sequence, apiEndpoints) {
    const authCalls = sequence.filter(call => this.isAuthCall(call));
    
    if (authCalls.length === 0) {
      return {
        hasAuth: false,
        authCalls: [],
        authTokens: [],
        sessionManagement: 'none'
      };
    }
    
    // Extract auth tokens
    const authTokens = authCalls.flatMap(call => 
      this.extractAuthTokens(call.responseData)
    );
    
    // Identify session management pattern
    const sessionPattern = this.identifySessionPattern(sequence, authCalls);
    
    return {
      hasAuth: true,
      authCalls: authCalls.map(call => ({
        id: call.id,
        url: call.url,
        method: call.method,
        timestamp: call.timestamp,
        success: this.criticalStatusCodes.includes(call.status)
      })),
      authTokens: authTokens,
      sessionManagement: sessionPattern,
      authEndpoints: authCalls.map(call => this.extractEndpoint(call.url))
    };
  }

  /**
   * Detect session dependencies
   * 
   * @param {Array} sequence - Chronological sequence of API calls
   * @returns {Object} Session dependency analysis
   */
  detectSessionDependencies(sequence) {
    const sessionDeps = {
      cookieBased: false,
      tokenBased: false,
      sessionDuration: 0,
      sessionStart: null,
      sessionEnd: null
    };
    
    // Find session cookies
    const sessionCookies = new Set();
    sequence.forEach(call => {
      call.responseCookies.forEach(cookie => {
        if (this.isSessionCookie(cookie)) {
          sessionCookies.add(cookie.name);
          sessionDeps.cookieBased = true;
        }
      });
    });
    
    // Find session duration
    if (sequence.length > 0) {
      sessionDeps.sessionStart = sequence[0].timestamp;
      sessionDeps.sessionEnd = sequence[sequence.length - 1].timestamp;
      sessionDeps.sessionDuration = sessionDeps.sessionEnd - sessionDeps.sessionStart;
    }
    
    // Check for token-based session
    sequence.forEach(call => {
      if (this.hasAuthToken(call.requestHeaders)) {
        sessionDeps.tokenBased = true;
      }
    });
    
    return sessionDeps;
  }

  /**
   * Optimize execution order based on dependencies
   * 
   * @param {Object} graph - Dependency graph
   * @param {Object} authFlow - Authentication flow analysis
   * @returns {Array} Optimized execution order
   */
  optimizeExecutionOrder(graph, authFlow) {
    // Topological sort with priority for auth calls
    const visited = new Set();
    const order = [];
    
    // Add auth calls first
    if (authFlow.hasAuth) {
      authFlow.authCalls.forEach(call => {
        if (!visited.has(call.id)) {
          order.push(call.id);
          visited.add(call.id);
        }
      });
    }
    
    // Topological sort for remaining nodes
    const nodes = Array.from(graph.nodes.keys());
    
    const visit = (nodeId) => {
      if (visited.has(nodeId)) return;
      
      const node = graph.nodes.get(nodeId);
      // Visit dependencies first
      node.dependencies.forEach(depId => visit(depId));
      
      order.push(nodeId);
      visited.add(nodeId);
    };
    
    nodes.forEach(nodeId => visit(nodeId));
    
    return order;
  }

  /**
   * Calculate dependency metrics
   * 
   * @param {Object} graph - Dependency graph
   * @param {Array} sequence - API call sequence
   * @returns {Object} Dependency metrics
   */
  calculateDependencyMetrics(graph, sequence) {
    const totalCalls = sequence.length;
    const dependencyCount = graph.edges.length;
    const nodeCount = graph.nodes.size;
    
    // Calculate average degree
    const totalDegree = Array.from(graph.nodes.values())
      .reduce((sum, node) => sum + node.dependencies.length + node.dependents.length, 0);
    const avgDegree = nodeCount > 0 ? totalDegree / nodeCount : 0;
    
    // Calculate dependency density
    const maxPossibleEdges = nodeCount * (nodeCount - 1) / 2;
    const density = maxPossibleEdges > 0 ? dependencyCount / maxPossibleEdges : 0;
    
    // Calculate longest path
    const longestPath = this.findLongestPath(graph);
    
    return {
      totalCalls,
      dependencyCount,
      nodeCount,
      avgDegree: Math.round(avgDegree * 100) / 100,
      density: Math.round(density * 100) / 100,
      longestPathLength: longestPath.length,
      complexity: this.calculateComplexity(dependencyCount, nodeCount, avgDegree)
    };
  }

  /**
   * Generate recommendations based on analysis
   * 
   * @param {Object} graph - Dependency graph
   * @param {Object} authFlow - Authentication flow
   * @param {Array} criticalPaths - Critical paths
   * @returns {Array} Array of recommendations
   */
  generateRecommendations(graph, authFlow, criticalPaths) {
    const recommendations = [];
    
    // Authentication recommendations
    if (authFlow.hasAuth) {
      recommendations.push({
        type: 'auth',
        priority: 'high',
        title: 'Execute authentication calls first',
        description: 'Authentication calls should be executed before any other API calls',
        action: 'Place auth calls at the beginning of the execution sequence'
      });
    }
    
    // Critical path recommendations
    if (criticalPaths.length > 0) {
      const longestPath = criticalPaths[0];
      if (longestPath.length > 5) {
        recommendations.push({
          type: 'performance',
          priority: 'medium',
          title: 'Consider parallel execution',
          description: `Longest dependency chain has ${longestPath.length} calls. Some calls might be executable in parallel.`,
          action: 'Identify independent calls and execute them in parallel to improve performance'
        });
      }
    }
    
    // Complexity recommendations
    if (graph.metrics.complexity > 0.7) {
      recommendations.push({
        type: 'complexity',
        priority: 'low',
        title: 'High dependency complexity detected',
        description: 'The API calls have many interdependencies, which may affect reliability',
        action: 'Consider breaking down into smaller, independent workflows'
      });
    }
    
    return recommendations;
  }

  // Helper methods

  generateCallId(entry) {
    const url = new URL(entry.request.url);
    return `${entry.request.method}_${url.pathname}_${Date.parse(entry.startedDateTime)}`;
  }

  extractHeaders(headers) {
    const result = {};
    (headers || []).forEach(header => {
      result[header.name.toLowerCase()] = header.value;
    });
    return result;
  }

  extractData(entry) {
    if (!entry.content) return {};
    
    const contentType = entry.content.mimeType || '';
    const text = entry.content.text || '';
    
    if (contentType.includes('application/json')) {
      try {
        return JSON.parse(text);
      } catch (e) {
        return { raw: text };
      }
    }
    
    return { raw: text };
  }

  extractCookies(cookies) {
    return (cookies || []).map(cookie => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure
    }));
  }

  extractDataTokens(data) {
    const tokens = [];
    
    if (typeof data === 'object' && data !== null) {
      this.extractTokensFromObject(data, '', tokens);
    }
    
    return tokens.filter(token => 
      token.length > 3 && 
      !token.match(/^\d+$/) && 
      !token.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i)
    );
  }

  extractTokensFromObject(obj, prefix, tokens) {
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      const fullPath = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'string' && value.length > 3) {
        tokens.push(value);
      } else if (typeof value === 'object' && value !== null) {
        this.extractTokensFromObject(value, fullPath, tokens);
      }
    });
  }

  isSessionCookie(cookie) {
    const sessionPatterns = [
      /session/i, /sid/i, /jsessionid/i, /phpsessid/i, /aspnet_sessionid/i,
      /token/i, /auth/i, /login/i
    ];
    
    return sessionPatterns.some(pattern => 
      pattern.test(cookie.name) || pattern.test(cookie.value)
    );
  }

  isAuthCall(call) {
    const url = call.url.toLowerCase();
    const method = call.method;
    
    return this.authPatterns.some(pattern => 
      pattern.test(url) || pattern.test(call.url)
    ) || (
      method === 'POST' && (
        url.includes('/login') || 
        url.includes('/auth') || 
        url.includes('/signin') ||
        url.includes('/token')
      )
    );
  }

  extractAuthTokens(data) {
    const tokens = [];
    
    if (typeof data === 'object' && data !== null) {
      // Common token fields
      const tokenFields = ['token', 'access_token', 'auth_token', 'session_token', 'jwt', 'bearer'];
      
      tokenFields.forEach(field => {
        if (data[field] && typeof data[field] === 'string') {
          tokens.push(data[field]);
        }
      });
    }
    
    return tokens;
  }

  hasAuthToken(headers) {
    const authHeader = headers.authorization || headers['x-auth-token'] || headers['x-api-key'];
    return authHeader && authHeader.length > 0;
  }

  extractEndpoint(url) {
    const parsedUrl = new URL(url);
    return `${parsedUrl.pathname}`;
  }

  identifySessionPattern(sequence, authCalls) {
    if (authCalls.length === 0) return 'none';
    
    const hasSessionCookies = sequence.some(call => 
      call.responseCookies.some(cookie => this.isSessionCookie(cookie))
    );
    
    const hasAuthTokens = sequence.some(call => 
      this.hasAuthToken(call.requestHeaders)
    );
    
    if (hasSessionCookies && hasAuthTokens) return 'hybrid';
    if (hasSessionCookies) return 'cookie';
    if (hasAuthTokens) return 'token';
    return 'unknown';
  }

  calculateGraphMetrics(graph) {
    return {
      nodeCount: graph.nodes.size,
      edgeCount: graph.edges.length,
      avgDegree: this.calculateAverageDegree(graph),
      density: this.calculateDensity(graph),
      clusters: this.identifyClusters(graph)
    };
  }

  calculateAverageDegree(graph) {
    const totalDegree = Array.from(graph.nodes.values())
      .reduce((sum, node) => sum + node.dependencies.length + node.dependents.length, 0);
    return graph.nodes.size > 0 ? totalDegree / graph.nodes.size : 0;
  }

  calculateDensity(graph) {
    const n = graph.nodes.size;
    const maxEdges = n * (n - 1) / 2;
    return maxEdges > 0 ? graph.edges.length / maxEdges : 0;
  }

  identifyClusters(graph) {
    // Simple clustering based on connectivity
    const clusters = [];
    const visited = new Set();
    
    Array.from(graph.nodes.keys()).forEach(nodeId => {
      if (!visited.has(nodeId)) {
        const cluster = this.findConnectedComponent(graph, nodeId, visited);
        if (cluster.length > 0) {
          clusters.push(cluster);
        }
      }
    });
    
    return clusters;
  }

  findConnectedComponent(graph, startId, visited) {
    const component = [];
    const stack = [startId];
    
    while (stack.length > 0) {
      const nodeId = stack.pop();
      
      if (visited.has(nodeId)) continue;
      
      visited.add(nodeId);
      component.push(nodeId);
      
      const node = graph.nodes.get(nodeId);
      [...node.dependencies, ...node.dependents].forEach(neighborId => {
        if (!visited.has(neighborId)) {
          stack.push(neighborId);
        }
      });
    }
    
    return component;
  }

  findAllPaths(graph, startId, visited, currentPath = []) {
    const paths = [];
    const newPath = [...currentPath, startId];
    
    const node = graph.nodes.get(startId);
    if (!node || node.dependents.length === 0) {
      paths.push(newPath);
      return paths;
    }
    
    node.dependents.forEach(dependentId => {
      if (!visited.has(dependentId)) {
        visited.add(dependentId);
        paths.push(...this.findAllPaths(graph, dependentId, visited, newPath));
        visited.delete(dependentId);
      }
    });
    
    return paths;
  }

  scorePath(graph, path) {
    let score = 0;
    
    // Longer paths get higher score
    score += path.length * 10;
    
    // Paths with auth dependencies get higher score
    path.forEach(nodeId => {
      const node = graph.nodes.get(nodeId);
      if (node.types.has('auth')) {
        score += 50;
      }
      if (node.types.has('session')) {
        score += 25;
      }
    });
    
    return score;
  }

  findLongestPath(graph) {
    let longestPath = [];
    
    Array.from(graph.nodes.keys()).forEach(startId => {
      const visited = new Set();
      const paths = this.findAllPaths(graph, startId, visited);
      
      paths.forEach(path => {
        if (path.length > longestPath.length) {
          longestPath = path;
        }
      });
    });
    
    return longestPath;
  }

  calculateComplexity(edgeCount, nodeCount, avgDegree) {
    // Complexity score based on multiple factors
    let complexity = 0;
    
    // Edge density factor
    const maxEdges = nodeCount * (nodeCount - 1) / 2;
    const density = maxEdges > 0 ? edgeCount / maxEdges : 0;
    complexity += density * 0.4;
    
    // Average degree factor
    complexity += Math.min(avgDegree / 10, 1) * 0.3;
    
    // Node count factor
    complexity += Math.min(nodeCount / 50, 1) * 0.3;
    
    return Math.round(complexity * 100) / 100;
  }
}

module.exports = DependencyAnalyzer;