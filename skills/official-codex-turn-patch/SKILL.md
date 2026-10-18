---
name: official-codex-turn-patch
description: Adapt, install, test, or restore the version-specific patch that makes Codex Session Tree scroll an already open official VS Code Codex conversation to a selected turn. Use when official Codex updates break turn navigation or when this patch must be maintained.
---

# 官方 Codex 会话轮次跳转补丁

本 Skill 服务于本仓库 `codex-session-tree`。按下面顺序执行；不要因为某个字符串在新版本里“看起来差不多”就直接改已安装的官方扩展。用户只要求分析时停在只读检查阶段；只有任务包含安装、修复或升级时才写入官方扩展。

## 目标和文件边界

- 本仓库 `extension.js`：树标题点击后先执行 `codexSessionTree.revealTurn`；无可复用面板时才调用 `vscode.open`。
- 本仓库 `officialPatch.js`：补丁生成、双文件备份、安装、恢复和已安装检测的唯一维护入口。不要把实验性改动仅留在已安装的官方 bundle 中。
- 官方扩展 `out/extension.js`：注入宿主命令，用于找到已打开的同一会话面板并发送消息。
- 官方扩展 `webview/assets/local-conversation-thread-*.js`：注入消息监听和虚拟列表定位逻辑。
- `references/adapter-map.md`：已验证版本的变量、数据流和故障地图。**适配新的官方版本前先读它，再逐项核实新版本；不能照抄旧的压缩变量名。**

成功标准：首次点击可打开官方会话并定位；同一会话后续点击另一个标题只移动原面板，不新增页签；重复点击同一标题再次定位；旧历史轮次也能正确显示用户问题。侧栏状态文字和 `postMessage() === true` 都不足以证明成功。

## 1. 确认当前目标，保持只读

在仓库根目录工作。先找出**当前 VS Code 窗口实际加载**的 `openai.chatgpt` 扩展目录。可用 `code --list-extensions --show-versions` 确认版本；在扩展宿主中，`vscode.extensions.getExtension('openai.chatgpt')?.extensionPath` 给出确切目录。本地 VS Code、Insiders、Remote SSH 的扩展目录可能不同，不要只因为文件存在就认定是当前目标。

把实际目录填入下面变量，之后所有命令使用同一个值：

```bash
OFFICIAL_DIR='/absolute/path/to/openai.chatgpt-version-platform'
node skills/official-codex-turn-patch/scripts/inspect-target.js "$OFFICIAL_DIR"
```

脚本只读，输出官方版本、宿主文件、候选会话 asset、SHA-256、锚点出现次数、补丁标记和每个备份的状态。记录输出。检查 `publisher/name` 确实是 `openai/chatgpt`，并且 `targetWebAssetCount` 为 1。它列出其他同名前缀的辅助 chunk 是正常的；真正目标必须唯一。

| 检查结果 | 下一步 |
| --- | --- |
| 宿主和目标 webview 都没有补丁标记、没有备份，`hostCommand`、`webRef`、`webEffect` 都恰好出现 1 次 | 可以进入第 2 步；仍须先测试生成后的补丁。 |
| 宿主有 `hostCurrent`、目标有 `webCurrent`，两份备份都存在 | 当前补丁已在磁盘上；不要重复写入。先重载 VS Code 并做第 4 步的 UI 验证。若任务是替换这个补丁，先用当前补丁器恢复，再重新从第 1 步检查。 |
| 目标有 `webOld`，通常只有一份 webview 备份 | 这是旧版单文件补丁。先用**该旧版的补丁器**恢复，再重新检查；当前双文件 `restore` 不适用。 |
| 目标数量不是 1、锚点缺失/重复、只有一侧有标记、备份状态矛盾、版本无法确认 | **停止写入。** 定位原因并适配代码；不要删除备份、强行替换字符串或复制其他版本的 bundle。 |

## 2. 官方版本变化时如何适配

先读 `references/adapter-map.md`。用下面的限长查看工具定位新版本代码；不要直接 `rg` 输出压缩文件的整条巨型行：

```bash
node skills/official-codex-turn-patch/scripts/show-context.js "$OFFICIAL_DIR/out/extension.js" 'registerCustomEditorProvider' 400
node skills/official-codex-turn-patch/scripts/show-context.js "$OFFICIAL_DIR/out/extension.js" 'initialRoute' 400
node skills/official-codex-turn-patch/scripts/show-context.js "$OFFICIAL_DIR/webview/assets/ACTUAL_TARGET.js" 'scrollToKey' 400
```

把 `ACTUAL_TARGET.js` 换成检查脚本输出的 `targetWebAsset` 文件名。若原锚点消失，先找数据流而非猜变量：URI 查询参数如何到达 `initial-route`；哪个 provider 持有 custom editor 面板及 ready 状态；哪个 ref 控制当前会话虚拟列表；已渲染轮次、预览和旧历史分页分别从哪里来。确认新变量的定义及调用点后，修改本仓库 `officialPatch.js` 中的锚点和注入函数；必要时同步修改 `extension.js`。

必须保留以下行为：

1. 宿主命令只复用**同一 threadId、已 ready、仍存活**的面板；发送 `{type:'codex-tree-reveal-turn',threadId,turnId}`。找不到则返回 false，让树插件走首次打开路径。
2. webview 没有初始 `codexTreeTurnId` 时也注册消息监听；只处理当前会话的消息；重复点击相同轮次也重新滚动；卸载时移除监听和计时器。
3. 目标不在当前虚拟列表时，继续加载预览或旧历史，等目标可用再滚动；不能把“已发消息”当成“已定位”。
4. 宿主锚点和 webview 的两个锚点都必须唯一；`isInstalled()` 必须检查两侧标记；安装必须在写入前创建对应的两份原件备份。无补丁时保留只读轮次阅读页回退。

若需要临时调试，只在可恢复的测试副本或已建立备份的当前版本上操作；把诊断代码移回 `officialPatch.js` 后清除临时 overlay、日志和手改痕迹。不要直接把旧版本的压缩变量名或整个旧 bundle 拷到新版本。

## 3. 安装前验证，再安装

先更新相关测试：至少覆盖补丁锚点唯一性与可恢复性、宿主命令复用正确会话面板、同一面板连续切换和重复点击轮次；历史分页逻辑变化时还要覆盖旧轮次的加载路径。运行：

```bash
npm test
node --check officialPatch.js
node skills/official-codex-turn-patch/scripts/check-patched-syntax.js "$OFFICIAL_DIR"
```

最后一条命令只在临时目录生成补丁并解析两份产物，不写官方扩展。任何失败都要先修复并重跑；不要跳过。确认第 1 步的文件及版本仍未变化后再安装：

```bash
node officialPatch.js install "$OFFICIAL_DIR"
node skills/official-codex-turn-patch/scripts/inspect-target.js "$OFFICIAL_DIR"
```

确认安装输出 `installed: true`，检查脚本显示宿主 `hostCurrent`、目标 webview `webCurrent` 和两份备份。安装是针对本机已安装扩展的本地补丁，不等于修改官方上游源码。**重载整个 VS Code 窗口**，让扩展宿主和 webview 都加载新文件；只刷新树页面不够。

## 4. 实际 UI 验证与故障处理

按 `references/adapter-map.md` 的验证矩阵逐项操作，至少检查首次打开、同会话不同轮次、重复点击同轮次、较早历史轮次和分支切换。看官方会话中实际显示的用户问题，并确认同会话跳转没有多一个页签。记录通过/失败的具体轮次和官方扩展版本。不能操作 UI 时，明确标记“只通过自动与语法检查，UI 未验证”。

若失败，先分层定位：树插件有没有调用命令；官方宿主命令有没有匹配 ready 面板；消息有没有到达当前会话；目标是否在已加载条目；旧历史是否成功翻页。参考 `references/adapter-map.md` 的故障表。不要通过不断新开 URI 来掩盖“复用面板失败”。

若要撤销**当前双文件版本**：

```bash
node officialPatch.js restore "$OFFICIAL_DIR"
```

只有两份当前标记和两份对应备份都存在时才能恢复；之后重载 VS Code。若官方扩展已经升级、文件与备份不成对或是旧版单文件补丁，先调查版本和哈希，不要盲目复制备份。恢复后重新运行检查脚本确认标记消失。

## 5. 交付

代码有变化时更新 `README.md`、插件版本和必要测试；重新打包 VSIX，确认 `skills/official-codex-turn-patch/` 的全部文件在包中。报告官方版本、安装/恢复状态、测试结果、UI 验证结果以及仍未验证的部分。不要把本地补丁描述成官方支持的稳定 API。
