#!/bin/bash

# Build script for MCP Server
# Compiles TypeScript and prepares distribution

set -e

echo "🔨 Building CDP Integuru MCP Server..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: package.json not found. Please run from mcp-server directory.${NC}"
    exit 1
fi

# Clean previous build
echo -e "${YELLOW}🧹 Cleaning previous build...${NC}"
rm -rf dist

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install

# Build TypeScript
echo -e "${YELLOW}🔧 Compiling TypeScript...${NC}"
npm run build

# Copy necessary files
echo -e "${YELLOW}📋 Copying additional files...${NC}"

# Copy source libraries
mkdir -p dist/src/lib
cp -r ../src/lib dist/src/

# Copy extensions
mkdir -p dist/extensions
cp -r ../extensions dist/

# Copy configuration files
if [ -f "mcp-config.json" ]; then
    cp mcp-config.json dist/
fi

# Copy scripts
mkdir -p dist/scripts
cp scripts/*.sh dist/scripts/ 2>/dev/null || true

# Create executable scripts
echo -e "${YELLOW}🔐 Making scripts executable...${NC}"
chmod +x dist/scripts/*.sh 2>/dev/null || true

# Generate version info
echo -e "${YELLOW}📝 Generating version info...${NC}"
NODE_ENV=production node -e "
const pkg = require('./package.json');
const fs = require('fs-extra');
const path = require('path');

const buildInfo = {
    name: pkg.name,
    version: pkg.version,
    buildTime: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch
};

fs.writeJsonSync(path.join(__dirname, 'build-info.json'), buildInfo, { spaces: 2 });
console.log('✅ Build info generated');
"

# Create distribution package
echo -e "${YELLOW}📦 Creating distribution package...${NC}"
cd dist
npm pack --pack-destination ../dist-packages
cd ..

echo -e "${GREEN}✅ Build completed successfully!${NC}"
echo -e "${GREEN}📁 Distribution package: dist-packages/${PWD##*/}-mcp-server-${npm pkg get version}.tgz${NC}"

# Show build summary
echo ""
echo -e "${GREEN}📊 Build Summary:${NC}"
echo -e "  ${GREEN}✓${NC} TypeScript compilation"
echo -e "  ${GREEN}✓${NC} Dependencies installed"
echo -e "  ${GREEN}✓${NC} Source files copied"
echo -e "  ${GREEN}✓${NC} Scripts made executable"
echo -e "  ${GREEN}✓${NC} Distribution package created"

# Check if MCP server can be imported
echo -e "${YELLOW}🔍 Verifying build...${NC}"
node -e "
try {
    require('./dist/server.js');
    console.log('✅ MCP server can be imported successfully');
} catch (error) {
    console.error('❌ MCP server import failed:', error.message);
    process.exit(1);
}
"

echo -e "${GREEN}🎉 Build verification passed!${NC}"