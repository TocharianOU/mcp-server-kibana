# Release Commands for v0.7.3

## 📋 Changes in This Release
- Add SHA256/SHA512 hash verification to release script
- Update version to 0.7.3
- Remove all Chinese comments (use English only)
- Streamline README.md (remove code architecture details)

---

## 🚀 Complete Release Process

### Step 1: Build and Test
```bash
# Build the project
npm run build

# Test the build
npm test

# Optional: Test with inspector
npm run inspector
```

### Step 2: Create Release Package (with hash verification)
```bash
# Generate release tarball with SHA256/SHA512 checksums
npm run release

# This will create:
# - mcp-server-kibana-v0.7.3.tar.gz
# - mcp-server-kibana-v0.7.3.tar.gz.sha256
# - mcp-server-kibana-v0.7.3.tar.gz.sha512
```

### Step 3: Verify Release Package
```bash
# Verify SHA256 checksum
shasum -a 256 -c mcp-server-kibana-v0.7.3.tar.gz.sha256

# Verify SHA512 checksum
shasum -a 512 -c mcp-server-kibana-v0.7.3.tar.gz.sha512

# Test the release package
mkdir test-release && cd test-release
tar -xzf ../mcp-server-kibana-v0.7.3.tar.gz
node dist/index.js
cd .. && rm -rf test-release
```

### Step 4: Git Commit and Push
```bash
# Add all changes
git add .

# Commit with descriptive message
git commit -m "$(cat <<'EOF'
chore: release v0.7.3 - add hash verification and improvements

Major changes:
- Add SHA256/SHA512 hash generation to release script for package integrity verification
- Update all version numbers to 0.7.3
- Remove all Chinese comments from code (English only)
- Streamline README.md by removing code architecture details
- Improve release process with checksum validation

Release features:
- Generate SHA256 and SHA512 checksums for release tarball
- Provide verification commands in release output
- Maintain clean English-only codebase
- Simplified documentation for better user experience
EOF
)"

# Push to GitHub
git push origin main

# Create and push version tag
git tag -a v0.7.3 -m "Release v0.7.3: Hash verification and improvements"
git push origin v0.7.3
```

### Step 5: Publish to NPM
```bash
# Login to NPM (if not already logged in)
npm login

# Publish to NPM registry
npm publish

# Verify publication
npm view @tocharianou/mcp-server-kibana version
```

### Step 6: Publish to MCP Registry
```bash
# Make sure you have mcp CLI installed
# npm install -g @modelcontextprotocol/cli

# Publish to MCP registry
mcp publish

# Alternative: If using manual submission
# 1. Go to https://github.com/modelcontextprotocol/registry
# 2. Submit a PR with updated server.json
```

### Step 7: Create GitHub Release
```bash
# Using GitHub CLI (gh)
gh release create v0.7.3 \
  mcp-server-kibana-v0.7.3.tar.gz \
  mcp-server-kibana-v0.7.3.tar.gz.sha256 \
  mcp-server-kibana-v0.7.3.tar.gz.sha512 \
  --title "v0.7.3 - Hash Verification & Improvements" \
  --notes "$(cat <<'EOF'
## ✨ What's New

### Security & Integrity
- **Hash Verification**: Added SHA256 and SHA512 checksum generation for release packages
- Package integrity can now be verified with `shasum -a 256 -c` or `shasum -a 512 -c`

### Code Quality
- **English-Only Codebase**: Removed all Chinese comments, replaced with English
- **Cleaner Documentation**: Streamlined README by removing unnecessary technical details

### Release Process
- Enhanced release script with automatic hash generation
- Added verification commands in release output
- Improved package validation workflow

## 📦 Installation

\`\`\`bash
npm install -g @tocharianou/mcp-server-kibana@0.7.3
\`\`\`

## 🔐 Package Verification

\`\`\`bash
# Download the release tarball
wget https://github.com/TocharianOU/mcp-server-kibana/releases/download/v0.7.3/mcp-server-kibana-v0.7.3.tar.gz

# Download checksums
wget https://github.com/TocharianOU/mcp-server-kibana/releases/download/v0.7.3/mcp-server-kibana-v0.7.3.tar.gz.sha256
wget https://github.com/TocharianOU/mcp-server-kibana/releases/download/v0.7.3/mcp-server-kibana-v0.7.3.tar.gz.sha512

# Verify package integrity
shasum -a 256 -c mcp-server-kibana-v0.7.3.tar.gz.sha256
shasum -a 512 -c mcp-server-kibana-v0.7.3.tar.gz.sha512
\`\`\`

## 📖 Full Changelog

See [CHANGELOG.md](https://github.com/TocharianOU/mcp-server-kibana/blob/main/CHANGELOG.md)
EOF
)"

# Or manually create release on GitHub:
# https://github.com/TocharianOU/mcp-server-kibana/releases/new
```

---

## 📝 Quick Commands (Copy & Paste)

### All-in-One Release Command
```bash
# Complete release process
npm run build && \
npm run release && \
shasum -a 256 -c mcp-server-kibana-v0.7.3.tar.gz.sha256 && \
shasum -a 512 -c mcp-server-kibana-v0.7.3.tar.gz.sha512 && \
git add . && \
git commit -m "chore: release v0.7.3 - add hash verification and improvements" && \
git push origin main && \
git tag -a v0.7.3 -m "Release v0.7.3" && \
git push origin v0.7.3 && \
npm publish
```

### Verification Only
```bash
# Just verify checksums
shasum -a 256 -c mcp-server-kibana-v0.7.3.tar.gz.sha256
shasum -a 512 -c mcp-server-kibana-v0.7.3.tar.gz.sha512
```

---

## ✅ Post-Release Checklist

- [ ] Verify package on NPM: https://www.npmjs.com/package/@tocharianou/mcp-server-kibana
- [ ] Check GitHub release: https://github.com/TocharianOU/mcp-server-kibana/releases
- [ ] Test installation: `npx @tocharianou/mcp-server-kibana@0.7.3`
- [ ] Update MCP Registry (if needed)
- [ ] Announce release on social media/forums (optional)
- [ ] Update documentation links (if needed)

---

## 🔄 Rollback (if needed)

```bash
# Unpublish from NPM (within 72 hours)
npm unpublish @tocharianou/mcp-server-kibana@0.7.3

# Delete Git tag
git tag -d v0.7.3
git push origin :refs/tags/v0.7.3

# Delete GitHub release
gh release delete v0.7.3
```
