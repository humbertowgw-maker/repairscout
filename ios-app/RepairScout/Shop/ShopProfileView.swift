import SwiftUI

struct ShopProfileView: View {
    @State private var profile = ShopProfile(
        shopName: "", contactName: "", phone: "", email: "", address: "", city: "", state: "", zip: "",
        specialties: [], laborRate: "", warranty: "", availability: ""
    )
    @State private var specialtiesText = ""
    @State private var isBusy = false
    @State private var statusMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Shop") {
                    TextField("Shop name", text: $profile.shopName)
                    TextField("Contact name", text: $profile.contactName)
                    TextField("Phone", text: $profile.phone).keyboardType(.phonePad)
                    TextField("Email", text: $profile.email).keyboardType(.emailAddress).textInputAutocapitalization(.never)
                }
                Section("Location") {
                    TextField("Address", text: $profile.address)
                    TextField("City", text: $profile.city)
                    TextField("State", text: $profile.state)
                    TextField("ZIP", text: $profile.zip).keyboardType(.numberPad)
                }
                Section("Details") {
                    TextField("Specialties (comma-separated)", text: $specialtiesText)
                        .onChange(of: specialtiesText) { _, v in
                            profile.specialties = v.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
                        }
                    TextField("Labor rate", text: $profile.laborRate)
                    TextField("Warranty", text: $profile.warranty)
                    TextField("Availability", text: $profile.availability)
                }
                if let statusMessage {
                    Text(statusMessage).font(.footnote).foregroundStyle(.secondary)
                }
                Section {
                    Button {
                        Task { await save() }
                    } label: {
                        if isBusy { ProgressView() } else { Text("Save profile") }
                    }
                    .disabled(isBusy || profile.shopName.isEmpty)
                }
            }
            .navigationTitle("Shop Profile")
            .task { await load() }
        }
    }

    private func load() async {
        do {
            profile = try await APIClient.fetchShopProfile()
            specialtiesText = profile.specialties.joined(separator: ", ")
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    private func save() async {
        isBusy = true
        defer { isBusy = false }
        do {
            profile = try await APIClient.updateShopProfile(profile)
            statusMessage = "Saved"
        } catch {
            statusMessage = error.localizedDescription
        }
    }
}

#Preview {
    ShopProfileView()
}
