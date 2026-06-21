// Parts catalog and quote generation engine

const STORES = [
  { id: "autozone",   name: "AutoZone",            type: "local",  distanceMi: 2.4, phone: "(916) 555-0142" },
  { id: "orielly",    name: "O'Reilly Auto Parts",  type: "local",  distanceMi: 3.1, phone: "(916) 555-0198" },
  { id: "napa",       name: "NAPA Auto Parts",       type: "local",  distanceMi: 5.8, phone: "(916) 555-0223" },
  { id: "advance",    name: "Advance Auto Parts",    type: "local",  distanceMi: 4.2, phone: "(916) 555-0267" },
  { id: "rockauto",   name: "RockAuto",              type: "online", distanceMi: null, phone: null },
];

// Keyed by store id → price multiplier relative to the "retail" base price
const STORE_MULTIPLIERS = {
  autozone:  1.00,
  orielly:   0.95,
  napa:      1.08,
  advance:   0.93,
  rockauto:  0.72,
};

// Availability templates
const AVAIL = {
  autozone:  ["In stock · Pickup today", "2 in stock · Pickup today", "In stock · Pickup in 1h"],
  orielly:   ["In stock · Pickup in 2h", "In stock · Pickup today", "3 in stock · Pickup today"],
  napa:      ["1 in stock · Call ahead", "In stock · Pickup today", "In stock · Same-day available"],
  advance:   ["In stock · Pickup today", "In stock · Pickup in 1h", "2 in stock · Pickup today"],
  rockauto:  ["Ships in 2–3 business days", "Ships next business day", "Usually ships in 1 day"],
};

function avail(storeId, seed = 0) {
  const list = AVAIL[storeId] || ["Available"];
  return list[seed % list.length];
}

// Part catalog — base "retail" price is the AutoZone price; others scale by STORE_MULTIPLIERS
const CATALOG = {
  // ── Brakes ──────────────────────────────────────────────────────────
  brake_pads_front: {
    en: "Front Brake Pads (set)", es: "Pastillas de freno delanteras (juego)",
    retail: 64.99, qty: 1, unit: "set", cat: "Brakes",
    partNum: { autozone: "DG1892", orielly: "ID1345", napa: "NM1892", advance: "CG1892", rockauto: "PS1892" },
  },
  brake_pads_rear: {
    en: "Rear Brake Pads (set)", es: "Pastillas de freno traseras (juego)",
    retail: 54.99, qty: 1, unit: "set", cat: "Brakes",
    partNum: { autozone: "DG1893R", orielly: "ID1346R", napa: "NM1893R", advance: "CG1893R", rockauto: "PS1893R" },
  },
  rotors_front: {
    en: "Front Brake Rotors (pair)", es: "Rotores delanteros (par)",
    retail: 98.99, qty: 2, unit: "each", cat: "Brakes",
    partNum: { autozone: "BR34092", orielly: "SR34092", napa: "NR34092", advance: "AR34092", rockauto: "CR34092" },
  },
  rotors_rear: {
    en: "Rear Brake Rotors (pair)", es: "Rotores traseros (par)",
    retail: 84.99, qty: 2, unit: "each", cat: "Brakes",
    partNum: { autozone: "BR34093R", orielly: "SR34093R", napa: "NR34093R", advance: "AR34093R", rockauto: "CR34093R" },
  },
  brake_caliper_front: {
    en: "Front Brake Caliper", es: "Calibrador de freno delantero",
    retail: 89.99, qty: 1, unit: "each", cat: "Brakes",
    partNum: { autozone: "BC3409F", orielly: "BC3409F", napa: "BC3409FN", advance: "BC3409FA", rockauto: "BC3409FR" },
  },
  brake_fluid: {
    en: "DOT 3 Brake Fluid (12 oz)", es: "Líquido de frenos DOT 3 (12 oz)",
    retail: 9.99, qty: 1, unit: "bottle", cat: "Brakes",
    partNum: { autozone: "BF12Z", orielly: "BF12O", napa: "BF12N", advance: "BF12A", rockauto: "BF12R" },
  },
  brake_hardware_kit: {
    en: "Brake Hardware Kit", es: "Kit de herrajes de freno",
    retail: 18.99, qty: 1, unit: "kit", cat: "Brakes",
    partNum: { autozone: "BH-9345", orielly: "BH-9345O", napa: "BH-9345N", advance: "BH-9345A", rockauto: "BH-9345R" },
  },

  // ── Wheel Bearings ───────────────────────────────────────────────────
  wheel_bearing_front: {
    en: "Front Wheel Bearing & Hub Assembly", es: "Cojinete y cubo de rueda delantero",
    retail: 129.99, qty: 1, unit: "each", cat: "Suspension",
    partNum: { autozone: "WB513060", orielly: "WB513060O", napa: "WB513060N", advance: "WB513060A", rockauto: "WB513060R" },
  },
  wheel_bearing_rear: {
    en: "Rear Wheel Bearing & Hub Assembly", es: "Cojinete y cubo de rueda trasero",
    retail: 114.99, qty: 1, unit: "each", cat: "Suspension",
    partNum: { autozone: "WB513061R", orielly: "WB513061RO", napa: "WB513061RN", advance: "WB513061RA", rockauto: "WB513061RR" },
  },

  // ── Electrical ───────────────────────────────────────────────────────
  battery: {
    en: "Car Battery (Group 35 / 500 CCA)", es: "Batería (Grupo 35 / 500 CCA)",
    retail: 179.99, qty: 1, unit: "each", cat: "Electrical",
    partNum: { autozone: "AUX35-500", orielly: "ORY35-500", napa: "NAPA35-500", advance: "ADV35-500", rockauto: "RA35-500" },
  },
  alternator: {
    en: "Alternator (Remanufactured)", es: "Alternador (remanufacturado)",
    retail: 219.99, qty: 1, unit: "each", cat: "Electrical",
    partNum: { autozone: "ALT7804RM", orielly: "ALT7804O", napa: "ALT7804N", advance: "ALT7804A", rockauto: "ALT7804R" },
  },
  starter: {
    en: "Starter Motor (Remanufactured)", es: "Motor de arranque (remanufacturado)",
    retail: 189.99, qty: 1, unit: "each", cat: "Electrical",
    partNum: { autozone: "STR8914RM", orielly: "STR8914O", napa: "STR8914N", advance: "STR8914A", rockauto: "STR8914R" },
  },
  ignition_coil: {
    en: "Ignition Coil", es: "Bobina de encendido",
    retail: 39.99, qty: 1, unit: "each", cat: "Ignition",
    partNum: { autozone: "IC20H", orielly: "IC20O", napa: "IC20N", advance: "IC20A", rockauto: "IC20R" },
  },
  spark_plugs: {
    en: "Spark Plugs (set of 4)", es: "Bujías (juego de 4)",
    retail: 34.99, qty: 4, unit: "each", cat: "Ignition",
    partNum: { autozone: "SP4041", orielly: "SP4041O", napa: "SP4041N", advance: "SP4041A", rockauto: "SP4041R" },
  },

  // ── Engine ───────────────────────────────────────────────────────────
  oil_filter: {
    en: "Oil Filter", es: "Filtro de aceite",
    retail: 12.99, qty: 1, unit: "each", cat: "Engine",
    partNum: { autozone: "OF3706", orielly: "OF3706O", napa: "OF3706N", advance: "OF3706A", rockauto: "OF3706R" },
  },
  air_filter: {
    en: "Engine Air Filter", es: "Filtro de aire del motor",
    retail: 19.99, qty: 1, unit: "each", cat: "Engine",
    partNum: { autozone: "AF4004", orielly: "AF4004O", napa: "AF4004N", advance: "AF4004A", rockauto: "AF4004R" },
  },
  valve_cover_gasket: {
    en: "Valve Cover Gasket Set", es: "Juego de empaques de tapa de válvulas",
    retail: 44.99, qty: 1, unit: "set", cat: "Engine",
    partNum: { autozone: "VCG9240", orielly: "VCG9240O", napa: "VCG9240N", advance: "VCG9240A", rockauto: "VCG9240R" },
  },
  pcv_valve: {
    en: "PCV Valve", es: "Válvula PCV",
    retail: 8.99, qty: 1, unit: "each", cat: "Engine",
    partNum: { autozone: "PCV-42", orielly: "PCV-42O", napa: "PCV-42N", advance: "PCV-42A", rockauto: "PCV-42R" },
  },

  // ── Cooling ──────────────────────────────────────────────────────────
  thermostat: {
    en: "Thermostat & Housing Kit", es: "Termostato y carcasa",
    retail: 34.99, qty: 1, unit: "kit", cat: "Cooling",
    partNum: { autozone: "TH4000", orielly: "TH4000O", napa: "TH4000N", advance: "TH4000A", rockauto: "TH4000R" },
  },
  coolant: {
    en: "Extended-Life Coolant / Antifreeze (1 gal)", es: "Refrigerante extendido (1 galón)",
    retail: 19.99, qty: 2, unit: "gallon", cat: "Cooling",
    partNum: { autozone: "CLT-1G", orielly: "CLT-1GO", napa: "CLT-1GN", advance: "CLT-1GA", rockauto: "CLT-1GR" },
  },
  radiator_hose_upper: {
    en: "Upper Radiator Hose", es: "Manguera superior del radiador",
    retail: 24.99, qty: 1, unit: "each", cat: "Cooling",
    partNum: { autozone: "RH8200U", orielly: "RH8200UO", napa: "RH8200UN", advance: "RH8200UA", rockauto: "RH8200UR" },
  },
  water_pump: {
    en: "Water Pump", es: "Bomba de agua",
    retail: 89.99, qty: 1, unit: "each", cat: "Cooling",
    partNum: { autozone: "WP3122", orielly: "WP3122O", napa: "WP3122N", advance: "WP3122A", rockauto: "WP3122R" },
  },

  // ── Exhaust / Emissions ───────────────────────────────────────────────
  catalytic_converter: {
    en: "Catalytic Converter (Direct Fit)", es: "Convertidor catalítico (ajuste directo)",
    retail: 289.99, qty: 1, unit: "each", cat: "Exhaust",
    partNum: { autozone: "CC4020D", orielly: "CC4020DO", napa: "CC4020DN", advance: "CC4020DA", rockauto: "CC4020DR" },
  },
  o2_sensor_upstream: {
    en: "O2 Sensor — Upstream (Bank 1)", es: "Sensor de oxígeno — aguas arriba",
    retail: 49.99, qty: 1, unit: "each", cat: "Exhaust",
    partNum: { autozone: "OS5140U", orielly: "OS5140UO", napa: "OS5140UN", advance: "OS5140UA", rockauto: "OS5140UR" },
  },
  maf_sensor: {
    en: "Mass Airflow Sensor (MAF)", es: "Sensor de flujo de masa de aire (MAF)",
    retail: 74.99, qty: 1, unit: "each", cat: "Engine",
    partNum: { autozone: "MF2100", orielly: "MF2100O", napa: "MF2100N", advance: "MF2100A", rockauto: "MF2100R" },
  },

  // ── Suspension & Steering ─────────────────────────────────────────────
  control_arm_front_lower: {
    en: "Front Lower Control Arm", es: "Brazo de control inferior delantero",
    retail: 129.99, qty: 1, unit: "each", cat: "Suspension",
    partNum: { autozone: "CA12004", orielly: "CA12004O", napa: "CA12004N", advance: "CA12004A", rockauto: "CA12004R" },
  },
  ball_joint_front: {
    en: "Front Ball Joint", es: "Rótula delantera",
    retail: 49.99, qty: 1, unit: "each", cat: "Suspension",
    partNum: { autozone: "BJ7302F", orielly: "BJ7302FO", napa: "BJ7302FN", advance: "BJ7302FA", rockauto: "BJ7302FR" },
  },
  sway_bar_link: {
    en: "Stabilizer / Sway Bar Link", es: "Eslabón de barra estabilizadora",
    retail: 22.99, qty: 1, unit: "each", cat: "Suspension",
    partNum: { autozone: "SBL4802", orielly: "SBL4802O", napa: "SBL4802N", advance: "SBL4802A", rockauto: "SBL4802R" },
  },
  strut_front: {
    en: "Front Strut Assembly", es: "Ensamble de amortiguador delantero",
    retail: 149.99, qty: 1, unit: "each", cat: "Suspension",
    partNum: { autozone: "ST5100F", orielly: "ST5100FO", napa: "ST5100FN", advance: "ST5100FA", rockauto: "ST5100FR" },
  },
  tie_rod_outer: {
    en: "Outer Tie Rod End", es: "Extremo de tirante de dirección exterior",
    retail: 34.99, qty: 1, unit: "each", cat: "Steering",
    partNum: { autozone: "ES3449", orielly: "ES3449O", napa: "ES3449N", advance: "ES3449A", rockauto: "ES3449R" },
  },
  power_steering_pump: {
    en: "Power Steering Pump (Remanufactured)", es: "Bomba de dirección asistida (remanufacturada)",
    retail: 179.99, qty: 1, unit: "each", cat: "Steering",
    partNum: { autozone: "PSP3344RM", orielly: "PSP3344O", napa: "PSP3344N", advance: "PSP3344A", rockauto: "PSP3344R" },
  },

  // ── Drivetrain ────────────────────────────────────────────────────────
  cv_axle_front_driver: {
    en: "CV Axle Shaft — Front Driver Side", es: "Semieje CV — lado del conductor",
    retail: 109.99, qty: 1, unit: "each", cat: "Drivetrain",
    partNum: { autozone: "CVA8042FD", orielly: "CVA8042O", napa: "CVA8042N", advance: "CVA8042A", rockauto: "CVA8042R" },
  },

  // ── Transmission ──────────────────────────────────────────────────────
  transmission_fluid: {
    en: "Automatic Transmission Fluid (1 qt)", es: "Fluido de transmisión automática (1 cuarto)",
    retail: 14.99, qty: 4, unit: "quart", cat: "Transmission",
    partNum: { autozone: "ATF-QT", orielly: "ATF-QTO", napa: "ATF-QTN", advance: "ATF-QTA", rockauto: "ATF-QTR" },
  },
  transmission_filter: {
    en: "Transmission Filter Kit", es: "Kit de filtro de transmisión",
    retail: 29.99, qty: 1, unit: "kit", cat: "Transmission",
    partNum: { autozone: "TFK-2240", orielly: "TFK-2240O", napa: "TFK-2240N", advance: "TFK-2240A", rockauto: "TFK-2240R" },
  },

  // ── Fuel ──────────────────────────────────────────────────────────────
  fuel_pump: {
    en: "Fuel Pump Module Assembly", es: "Módulo de bomba de combustible",
    retail: 169.99, qty: 1, unit: "each", cat: "Fuel",
    partNum: { autozone: "FP7720A", orielly: "FP7720O", napa: "FP7720N", advance: "FP7720A2", rockauto: "FP7720R" },
  },
  fuel_filter: {
    en: "Fuel Filter", es: "Filtro de combustible",
    retail: 24.99, qty: 1, unit: "each", cat: "Fuel",
    partNum: { autozone: "FF3600", orielly: "FF3600O", napa: "FF3600N", advance: "FF3600A", rockauto: "FF3600R" },
  },

  // ── General ───────────────────────────────────────────────────────────
  shop_supplies: {
    en: "Shop Supplies & Misc. Hardware", es: "Materiales del taller y herrajes varios",
    retail: 14.99, qty: 1, unit: "lot", cat: "Supplies",
    partNum: {},
  },
  throttle_body_cleaner: {
    en: "Throttle Body & Sensor Cleaner", es: "Limpiador de cuerpo de aceleración",
    retail: 7.99, qty: 1, unit: "can", cat: "Supplies",
    partNum: { autozone: "TBC-12", orielly: "TBC-12O", napa: "TBC-12N", advance: "TBC-12A", rockauto: "TBC-12R" },
  },
  diagnostic_fee: {
    en: "Diagnostic Scan Fee (credited toward repair)", es: "Tarifa de diagnóstico OBD (acreditable)",
    retail: 0, qty: 1, unit: "service", cat: "Service",
    partNum: {},
    laborOnly: true,
  },
};

// Keyword detector — maps diagnosis text → part keys
function detectParts(diagnosis) {
  const text = [
    diagnosis.summary || "",
    ...(diagnosis.possibleCauses || []).map((c) => `${c.title} ${c.reason} ${c.test} ${c.urgency}`),
    ...(diagnosis.questions || []),
  ].join(" ").toLowerCase();

  const add = new Set();

  // Brakes
  if (/(brake pad|pastillas? de freno|pad wear|pastillas? desgast)/.test(text)) add.add("brake_pads_front");
  if (/(rear pad|pastilla[s]? trasera|pad rear|traseras? desgast)/.test(text)) add.add("brake_pads_rear");
  if (/(rotor|disco[s]? de freno|scored|rayado|groove|surco)/.test(text)) add.add("rotors_front");
  if (/(rear rotor|rotor[es]* trasero)/.test(text)) add.add("rotors_rear");
  if (/(caliper|calibrador)/.test(text)) add.add("brake_caliper_front");
  if (/(brake fluid|líquido de frenos|brake leak|fuga de freno)/.test(text)) add.add("brake_fluid");
  if (/(brake|freno)/.test(text) && add.size > 0) add.add("brake_hardware_kit");

  // Wheel bearing
  if (/(bearing|rodamiento|hub noise|ruido de rueda|wheel play)/.test(text)) add.add("wheel_bearing_front");

  // Electrical
  if (/(battery|batería|dead|crank|doesn.t start|no arranca|won.t start|no enciende|discharge|descarg)/.test(text)) add.add("battery");
  if (/(alternator|alternador|charging|cargando)/.test(text)) add.add("alternator");
  if (/(starter|arranque|starter motor|click when key)/.test(text)) add.add("starter");
  if (/(ignition coil|bobina|misfire|fallo de encendido)/.test(text)) add.add("ignition_coil");
  if (/(spark plug|bujía|misfire|rough idle|marcha ruda)/.test(text)) add.add("spark_plugs");

  // Engine
  if (/(oil leak|fuga de aceite|oil drip|oil consumption)/.test(text)) { add.add("valve_cover_gasket"); add.add("oil_filter"); }
  if (/(air filter|filtro de aire|intake|suction)/.test(text)) add.add("air_filter");

  // Cooling
  if (/(overheat|sobrecalent|coolant leak|fuga de refrigerante|thermostat|termostato)/.test(text)) {
    add.add("thermostat"); add.add("coolant");
  }
  if (/(radiator hose|manguera de radiador|coolant leak)/.test(text)) add.add("radiator_hose_upper");
  if (/(water pump|bomba de agua|timing|serpentine)/.test(text)) add.add("water_pump");

  // Exhaust / Emissions
  if (/(catalytic|catalizador|p0420|p0430|cat efficiency)/.test(text)) add.add("catalytic_converter");
  if (/(oxygen sensor|o2 sensor|sensor de oxígeno|p013|p015|p016|upstream)/.test(text)) add.add("o2_sensor_upstream");
  if (/(maf|mass air flow|sensor de flujo)/.test(text)) add.add("maf_sensor");

  // Suspension
  if (/(control arm|brazo de control|clunk|golpe|camber)/.test(text)) add.add("control_arm_front_lower");
  if (/(ball joint|rótula)/.test(text)) add.add("ball_joint_front");
  if (/(sway bar|stabilizer|eslabón|rattle front)/.test(text)) add.add("sway_bar_link");
  if (/(strut|shock absorber|amortiguador|bounce|rebote|coil spring)/.test(text)) add.add("strut_front");

  // Steering
  if (/(tie rod|tirante|steering wander|pull|steering play|juego en la dirección)/.test(text)) add.add("tie_rod_outer");
  if (/(power steering|dirección asistida|steering pump|whine)/.test(text)) add.add("power_steering_pump");

  // Drivetrain
  if (/(cv axle|semieje|cv joint|clicking when turning|chasquido al girar)/.test(text)) add.add("cv_axle_front_driver");

  // Transmission
  if (/(transmission|transmisión|shift|cambio de marcha|atf)/.test(text)) { add.add("transmission_fluid"); add.add("transmission_filter"); }

  // Fuel
  if (/(fuel pump|bomba de combustible|no pressure|hard start)/.test(text)) add.add("fuel_pump");
  if (/(fuel filter|filtro de combustible|fuel restriction)/.test(text)) add.add("fuel_filter");

  // Emissions / cleaning
  if (/(throttle|idle surge|mariposa|idle rough|stall)/.test(text)) add.add("throttle_body_cleaner");

  // Always include shop supplies for any physical repair
  if (add.size > 0 && !add.has("diagnostic_fee")) add.add("shop_supplies");

  // Nothing detected → generic diagnostic
  if (add.size === 0) { add.add("diagnostic_fee"); add.add("shop_supplies"); }

  return Array.from(add);
}

// Build store-level pricing for each part
function buildPartListings(partKeys, vehicleYear, language) {
  const isEn = language !== "es";
  const seed = vehicleYear ? Number(vehicleYear) % 3 : 0;

  return partKeys.map((key) => {
    const part = CATALOG[key];
    if (!part) return null;

    const stores = STORES.map((store) => {
      const mult = STORE_MULTIPLIERS[store.id] ?? 1;
      const rawPrice = part.retail * mult * part.qty;
      const price = Math.round(rawPrice * 100) / 100;
      const partNumber = part.partNum?.[store.id] || null;
      return {
        storeId: store.id,
        storeName: store.name,
        storeType: store.type,
        distanceMi: store.distanceMi,
        phone: store.phone,
        price,
        partNumber,
        availability: part.laborOnly ? "N/A" : avail(store.id, seed),
      };
    });

    // Sort stores by price ascending
    stores.sort((a, b) => a.price - b.price);

    return {
      key,
      name: isEn ? part.en : (part.es || part.en),
      nameEn: part.en,
      nameEs: part.es || part.en,
      qty: part.qty,
      unit: part.unit,
      category: part.cat,
      laborOnly: Boolean(part.laborOnly),
      stores,
    };
  }).filter(Boolean);
}

// Build the two quote options
function buildQuoteOptions(partListings, laborHoursLow, laborHoursHigh, laborRate = 145, language = "es") {
  const TAX_RATE = 0.0875;

  const buildOption = (getPrice) => {
    const lineItems = partListings.map((p) => {
      if (p.laborOnly) return null;
      const store = getPrice(p);
      return {
        partKey: p.key,
        name: p.name,
        nameEn: p.nameEn,
        nameEs: p.nameEs,
        qty: p.qty,
        unit: p.unit,
        category: p.category,
        unitPrice: store.price / p.qty,
        totalPrice: store.price,
        storeId: store.storeId,
        storeName: store.storeName,
        storeType: store.storeType,
        distanceMi: store.distanceMi,
        partNumber: store.partNumber,
        availability: store.availability,
        phone: store.phone,
      };
    }).filter(Boolean);

    const partsCost = lineItems.reduce((s, i) => s + i.totalPrice, 0);
    const laborLow = laborHoursLow * laborRate;
    const laborHigh = laborHoursHigh * laborRate;
    const taxLow = (partsCost + laborLow) * TAX_RATE;
    const taxHigh = (partsCost + laborHigh) * TAX_RATE;

    return {
      lineItems,
      partsCost: Math.round(partsCost * 100) / 100,
      laborLow: Math.round(laborLow * 100) / 100,
      laborHigh: Math.round(laborHigh * 100) / 100,
      laborHoursLow,
      laborHoursHigh,
      laborRate,
      taxLow: Math.round(taxLow * 100) / 100,
      taxHigh: Math.round(taxHigh * 100) / 100,
      totalLow: Math.round((partsCost + laborLow + taxLow) * 100) / 100,
      totalHigh: Math.round((partsCost + laborHigh + taxHigh) * 100) / 100,
    };
  };

  // Option A: Best Combo Price — cheapest store per part
  const comboOption = buildOption((p) => p.stores[0]);

  // Option B: Best Single Store — find which local store gives best total
  const localStoreIds = STORES.filter((s) => s.type === "local").map((s) => s.id);
  const storeTotals = localStoreIds.map((sid) => {
    const total = partListings.filter((p) => !p.laborOnly).reduce((sum, p) => {
      const match = p.stores.find((s) => s.storeId === sid);
      return sum + (match ? match.price : p.stores[0].price);
    }, 0);
    return { storeId: sid, storeName: STORES.find((s) => s.id === sid).name, total };
  });
  storeTotals.sort((a, b) => a.total - b.total);
  const bestSingle = storeTotals[0];
  const singleOption = buildOption((p) => p.stores.find((s) => s.storeId === bestSingle.storeId) || p.stores[0]);

  return {
    combo: {
      label: language === "en" ? "Best Price (Mix & Match)" : "Mejor precio (múltiples tiendas)",
      description: language === "en"
        ? "Lowest price on each part across all available stores"
        : "El precio más bajo por pieza en todas las tiendas disponibles",
      ...comboOption,
      storeCount: new Set(comboOption.lineItems.map((i) => i.storeId)).size,
    },
    single: {
      label: language === "en" ? `All from ${bestSingle.storeName}` : `Todo de ${bestSingle.storeName}`,
      description: language === "en"
        ? `Single pickup location — convenient, slightly higher total`
        : `Una sola tienda — conveniente, costo ligeramente mayor`,
      storeName: bestSingle.storeName,
      storeId: bestSingle.storeId,
      ...singleOption,
      storeCount: 1,
    },
    savings: Math.max(0, Math.round((singleOption.totalLow - comboOption.totalLow) * 100) / 100),
  };
}

export async function buildQuoteFromDiagnosis({ diagnosis, vehicle, language = "es" }) {
  const partKeys = detectParts(diagnosis);
  const estimate = diagnosis.estimate || {};
  const laborHoursLow = estimate.laborHoursLow || 1;
  const laborHoursHigh = estimate.laborHoursHigh || 2;
  const laborRate = 145;

  const partListings = buildPartListings(partKeys, vehicle?.year, language);
  const quotes = buildQuoteOptions(partListings, laborHoursLow, laborHoursHigh, laborRate, language);

  return {
    vehicle,
    diagnosis,
    partListings,
    quotes,
    laborRate,
    generatedAt: new Date().toISOString(),
  };
}

// Manual diagnosis input builder — lets shop tech bypass AI
export function buildManualDiagnosis({ causes, laborHoursLow = 1, laborHoursHigh = 2, language = "es" }) {
  const isEn = language === "en";
  return {
    summary: isEn
      ? "Manual diagnosis — entered by shop technician."
      : "Diagnóstico manual — ingresado por el técnico del taller.",
    safetyLevel: "moderado",
    safetyMessage: isEn
      ? "Verify all findings with physical inspection before proceeding."
      : "Verifica todos los hallazgos con inspección física antes de proceder.",
    possibleCauses: causes.map((c, i) => ({
      probability: Math.max(1, Math.min(99, c.probability || 70 - i * 15)),
      title: c.title,
      reason: c.reason || "",
      test: c.test || "",
      urgency: c.urgency || (isEn ? "Verify" : "Verificar"),
      tone: c.tone || (i === 0 ? "warn" : "neutral"),
    })),
    estimate: {
      low: 0,
      high: 0,
      partsLow: 0,
      partsHigh: 0,
      laborLow: laborHoursLow * 145,
      laborHigh: laborHoursHigh * 145,
      laborHoursLow,
      laborHoursHigh,
      confidence: "Alta",
      repairLabel: causes[0]?.title || (isEn ? "Repair per technician findings" : "Reparación según hallazgos del técnico"),
    },
    questions: [],
    source: "manual",
  };
}
