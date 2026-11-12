# Codex Branch Map

Documentation: [English](README.md) | [Simplified Chinese](README.zh-CN.md)

Codex Branch Map is a VS Code sidebar for exploring local Codex conversations. It groups related sessions, draws their shared history and forks as a Git-style graph, and lets you open a session or select a specific turn.

## Compatibility

**This release supports only the official OpenAI Codex VS Code extension `openai.chatgpt@26.1007.21434`.** The extension reads conversations through the Codex CLI bundled with that version. Its optional exact-turn navigation patch also targets that version's extension host and conversation webview. Other Codex extension versions have not been validated and are outside this release's support scope. An official Codex update may replace the patch; check the installed version before applying it again.

The supported version was confirmed on the development machine and on a remote ARM64 VS Code Server. The remote server passed package, App Server, and patch syntax checks, but had no conversation history available for an end-to-end UI navigation test.

## Features

- **Conversation families:** Related sessions appear together; sessions in the current workspace are separated from those in other workspaces.
- **Branch graph:** Colored lanes show shared turns, forks, and session endpoints. Use **Summary** for a compact graph or **All** for every turn.
- **Turn navigation:** Select a turn to open its session. An optional local patch enables scrolling to that turn inside the official Codex view. Without the patch, a read-only turn reader opens at the selected turn.
- **Fast browsing:** Search by session title or working directory, collapse workspace groups, and return to a graph without losing its display mode.
- **English and Simplified Chinese:** Interface text follows the VS Code display language. Other languages use English.

## Requirements and installation

- VS Code 1.100.0 or newer.
- Local Codex session history accessible through the Codex CLI. By default the extension looks for the CLI bundled with the installed OpenAI Codex extension, then for `codex` on `PATH`. You can also set `codexSessionTree.codexPath`.
- The [OpenAI Codex extension](https://marketplace.visualstudio.com/items?itemName=openai.chatgpt), version **26.1007.21434**, is required. Pin that version if you rely on exact-turn navigation.

Install the extension from the VS Code Marketplace, or use **Extensions: Install from VSIX** with the packaged VSIX. Open **Codex Branch Map → Sessions** from the Activity Bar. The list refreshes when opened, when the visible view regains focus, when workspace folders change, and once a minute while visible. The toolbar refresh button is available at any time.

## Using the graph

1. Expand the current workspace or another workspace, then select a conversation family.
2. Select **Summary** or **All** to choose how many turns are displayed.
3. Select a turn title to navigate to that turn. Select a session label to open that session. Select the family title to open its original session.

The graph uses session turn IDs to find shared history. It groups sessions using their first turn ID, shared `sessionId`, or an explicit `forkedFromId`, then draws a common turn prefix once. Codex may omit the parent session ID for forks; those relationships are inferred from shared turn IDs. Similar titles alone do not imply a branch. The extension reads session data through the Codex App Server and does not modify session storage files.

## Exact navigation in the official Codex view

The official Codex extension does not expose turn scrolling to other extensions. To enable it, this repository includes an **optional local patch specifically for `openai.chatgpt@26.1007.21434`**. The patch adds a host command for an already open conversation and a route parameter for an unopened one. It backs up the two assets it changes and refuses to apply when expected code anchors do not match. Do not apply it to another official Codex version without adapting and testing the patch.

```sh
node src/codex/officialPatch.js install <path-to-openai.chatgpt-extension>
# Reload the VS Code window after installation.
node src/codex/officialPatch.js restore <path-to-openai.chatgpt-extension>
# Reload again after restoration.
```

See `skills/official-codex-turn-patch/SKILL.md` for target inspection, adaptation, verification, and recovery. Without the patch, selecting a turn opens the official session and displays the exact question and response in this extension's read-only turn reader. The reader has previous/next controls.

## Settings

| Setting | Default | Purpose |
| --- | --- | --- |
| `codexSessionTree.codexPath` | Empty | Override the Codex CLI path. |
| `codexSessionTree.showArchived` | `false` | Include archived sessions in the list. |

## Development

The extension uses the VS Code API and Node.js without runtime dependencies. Source files are grouped by responsibility:

```text
src/
  extension.js             VS Code activation and session sidebar
  codex/                   App Server client and optional official-view patch
  domain/                  Session grouping, graph layout, and turn data
  ui/                      Navigation, reader panel, and webview documents
  shared/                  Localization shared by host and webviews
webview/                   Sidebar and reader JavaScript/CSS
assets/                    Activity Bar and Marketplace icons
scripts/                   Build commands
test/                      Node.js tests
skills/                    Official Codex patch maintenance guide
```

`package.json` points to `src/extension.js`. The VSIX includes runtime code, webview resources, icons, both README translations, and the patch maintenance guide; tests stay in the repository. The user interface remains available in English and Simplified Chinese. Contribution labels remain in `package.nls*.json` at the repository root, as required by VS Code. The optional patch is maintained at `src/codex/officialPatch.js`.

Run `npm test` for the session grouping, graph, App Server, and patch checks. Run `npm run package` to write the current VSIX to `dist/`. Older local VSIX files are kept in `dist/archive/`. Generated packages are excluded from Git and from the VSIX contents.

## License

MIT. See `LICENSE`.
