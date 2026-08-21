import SwiftUI

struct VehiclesView: View {
    @State private var vehicles: [Vehicle] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showingAddSheet = false

    var body: some View {
        NavigationStack {
            List {
                if vehicles.isEmpty && !isLoading {
                    ContentUnavailableView("No vehicles yet", systemImage: "car", description: Text("Add one to start a diagnosis or request a quote."))
                }
                ForEach(vehicles) { vehicle in
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(vehicle.year) \(vehicle.make) \(vehicle.model)").font(.headline)
                        if let trim = vehicle.trim, !trim.isEmpty {
                            Text(trim).font(.subheadline).foregroundStyle(.secondary)
                        }
                        if let vin = vehicle.vin, !vin.isEmpty {
                            Text("VIN \(vin)").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .navigationTitle("Vehicles")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { showingAddSheet = true } label: { Image(systemName: "plus") }
                }
            }
            .sheet(isPresented: $showingAddSheet) {
                AddVehicleView { vehicle in
                    vehicles.append(vehicle)
                }
            }
            .task { await load() }
            .refreshable { await load() }
        }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            vehicles = try await APIClient.fetchVehicles()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct AddVehicleView: View {
    var onAdded: (Vehicle) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var vin = ""
    @State private var year = ""
    @State private var make = ""
    @State private var model = ""
    @State private var trim = ""
    @State private var engine = ""
    @State private var mileage = ""
    @State private var isBusy = false
    @State private var errorMessage: String?
    @State private var showingScanner = false

    var body: some View {
        NavigationStack {
            Form {
                Section("VIN (optional)") {
                    HStack {
                        TextField("17-character VIN", text: $vin)
                            .textInputAutocapitalization(.characters)
                            .autocorrectionDisabled()
                        Button { showingScanner = true } label: { Image(systemName: "camera.viewfinder") }
                    }
                    Button("Decode VIN") { Task { await decodeVIN() } }
                        .disabled(vin.count != 17 || isBusy)
                }
                Section("Vehicle") {
                    TextField("Year", text: $year).keyboardType(.numberPad)
                    TextField("Make", text: $make)
                    TextField("Model", text: $model)
                    TextField("Trim (optional)", text: $trim)
                    TextField("Engine (optional)", text: $engine)
                    TextField("Mileage (optional)", text: $mileage).keyboardType(.numberPad)
                }
                if let errorMessage {
                    Text(errorMessage).font(.footnote).foregroundStyle(.red)
                }
            }
            .navigationTitle("Add Vehicle")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { Task { await save() } }
                        .disabled(year.isEmpty || make.isEmpty || model.isEmpty || isBusy)
                }
            }
            .sheet(isPresented: $showingScanner) {
                VINScannerSheet { scanned in vin = scanned }
            }
        }
    }

    private func decodeVIN() async {
        isBusy = true
        defer { isBusy = false }
        do {
            let result = try await APIClient.decodeVIN(vin)
            if let y = result.year { year = y }
            if let m = result.make { make = m }
            if let mo = result.model { model = mo }
            if let t = result.trim { trim = t }
            if let e = result.engine { engine = e }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func save() async {
        isBusy = true
        defer { isBusy = false }
        let vehicle = Vehicle(
            vin: vin.isEmpty ? nil : vin, year: year, make: make, model: model,
            trim: trim.isEmpty ? nil : trim, engine: engine.isEmpty ? nil : engine,
            mileage: mileage.isEmpty ? nil : mileage
        )
        do {
            let saved = try await APIClient.addVehicle(vehicle)
            onAdded(saved)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

#Preview {
    VehiclesView()
}
