# Thinking Translate

独立 Paseo 插件，ID 为 `thinking-translate`。自动将 thinking / reasoning 翻译为中文，使用 Google Translate 免 API key 接口。

仅替换思考行的客户端显示。普通回答、用户消息、agent provider 和原始对话记录保持原有行为。只能显示 provider 已经输出的 reasoning，不能获取模型没有公开的思考内容。

## 安装

要求 daemon 和客户端均为 Paseo `>=0.11.2`，包含 `0.12.0-beta.*`。开发依赖固定使用已发布的 `@getpaseo/plugin@0.11.4`。

```sh
cd /Users/tky/Desktop/projects/paseo-thinking-translate
npm ci --ignore-scripts
npm run typecheck
paseo plugin install /Users/tky/Desktop/projects/paseo-thinking-translate
```

这些安装命令需要由你执行。本次开发仅在临时、随机端口的隔离 daemon 中安装验证，没有安装到主 daemon，也没有重启它。修改插件后使用 `paseo plugin reload thinking-translate`，无需重启 daemon。

若目标宿主尚未启用插件，在 Paseo 的 Settings → Plugins 中手动启用。插件是受信任的本地代码，服务端运行在 daemon 机器上。不要同时启用多个接管 `reasoning` 行的翻译或 Thinking 插件。

## 使用与设置

- 思考生成时默认展开，完成后默认折叠。手动展开或折叠后，后续流式更新和完成状态尊重你的选择。
- “原文”切换到源文本，“中文”切换回翻译视图。两种视图都解析 Markdown。
- 翻译尚未返回时显示原文。部分失败只保留失败部分的原文，并提供错误原因和“重试”；成功部分继续显示译文。
- 流式内容只翻译已闭合的块；还在增长的尾部显示原文，完成后才翻译。

在插件的 **Thinking 翻译** 设置页可修改宿主级设置：

| 设置     | 默认值                                      | 作用                                      |
| -------- | ------------------------------------------- | ----------------------------------------- |
| 自动翻译 | 开启                                        | 关闭后显示原文，同时停止新的翻译调用      |
| 目标语言 | `zh-CN`                                     | Google 语言代码，例如 `zh-TW`、`ja`、`fr` |
| Endpoint | `https://clients5.google.com/translate_a/t` | 接收翻译请求的 HTTP(S) 地址               |

源语言始终自动识别；目标为中文时，中文原文不会自动反向翻译为英文。保存设置后会取消旧服务请求并清空服务端缓存。

## 数据发送与接口限制

翻译请求由 **daemon** 发起，手机、浏览器和 relay 客户端通过 Paseo 插件 RPC 调用，不直接请求 Google。展开与否不影响自动翻译：已挂载的思考行会在启用时自动处理。

默认会将思考中的自然语言片段发送至 Google。更换 endpoint 后会发送至该地址。请求使用 GET，包含 `client=dict-chrome-ex`、`sl=auto`、`tl` 和 `q` 参数，服务端及网络代理的访问日志可能记录 URL 中的文本。Endpoint 应返回 Google `translate_a/t` 的 JSON 结构。HTTP endpoint 不提供传输加密。

该免 key 接口不是带服务保证的 Google Cloud Translation API，可能限流、不可用或改变响应格式。插件不使用大模型或 API key，也不会在失败时自动切换其他服务。超时、网络错误、限流和异常响应显示失败原因，由你点击重试。

## Markdown 与缓存

使用 `@lezer/markdown` 和 GFM 先解析源文本，再翻译文字节点。译文放回同一结构渲染，不再将翻译结果作为 Markdown 解析。支持粗体、嵌套斜体、删除线、标题、嵌套列表、引用、链接、表格、行内代码和代码块。

Markdown 标记、代码、链接地址、转义星号、缩进和列表层级不送入翻译。合法转义字符和代码中的 `**` 原样显示；未闭合且不能构成 Markdown 的标记仍按原文显示。原始 HTML 只作为文字显示，图片只显示其说明文字，不加载远程图片。当前链接点击支持 HTTP(S)；不提供宿主的工作区文件导航。

每个自然语言片段最多 1500 个 UTF-16 单位，按词间空白分段，避免截断 Unicode 代理对；一个 RPC 最多 32 段、总计 12000 单位。Google 并发上限为 2，每个外部请求含读取正文最多 15 秒。相同进行中请求会合并。

成功结果使用有容量限制的内存缓存，键包含 endpoint、目标语言和原文；最多 1000 条、约 4 MiB。失败不进入服务端缓存。客户端按片段内容复用结果，内容变化时旧译文不会覆盖新内容；失败不会自动无限重试。缓存不写入对话记录，插件重载或 daemon 重启后服务端缓存清空。

## 开发与验证

```sh
npm test -- server/service.test.ts shared/markdown.test.ts client/batch.test.ts
npm run typecheck
npm run lint
npm run format
npm run format:check
npm run verify:host
npm run test:browser
npm run test:google
```

`verify:host` 和 `test:browser` 默认读取相邻 `../paseo` checkout，也可用 `PASEO_CHECKOUT=/absolute/path/to/paseo` 指定已安装依赖的 Paseo 源码。浏览器脚本使用已安装的 Google Chrome。两者都通过宿主的真实插件编译器检查客户端和服务端导入边界；生成文件放在 `.artifacts/`。

`verify:host` 在临时 home、随机端口验证实际安装、运行状态、设置、批量 RPC、去重、部分失败、重载和禁用。`test:browser` 将该编译产物载入 React Native Web 的测试宿主，使用真实本地 HTTP 翻译服务，检查流式复用、原文切换、折叠、失败重试、过期请求、Markdown、深浅主题和 375px 布局，并生成截图。它不是完整 Paseo app 的端到端测试。

`test:google` 单独验证真实 Google 接口；外网可用性不是单元测试通过条件。客户端使用 React Native 组件，尚未完成 iOS / Android 真机和 Electron 包装器内的界面验证；原生选择、嵌套滚动和链接打开行为需要在对应设备上复核。

## 参考

参考 `theTd/paseo-translate` 的思考行替换与折叠交互；代码独立实现，没有复制该项目的翻译器或渲染器。
