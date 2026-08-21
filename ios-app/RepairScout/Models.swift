import Foundation

// Field names mirror the backend's JSON keys (server/app.js, database.js,
// diagnosis.js, parts.js) rather than idiomatic Swift camelCase in a couple
// of spots (customerName etc. are already camelCase server-side, since the
// backend itself is JS) -- kept 1:1 with the server so a schema change there
// is easy to spot here.

// ---- Auth ----

struct User: Codable {
    let id: String
    let name: String
    let email: String
    let role: String // "driver" | "shop" | "admin"
    let shopName: String?
    let createdAt: String?
}

struct AuthResponse: Codable {
    let user: User
    let token: String
}

struct MeResponse: Codable {
    let user: User
}

// ---- Vehicles ----

struct Vehicle: Codable, Identifiable, Hashable {
    var id: String { vin ?? "\(year)-\(make)-\(model)-\(trim ?? "")" }
    let vin: String?
    let year: String
    let make: String
    let model: String
    let trim: String?
    let engine: String?
    let mileage: String?
}

struct VinDecodeResult: Codable {
    let vin: String
    let year: String?
    let make: String?
    let model: String?
    let trim: String?
    let engine: String?
}

// ---- Diagnosis ----

struct DiagnosisCause: Codable, Identifiable {
    var id: String { title }
    let probability: Int
    let title: String
    let reason: String
    let test: String
    let urgency: String
    let tone: String
    let guideCategory: String?
}

struct DiagnosisEstimate: Codable {
    let low: Double
    let high: Double
    let partsLow: Double?
    let partsHigh: Double?
    let laborLow: Double?
    let laborHigh: Double?
    let laborHoursLow: Double?
    let laborHoursHigh: Double?
    let confidence: String?
    let repairLabel: String?
}

struct DiagnosisResult: Codable {
    let summary: String
    let safetyLevel: String
    let safetyMessage: String
    let possibleCauses: [DiagnosisCause]
    let estimate: DiagnosisEstimate
    let questions: [String]?
    let source: String?
}

// ---- Quote requests (the lightweight "ask a shop" flow) ----

struct QuoteRequest: Codable, Identifiable {
    let id: String
    let userId: String?
    let shopName: String
    let customer: String
    let vehicle: String
    let issue: String
    let zip: String
    let estimate: String
    let diagnosisSummary: String?
    let status: String
    let initials: String?
    let createdAt: String
}

enum QuoteRequestStatus: String, CaseIterable {
    case newRequest = "Solicitud nueva"
    case needsReview = "Requiere revisión"
    case inReview = "En revisión"
    case quoted = "Cotizada"
    case declined = "Declinada"
    case appointmentRequested = "Cita solicitada"
}

// ---- Itemized quotes (parts + labor breakdown) ----

struct QuoteLineItem: Codable, Identifiable {
    var id: String { partKey }
    let partKey: String
    let name: String
    let qty: Int
    let unit: String?
    let category: String?
    let unitPrice: Double
    let totalPrice: Double
    let storeName: String?
    let storeType: String?
    let distanceMi: Double?
    let partNumber: String?
    let availability: String?
}

struct QuoteOption: Codable {
    let lineItems: [QuoteLineItem]
    let partsCost: Double
    let laborLow: Double
    let laborHigh: Double
    let laborHoursLow: Double
    let laborHoursHigh: Double
    let laborRate: Double
    let taxLow: Double
    let taxHigh: Double
    let totalLow: Double
    let totalHigh: Double
}

struct QuoteOptions: Codable {
    let combo: QuoteOption
    let single: QuoteOption
}

struct BuildQuoteResponse: Codable {
    let vehicle: Vehicle?
    let diagnosis: DiagnosisResult
    let quotes: QuoteOptions
    let laborRate: Double
    let generatedAt: String
}

struct SentQuoteResponse: Codable {
    let quoteId: String
    let token: String
    let trackUrl: String
}

struct ItemizedQuote: Codable, Identifiable {
    let id: String
    let token: String
    let quoteRequestId: String?
    let customerName: String
    let customerEmail: String?
    let customerPhone: String?
    let repairStage: String?
    let customerApproved: Bool?
    let sentAt: String?
    let createdAt: String
}

// ---- Shop profile ----

struct ShopProfile: Codable {
    var shopName: String
    var contactName: String
    var phone: String
    var email: String
    var address: String
    var city: String
    var state: String
    var zip: String
    var specialties: [String]
    var laborRate: String
    var warranty: String
    var availability: String
}
