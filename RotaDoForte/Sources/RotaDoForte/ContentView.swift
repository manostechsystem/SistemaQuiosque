import SwiftUI
import WebKit
import AVFoundation
import UserNotifications

struct QRScannerView: UIViewControllerRepresentable {
    var onCodeScanned: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    func makeUIViewController(context: Context) -> UIViewController {
        let controller = UIViewController()
        let session = AVCaptureSession()
        context.coordinator.session = session

        guard let device = AVCaptureDevice.default(for: .video),
              let input = try? AVCaptureDeviceInput(device: device),
              session.canAddInput(input) else {
            return controller
        }
        session.addInput(input)

        let output = AVCaptureMetadataOutput()
        if session.canAddOutput(output) {
            session.addOutput(output)
            output.setMetadataObjectsDelegate(context.coordinator, queue: .main)
            output.metadataObjectTypes = [.qr]
        }

        let preview = AVCaptureVideoPreviewLayer(session: session)
        preview.frame = UIScreen.main.bounds
        preview.videoGravity = .resizeAspectFill
        controller.view.layer.addSublayer(preview)

        DispatchQueue.global(qos: .userInitiated).async {
            session.startRunning()
        }
        return controller
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {}

    class Coordinator: NSObject, AVCaptureMetadataOutputObjectsDelegate {
        var parent: QRScannerView
        var session: AVCaptureSession?
        var didScan = false

        init(_ parent: QRScannerView) { self.parent = parent }

        func metadataOutput(_ output: AVCaptureMetadataOutput,
                            didOutput metadataObjects: [AVMetadataObject],
                            from connection: AVCaptureConnection) {
            guard !didScan,
                  let obj = metadataObjects.first as? AVMetadataMachineReadableCodeObject,
                  let code = obj.stringValue else { return }
            didScan = true
            session?.stopRunning()
            parent.onCodeScanned(code)
            parent.dismiss()
        }
    }
}

struct WebView: UIViewRepresentable {
    let url: URL
    @Binding var isLoading: Bool
    @Binding var errorMessage: String?

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.userContentController.add(context.coordinator, name: "notificar")
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.scrollView.bounces = true
        webView.load(URLRequest(url: url, cachePolicy: .returnCacheDataElseLoad, timeoutInterval: 15))
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        if uiView.url != url {
            uiView.load(URLRequest(url: url, cachePolicy: .returnCacheDataElseLoad, timeoutInterval: 15))
        }
    }

    class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        var parent: WebView
        init(_ parent: WebView) { self.parent = parent }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "notificar",
                  let body = message.body as? [String: Any] else { return }
            let content = UNMutableNotificationContent()
            content.title = (body["titulo"] as? String) ?? "ManosTech — Rota do Forte"
            content.body = (body["corpo"] as? String) ?? "Nova notificação do sistema"
            content.sound = .default
            let req = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil)
            UNUserNotificationCenter.current().add(req)
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            DispatchQueue.main.async {
                self.parent.isLoading = true
                self.parent.errorMessage = nil
            }
        }
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            webView.evaluateJavaScript("document.title + ' ' + (document.body ? document.body.innerText.slice(0, 400) : '')") { result, _ in
                let text = (result as? String) ?? ""
                DispatchQueue.main.async {
                    self.parent.isLoading = false
                    if text.contains("1033") || text.localizedCaseInsensitiveContains("Cloudflare") || text.localizedCaseInsensitiveContains("Argo Tunnel") {
                        self.parent.errorMessage = "Servidor desconectado. Toque abaixo para tentar novamente ou ler o QR Code."
                    }
                }
            }
        }
        func webView(_ webView: WKWebView,
                     decidePolicyFor navigationResponse: WKNavigationResponse,
                     decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
            if let http = navigationResponse.response as? HTTPURLResponse, http.statusCode >= 500 {
                decisionHandler(.cancel)
                DispatchQueue.main.async {
                    self.parent.isLoading = false
                    self.parent.errorMessage = "Servidor desconectado. Toque abaixo para tentar novamente ou ler o QR Code."
                }
                return
            }
            decisionHandler(.allow)
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            DispatchQueue.main.async {
                self.parent.isLoading = false
                self.parent.errorMessage = error.localizedDescription
            }
        }
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            DispatchQueue.main.async {
                self.parent.isLoading = false
                self.parent.errorMessage = error.localizedDescription
            }
        }
    }
}

struct ContentView: View {
    @AppStorage("serverURL") private var serverURL = ""
    @State private var draftURL = ""
    @State private var showScanner = false
    @State private var isLoading = false
    @State private var errorMessage: String?
    private let syncTimer = Timer.publish(every: 3600, on: .main, in: .common).autoconnect()

    var body: some View {
        ZStack {
            if let url = URL(string: serverURL), !serverURL.isEmpty, errorMessage == nil {
                WebView(url: url, isLoading: $isLoading, errorMessage: $errorMessage)
                    .ignoresSafeArea(.container, edges: .bottom)
                    .onAppear {
                        let types: Set<String> = [WKWebsiteDataTypeDiskCache, WKWebsiteDataTypeMemoryCache]
                        WKWebsiteDataStore.default().removeData(ofTypes: types, modifiedSince: .distantPast) {}
                    }
            } else {
                VStack(spacing: 16) {
                    Text("ManosTech — Rota do Forte")
                        .font(.title2.bold())
                    if let err = errorMessage {
                        Text(err)
                            .font(.caption)
                            .foregroundColor(.red)
                            .multilineTextAlignment(.center)
                    } else {
                        Text("Escaneie o QR Code do sistema ou informe o endereço do servidor.")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                    }

                    Button {
                        showScanner = true
                    } label: {
                        Label("Ler QR Code do Sistema", systemImage: "qrcode.viewfinder")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)

                    TextField("https://... ou http://192.168.0.x:3000/mobile.html", text: $draftURL)
                        .textFieldStyle(.roundedBorder)
                        .autocapitalization(.none)
                        .disableAutocorrection(true)

                    Button("Conectar") {
                        let clean = draftURL.trimmingCharacters(in: .whitespacesAndNewlines)
                        if !clean.isEmpty {
                            serverURL = clean
                            errorMessage = nil
                            isLoading = true
                        }
                    }
                    .buttonStyle(.bordered)
                }
                .padding(24)
                .onAppear { draftURL = serverURL }
            }

            if isLoading {
                VStack(spacing: 10) {
                    ProgressView()
                    Text("Conectando...")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding(18)
                .background(.ultraThinMaterial)
                .cornerRadius(12)
            }
        }
        .onReceive(syncTimer) { _ in
            guard !serverURL.isEmpty, errorMessage != nil else { return }
            errorMessage = nil
            isLoading = true
        }
        .sheet(isPresented: $showScanner) {
            QRScannerView { code in
                let clean = code.trimmingCharacters(in: .whitespacesAndNewlines)
                serverURL = clean
                draftURL = clean
                errorMessage = nil
                isLoading = true
            }
        }
    }
}
