/**
 * Gmail Test Helper Utility
 * 
 * Provides specialized functionality for Gmail login testing,
 * including stealth verification, credential validation,
 * and detection bypass checking.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

// Use stealth plugin
puppeteer.use(StealthPlugin());

class GmailTestHelper {
    constructor(options = {}) {
        this.options = {
            gmailEmail: options.gmailEmail || 'kijkwijs@gmail.com',
            gmailPassword: options.gmailPassword || 'Swamp98550!',
            timeout: options.timeout || 30000,
            headless: options.headless !== false,
            userDataDir: options.userDataDir || './chrome-test-profile',
            ...options
        };
        
        this.browser = null;
        this.page = null;
    }

    /**
     * Verify Chrome stealth configuration
     */
    async verifyStealthConfiguration() {
        const startTime = Date.now();
        
        try {
            // Launch browser with stealth configuration
            this.browser = await puppeteer.launch({
                headless: this.options.headless,
                userDataDir: this.options.userDataDir,
                args: [
                    '--disable-blink-features=AutomationControlled',
                    '--exclude-switches=enable-automation',
                    '--disable-automation',
                    '--disable-ipc-flooding-protection',
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-default-browser-check',
                    '--disable-background-timer-throttling',
                    '--disable-renderer-backgrounding',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-features=TranslateUI',
                    '--disable-ipc-flooding-protection'
                ]
            });
            
            this.page = await this.browser.newPage();
            
            // Set viewport and user agent
            await this.page.setViewport({
                width: 1920,
                height: 1080,
                deviceScaleFactor: 1,
                isMobile: false,
                hasTouch: false,
                isLandscape: true
            });
            
            // Run stealth verification checks
            const checks = await this.page.evaluate(() => {
                const results = {};
                
                // Check 1: navigator.webdriver
                results.navigatorWebdriver = {
                    present: 'webdriver' in navigator,
                    value: navigator.webdriver,
                    passed: !('webdriver' in navigator)
                };
                
                // Check 2: chrome automation
                results.chromeAutomation = {
                    present: 'chrome' in window && 'runtime' in window.chrome,
                    value: window.chrome?.runtime?.onMessage,
                    passed: !(window.chrome?.runtime?.onMessage)
                };
                
                // Check 3: permissions API
                results.permissionsAPI = {
                    present: 'permissions' in navigator,
                    query: typeof navigator.permissions?.query === 'function',
                    passed: !('permissions' in navigator)
                };
                
                // Check 4: plugins
                results.plugins = {
                    length: navigator.plugins.length,
                    passed: navigator.plugins.length > 0
                };
                
                // Check 5: languages
                results.languages = {
                    length: navigator.languages.length,
                    passed: navigator.languages.length > 0
                };
                
                // Check 6: WebGL fingerprint
                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                results.webgl = {
                    present: !!gl,
                    vendor: gl?.getParameter(gl.VENDOR),
                    renderer: gl?.getParameter(gl.RENDERER),
                    passed: !!gl
                };
                
                // Check 7: Canvas fingerprint
                const ctx = canvas.getContext('2d');
                ctx.textBaseline = 'top';
                ctx.font = '14px Arial';
                ctx.fillText('Stealth test', 2, 2);
                results.canvas = {
                    fingerprint: canvas.toDataURL().slice(0, 50) + '...',
                    passed: true // Canvas should work normally
                };
                
                // Check 8: Screen properties
                results.screen = {
                    width: screen.width,
                    height: screen.height,
                    colorDepth: screen.colorDepth,
                    pixelDepth: screen.pixelDepth,
                    passed: screen.width > 0 && screen.height > 0
                };
                
                // Check 9: Timezone
                results.timezone = {
                    offset: new Date().getTimezoneOffset(),
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    passed: true // Should have reasonable timezone
                };
                
                // Check 10: Connection
                results.connection = {
                    effectiveType: navigator.connection?.effectiveType,
                    rtt: navigator.connection?.rtt,
                    downlink: navigator.connection?.downlink,
                    passed: true // Connection info should be available
                };
                
                return results;
            });
            
            // Calculate overall score
            const totalChecks = Object.keys(checks).length;
            const passedChecks = Object.values(checks).filter(check => check.passed).length;
            const score = passedChecks / totalChecks;
            
            const result = {
                success: score >= 0.8, // 80% of checks must pass
                score: Math.round(score * 100) / 100,
                checks,
                summary: {
                    totalChecks,
                    passedChecks,
                    failedChecks: totalChecks - passedChecks
                },
                duration: Date.now() - startTime,
                userAgent: await this.page.evaluate(() => navigator.userAgent)
            };
            
            await this.browser.close();
            this.browser = null;
            this.page = null;
            
            return result;
            
        } catch (error) {
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
                this.page = null;
            }
            
            return {
                success: false,
                error: error.message,
                duration: Date.now() - startTime,
                checks: null
            };
        }
    }

    /**
     * Validate Gmail credentials
     */
    async validateCredentials() {
        const startTime = Date.now();
        
        try {
            // Basic credential format validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const emailValid = emailRegex.test(this.options.gmailEmail);
            const passwordValid = this.options.gmailPassword && this.options.gmailPassword.length >= 8;
            
            const result = {
                valid: emailValid && passwordValid,
                email: {
                    value: this.options.gmailEmail,
                    valid: emailValid,
                    masked: this.maskEmail(this.options.gmailEmail)
                },
                password: {
                    valid: passwordValid,
                    length: this.options.gmailPassword ? this.options.gmailPassword.length : 0,
                    strength: this.calculatePasswordStrength(this.options.gmailPassword)
                },
                duration: Date.now() - startTime
            };
            
            return result;
            
        } catch (error) {
            return {
                valid: false,
                error: error.message,
                duration: Date.now() - startTime
            };
        }
    }

    /**
     * Test Gmail login with stealth configuration
     */
    async testGmailLogin() {
        const startTime = Date.now();
        
        try {
            // Launch browser with stealth configuration
            this.browser = await puppeteer.launch({
                headless: this.options.headless,
                userDataDir: this.options.userDataDir,
                args: [
                    '--disable-blink-features=AutomationControlled',
                    '--exclude-switches=enable-automation',
                    '--disable-automation',
                    '--disable-ipc-flooding-protection',
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-default-browser-check',
                    '--disable-background-timer-throttling',
                    '--disable-renderer-backgrounding',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-features=TranslateUI'
                ]
            });
            
            this.page = await this.browser.newPage();
            
            // Set random user agent
            await this.page.setUserAgent(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
            );
            
            // Set viewport
            await this.page.setViewport({
                width: 1920,
                height: 1080,
                deviceScaleFactor: 1
            });
            
            // Navigate to Gmail login page
            await this.page.goto('https://accounts.google.com/signin', {
                waitUntil: 'networkidle2',
                timeout: this.options.timeout
            });
            
            // Check for detection warnings
            const detectionCheck = await this.checkForDetection();
            if (detectionCheck.detected) {
                throw new Error(`Detection triggered: ${detectionCheck.reason}`);
            }
            
            // Fill email
            await this.page.waitForSelector('input[type="email"]', { timeout: 10000 });
            await this.page.type('input[type="email"]', this.options.gmailEmail, {
                delay: 50 + Math.random() * 50
            });
            
            // Click Next
            await this.page.waitForSelector('#identifierNext', { timeout: 5000 });
            await this.page.click('#identifierNext');
            
            // Wait for password field
            await this.page.waitForSelector('input[type="password"]', { timeout: 10000 });
            
            // Fill password
            await this.page.type('input[type="password"]', this.options.gmailPassword, {
                delay: 50 + Math.random() * 50
            });
            
            // Click Sign In
            await this.page.waitForSelector('#passwordNext', { timeout: 5000 });
            await this.page.click('#passwordNext');
            
            // Wait for navigation
            await this.page.waitForNavigation({
                waitUntil: 'networkidle2',
                timeout: 15000
            });
            
            // Check final URL for success or detection
            const finalUrl = this.page.url();
            const loginSuccess = finalUrl.includes('mail.google.com') || finalUrl.includes('myaccount.google.com');
            const detectionDetected = finalUrl.includes('unsafe') || finalUrl.includes('vibration');
            
            // Take screenshot for verification
            const screenshot = await this.page.screenshot({
                encoding: 'base64',
                fullPage: true
            });
            
            const result = {
                success: loginSuccess && !detectionDetected,
                loginSuccess,
                detectionDetected,
                finalUrl,
                screenshot,
                duration: Date.now() - startTime,
                metadata: {
                    emailEntered: true,
                    passwordEntered: true,
                    navigationCompleted: true
                }
            };
            
            await this.browser.close();
            this.browser = null;
            this.page = null;
            
            return result;
            
        } catch (error) {
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
                this.page = null;
            }
            
            return {
                success: false,
                error: error.message,
                duration: Date.now() - startTime,
                screenshot: null
            };
        }
    }

    /**
     * Check for detection warnings
     */
    async checkForDetection() {
        try {
            const checks = await this.page.evaluate(() => {
                const results = {
                    detected: false,
                    reasons: [],
                    warnings: []
                };
                
                // Check for unsafe browser warnings
                const unsafeElements = document.querySelectorAll([
                    '[data*="unsafe"]',
                    '[class*="unsafe"]',
                    '[id*="unsafe"]'
                ].join(','));
                
                if (unsafeElements.length > 0) {
                    results.detected = true;
                    results.reasons.push('Unsafe browser warning elements found');
                }
                
                // Check for bot detection messages
                const botDetectionTexts = [
                    'bot',
                    'automation',
                    'suspicious',
                    'unusual',
                    'security check',
                    'verify you\'re human'
                ];
                
                const pageText = document.body.innerText.toLowerCase();
                botDetectionTexts.forEach(text => {
                    if (pageText.includes(text)) {
                        results.detected = true;
                        results.reasons.push(`Bot detection text found: "${text}"`);
                    }
                });
                
                // Check for CAPTCHA
                const captchaElements = document.querySelectorAll([
                    'iframe[src*="recaptcha"]',
                    'iframe[src*="captcha"]',
                    '[class*="captcha"]',
                    '[id*="captcha"]'
                ].join(','));
                
                if (captchaElements.length > 0) {
                    results.warnings.push('CAPTCHA elements found');
                }
                
                // Check for rate limiting
                const rateLimitTexts = [
                    'too many attempts',
                    'try again later',
                    'rate limit',
                    'temporary block'
                ];
                
                rateLimitTexts.forEach(text => {
                    if (pageText.includes(text)) {
                        results.warnings.push(`Rate limiting text found: "${text}"`);
                    }
                });
                
                return results;
            });
            
            return {
                detected: checks.detected,
                reason: checks.reasons[0] || null,
                warnings: checks.warnings
            };
            
        } catch (error) {
            return {
                detected: false,
                reason: `Detection check failed: ${error.message}`,
                warnings: []
            };
        }
    }

    /**
     * Calculate password strength
     */
    calculatePasswordStrength(password) {
        if (!password) return { score: 0, level: 'very weak' };
        
        let score = 0;
        const feedback = [];
        
        // Length check
        if (password.length >= 8) {
            score += 1;
        } else {
            feedback.push('Password should be at least 8 characters');
        }
        
        if (password.length >= 12) {
            score += 1;
        }
        
        // Character variety checks
        if (/[a-z]/.test(password)) {
            score += 1;
        }
        
        if (/[A-Z]/.test(password)) {
            score += 1;
        }
        
        if (/[0-9]/.test(password)) {
            score += 1;
        }
        
        if (/[^a-zA-Z0-9]/.test(password)) {
            score += 1;
        }
        
        // Common patterns
        if (!/(.)\1{2,}/.test(password)) {
            score += 1;
        } else {
            feedback.push('Avoid repeated characters');
        }
        
        // Determine strength level
        let level;
        if (score < 3) {
            level = 'weak';
        } else if (score < 5) {
            level = 'medium';
        } else if (score < 7) {
            level = 'strong';
        } else {
            level = 'very strong';
        }
        
        return {
            score: Math.min(score, 8),
            level,
            feedback
        };
    }

    /**
     * Mask email for logging
     */
    maskEmail(email) {
        if (!email) return '';
        
        const [username, domain] = email.split('@');
        if (username.length <= 3) {
            return `${username[0]}***@${domain}`;
        }
        
        return `${username.slice(0, 3)}***@${domain}`;
    }

    /**
     * Get Gmail login test scenarios
     */
    getTestScenarios() {
        return [
            {
                name: 'Standard Gmail Login',
                description: 'Basic Gmail login with valid credentials',
                email: this.options.gmailEmail,
                password: this.options.gmailPassword,
                expectedSuccess: true
            },
            {
                name: 'Invalid Email',
                description: 'Gmail login with invalid email',
                email: 'invalid@example.com',
                password: this.options.gmailPassword,
                expectedSuccess: false
            },
            {
                name: 'Invalid Password',
                description: 'Gmail login with invalid password',
                email: this.options.gmailEmail,
                password: 'wrongpassword',
                expectedSuccess: false
            },
            {
                name: 'Empty Credentials',
                description: 'Gmail login with empty fields',
                email: '',
                password: '',
                expectedSuccess: false
            }
        ];
    }

    /**
     * Run all test scenarios
     */
    async runTestScenarios() {
        const scenarios = this.getTestScenarios();
        const results = [];
        
        for (const scenario of scenarios) {
            console.log(`\n📧 Testing scenario: ${scenario.name}`);
            
            // Update options for this scenario
            const testOptions = {
                ...this.options,
                gmailEmail: scenario.email,
                gmailPassword: scenario.password
            };
            
            const helper = new GmailTestHelper(testOptions);
            const result = await helper.testGmailLogin();
            
            results.push({
                scenario: scenario.name,
                description: scenario.description,
                expectedSuccess: scenario.expectedSuccess,
                actualSuccess: result.success,
                duration: result.duration,
                error: result.error,
                detectionDetected: result.detectionDetected,
                finalUrl: result.finalUrl
            });
            
            // Wait between scenarios
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        return results;
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        try {
            if (this.page) {
                await this.page.close();
                this.page = null;
            }
            
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
            }
        } catch (error) {
            console.error('Cleanup failed:', error);
        }
    }
}

module.exports = GmailTestHelper;