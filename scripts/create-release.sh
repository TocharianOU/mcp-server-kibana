#!/bin/bash
set -e

# 从 package.json 读取版本号
VERSION=$(node -p "require('./package.json').version")
RELEASE_NAME="mcp-server-kibana-v${VERSION}"
RELEASE_DIR="release-tmp"
TARBALL="${RELEASE_NAME}.tar.gz"

echo "📦 Creating release package for version ${VERSION}..."

# 清理旧的临时目录和 tarball
rm -rf "${RELEASE_DIR}"
rm -f "${TARBALL}"

# 创建临时目录
mkdir -p "${RELEASE_DIR}"

echo "🔨 Building project..."
npm run build

echo "📋 Copying files..."
# 复制必要的文件
cp -r dist "${RELEASE_DIR}/"
cp -r logos "${RELEASE_DIR}/"
cp package.json "${RELEASE_DIR}/"
cp package-lock.json "${RELEASE_DIR}/"
cp LICENSE "${RELEASE_DIR}/"
cp README.md "${RELEASE_DIR}/"
cp kibana-openapi-source.yaml "${RELEASE_DIR}/"

# 复制 NOTICE（如果存在）
if [ -f "NOTICE" ]; then
  cp NOTICE "${RELEASE_DIR}/"
fi

# 复制 server.json（如果存在）
if [ -f "server.json" ]; then
  cp server.json "${RELEASE_DIR}/"
fi

echo "📥 Installing production dependencies..."
cd "${RELEASE_DIR}"
npm install --production --no-optional

echo "🧹 Cleaning up unnecessary files..."
# 删除不必要的文件
find node_modules -name "*.md" -type f -delete
find node_modules -name "*.txt" -type f -delete
find node_modules -name "LICENSE*" -type f -delete
find node_modules -name ".npmignore" -type f -delete
find node_modules -name ".gitignore" -type f -delete
find node_modules -type d -name "test" -exec rm -rf {} + 2>/dev/null || true
find node_modules -type d -name "tests" -exec rm -rf {} + 2>/dev/null || true
find node_modules -type d -name "docs" -exec rm -rf {} + 2>/dev/null || true
find node_modules -type d -name "examples" -exec rm -rf {} + 2>/dev/null || true

cd ..

echo "📦 Creating tarball..."
# 打包时使用 transform 确保解压后目录结构扁平
tar -czf "${TARBALL}" -C "${RELEASE_DIR}" .

echo "🧹 Cleaning up temporary directory..."
rm -rf "${RELEASE_DIR}"

echo "🔐 Generating checksums..."
# 生成 SHA256 校验和
shasum -a 256 "${TARBALL}" > "${TARBALL}.sha256"
echo "  ✓ SHA256: ${TARBALL}.sha256"

# 生成 SHA512 校验和
shasum -a 512 "${TARBALL}" > "${TARBALL}.sha512"
echo "  ✓ SHA512: ${TARBALL}.sha512"

# 显示校验和
echo ""
echo "📋 Checksums:"
echo "SHA256:"
cat "${TARBALL}.sha256"
echo ""
echo "SHA512:"
cat "${TARBALL}.sha512"

echo ""
echo "✅ Release package created: ${TARBALL}"
echo ""
echo "📊 Package size:"
ls -lh "${TARBALL}"
echo ""
echo "📦 Release files:"
ls -lh "${TARBALL}"*
echo ""
echo "🎯 To test the package:"
echo "  mkdir test-release && cd test-release"
echo "  tar -xzf ../${TARBALL}"
echo "  node dist/index.js"
echo ""
echo "🔐 To verify checksum:"
echo "  shasum -a 256 -c ${TARBALL}.sha256"
echo "  shasum -a 512 -c ${TARBALL}.sha512"
