# Thinking Translate

将 Paseo 已输出的 thinking / reasoning 自动翻译成中文，并保留原文切换。思考生成时展开，完成后折叠，手动操作会保留。等待翻译或翻译失败时显示原文，失败后可点击重试。

支持粗体、斜体、删除线、标题、列表、引用、链接、表格和代码。先解析 Markdown 结构再翻译文字，保留代码、URL 和转义字符。普通回答、用户消息、agent provider 和原始记录保持原有行为。

要求 daemon 和客户端均为 Paseo 0.11.2 或更新版本，包含 0.12.0 beta。设置页提供自动翻译开关、翻译服务、目标语言和各服务的 endpoint / 密钥：Google 免 key 接口无需账号；Google Cloud 支持 v2 API Key 或 v3 OAuth Access Token；微软翻译支持 API Key 和区域。

默认由 daemon 将思考中的自然语言片段发送至 Google 的免 key 翻译接口，也可以切换到 Google Cloud 或微软翻译。免费接口可能限流或变化，Cloud 与微软的额度和计费由各自服务商决定。客户端通过 Paseo 插件 RPC 使用翻译服务，手机不直接请求翻译服务。思考行折叠后仍会自动翻译。

客户端使用 React Native 组件，已验证浏览器深浅主题和紧凑布局；iOS、Android 真机与 Electron 内界面尚待验证。不要同时启用多个接管思考行的插件。
