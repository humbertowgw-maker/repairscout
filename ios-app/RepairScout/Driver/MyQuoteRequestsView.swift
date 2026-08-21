import SwiftUI

struct MyQuoteRequestsView: View {
    @EnvironmentObject private var auth: AuthStore
    @State private var requests: [QuoteRequest] = []
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            List {
                if myRequests.isEmpty && !isLoading {
                    ContentUnavailableView("No quote requests yet", systemImage: "doc.text.magnifyingglass", description: Text("Get a diagnosis, then request a quote from a shop."))
                }
                ForEach(myRequests) { request in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(request.shopName).font(.headline)
                            Spacer()
                            Text(request.status).font(.caption).padding(.horizontal, 8).padding(.vertical, 2)
                                .background(.secondary.opacity(0.15), in: Capsule())
                        }
                        Text(request.vehicle).font(.subheadline).foregroundStyle(.secondary)
                        Text(request.issue).font(.footnote).lineLimit(2)
                        Text(request.estimate).font(.footnote.bold())
                    }
                }
            }
            .navigationTitle("My Requests")
            .task { await load() }
            .refreshable { await load() }
        }
    }

    // The API doesn't scope /api/quote-requests by driver -- filter client-side
    // by the logged-in user's id (see server/app.js: shopName is only applied
    // as a filter for the shop role).
    private var myRequests: [QuoteRequest] {
        guard let userId = auth.user?.id else { return requests }
        return requests.filter { $0.userId == userId }
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

#Preview {
    MyQuoteRequestsView().environmentObject(AuthStore())
}
