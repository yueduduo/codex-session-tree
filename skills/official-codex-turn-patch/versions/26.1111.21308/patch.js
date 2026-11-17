'use strict';

// Official Codex 26.1111.21308. The prompt rail owns turn hydration and scrolling.
const effectAnchor = '(0,Tx.useEffect)(()=>jf(x,t,{revealItem:Kn,revealResponseTextAnnotation:Jn}),[t,Kn,Jn,x])';
const hostAnchor = 'e.push(Et.commands.registerCommand("chatgpt.openSidebar",vi))';

function currentTurnEffect() {
  /* codex-session-tree:reveal-turn:v2 */
  let controller;
  let timer;
  function start(turnId) {
    if (!/^[0-9a-f-]{36}$/i.test(turnId)) return;
    controller?.abort();
    clearTimeout(timer);
    controller = new AbortController();
    const { signal } = controller;
    let attempts = 0;
    async function locate() {
      if (signal.aborted) return;
      try {
        if (await codexTreeLocate(turnId, signal)) return;
      } catch (error) {
        if (!signal.aborted) console.warn('Codex Tree: reveal turn failed', error);
      }
      if (!signal.aborted && ++attempts < 30) timer = setTimeout(locate, 500);
    }
    locate();
  }
  function receive(event) {
    const message = event.data;
    if (message?.type === 'codex-tree-reveal-turn' && message.threadId === t) start(message.turnId);
  }
  window.addEventListener('message', receive);
  const route = document.querySelector('meta[name="initial-route"]')?.content;
  if (route) {
    const url = new URL(route, location.href);
    if (url.pathname === '/local/' + t) start(url.searchParams.get('codexTreeTurnId'));
  }
  return () => {
    controller?.abort();
    clearTimeout(timer);
    window.removeEventListener('message', receive);
  };
}

// Runs inside the conversation component through its stable ms callback.
async function locateCurrentTurn(turnId, signal) {
  if (!zt.current) return false;
  const key = kn.current.get(turnId) ?? hn.find(row => row.turnId === turnId && row.turnKey != null)?.turnKey;
  if (key != null) {
    if (Kt.isNativeEndSnapFollowing?.()) Kt.holdViewport();
    await zt.current.scrollToKey(key, undefined, { align: 'top', signal });
    return true;
  }
  if (Dn?.items.some(row => row.turnId === turnId)) {
    const preview = (await Bn(turnId))?.previews?.[0];
    if (preview && !signal.aborted) {
      await Wn({ id: pn(turnId, preview.itemId), isLoaded: false, turnKey: turnId }, signal);
      return kn.current.has(turnId);
    }
  }
  await Zn();
  return false;
}

async function revealOpenPanel(input) {
  /* codex-session-tree:reveal-command:v1 */
  if (!input || !/^[0-9a-f-]{36}$/i.test(input.threadId) || !/^[0-9a-f-]{36}$/i.test(input.turnId)) return false;
  for (const [panel, state] of Ct.editorPanels) {
    if (state.initialRoute?.split('?')[0] !== `/local/${input.threadId}` || !state.ready || !Ct.isPanelAlive(panel)) continue;
    panel.reveal();
    return panel.webview.postMessage({ type: 'codex-tree-reveal-turn', threadId: input.threadId, turnId: input.turnId });
  }
  return false;
}

const refAnchor = 'zt=(0,Tx.useRef)(null),Vt=';

function patchSource(source, replaceUnique) {
  return replaceUnique(source, effectAnchor, effectAnchor +
      `;const codexTreeLocate=ms(${locateCurrentTurn.toString()});(0,Tx.useEffect)(${currentTurnEffect.toString()},[t])`);
}

function patchHostSource(source, replaceUnique) {
  return replaceUnique(source, hostAnchor,
    `e.push(Et.commands.registerCommand("codexSessionTree.revealTurn",${revealOpenPanel.toString()})),${hostAnchor}`);
}

module.exports = { anchors: { webRef: refAnchor, webEffect: effectAnchor, hostCommand: hostAnchor }, patchSource, patchHostSource };
