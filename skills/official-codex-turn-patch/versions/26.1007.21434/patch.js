'use strict';

const refAnchor = 'qt=(0,Q.useRef)(null),[Xt,Zt]=';
const effectAnchor = '(0,Q.useEffect)(()=>_i(D,t,{revealItem:Hn,revealResponseTextAnnotation:Un}),[t,Hn,Un,D])';
const hostAnchor = 'e.push(Mt.commands.registerCommand("chatgpt.openSidebar",Ru))';

// Serialized into the minified conversation component. Its free variables are
// the component's existing virtual list and history-loading functions.
function revealTurnEffect() {
  /* codex-session-tree:reveal-turn:v2 */
  const route = document.querySelector('meta[name="initial-route"]')?.content;
  const initialTurn = route ? new URL(route, location.href).searchParams.get('codexTreeTurnId') : null;
  const pending = codexTreeTargetRef.current;
  let desired = pending?.threadId === t ? pending.turnId : initialTurn;
  let key = `${t}:${desired}`;
  let active = true;
  let busy = false;
  let attempts = 0;
  let version = 0;
  let timer;

  const reveal = async () => {
    if (!active || busy || !qt.current || !desired) return;
    const requested = desired;
    const requestVersion = version;
    busy = true;
    try {
      const entry = Sn.find(item => item.turnId === requested || item.turnKey === requested || item.turnSearchKey === requested);
      if (entry) {
        await qt.current.scrollToKey(entry.turnKey, undefined, { align: 'top' });
        if (active && requestVersion === version) {
          codexTreeRevealRef.current = key;
          clearInterval(timer);
        }
        return;
      }
      if (dt?.items?.some(item => item.turnId === requested)) {
        const page = await Rn(requested);
        const preview = page?.previews?.[0];
        if (preview) {
          await Vn({ id: Wn(requested, preview.itemId), isLoaded: false, turnKey: requested });
          if (active && requestVersion === version) {
            codexTreeRevealRef.current = key;
            clearInterval(timer);
          }
          return;
        }
      }
      if (!be && Sn.length > 0) {
        await Tr(D, i).loadOlderConversationHistoryPage(t, Ct == null ? [] : [Ct]);
        await il();
      }
      if (++attempts >= 30) clearInterval(timer);
    } catch (error) {
      console.warn('Codex Tree: reveal turn failed', error);
      if (++attempts >= 30) clearInterval(timer);
    } finally {
      busy = false;
    }
  };

  const start = turnId => {
    if (!active || !/^[0-9a-f-]{36}$/i.test(turnId)) return;
    desired = turnId;
    key = `${t}:${turnId}`;
    codexTreeTargetRef.current = { threadId: t, turnId };
    codexTreeRevealRef.current = null;
    version++;
    attempts = 0;
    clearInterval(timer);
    timer = setInterval(reveal, 500);
    reveal();
  };
  const onMessage = event => {
    const message = event.data;
    if (message?.type === 'codex-tree-reveal-turn' && message.threadId === t) start(message.turnId);
  };
  window.addEventListener('message', onMessage);
  if (desired && codexTreeRevealRef.current !== key) start(desired);
  return () => {
    active = false;
    clearInterval(timer);
    window.removeEventListener('message', onMessage);
  };
}

// Serialized into the official extension's activation function, where Pe is
// its webview provider and Mt is the VS Code API.
async function revealOpenPanel(input) {
  /* codex-session-tree:reveal-command:v1 */
  if (!input || !/^[0-9a-f-]{36}$/i.test(input.threadId) || !/^[0-9a-f-]{36}$/i.test(input.turnId)) return false;
  for (const [panel, state] of Pe.editorPanels) {
    if (state.initialRoute?.split('?')[0] !== `/local/${input.threadId}` || !state.ready || !Pe.isPanelAlive(panel)) continue;
    panel.reveal();
    return panel.webview.postMessage({ type: 'codex-tree-reveal-turn', threadId: input.threadId, turnId: input.turnId });
  }
  return false;
}


function patchSource(source, replaceUnique) {
  const withRefs = replaceUnique(source, refAnchor,
    'qt=(0,Q.useRef)(null),codexTreeRevealRef=(0,Q.useRef)(null),codexTreeTargetRef=(0,Q.useRef)(null),[Xt,Zt]=');
  return replaceUnique(withRefs, effectAnchor,
    `${effectAnchor},(0,Q.useEffect)(${revealTurnEffect.toString()},[t,Sn,dt,Xt,be,Ct,i])`);
}

function patchHostSource(source, replaceUnique) {
  return replaceUnique(source, hostAnchor,
    `e.push(Mt.commands.registerCommand("codexSessionTree.revealTurn",${revealOpenPanel.toString()})),${hostAnchor}`);
}


module.exports = { anchors: { webRef: refAnchor, webEffect: effectAnchor, hostCommand: hostAnchor }, patchSource, patchHostSource, revealTurnEffect };
