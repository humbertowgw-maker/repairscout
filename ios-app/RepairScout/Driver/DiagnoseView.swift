import SwiftUI

struct DiagnoseView: View {
    @State private var description = ""
    @State private var zip = ""
    @State private var mileage = ""
    @State private var vehicles: [Vehicle] = []
    @State private var selectedVehicle: Vehicle?
    @State private var isBusy = false
    @State private var errorMessage: String?
    @State private var result: DiagnosisResult?
    @State private var showingRequestQuote = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Vehicle") {
                    if vehicles.isEmpty {
                        Text("No saved vehicles — add one on the Vehicles tab, or continue without one.")
                            .font(.footnote).foregroundStyle(.secondary)
                    } else {
                        Picker("Vehicle", selection: $selectedVehicle) {
                            Text("None").tag(Vehicle?.none)
                            ForEach(vehicles) { v in
                                Text("\(v.year) \(v.make) \(v.model)").tag(Optional(v))
                            }
                        }
                    }
                }
                Section("What's going on?") {
                    TextEditor(text: $description).frame(minHeight: 100)
                    TextField("ZIP code", text: $zip).keyboardType(.numberPad)
                    TextField("Mileage (optional)", text: $mileage).keyboardType(.numberPad)
                }
                if let errorMessage {
                    Text(errorMessage).font(.footnote).foregroundStyle(.red)
                }
                Section {
                    Button {
                        Task { await diagnose() }
                    } label: {
                        if isBusy { ProgressView() } else { Text("Get AI diagnosis") }
                    }
                    .disabled(isBusy || description.count < 8 || zip.count < 5)
                }

                if let result {
                    DiagnosisResultView(result: result)
                    Section {
                        Button("Request a quote from a shop") { showingRequestQuote = true }
                    }
                }
            }
            .navigationTitle("Diagnose")
            .task { vehicles = (try? await APIClient.fetchVehicles()) ?? [] }
            .sheet(isPresented: $showingRequestQuote) {
                if let result {
                    RequestQuoteView(diagnosis: result, vehicle: selectedVehicle)
                }
            }
        }
    }

    private func diagnose() async {
        isBusy = true
        errorMessage = nil
        defer { isBusy = false }
        do {
            result = try await APIClient.diagnose(description: description, vehicle: selectedVehicle, mileage: mileage.isEmpty ? nil : mileage, zip: zip)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct DiagnosisResultView: View {
    let result: DiagnosisResult

    var body: some View {
        Section("Diagnosis") {
            Text(result.summary).font(.body)
            Label(result.safetyMessage, systemImage: safetyIcon)
                .font(.footnote)
                .foregroundStyle(safetyColor)
        }
        Section("Possible causes") {
            ForEach(result.possibleCauses) { cause in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(cause.title).font(.subheadline.bold())
                        Spacer()
                        Text("\(cause.probability)%").font(.caption).foregroundStyle(.secondary)
                    }
                    Text(cause.reason).font(.caption).foregroundStyle(.secondary)
                }
            }
        }
        Section("Estimate") {
            Text(String(format: "$%.0f – $%.0f", result.estimate.low, result.estimate.high))
                .font(.title3.bold())
            if let label = result.estimate.repairLabel {
                Text(label).font(.footnote).foregroundStyle(.secondary)
            }
        }
    }

    private var safetyIcon: String {
        switch result.safetyLevel {
        case "alto": return "exclamationmark.triangle.fill"
        case "moderado": return "exclamationmark.circle"
        default: return "checkmark.circle"
        }
    }

    private var safetyColor: Color {
        switch result.safetyLevel {
        case "alto": return .red
        case "moderado": return .orange
        default: return .secondary
        }
    }
}

#Preview {
    DiagnoseView()
}
