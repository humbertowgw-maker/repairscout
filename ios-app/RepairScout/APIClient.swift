import Foundation

enum APIClientError: LocalizedError {
    case invalidURL
    case badResponse(Int, String)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid backend URL"
        case .badResponse(let status, let body): return "HTTP \(status): \(body)"
        }
    }
}

/// Talks to RepairScout's Express API (server/app.js) -- Bearer JWT auth
/// (server/auth.js), token stored in Keychain by AuthStore.
enum APIClient {
    private static func request(_ path: String, method: String = "GET", auth: Bool = false) throws -> URLRequest {
        guard let url = URL(string: "\(AppConfig.baseURL)\(path)") else { throw APIClientError.invalidURL }
        var req = URLRequest(url: url)
        req.httpMethod = method
        if auth, let token = Keychain.load() {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        return req
    }

    private static func request<Body: Encodable>(_ path: String, method: String, body: Body, auth: Bool = false) throws -> URLRequest {
        var req = try request(path, method: method, auth: auth)
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(body)
        return req
    }

    private static func send<T: Decodable>(_ req: URLRequest, as type: T.Type) async throws -> T {
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            let status = (response as? HTTPURLResponse)?.statusCode ?? -1
            let message = (try? JSONDecoder().decode([String: String].self, from: data))?["error"]
                ?? String(data: data, encoding: .utf8) ?? ""
            throw APIClientError.badResponse(status, message)
        }
        return try JSONDecoder().decode(T.self, from: data)
    }

    // ---- Auth ----

    static func register(name: String, email: String, password: String, role: String, shopName: String?) async throws -> AuthResponse {
        struct Body: Encodable { let name, email, password, role: String; let shopName: String? }
        return try await send(try request("/api/auth/register", method: "POST", body: Body(name: name, email: email, password: password, role: role, shopName: shopName)), as: AuthResponse.self)
    }

    static func login(email: String, password: String) async throws -> AuthResponse {
        struct Body: Encodable { let email, password: String }
        return try await send(try request("/api/auth/login", method: "POST", body: Body(email: email, password: password)), as: AuthResponse.self)
    }

    static func me() async throws -> MeResponse {
        try await send(try request("/api/auth/me", auth: true), as: MeResponse.self)
    }

    // ---- Vehicles ----

    static func fetchVehicles() async throws -> [Vehicle] {
        struct Wrapper: Decodable { let vehicles: [Vehicle] }
        return try await send(try request("/api/vehicles", auth: true), as: Wrapper.self).vehicles
    }

    @discardableResult
    static func addVehicle(_ vehicle: Vehicle) async throws -> Vehicle {
        struct Wrapper: Decodable { let vehicle: Vehicle }
        return try await send(try request("/api/vehicles", method: "POST", body: vehicle, auth: true), as: Wrapper.self).vehicle
    }

    static func decodeVIN(_ vin: String) async throws -> VinDecodeResult {
        try await send(try request("/api/vehicle/decode?vin=\(vin)"), as: VinDecodeResult.self)
    }

    // ---- Diagnosis ----

    static func diagnose(description: String, vehicle: Vehicle?, mileage: String?, zip: String, language: String = "en") async throws -> DiagnosisResult {
        struct Body: Encodable {
            let vehicle: Vehicle?
            let mileage: String?
            let description: String
            let zip: String
            let language: String
        }
        return try await send(
            try request("/api/diagnose", method: "POST", body: Body(vehicle: vehicle, mileage: mileage, description: description, zip: zip, language: language), auth: true),
            as: DiagnosisResult.self
        )
    }

    // ---- Quote requests ----

    static func fetchQuoteRequests() async throws -> [QuoteRequest] {
        struct Wrapper: Decodable { let quoteRequests: [QuoteRequest] }
        return try await send(try request("/api/quote-requests", auth: true), as: Wrapper.self).quoteRequests
    }

    @discardableResult
    static func submitQuoteRequest(shopName: String, vehicle: String, issue: String, zip: String, estimate: String, diagnosisSummary: String?) async throws -> QuoteRequest {
        struct Body: Encodable { let shopName, vehicle, issue, zip, estimate: String; let diagnosisSummary: String? }
        struct Wrapper: Decodable { let quoteRequest: QuoteRequest }
        return try await send(try request("/api/quote-requests", method: "POST", body: Body(shopName: shopName, vehicle: vehicle, issue: issue, zip: zip, estimate: estimate, diagnosisSummary: diagnosisSummary), auth: true), as: Wrapper.self).quoteRequest
    }

    @discardableResult
    static func updateQuoteRequestStatus(id: String, status: QuoteRequestStatus) async throws -> QuoteRequest {
        struct Body: Encodable { let status: String }
        struct Wrapper: Decodable { let quoteRequest: QuoteRequest }
        return try await send(try request("/api/quote-requests/\(id)/status", method: "PATCH", body: Body(status: status.rawValue), auth: true), as: Wrapper.self).quoteRequest
    }

    // ---- Itemized quotes ----

    static func buildQuote(diagnosis: DiagnosisResult, vehicle: Vehicle?, language: String = "en") async throws -> BuildQuoteResponse {
        struct Body: Encodable { let diagnosis: DiagnosisResult; let vehicle: Vehicle?; let language: String }
        return try await send(try request("/api/quotes/build", method: "POST", body: Body(diagnosis: diagnosis, vehicle: vehicle, language: language), auth: true), as: BuildQuoteResponse.self)
    }

    static func sendQuote(diagnosis: DiagnosisResult, vehicle: Vehicle?, quoteCombo: QuoteOption, quoteSingle: QuoteOption, customerName: String, customerEmail: String?, customerPhone: String?, quoteRequestId: String?, language: String = "en") async throws -> SentQuoteResponse {
        struct Customer: Encodable { let name: String; let email: String?; let phone: String? }
        struct Body: Encodable {
            let diagnosis: DiagnosisResult
            let vehicle: Vehicle?
            let quoteCombo: QuoteOption
            let quoteSingle: QuoteOption
            let customer: Customer
            let quoteRequestId: String?
            let language: String
        }
        return try await send(
            try request("/api/quotes/send", method: "POST", body: Body(
                diagnosis: diagnosis, vehicle: vehicle, quoteCombo: quoteCombo, quoteSingle: quoteSingle,
                customer: Customer(name: customerName, email: customerEmail, phone: customerPhone),
                quoteRequestId: quoteRequestId, language: language
            ), auth: true),
            as: SentQuoteResponse.self
        )
    }

    static func fetchSentQuotes() async throws -> [ItemizedQuote] {
        struct Wrapper: Decodable { let quotes: [ItemizedQuote] }
        return try await send(try request("/api/quotes/sent", auth: true), as: Wrapper.self).quotes
    }

    // ---- Shop profile ----

    static func fetchShopProfile() async throws -> ShopProfile {
        struct Wrapper: Decodable { let profile: ShopProfile }
        return try await send(try request("/api/shop-profile", auth: true), as: Wrapper.self).profile
    }

    @discardableResult
    static func updateShopProfile(_ profile: ShopProfile) async throws -> ShopProfile {
        struct Wrapper: Decodable { let profile: ShopProfile }
        return try await send(try request("/api/shop-profile", method: "PUT", body: profile, auth: true), as: Wrapper.self).profile
    }
}
