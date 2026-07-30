# 日叶 Dayleaf

一款安静、私密、本地优先的日记应用。无需注册、无需后端，你的日记只保存在当前浏览器中。

## 功能

- 每日写作、心情、标签与珍藏
- 全文搜索和月历导航
- 连续记录天数与字数统计
- 自动保存、明暗主题与响应式布局
- JSON 完整备份/恢复
- 通用 Markdown 导出
- PWA 离线使用

## 本地运行

需要 Node.js 18 或更高版本，不需要安装第三方依赖。

```bash
npm run dev
```

然后打开 <http://127.0.0.1:4173>。

## macOS 桌面快捷应用

双击项目根目录中的 `Install.command`，会自动：

1. 生成带 Dayleaf 叶片图标的 `Dayleaf.app`
2. 在桌面创建 `Dayleaf.app` 快捷方式
3. 让你以后像打开普通软件一样双击启动日记

首次打开时，macOS 可能询问是否允许启动脚本；这是因为快捷应用需要在本机启动 Dayleaf 服务并打开浏览器。应用只访问 `127.0.0.1`，日记数据仍只保存在浏览器本地。

也可以手动执行：

```bash
./scripts/install_macos_shortcut.sh
open Dayleaf.app
```

停止后台服务：

```bash
./scripts/stop_macos.sh
```

## 检查与构建

```bash
npm test
npm run check
npm run build
```

构建产物会生成在 `dist/`。

## 数据与隐私

日叶没有账号、云端数据库、广告或分析脚本。日记保存在浏览器 Local Storage 中。清除浏览器站点数据会删除日记，请定期在“备份与恢复”中导出 JSON 备份。

## 项目规划

完整的产品目标、技术方案、开源项目启发和版本路线见 [项目立项书](docs/PROJECT.md)。

## License

[MIT](LICENSE)
