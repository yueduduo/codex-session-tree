# 已验证版本的适配地图

这份地图来自官方扩展 `openai.chatgpt@26.1007.21434` 的一次本地适配。它是找代码的线索，**不是**其他版本可直接套用的锚点保证。任何新版本都要重新确认每个变量和调用的作用。

## 文件和数据流

| 位置 | 在这个版本中的作用 |
| --- | --- |
| 本仓库 `extension.js` | 树标题点击进入 `revealOfficialTurn(threadId, turnId)`。先调用 `codexSessionTree.revealTurn`；失败才用 `vscode.open` 打开带 `codexTreeTurnId` 的 URI。 |
| 官方 `out/extension.js` | `registerCustomEditorProvider` 注册会话编辑器；`resolveCustomEditor` 把 URI 变成面板的 `initialRoute`；`editorPanels` 保存面板及 ready 状态。 |
| 官方 `webview/assets/local-conversation-thread-*.js` | 会话 React 组件保存虚拟列表 ref、已显示的轮次、历史页和加载函数。 |
| 本仓库 `officialPatch.js` | 把宿主命令和 webview effect 注入上述两个官方文件；安装前保存两份原件。 |

## 必须重新定位的代码

| 本仓库的名字 | 这个版本的原始锚点或含义 | 新版本适配要求 |
| --- | --- | --- |
| `hostAnchor` | `e.push(Mt.commands.registerCommand("chatgpt.openSidebar",Ru))` | 找到激活函数里注册命令的位置，并确认同一词法作用域中可访问 VS Code API、webview provider 和 extension subscriptions。 |
| `refAnchor` | `qt=(0,Q.useRef)(null),[Xt,Zt]=` | 找到实际传给会话虚拟列表的 ref，确认 `scrollToKey` 属于该 ref；注入目标与完成状态 ref 时保持 Hook 顺序。 |
| `effectAnchor` | `(0,Q.useEffect)(()=>_i(D,t,{revealItem:Hn,revealResponseTextAnnotation:Un}),[t,Hn,Un,D])` | 找到同一个会话组件内合适的 effect 插入点；不能只凭相似字符串插到另一个组件。 |
| `t` | 当前 conversation/thread ID | 与消息中的 `threadId` 匹配；切换会话时不能沿用旧目标。 |
| `qt.current` | 虚拟列表实例 | 只有 ref 已就绪且目标条目存在时调用 `scrollToKey`。 |
| `Sn` | 当前渲染的轮次条目 | 找 `turnId`、`turnKey` 或 `turnSearchKey`，调用时使用条目的 `turnKey`。 |
| `dt?.items`、`Rn`、`Vn`、`Wn` | 尚未直接显示、但可由预览定位的轮次 | 确认预览对象的 ID 以及加载后是否真的定位。 |
| `Tr(D,i).loadOlderConversationHistoryPage(t,...)` | 向更早历史翻页 | `i` 是需要的 conversation 对象；不能换成名字相似的 store lookup。确认分页游标和完成等待函数。 |

上表中除 URI 参数和自定义消息类型外，大多数标识符都是构建产物里的短名。新版本可能全部改名。使用 `scripts/show-context.js` 看限长片段，并沿着变量定义、调用点和数据结构确认语义；不要依靠旧名字猜测。

## 从旧版单文件补丁迁移

旧版 v1 只修改 webview asset，标记是 `/* codex-session-tree:reveal-turn:v1 */`，只有该 asset 的 `.codex-session-tree-original` 备份。当前 `officialPatch.js restore` 要求双文件标记和双备份，不能用于 v1。

如果确实有当时生成的 `codex-session-tree-0.5.3.vsix`，可以只提取其中的旧补丁器并用它恢复。先用 `unzip -p <old-vsix> extension/officialPatch.js` 查看输出是否包含 v1 标记和单文件 `restore`，确认后才执行：

```bash
unzip -p /path/to/codex-session-tree-0.5.3.vsix extension/officialPatch.js > /tmp/codex-tree-officialPatch-v1.js
node /tmp/codex-tree-officialPatch-v1.js restore "$OFFICIAL_DIR"
```

恢复后重新运行 `scripts/inspect-target.js`，确认 webview 的 v1 标记和备份都消失，再用当前补丁器安装。如果没有可信的旧补丁器或旧备份，停止并报告现状；不要把另一个官方扩展版本的 asset 当作原件。

## 两条导航路径

1. **面板已打开且 ready：**树插件执行 `codexSessionTree.revealTurn({threadId,turnId})`；官方宿主遍历 `editorPanels`，匹配 `initialRoute`，对同一面板调用 `reveal()` 和 `panel.webview.postMessage({type:'codex-tree-reveal-turn',...})`；webview 的 message listener 直接滚动。不会生成新的 URI。
2. **没有可复用面板：**宿主命令返回 false；树插件执行 `vscode.open`，URI 包含 `codexTreeTurnId` 和随机 `codexTreeNav`；官方宿主把查询参数写进 `initial-route`，webview 首次挂载时定位目标。

`postMessage` 返回 true 只表示 VS Code 接受投递，**不表示目标已滚到屏幕上**。最终结果必须查看官方会话里的用户问题文本。

## 容易重现的错误

| 表现 | 优先核对 |
| --- | --- |
| 点击每个标题都打开新页签 | 官方宿主是否重新加载、命令是否注册、`editorPanels` 是否匹配同一个会话、ready 是否为 true。 |
| 页面打开但停在最新轮次 | `initial-route` 是否带有正确 `codexTreeTurnId`；消息监听器是否存在；目标轮次是否尚未加载。 |
| 较近轮次能跳，较早轮次不能跳 | 旧历史翻页/预览加载逻辑是否仍可用；只调用 `scrollToKey` 不够。 |
| 控制台报 `undefined.id` | 检查传给翻页对象构造函数的参数；曾把 `Tr(D,i)` 的 `i` 错换成其他查询。 |
| 同一标题第二次点击无反应 | 检查重复点击是否重新发消息、重置目标状态并再次滚动。 |
| 补丁器说找不到目标 asset | 先运行只读检查脚本；可能是官方版本的文件名、effect 锚点或组件结构变了。不要删除备份来绕过检查。 |

## 验证矩阵

适配完成后，在重载过的 VS Code 窗口里逐项观察：

1. 从未打开的会话点一个较新的轮次：打开官方会话并显示对应用户问题。
2. 在同一会话点另一个轮次：原页签直接移动，没有新增页签。
3. 人工滚动离开目标，再点相同标题：仍会返回目标。
4. 点需要加载旧历史的较早轮次：加载完成后显示正确用户问题。
5. 点不同分支对应的会话：跳到对应会话和轮次。
6. 用一个没有补丁的环境或暂时恢复补丁验证只读阅读页回退；不要拿状态文字代替页面检查。

记录官方扩展版本、两份文件的原始 SHA-256、自动测试结果和以上观察结果。若无法做 UI 验证，明确写“未完成 UI 验证”，不要把语法检查或 `postMessage=true` 说成已实现滚动。
