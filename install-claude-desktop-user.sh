#!/bin/bash

# User-specific installation script for Claude Desktop compatibility
# No sudo required - installs to user's local bin directory

USER_BIN_DIR="$HOME/.local/bin"
WRAPPER_PATH="$USER_BIN_DIR/puppeteer-laravel-mcp-claude"

echo "Installing Puppeteer Laravel MCP wrapper for Claude Desktop..."

# Create user bin directory if it doesn't exist
mkdir -p "$USER_BIN_DIR"

# Create the wrapper script
cat > "$WRAPPER_PATH" << 'EOF'
#!/bin/bash
# Wrapper script for Claude Desktop compatibility
# Bypasses Claude Desktop's npx argument parsing issues
exec npx -y @truefrontier/puppeteer-laravel-mcp-server
EOF

# Make it executable
chmod +x "$WRAPPER_PATH"

# Add to PATH if not already there
if [[ ":$PATH:" != *":$USER_BIN_DIR:"* ]]; then
    echo ""
    echo "⚠️  Add $USER_BIN_DIR to your PATH by adding this to your shell profile:"
    echo "export PATH=\"$USER_BIN_DIR:\$PATH\""
    echo ""
fi

echo "✅ Installation complete!"
echo ""
echo "Add this to your Claude Desktop configuration:"
echo ""
echo '{
  "mcpServers": {
    "puppeteer-laravel": {
      "command": "'$WRAPPER_PATH'"
    }
  }
}'
echo ""
echo "To uninstall: rm $WRAPPER_PATH"