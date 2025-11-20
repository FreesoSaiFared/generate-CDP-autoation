/**
 * Cookie Extraction Utility for HAR Files
 * 
 * This module provides utilities for extracting, analyzing, and formatting
 * cookies from HAR files for use with Integuru and other automation tools.
 */

const HarParser = require('./har-parser');

class CookieExtractor {
    constructor() {
        this.harParser = new HarParser();
    }
    
    /**
     * Extract all cookies from a HAR file
     * @param {string|Object} harInput - Path to HAR file or parsed HAR data
     * @returns {Promise<Object>} Cookies organized by domain
     */
    async extractCookies(harInput) {
        const harData = typeof harInput === 'string' 
            ? await this.harParser.parseHarFile(harInput)
            : harInput;
        
        const cookies = {
            requestCookies: {},
            responseCookies: {},
            allCookies: {}
        };
        
        harData.log.entries.forEach(entry => {
            try {
                const url = new URL(entry.request.url);
                const domain = url.hostname;
                
                // Extract request cookies
                if (entry.request.cookies && entry.request.cookies.length > 0) {
                    if (!cookies.requestCookies[domain]) {
                        cookies.requestCookies[domain] = {};
                    }
                    
                    entry.request.cookies.forEach(cookie => {
                        cookies.requestCookies[domain][cookie.name] = {
                            value: cookie.value,
                            path: cookie.path || url.pathname,
                            domain: cookie.domain || domain,
                            httpOnly: cookie.httpOnly || false,
                            secure: cookie.secure || false,
                            sameSite: cookie.sameSite || undefined,
                            expires: cookie.expires || undefined,
                            size: cookie.size || 0
                        };
                    });
                }
                
                // Extract response cookies (Set-Cookie headers)
                if (entry.response.cookies && entry.response.cookies.length > 0) {
                    if (!cookies.responseCookies[domain]) {
                        cookies.responseCookies[domain] = {};
                    }
                    
                    entry.response.cookies.forEach(cookie => {
                        cookies.responseCookies[domain][cookie.name] = {
                            value: cookie.value,
                            path: cookie.path || url.pathname,
                            domain: cookie.domain || domain,
                            httpOnly: cookie.httpOnly || false,
                            secure: cookie.secure || false,
                            sameSite: cookie.sameSite || undefined,
                            expires: cookie.expires || undefined,
                            size: cookie.size || 0
                        };
                    });
                }
            } catch (error) {
                // Skip invalid URLs
            }
        });
        
        // Merge request and response cookies, with response cookies taking precedence
        const allDomains = new Set([
            ...Object.keys(cookies.requestCookies),
            ...Object.keys(cookies.responseCookies)
        ]);
        
        allDomains.forEach(domain => {
            cookies.allCookies[domain] = {
                ...cookies.requestCookies[domain],
                ...cookies.responseCookies[domain]
            };
        });
        
        return cookies;
    }
    
    /**
     * Extract cookies in Integuru format
     * @param {string|Object} harInput - Path to HAR file or parsed HAR data
     * @param {string} domain - Specific domain to extract cookies for (optional)
     * @returns {Promise<Object>} Cookies in Integuru format
     */
    async extractCookiesForInteguru(harInput, domain = null) {
        const cookies = await this.extractCookies(harInput);
        const integuruCookies = {};
        
        const domains = domain ? [domain] : Object.keys(cookies.allCookies);
        
        domains.forEach(d => {
            if (cookies.allCookies[d]) {
                Object.entries(cookies.allCookies[d]).forEach(([name, cookieData]) => {
                    integuruCookies[name] = cookieData.value;
                });
            }
        });
        
        return integuruCookies;
    }
    
    /**
     * Extract cookies in browser extension format
     * @param {string|Object} harInput - Path to HAR file or parsed HAR data
     * @returns {Promise<Array>} Cookies in Chrome extension format
     */
    async extractCookiesForExtension(harInput) {
        const cookies = await this.extractCookies(harInput);
        const extensionCookies = [];
        
        Object.entries(cookies.allCookies).forEach(([domain, domainCookies]) => {
            Object.entries(domainCookies).forEach(([name, cookieData]) => {
                extensionCookies.push({
                    name: name,
                    value: cookieData.value,
                    domain: cookieData.domain,
                    path: cookieData.path,
                    secure: cookieData.secure,
                    httpOnly: cookieData.httpOnly,
                    sameSite: cookieData.sameSite,
                    expirationDate: cookieData.expires ? 
                        new Date(cookieData.expires).getTime() / 1000 : undefined,
                    url: `https://${cookieData.domain}${cookieData.path}`
                });
            });
        });
        
        return extensionCookies;
    }
    
    /**
     * Extract session cookies (cookies without explicit expiration)
     * @param {string|Object} harInput - Path to HAR file or parsed HAR data
     * @returns {Promise<Object>} Session cookies
     */
    async extractSessionCookies(harInput) {
        const cookies = await this.extractCookies(harInput);
        const sessionCookies = {};
        
        Object.entries(cookies.allCookies).forEach(([domain, domainCookies]) => {
            sessionCookies[domain] = {};
            
            Object.entries(domainCookies).forEach(([name, cookieData]) => {
                // Session cookies typically don't have expires or have session as expiration
                if (!cookieData.expires || cookieData.expires === 'session') {
                    sessionCookies[domain][name] = cookieData;
                }
            });
        });
        
        return sessionCookies;
    }
    
    /**
     * Extract persistent cookies (cookies with explicit expiration)
     * @param {string|Object} harInput - Path to HAR file or parsed HAR data
     * @returns {Promise<Object>} Persistent cookies
     */
    async extractPersistentCookies(harInput) {
        const cookies = await this.extractCookies(harInput);
        const persistentCookies = {};
        
        Object.entries(cookies.allCookies).forEach(([domain, domainCookies]) => {
            persistentCookies[domain] = {};
            
            Object.entries(domainCookies).forEach(([name, cookieData]) => {
                // Persistent cookies have explicit expiration dates
                if (cookieData.expires && cookieData.expires !== 'session') {
                    persistentCookies[domain][name] = cookieData;
                }
            });
        });
        
        return persistentCookies;
    }
    
    /**
     * Extract authentication-related cookies
     * @param {string|Object} harInput - Path to HAR file or parsed HAR data
     * @returns {Promise<Object>} Authentication cookies
     */
    async extractAuthCookies(harInput) {
        const cookies = await this.extractCookies(harInput);
        const authCookies = {};
        
        const authPatterns = [
            /auth/i,
            /token/i,
            /session/i,
            /login/i,
            /jwt/i,
            /bearer/i,
            /sid/i,
            /csrf/i,
            /xsrf/i
        ];
        
        Object.entries(cookies.allCookies).forEach(([domain, domainCookies]) => {
            authCookies[domain] = {};
            
            Object.entries(domainCookies).forEach(([name, cookieData]) => {
                // Check if cookie name matches any auth pattern
                const isAuthCookie = authPatterns.some(pattern => pattern.test(name));
                
                if (isAuthCookie) {
                    authCookies[domain][name] = cookieData;
                }
            });
        });
        
        return authCookies;
    }
    
    /**
     * Format cookies for HTTP requests
     * @param {Object} cookies - Cookies object
     * @param {string} domain - Domain to format cookies for
     * @returns {string} Cookie header value
     */
    formatCookiesForHeader(cookies, domain) {
        if (!cookies[domain]) {
            return '';
        }
        
        return Object.entries(cookies[domain])
            .map(([name, cookieData]) => `${name}=${cookieData.value}`)
            .join('; ');
    }
    
    /**
     * Export cookies to JSON file
     * @param {string|Object} harInput - Path to HAR file or parsed HAR data
     * @param {string} outputPath - Path to save cookies JSON
     * @param {string} format - Export format ('integuru', 'extension', 'full')
     * @returns {Promise<string>} Path to saved file
     */
    async exportCookies(harInput, outputPath, format = 'integuru') {
        let cookies;
        
        switch (format) {
            case 'integuru':
                cookies = await this.extractCookiesForInteguru(harInput);
                break;
            case 'extension':
                cookies = await this.extractCookiesForExtension(harInput);
                break;
            case 'full':
                cookies = await this.extractCookies(harInput);
                break;
            default:
                throw new Error(`Unknown export format: ${format}`);
        }
        
        const fs = require('fs').promises;
        await fs.writeFile(outputPath, JSON.stringify(cookies, null, 2));
        
        return outputPath;
    }
    
    /**
     * Analyze cookie security
     * @param {string|Object} harInput - Path to HAR file or parsed HAR data
     * @returns {Promise<Object>} Security analysis
     */
    async analyzeCookieSecurity(harInput) {
        const cookies = await this.extractCookies(harInput);
        const analysis = {
            totalCookies: 0,
            secureCookies: 0,
            httpOnlyCookies: 0,
            cookiesWithoutSameSite: 0,
            insecureCookies: [],
            recommendations: []
        };
        
        Object.entries(cookies.allCookies).forEach(([domain, domainCookies]) => {
            Object.entries(domainCookies).forEach(([name, cookieData]) => {
                analysis.totalCookies++;
                
                if (cookieData.secure) {
                    analysis.secureCookies++;
                } else {
                    analysis.insecureCookies.push({
                        name,
                        domain,
                        issue: 'Missing Secure flag'
                    });
                }
                
                if (cookieData.httpOnly) {
                    analysis.httpOnlyCookies++;
                } else {
                    analysis.insecureCookies.push({
                        name,
                        domain,
                        issue: 'Missing HttpOnly flag'
                    });
                }
                
                if (!cookieData.sameSite) {
                    analysis.cookiesWithoutSameSite++;
                    analysis.insecureCookies.push({
                        name,
                        domain,
                        issue: 'Missing SameSite attribute'
                    });
                }
            });
        });
        
        // Generate recommendations
        if (analysis.insecureCookies.length > 0) {
            analysis.recommendations.push(
                'Consider adding Secure flag to cookies transmitted over HTTPS'
            );
            analysis.recommendations.push(
                'Consider adding HttpOnly flag to prevent XSS attacks'
            );
            analysis.recommendations.push(
                'Consider adding SameSite attribute to prevent CSRF attacks'
            );
        }
        
        return analysis;
    }
}

module.exports = CookieExtractor;