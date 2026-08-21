import SwiftUI
import VisionKit

/// Native differentiator over the web app: scan a VIN plate/barcode with the
/// camera instead of typing all 17 characters by hand. Uses VisionKit's
/// on-device DataScannerViewController -- no paid API key, matches the
/// zero-paid-API-key pattern used elsewhere in the portfolio.
struct VINScannerView: UIViewControllerRepresentable {
    var onScan: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    static var isSupported: Bool { DataScannerViewController.isSupported && DataScannerViewController.isAvailable }

    func makeUIViewController(context: Context) -> DataScannerViewController {
        let controller = DataScannerViewController(
            recognizedDataTypes: [.text(textContentType: .none), .barcode()],
            qualityLevel: .accurate,
            isHighFrameRateTrackingEnabled: false,
            isPinchToZoomEnabled: true,
            isGuidanceEnabled: true,
            isHighlightingEnabled: true
        )
        controller.delegate = context.coordinator
        return controller
    }

    func updateUIViewController(_ controller: DataScannerViewController, context: Context) {
        try? controller.startScanning()
    }

    func makeCoordinator() -> Coordinator { Coordinator(onScan: onScan) }

    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        let onScan: (String) -> Void
        init(onScan: @escaping (String) -> Void) { self.onScan = onScan }

        func dataScanner(_ dataScanner: DataScannerViewController, didAdd addedItems: [RecognizedItem], allItems: [RecognizedItem]) {
            for item in addedItems {
                let text: String?
                switch item {
                case .text(let recognized): text = recognized.transcript
                case .barcode(let recognized): text = recognized.payloadStringValue
                @unknown default: text = nil
                }
                guard let text else { continue }
                let candidate = text.uppercased().filter { $0.isLetter || $0.isNumber }
                if candidate.count == 17, !candidate.contains(where: { "IOQ".contains($0) }) {
                    onScan(candidate)
                    return
                }
            }
        }
    }
}

struct VINScannerSheet: View {
    var onScan: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if VINScannerView.isSupported {
                    VINScannerView { vin in
                        onScan(vin)
                        dismiss()
                    }
                    .ignoresSafeArea()
                } else {
                    ContentUnavailableView("Scanning not supported", systemImage: "camera.metering.unknown", description: Text("This device or simulator doesn't support VisionKit text scanning — enter the VIN manually instead."))
                }
            }
            .navigationTitle("Scan VIN")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }
}
