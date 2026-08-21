import SwiftUI

struct AccountView: View {
    @EnvironmentObject private var auth: AuthStore

    var body: some View {
        NavigationStack {
            Form {
                if let user = auth.user {
                    Section("Signed in as") {
                        Text(user.name)
                        Text(user.email).font(.footnote).foregroundStyle(.secondary)
                        Text(user.role.capitalized).font(.footnote).foregroundStyle(.secondary)
                    }
                }
                Section {
                    Button("Sign out", role: .destructive) { auth.logout() }
                }
            }
            .navigationTitle("Account")
        }
    }
}

#Preview {
    AccountView().environmentObject(AuthStore())
}
