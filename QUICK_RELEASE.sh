#!/bin/bash
set -e

echo "🚀 Kibana MCP Server v0.7.3 Release Script"
echo "=========================================="
echo ""

# Step 1: Build
echo "📦 Step 1: Building project..."
npm run build
echo "✅ Build complete"
echo ""

# Step 2: Create release with hashes
echo "🔐 Step 2: Creating release package with checksums..."
npm run release
echo "✅ Release package created"
echo ""

# Step 3: Verify hashes
echo "🔍 Step 3: Verifying checksums..."
shasum -a 256 -c mcp-server-kibana-v0.7.3.tar.gz.sha256
shasum -a 512 -c mcp-server-kibana-v0.7.3.tar.gz.sha512
echo "✅ Checksums verified"
echo ""

# Step 4: Git operations
echo "📝 Step 4: Git commit and push..."
git add .
git commit -m "chore: release v0.7.3 - add hash verification and improvements

Major changes:
- Add SHA256/SHA512 hash generation for package integrity verification
- Update all version numbers to 0.7.3
- Remove all Chinese comments (English only)
- Streamline README.md documentation"

git push origin main
echo "✅ Changes pushed to GitHub"
echo ""

# Step 5: Create and push tag
echo "🏷️  Step 5: Creating version tag..."
git tag -a v0.7.3 -m "Release v0.7.3: Hash verification and improvements"
git push origin v0.7.3
echo "✅ Tag created and pushed"
echo ""

# Step 6: NPM publish
echo "📤 Step 6: Publishing to NPM..."
echo "⚠️  Running: npm publish"
echo "⚠️  Make sure you are logged in to NPM (npm login)"
npm publish
echo "✅ Published to NPM"
echo ""

echo "🎉 Release v0.7.3 Complete!"
echo ""
echo "📋 Next steps:"
echo "1. Create GitHub release with: gh release create v0.7.3"
echo "2. Publish to MCP registry: mcp publish"
echo "3. Verify: npm view @tocharianou/mcp-server-kibana version"
echo ""
echo "📦 Release files:"
ls -lh mcp-server-kibana-v0.7.3.tar.gz*
