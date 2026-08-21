import SwiftUI

struct RequestQuoteView: View {
    let diagnosis: DiagnosisResult
    let vehicle: Vehicle?
    @Environment(\.dismiss) private var dismiss

    @State private var shopName = ""
    @State private var zip = ""
    @State private var isBusy = false
    @State private var errorMessage: String?
    @State private var didSubmit = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Shop") {
                    TextField("Shop name", text: $shopName)
                    TextField("ZIP code", text: $zip).keyboardType(.numberPad)
                }
                Section("Included with this request") {
                    Text(diagnosis.summary).font(.footnote).foregroundStyle(.secondary)
                    if let vehicle {
                        Text("\(vehicle.year) \(vehicle.make) \(vehicle.model)").font(.footnote).foregroundStyle(.secondary)
                    }
                }
                if let errorMessage {
                    Text(errorMessage).font(.footnote).foregroundStyle(.red)
                }
            }
            .navigationTitle("Request a quote")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Send") { Task { await submit() } }
                        .disabled(shopName.isEmpty || zip.count < 5 || isBusy)
                }
            }
            .alert("Request sent", isPresented: $didSubmit) {
                Button("OK") { dismiss() }
            }
        }
    }

    private func submit() async {
        isBusy = true
        defer { isBusy = false }
        let vehicleDescription = vehicle.map { "\($0.year) \($0.make) \($0.model)" } ?? "Not specified"
        do {
            try await APIClient.submitQuoteRequest(
                shopName: shopName,
                vehicle: vehicleDescription,
                issue: diagnosis.summary,
                zip: zip,
                estimate: String(format: "$%.0f – $%.0f", diagnosis.estimate.low, diagnosis.estimate.high),
                diagnosisSummary: diagnosis.summary
            )
            didSubmit = true
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
