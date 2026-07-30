# 日叶 Dayleaf

一款安静、私密、本地优先的日记应用。macOS 版拥有独立原生窗口，无需浏览器、账号或后端。

## 功能

- 同一天可记录多篇日记，并分别设置心情、标签与珍藏
- 全文搜索、按日筛选和带篇数提示的月历导航
- 连续记录天数与字数统计
- 自动保存、明暗主题与响应式布局
- JSON 完整备份/恢复
- 通用 Markdown 导出
- 独立 macOS 应用与 PWA 离线使用

## 本地运行

需要 Node.js 18 或更高版本，不需要安装第三方依赖。

```bash
npm run dev
```

然后打开 <http://127.0.0.1:4173>。

## 独立 macOS 应用

双击项目根目录中的 `Install.command`，会自动：

1. 使用 Swift 与 WebKit 编译原生 `Dayleaf.app`
2. 在桌面创建 `Dayleaf.app` 快捷方式
3. 让你以后像普通软件一样在独立窗口中使用日记

独立版不会启动浏览器、Node 服务或后台端口。关闭窗口、按 `⌘W` 或 `⌘Q` 都会先保存正在编辑的内容，再完全退出进程。窗口大小和位置会在下次打开时恢复。

也可以手动执行：

```bash
./scripts/install_macos_shortcut.sh
open Dayleaf.app
```

应用内的日记保存在 macOS WebKit 的本地数据空间。旧网页版本的数据不会自动迁移；如需迁移，请先从网页端导出 JSON，再在独立版的“备份与恢复”中导入。

## 检查与构建

```bash
npm test
npm run check
npm run build
npm run bundle:native
npm run build:mac
```

构建产物会生成在 `dist/`。

## 数据与隐私

日叶没有账号、云端数据库、广告或分析脚本。日记保存在本机应用的 WebKit Local Storage 中；请定期在“备份与恢复”中导出 JSON 备份。

## 项目规划

完整的产品目标、技术方案、开源项目启发和版本路线见 [项目立项书](docs/PROJECT.md)。

## License

[MIT](LICENSE)
