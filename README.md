# Puppeteer MCP Server for Laravel Herd

A Model Context Protocol (MCP) server specifically designed for Laravel Herd local development testing, enabling Claude to automate browser testing of Laravel applications using Puppeteer.

## Overview

This MCP server bridges the gap between AI-powered automation and modern Laravel development by providing deep integration with Laravel Herd's native performance environment. It enables Claude to perform sophisticated browser testing through visual debugging, automated interactions, and comprehensive test automation.

## Key Features

### Core Browser Automation
- **Visual Debugging**: Output debug information directly on web pages for Claude analysis
- **Interactive Testing**: Perform clicks, scrolls, and JavaScript execution for comprehensive testing
- **Screenshot Analysis**: Capture and analyze page states for iterative debugging
- **Element Interaction**: Advanced element selection using CSS selectors and accessibility attributes

### Laravel Herd Integration
- **Native .test Domain Support**: Automatic domain resolution through Herd's dnsmasq
- **SSL Certificate Management**: Seamless HTTPS testing with auto-generated certificates
- **PHP Version Management**: Site-specific PHP version support via Herd proxy commands
- **Database State Management**: Isolated test databases for parallel execution

### Advanced Capabilities
- **Browser Pool Management**: Efficient connection pooling with 5-10 browser instances
- **Context Isolation**: Independent test execution through separate browser contexts
- **Performance Monitoring**: Chrome DevTools Protocol integration for metrics collection
- **Network Interception**: API mocking and request/response analysis

## Architecture

### Transport Model
- **Hybrid Architecture**: stdio for local development, HTTP+SSE for remote access
- **JSON-RPC 2.0**: Standard MCP protocol implementation with OAuth 2.1 authentication
- **Connection Pooling**: Optimized browser instance management (100-200MB per instance)

### Security Features
- **OAuth 2.1 Compliance**: PKCE support for HTTP transport
- **Environment-based Authentication**: Secure local development access
- **Input Validation**: Injection attack prevention with testing flexibility
- **Granular Permissions**: Scoped access control for team environments

### Performance Targets
- **Response Times**: p95 <200ms for optimal Claude interaction
- **Memory Efficiency**: 100-200MB per browser instance with automatic cleanup
- **Parallel Execution**: Support for multiple concurrent Laravel projects
- **Scalability**: Horizontal scaling through distributed browser pools

## Laravel Testing Integration

### Framework Compatibility
- **Laravel Dusk API**: Compatible patterns for seamless migration
- **PHPUnit & Pest**: Integration with existing testing frameworks
- **ChromeDriver Management**: Handled automatically by Herd
- **Authentication Helpers**: Laravel-specific login and session management

### Development Environment Features
- **Automatic Configuration**: Test environment setup with zero configuration
- **Database Seeding**: Support for test data management and rollback
- **Middleware Testing**: Session, authentication, and authorization testing
- **API Validation**: Comprehensive backend API testing capabilities

## Development Approach

This project is optimized for iterative debugging with Claude Code:

### Visual Debugging Strategy
- Output debug information directly on web pages instead of console logging
- Use Puppeteer to capture screenshots for Claude analysis
- Implement page-based debugging information display
- Enable real-time visual feedback for test iterations

### Interactive Testing Methods
- Execute JavaScript functions directly on pages
- Perform automated clicks, scrolls, and form interactions
- Capture and analyze user interaction flows
- Support complex multi-step testing scenarios

### Error Handling & Recovery
- **Intelligent Classification**: Network, timeout, and element-based error categorization
- **Retry Mechanisms**: Exponential backoff for recoverable failures
- **Comprehensive Logging**: Screenshots, console logs, and network activity capture
- **Performance Metrics**: Detailed failure analysis with Chrome DevTools integration

## Use Cases

### Frontend Development
- **Responsive Design Testing**: Multi-device and viewport testing
- **Component Interaction**: React/Vue component behavior validation
- **CSS Regression Testing**: Visual diff analysis for UI changes
- **Performance Optimization**: Core Web Vitals monitoring and analysis

### Backend Development
- **API Endpoint Validation**: Request/response testing with network interception
- **Authentication Flows**: Complete login/logout and session management testing
- **Database Integration**: Model relationships and data consistency validation
- **Middleware Testing**: Security and authorization layer verification

### Quality Assurance
- **End-to-End Testing**: Complete user journey automation
- **Cross-browser Compatibility**: Multi-browser testing support
- **Load Testing**: Performance under various user scenarios
- **Accessibility Testing**: WCAG compliance validation

## Technical Specifications

### Browser Management
- **Instance Pooling**: 5-10 configurable browser instances
- **Memory Management**: Automatic cleanup and restart mechanisms
- **Timeout Strategies**: Hierarchical timeout configuration
- **Context Isolation**: Independent test environments

### Laravel Herd Optimization
- **Directory Integration**: Native ~/Herd directory support
- **Domain Resolution**: Automatic .test domain handling
- **SSL Support**: Seamless HTTPS testing with Herd certificates
- **PHP Version Awareness**: Site-specific PHP environment detection

### Future Roadmap

#### Phase 1: Core Implementation
- Basic browser automation with Laravel Dusk compatibility
- Screenshot capture and visual debugging
- Laravel authentication helpers
- Database state management

#### Phase 2: Herd Optimization
- Native domain resolution integration
- SSL certificate automation
- PHP version-specific testing
- Performance optimization

#### Phase 3: Advanced Features
- Visual regression testing with jest-image-snapshot
- Parallel test orchestration
- AI-driven test generation
- Team collaboration features

## Competitive Advantages

- **Laravel-Specific**: Deep integration with Laravel ecosystem and Herd environment
- **AI-Optimized**: Designed specifically for Claude Code iterative debugging workflows
- **Performance-First**: 35% faster test execution compared to containerized solutions
- **Visual Debugging**: Screenshot-based debugging optimized for AI analysis
- **Zero Configuration**: Automatic setup with Laravel Herd integration

## Installation

### Prerequisites
- Node.js 18+ with npm
- Laravel Herd (for local development)
- Chrome/Chromium browser

### Setup
```bash
# Clone the repository
git clone <repository-url>
cd puppeteer-mcp-server

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env to match your Laravel Herd setup

# Start the MCP server
npm start
```

### Laravel Herd Configuration
```bash
# Ensure Herd is running
herd start

# Secure your sites for HTTPS testing (optional)
herd secure your-site.test

# Verify PHP version for specific sites
herd php -v --site=your-site.test
```

## Usage

### Basic Browser Automation
```javascript
// Navigate to a Laravel application
await page.goto('https://your-app.test');

// Interact with forms
await page.fill('#email', 'user@example.com');
await page.click('button[type="submit"]');

// Capture screenshots for debugging
await page.screenshot({ path: 'debug.png' });
```

### Laravel-Specific Features
```javascript
// Authentication testing
await laravelAuth.loginAs('user@example.com');
await laravelAuth.actingAs(userId);

// Database state management
await laravelDb.seed('UserSeeder');
await laravelDb.rollback();
```

### Visual Debugging with Claude
```javascript
// Output debug information on page
await page.evaluate(() => {
  document.body.innerHTML += `
    <div style="position:fixed;top:0;right:0;background:red;color:white;padding:10px;z-index:9999">
      Debug: Current user ID = ${window.currentUserId}
    </div>
  `;
});

// Capture for Claude analysis
const screenshot = await page.screenshot();
// Screenshot is automatically sent to Claude for analysis
```

## Configuration

### Environment Variables
```env
# Browser settings
BROWSER_POOL_SIZE=5
BROWSER_TIMEOUT=30000
HEADLESS=true

# Laravel Herd integration
HERD_DIRECTORY=~/Herd
DEFAULT_DOMAIN_SUFFIX=.test
SSL_ENABLED=true

# MCP server settings
MCP_TRANSPORT=stdio
MCP_PORT=3000
MCP_AUTH_ENABLED=false
```

### Browser Pool Configuration
```json
{
  "browserPool": {
    "min": 2,
    "max": 10,
    "acquireTimeoutMillis": 30000,
    "createTimeoutMillis": 30000,
    "destroyTimeoutMillis": 5000,
    "idleTimeoutMillis": 300000,
    "reapIntervalMillis": 1000,
    "createRetryIntervalMillis": 200
  }
}
```

## API Reference

### Core Tools

#### `navigate(url, options)`
Navigate to a URL with Laravel Herd domain resolution.

#### `screenshot(options)`
Capture page screenshot optimized for Claude analysis.

#### `interact(selector, action, value)`
Perform user interactions (click, type, scroll).

#### `execute(script)`
Execute JavaScript in the browser context.

#### `waitFor(selector, options)`
Wait for elements with intelligent timeout handling.

### Laravel Integration Tools

#### `laravelAuth.loginAs(email)`
Authenticate as a specific user.

#### `laravelDb.seed(seeder)`
Run database seeders for test data.

#### `laravelRoute.visit(routeName, params)`
Navigate using Laravel route names.

## Contributing

### Development Setup
```bash
# Install development dependencies
npm install --dev

# Run tests
npm test

# Run linting
npm run lint

# Start development server with hot reload
npm run dev
```

### Code Standards
- Follow Laravel coding conventions
- Use TypeScript for type safety
- Implement comprehensive error handling
- Include visual debugging capabilities
- Maintain screenshot-based testing patterns

### Testing
```bash
# Run unit tests
npm run test:unit

# Run integration tests with Laravel Herd
npm run test:integration

# Run visual regression tests
npm run test:visual
```

This MCP server represents the convergence of AI-powered automation and modern Laravel development environments, enabling more intelligent, efficient, and reliable testing workflows that adapt to the evolving needs of web development.