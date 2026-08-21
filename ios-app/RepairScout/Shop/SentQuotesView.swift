import SwiftUI

struct SentQuotesView: View {
    @State private var quotes: [ItemizedQuote] = []
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            List {
                if quotes.isEmpty && !isLoading {
                    ContentUnavailableView("No quotes sent yet", systemImage: "paperplane", description: Text("Quotes you send from Incoming Requests show up here."))
                }
                ForEach(quotes) { quote in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(quote.customerName).font(.headline)
                            Spacer()
                            if let stage = quote.repairStage {
                                Text(stage).font(.caption).padding(.horizontal, 8).padding(.vertical, 2)
                                    .background(.secondary.opacity(0.15), in: Capsule())
                            }
                        }
                        if quote.customerApproved == true {
                            Label("Approved", systemImage: "checkmark.seal.fill").font(.caption).foregroundStyle(.green)
                        }
                    }
                }
            }
            .navigationTitle("Sent Quotes")
            .task { await load() }
            .refreshable { await load() }
        }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            quotes = try await APIClient.fetchSentQuotes()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

#Preview {
    SentQuotesView()
}
