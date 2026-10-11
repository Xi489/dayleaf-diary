import Cocoa
import CoreServices
import UniformTypeIdentifiers
import WebKit

private let dayleafOrigin = URL(string: "https://dayleaf.local/")!

private func isTrustedDayleafOrigin(_ origin: WKSecurityOrigin) -> Bool {
    origin.protocol == "https" &&
        origin.host == dayleafOrigin.host &&
        (origin.port == 0 || origin.port == 443)
}

private func isTrustedDayleafURL(_ url: URL) -> Bool {
    url.scheme == "https" &&
        url.host == dayleafOrigin.host &&
        (url.port == nil || url.port == 443)
}

private struct DayleafMusicProvider {
    let id: String
    let displayName: String
    let bundleIdentifiers: [String]
    let fallbackPaths: [String]
    let mode: String

    var capabilities: [String: Bool] {
        let full = mode == "full"
        return ["openApp": true, "nowPlaying": full, "playPause": full, "next": full]
    }
}

final class DayleafWidgetBridge: NSObject, WKScriptMessageHandlerWithReply {
    private static let musicProviders: [String: DayleafMusicProvider] = [
        "appleMusic": DayleafMusicProvider(
            id: "appleMusic",
            displayName: "Apple Music",
            bundleIdentifiers: ["com.apple.Music"],
            fallbackPaths: ["/System/Applications/Music.app"],
            mode: "full"
        ),
        "netease": DayleafMusicProvider(
            id: "netease",
            displayName: "网易云音乐",
            bundleIdentifiers: ["com.netease.163music"],
            fallbackPaths: ["/Applications/NeteaseMusic.app", "~/Applications/NeteaseMusic.app"],
            mode: "launchOnly"
        ),
        "qqMusic": DayleafMusicProvider(
            id: "qqMusic",
            displayName: "QQ 音乐",
            bundleIdentifiers: ["com.tencent.QQMusicMac", "com.tencent.QQMusic"],
            fallbackPaths: [
                "/Applications/QQMusic.app", "/Applications/QQ音乐.app",
                "~/Applications/QQMusic.app", "~/Applications/QQ音乐.app",
            ],
            mode: "launchOnly"
        ),
    ]

    private let isSmokeTest: Bool
    private let queue = DispatchQueue(label: "com.dayleaf.diary.music-bridge", qos: .userInitiated)
    private var smokeCallCount = 0
    private var smokeLastProvider = ""
    private var smokeOpenedProviders = Set<String>()

    init(isSmokeTest: Bool) {
        self.isSmokeTest = isSmokeTest
    }

    private func reply(_ ok: Bool, code: String = "ok", data: [String: Any] = [:]) -> [String: Any] {
        ["ok": ok, "code": code, "data": data]
    }

    private func providerData(
        _ provider: DayleafMusicProvider,
        installed: Bool,
        running: Bool,
        authorization: String
    ) -> [String: Any] {
        [
            "provider": provider.id,
            "displayName": provider.displayName,
            "installed": installed,
            "running": running,
            "authorization": authorization,
            "mode": provider.mode,
            "capabilities": provider.capabilities,
        ]
    }

    private func fallbackURLs(for provider: DayleafMusicProvider) -> [URL] {
        provider.fallbackPaths.map { path in
            guard path.hasPrefix("~/") else { return URL(fileURLWithPath: path) }
            return FileManager.default.homeDirectoryForCurrentUser
                .appendingPathComponent(String(path.dropFirst(2)))
        }
    }

    private func applicationURL(for provider: DayleafMusicProvider) -> URL? {
        for bundleIdentifier in provider.bundleIdentifiers {
            if let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleIdentifier) {
                return url
            }
        }
        for url in fallbackURLs(for: provider) where FileManager.default.fileExists(atPath: url.path) {
            return url
        }
        return nil
    }

    private func runningApplication(for provider: DayleafMusicProvider) -> NSRunningApplication? {
        for bundleIdentifier in provider.bundleIdentifiers {
            if let application = NSRunningApplication.runningApplications(withBundleIdentifier: bundleIdentifier).first {
                return application
            }
        }
        let knownPaths = Set(fallbackURLs(for: provider).map { $0.standardizedFileURL.path })
        return NSWorkspace.shared.runningApplications.first { application in
            guard let bundlePath = application.bundleURL?.standardizedFileURL.path else { return false }
            return knownPaths.contains(bundlePath)
        }
    }

    private func permissionStatus(for application: NSRunningApplication, ask: Bool) -> OSStatus {
        let descriptor = NSAppleEventDescriptor(processIdentifier: application.processIdentifier)
        guard let target = descriptor.aeDesc else { return OSStatus(paramErr) }
        return AEDeterminePermissionToAutomateTarget(target, typeWildCard, typeWildCard, ask)
    }

    private func executeMusicScript(_ source: String) -> (NSAppleEventDescriptor?, NSDictionary?) {
        var error: NSDictionary?
        let result = NSAppleScript(source: source)?.executeAndReturnError(&error)
        return (result, error)
    }

    private func fullMusicStatus(
        for provider: DayleafMusicProvider,
        askForPermission: Bool
    ) -> [String: Any] {
        guard provider.id == "appleMusic" else {
            return reply(false, code: "unsupportedAction")
        }
        let installed = applicationURL(for: provider) != nil
        guard let application = runningApplication(for: provider) else {
            return reply(true, code: "notRunning", data: providerData(
                provider,
                installed: installed,
                running: false,
                authorization: "unknown"
            ).merging(["playing": false], uniquingKeysWith: { current, _ in current }))
        }
        let permission = permissionStatus(for: application, ask: askForPermission)
        if permission == errAEEventWouldRequireUserConsent {
            return reply(false, code: "needsPermission")
        }
        if permission == errAEEventNotPermitted {
            return reply(false, code: "denied")
        }
        guard permission == noErr else {
            return reply(false, code: "permissionError")
        }
        let source = """
        tell application id "com.apple.Music"
          set isPlaying to (player state is playing)
          try
            set trackName to name of current track
            set artistName to artist of current track
          on error
            set trackName to ""
            set artistName to ""
          end try
          return {isPlaying, trackName, artistName}
        end tell
        """
        let (result, error) = executeMusicScript(source)
        guard error == nil, let result else {
            return reply(false, code: "commandFailed")
        }
        var data = providerData(provider, installed: true, running: true, authorization: "authorized")
        data["playing"] = result.atIndex(1)?.booleanValue ?? false
        data["title"] = String((result.atIndex(2)?.stringValue ?? "").prefix(160))
        data["artist"] = String((result.atIndex(3)?.stringValue ?? "").prefix(160))
        return reply(true, data: data)
    }

    private func handleSmokeMusic(action: String, provider: DayleafMusicProvider) -> [String: Any] {
        smokeCallCount += 1
        smokeLastProvider = provider.id
        switch action {
        case "openApp":
            smokeOpenedProviders.insert(provider.id)
            return reply(true, data: providerData(
                provider,
                installed: true,
                running: true,
                authorization: provider.mode == "full" ? "unknown" : "notNeeded"
            ))
        case "authorize" where provider.mode == "full",
             "status" where provider.mode == "full":
            var data = providerData(provider, installed: true, running: true, authorization: "authorized")
            data["playing"] = true
            data["title"] = "无痕测试曲目"
            data["artist"] = "Dayleaf Fake Music"
            return reply(true, data: data)
        case "status":
            return reply(true, data: providerData(
                provider,
                installed: true,
                running: smokeOpenedProviders.contains(provider.id),
                authorization: "notNeeded"
            ))
        case "playPause" where provider.mode == "full",
             "next" where provider.mode == "full":
            return reply(true)
        default:
            return reply(false, code: "unsupportedAction")
        }
    }

    private func handleMusic(action: String, provider: DayleafMusicProvider) -> [String: Any] {
        if isSmokeTest {
            return handleSmokeMusic(action: action, provider: provider)
        }

        if action == "openApp" {
            guard let url = applicationURL(for: provider) else {
                return reply(false, code: "appMissing")
            }
            DispatchQueue.main.async {
                let configuration = NSWorkspace.OpenConfiguration()
                configuration.activates = true
                configuration.addsToRecentItems = false
                NSWorkspace.shared.openApplication(at: url, configuration: configuration)
            }
            return reply(true, data: providerData(
                provider,
                installed: true,
                running: true,
                authorization: provider.mode == "full" ? "unknown" : "notNeeded"
            ))
        }

        if action == "status" && provider.mode == "launchOnly" {
            guard applicationURL(for: provider) != nil else {
                return reply(false, code: "appMissing")
            }
            return reply(true, data: providerData(
                provider,
                installed: true,
                running: runningApplication(for: provider) != nil,
                authorization: "notNeeded"
            ))
        }

        guard provider.mode == "full" else {
            return reply(false, code: "unsupportedAction")
        }
        if action == "authorize" {
            guard runningApplication(for: provider) != nil else {
                return reply(false, code: "notRunning")
            }
            return fullMusicStatus(for: provider, askForPermission: true)
        }
        if action == "status" {
            return fullMusicStatus(for: provider, askForPermission: false)
        }

        guard let application = runningApplication(for: provider) else {
            return reply(false, code: "notRunning")
        }
        let permission = permissionStatus(for: application, ask: false)
        if permission == errAEEventWouldRequireUserConsent { return reply(false, code: "needsPermission") }
        if permission == errAEEventNotPermitted { return reply(false, code: "denied") }
        guard permission == noErr else { return reply(false, code: "permissionError") }
        let source: String
        switch action {
        case "playPause": source = "tell application id \"com.apple.Music\" to playpause"
        case "next": source = "tell application id \"com.apple.Music\" to next track"
        default: return reply(false, code: "unsupportedAction")
        }
        let (_, error) = executeMusicScript(source)
        return error == nil ? reply(true) : reply(false, code: "commandFailed")
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage,
        replyHandler: @escaping (Any?, String?) -> Void
    ) {
        guard message.frameInfo.isMainFrame,
              isTrustedDayleafOrigin(message.frameInfo.securityOrigin),
              let body = message.body as? [String: Any],
              body["version"] as? Int == 1,
              let capability = body["capability"] as? String,
              let action = body["action"] as? String
        else {
            replyHandler(nil, "Malformed or unauthorized Dayleaf widget request")
            return
        }

        if isSmokeTest && capability == "testing" && action == "state" {
            queue.async {
                let result = self.reply(true, data: [
                    "callCount": self.smokeCallCount,
                    "lastProvider": self.smokeLastProvider,
                    "openedProviders": Array(self.smokeOpenedProviders).sorted(),
                ])
                DispatchQueue.main.async { replyHandler(result, nil) }
            }
            return
        }

        guard capability == "music",
              ["authorize", "status", "playPause", "next", "openApp"].contains(action),
              let providerID = body["provider"] as? String,
              let provider = Self.musicProviders[providerID]
        else {
            replyHandler(nil, "Unsupported Dayleaf widget capability")
            return
        }
        queue.async {
            let result = self.handleMusic(action: action, provider: provider)
            DispatchQueue.main.async { replyHandler(result, nil) }
        }
    }
}

final class DayleafAppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKScriptMessageHandler, WKUIDelegate {
    private let isSmokeTest = CommandLine.arguments.contains("--smoke-test")
    private let isBackupVerification = CommandLine.arguments.contains("--verify-only")
    private let importBackupURL: URL? = {
        guard
            let optionIndex = CommandLine.arguments.firstIndex(of: "--import-backup"),
            CommandLine.arguments.indices.contains(optionIndex + 1)
        else {
            return nil
        }
        return URL(fileURLWithPath: CommandLine.arguments[optionIndex + 1])
    }()
    private var window: NSWindow?
    private var webView: WKWebView?
    private var closeIsAllowed = false
    private var terminationRequested = false
    private var widgetBridge: DayleafWidgetBridge?
    private var widgetSmokePassed = false

    private func makeMenuItem(
        _ title: String,
        action: Selector?,
        key: String = "",
        modifiers: NSEvent.ModifierFlags = [.command],
        target: AnyObject? = nil
    ) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: action, keyEquivalent: key)
        item.keyEquivalentModifierMask = modifiers
        item.target = target
        return item
    }

    private func configureMainMenu() {
        let mainMenu = NSMenu(title: "Dayleaf")

        let appMenuItem = NSMenuItem()
        let appMenu = NSMenu(title: "日叶")
        appMenu.addItem(makeMenuItem("关于日叶", action: #selector(showAboutPanel(_:)), target: self))
        appMenu.addItem(.separator())
        appMenu.addItem(makeMenuItem("隐藏日叶", action: #selector(NSApplication.hide(_:)), key: "h", target: NSApp))
        appMenu.addItem(makeMenuItem(
            "隐藏其他应用",
            action: #selector(NSApplication.hideOtherApplications(_:)),
            key: "h",
            modifiers: [.command, .option],
            target: NSApp
        ))
        appMenu.addItem(makeMenuItem("全部显示", action: #selector(NSApplication.unhideAllApplications(_:)), target: NSApp))
        appMenu.addItem(.separator())
        appMenu.addItem(makeMenuItem("退出日叶", action: #selector(NSApplication.terminate(_:)), key: "q", target: NSApp))
        appMenuItem.submenu = appMenu
        mainMenu.addItem(appMenuItem)

        let fileMenuItem = NSMenuItem()
        let fileMenu = NSMenu(title: "文件")
        fileMenu.addItem(makeMenuItem("写新日记", action: #selector(createNewEntryFromMenu(_:)), key: "n", target: self))
        fileMenu.addItem(makeMenuItem("保存日记", action: #selector(saveEntryFromMenu(_:)), key: "s", target: self))
        fileMenu.addItem(.separator())
        fileMenu.addItem(makeMenuItem("关闭窗口", action: #selector(NSWindow.performClose(_:)), key: "w"))
        fileMenuItem.submenu = fileMenu
        mainMenu.addItem(fileMenuItem)

        let editMenuItem = NSMenuItem()
        let editMenu = NSMenu(title: "编辑")
        editMenu.addItem(makeMenuItem("撤销", action: #selector(undoFromMenu(_:)), key: "z", target: self))
        editMenu.addItem(makeMenuItem(
            "重做",
            action: #selector(redoFromMenu(_:)),
            key: "z",
            modifiers: [.command, .shift],
            target: self
        ))
        editMenu.addItem(.separator())
        editMenu.addItem(makeMenuItem("剪切", action: #selector(NSText.cut(_:)), key: "x"))
        editMenu.addItem(makeMenuItem("复制", action: #selector(NSText.copy(_:)), key: "c"))
        editMenu.addItem(makeMenuItem("粘贴", action: #selector(NSText.paste(_:)), key: "v"))
        editMenu.addItem(makeMenuItem("全选", action: #selector(NSText.selectAll(_:)), key: "a"))
        editMenu.addItem(.separator())
        editMenu.addItem(makeMenuItem("搜索日记", action: #selector(focusSearchFromMenu(_:)), key: "f", target: self))
        editMenuItem.submenu = editMenu
        mainMenu.addItem(editMenuItem)

        let windowMenuItem = NSMenuItem()
        let windowMenu = NSMenu(title: "窗口")
        windowMenu.addItem(makeMenuItem("最小化", action: #selector(NSWindow.performMiniaturize(_:)), key: "m"))
        windowMenu.addItem(makeMenuItem("缩放", action: #selector(NSWindow.performZoom(_:))))
        windowMenu.addItem(.separator())
        windowMenu.addItem(makeMenuItem("前置全部窗口", action: #selector(NSApplication.arrangeInFront(_:)), target: NSApp))
        windowMenuItem.submenu = windowMenu
        mainMenu.addItem(windowMenuItem)

        NSApp.mainMenu = mainMenu
        NSApp.windowsMenu = windowMenu
    }

    @objc private func showAboutPanel(_ sender: Any?) {
        NSApp.orderFrontStandardAboutPanel(sender)
    }

    private func runDayleafCommand(_ command: String, fallbackAction: Selector? = nil) {
        webView?.evaluateJavaScript("window.dayleafCommands?.\(command)?.()") { result, error in
            if let error {
                NSLog("Dayleaf command failed: %@", error.localizedDescription)
                return
            }
            if (result as? Bool) != true, let fallbackAction {
                NSApp.sendAction(fallbackAction, to: nil, from: self)
            }
        }
    }

    @objc private func createNewEntryFromMenu(_ sender: Any?) {
        runDayleafCommand("newEntry")
    }

    @objc private func saveEntryFromMenu(_ sender: Any?) {
        runDayleafCommand("save")
    }

    @objc private func focusSearchFromMenu(_ sender: Any?) {
        runDayleafCommand("focusSearch")
    }

    @objc private func undoFromMenu(_ sender: Any?) {
        runDayleafCommand("undo", fallbackAction: Selector(("undo:")))
    }

    @objc private func redoFromMenu(_ sender: Any?) {
        runDayleafCommand("redo", fallbackAction: Selector(("redo:")))
    }

    private func findMenuItem(titled title: String, in menu: NSMenu?) -> NSMenuItem? {
        guard let menu else {
            return nil
        }
        for item in menu.items {
            if item.title == title {
                return item
            }
            if let nested = findMenuItem(titled: title, in: item.submenu) {
                return nested
            }
        }
        return nil
    }

    private func printShortcutMenuSmokeState() {
        func matches(
            _ title: String,
            key: String,
            modifiers: NSEvent.ModifierFlags = [.command],
            action: Selector
        ) -> Bool {
            guard let item = findMenuItem(titled: title, in: NSApp.mainMenu) else {
                return false
            }
            return item.keyEquivalent == key &&
                item.keyEquivalentModifierMask == modifiers &&
                item.action == action
        }

        let state: [String: Bool] = [
            "newEntry": matches("写新日记", key: "n", action: #selector(createNewEntryFromMenu(_:))),
            "save": matches("保存日记", key: "s", action: #selector(saveEntryFromMenu(_:))),
            "undo": matches("撤销", key: "z", action: #selector(undoFromMenu(_:))),
            "redo": matches("重做", key: "z", modifiers: [.command, .shift], action: #selector(redoFromMenu(_:))),
            "cut": matches("剪切", key: "x", action: #selector(NSText.cut(_:))),
            "copy": matches("复制", key: "c", action: #selector(NSText.copy(_:))),
            "paste": matches("粘贴", key: "v", action: #selector(NSText.paste(_:))),
            "selectAll": matches("全选", key: "a", action: #selector(NSText.selectAll(_:))),
            "find": matches("搜索日记", key: "f", action: #selector(focusSearchFromMenu(_:)))
        ]
        guard
            let data = try? JSONSerialization.data(withJSONObject: state, options: [.sortedKeys]),
            let json = String(data: data, encoding: .utf8)
        else {
            print("DAYLEAF_SHORTCUT_MENU_ERROR encoding failed")
            return
        }
        print("DAYLEAF_SHORTCUT_MENU \(json)")
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(importBackupURL == nil ? .regular : .accessory)
        if importBackupURL == nil {
            configureMainMenu()
        }

        let contentController = WKUserContentController()
        contentController.add(self, name: "dayleafSaveFile")
        let widgetBridge = DayleafWidgetBridge(isSmokeTest: isSmokeTest)
        contentController.addScriptMessageHandler(widgetBridge, contentWorld: .page, name: "dayleafWidgets")
        self.widgetBridge = widgetBridge

        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = isSmokeTest ? .nonPersistent() : .default()
        configuration.userContentController = contentController
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self

        let defaultFrame = NSRect(x: 0, y: 0, width: 1280, height: 820)
        let window = NSWindow(
            contentRect: defaultFrame,
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "日叶 Dayleaf"
        window.minSize = NSSize(width: 900, height: 620)
        window.backgroundColor = NSColor(
            calibratedRed: 244.0 / 255.0,
            green: 240.0 / 255.0,
            blue: 231.0 / 255.0,
            alpha: 1
        )
        window.contentView = webView
        window.delegate = self

        if !window.setFrameUsingName("DayleafMainWindow") {
            window.center()
        }
        window.setFrameAutosaveName("DayleafMainWindow")

        self.window = window
        self.webView = webView

        loadApplication(in: webView)
    }

    private func loadApplication(in webView: WKWebView) {
        guard
            let htmlURL = Bundle.main.url(forResource: "Dayleaf", withExtension: "html"),
            let html = try? String(contentsOf: htmlURL, encoding: .utf8)
        else {
            showFatalError("无法读取 Dayleaf 界面资源。请重新运行 Install.command。")
            return
        }

        webView.loadHTMLString(html, baseURL: dayleafOrigin)
    }

    private func showFatalError(_ message: String) {
        let alert = NSAlert()
        alert.alertStyle = .critical
        alert.messageText = "Dayleaf 无法启动"
        alert.informativeText = message
        alert.runModal()
        NSApp.terminate(nil)
    }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        if closeIsAllowed {
            return true
        }

        flushJournal { didSave in
            guard didSave else {
                self.showUnsavedChangesAlert()
                return
            }
            self.closeIsAllowed = true
            sender.performClose(nil)
        }
        return false
    }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        if terminationRequested {
            return .terminateNow
        }

        terminationRequested = true
        flushJournal { didSave in
            if !didSave {
                self.terminationRequested = false
            }
            sender.reply(toApplicationShouldTerminate: didSave)
            if !didSave {
                self.showUnsavedChangesAlert()
            }
        }
        return .terminateLater
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    private func showUnsavedChangesAlert() {
        guard let window, !isSmokeTest else {
            return
        }
        let alert = NSAlert()
        alert.alertStyle = .warning
        alert.messageText = "内容还没有保存"
        alert.informativeText = "本机存储空间不足。请继续编辑，清理一张图片、表情包或提示回答后再关闭 Dayleaf。"
        alert.addButton(withTitle: "继续编辑")
        alert.beginSheetModal(for: window)
    }

    private func flushJournal(completion: @escaping (Bool) -> Void) {
        guard let webView else {
            completion(true)
            return
        }

        var didFinish = false
        func finishOnce(_ didSave: Bool) {
            guard !didFinish else {
                return
            }
            didFinish = true
            completion(didSave)
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.75) {
            finishOnce(false)
        }
        webView.evaluateJavaScript("window.dayleafNativePrepareToClose?.()") { result, error in
            DispatchQueue.main.async {
                guard error == nil else {
                    finishOnce(false)
                    return
                }
                finishOnce((result as? Bool) ?? true)
            }
        }
    }

    func webView(
        _ webView: WKWebView,
        runOpenPanelWith parameters: WKOpenPanelParameters,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping ([URL]?) -> Void
    ) {
        guard let window else {
            completionHandler(nil)
            return
        }

        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.json, .image]
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.canChooseDirectories = parameters.allowsDirectories
        panel.canChooseFiles = true

        panel.beginSheetModal(for: window) { response in
            completionHandler(response == .OK ? panel.urls : nil)
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard
            message.name == "dayleafSaveFile",
            let payload = message.body as? [String: Any],
            let name = payload["name"] as? String,
            let content = payload["content"] as? String,
            let window
        else {
            return
        }

        let panel = NSSavePanel()
        panel.nameFieldStringValue = name
        panel.canCreateDirectories = true
        panel.isExtensionHidden = false

        panel.beginSheetModal(for: window) { response in
            guard response == .OK, let destination = panel.url else {
                return
            }

            do {
                try content.write(to: destination, atomically: true, encoding: .utf8)
            } catch {
                let alert = NSAlert(error: error)
                alert.beginSheetModal(for: window)
            }
        }
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }

        if isTrustedDayleafURL(url) || url.scheme == "about" || url.scheme == "blob" {
            decisionHandler(.allow)
            return
        }

        if navigationAction.navigationType == .linkActivated {
            NSWorkspace.shared.open(url)
        }
        decisionHandler(.cancel)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        if importBackupURL != nil {
            importBackup(in: webView)
            return
        }

        window?.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        webView.evaluateJavaScript("window.dayleafNativeDidShow?.()")

        guard isSmokeTest else {
            return
        }

        printShortcutMenuSmokeState()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
            webView.evaluateJavaScript("JSON.stringify(window.dayleafTesting?.getSplashState?.())") { result, error in
                if let error {
                    print("DAYLEAF_SPLASH_INITIAL_ERROR \(error.localizedDescription)")
                } else if let result = result as? String {
                    print("DAYLEAF_SPLASH_INITIAL \(result)")
                }
            }
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.75) {
            webView.takeSnapshot(with: nil) { image, snapshotError in
                if let image,
                   let tiff = image.tiffRepresentation,
                   let bitmap = NSBitmapImageRep(data: tiff),
                   let png = bitmap.representation(using: .png, properties: [:]) {
                    do {
                        try png.write(to: URL(fileURLWithPath: "/tmp/dayleaf-native-splash.png"))
                        print("DAYLEAF_SPLASH_SCREENSHOT /tmp/dayleaf-native-splash.png")
                    } catch {
                        print("DAYLEAF_SPLASH_INITIAL_ERROR \(error.localizedDescription)")
                    }
                } else if let snapshotError {
                    print("DAYLEAF_SPLASH_INITIAL_ERROR \(snapshotError.localizedDescription)")
                }
            }
        }

        let widgetSmokeScript = """
        const initial = window.dayleafTesting?.getDashboardState?.() || {};
        const bridgeBefore = await window.dayleafTesting?.getNativeWidgetSmokeState?.();
        const defaultOff =
          initial.homeWidgets?.reflection === false &&
          initial.homeWidgets?.music === false &&
          initial.homeWidgets?.breathing === false &&
          initial.music?.provider === "appleMusic" &&
          initial.music?.mode === "full" &&
          initial.widgetLayout === "none" &&
          initial.widgetStartVisible === false &&
          initial.widgetEndVisible === false &&
          bridgeBefore?.ok === true &&
          bridgeBefore?.data?.callCount === 0;

        const reflectionEnabled = await window.dayleafTesting?.setHomeWidget?.("reflection", true);
        const reflectionState = window.dayleafTesting?.getDashboardState?.() || {};
        const reflectionWorks = reflectionEnabled === true &&
          reflectionState.widgetLayout === "start" &&
          reflectionState.widgetStartVisible === true;
        await window.dayleafTesting?.setHomeWidget?.("reflection", false);

        const musicEnabled = await window.dayleafTesting?.setHomeWidget?.("music", true);
        await window.dayleafTesting?.refreshMusic?.();
        const musicState = window.dayleafTesting?.getDashboardState?.() || {};
        const musicFakeWorks = musicEnabled === true &&
          musicState.homeWidgets?.music === true &&
          musicState.widgetLayout === "end" &&
          musicState.widgetEndVisible === true &&
          musicState.music?.phase === "ready" &&
          musicState.music?.running === true &&
          musicState.music?.title === "无痕测试曲目";
        await window.dayleafTesting?.performMusicAction?.("playPause");
        const bridgeAfterMusic = await window.dayleafTesting?.getNativeWidgetSmokeState?.();
        const musicBridgeCalled = bridgeAfterMusic?.ok === true &&
          bridgeAfterMusic?.data?.callCount >= 4;
        await window.dayleafTesting?.setHomeWidget?.("music", false);

        const neteaseSelected = window.dayleafTesting?.setMusicProvider?.("netease") === true;
        const neteaseEnabled = await window.dayleafTesting?.setHomeWidget?.("music", true);
        await window.dayleafTesting?.refreshMusic?.();
        const neteaseState = window.dayleafTesting?.getDashboardState?.() || {};
        const bridgeBeforeUnsupported = await window.dayleafTesting?.getNativeWidgetSmokeState?.();
        await window.dayleafTesting?.performMusicAction?.("playPause");
        const bridgeAfterUnsupported = await window.dayleafTesting?.getNativeWidgetSmokeState?.();
        const neteaseLaunchOnlyWorks = neteaseSelected === true &&
          neteaseEnabled === true &&
          neteaseState.music?.provider === "netease" &&
          neteaseState.music?.mode === "launchOnly" &&
          neteaseState.music?.phase === "limited" &&
          neteaseState.music?.running === true &&
          neteaseState.music?.title === "" &&
          neteaseState.music?.playButtonHidden === true &&
          neteaseState.music?.nextButtonHidden === true &&
          bridgeAfterUnsupported?.data?.lastProvider === "netease";
        const unsupportedControlNotSent = bridgeBeforeUnsupported?.data?.callCount ===
          bridgeAfterUnsupported?.data?.callCount;
        await window.dayleafTesting?.setHomeWidget?.("music", false);

        const qqMusicSelected = window.dayleafTesting?.setMusicProvider?.("qqMusic") === true;
        const qqMusicEnabled = await window.dayleafTesting?.setHomeWidget?.("music", true);
        await window.dayleafTesting?.refreshMusic?.();
        const qqMusicState = window.dayleafTesting?.getDashboardState?.() || {};
        const bridgeAfterQQMusic = await window.dayleafTesting?.getNativeWidgetSmokeState?.();
        const qqMusicLaunchOnlyWorks = qqMusicSelected === true &&
          qqMusicEnabled === true &&
          qqMusicState.music?.provider === "qqMusic" &&
          qqMusicState.music?.mode === "launchOnly" &&
          qqMusicState.music?.phase === "limited" &&
          qqMusicState.music?.playButtonHidden === true &&
          bridgeAfterQQMusic?.data?.lastProvider === "qqMusic" &&
          bridgeAfterQQMusic?.data?.openedProviders?.includes("qqMusic") === true;
        await window.dayleafTesting?.setHomeWidget?.("music", false);
        const providerReset = window.dayleafTesting?.setMusicProvider?.("appleMusic") === true;

        const breathingEnabled = await window.dayleafTesting?.setHomeWidget?.("breathing", true);
        const breathingStarted = window.dayleafTesting?.toggleBreathing?.() === true;
        await new Promise((resolve) => setTimeout(resolve, 350));
        const breathingState = window.dayleafTesting?.getDashboardState?.() || {};
        const breathingWorks = breathingEnabled === true &&
          breathingStarted &&
          breathingState.breathing?.running === true &&
          breathingState.breathing?.remainingMs > 0 &&
          breathingState.breathing?.remainingMs < 60000;
        await window.dayleafTesting?.setHomeWidget?.("breathing", false);

        const finalState = window.dayleafTesting?.getDashboardState?.() || {};
        const disablingStopsWidgets =
          finalState.homeWidgets?.reflection === false &&
          finalState.homeWidgets?.music === false &&
          finalState.homeWidgets?.breathing === false &&
          finalState.widgetLayout === "none" &&
          finalState.widgetStartVisible === false &&
          finalState.widgetEndVisible === false &&
          finalState.breathing?.running === false &&
          finalState.music?.provider === "appleMusic";

        return JSON.stringify({
          defaultOff,
          reflectionWorks,
          musicFakeWorks,
          musicBridgeCalled,
          neteaseLaunchOnlyWorks,
          qqMusicLaunchOnlyWorks,
          unsupportedControlNotSent,
          providerReset,
          breathingWorks,
          disablingStopsWidgets,
          musicEnabledValue: musicEnabled,
          musicState,
          bridgeBefore,
          bridgeAfterMusic,
          bridgeAfterQQMusic
        });
        """

        DispatchQueue.main.asyncAfter(deadline: .now() + 2.95) {
            Task { @MainActor in
                do {
                    let value = try await webView.callAsyncJavaScript(
                        widgetSmokeScript,
                        arguments: [:],
                        in: nil,
                        contentWorld: .page
                    )
                    guard let json = value as? String,
                          let data = json.data(using: .utf8),
                          let state = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
                    else {
                        print("DAYLEAF_WIDGET_SMOKE_ERROR invalid result")
                        return
                    }
                    let required = [
                        "defaultOff", "reflectionWorks", "musicFakeWorks",
                        "musicBridgeCalled", "neteaseLaunchOnlyWorks", "qqMusicLaunchOnlyWorks",
                        "unsupportedControlNotSent", "providerReset", "breathingWorks", "disablingStopsWidgets"
                    ]
                    self.widgetSmokePassed = required.allSatisfy { state[$0] as? Bool == true }
                    print("DAYLEAF_WIDGET_SMOKE_STATE \(json)")
                } catch {
                    print("DAYLEAF_WIDGET_SMOKE_ERROR \(error.localizedDescription)")
                }
            }
        }

        let smokeScript = """
        (() => {
          const splashState = window.dayleafTesting?.getSplashState?.() || {};
          const shortcutProfile = window.dayleafTesting?.getShortcutProfile?.() || {};
          const dashboardInitial = window.dayleafTesting?.getDashboardState?.() || {};
          const dashboardStartsHome =
            dashboardInitial.view === "home" &&
            dashboardInitial.selectedId === null &&
            dashboardInitial.dateFilter === null &&
            dashboardInitial.journalPanelInert === true &&
            dashboardInitial.editorInert === true &&
            dashboardInitial.entryCount === 0 &&
            dashboardInitial.promptIndex >= 0 &&
            dashboardInitial.promptIndex < dashboardInitial.promptCount &&
            Boolean(dashboardInitial.prompt);
          const editShortcutPassthrough = [
            { key: "x", metaKey: true },
            { key: "c", metaKey: true },
            { key: "v", metaKey: true },
            { key: "a", metaKey: true },
            { key: "z", metaKey: true },
            { key: "z", metaKey: true, shiftKey: true },
            { key: "y", ctrlKey: true }
          ].every((options) => {
            const event = new KeyboardEvent("keydown", {
              ...options,
              bubbles: true,
              cancelable: true
            });
            document.dispatchEvent(event);
            return !event.defaultPrevented;
          });
          const commandFind = new KeyboardEvent("keydown", {
            key: "f",
            metaKey: true,
            bubbles: true,
            cancelable: true
          });
          document.dispatchEvent(commandFind);
          const commandFindFocused = commandFind.defaultPrevented &&
            document.activeElement === document.querySelector("#search-input");
          const controlFind = new KeyboardEvent("keydown", {
            key: "f",
            ctrlKey: true,
            bubbles: true,
            cancelable: true
          });
          document.dispatchEvent(controlFind);
          const controlFindFocused = controlFind.defaultPrevented &&
            document.activeElement === document.querySelector("#search-input");

          document.querySelector("#brand-button")?.click();

          let storageAvailable = false;
          try {
            localStorage.setItem("dayleaf.smoke", "ok");
            storageAvailable = localStorage.getItem("dayleaf.smoke") === "ok";
            localStorage.removeItem("dayleaf.smoke");
          } catch {}

          const title = document.querySelector("#entry-title");
          const content = document.querySelector("#entry-content");
          const promptAnswerField = document.querySelector("#prompt-answer");
          const promptQuestion = document.querySelector("#daily-prompt")?.textContent || "";
          const promptAnswer = "今天值得记住的是一次安静而完整的自动验收。";
          const promptEntryCreated = Boolean(
            window.dayleafTesting?.submitPromptAnswer?.(promptAnswer)
          );
          const promptAnswerCreatesEntry =
            promptEntryCreated &&
            content?.textContent?.includes(promptQuestion) &&
            content?.textContent?.includes(promptAnswer) &&
            document.querySelector("#workspace")?.dataset.view === "editor" &&
            promptAnswerField instanceof HTMLTextAreaElement &&
            promptAnswerField.value === "";

          if (title && content) {
            title.value = "原生窗口验收 1";
            title.dispatchEvent(new Event("input", { bubbles: true }));
            content.textContent = "这是第一篇仅存在于无痕自检中的临时日记。";
            content.dispatchEvent(new Event("input", { bubbles: true }));
          }

          document.querySelector("#new-entry-button")?.click();
          if (title && content) {
            title.value = "原生窗口验收 2";
            title.dispatchEvent(new Event("input", { bubbles: true }));
            content.textContent = "这是同一天的第二篇无痕临时日记。";
            content.dispatchEvent(new Event("input", { bubbles: true }));

            const textNode = content.firstChild;
            if (textNode) {
              const range = document.createRange();
              range.setStart(textNode, 2);
              range.collapse(true);
              const selection = window.getSelection();
              selection.removeAllRanges();
              selection.addRange(range);
              content.focus();
              document.querySelector("#sticker-button")?.click();
              document.querySelector('[data-emoji="😊"]')?.click();
            }

            window.dayleafTesting?.insertMediaDataUrl(
              "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
              "image",
              { alt: "图片：原生自检", attribution: "Dayleaf 自动验收素材 · CC0" }
            );
          }
          const imageBeforeUndo = Boolean(content?.querySelector('img.diary-image'));
          const imageUndoSucceeded = Boolean(window.dayleafCommands?.undo?.()) &&
            !content?.querySelector('img.diary-image');
          const imageRedoSucceeded = Boolean(window.dayleafCommands?.redo?.()) &&
            Boolean(content?.querySelector('img.diary-image'));
          window.dayleafNativePrepareToClose?.();

          const selectedImage = content?.querySelector('img.diary-image');
          selectedImage?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
          const selectedMedia = document.createElement("div");
          const selectedRange = window.getSelection()?.rangeCount
            ? window.getSelection().getRangeAt(0)
            : null;
          if (selectedRange) selectedMedia.append(selectedRange.cloneContents());
          const mediaCutCopySelectionWorks =
            Boolean(selectedMedia.querySelector('img.diary-image')) &&
            Boolean(selectedMedia.querySelector('.media-credit')) &&
            Boolean(selectedMedia.querySelector('div br'));

          const beforeFailedMediaPaste = content?.innerHTML || "";
          window.dayleafTesting?.failNextSave();
          const richMediaPasteHandled = Boolean(window.dayleafTesting?.pasteRichContent?.(
            '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=" data-media-kind="image" alt="剪贴板图片">'
          ));
          const richMediaPasteRollbackSucceeded =
            richMediaPasteHandled &&
            content?.innerHTML === beforeFailedMediaPaste &&
            window.dayleafNativePrepareToClose?.() === true;

          content?.append(document.createTextNode(" 保存失败复验"));
          content?.dispatchEvent(new Event("input", { bubbles: true }));
          window.dayleafTesting?.failNextSave();
          const saveFailureBlocked = window.dayleafNativePrepareToClose?.() === false;
          const saveFailureVisible = document.querySelector("#save-status")?.textContent === "保存失败";
          const retrySaveSucceeded = window.dayleafNativePrepareToClose?.() === true;

          let richEntry = null;
          try {
            richEntry = JSON.parse(localStorage.getItem("dayleaf.entries.v1") || "[]")
              .find((entry) => entry.title === "原生窗口验收 2");
          } catch {}
          const caretEmojiInserted = Boolean(
            richEntry?.content?.includes("这是😊") &&
            richEntry?.content?.includes("同一天")
          );
          const imageInserted = richEntry?.content?.includes('class="diary-image"') || false;
          const richContentSupport =
            richEntry?.contentFormat === "html" && caretEmojiInserted && imageInserted;
          const sanitizedSample = window.dayleafTesting?.sanitizeRichContent(
            '<script>window.bad = true</script>' +
            '<img src="https://tracker.example/pixel.png" onerror="window.bad = true" alt="远程图">' +
            '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=" onerror="window.bad = true" data-media-kind="sticker">'
          ) || "";
          const richSanitizerWorks =
            !sanitizedSample.includes("script") &&
            !sanitizedSample.includes("onerror") &&
            !sanitizedSample.includes("tracker.example") &&
            sanitizedSample.includes("inline-sticker");

          document.querySelector(".calendar-day.today")?.click();

          const entryCount = document.querySelector("#entry-count")?.textContent;
          const dateListCardCount = document.querySelectorAll(".entry-card").length;
          const calendarCount = document.querySelector(".calendar-day.today .calendar-day-count")?.textContent;
          const dateListTitle = document.querySelector("#list-title")?.textContent;
          const dateSelectionState = window.dayleafTesting?.getDashboardState?.() || {};
          const dateSelectionDoesNotOpenEntry =
            dateSelectionState.view === "list" &&
            dateSelectionState.selectedId === null &&
            dateSelectionState.editorInert === true;
          const clearDateFilter = document.querySelector("#clear-date-filter");
          const clearDateFilterVisible = clearDateFilter && !clearDateFilter.hidden;
          clearDateFilter?.click();
          const allListTitle = document.querySelector("#list-title")?.textContent;
          document.querySelector(".entry-card")?.click();
          const editorReopenedFromList =
            document.querySelector("#workspace")?.dataset.view === "editor" &&
            Boolean(document.querySelector("#entry-form:not([hidden])"));
          document.querySelector("#sticker-button")?.click();
          const mediaDialogOpened = Boolean(document.querySelector("#media-dialog")?.open);
          document.querySelector("#image-tab")?.click();
          const imagePanelVisible = document.querySelector("#image-panel")?.hidden === false;

          return JSON.stringify({
            documentTitle: document.title,
            splashDebug: splashState,
            splashHidden: splashState.phase === "hidden" && splashState.splashHidden === true,
            splashQuoteValid:
              splashState.quoteIndex >= 0 &&
              splashState.quoteIndex < splashState.quoteCount &&
              Boolean(splashState.quote) &&
              Boolean(splashState.source),
            splashTimingValid:
              splashState.plannedDuration >= 2000 &&
              splashState.plannedDuration <= 3000 &&
              splashState.visibleDuration >= 2000 &&
              splashState.visibleDuration <= 3000,
            splashAppReady: splashState.appReady === true && splashState.mainInert === false,
            appShell: Boolean(document.querySelector(".app-shell")),
            editorVisible: Boolean(document.querySelector("#entry-form:not([hidden])")),
            dashboardStartsHome,
            promptAnswerCreatesEntry,
            nativeMode: document.documentElement.classList.contains("native-app"),
            nativeSaveBridge: Boolean(window.webkit?.messageHandlers?.dayleafSaveFile),
            storageAvailable,
            sameDayEntryCount: entryCount,
            dateListCardCount,
            calendarCount,
            dateListTitle,
            dateSelectionDoesNotOpenEntry,
            clearDateFilterVisible,
            allListTitle,
            editorReopenedFromList,
            caretEmojiInserted,
            imageInserted,
            richContentSupport,
            richSanitizerWorks,
            imageUndoSucceeded: imageBeforeUndo && imageUndoSucceeded,
            imageRedoSucceeded,
            mediaCutCopySelectionWorks,
            richMediaPasteRollbackSucceeded,
            editShortcutPassthrough,
            commandFindFocused,
            controlFindFocused,
            nativeShortcutLabel: shortcutProfile.modifier === "⌘",
            saveFailureBlocked,
            saveFailureVisible,
            retrySaveSucceeded,
            mediaDialogOpened,
            imagePanelVisible,
            multipleEntrySupport:
              entryCount === "2" &&
              dateListCardCount === 2 &&
              calendarCount === "2" &&
              dateListTitle?.endsWith("2篇") &&
              dateSelectionDoesNotOpenEntry &&
              clearDateFilterVisible &&
              allListTitle === "所有日记" &&
              editorReopenedFromList
          });
        })()
        """

        DispatchQueue.main.asyncAfter(deadline: .now() + 4.6) {
          webView.evaluateJavaScript(smokeScript) { result, error in
            var smokePassed = false
            if let error {
                print("DAYLEAF_SMOKE_ERROR \(error.localizedDescription)")
            } else if let result = result as? String {
                print("DAYLEAF_SMOKE_STATE \(result)")
                if let data = result.data(using: .utf8),
                   let state = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    let requiredAssertions = [
                        "splashHidden", "splashQuoteValid", "splashTimingValid", "splashAppReady",
                        "appShell", "editorVisible", "dashboardStartsHome", "promptAnswerCreatesEntry",
                        "nativeMode", "nativeSaveBridge", "storageAvailable", "dateSelectionDoesNotOpenEntry",
                        "clearDateFilterVisible", "editorReopenedFromList", "caretEmojiInserted", "imageInserted",
                        "richContentSupport", "richSanitizerWorks", "imageUndoSucceeded", "imageRedoSucceeded",
                        "mediaCutCopySelectionWorks", "richMediaPasteRollbackSucceeded", "editShortcutPassthrough",
                        "commandFindFocused", "controlFindFocused", "nativeShortcutLabel", "saveFailureBlocked",
                        "saveFailureVisible", "retrySaveSucceeded", "mediaDialogOpened", "imagePanelVisible",
                        "multipleEntrySupport"
                    ]
                    smokePassed = self.widgetSmokePassed &&
                        requiredAssertions.allSatisfy { state[$0] as? Bool == true }
                }
            }

            DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
                var snapshotPassed = false
                webView.takeSnapshot(with: nil) { image, snapshotError in
                    if let image,
                       let tiff = image.tiffRepresentation,
                       let bitmap = NSBitmapImageRep(data: tiff),
                       let png = bitmap.representation(using: .png, properties: [:]) {
                        do {
                            try png.write(to: URL(fileURLWithPath: "/tmp/dayleaf-native-smoke.png"))
                            print("DAYLEAF_SMOKE_SCREENSHOT /tmp/dayleaf-native-smoke.png")
                            snapshotPassed = true
                        } catch {
                            print("DAYLEAF_SMOKE_ERROR \(error.localizedDescription)")
                        }
                    } else if let snapshotError {
                        print("DAYLEAF_SMOKE_ERROR \(snapshotError.localizedDescription)")
                    }
                    if smokePassed && snapshotPassed {
                        self.window?.performClose(nil)
                    } else {
                        print("DAYLEAF_SMOKE_FAILED true")
                        exit(1)
                    }
                }
            }
          }
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        showFatalError("界面加载失败：\(error.localizedDescription)")
    }

    func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: Error
    ) {
        showFatalError("界面加载失败：\(error.localizedDescription)")
    }

    private func importBackup(in webView: WKWebView) {
        guard let importBackupURL else {
            finishImport(with: "DAYLEAF_IMPORT_ERROR missing backup path")
            return
        }

        do {
            let backupData = try Data(contentsOf: importBackupURL)
            let backupObject = try JSONSerialization.jsonObject(with: backupData)
            guard
                let backup = backupObject as? [String: Any],
                backup["app"] as? String == "Dayleaf",
                backup["entries"] is [[String: Any]],
                let backupText = String(data: backupData, encoding: .utf8),
                let encodedText = String(data: try JSONEncoder().encode(backupText), encoding: .utf8)
            else {
                finishImport(with: "DAYLEAF_IMPORT_ERROR invalid Dayleaf backup")
                return
            }

            let functionName = isBackupVerification
                ? "window.dayleafNativeVerifyBackup"
                : "window.dayleafNativeImportBackup"
            let resultPrefix = isBackupVerification
                ? "DAYLEAF_VERIFY_RESULT"
                : "DAYLEAF_IMPORT_RESULT"
            let script = "\(functionName)(\(encodedText))"
            webView.evaluateJavaScript(script) { result, error in
                if let error {
                    self.finishImport(with: "DAYLEAF_IMPORT_ERROR \(error.localizedDescription)")
                    return
                }

                guard let result = result as? String else {
                    self.finishImport(with: "DAYLEAF_IMPORT_ERROR missing import result")
                    return
                }
                self.finishImport(with: "\(resultPrefix) \(result)")
            }
        } catch {
            finishImport(with: "DAYLEAF_IMPORT_ERROR \(error.localizedDescription)")
        }
    }

    private func finishImport(with message: String) {
        print(message)
        terminationRequested = true
        closeIsAllowed = true
        DispatchQueue.main.async {
            NSApp.terminate(nil)
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        if isSmokeTest {
            print("DAYLEAF_SMOKE_CLOSED true")
        }
    }
}

private let appDelegate = DayleafAppDelegate()

@main
struct DayleafApplication {
    static func main() {
        let application = NSApplication.shared
        application.delegate = appDelegate
        application.run()
    }
}
