#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { exec } = require('child_process');

const execAsync = promisify(exec);
const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);

// Configuration des packages à analyser
const packages = [
  { name: '@autoweave/core', path: 'packages/core/dist', limit: 400 },
  { name: '@autoweave/agents', path: 'packages/agents/dist', limit: 200 },
  { name: '@autoweave/backend', path: 'packages/backend/dist', limit: 300 },
  { name: '@autoweave/memory', path: 'packages/memory/dist', limit: 250 },
  { name: '@autoweave/integrations', path: 'packages/integrations/dist', limit: 200 },
  { name: '@autoweave/observability', path: 'packages/observability/dist', limit: 150 },
  { name: '@autoweave/plugin-loader', path: 'packages/plugin-loader/dist', limit: 100 },
  { name: '@autoweave/usb-daemon', path: 'packages/usb-daemon/dist', limit: 200 },
  { name: '@autoweave/queue', path: 'packages/queue/dist', limit: 50 },
  { name: '@autoweave/auth', path: 'packages/auth/dist', limit: 20 },
  { name: '@autoweave/auto-debugger', path: 'packages/auto-debugger/dist', limit: 150 },
];

async function getFileSize(filePath) {
  try {
    const stats = await stat(filePath);
    return stats.size;
  } catch (error) {
    return null;
  }
}

async function getGzipSize(filePath) {
  try {
    const { stdout } = await execAsync(`gzip -c ${filePath} | wc -c`);
    return parseInt(stdout.trim());
  } catch (error) {
    return null;
  }
}

function formatSize(bytes) {
  if (!bytes) return 'N/A';
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(2)} KB`;
  }
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

function getStatusEmoji(size, limit) {
  if (!size) return '❓';
  const kb = size / 1024;
  if (kb <= limit) return '✅';
  if (kb <= limit * 1.1) return '⚠️';
  return '❌';
}

async function analyzeBundle() {
  console.log('🔍 Analyzing bundle sizes...\n');
  console.log('Package                        | Size       | Gzipped    | Limit      | Status');
  console.log('-------------------------------|------------|------------|------------|-------');

  let totalSize = 0;
  let totalGzipSize = 0;
  let failedPackages = [];

  for (const pkg of packages) {
    const jsPath = path.join(pkg.path, 'index.js');
    const mjsPath = path.join(pkg.path, 'index.mjs');
    
    // Try both .js and .mjs
    let size = await getFileSize(jsPath);
    let gzipSize = await getGzipSize(jsPath);
    let filePath = jsPath;
    
    if (!size) {
      size = await getFileSize(mjsPath);
      gzipSize = await getGzipSize(mjsPath);
      filePath = mjsPath;
    }

    const status = getStatusEmoji(size, pkg.limit * 1024);
    
    console.log(
      `${pkg.name.padEnd(30)} | ${formatSize(size).padEnd(10)} | ${formatSize(gzipSize).padEnd(10)} | ${(pkg.limit + ' KB').padEnd(10)} | ${status}`
    );

    if (size) {
      totalSize += size;
      if (gzipSize) totalGzipSize += gzipSize;
      
      if (size > pkg.limit * 1024) {
        failedPackages.push({
          name: pkg.name,
          size: formatSize(size),
          limit: `${pkg.limit} KB`,
          exceeded: formatSize(size - pkg.limit * 1024)
        });
      }
    }
  }

  console.log('-------------------------------|------------|------------|------------|-------');
  console.log(`${'TOTAL'.padEnd(30)} | ${formatSize(totalSize).padEnd(10)} | ${formatSize(totalGzipSize).padEnd(10)} |            |`);

  console.log('\n📊 Summary:');
  console.log(`   Total size: ${formatSize(totalSize)}`);
  console.log(`   Total gzipped: ${formatSize(totalGzipSize)}`);
  console.log(`   Compression ratio: ${((1 - totalGzipSize / totalSize) * 100).toFixed(1)}%`);

  if (failedPackages.length > 0) {
    console.log('\n❌ Packages exceeding size limits:');
    failedPackages.forEach(pkg => {
      console.log(`   - ${pkg.name}: ${pkg.size} (limit: ${pkg.limit}, exceeded by: ${pkg.exceeded})`);
    });
    process.exit(1);
  } else {
    console.log('\n✅ All packages within size limits!');
  }
}

// Run the analysis
analyzeBundle().catch(error => {
  console.error('Error analyzing bundles:', error);
  process.exit(1);
});