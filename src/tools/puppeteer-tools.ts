import { Page } from 'puppeteer';
import { BrowserInstance, NavigationOptions, ScreenshotOptions, InteractionOptions, WaitForOptions, DebugInfo } from '../core/types.js';
import { serverConfig } from '../core/config.js';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join, resolve, sep } from 'path';

export class PuppeteerTools {
  private debugInfo: DebugInfo[] = [];

  constructor(private instance: BrowserInstance, private page: Page) {}

  private addDebugInfo(message: string, level: 'info' | 'warn' | 'error' | 'debug' = 'info', context?: Record<string, any>) {
    this.debugInfo.push({
      timestamp: new Date(),
      message,
      level,
      context,
    });
  }

  private async addVisualDebug(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
    if (!serverConfig.visualDebug) return;

    const colors = {
      info: '#2196F3',
      success: '#4CAF50',
      warning: '#FF9800',
      error: '#F44336',
    };

    await this.page.evaluate((debugMessage, color) => {
      const debugContainer = document.getElementById('claude-debug-container') || (() => {
        const container = document.createElement('div');
        container.id = 'claude-debug-container';
        container.style.cssText = `
          position: fixed;
          top: 10px;
          right: 10px;
          max-width: 300px;
          z-index: 999999;
          font-family: monospace;
          font-size: 12px;
        `;
        document.body.appendChild(container);
        return container;
      })();

      const debugElement = document.createElement('div');
      debugElement.style.cssText = `
        background: ${color};
        color: white;
        padding: 8px;
        margin: 2px 0;
        border-radius: 4px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        opacity: 0.9;
      `;
      debugElement.textContent = `${new Date().toLocaleTimeString()}: ${debugMessage}`;
      
      debugContainer.insertBefore(debugElement, debugContainer.firstChild);
      
      // Keep only last 5 debug messages
      while (debugContainer.children.length > 5) {
        debugContainer.removeChild(debugContainer.lastChild!);
      }
    }, message, colors[type]);
  }

  async navigate(url: string, options: NavigationOptions = {}): Promise<void> {
    this.addDebugInfo(`Navigating to: ${url}`, 'info', { url, options });
    await this.addVisualDebug(`Navigating to: ${url}`, 'info');

    try {
      // Handle Laravel Herd domain resolution
      if (!url.startsWith('http')) {
        url = `${serverConfig.sslEnabled ? 'https' : 'http'}://${url}${serverConfig.defaultDomainSuffix}`;
      }

      if (options.viewport) {
        await this.page.setViewport(options.viewport);
      }

      await this.page.goto(url, {
        waitUntil: options.waitUntil || 'networkidle2',
        timeout: options.timeout || serverConfig.browserTimeout,
      });

      this.addDebugInfo(`Successfully navigated to: ${url}`, 'info');
      await this.addVisualDebug(`Navigation complete: ${url}`, 'success');
    } catch (error) {
      this.addDebugInfo(`Navigation failed: ${error}`, 'error', { url, error });
      await this.addVisualDebug(`Navigation failed: ${error}`, 'error');
      throw error;
    }
  }

  async screenshot(options: ScreenshotOptions = {}): Promise<string> {
    this.addDebugInfo('Taking screenshot', 'info', options);
    await this.addVisualDebug('Taking screenshot', 'info');

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = options.path || `screenshot-${timestamp}.png`;
      const screenshotDir = join(process.cwd(), 'screenshots');
      const filepath = resolve(screenshotDir, filename);
      if (!filepath.startsWith(screenshotDir + sep)) {
        throw new Error(`Screenshot path must stay inside ${screenshotDir}: ${filename}`);
      }

      const screenshotBuffer = await this.page.screenshot({
        type: options.type || 'png',
        quality: options.quality,
        fullPage: options.fullPage !== false,
        clip: options.clip,
      });

      mkdirSync(dirname(filepath), { recursive: true });
      writeFileSync(filepath, screenshotBuffer);
      
      this.addDebugInfo(`Screenshot saved: ${filepath}`, 'info');
      await this.addVisualDebug('Screenshot captured', 'success');
      
      return filepath;
    } catch (error) {
      this.addDebugInfo(`Screenshot failed: ${error}`, 'error', { error });
      await this.addVisualDebug(`Screenshot failed: ${error}`, 'error');
      throw error;
    }
  }

  async interact(selector: string, action: 'click' | 'type' | 'select' | 'scroll', value?: string, options: InteractionOptions = {}): Promise<void> {
    this.addDebugInfo(`Interacting: ${action} on ${selector}`, 'info', { selector, action, value, options });
    await this.addVisualDebug(`${action} on ${selector}`, 'info');

    try {
      const element = await this.page.waitForSelector(selector, {
        timeout: options.timeout || 10000,
        visible: true,
      });

      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }

      switch (action) {
        case 'click':
          await element.click();
          break;
        case 'type':
          if (value === undefined) {
            throw new Error('Value required for type action');
          }
          await element.type(value);
          break;
        case 'select':
          if (value === undefined) {
            throw new Error('Value required for select action');
          }
          await this.page.select(selector, value);
          break;
        case 'scroll':
          await element.scrollIntoView();
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      this.addDebugInfo(`Successfully performed ${action} on ${selector}`, 'info');
      await this.addVisualDebug(`${action} completed`, 'success');
    } catch (error) {
      this.addDebugInfo(`Interaction failed: ${error}`, 'error', { selector, action, error });
      await this.addVisualDebug(`${action} failed: ${error}`, 'error');
      throw error;
    }
  }

  async execute(script: string, ...args: any[]): Promise<any> {
    this.addDebugInfo('Executing JavaScript', 'info', { script: script.substring(0, 100) + '...' });
    await this.addVisualDebug('Executing JavaScript', 'info');

    try {
      const result = await this.page.evaluate(script, ...args);
      this.addDebugInfo('JavaScript executed successfully', 'info');
      await this.addVisualDebug('JavaScript executed', 'success');
      return result;
    } catch (error) {
      this.addDebugInfo(`JavaScript execution failed: ${error}`, 'error', { script, error });
      await this.addVisualDebug(`JavaScript failed: ${error}`, 'error');
      throw error;
    }
  }

  async waitFor(selector: string, options: WaitForOptions = {}): Promise<void> {
    this.addDebugInfo(`Waiting for: ${selector}`, 'info', { selector, options });
    await this.addVisualDebug(`Waiting for: ${selector}`, 'info');

    try {
      await this.page.waitForSelector(selector, {
        timeout: options.timeout || 10000,
        visible: options.visible,
        hidden: options.hidden,
      });

      this.addDebugInfo(`Element found: ${selector}`, 'info');
      await this.addVisualDebug(`Element ready: ${selector}`, 'success');
    } catch (error) {
      this.addDebugInfo(`Wait failed: ${error}`, 'error', { selector, error });
      await this.addVisualDebug(`Wait timeout: ${selector}`, 'error');
      throw error;
    }
  }

  async getPageInfo() {
    const title = await this.page.title();
    const url = this.page.url();
    const viewport = this.page.viewport();
    
    return {
      title,
      url,
      viewport,
      debugInfo: this.debugInfo,
      timestamp: new Date(),
    };
  }

  getDebugInfo(): DebugInfo[] {
    return [...this.debugInfo];
  }

  clearDebugInfo(): void {
    this.debugInfo = [];
  }
}