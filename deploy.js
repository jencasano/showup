const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const FILES = ['index.html', 'setup.html'];
const ASSET_ATTR_RE = /(\b(?:href|src)=)(["'])((?:css|js)\/[^"']+?)\2/g;

function getCommitHash() {
  return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
}

function bustCache(html, hash) {
  return html.replace(ASSET_ATTR_RE, (_match, attr, quote, value) => {
    const [pathPart, query = ''] = value.split('?');
    const params = new URLSearchParams(query);
    params.set('v', hash);
    return `${attr}${quote}${pathPart}?${params.toString()}${quote}`;
  });
}

const hash = getCommitHash();
const originals = {};

for (const file of FILES) {
  const filePath = path.join(__dirname, file);
  const content = fs.readFileSync(filePath, 'utf8');
  originals[file] = { path: filePath, content };
  fs.writeFileSync(filePath, bustCache(content, hash));
}

console.log(`Cache-busted ${FILES.join(', ')} with v=${hash}`);

function restore() {
  for (const { path: p, content } of Object.values(originals)) {
    try {
      fs.writeFileSync(p, content);
    } catch (err) {
      console.error(`Failed to restore ${p}:`, err.message);
    }
  }
  console.log('Restored original files');
}

process.on('SIGINT', () => {
  restore();
  process.exit(130);
});

let exitCode = 0;
try {
  const result = spawnSync('firebase', ['deploy'], { stdio: 'inherit', shell: true });
  exitCode = result.status ?? 1;
} catch (err) {
  console.error('firebase deploy failed:', err.message);
  exitCode = 1;
} finally {
  restore();
}

process.exit(exitCode);
