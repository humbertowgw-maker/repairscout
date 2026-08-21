import SwiftUI

struct IncomingRequestsView: View {
    @State private var requests: [QuoteRequest] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var selectedRequest: QuoteRequest?

    var body: some View {
        NavigationStack {
            List {
                if requests.isEmpty && !isLoading {
                    ContentUnavailableView("No requests yet", systemImage: "tray", description: Text("Quote requests from drivers who name your shop show up here."))
                }
                ForEach(requests) { request in
                    Button {
                        selectedRequest = request
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(request.customer).font(.headline)
                                Spacer()
                                Text(request.status).font(.caption)
                            }
                            Text(request.vehicle).font(.subheadline).foregroundStyle(.secondary)
                            Text(request.issue).font(.footnote).lineLimit(2).foregroundStyle(.primary)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
            .navigationTitle("Incoming Requests")
            .task { await load() }
            .refreshable { await load() }
            .sheet(item: $selectedRequest) { request in
                BuildQuoteView(request: request) { updated in
                    if let idx = requests.firstIndex(where: { $0.id == updated.id }) {
                        requests[idx] = updated
                    }
                }
            }
        }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            requests = try await APIClient.fetchQuoteRequests()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct BuildQuoteView: View {
    let request: QuoteRequest
    var onStatusChange: (QuoteRequest) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var laborHoursLow = "1"
    @State private var laborHoursHigh = "2"
    @State private var built: BuildQuoteResponse?
    @State private var isBusy = false
    @State private var errorMessage: String?
    @State private var didSend = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Request") {
                    Text(request.vehicle).font(.subheadline)
                    Text(request.issue).font(.footnote).foregroundStyle(.secondary)
                }

                Section("Labor estimate") {
                    TextField("Low hours", text: $laborHoursLow).keyboardType(.decimalPad)
                    TextField("High hours", text: $laborHoursHigh).keyboardType(.decimalPad)
                    Button {
                        Task { await build() }
                    } label: {
                        if isBusy { ProgressView() } else { Text("Build quote") }
                    }
                    .disabled(isBusy)
                }

                if let errorMessage {
                    Text(errorMessage).font(.footnote).foregroundStyle(.red)
                }

                if let built {
                    quoteSection(title: "Combo (best value)", option: built.quotes.combo)
                    quoteSection(title: "Single-source (fastest)", option: built.quotes.single)

                    Section {
                        Button("Send quote to customer") {
                            Task { await send(built) }
                        }
                        .disabled(isBusy)
                    }
                }

                Section("Status") {
                    Picker("Status", selection: Binding(
                        get: { QuoteRequestStatus(rawValue: request.status) ?? .newRequest },
                        set: { newStatus in Task { await updateStatus(newStatus) } }
                    )) {
                        ForEach(QuoteRequestStatus.allCases, id: \.self) { status in
                            Text(status.rawValue).tag(status)
                        }
                    }
                }
            }
            .navigationTitle("Build Quote")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } }
            }
            .alert("Quote sent", isPresented: $didSend) {
                Button("OK") { dismiss() }
            }
        }
    }

    private func quoteSection(title: String, option: QuoteOption) -> some View {
        Section(title) {
            ForEach(option.lineItems) { item in
                HStack {
                    Text(item.name)
                    Spacer()
                    Text(String(format: "$%.2f", item.totalPrice)).foregroundStyle(.secondary)
                }
                .font(.footnote)
            }
            HStack {
                Text("Total").font(.subheadline.bold())
                Spacer()
                Text(String(format: "$%.0f – $%.0f", option.totalLow, option.totalHigh)).font(.subheadline.bold())
            }
        }
    }

    private func syntheticDiagnosis() -> DiagnosisResult {
        DiagnosisResult(
            summary: request.diagnosisSummary ?? request.issue,
            safetyLevel: "moderado",
            safetyMessage: "Verify all findings with a physical inspection before proceeding.",
            possibleCauses: [DiagnosisCause(
                probability: 70, title: request.issue, reason: request.issue,
                test: "Physical inspection", urgency: "Verify", tone: "neutral", guideCategory: nil
            )],
            estimate: DiagnosisEstimate(
                low: 0, high: 0, partsLow: nil, partsHigh: nil, laborLow: nil, laborHigh: nil,
                laborHoursLow: Double(laborHoursLow) ?? 1, laborHoursHigh: Double(laborHoursHigh) ?? 2,
                confidence: nil, repairLabel: request.issue
            ),
            questions: nil, source: "shop_manual"
        )
    }

    private func build() async {
        isBusy = true
        errorMessage = nil
        defer { isBusy = false }
        do {
            built = try await APIClient.buildQuote(diagnosis: syntheticDiagnosis(), vehicle: nil)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func send(_ built: BuildQuoteResponse) async {
        isBusy = true
        defer { isBusy = false }
        do {
            _ = try await APIClient.sendQuote(
                diagnosis: built.diagnosis, vehicle: built.vehicle,
                quoteCombo: built.quotes.combo, quoteSingle: built.quotes.single,
                customerName: request.customer, customerEmail: nil, customerPhone: nil,
                quoteRequestId: request.id
            )
            didSend = true
            await updateStatus(.quoted)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func updateStatus(_ status: QuoteRequestStatus) async {
        do {
            let updated = try await APIClient.updateQuoteRequestStatus(id: request.id, status: status)
            onStatusChange(updated)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
