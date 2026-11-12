# Codex Branch Map

[English](README.md) · [简体中文](README.zh-CN.md)

[源代码](https://github.com/yueduduo/codex-session-tree) · [反馈问题](https://github.com/yueduduo/codex-session-tree/issues)

Codex Branch Map 是一个 VS Code 侧边栏扩展，用于浏览本地 Codex 会话。它将有关联的会话分组，用类似 Git 提交图的彩色轨道显示共同历史和分叉，并支持打开会话或选择具体轮次。

## 兼容版本

**此版本仅支持官方 OpenAI Codex VS Code 扩展 `openai.chatgpt@26.1007.21434`。** 本扩展通过该版本自带的 Codex CLI 读取会话；可选的精确轮次定位补丁也针对该版本的扩展宿主和会话页面。其他官方 Codex 版本尚未验证，不在此版本支持范围内。官方扩展更新可能覆盖补丁，重新安装补丁前请先核对版本。

已在开发机及远程 ARM64 VS Code Server 上确认安装的官方版本。远程服务器通过了打包文件、App Server 和补丁语法检查；由于没有可用的会话历史，尚未完成端到端的界面轮次定位验证。

## 功能

- **会话分组**：相关会话放在一起；当前工作区和其他工作区分别展示，各组可折叠。
- **分叉图**：彩色轨道表示共同轮次、分叉和会话终点。可在“概要”和“全部”视图间切换。
- **轮次导航**：点击轮次即可打开所属会话。安装可选的本地补丁后，还可在官方 Codex 界面滚动到该轮；未安装时会打开本扩展的只读轮次阅读页。
- **快捷浏览**：按标题或工作目录搜索，折叠工作区分组，返回分叉图时保留显示模式。
- **中英文界面**：跟随 VS Code 显示语言；支持英语和简体中文，其他语言使用英语。

## 要求与安装

- VS Code 1.100.0 或更新版本。
- 可通过 Codex CLI 读取的本地 Codex 会话记录。扩展默认依次查找已安装的 OpenAI Codex 扩展自带的 CLI，以及 `PATH` 中的 `codex`；也可设置 `codexSessionTree.codexPath`。
- 需要安装 [OpenAI Codex 扩展](https://marketplace.visualstudio.com/items?itemName=openai.chatgpt) **26.1007.21434**。若使用精确轮次定位，请固定这个版本。

可从 VS Code 扩展市场安装，或使用 **Extensions: Install from VSIX** 安装打包后的 VSIX。在活动栏打开 **会话分支图 → 会话**。进入视图、可见视图重新获得焦点、工作区文件夹变化时会自动刷新；视图可见期间每分钟也会刷新一次。也可点击标题栏的刷新按钮。

## 使用分叉图

1. 展开当前工作区或其他工作区，选择一个会话组。
2. 用“概要”或“全部”控制显示的轮次数量。
3. 点击轮次标题以定位该轮；点击会话标签以打开该会话；点击顶部会话组标题以打开原始会话。

扩展通过轮次 ID 判断共享历史：使用首轮 ID、共同的 `sessionId` 或明确的 `forkedFromId` 将会话分组，再将共同轮次前缀绘制一次。Codex 可能不记录分叉的父会话 ID，此时分叉关系根据共同轮次 ID 推断。仅标题相似不会形成分叉。扩展通过 Codex App Server 读取会话，不修改会话存储文件。

## 在官方 Codex 界面定位具体轮次

官方 Codex 扩展没有向其他扩展开放滚动到轮次的接口。本仓库提供**仅针对 `openai.chatgpt@26.1007.21434` 的可选本地补丁**：对已打开的会话增加宿主命令，对尚未打开的会话增加路由参数。补丁会备份修改的两个资源；如果预期代码锚点不匹配，则拒绝修改。未重新适配和测试前，请勿对其他官方版本应用此补丁。

```sh
node src/codex/officialPatch.js install <openai.chatgpt-扩展路径>
# 安装后重新加载 VS Code 窗口。
node src/codex/officialPatch.js restore <openai.chatgpt-扩展路径>
# 还原后再次重新加载窗口。
```

检查、适配、验证和恢复步骤详见[补丁维护指南](skills/official-codex-turn-patch/SKILL.md)。未安装补丁时，点击轮次仍会打开官方会话，并在本扩展的只读阅读页显示该轮的问题和回复；阅读页提供上一轮、下一轮按钮。

## 设置

| 设置 | 默认值 | 作用 |
| --- | --- | --- |
| `codexSessionTree.codexPath` | 空 | 指定 Codex CLI 路径。 |
| `codexSessionTree.showArchived` | `false` | 在列表中包含已归档会话。 |

## 开发

扩展使用 VS Code API 和 Node.js，没有运行时依赖。源码按职责组织：

```text
src/
  extension.js             VS Code 激活入口与会话侧边栏
  codex/                   App Server 客户端与可选的官方界面补丁
  domain/                  会话分组、分叉图布局、轮次数据
  ui/                      跳转、轮次阅读页与网页模板
  shared/                  宿主与网页共用的翻译
webview/                   侧边栏及阅读页的 JavaScript/CSS
assets/                    活动栏及市场图标
scripts/                   打包命令
test/                      Node.js 测试
skills/                    官方 Codex 补丁维护指南
```

`package.json` 指向 `src/extension.js`。VSIX 包含运行代码、网页资源、图标、文档和补丁维护指南；测试仅保留在仓库中。按 VS Code 的要求，入口标签翻译文件 `package.nls*.json` 留在仓库根目录。可选补丁位于 `src/codex/officialPatch.js`。

运行 `npm test` 检查会话分组、分叉图、App Server 通信和补丁。运行 `npm run package`，当前版本的 VSIX 会写入 `dist/`；历史 VSIX 保存在 `dist/archive/`。生成的安装包不会进入 Git 或 VSIX 本身。

## 许可证

MIT，见 [LICENSE](LICENSE)。
