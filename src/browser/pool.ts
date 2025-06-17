import puppeteer, { Browser } from 'puppeteer';
import { createPool, Pool } from 'generic-pool';
import { BrowserInstance, BrowserPoolConfig } from '../core/types.js';
import { serverConfig, browserPoolConfig } from '../core/config.js';
import { v4 as uuidv4 } from 'uuid';

export class BrowserPool {
  private pool: Pool<BrowserInstance>;
  private instances: Map<string, BrowserInstance> = new Map();

  constructor(config: BrowserPoolConfig = browserPoolConfig) {
    this.pool = createPool({
      create: async (): Promise<BrowserInstance> => {
        const browser = await puppeteer.launch({
          headless: serverConfig.headless,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
          ],
        });

        const instance: BrowserInstance = {
          browser,
          id: uuidv4(),
          created: new Date(),
          lastUsed: new Date(),
          activePages: 0,
        };

        this.instances.set(instance.id, instance);
        return instance;
      },
      destroy: async (instance: BrowserInstance): Promise<void> => {
        try {
          await instance.browser.close();
          this.instances.delete(instance.id);
        } catch (error) {
          console.error('Error closing browser instance:', error);
        }
      },
      validate: async (instance: BrowserInstance): Promise<boolean> => {
        try {
          const pages = await instance.browser.pages();
          return instance.browser.isConnected() && pages.length >= 0;
        } catch {
          return false;
        }
      },
    }, config);
  }

  async acquire(): Promise<BrowserInstance> {
    const instance = await this.pool.acquire();
    instance.lastUsed = new Date();
    return instance;
  }

  async release(instance: BrowserInstance): Promise<void> {
    instance.lastUsed = new Date();
    await this.pool.release(instance);
  }

  async createPage(instance: BrowserInstance) {
    const page = await instance.browser.newPage();
    instance.activePages++;

    // Set default viewport
    await page.setViewport({
      width: 1280,
      height: 720,
      deviceScaleFactor: 1,
    });

    // Enable console logging if debug mode is on
    if (serverConfig.debugConsoleLogs) {
      page.on('console', (msg) => {
        console.log(`[Browser Console ${instance.id}]:`, msg.text());
      });

      page.on('pageerror', (error) => {
        console.error(`[Browser Error ${instance.id}]:`, error.message);
      });
    }

    return page;
  }

  async closePage(instance: BrowserInstance, page: any): Promise<void> {
    try {
      await page.close();
      instance.activePages = Math.max(0, instance.activePages - 1);
    } catch (error) {
      console.error('Error closing page:', error);
    }
  }

  getStats() {
    return {
      size: this.pool.size,
      available: this.pool.available,
      borrowed: this.pool.borrowed,
      pending: this.pool.pending,
      instances: Array.from(this.instances.values()).map(instance => ({
        id: instance.id,
        created: instance.created,
        lastUsed: instance.lastUsed,
        activePages: instance.activePages,
      })),
    };
  }

  async drain(): Promise<void> {
    await this.pool.drain();
    await this.pool.clear();
  }
}