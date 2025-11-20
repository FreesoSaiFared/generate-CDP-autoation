// Type declarations for existing JavaScript modules

declare module '../../src/lib/mitmproxy-controller.js' {
  export class MitmproxyController extends require('events').EventEmitter {
    constructor(options: any);
    start(options?: any): Promise<void>;
    stop(): Promise<any>;
    getSessionFiles(): Promise<any>;
    isInstalled(): Promise<boolean>;
    getVersion(): Promise<string>;
    cleanupOldSessions(maxAge?: number): Promise<void>;
    getStatus(): any;
  }
}

declare module '../../src/lib/integuru-wrapper.js' {
  export class InteguruWrapper {
    constructor(options: any);
    analyzeHAR(harFile: string, taskPrompt: string, generateCode?: boolean): Promise<{
      success: boolean;
      confidence: number;
      code?: string;
      analysis: string;
      recommendations?: string[];
      apiEndpoints?: Array<{
        url: string;
        method: string;
        description: string;
      }>;
      estimatedTime?: number;
    }>;
    executeCode(code: string, options?: any): Promise<{
      success: boolean;
      output?: any;
      error?: string;
    }>;
    cleanup(): Promise<void>;
  }
}

declare module '../../src/lib/modality-optimizer.js' {
  export class ModalityOptimizer {
    constructor(options: any);
    chooseModality(params: {
      taskDescription: string;
      harFile?: string;
      integuruConfidence?: number;
    }): Promise<{
      modality: 'integuru' | 'headless_cdp' | 'visible_browser';
      confidence: number;
      estimatedTimeSeconds: number;
      reasoning: string;
      metadata: any;
    }>;
    analyzeHarFile(harFile: string): Promise<any>;
    recordExecution(params: any): Promise<void>;
  }
}

declare module 'puppeteer-extra' {
  import * as puppeteer from 'puppeteer';
  export function launch(options?: any): Promise<puppeteer.Browser>;
  
  namespace puppeteer {
    export class Browser {
      newPage(): Promise<Page>;
      close(): Promise<void>;
      target(): any;
    }
    export class Page {
      goto(url: string, options?: any): Promise<any>;
      setCookie(...cookies: any[]): Promise<void>;
      cookies(): Promise<any[]>;
      evaluate<T>(fn: () => T): Promise<T>;
      screenshot(options?: any): Promise<void | string>;
      title(): Promise<string>;
      url(): string;
      on(event: string, handler: (...args: any[]) => void): void;
    }
  }
  
  export class Browser {
    newPage(): Promise<puppeteer.Page>;
    close(): Promise<void>;
    target(): any;
  }
  
  export class Page {
    goto(url: string, options?: any): Promise<any>;
    setCookie(...cookies: any[]): Promise<void>;
    cookies(): Promise<any[]>;
    evaluate<T>(fn: () => T): Promise<T>;
    screenshot(options?: any): Promise<void | string>;
    title(): Promise<string>;
    url(): string;
    on(event: string, handler: (...args: any[]) => void): void;
    target(): any;
  }
}

declare module 'fs-extra' {
  export function ensureDirSync(path: string): void;
  export function ensureDir(path: string): Promise<void>;
  export function writeJson(path: string, data: any, options?: any): Promise<void>;
  export function writeJsonSync(path: string, data: any, options?: any): void;
  export function readJson(path: string): Promise<any>;
  export function readJsonSync(path: string): any;
  export function pathExists(path: string): Promise<boolean>;
  export function pathExistsSync(path: string): boolean;
  export function remove(path: string): Promise<void>;
  export function removeSync(path: string): void;
  export function existsSync(path: string): boolean;
}

declare module 'uuid' {
  export function v4(): string;
}