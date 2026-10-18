'use strict';

// Read-only preflight for the installed official Codex extension.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = process.argv[2];
if (!root || process.argv.length !== 3) {
  console.error('Usage: node skills/official-codex-turn-patch/scripts/inspect-target.js <openai.chatgpt-extension-path>');
  process.exit(2);
}

const anchors = {
  webRef: 'qt=(0,Q.useRef)(null),[Xt,Zt]=',
  webEffect: '(0,Q.useEffect)(()=>_i(D,t,{revealItem:Hn,revealResponseTextAnnotation:Un}),[t,Hn,Un,D])',
  hostCommand: 'e.push(Mt.commands.registerCommand("chatgpt.openSidebar",Ru))'
};
const markers = {
  webCurrent: '/* codex-session-tree:reveal-turn:v2 */',
  webOld: '/* codex-session-tree:reveal-turn:v1 */',
  hostCurrent: '/* codex-session-tree:reveal-command:v1 */'
};

function count(source, value) {
  return source.split(value).length - 1;
}

function describe(file, keys) {
  if (!fs.existsSync(file)) return { path: file, exists: false };
  const source = fs.readFileSync(file, 'utf8');
  const backup = `${file}.codex-session-tree-original`;
  const backupSource = fs.existsSync(backup) ? fs.readFileSync(backup) : null;
  return {
    path: file,
    exists: true,
    bytes: Buffer.byteLength(source),
    sha256: crypto.createHash('sha256').update(source).digest('hex'),
    backupExists: backupSource !== null,
    backupSha256: backupSource === null ? null : crypto.createHash('sha256').update(backupSource).digest('hex'),
    anchors: Object.fromEntries(keys.map(key => [key, count(source, anchors[key])])),
    markers: Object.fromEntries(Object.entries(markers).map(([key, value]) => [key, source.includes(value)]))
  };
}

let packageInfo;
try {
  packageInfo = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
} catch (error) {
  console.error(`Cannot read official extension package.json: ${error.message}`);
  process.exit(1);
}
const assetDir = path.join(root, 'webview', 'assets');
let assetNames;
try {
  assetNames = fs.readdirSync(assetDir).filter(name => /^local-conversation-thread-[\w-]+\.js$/.test(name));
} catch (error) {
  console.error(`Cannot inspect webview assets: ${error.message}`);
  process.exit(1);
}
const webAssets = assetNames.map(name => describe(path.join(assetDir, name), ['webRef', 'webEffect']));
const targets = webAssets.filter(asset => asset.anchors.webEffect === 1 || asset.markers.webCurrent || asset.markers.webOld);
const result = {
  extension: { path: path.resolve(root), publisher: packageInfo.publisher, name: packageInfo.name, version: packageInfo.version },
  host: describe(path.join(root, 'out', 'extension.js'), ['hostCommand']),
  targetWebAssetCount: targets.length,
  targetWebAsset: targets.length === 1 ? targets[0].path : null,
  webAssets
};
console.log(JSON.stringify(result, null, 2));
