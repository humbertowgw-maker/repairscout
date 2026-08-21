import Foundation

enum AppConfig {
    private static let defaults = UserDefaults.standard

    static var baseURL: String {
        get { defaults.string(forKey: "baseURL") ?? "https://repairscout-smoky.vercel.app" }
        set { defaults.set(newValue, forKey: "baseURL") }
    }
}

/// Minimal Keychain wrapper for the auth JWT -- unlike Aegis's demo API key,
/// this is a real user session token, so UserDefaults isn't appropriate.
enum Keychain {
    private static let service = "com.humbertowgw.repairscout.auth"
    private static let account = "authToken"

    static func save(_ token: String) {
        let data = Data(token.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
        var attributes = query
        attributes[kSecValueData as String] = data
        SecItemAdd(attributes as CFDictionary, nil)
    }

    static func load() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func clear() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
