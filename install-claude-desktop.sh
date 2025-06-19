#!/bin/bash

# Installation script for Claude Desktop compatibility
# This creates a reliable wrapper that bypasses Claude Desktop's npx argument parsing issues

WRAPPER_PATH="/usr/local/bin/puppeteer-laravel-mcp-claude"

echo "Installing Puppeteer Laravel MCP wrapper for Claude Desktop..."

# Create the wrapper script
sudo tee "$WRAPPER_PATH" > /dev/null << 'EOF'
#!/bin/bash
# Wrapper script for Claude Desktop compatibility
# Bypasses Claude Desktop's npx argument parsing issues
exec npx -y @truefrontier/puppeteer-laravel-mcp-server
EOF

# Make it executable
sudo chmod +x "$WRAPPER_PATH"

echo "✅ Installation complete!"
echo ""
echo "Add this to your Claude Desktop configuration:"
echo ""
echo '{
  "mcpServers": {
    "puppeteer-laravel": {
      "command": "puppeteer-laravel-mcp-claude"
    }
  }
}'
echo ""
echo "To uninstall: sudo rm $WRAPPER_PATH"