// Web Bluetooth + ELM327 client for reading OBD-II codes directly from a real adapter.
//
// v1 scope, deliberately: Chrome desktop/Android only. Web Bluetooth has no iOS Safari
// support at all (an Apple platform restriction, not something more code fixes) - iOS
// keeps using the existing manual obdCodesInput field, unchanged. Getting this on iPhone
// needs a separate native-wrapper project (Capacitor + a real BLE plugin, App Store
// review), not in scope here.
//
// ELM327 BLE dongles don't share one GATT service UUID across vendors (Veepeak, Vgate,
// OBDLink each expose their own serial-over-BLE service) - acceptAllDevices covers the
// realistic v1 case rather than trying to enumerate every vendor's UUID up front.

export function obdBluetoothSupported() {
  return typeof navigator !== "undefined" && !!navigator.bluetooth;
}

// Common ELM327 BLE serial service/characteristic UUIDs seen across cheap consumer
// adapters. Not exhaustive - real hardware validation against 2-3 physical adapters is
// still needed before this can be called fully verified, per the known limitation this
// was scoped with.
const KNOWN_SERIAL_SERVICES = [
  "0000fff0-0000-1000-8000-00805f9b34fb", // common HM-10/JDY-08 style BLE-serial module
  "0000ffe0-0000-1000-8000-00805f9b34fb", // common HC-08/AT-09 style BLE-serial module
];

const AT_HANDSHAKE = ["ATZ", "ATE0", "ATL0", "ATSP0"];

async function sendCommand(characteristic, command, notifyChar) {
  const encoder = new TextEncoder();
  await characteristic.writeValue(encoder.encode(`${command}\r`));
  return new Promise((resolve) => {
    let buffer = "";
    const onNotify = (event) => {
      const chunk = new TextDecoder().decode(event.target.value);
      buffer += chunk;
      if (buffer.includes(">")) {
        notifyChar.removeEventListener("characteristicvaluechanged", onNotify);
        resolve(buffer);
      }
    };
    notifyChar.addEventListener("characteristicvaluechanged", onNotify);
  });
}

/**
 * Connects to a paired/nearby ELM327 BLE adapter, runs the standard AT handshake, and
 * requests Mode 03 (stored diagnostic trouble codes). Must be called from a real user
 * gesture (a click handler) - Web Bluetooth requires this and will reject otherwise.
 */
export async function connectObdAdapter() {
  if (!obdBluetoothSupported()) {
    throw new Error("Web Bluetooth isn't supported in this browser.");
  }

  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: KNOWN_SERIAL_SERVICES,
  });

  const server = await device.gatt.connect();
  let writeChar = null;
  let notifyChar = null;

  for (const serviceUuid of KNOWN_SERIAL_SERVICES) {
    try {
      const service = await server.getPrimaryService(serviceUuid);
      const characteristics = await service.getCharacteristics();
      for (const char of characteristics) {
        if (char.properties.write || char.properties.writeWithoutResponse) writeChar = char;
        if (char.properties.notify) notifyChar = char;
      }
      if (writeChar && notifyChar) break;
    } catch {
      // This adapter doesn't expose this particular service UUID - try the next one.
    }
  }

  if (!writeChar || !notifyChar) {
    throw new Error("Couldn't find a compatible serial characteristic on this adapter.");
  }

  await notifyChar.startNotifications();

  for (const cmd of AT_HANDSHAKE) {
    await sendCommand(writeChar, cmd, notifyChar);
  }

  const dtcResponse = await sendCommand(writeChar, "03", notifyChar);
  return parseElm327DtcResponse(dtcResponse);
}

/**
 * Decodes an ELM327 Mode 03 response into DTC strings, per the standard SAE
 * J1979/ISO 15031 encoding: each DTC is 2 bytes. Byte 1's top 2 bits select the
 * system prefix (00=P, 01=C, 10=B, 11=U), its next 2 bits are the first digit (0-3),
 * its low nibble is the second digit; byte 2's high nibble is the third digit, low
 * nibble is the fourth. "NO DATA"/all-zero pairs are skipped (no active codes).
 */
export function parseElm327DtcResponse(raw) {
  const cleaned = String(raw || "")
    .replace(/[\r\n>]/g, " ")
    .trim();
  if (!cleaned || /NO DATA/i.test(cleaned)) return [];

  const hexBytes = cleaned.split(/\s+/).filter((tok) => /^[0-9A-Fa-f]{2}$/.test(tok));
  // First byte of a Mode 03 response is 0x43 (0x40 + service 0x03) - the rest are DTC
  // byte pairs. Some adapters echo the request or include a leading response-length
  // byte first, so search for 0x43 rather than assuming index 0.
  const startIdx = hexBytes.findIndex((b) => b.toUpperCase() === "43");
  const dtcBytes = startIdx >= 0 ? hexBytes.slice(startIdx + 1) : hexBytes;

  const PREFIX = ["P", "C", "B", "U"];
  const codes = [];
  for (let i = 0; i + 1 < dtcBytes.length; i += 2) {
    const b1 = parseInt(dtcBytes[i], 16);
    const b2 = parseInt(dtcBytes[i + 1], 16);
    if (b1 === 0 && b2 === 0) continue; // padding / no code in this slot

    const prefix = PREFIX[(b1 >> 6) & 0b11];
    const digit1 = (b1 >> 4) & 0b11;
    const digit2 = b1 & 0b1111;
    const digit3 = (b2 >> 4) & 0b1111;
    const digit4 = b2 & 0b1111;
    codes.push(`${prefix}${digit1}${digit2.toString(16).toUpperCase()}${digit3.toString(16).toUpperCase()}${digit4.toString(16).toUpperCase()}`);
  }
  return codes;
}
