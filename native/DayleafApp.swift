import Cocoa
import UniformTypeIdentifiers
import WebKit

private let dayleafOrigin = URL(string: "https://dayleaf.local/")!

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

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(importBackupURL == nil ? .regular : .accessory)

        let contentController = WKUserContentController()
        contentController.add(self, name: "dayleafSaveFile")

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
        if importBackupURL == nil {
            window.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
        }
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
        alert.messageText = "这篇日记还没有保存"
        alert.informativeText = "本机存储空间不足。请继续编辑，删除一张图片或表情包后再关闭 Dayleaf。"
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

        if url.host == dayleafOrigin.host || url.scheme == "about" || url.scheme == "blob" {
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

        guard isSmokeTest else {
            return
        }

        let smokeScript = """
        (() => {
          let storageAvailable = false;
          try {
            localStorage.setItem("dayleaf.smoke", "ok");
            storageAvailable = localStorage.getItem("dayleaf.smoke") === "ok";
            localStorage.removeItem("dayleaf.smoke");
          } catch {}

          document.querySelector("#empty-new-button")?.click();

          const title = document.querySelector("#entry-title");
          const content = document.querySelector("#entry-content");
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
              { alt: "图片：原生自检" }
            );
          }
          window.dayleafNativePrepareToClose?.();

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
          const clearDateFilter = document.querySelector("#clear-date-filter");
          const clearDateFilterVisible = clearDateFilter && !clearDateFilter.hidden;
          clearDateFilter?.click();
          const allListTitle = document.querySelector("#list-title")?.textContent;
          document.querySelector("#sticker-button")?.click();
          const mediaDialogOpened = Boolean(document.querySelector("#media-dialog")?.open);
          document.querySelector("#image-tab")?.click();
          const imagePanelVisible = document.querySelector("#image-panel")?.hidden === false;

          return JSON.stringify({
            documentTitle: document.title,
            appShell: Boolean(document.querySelector(".app-shell")),
            editorVisible: Boolean(document.querySelector("#entry-form:not([hidden])")),
            nativeMode: document.documentElement.classList.contains("native-app"),
            nativeSaveBridge: Boolean(window.webkit?.messageHandlers?.dayleafSaveFile),
            storageAvailable,
            sameDayEntryCount: entryCount,
            dateListCardCount,
            calendarCount,
            dateListTitle,
            clearDateFilterVisible,
            allListTitle,
            caretEmojiInserted,
            imageInserted,
            richContentSupport,
            richSanitizerWorks,
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
              clearDateFilterVisible &&
              allListTitle === "所有日记"
          });
        })()
        """

        webView.evaluateJavaScript(smokeScript) { result, error in
            if let error {
                print("DAYLEAF_SMOKE_ERROR \(error.localizedDescription)")
            } else if let result = result as? String {
                print("DAYLEAF_SMOKE_STATE \(result)")
            }

            DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
                webView.takeSnapshot(with: nil) { image, snapshotError in
                    if let image,
                       let tiff = image.tiffRepresentation,
                       let bitmap = NSBitmapImageRep(data: tiff),
                       let png = bitmap.representation(using: .png, properties: [:]) {
                        do {
                            try png.write(to: URL(fileURLWithPath: "/tmp/dayleaf-native-smoke.png"))
                            print("DAYLEAF_SMOKE_SCREENSHOT /tmp/dayleaf-native-smoke.png")
                        } catch {
                            print("DAYLEAF_SMOKE_ERROR \(error.localizedDescription)")
                        }
                    } else if let snapshotError {
                        print("DAYLEAF_SMOKE_ERROR \(snapshotError.localizedDescription)")
                    }
                    self.window?.performClose(nil)
                }
            }
        }
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
