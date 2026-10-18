---
name: official-codex-turn-patch
description: Maintain the local patch that lets Codex Session Tree scroll an already open official VS Code Codex conversation to another turn. Use when installing, upgrading, repairing, testing, or restoring this version-specific host and webview patch.
---

# Official Codex turn navigation patch

Work in the `codex-session-tree` extension directory. The patch source is `officialPatch.js`; the route that opens the official conversation is in `extension.js`. The installed `openai.chatgpt` extension is the patch target, not the source of truth. Do not apply a patch automatically on tree extension activation.

## Establish the exact target

1. Find the `openai.chatgpt` extension loaded by the current VS Code instance and record its version and extension path. Do not assume that a local VS Code, Remote SSH, or Insiders window uses the same extension directory. From an extension host, `vscode.extensions.getExtension('openai.chatgpt')?.extensionPath` gives the path.
2. Inspect that version's `out/extension.js` custom editor provider and `webview/assets/local-conversation-thread-*.js`. Confirm that a newly opened `openai-codex://route/local/<session-id>?codexTreeTurnId=<turn-id>&codexTreeNav=<nonce>` reaches the webview's `initial-route` meta tag. This URI is the fallback for a session without a reusable panel; the nonce lets a later fallback reopen the same target. Reusing an open panel must not create a new URI.
3. Check the patch markers in both the conversation asset and `out/extension.js`, and check each `.codex-session-tree-original` backup. `officialPatch.js` requires one exact match for each code anchor and refuses unknown versions. If anchors changed, inspect the new implementation and update the patcher; do not force an old string replacement into a new bundle.

## Change the patch

Keep the patch in `officialPatch.js` so installation remains reproducible and reversible. The host patch registers `codexSessionTree.revealTurn`: it finds a ready custom editor panel whose `initialRoute` matches the requested conversation, reveals that panel, and posts `codex-tree-reveal-turn` to it. The tree calls this command first. If it returns false, such as when no matching ready panel exists, the tree falls back to `vscode.open`. Reuse turn data already loaded for the tree instead of requesting the entire conversation on every click.

The webview patch handles the message and also reads `codexTreeTurnId` from `initial-route` for a newly opened panel. It finds the matching turn in `Sn` and calls `qt.current.scrollToKey(entry.turnKey, undefined, {align:'top'})`. If the target is outside the rendered virtual list, it hydrates an available preview with `Rn` and `Vn`, or loads older pages through `Tr(D,i).loadOlderConversationHistoryPage(...)` before retrying. Keep the message listener active even when the initial route has no turn ID; clean it up on unmount. A second click on the same title must request scrolling again without remounting the conversation.

These names are minified, version-specific symbols, not a stable API. Recheck their meaning after every official extension update. In particular, `Tr(D,i)` uses the conversation object `i`; passing an unrelated lookup caused an `undefined.id` error in the previously tested version. A simple `scrollToKey` call also failed for older turns until history loading was added.

Preserve the tree extension's unpatched fallback: clicking a turn opens its read-only turn reader when `isInstalled()` is false. `isInstalled()` must check both host and webview markers. A successful `postMessage()` or sidebar status is not proof that scrolling succeeded.

## Install, verify, restore

Run these commands from the `codex-session-tree` directory with the actual extension path:

```bash
node officialPatch.js install /path/to/openai.chatgpt-extension
node --check /path/to/openai.chatgpt-extension/out/extension.js
node --check /path/to/openai.chatgpt-extension/webview/assets/local-conversation-thread-<hash>.js
npm test
```

The installer writes an original backup beside each changed file as `<file>.codex-session-tree-original`. If an older patch version is installed, restore it with the matching older patcher before installing the new one; the current restore command expects both current markers and backups. Reload the VS Code window so both the extension host and its webview use the new code.

Verify in the UI by clicking a turn old enough to require loading earlier history: the official conversation must visibly scroll to that exact user question. Click another turn in the same session and confirm the existing editor scrolls without opening another tab. Scroll elsewhere and click the same title again; then click a different branch. Check the question text in the conversation, not merely the sidebar status. Automated tests can cover command dispatch and repeated message handling, but do not replace this visual check. Remove temporary debug instrumentation before finishing.

To undo the patch, run `node officialPatch.js restore /path/to/openai.chatgpt-extension` and reload VS Code. Restore only when both current files still carry this patch's markers and both matching backups exist. If the official extension was updated or the backups and current files no longer match, inspect them before changing either; never copy an old bundle into a newer extension.

When changing the tree extension itself, update its package version and README, build the VSIX, and confirm that this Skill is included. An official extension update may replace the installed patch; repeat target inspection and UI verification for the new version.
