# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Puppeteer MCP (Model Context Protocol) server specifically designed for Laravel Herd local development testing. The project enables Claude to automate browser testing of Laravel applications using Puppeteer through the MCP protocol.

## Development Approach

This project is optimized for iterative debugging with Claude Code:
- Use visual debugging by outputting debug info directly on web pages
- Take screenshots with Puppeteer to send back to Claude for analysis
- Perform browser interactions (clicks, scrolls, JS execution) for testing
- Avoid console debugging as it doesn't work effectively with Claude Code

## Architecture Goals

Based on the research documentation, the server should implement:
- **Hybrid transport model**: stdio for local development, HTTP+SSE for remote access
- **Browser pool management**: 5-10 browser instances with connection pooling
- **Laravel Herd integration**: native support for .test domains, automatic SSL, PHP version management
- **Context isolation**: test independence through separate browser contexts
- **Laravel-specific features**: authentication helpers, database state management, Dusk API compatibility

## Key Integration Points

- **Laravel Herd environment**: assumes Herd is running locally with sites in `~/Herd`
- **Domain resolution**: automatic .test domain handling via Herd's dnsmasq
- **PHP versions**: site-specific PHP version support through Herd proxy commands
- **SSL certificates**: automatic HTTPS via `herd secure` command
- **Database management**: isolated test databases for parallel execution

## Performance Targets

- p95 response times <200ms
- 100-200MB memory per browser instance
- Support for parallel test execution across multiple Laravel projects
- Automatic cleanup and restart mechanisms for browser instances

## Security Requirements

- OAuth 2.1 compliance for HTTP transport
- Environment-based authentication for local development
- Input validation to prevent injection attacks
- Granular permission scoping

## Laravel Testing Integration

The server should provide compatibility with:
- Laravel Dusk API patterns
- PHPUnit and Pest testing frameworks
- ChromeDriver management (handled by Herd)
- Authentication testing helpers
- Database seeding and rollback capabilities