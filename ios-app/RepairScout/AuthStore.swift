import Foundation

@MainActor
final class AuthStore: ObservableObject {
    @Published var user: User?
    @Published var isBootstrapping = true

    func bootstrap() async {
        guard Keychain.load() != nil else { isBootstrapping = false; return }
        do {
            user = try await APIClient.me().user
        } catch {
            Keychain.clear()
        }
        isBootstrapping = false
    }

    func login(email: String, password: String) async throws {
        let response = try await APIClient.login(email: email, password: password)
        Keychain.save(response.token)
        user = response.user
    }

    func register(name: String, email: String, password: String, role: String, shopName: String?) async throws {
        let response = try await APIClient.register(name: name, email: email, password: password, role: role, shopName: shopName)
        Keychain.save(response.token)
        user = response.user
    }

    func logout() {
        Keychain.clear()
        user = nil
    }
}
