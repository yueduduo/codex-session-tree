# Changelog

## 0.8.0

- Organized runtime code by responsibility under `src/`, moved webview resources to `webview/`, and collected icons in `assets/`.
- Updated the extension manifest, patch maintenance scripts, tests, and bilingual documentation for the new paths.
- Moved generated VSIX files out of the source root and added `npm run package` to build into `dist/`.

## 0.7.2

- Made the bottom branch node solid in the Activity Bar and Marketplace icons, removing the ambiguous crescent.

## 0.7.1

- Merge duplicate App Server records with the same session ID so a session endpoint appears only once in the branch graph.

## 0.7.0

- Localized the extension manifest, sidebar, turn reader, and status messages in English and Simplified Chinese.
- Replaced the generic Activity Bar title with the localized extension title.
- Split session navigation, turn reading, and webview HTML from the extension entry point.
- Rewrote the documentation and added a complete Simplified Chinese README.

## 0.6.1

- Made the session search field more compact.
- Simplified both icons to a conversation bubble containing a single branch; the Marketplace version uses charcoal, ivory, and one orange accent.

## 0.6.0

- Renamed the extension from Codex Session Tree to Codex Branch Map and changed the publisher from `local` to `pth-viewer`.
- Added Activity Bar and Marketplace icons, Marketplace metadata, and a license and changelog for distribution.

## 0.5.11

- Moved the session and turn counts from below the family title to the bottom of the sidebar graph.

## 0.5.10

- Made the current workspace collapsible and grouped other sessions by working directory, with independent collapse controls and remembered state.
- Temporarily expanded matching groups while searching without changing saved collapse preferences.

## 0.5.9

- Removed the redundant “All sessions” label and placed the back arrow beside the conversation title.

## 0.5.8

- Colored each turn number to match its graph lane while keeping the question text in the normal text color.

## 0.5.7

- Refined the sidebar list and graph to emphasize user questions and reduce repeated labels.
- Moved the explanation of inferred relationships from the UI to the README.

## 0.5.6

- Expanded the official Codex patch skill with a version adaptation guide, target inspection tools, bounded source inspection, and a patch syntax check.

## 0.5.5

- Updated the patch skill to document navigation in an already open panel, fallback behavior, and recovery from older patches.

## 0.5.4

- Added a host-side command to reuse an open official Codex conversation panel when navigating between turns in the same session.
- Extended the optional patch to back up and modify both the official extension host and its conversation webview.

## 0.5.3

- Added the first in-extension skill describing how to inspect, install, test, and restore the official Codex turn navigation patch.

## 0.5.2

- Added a unique navigation token to turn-specific session routes so selecting the same turn can request navigation again.
- Verified scrolling to a selected turn in the patched official Codex view, including a repeated selection after scrolling away.

## 0.5.1

- Corrected how the experimental patch reads the target turn from the official conversation route.
- Added loading of older conversation history before attempting to scroll to an earlier turn.

## 0.5.0

- Introduced an optional, reversible, version-specific patch for turn navigation inside the official Codex conversation webview.
- Kept the read-only turn reader as the fallback when the patch is absent.

## 0.4.0

- Added a read-only turn reader that opens at the selected question and response, with previous and next turn controls.
- Opened the corresponding official session alongside the reader; exact positioning at this stage was in the reader.

## 0.3.6

- Removed the redundant directory path from sessions already grouped under the current workspace.

## 0.3.5

- Added automatic refresh when the view opens or becomes visible and when returning from a graph.
- Split the list into current-workspace and other-workspace sessions, with the latter collapsed by default.

## 0.3.4

- Made every turn title open its containing Codex session; session endpoint labels continue to open their own sessions.

## 0.3.3

- Removed the “Fork from this turn” action and the extension's session-fork API call.

## 0.3.2

- Matched turn text and markers to their branch colors, including turns without a session endpoint.
- Removed numeric branch-count badges from the graph.

## 0.3.1

- Matched session label dots and borders to their graph lanes.
- Used the question after VS Code's IDE context header as the turn title.

## 0.3.0

- Replaced the connected turn-tree layout with a Git-style graph of colored lanes, branch points, and session endpoints.
- Added a compact default view and an option to show every turn.

## 0.2.0

- Grouped sessions with shared first-turn IDs, session IDs, or explicit fork metadata into conversation families.
- Built a turn tree from common turn prefixes so shared history appears once and branches split where their turns diverge.

## 0.1.0

- Created the first VS Code sidebar for listing local Codex sessions and their turns through the Codex App Server.
- Added session opening, refresh, workspace filtering, archive visibility, and an initial session-fork action.
