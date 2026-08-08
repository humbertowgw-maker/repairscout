// A small, curated library of step-by-step illustrated repair guides, in the same
// plain-data-plus-pure-functions style as obd-codes.js. Deliberately NOT per-vehicle —
// there's no image-hosting infrastructure and vehicle data (trim/engine) is unreliable
// below year/make/model even from a VIN decode, so these are general-procedure guides
// keyed by repair category, matching the same two categories fallbackDiagnosis() in
// diagnosis.js already hand-recognizes (brake, starting/battery). iFixit conventions
// followed throughout: numbered steps, no first-person voice, consistent vehicle
// orientation noted explicitly whenever it changes.
export const REPAIR_GUIDES = {
  "front-brake-pads": {
    id: "front-brake-pads",
    heroImage: "front-brake-pads.svg",
    title: {
      en: "Replacing front brake pads",
      es: "Reemplazo de pastillas de freno delanteras",
    },
    matchPattern: /(fren|brake|pastilla|rechin|squeal|grind|rotor)/i,
    difficulty: { en: "Moderate — 1–2 hours per side", es: "Moderada — 1–2 horas por lado" },
    toolsNeeded: {
      en: ["Lug wrench", "Jack + jack stands", "C-clamp or brake piston tool", "Socket set", "Wire brush"],
      es: ["Llave de cruz", "Gato + soportes de gato", "Prensa en C o herramienta de pistón de freno", "Juego de dados", "Cepillo de alambre"],
    },
    steps: [
      {
        en: "Loosen the front lug nuts about a quarter turn while the wheel is still on the ground, then jack up the front of the car and support it securely on jack stands. Never work under a car supported only by a jack.",
        es: "Afloja las tuercas delanteras un cuarto de vuelta con la rueda todavía en el suelo, luego levanta la parte delantera del auto y apóyala firmemente en soportes de gato. Nunca trabajes debajo de un auto sostenido solo por un gato."
      },
      {
        en: "Remove the lug nuts the rest of the way and take the wheel off, exposing the brake caliper and rotor.",
        es: "Termina de quitar las tuercas y retira la rueda, dejando a la vista la mordaza y el rotor de freno."
      },
      {
        en: "Remove the two caliper bolts (usually on the back side of the caliper) and lift the caliper off the rotor. Support it with a bungee cord or wire so it doesn't hang by the brake hose.",
        es: "Retira los dos tornillos de la mordaza (normalmente en la parte trasera) y levanta la mordaza del rotor. Sostenla con una cuerda o alambre para que no cuelgue de la manguera de freno."
      },
      {
        en: "Slide the old brake pads out of the caliper bracket. Note the orientation of any wear-indicator clips before removing them, so the new pads go back the same way.",
        es: "Desliza las pastillas viejas fuera del soporte de la mordaza. Anota la orientación de cualquier clip indicador de desgaste antes de retirarlas, para colocar las nuevas de la misma forma."
      },
      {
        en: "Use a C-clamp (or a dedicated brake piston tool) to slowly push the caliper piston back into its bore — this makes room for the new, thicker pads. Watch the brake fluid reservoir; it will rise as the piston retracts, so remove some fluid first if it's near full.",
        es: "Usa una prensa en C (o una herramienta específica para pistones de freno) para empujar lentamente el pistón de la mordaza hacia su alojamiento — esto deja espacio para las pastillas nuevas, más gruesas. Vigila el depósito de líquido de frenos, ya que subirá al retraer el pistón; retira algo de líquido primero si está casi lleno."
      },
      {
        en: "Install the new pads into the caliper bracket in the same orientation as the old ones, then refit the caliper over the rotor and torque the caliper bolts to the manufacturer's spec.",
        es: "Instala las pastillas nuevas en el soporte de la mordaza con la misma orientación que las anteriores, luego coloca la mordaza sobre el rotor y aprieta los tornillos de la mordaza al torque especificado por el fabricante."
      },
      {
        en: "Reinstall the wheel, lower the car, and torque the lug nuts to spec in a star pattern. Before driving, pump the brake pedal several times until it feels firm — this reseats the pads against the rotor.",
        es: "Vuelve a instalar la rueda, baja el auto y aprieta las tuercas al torque especificado en patrón de estrella. Antes de conducir, bombea el pedal de freno varias veces hasta que se sienta firme — esto asienta las pastillas contra el rotor."
      },
    ],
    safetyNote: {
      en: "If the rotor surface is scored, grooved, or below minimum thickness, replace it along with the pads rather than resurfacing worn rotors against new pads — this is a common reason a fresh pad job still squeals.",
      es: "Si la superficie del rotor está rayada, con surcos o por debajo del grosor mínimo, reemplázalo junto con las pastillas en lugar de usar rotores desgastados con pastillas nuevas — esta es una causa común de que un trabajo de pastillas nuevas siga rechinando.",
    },
  },

  "battery-and-terminals": {
    id: "battery-and-terminals",
    heroImage: "battery-and-terminals.svg",
    title: {
      en: "Testing and replacing a weak battery, cleaning corroded terminals",
      es: "Probar y reemplazar una batería débil, limpiar terminales con corrosión",
    },
    matchPattern: /(batt|bater|no enciende|no arranca|won'?t start|corro|terminal)/i,
    difficulty: { en: "Easy — 20–40 minutes", es: "Fácil — 20–40 minutos" },
    toolsNeeded: {
      en: ["Wrench for terminal clamps", "Wire brush or terminal cleaning tool", "Multimeter", "Gloves + eye protection"],
      es: ["Llave para las abrazaderas de terminal", "Cepillo de alambre o herramienta limpia-terminales", "Multímetro", "Guantes y protección para los ojos"],
    },
    steps: [
      {
        en: "With the engine off, use a multimeter to check resting battery voltage. A healthy, fully charged battery reads about 12.6V; below 12.4V suggests a weak charge, and below 12V suggests a battery that likely needs replacement.",
        es: "Con el motor apagado, usa un multímetro para revisar el voltaje de la batería en reposo. Una batería sana y completamente cargada marca alrededor de 12.6V; por debajo de 12.4V sugiere carga débil, y por debajo de 12V sugiere que probablemente necesita reemplazo."
      },
      {
        en: "Inspect both terminals for corrosion — a white, blue, or greenish crust. This buildup increases resistance and can cause slow or failed starts even with a good battery.",
        es: "Inspecciona ambos terminales en busca de corrosión — una costra blanca, azul o verdosa. Esta acumulación aumenta la resistencia y puede causar arranques lentos o fallidos incluso con una batería en buen estado."
      },
      {
        en: "Always disconnect the negative (−) terminal first, then the positive (+). This order avoids accidentally shorting a wrench between the positive terminal and any grounded metal part of the car.",
        es: "Siempre desconecta primero el terminal negativo (−), luego el positivo (+). Este orden evita que una llave haga corto accidentalmente entre el terminal positivo y alguna parte metálica conectada a tierra del auto."
      },
      {
        en: "Clean each terminal and clamp with a wire brush or terminal cleaning tool until bare metal shows and the crust is gone.",
        es: "Limpia cada terminal y abrazadera con un cepillo de alambre o herramienta limpia-terminales hasta que se vea el metal desnudo y la costra desaparezca."
      },
      {
        en: "If replacing the battery: with both terminals already disconnected, remove the battery hold-down clamp and lift the old battery out. Batteries are heavy and contain acid — lift with your legs, keep it upright, and set the new one in the same orientation.",
        es: "Si vas a reemplazar la batería: con ambos terminales ya desconectados, retira la abrazadera de sujeción y saca la batería vieja. Las baterías son pesadas y contienen ácido — levanta con las piernas, mantenla en posición vertical, y coloca la nueva con la misma orientación."
      },
      {
        en: "Reconnect the positive (+) terminal first this time, then the negative (−) — the reverse order from disconnecting. Tighten both clamps snugly; they shouldn't move by hand but don't need to be forced.",
        es: "Esta vez reconecta primero el terminal positivo (+), luego el negativo (−) — el orden inverso al de desconexión. Aprieta ambas abrazaderas firmemente; no deberían moverse con la mano, pero no es necesario forzarlas."
      },
    ],
    safetyNote: {
      en: "Battery acid can cause burns and permanent eye damage — wear gloves and eye protection, and never lean directly over the battery while working on it. If a battery is swollen, leaking, or smells like rotten eggs, don't attempt this yourself — have it handled by a shop.",
      es: "El ácido de la batería puede causar quemaduras y daño ocular permanente — usa guantes y protección para los ojos, y nunca te inclines directamente sobre la batería mientras trabajas. Si una batería está hinchada, tiene fugas o huele a huevo podrido, no lo intentes tú mismo — llévala a un taller.",
    },
  },
};

export function matchGuideForCause(cause) {
  if (!cause) return null;
  const text = `${cause.title || ""} ${cause.reason || ""}`;
  return Object.values(REPAIR_GUIDES).find((g) => g.matchPattern.test(text)) || null;
}

export function getGuide(id) {
  return REPAIR_GUIDES[id] || null;
}
