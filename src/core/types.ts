import { Browser, Page } from 'puppeteer';

export interface ServerConfig {
  browserPoolSize: number;
  browserTimeout: number;
  headless: boolean;
  chromePath?: string;
  herdDirectory: string;
  defaultDomainSuffix: string;
  sslEnabled: boolean;
  mcpTransport: 'stdio' | 'http';
  mcpPort?: number;
  mcpAuthEnabled: boolean;
  debugScreenshots: boolean;
  debugConsoleLogs: boolean;
  visualDebug: boolean;
}

export interface BrowserPoolConfig {
  min: number;
  max: number;
  acquireTimeoutMillis: number;
  createTimeoutMillis: number;
  destroyTimeoutMillis: number;
  idleTimeoutMillis: number;
  reapIntervalMillis: number;
  createRetryIntervalMillis: number;
  autostart: boolean;
}

export interface BrowserInstance {
  browser: Browser;
  id: string;
  created: Date;
  lastUsed: Date;
  activePages: number;
}

export interface NavigationOptions {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  timeout?: number;
  viewport?: {
    width: number;
    height: number;
  };
}

export interface ScreenshotOptions {
  path?: string;
  type?: 'png' | 'jpeg' | 'webp';
  quality?: number;
  fullPage?: boolean;
  clip?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface InteractionOptions {
  timeout?: number;
  force?: boolean;
  trial?: boolean;
}

export interface WaitForOptions {
  timeout?: number;
  visible?: boolean;
  hidden?: boolean;
}

export interface LaravelAuthConfig {
  guardName?: string;
  sessionKey?: string;
}

export interface LaravelDbConfig {
  connection?: string;
  database?: string;
}

export interface DebugInfo {
  timestamp: Date;
  message: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  context?: Record<string, any>;
}

export interface TestResult {
  success: boolean;
  message?: string;
  screenshot?: string;
  debugInfo?: DebugInfo[];
  performance?: {
    loadTime: number;
    domReady: number;
    networkIdle: number;
  };
}