#!/usr/bin/env node

import { spawn } from 'child_process';
import { readFileSync } from 'fs';

class MCPTester {
  constructor() {
    this.server = null;
    this.messageId = 1;
  }

  async start() {
    console.log('Starting MCP server...');
    
    this.server = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    this.server.stderr.on('data', (data) => {
      console.log('Server stderr:', data.toString());
    });

    this.server.on('error', (error) => {
      console.error('Server error:', error);
    });

    this.server.on('exit', (code) => {
      console.log('Server exited with code:', code);
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  async sendRequest(method, params = {}) {
    const message = {
      jsonrpc: '2.0',
      id: this.messageId++,
      method,
      params
    };

    console.log('Sending request:', JSON.stringify(message, null, 2));
    
    return new Promise((resolve, reject) => {
      let responseData = '';
      
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 10000);

      const onData = (data) => {
        responseData += data.toString();
        
        // Check if we have a complete JSON response
        try {
          const lines = responseData.split('\n').filter(line => line.trim());
          for (const line of lines) {
            if (line.trim()) {
              const response = JSON.parse(line);
              if (response.id === message.id) {
                clearTimeout(timeout);
                this.server.stdout.removeListener('data', onData);
                resolve(response);
                return;
              }
            }
          }
        } catch (e) {
          // Not a complete JSON yet, continue reading
        }
      };

      this.server.stdout.on('data', onData);
      this.server.stdin.write(JSON.stringify(message) + '\n');
    });
  }

  async initialize() {
    console.log('\\n=== Initializing MCP Server ===');
    
    try {
      const response = await this.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {
          roots: {
            listChanged: true
          },
          sampling: {}
        },
        clientInfo: {
          name: 'puppeteer-mcp-tester',
          version: '1.0.0'
        }
      });
      
      console.log('Initialize response:', JSON.stringify(response, null, 2));
      return response;
    } catch (error) {
      console.error('Initialize failed:', error);
      throw error;
    }
  }

  async listTools() {
    console.log('\\n=== Listing Tools ===');
    
    try {
      const response = await this.sendRequest('tools/list');
      console.log('Tools response:', JSON.stringify(response, null, 2));
      return response;
    } catch (error) {
      console.error('List tools failed:', error);
      throw error;
    }
  }

  async createSession() {
    console.log('\\n=== Creating Session ===');
    
    try {
      const response = await this.sendRequest('tools/call', {
        name: 'create_session',
        arguments: {
          sessionId: 'test-session'
        }
      });
      
      console.log('Create session response:', JSON.stringify(response, null, 2));
      return response;
    } catch (error) {
      console.error('Create session failed:', error);
      throw error;
    }
  }

  async getPoolStats() {
    console.log('\\n=== Getting Pool Stats ===');
    
    try {
      const response = await this.sendRequest('tools/call', {
        name: 'get_pool_stats',
        arguments: {}
      });
      
      console.log('Pool stats response:', JSON.stringify(response, null, 2));
      return response;
    } catch (error) {
      console.error('Get pool stats failed:', error);
      throw error;
    }
  }

  async navigate() {
    console.log('\\n=== Testing Navigation ===');
    
    try {
      const response = await this.sendRequest('tools/call', {
        name: 'navigate',
        arguments: {
          sessionId: 'test-session',
          url: 'https://example.com',
          waitUntil: 'networkidle2'
        }
      });
      
      console.log('Navigate response:', JSON.stringify(response, null, 2));
      return response;
    } catch (error) {
      console.error('Navigate failed:', error);
      throw error;
    }
  }

  async takeScreenshot() {
    console.log('\\n=== Taking Screenshot ===');
    
    try {
      const response = await this.sendRequest('tools/call', {
        name: 'screenshot',
        arguments: {
          sessionId: 'test-session',
          fullPage: true,
          type: 'png'
        }
      });
      
      console.log('Screenshot response:', JSON.stringify(response, null, 2));
      return response;
    } catch (error) {
      console.error('Screenshot failed:', error);
      throw error;
    }
  }

  async cleanup() {
    console.log('\\n=== Cleaning Up ===');
    
    try {
      const response = await this.sendRequest('tools/call', {
        name: 'destroy_session',
        arguments: {
          sessionId: 'test-session'
        }
      });
      
      console.log('Cleanup response:', JSON.stringify(response, null, 2));
      return response;
    } catch (error) {
      console.error('Cleanup failed:', error);
      throw error;
    }
  }

  async stop() {
    console.log('\\nStopping server...');
    if (this.server) {
      this.server.kill();
    }
  }

  async runTests() {
    try {
      await this.start();
      await this.initialize();
      await this.listTools();
      await this.createSession();
      await this.getPoolStats();
      await this.navigate();
      await this.takeScreenshot();
      await this.cleanup();
      
      console.log('\\n✅ All tests completed successfully!');
    } catch (error) {
      console.error('\\n❌ Test failed:', error);
      process.exit(1);
    } finally {
      await this.stop();
    }
  }
}

const tester = new MCPTester();
tester.runTests().catch(console.error);