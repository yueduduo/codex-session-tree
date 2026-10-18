'use strict';

// Shared by the extension host and both webviews. Keep keys identical in both catalogs.
const messages = {
  en: {
    backToSessions: 'Back to sessions', searchPlaceholder: 'Search sessions or workspaces',
    conversationGraph: 'Conversation graph', turnDisplay: 'Turn display', summary: 'Summary', all: 'All',
    branchGraph: 'Conversation branch graph', noFolder: 'No folder open', sessionsCount: '{count} sessions',
    unknownDirectory: 'Working directory unavailable', currentWorkspace: 'Current workspace',
    otherWorkspaces: 'Other workspaces', noCurrentMatches: 'No matching sessions in this workspace',
    noCurrentSessions: 'No sessions here yet. Expand other workspaces to browse history.',
    noOtherMatches: 'No matching sessions in other workspaces', noOtherSessions: 'No sessions in other workspaces',
    buildingGraph: 'Building branch graph…', openOriginal: 'Open original session',
    revealTurn: 'Go to turn: {label}', originalSession: 'Original session',
    skippedTurns: '{count} turns hidden', turnsCount: '{count} turns',
    treeSummary: '{sessions} sessions · {turns} turns', error: 'Error: {message}',
    previousTurn: 'Previous', nextTurn: 'Next', openInCodex: 'Open in Codex',
    userQuestion: 'User question', codexResponse: 'Codex response',
    turnPosition: 'Turn {index} / {total}', noQuestion: '(No question text available)',
    noResponse: '(No response text available)', loadingSessions: 'Loading Codex sessions…',
    sourceFamilies: '{families} conversation groups · {sessions} sessions',
    buildingTree: 'Building branch tree…', locatingTurn: 'Locating turn…',
    missingTurn: 'This turn is no longer in the session. Refresh the list.',
    openSessionFailed: 'Could not open the Codex session: {message}',
    officialRevealRequested: 'Requested navigation in Codex',
    officialOpened: 'Opened Codex at target', readerReveal: 'Located in turn reader',
    revealStatus: '{result}, turn {index} · {title}',
    revealFailed: 'Could not locate the Codex turn: {message}',
    turnPanel: 'Codex turn', turnPanelIndex: 'Codex turn {index}',
    installOfficial: 'Install the OpenAI Codex extension to open sessions in VS Code.',
    connectionClosed: 'Codex connection is closed', serverExited: 'Codex App Server exited ({reason}). {details}',
    serverUnavailable: 'Codex App Server is unavailable', requestFailed: 'Codex request failed',
    requestTimedOut: 'Codex {method} timed out', repeatedThreadCursor: 'Codex returned a repeated thread cursor',
    repeatedTurnCursor: 'Codex returned a repeated turn cursor'
  },
  'zh-CN': {
    backToSessions: '返回会话列表', searchPlaceholder: '搜索会话或工作区',
    conversationGraph: '对话轨迹', turnDisplay: '轮次显示', summary: '概要', all: '全部',
    branchGraph: '会话分叉图', noFolder: '未打开文件夹', sessionsCount: '{count} 个会话',
    unknownDirectory: '未记录工作目录', currentWorkspace: '当前工作区',
    otherWorkspaces: '其他工作区', noCurrentMatches: '当前工作区没有匹配结果',
    noCurrentSessions: '这里还没有会话。可以展开其他工作区查看历史。',
    noOtherMatches: '其他工作区没有匹配结果', noOtherSessions: '没有其他工作区的会话',
    buildingGraph: '正在构建分叉图…', openOriginal: '打开原始会话',
    revealTurn: '定位轮次：{label}', originalSession: '原始会话',
    skippedTurns: '省略 {count} 轮', turnsCount: '{count} 轮对话',
    treeSummary: '{sessions} 个会话 · {turns} 轮对话', error: '错误：{message}',
    previousTurn: '上一轮', nextTurn: '下一轮', openInCodex: '在 Codex 中打开',
    userQuestion: '用户问题', codexResponse: 'Codex 回复',
    turnPosition: '第 {index} / {total} 轮', noQuestion: '（没有可显示的文字问题）',
    noResponse: '（这一轮没有可显示的回复）', loadingSessions: '正在读取 Codex 会话…',
    sourceFamilies: '{families} 组原始会话 · {sessions} 个会话',
    buildingTree: '正在构建分叉树…', locatingTurn: '正在定位轮次…',
    missingTurn: '所选轮次已不在此会话中，请刷新列表',
    openSessionFailed: 'Codex 会话未能打开：{message}',
    officialRevealRequested: '已请求官方 Codex 定位',
    officialOpened: '已打开官方 Codex · 目标', readerReveal: '已在阅读页定位',
    revealStatus: '{result}第 {index} 轮 · {title}',
    revealFailed: '无法定位 Codex 轮次：{message}',
    turnPanel: 'Codex 轮次', turnPanelIndex: 'Codex 第 {index} 轮',
    installOfficial: '请先安装 OpenAI Codex 扩展，以在 VS Code 中打开会话。',
    connectionClosed: 'Codex 连接已关闭', serverExited: 'Codex App Server 已退出（{reason}）。{details}',
    serverUnavailable: 'Codex App Server 不可用', requestFailed: 'Codex 请求失败',
    requestTimedOut: 'Codex {method} 请求超时', repeatedThreadCursor: 'Codex 返回了重复的会话分页游标',
    repeatedTurnCursor: 'Codex 返回了重复的轮次分页游标'
  }
};

function languageTag(locale) {
  return /^zh(?:-|$)/i.test(locale || '') ? 'zh-CN' : 'en';
}

function createTranslator(locale) {
  const catalog = messages[languageTag(locale)];
  return (key, values = {}) => {
    const template = catalog[key] || messages.en[key];
    if (template === undefined) throw new Error(`Unknown localization key: ${key}`);
    return template.replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(values, name) ? String(values[name]) : match);
  };
}

const api = { messages, languageTag, createTranslator };
if (typeof module === 'object' && module.exports) module.exports = api;
else globalThis.CodexBranchI18n = api;
