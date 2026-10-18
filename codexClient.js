'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

function findCodexBinary(vscode, configuredPath) {
  if (configuredPath?.trim()) return configuredPath.trim();
  const extension = vscode.extensions.getExtension('openai.chatgpt');
  if (extension) {
    const arch = { x64: 'x86_64', arm64: 'aarch64' }[process.arch] || process.arch;
    const platform = { win32: 'windows', darwin: 'macos', linux: 'linux' }[process.platform] || process.platform;
    const suffix = process.platform === 'win32' ? '.exe' : '';
    const candidate = path.join(extension.extensionPath, 'bin', `${platform}-${arch}`, `codex${suffix}`);
    if (fs.existsSync(candidate)) return candidate;
  }
  return 'codex';
}

class CodexClient {
  constructor(binary, onEvent = () => {}) {
    this.binary = binary;
    this.onEvent = onEvent;
    this.pending = new Map();
    this.nextId = 1;
    this.process = null;
    this.starting = null;
    this.disposed = false;
    this.stderr = '';
  }

  async ensureStarted() {
    if (this.disposed) throw new Error('Codex connection is closed');
    if (this.starting) return this.starting;
    if (this.process) return;
    this.starting = this.start();
    try { await this.starting; } finally { this.starting = null; }
  }

  async start() {
    const proc = spawn(this.binary, ['app-server'], { stdio: ['pipe', 'pipe', 'pipe'] });
    this.process = proc;
    proc.stderr.on('data', chunk => { this.stderr = (this.stderr + chunk.toString()).slice(-2000); });
    const lines = readline.createInterface({ input: proc.stdout });
    lines.on('line', line => this.handleLine(line));
    proc.on('error', error => this.fail(error));
    proc.on('exit', (code, signal) => this.fail(new Error(`Codex App Server exited (${signal || code}). ${this.stderr}`)));
    await this.requestRaw('initialize', {
      clientInfo: { name: 'codex_session_tree', title: 'Codex Session Tree', version: '0.1.0' }
    });
    this.send({ method: 'initialized', params: {} });
  }

  send(message) {
    if (!this.process?.stdin?.writable) throw new Error('Codex App Server is unavailable');
    this.process.stdin.write(`${JSON.stringify(message)}\n`);
  }

  handleLine(line) {
    let message;
    try { message = JSON.parse(line); } catch { return; }
    if (message.id !== undefined && this.pending.has(message.id)) {
      const pending = this.pending.get(message.id);
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) {
        const error = new Error(message.error.message || 'Codex request failed');
        error.code = message.error.code;
        pending.reject(error);
      } else pending.resolve(message.result);
    } else if (message.method) this.onEvent(message);
  }

  fail(error) {
    this.process = null;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  requestRaw(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex ${method} timed out`));
      }, 30000);
      this.pending.set(id, { resolve, reject, timer });
      try { this.send({ id, method, params }); }
      catch (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
    });
  }

  async request(method, params = {}) {
    await this.ensureStarted();
    return this.requestRaw(method, params);
  }

  async listThreads(includeArchived) {
    const threads = [];
    for (const archived of includeArchived ? [false, true] : [false]) {
      let cursor = null;
      const seen = new Set();
      do {
        const page = await this.request('thread/list', {
          cursor, limit: 100, sortKey: 'updated_at', archived,
          sourceKinds: ['cli', 'vscode', 'appServer']
        });
        threads.push(...(page.data || []).map(thread => ({ ...thread, archived })));
        cursor = page.nextCursor || null;
        if (cursor && seen.has(cursor)) throw new Error('Codex returned a repeated thread cursor');
        if (cursor) seen.add(cursor);
      } while (cursor);
    }
    return threads;
  }

  async listTurns(threadId, itemsView = 'summary') {
    const turns = [];
    let cursor = null;
    const seen = new Set();
    try {
      do {
        const page = await this.request('thread/turns/list', {
          threadId, cursor, limit: 100, sortDirection: 'asc', itemsView
        });
        turns.push(...(page.data || []));
        cursor = page.nextCursor || null;
        if (cursor && seen.has(cursor)) throw new Error('Codex returned a repeated turn cursor');
        if (cursor) seen.add(cursor);
      } while (cursor);
      return turns;
    } catch (error) {
      if (error.code !== -32601) throw error;
      const result = await this.request('thread/read', { threadId, includeTurns: true });
      return result.thread?.turns || [];
    }
  }

  async firstTurnId(threadId) {
    try {
      const result = await this.request('thread/turns/list', {
        threadId, limit: 1, sortDirection: 'asc', itemsView: 'notLoaded'
      });
      return result.data?.[0]?.id;
    } catch (error) {
      if (error.code !== -32601) throw error;
      return (await this.listTurns(threadId, 'notLoaded'))[0]?.id;
    }
  }

  dispose() {
    this.disposed = true;
    this.process?.kill();
    this.fail(new Error('Codex connection closed'));
  }

  async disposeAndWait() {
    const proc = this.process;
    if (!proc) { this.dispose(); return; }
    const exited = new Promise(resolve => {
      proc.once('exit', resolve);
      setTimeout(resolve, 1000);
    });
    this.dispose();
    await exited;
  }
}

module.exports = { CodexClient, findCodexBinary };
