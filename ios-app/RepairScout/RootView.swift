import SwiftUI

struct RootView: View {
    @EnvironmentObject private var auth: AuthStore

    var body: some View {
        Group {
            if auth.isBootstrapping {
                ProgressView()
            } else if auth.user == nil {
                AuthView()
            } else if auth.user?.role == "shop" {
                ShopRootView()
            } else {
                DriverRootView()
            }
        }
        .task { await auth.bootstrap() }
    }
}

struct DriverRootView: View {
    var body: some View {
        TabView {
            VehiclesView().tabItem { Label("Vehicles", systemImage: "car") }
            DiagnoseView().tabItem { Label("Diagnose", systemImage: "stethoscope") }
            MyQuoteRequestsView().tabItem { Label("Requests", systemImage: "doc.text") }
            AccountView().tabItem { Label("Account", systemImage: "person.crop.circle") }
        }
    }
}

struct ShopRootView: View {
    var body: some View {
        TabView {
            IncomingRequestsView().tabItem { Label("Requests", systemImage: "tray") }
            SentQuotesView().tabItem { Label("Sent Quotes", systemImage: "paperplane") }
            ShopProfileView().tabItem { Label("Shop", systemImage: "wrench.and.screwdriver") }
            AccountView().tabItem { Label("Account", systemImage: "person.crop.circle") }
        }
    }
}

#Preview {
    RootView().environmentObject(AuthStore())
}
