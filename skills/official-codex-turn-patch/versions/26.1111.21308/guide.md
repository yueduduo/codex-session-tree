# Codex 26.1111.21308

从插件根目录运行公共 Skill 中的检查、安装和恢复命令。安装器从目标 package.json 选择同目录的 [patch.js](patch.js)。

宿主在注册 chatgpt.openSidebar 的作用域中持有提供程序 Ct。路由解析器 gL 保留查询参数，面板的 initialRoute 可用于首次定位和复用。

会话组件使用 zt 保存虚拟列表，hn 包含轮次条目。已加载轮次按 turnKey 滚动。未加载轮次通过 Dn.items 查找，Bn 读取预览，Wn 使用 AbortSignal 加载并滚动。其余情况通过 Zn 请求旧历史后重试。切换目标时取消上一次请求，重复点击同一目标也重新定位。

重载窗口后分别验证首次打开、连续点击、重复点击、旧轮次和切换分支，核对目标问题及页签数。
