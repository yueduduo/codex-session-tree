# Codex Session Tree

A Git-style VS Code sidebar for local Codex conversation branches. The first page lists original conversation families. Open a family to see colored graph lanes, turn nodes, branch splits, and clickable session labels. Newer turns appear above older turns, as in a Git log.

## Install

Install `codex-session-tree-0.5.6.vsix` with **Extensions: Install from VSIX**, then open **Codex Tree** in the activity bar. The OpenAI Codex extension is needed to open a session. The Codex CLI, either bundled with that extension or set with `codexSessionTree.codexPath`, supplies the App Server used for listing sessions.

## How branches are found

Codex sometimes returns no `forkedFromId` even for conversations with copied history. This extension groups sessions by their first turn ID, shared `sessionId`, or explicit `forkedFromId`. It builds a turn trie from the full turn ID sequences, so a common prefix is drawn once and divergent turns make separate paths. Groups inferred from copied turn IDs are marked **共享历史**. Matching names alone never create a branch.

The default graph shows branch points, their first child turns, session endpoints, and the origin. Choose **显示全部轮次** to see every turn. Click a turn title to open its official Codex conversation. If the optional local navigation patch is installed, the official view scrolls to that turn. Otherwise, a read-only turn reader opens on the exact turn. The reader shows the question and response and provides previous/next turn navigation. Session labels open that exact session in the official Codex extension. The extension does not edit session storage files.

## Exact turn navigation in the official Codex view

The official extension does not expose turn scrolling to other VS Code extensions. `officialPatch.js` makes version-specific changes to its installed extension host and webview asset. The host command sends a turn request to an already open conversation, so clicking another turn in that conversation scrolls the existing view. For a conversation that is not open, a `codexTreeTurnId` route parameter requests the initial scroll. This is an experimental local patch; an official extension update can replace it. The patcher refuses to modify a version whose expected code anchors have changed and saves both original files beside them before changing anything.

Run `node officialPatch.js install <path-to-openai.chatgpt-extension>` to apply the patch, then reload the VS Code window. Run `node officialPatch.js restore <path-to-openai.chatgpt-extension>` to restore the original asset, then reload the window. The tree extension detects whether the patch is installed and uses its read-only turn reader when it is absent.

The maintenance and verification process is in `skills/official-codex-turn-patch/SKILL.md` inside this extension.

Each turn has a colored text label and row marker matching its graph lane. The dot and outline of each session label use that color too. Turn labels use the user's question after VS Code's IDE context header when present.

## Settings

- `codexSessionTree.showArchived`: include archived sessions when true.
- `codexSessionTree.codexPath`: path to a Codex CLI when the official extension's bundled binary is unavailable.

The list separates sessions in the open VS Code workspace from sessions in other workspaces, which are collapsed by default. Current-workspace entries omit their redundant directory path; other-workspace entries show it. The list refreshes when the view opens, when returning from a graph, when the visible view regains focus, when workspace folders change, every minute while visible, or with the VS Code view title Refresh button.

## Development

This extension uses Node.js and the VS Code API without runtime dependencies. Run `npm test` to check grouping, branch construction, and App Server request handling.
