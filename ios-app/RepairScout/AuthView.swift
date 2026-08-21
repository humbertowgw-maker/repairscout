import SwiftUI

struct AuthView: View {
    @EnvironmentObject private var auth: AuthStore

    @State private var isRegistering = false
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var role = "driver"
    @State private var shopName = ""
    @State private var isBusy = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                if isRegistering {
                    Section("Account type") {
                        Picker("I am a...", selection: $role) {
                            Text("Driver").tag("driver")
                            Text("Shop").tag("shop")
                        }
                        .pickerStyle(.segmented)
                        if role == "shop" {
                            TextField("Shop name", text: $shopName)
                        }
                    }
                    Section("Your info") {
                        TextField("Name", text: $name)
                    }
                }

                Section(isRegistering ? "Account" : "Sign in") {
                    TextField("Email", text: $email)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.emailAddress)
                    SecureField("Password", text: $password)
                }

                if let errorMessage {
                    Text(errorMessage).font(.footnote).foregroundStyle(.red)
                }

                Section {
                    Button {
                        Task { await submit() }
                    } label: {
                        if isBusy { ProgressView() } else { Text(isRegistering ? "Create account" : "Sign in") }
                    }
                    .disabled(isBusy || !canSubmit)
                }

                Section {
                    Button(isRegistering ? "Already have an account? Sign in" : "New here? Create an account") {
                        isRegistering.toggle()
                        errorMessage = nil
                    }
                }
            }
            .navigationTitle("RepairScout")
        }
    }

    private var canSubmit: Bool {
        guard !email.isEmpty, !password.isEmpty else { return false }
        if isRegistering {
            guard !name.isEmpty else { return false }
            if role == "shop" && shopName.isEmpty { return false }
        }
        return true
    }

    private func submit() async {
        isBusy = true
        errorMessage = nil
        defer { isBusy = false }
        do {
            if isRegistering {
                try await auth.register(name: name, email: email, password: password, role: role, shopName: role == "shop" ? shopName : nil)
            } else {
                try await auth.login(email: email, password: password)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

#Preview {
    AuthView().environmentObject(AuthStore())
}
