# TestFlight submission — RepairScout iOS

Same process that got PhysicalKey and Screenshot Analyzer submitted (see
`physicalkey-core/mobile/ios/TESTFLIGHT.md` for the fully detailed version).

**Status as of 2026-08-21**: app builds and runs. Both roles' auth flows (register/login as
driver and shop) verified directly against the live production API
(`https://repairscout-smoky.vercel.app`) — including catching and fixing an assumption about
how Swift's JSON encoding interacts with the server's Zod validation before it became a real
bug. Full interactive tap-through in the Simulator (driver tabs, shop tabs, VIN scanner,
build-a-quote) was not done — no reliable scripted-UI-tap tooling was available in this
session, so those screens are verified by code review + a successful compile + the same
tested API layer underneath them, not by watching them run. Worth a manual pass in Xcode
before submitting.

App Store Connect record has **not** been created yet.

## What you need to do

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com), sign in.
2. **My Apps → "+" → New App.**
   - **Platform:** iOS
   - **Name:** RepairScout (check uniqueness first)
   - **Bundle ID:** `com.humbertowgw.repairscout` — register first at **Apple Developer →
     Certificates, Identifiers & Profiles → Identifiers → "+"** if not in the dropdown.
   - **SKU:** e.g. `repairscout-ios-001`
3. Tell me once that's done — I'll run the archive/export/upload from
   `repairscout/ios-app/`:
   ```bash
   xcodebuild -project RepairScout.xcodeproj -scheme RepairScout -sdk iphoneos \
     -configuration Release -destination "generic/platform=iOS" \
     -archivePath build/RepairScout.xcarchive -allowProvisioningUpdates archive
   ```
4. Before external testers: needs a **Privacy Policy URL** (requests camera access for VIN
   scanning, and handles real user accounts) — I can draft the text, you pick where to host it.

## What's in the app

Both driver and shop roles in one app, switching tab sets based on the account's `role`:

- **Auth** — register (with driver/shop role picker) / login / logout, JWT stored in Keychain.
- **Driver**: Vehicles (add manually or via VIN — including a camera VIN scan using
  VisionKit, no paid API), Diagnose (AI diagnosis via the real `/api/diagnose` endpoint),
  My Requests (quote requests you've sent).
- **Shop**: Incoming Requests (build an itemized parts+labor quote from a request and send
  it), Sent Quotes, Shop Profile.

## Known gap

The camera-based VIN scanner (VisionKit `DataScannerViewController`) can't be tested in the
iOS Simulator — it has no camera hardware, so `DataScannerViewController.isSupported` is
false there and the app falls back to a "scanning not supported, enter manually" message.
Worth a real-device test before relying on it.
