// A curated library of step-by-step illustrated repair guides, in the same
// plain-data-plus-pure-functions style as obd-codes.js. Deliberately NOT per-vehicle —
// there's no image-hosting infrastructure and vehicle data (trim/engine) is unreliable
// below year/make/model even from a VIN decode, so these are general-procedure guides
// keyed by repair category, matched against whatever cause title/reason text the AI (or
// the fallback engine) produces. iFixit conventions followed throughout: numbered steps,
// no first-person voice, consistent vehicle orientation noted explicitly whenever it
// changes.
//
// commonSymptoms is the human-readable "how would a driver recognize this" list — codes,
// noises, warning lights — distinct from matchPattern, which is the regex actually used
// to route an AI-generated cause to this guide. partsNeeded is the actual replacement
// part(s), kept separate from toolsNeeded (the equipment used to do the job, not
// consumed by it).
//
// Ordering matters: matchGuideForCause tests patterns in insertion order and returns the
// first hit, so more specific categories (e.g. "starter motor") are placed before broader
// catch-alls (e.g. battery-and-terminals, whose pattern includes generic "won't start"
// wording) — otherwise a starter-specific cause could get shadowed by the broader battery
// match before it's ever tested.
export const REPAIR_GUIDES = {
  "front-brake-pads": {
    id: "front-brake-pads",
    heroImage: "front-brake-pads.svg",
    title: {
      en: "Replacing front brake pads",
      es: "Reemplazo de pastillas de freno delanteras",
    },
    matchPattern: /(fren|brake|pastilla|rechin|squeal|grind|rotor)/i,
    commonSymptoms: {
      en: ["Squealing or high-pitched noise when braking", "Grinding or metal-on-metal noise when braking", "Brake pedal feels less firm or takes longer to stop", "Vibration in the steering wheel or pedal while braking", "Dashboard brake pad wear warning light"],
      es: ["Chillido o ruido agudo al frenar", "Rechinido o ruido de metal con metal al frenar", "El pedal de freno se siente menos firme o tarda más en frenar", "Vibración en el volante o pedal al frenar", "Luz de advertencia de desgaste de pastillas en el tablero"],
    },
    difficulty: { en: "Moderate — 1–2 hours per side", es: "Moderada — 1–2 horas por lado" },
    toolsNeeded: {
      en: ["Lug wrench", "Jack + jack stands", "C-clamp or brake piston tool", "Socket set", "Wire brush"],
      es: ["Llave de cruz", "Gato + soportes de gato", "Prensa en C o herramienta de pistón de freno", "Juego de dados", "Cepillo de alambre"],
    },
    partsNeeded: {
      en: ["Front brake pad set", "Brake rotors (if worn or scored)", "Brake caliper hardware kit (optional)", "Brake cleaner spray"],
      es: ["Juego de pastillas de freno delanteras", "Rotores de freno (si están desgastados o rayados)", "Kit de hardware de mordaza (opcional)", "Limpiador de frenos en aerosol"],
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

  "spark-plugs": {
    id: "spark-plugs",
    heroImage: "spark-plugs.svg",
    title: { en: "Replacing spark plugs", es: "Reemplazo de bujías" },
    matchPattern: /(spark plug|bujía|bujia)/i,
    commonSymptoms: {
      en: ["Rough idle or engine shaking at a stop", "Reduced fuel economy", "Engine hesitation or stumble under acceleration", "Difficulty starting the engine", "Check engine light with a misfire code (P0300–P0308)"],
      es: ["Marcha inestable o el motor tiembla en alto", "Menor rendimiento de combustible", "El motor duda o falla al acelerar", "Dificultad para arrancar el motor", "Luz de check engine con código de falla (P0300–P0308)"],
    },
    difficulty: { en: "Moderate — 45–90 minutes, varies by engine layout", es: "Moderada — 45–90 minutos, varía según el motor" },
    toolsNeeded: {
      en: ["Spark plug socket + ratchet + extension", "Torque wrench", "Gap gauge", "Dielectric grease"],
      es: ["Dado para bujías + matraca + extensión", "Llave de torque", "Calibrador de separación", "Grasa dieléctrica"],
    },
    partsNeeded: {
      en: ["Spark plug set (one per cylinder)", "Anti-seize compound (if not pre-applied)"],
      es: ["Juego de bujías (una por cilindro)", "Compuesto antiadherente (si no viene aplicado)"],
    },
    steps: [
      { en: "Let the engine cool completely before starting — spark plugs and the surrounding metal get extremely hot. Locate the plugs, usually under the ignition coils on top of the engine.", es: "Deja que el motor se enfríe por completo antes de empezar — las bujías y el metal alrededor se calientan mucho. Localiza las bujías, normalmente debajo de las bobinas de encendido en la parte superior del motor." },
      { en: "Disconnect the negative battery terminal, and photograph each coil's wiring position if the engine has more than one coil style, so nothing gets mixed up.", es: "Desconecta el terminal negativo de la batería, y fotografía la posición del cableado de cada bobina si el motor tiene más de un estilo, para no confundirlas." },
      { en: "Remove the ignition coil from the first cylinder: unclip its electrical connector, remove the retaining bolt, and pull the coil straight up and out.", es: "Retira la bobina de encendido del primer cilindro: desconecta su conector eléctrico, quita el tornillo de sujeción y saca la bobina hacia arriba." },
      { en: "Use a spark plug socket with a long extension to loosen and remove the old plug, turning slowly and evenly to avoid cross-threading. Check the electrode color — light tan/gray is normal; black, oily, or blistered points to a different underlying problem.", es: "Usa un dado para bujías con extensión larga para aflojar y retirar la bujía vieja, girando despacio y parejo para no cruzar la rosca. Revisa el color del electrodo — gris claro es normal; negro, aceitoso o ampollado indica otro problema de fondo." },
      { en: "Check the gap on the new plug against the manufacturer's spec, thread it in by hand first to avoid cross-threading, then finish with the torque wrench to spec — overtightening can crack the porcelain.", es: "Verifica la separación de la bujía nueva según la especificación del fabricante, enróscala primero a mano para no cruzar la rosca, y termina con la llave de torque — apretar de más puede rajar la porcelana." },
      { en: "Reinstall the coil and repeat one cylinder at a time so nothing gets crossed up. Reconnect the battery when finished.", es: "Vuelve a instalar la bobina y repite un cilindro a la vez para no confundir el cableado. Reconecta la batería al terminar." },
    ],
    safetyNote: {
      en: "Work on a cold engine only — the cylinder head and exhaust manifold can cause serious burns even an hour after driving. Replace plugs one cylinder at a time so there's never doubt about which coil goes where.",
      es: "Trabaja solo con el motor frío — la culata y el múltiple de escape pueden causar quemaduras graves incluso una hora después de manejar. Reemplaza las bujías de una en una para no confundir el cableado.",
    },
  },

  "ignition-coil": {
    id: "ignition-coil",
    heroImage: "ignition-coil.svg",
    title: { en: "Replacing an ignition coil", es: "Reemplazo de una bobina de encendido" },
    matchPattern: /(ignition coil|bobina de encendido|coil pack)/i,
    commonSymptoms: {
      en: ["Check engine light with a single-cylinder misfire code (e.g. P0301)", "Engine shaking or rough running at idle", "Loss of power under acceleration", "Occasional stalling"],
      es: ["Luz de check engine con código de falla de un solo cilindro (ej. P0301)", "El motor tiembla o funciona irregular en ralentí", "Pérdida de potencia al acelerar", "Apagones ocasionales del motor"],
    },
    difficulty: { en: "Moderate — 20–40 minutes per coil", es: "Moderada — 20–40 minutos por bobina" },
    toolsNeeded: {
      en: ["Socket set", "Dielectric grease", "Multimeter (optional, for testing)"],
      es: ["Juego de dados", "Grasa dieléctrica", "Multímetro (opcional, para pruebas)"],
    },
    partsNeeded: {
      en: ["Ignition coil (matching the cylinder that's misfiring)", "New spark plug (recommended to replace at the same time)"],
      es: ["Bobina de encendido (correspondiente al cilindro con falla)", "Bujía nueva (recomendado reemplazarla al mismo tiempo)"],
    },
    steps: [
      { en: "With the engine off and cool, disconnect the negative battery terminal.", es: "Con el motor apagado y frío, desconecta el terminal negativo de la batería." },
      { en: "Locate the ignition coil for the misfiring cylinder — check the diagnostic code (e.g. P0301 = cylinder 1) to identify which one.", es: "Localiza la bobina del cilindro con falla — revisa el código de diagnóstico (por ejemplo P0301 = cilindro 1) para identificar cuál es." },
      { en: "Unclip the coil's electrical connector, then remove the single retaining bolt holding it down.", es: "Desconecta el conector eléctrico de la bobina, luego retira el único tornillo que la sujeta." },
      { en: "Pull the coil straight up and off the spark plug. Inspect the rubber boot for cracking or oil contamination, which can also cause misfires.", es: "Saca la bobina hacia arriba, fuera de la bujía. Revisa el hule de la punta por grietas o contaminación de aceite, que también pueden causar fallas." },
      { en: "Apply a thin layer of dielectric grease inside the new coil's boot, then press it straight down onto the spark plug until it seats fully.", es: "Aplica una capa delgada de grasa dieléctrica dentro del hule de la bobina nueva, luego presiónala directo sobre la bujía hasta que asiente por completo." },
      { en: "Reinstall the bolt and reconnect the electrical connector. Reconnect the battery and clear the trouble code if using a scan tool, then test drive to confirm the misfire is gone.", es: "Vuelve a colocar el tornillo y reconecta el conector eléctrico. Reconecta la batería y borra el código con un escáner si lo tienes, luego haz una prueba de manejo para confirmar que la falla desapareció." },
    ],
    safetyNote: {
      en: "If more than one cylinder is misfiring, or the same one keeps misfiring after a coil swap, have the spark plug and wiring harness inspected too — a coil alone won't fix a fouled plug or damaged connector.",
      es: "Si más de un cilindro está fallando, o el mismo sigue fallando después de cambiar la bobina, revisa también la bujía y el arnés — una bobina sola no arregla una bujía sucia o un conector dañado.",
    },
  },

  "serpentine-belt": {
    id: "serpentine-belt",
    heroImage: "serpentine-belt.svg",
    title: { en: "Replacing the serpentine belt", es: "Reemplazo de la banda serpentina" },
    matchPattern: /(serpentine belt|drive belt|banda del motor|banda serpentina|belt squeal|chirrido de banda)/i,
    commonSymptoms: {
      en: ["Squealing noise from the front of the engine, especially on startup or when turning the wheel", "Visible cracks or fraying on the belt", "Loss of power steering assist or A/C", "Battery warning light (the belt drives the alternator)"],
      es: ["Chillido desde el frente del motor, especialmente al arrancar o al girar el volante", "Grietas o deshilachado visible en la banda", "Pérdida de asistencia de dirección hidráulica o A/C", "Luz de advertencia de batería (la banda mueve el alternador)"],
    },
    difficulty: { en: "Moderate — 30–60 minutes", es: "Moderada — 30–60 minutos" },
    toolsNeeded: {
      en: ["Belt tensioner tool or breaker bar", "Belt routing diagram (usually under the hood)", "Flashlight"],
      es: ["Herramienta o barra para el tensor", "Diagrama de ruta de la banda (usualmente bajo el capó)", "Lámpara"],
    },
    partsNeeded: {
      en: ["Serpentine belt (correct length/rib count for the vehicle)", "Tensioner or idler pulley (if worn)"],
      es: ["Banda serpentina (largo/canales correctos para el vehículo)", "Polea tensora o loca (si está desgastada)"],
    },
    steps: [
      { en: "With the engine off and cool, find the belt routing diagram — usually a sticker on the radiator support or fan shroud — and take a photo of it before removing anything.", es: "Con el motor apagado y frío, busca el diagrama de ruta de la banda — normalmente una calcomanía en el soporte del radiador — y tómale una foto antes de quitar nada." },
      { en: "Find the automatic tensioner pulley (spring-loaded) and identify which direction relieves belt tension, usually by rotating it with a breaker bar or the tensioner tool.", es: "Localiza la polea tensora automática (con resorte) e identifica hacia qué lado se libera la tensión, normalmente girándola con una barra o la herramienta específica." },
      { en: "Rotate the tensioner to relieve tension, then slip the old belt off the pulleys, starting with the one furthest from the tensioner.", es: "Gira el tensor para liberar tensión, luego desliza la banda vieja fuera de las poleas, empezando por la más alejada del tensor." },
      { en: "Inspect the pulleys by hand for wobble or noise, and inspect the old belt for cracking, glazing, or missing chunks.", es: "Revisa las poleas a mano por bamboleo o ruido, y revisa la banda vieja por grietas, brillo excesivo o pedazos faltantes." },
      { en: "Route the new belt over every pulley exactly as shown in the diagram, leaving the tensioner pulley for last.", es: "Coloca la banda nueva sobre cada polea exactamente como muestra el diagrama, dejando la polea tensora al final." },
      { en: "Rotate the tensioner again to create slack, slip the belt over the last pulley, and slowly release the tensioner so it presses against the new belt.", es: "Gira el tensor de nuevo para crear holgura, coloca la banda sobre la última polea, y libera el tensor lentamente para que presione la banda nueva." },
      { en: "Start the engine briefly and visually confirm the belt is seated correctly in every groove with no rubbing or squealing.", es: "Enciende el motor brevemente y confirma visualmente que la banda está bien asentada en cada ranura, sin rozar ni chillar." },
    ],
    safetyNote: {
      en: "Keep hands and tools clear of the belt path when the engine is running, and never bypass the automatic tensioner with a fixed spacer — that removes its ability to compensate for belt stretch over time.",
      es: "Mantén las manos y herramientas alejadas de la ruta de la banda con el motor encendido, y nunca reemplaces el tensor automático con un espaciador fijo — eso le quita la capacidad de compensar el estiramiento de la banda con el tiempo.",
    },
  },

  "cabin-air-filter": {
    id: "cabin-air-filter",
    heroImage: "cabin-air-filter.svg",
    title: { en: "Replacing the cabin air filter", es: "Reemplazo del filtro de aire de cabina" },
    matchPattern: /(cabin air filter|filtro de cabina|filtro de habit[aá]culo|filtro de polen|pollen filter|ac filter|filtro del aire acondicionado)/i,
    commonSymptoms: {
      en: ["Weak airflow from the vents", "Musty or unpleasant smell from the vents", "Excessive dust inside the cabin", "Windows fogging up more than usual"],
      es: ["Poco flujo de aire por las salidas", "Olor a humedad o desagradable en las salidas", "Exceso de polvo dentro de la cabina", "Los vidrios se empañan más de lo normal"],
    },
    difficulty: { en: "Easy — 10–15 minutes", es: "Fácil — 10–15 minutos" },
    toolsNeeded: {
      en: ["Usually none, or a small screwdriver depending on the vehicle"],
      es: ["Generalmente ninguna, o un desarmador pequeño según el vehículo"],
    },
    partsNeeded: {
      en: ["Cabin air filter (correct size for the vehicle)"],
      es: ["Filtro de aire de cabina (tamaño correcto para el vehículo)"],
    },
    steps: [
      { en: "Locate the cabin air filter housing — most commonly behind the glove box, sometimes under the hood at the base of the windshield. Check the owner's manual if it's not obvious.", es: "Localiza el alojamiento del filtro de cabina — normalmente detrás de la guantera, a veces bajo el capó en la base del parabrisas. Revisa el manual del propietario si no es obvio." },
      { en: "If it's behind the glove box, empty it and unclip or unscrew the sides so it swings down or comes out, exposing the filter housing door.", es: "Si está detrás de la guantera, vacíala y desconecta o destornilla los lados para que baje o se salga, dejando a la vista la puerta del alojamiento del filtro." },
      { en: "Open the housing door and slide the old filter out, noting the airflow-direction arrow printed on its frame.", es: "Abre la puerta del alojamiento y desliza el filtro viejo hacia afuera, anotando la flecha de dirección de flujo impresa en el marco." },
      { en: "Note the amount of debris trapped in the old filter — a good indicator of how overdue the replacement was.", es: "Observa la cantidad de residuos atrapados en el filtro viejo — un buen indicador de cuánto se retrasó el cambio." },
      { en: "Slide the new filter in with the airflow arrow pointing the same direction as the old one, close the housing, and reinstall the glove box.", es: "Coloca el filtro nuevo con la flecha de flujo apuntando en la misma dirección que el anterior, cierra el alojamiento y reinstala la guantera." },
    ],
    safetyNote: {
      en: "None specific — this is one of the lowest-risk maintenance items on the vehicle.",
      es: "Ninguna en particular — este es uno de los trabajos de mantenimiento de menor riesgo del vehículo.",
    },
  },

  "engine-air-filter": {
    id: "engine-air-filter",
    heroImage: "engine-air-filter.svg",
    title: { en: "Replacing the engine air filter", es: "Reemplazo del filtro de aire del motor" },
    matchPattern: /(engine air filter|filtro de aire del motor|air intake filter|intake filter|filtro de aire)/i,
    commonSymptoms: {
      en: ["Reduced fuel economy", "Engine feels sluggish or underpowered", "Visible dirt/debris on the old filter", "Occasionally a check engine light for a rich fuel condition"],
      es: ["Menor rendimiento de combustible", "El motor se siente lento o sin potencia", "Suciedad visible en el filtro viejo", "Ocasionalmente, luz de check engine por mezcla rica"],
    },
    difficulty: { en: "Easy — 10–20 minutes", es: "Fácil — 10–20 minutos" },
    toolsNeeded: {
      en: ["Screwdriver (for some clip styles)"],
      es: ["Desarmador (según el estilo de broches)"],
    },
    partsNeeded: {
      en: ["Engine air filter (correct size for the vehicle)"],
      es: ["Filtro de aire del motor (tamaño correcto para el vehículo)"],
    },
    steps: [
      { en: "Locate the engine air filter box — a black plastic housing connected to a wide intake tube leading to the throttle body, typically on top of or beside the engine.", es: "Localiza la caja del filtro de aire del motor — un alojamiento de plástico negro conectado a un tubo ancho que lleva al cuerpo de aceleración, normalmente encima o al lado del motor." },
      { en: "Unclip or unscrew the housing latches (spring clips or screws, depending on the vehicle) and lift the top of the housing.", es: "Desconecta o destornilla los broches del alojamiento (clips o tornillos, según el vehículo) y levanta la tapa." },
      { en: "Remove the old filter, noting its orientation, and check for debris, oil contamination, or torn filter media.", es: "Retira el filtro viejo, anotando su orientación, y revisa por residuos, contaminación de aceite o el material del filtro roto." },
      { en: "Wipe out any loose debris from inside the housing with a dry rag — don't aim compressed air into the intake tube toward the engine.", es: "Limpia con un trapo seco cualquier residuo suelto dentro del alojamiento — no apuntes aire comprimido hacia el tubo de admisión en dirección al motor." },
      { en: "Install the new filter in the same orientation, close the housing, and re-secure the latches or screws.", es: "Instala el filtro nuevo en la misma orientación, cierra el alojamiento y vuelve a asegurar los broches o tornillos." },
    ],
    safetyNote: {
      en: "Make sure the housing seals completely when closed — unfiltered air entering through a gap can introduce dirt directly into the engine.",
      es: "Asegúrate de que el alojamiento cierre completamente — el aire sin filtrar que entre por un espacio puede introducir tierra directo al motor.",
    },
  },

  "oil-and-filter-change": {
    id: "oil-and-filter-change",
    heroImage: "oil-and-filter-change.svg",
    title: { en: "Changing the engine oil and filter", es: "Cambio de aceite y filtro del motor" },
    matchPattern: /(oil change|cambio de aceite|oil filter|filtro de aceite|dirty oil|aceite sucio|low oil|nivel de aceite)/i,
    commonSymptoms: {
      en: ["Oil change reminder light or mileage interval reached", "Oil looks dark and gritty on the dipstick", "Louder engine noise or ticking (from old, thin oil)", "Low oil level warning"],
      es: ["Luz recordatoria de cambio de aceite o se cumplió el intervalo", "El aceite se ve oscuro y sucio en la varilla", "Ruido más fuerte del motor (por aceite viejo o delgado)", "Advertencia de nivel de aceite bajo"],
    },
    difficulty: { en: "Moderate — 30–45 minutes", es: "Moderada — 30–45 minutos" },
    toolsNeeded: {
      en: ["Oil filter wrench", "Socket for the drain plug", "Drain pan", "Jack + jack stands (if needed)", "Funnel", "Gloves"],
      es: ["Llave para filtro de aceite", "Dado para el tapón de drenado", "Charola de drenado", "Gato + soportes (si se necesita)", "Embudo", "Guantes"],
    },
    partsNeeded: {
      en: ["Engine oil (correct type/grade and quantity)", "Oil filter", "Drain plug washer/gasket"],
      es: ["Aceite de motor (tipo/grado y cantidad correcta)", "Filtro de aceite", "Arandela/empaque del tapón de drenado"],
    },
    steps: [
      { en: "Warm the engine for a few minutes so the oil flows more easily and carries out more debris, then shut it off — warm, not hot enough to burn.", es: "Calienta el motor unos minutos para que el aceite fluya mejor y arrastre más residuos, luego apágalo — tibio, no tan caliente como para quemar." },
      { en: "Raise the front of the car if needed and support it securely on jack stands. Place the drain pan under the oil pan's drain plug.", es: "Levanta la parte delantera si es necesario y apóyala en soportes de gato. Coloca la charola debajo del tapón de drenado del cárter." },
      { en: "Remove the drain plug and let the oil drain completely into the pan. Inspect the plug's washer and replace it if crushed or damaged.", es: "Retira el tapón de drenado y deja que el aceite drene por completo. Revisa la arandela del tapón y reemplázala si está aplastada o dañada." },
      { en: "While it drains, locate and remove the oil filter using the filter wrench. Expect some oil spillage.", es: "Mientras drena, localiza y retira el filtro de aceite con la llave para filtro. Espera algo de derrame de aceite." },
      { en: "Reinstall the drain plug once draining stops, torqued to spec. Lubricate the new filter's rubber gasket with a bit of fresh oil, then hand-tighten per the filter's instructions.", es: "Vuelve a colocar el tapón una vez que deje de drenar, apretado al torque especificado. Lubrica el empaque de hule del filtro nuevo con un poco de aceite fresco, y apriétalo a mano según las instrucciones del filtro." },
      { en: "Lower the car, add the correct amount and grade of new oil, then start the engine and check for leaks around the drain plug and filter before checking the dipstick level once settled.", es: "Baja el auto, agrega la cantidad y tipo correcto de aceite nuevo, enciende el motor y revisa fugas alrededor del tapón y filtro antes de checar el nivel con la varilla una vez asentado." },
    ],
    safetyNote: {
      en: "Used motor oil is a skin irritant and environmental contaminant — wear gloves, and take the used oil and old filter to an auto parts store or recycling center rather than disposing of them in household trash.",
      es: "El aceite usado es irritante para la piel y contaminante — usa guantes, y lleva el aceite y filtro usados a una tienda de refacciones o centro de reciclaje en lugar de tirarlos en la basura.",
    },
  },

  "o2-sensor": {
    id: "o2-sensor",
    heroImage: "o2-sensor.svg",
    title: { en: "Replacing an oxygen (O2) sensor", es: "Reemplazo de un sensor de oxígeno (O2)" },
    matchPattern: /(o2 sensor|oxygen sensor|sensor de ox[ií]geno|sensor lambda)/i,
    commonSymptoms: {
      en: ["Check engine light with an O2 sensor code (P0130–P0167 range)", "Reduced fuel economy", "Rough idle", "Failed emissions test"],
      es: ["Luz de check engine con código de sensor de oxígeno (rango P0130–P0167)", "Menor rendimiento de combustible", "Marcha inestable", "Prueba de emisiones reprobada"],
    },
    difficulty: { en: "Moderate — 30–45 minutes", es: "Moderada — 30–45 minutos" },
    toolsNeeded: {
      en: ["Oxygen sensor socket (slotted for the wiring) or wrench", "Anti-seize compound", "Penetrating oil"],
      es: ["Dado para sensor de oxígeno (ranurado para el cable) o llave", "Compuesto antiadherente", "Aceite penetrante"],
    },
    partsNeeded: {
      en: ["Oxygen sensor (matching bank/position from the code)"],
      es: ["Sensor de oxígeno (correspondiente al banco/posición del código)"],
    },
    steps: [
      { en: "Confirm which sensor the trouble code refers to — codes specify bank and position (Sensor 1 is upstream of the catalytic converter; Sensor 2 is downstream, monitoring the converter).", es: "Confirma a qué sensor se refiere el código — los códigos especifican banco y posición (Sensor 1 está antes del catalizador; Sensor 2 después, vigilando el catalizador)." },
      { en: "With the engine cool, locate the sensor and unclip its electrical connector.", es: "Con el motor frío, localiza el sensor y desconecta su conector eléctrico." },
      { en: "Apply penetrating oil to the sensor's threads if it looks like it hasn't been out in a while, and let it soak — these often seize from years of heat cycling.", es: "Aplica aceite penetrante a la rosca del sensor si parece que no se ha movido en mucho tiempo, y déjalo actuar — suelen atascarse por años de ciclos de calor." },
      { en: "Use an oxygen sensor socket to break it loose and unscrew it from the exhaust pipe or manifold.", es: "Usa el dado para sensor de oxígeno para aflojarlo y sacarlo del tubo de escape o múltiple." },
      { en: "Apply anti-seize to the new sensor's threads (unless pre-coated) and thread it in by hand first to avoid cross-threading, then tighten to spec.", es: "Aplica antiadherente a la rosca del sensor nuevo (a menos que ya venga aplicado) y enrósquelo primero a mano, luego aprieta al torque especificado." },
      { en: "Reconnect the electrical connector, routing the wiring away from the exhaust and moving parts, then clear the trouble code if using a scan tool.", es: "Reconecta el conector eléctrico, enrutando el cable lejos del escape y partes móviles, luego borra el código con un escáner si lo tienes." },
    ],
    safetyNote: {
      en: "Let the exhaust system cool fully before starting — oxygen sensors are mounted directly on components that stay hot long after the engine shuts off.",
      es: "Deja que el sistema de escape se enfríe por completo antes de empezar — los sensores de oxígeno están montados directamente en piezas que siguen calientes mucho después de apagar el motor.",
    },
  },

  "mass-airflow-sensor": {
    id: "mass-airflow-sensor",
    heroImage: "mass-airflow-sensor.svg",
    title: { en: "Cleaning or replacing the mass airflow (MAF) sensor", es: "Limpieza o reemplazo del sensor de flujo de aire (MAF)" },
    matchPattern: /(mass airflow|\bmaf\b|sensor de flujo de aire|sensor maf)/i,
    commonSymptoms: {
      en: ["Check engine light with a MAF code (P0100–P0103)", "Rough idle or stalling", "Hesitation or jerking during acceleration", "Reduced fuel economy"],
      es: ["Luz de check engine con código MAF (P0100–P0103)", "Marcha inestable o el motor se apaga", "Titubeo o tirones al acelerar", "Menor rendimiento de combustible"],
    },
    difficulty: { en: "Easy to moderate — 15–30 minutes", es: "Fácil a moderada — 15–30 minutos" },
    toolsNeeded: {
      en: ["Screwdriver", "MAF sensor cleaner spray (if cleaning rather than replacing)"],
      es: ["Desarmador", "Limpiador en aerosol específico para sensor MAF (si se limpia en lugar de reemplazar)"],
    },
    partsNeeded: {
      en: ["MAF sensor cleaner (if cleaning)", "Replacement MAF sensor (if cleaning doesn't resolve it)"],
      es: ["Limpiador para sensor MAF (si se va a limpiar)", "Sensor MAF de reemplazo (si limpiarlo no resuelve el problema)"],
    },
    steps: [
      { en: "Locate the MAF sensor in the intake tube between the air filter box and the throttle body, usually secured with two screws and an electrical connector.", es: "Localiza el sensor MAF en el tubo de admisión entre la caja del filtro de aire y el cuerpo de aceleración, normalmente sujeto con dos tornillos y un conector eléctrico." },
      { en: "Disconnect the negative battery terminal, then unclip the sensor's electrical connector.", es: "Desconecta el terminal negativo de la batería, luego desconecta el conector eléctrico del sensor." },
      { en: "Loosen the hose clamp or screws holding the sensor in the intake tube and slide it out.", es: "Afloja la abrazadera o tornillos que sujetan el sensor en el tubo de admisión y deslízalo hacia afuera." },
      { en: "If cleaning: spray only MAF-specific sensor cleaner on the fine wire or film element — never touch it or use any other solvent, since it's extremely delicate. Let it air-dry fully before reinstalling.", es: "Si vas a limpiarlo: rocía solo limpiador específico para MAF sobre el elemento de alambre o película fina — nunca lo toques ni uses otro solvente, es muy delicado. Déjalo secar por completo antes de reinstalar." },
      { en: "Install the new (or cleaned) sensor in the same orientation as the original — usually marked with an airflow-direction arrow — and re-secure the clamp or screws.", es: "Instala el sensor nuevo (o limpio) en la misma orientación que el original — normalmente marcada con una flecha de dirección de flujo — y vuelve a asegurar la abrazadera o tornillos." },
      { en: "Reconnect the electrical connector and battery, then clear any trouble code if using a scan tool.", es: "Reconecta el conector eléctrico y la batería, luego borra cualquier código con un escáner si lo tienes." },
    ],
    safetyNote: {
      en: "Never use compressed air, a rag, or a household cleaner on a MAF sensor's element — it's a hot-wire or hot-film component that can be destroyed by touching it or using the wrong solvent.",
      es: "Nunca uses aire comprimido, un trapo o un limpiador casero en el elemento del sensor MAF — es un componente de alambre o película caliente que se puede dañar al tocarlo o usar el solvente equivocado.",
    },
  },

  "catalytic-converter": {
    id: "catalytic-converter",
    heroImage: "catalytic-converter.svg",
    title: { en: "Replacing a catalytic converter", es: "Reemplazo de un catalizador" },
    matchPattern: /(catalytic converter|catalizador|cat converter|p0420|p0430)/i,
    commonSymptoms: {
      en: ["Check engine light with a catalyst efficiency code (P0420/P0430)", "Rotten-egg smell from the exhaust", "Reduced engine power", "Rattling noise from underneath (broken internal substrate)", "Failed emissions test"],
      es: ["Luz de check engine con código de eficiencia del catalizador (P0420/P0430)", "Olor a huevo podrido del escape", "Pérdida de potencia del motor", "Ruido de traqueteo debajo del auto (sustrato interno roto)", "Prueba de emisiones reprobada"],
    },
    difficulty: { en: "Moderate to hard — 1–3 hours, often better suited to a shop lift", es: "Moderada a difícil — 1–3 horas, a menudo mejor en un taller con elevador" },
    toolsNeeded: {
      en: ["Jack + jack stands", "Penetrating oil", "Socket/wrench set", "Oxygen sensor socket (if sensors need to move)"],
      es: ["Gato + soportes", "Aceite penetrante", "Juego de dados/llaves", "Dado para sensor de oxígeno (si hay que mover sensores)"],
    },
    partsNeeded: {
      en: ["Catalytic converter (direct-fit or universal, per local emissions law)", "Exhaust gaskets"],
      es: ["Catalizador (ajuste directo o universal, según normativa local)", "Empaques de escape"],
    },
    steps: [
      { en: "Confirm the diagnosis first — codes like P0420/P0430 can also be caused by a failing upstream oxygen sensor, an exhaust leak before the converter, or an engine running rich, all cheaper to fix and worth ruling out first.", es: "Confirma primero el diagnóstico — códigos como P0420/P0430 también pueden deberse a un sensor de oxígeno fallando, una fuga de escape antes del catalizador, o un motor mezclando rico, todo más barato de arreglar y que vale la pena descartar primero." },
      { en: "Raise the vehicle and support it securely on jack stands, working from underneath.", es: "Levanta el vehículo y apóyalo firmemente en soportes de gato, trabajando desde abajo." },
      { en: "Locate the converter and identify the flange bolts or clamps connecting it to the pipe on both ends. Apply penetrating oil to any rusted bolts and let it soak.", es: "Localiza el catalizador e identifica los tornillos o abrazaderas de las bridas que lo conectan al tubo en ambos extremos. Aplica aceite penetrante a los tornillos oxidados y déjalo actuar." },
      { en: "Disconnect any oxygen sensors threaded into the converter itself before removing it.", es: "Desconecta cualquier sensor de oxígeno enroscado en el catalizador antes de retirarlo." },
      { en: "Remove the flange bolts or clamps at both ends and lower the old converter out. Rusted exhaust bolts commonly snap — budget extra time.", es: "Retira los tornillos o abrazaderas de ambas bridas y baja el catalizador viejo. Los tornillos oxidados del escape suelen romperse — considera tiempo extra." },
      { en: "Install the new converter with new gaskets at each flange, torque the bolts evenly, and reconnect any oxygen sensors.", es: "Instala el catalizador nuevo con empaques nuevos en cada brida, aprieta los tornillos parejo, y reconecta los sensores de oxígeno." },
    ],
    safetyNote: {
      en: "A catalytic converter runs extremely hot — let the exhaust cool completely before working underneath it. If bolts won't budge safely, a shop with proper equipment may be the better call.",
      es: "El catalizador se calienta muchísimo — deja que el escape se enfríe por completo antes de trabajar debajo. Si los tornillos no ceden de forma segura, un taller con el equipo adecuado puede ser mejor opción.",
    },
  },

  "evap-gas-cap": {
    id: "evap-gas-cap",
    heroImage: "evap-gas-cap.svg",
    title: { en: "Fixing an EVAP system code (gas cap check)", es: "Solución de un código del sistema EVAP (revisión de tapón de gasolina)" },
    matchPattern: /(gas cap|evap|tap[oó]n de gasolina|fuel cap|sistema evap)/i,
    commonSymptoms: {
      en: ["Check engine light with an EVAP code (P0440–P0457 range)", "Faint fuel smell near the vehicle", "Gas cap not clicking when tightened"],
      es: ["Luz de check engine con código EVAP (rango P0440–P0457)", "Ligero olor a gasolina cerca del vehículo", "El tapón de gasolina no hace clic al apretarlo"],
    },
    difficulty: { en: "Easy — 5–15 minutes", es: "Fácil — 5–15 minutos" },
    toolsNeeded: {
      en: ["None for the cap itself; a smoke machine (shop tool) if the cap isn't the culprit"],
      es: ["Ninguna para el tapón; una máquina de humo (herramienta de taller) si el tapón no es la causa"],
    },
    partsNeeded: {
      en: ["Fuel filler cap (OEM-spec, not universal)"],
      es: ["Tapón de gasolina (especificación original, no universal)"],
    },
    steps: [
      { en: "Check the fuel filler cap first — it's the single most common cause of an EVAP code. Make sure it's tightened until it clicks, and inspect its rubber gasket for cracking.", es: "Revisa primero el tapón de gasolina — es la causa más común de un código EVAP. Asegúrate de que esté apretado hasta hacer clic, y revisa el empaque de hule por grietas." },
      { en: "If the cap looks worn or the gasket is hardened, replace it with one rated for the vehicle — a universal cap that doesn't seal properly can trigger the same code again.", es: "Si el tapón se ve gastado o el empaque está duro, reemplázalo por uno específico para el vehículo — un tapón universal que no selle bien puede generar el mismo código otra vez." },
      { en: "After tightening or replacing the cap, the EVAP system needs several complete drive cycles before the code clears on its own — it won't clear immediately even if the fix is correct.", es: "Después de apretar o reemplazar el tapón, el sistema EVAP necesita varios ciclos de manejo completos antes de que el código se borre solo — no se borra de inmediato aunque el arreglo sea correcto." },
      { en: "If the code returns after a proper cap fix and a few drive cycles, the leak is likely elsewhere in the EVAP system and needs a smoke test to pinpoint, which requires shop equipment.", es: "Si el código regresa después de arreglar bien el tapón y algunos ciclos de manejo, la fuga probablemente está en otra parte del sistema EVAP y necesita una prueba de humo para localizarla, lo cual requiere equipo de taller." },
    ],
    safetyNote: {
      en: "Always fill up in a well-ventilated area and avoid overfilling the tank past the automatic shutoff — this is one of the more common ways the EVAP system develops a real leak instead of just a loose cap.",
      es: "Siempre carga combustible en un área ventilada y evita llenar el tanque más allá del corte automático — esta es una causa común de que el sistema EVAP desarrolle una fuga real y no solo un tapón flojo.",
    },
  },

  "thermostat-coolant": {
    id: "thermostat-coolant",
    heroImage: "thermostat-coolant.svg",
    title: { en: "Replacing the thermostat / fixing a coolant leak", es: "Reemplazo del termostato / solución de fuga de refrigerante" },
    matchPattern: /(thermostat|termostato|overheat|sobrecalent|coolant leak|fuga de refrigerante|coolant level|nivel de refrigerante)/i,
    commonSymptoms: {
      en: ["Temperature gauge reading higher than normal or overheating", "Heater blowing cold air (thermostat stuck open)", "Coolant puddle under the vehicle", "Low coolant warning light", "Sweet smell from the engine bay"],
      es: ["El indicador de temperatura marca más alto de lo normal o el motor se sobrecalienta", "La calefacción sopla aire frío (termostato atorado abierto)", "Charco de refrigerante debajo del vehículo", "Luz de advertencia de refrigerante bajo", "Olor dulce en el compartimento del motor"],
    },
    difficulty: { en: "Moderate — 45–75 minutes", es: "Moderada — 45–75 minutos" },
    toolsNeeded: {
      en: ["Socket set", "Drain pan", "New gasket or O-ring", "Correct coolant type", "Funnel"],
      es: ["Juego de dados", "Charola de drenado", "Empaque u O-ring nuevo", "Refrigerante del tipo correcto", "Embudo"],
    },
    partsNeeded: {
      en: ["Thermostat (correct temperature rating for the vehicle)", "Thermostat housing gasket or O-ring", "Coolant (correct type/mix)"],
      es: ["Termostato (temperatura correcta para el vehículo)", "Empaque u O-ring del alojamiento", "Refrigerante (tipo/mezcla correcta)"],
    },
    steps: [
      { en: "Let the engine cool completely — never open a cooling system while the engine is warm or hot; pressurized hot coolant can cause severe burns.", es: "Deja que el motor se enfríe por completo — nunca abras el sistema de enfriamiento con el motor tibio o caliente; el refrigerante presurizado y caliente puede causar quemaduras graves." },
      { en: "Locate the drain petcock on the radiator (or the lower radiator hose if there's none) and drain the coolant into a pan.", es: "Localiza la llave de drenado en el radiador (o la manguera inferior si no hay) y drena el refrigerante en una charola." },
      { en: "Locate the thermostat housing, typically where the upper radiator hose meets the engine, and remove its retaining bolts.", es: "Localiza el alojamiento del termostato, normalmente donde la manguera superior del radiador se conecta al motor, y retira sus tornillos." },
      { en: "Remove the old thermostat, noting its orientation, and clean the old gasket material off both mating surfaces.", es: "Retira el termostato viejo, anotando su orientación, y limpia los restos del empaque viejo de ambas superficies." },
      { en: "Install the new thermostat in the same orientation with a new gasket or O-ring, and reinstall the housing bolts to spec.", es: "Instala el termostato nuevo en la misma orientación con un empaque u O-ring nuevo, y vuelve a colocar los tornillos al torque especificado." },
      { en: "Refill the cooling system with the correct coolant type and concentration, then run the engine with the cap off (or per the bleed procedure) until air pockets work out, topping off as needed.", es: "Rellena el sistema de enfriamiento con el tipo y concentración correcta de refrigerante, luego enciende el motor con la tapa abierta (o según el procedimiento de purgado) hasta que salgan las bolsas de aire, rellenando según sea necesario." },
    ],
    safetyNote: {
      en: "Never remove a radiator cap or open the cooling system on a warm or hot engine. Also, mixing incompatible coolant types can cause corrosion inside the cooling system, so match the OEM-specified type exactly.",
      es: "Nunca retires la tapa del radiador ni abras el sistema de enfriamiento con el motor tibio o caliente. Además, mezclar tipos de refrigerante incompatibles puede causar corrosión interna, así que usa exactamente el tipo especificado por el fabricante.",
    },
  },

  "alternator": {
    id: "alternator",
    heroImage: "alternator.svg",
    title: { en: "Replacing the alternator", es: "Reemplazo del alternador" },
    matchPattern: /(alternator|alternador|charging system|sistema de carga|battery light|luz de bater[ií]a)/i,
    commonSymptoms: {
      en: ["Battery warning light on the dashboard while driving", "Dimming or flickering headlights/interior lights", "Electrical accessories working intermittently", "Whining or growling noise from the belt area", "Battery dies repeatedly even after being replaced"],
      es: ["Luz de advertencia de batería encendida al manejar", "Faros o luces interiores que se atenúan o parpadean", "Accesorios eléctricos funcionando de forma intermitente", "Zumbido o gruñido desde el área de la banda", "La batería se descarga repetidamente aunque se haya cambiado"],
    },
    difficulty: { en: "Moderate to hard — 1–2 hours, varies significantly by engine layout", es: "Moderada a difícil — 1–2 horas, varía mucho según el motor" },
    toolsNeeded: {
      en: ["Socket set", "Serpentine belt tool", "Multimeter"],
      es: ["Juego de dados", "Herramienta para banda serpentina", "Multímetro"],
    },
    partsNeeded: {
      en: ["Alternator (matching amperage rating for the vehicle)", "Serpentine belt (recommended to inspect/replace at the same time)"],
      es: ["Alternador (amperaje correspondiente al vehículo)", "Banda serpentina (recomendado revisarla o cambiarla al mismo tiempo)"],
    },
    steps: [
      { en: "With the engine running, use a multimeter to confirm the diagnosis: battery voltage should read roughly 13.5–14.5V. A reading close to resting voltage (around 12.6V) or lower points to a charging problem rather than the battery itself.", es: "Con el motor encendido, usa un multímetro para confirmar el diagnóstico: el voltaje de la batería debe marcar entre 13.5 y 14.5V aproximadamente. Una lectura cercana al voltaje de reposo (12.6V) o menor indica un problema de carga y no de la batería." },
      { en: "Disconnect the negative battery terminal before disconnecting anything from the alternator.", es: "Desconecta el terminal negativo de la batería antes de desconectar cualquier cosa del alternador." },
      { en: "Relieve tension on the serpentine belt with the tensioner tool and slip the belt off the alternator pulley.", es: "Libera la tensión de la banda serpentina con la herramienta del tensor y sácala de la polea del alternador." },
      { en: "Disconnect the alternator's electrical connector and the large battery/output wire, noting its position — it's usually secured with a nut, not a clip.", es: "Desconecta el conector eléctrico del alternador y el cable grueso de salida a la batería, anotando su posición — normalmente está sujeto con una tuerca, no un clip." },
      { en: "Remove the alternator's mounting bolts, which often requires working from underneath as well as from the top, and lift it out.", es: "Retira los tornillos de montaje del alternador, lo cual a menudo requiere trabajar desde abajo y desde arriba, y sácalo." },
      { en: "Install the new alternator in reverse order: mounting bolts first, then the output wire and connector, then the belt, then the battery.", es: "Instala el alternador nuevo en orden inverso: primero los tornillos de montaje, luego el cable de salida y el conector, luego la banda, y luego la batería." },
      { en: "Start the engine and recheck the running voltage with the multimeter to confirm the charging system is working correctly.", es: "Enciende el motor y vuelve a revisar el voltaje con el multímetro para confirmar que el sistema de carga funciona bien." },
    ],
    safetyNote: {
      en: "Always disconnect the battery before disconnecting the alternator's output wire — it's connected directly to the battery's positive terminal even with the engine off, and can spark if it touches grounded metal.",
      es: "Siempre desconecta la batería antes de desconectar el cable de salida del alternador — está conectado directamente a la terminal positiva de la batería aunque el motor esté apagado, y puede hacer chispa si toca metal conectado a tierra.",
    },
  },

  "starter-motor": {
    id: "starter-motor",
    heroImage: "starter-motor.svg",
    title: { en: "Replacing the starter motor", es: "Reemplazo del motor de arranque" },
    matchPattern: /(starter motor|motor de arranque|starter relay|solenoid click|clic del solenoide|no crank|no da arranque)/i,
    commonSymptoms: {
      en: ["A single loud click when turning the key, with lights staying bright", "Engine cranks slowly or not at all", "Grinding noise briefly after the engine starts", "Intermittent no-start that sometimes works after tapping the starter"],
      es: ["Un solo clic fuerte al girar la llave, con las luces brillantes", "El motor gira lento o no gira", "Ruido de rechinido brevemente después de encender", "Falla intermitente de arranque que a veces funciona golpeando el motor de arranque"],
    },
    difficulty: { en: "Moderate to hard — 1–2 hours, access varies significantly by vehicle", es: "Moderada a difícil — 1–2 horas, el acceso varía mucho según el vehículo" },
    toolsNeeded: {
      en: ["Socket set", "Jack + jack stands (access is often from underneath)"],
      es: ["Juego de dados", "Gato + soportes (el acceso suele ser desde abajo)"],
    },
    partsNeeded: {
      en: ["Starter motor", "Starter relay (if separate and suspected)"],
      es: ["Motor de arranque", "Relevador de arranque (si es separado y se sospecha de él)"],
    },
    steps: [
      { en: "Confirm the symptom pattern first: a single loud click when turning the key, with lights staying bright, usually points to the starter or solenoid; dimming lights with no click usually points to the battery.", es: "Confirma primero el patrón del síntoma: un solo clic fuerte al girar la llave, con las luces brillantes, suele indicar el motor de arranque o el solenoide; luces que se apagan sin ningún clic suele indicar la batería." },
      { en: "Disconnect the negative battery terminal.", es: "Desconecta el terminal negativo de la batería." },
      { en: "Locate the starter, usually mounted low on the engine block near the transmission, often only accessible from underneath. Raise and support the vehicle securely if needed.", es: "Localiza el motor de arranque, normalmente montado bajo en el bloque del motor cerca de la transmisión, a menudo solo accesible desde abajo. Levanta y apoya el vehículo firmemente si es necesario." },
      { en: "Disconnect the electrical connections: a small connector to the solenoid trigger wire, and a larger nut-secured cable carrying battery power. Note their positions.", es: "Desconecta las conexiones eléctricas: un conector pequeño al cable disparador del solenoide, y un cable más grueso sujeto con tuerca que lleva la corriente de la batería. Anota sus posiciones." },
      { en: "Remove the mounting bolts (typically two or three) and support the starter as the last bolt comes out — it's heavier than it looks.", es: "Retira los tornillos de montaje (normalmente dos o tres) y sostén el motor de arranque cuando salga el último tornillo — pesa más de lo que parece." },
      { en: "Install the new starter, torque the mounting bolts to spec, reconnect both electrical connections, and reconnect the battery.", es: "Instala el motor de arranque nuevo, aprieta los tornillos al torque especificado, reconecta ambas conexiones eléctricas, y reconecta la batería." },
      { en: "Test by starting the engine before fully closing everything back up, to catch any issue before it's harder to access again.", es: "Prueba encendiendo el motor antes de cerrar todo, para detectar cualquier problema antes de que sea más difícil acceder de nuevo." },
    ],
    safetyNote: {
      en: "Disconnect the battery before touching any starter wiring — the large cable stays live at all times and can cause a serious short if it contacts grounded metal.",
      es: "Desconecta la batería antes de tocar cualquier cable del motor de arranque — el cable grueso siempre tiene corriente y puede causar un corto serio si toca metal conectado a tierra.",
    },
  },

  "wheel-bearing": {
    id: "wheel-bearing",
    heroImage: "wheel-bearing.svg",
    title: { en: "Diagnosing and replacing a wheel bearing", es: "Diagnóstico y reemplazo de un rodamiento de rueda" },
    matchPattern: /(wheel bearing|rodamiento de rueda|humming noise|zumbido de rueda|bearing noise)/i,
    commonSymptoms: {
      en: ["Humming or growling noise that changes pitch with speed", "Noise gets louder when turning slightly to one side", "Steering wheel vibration at speed", "Uneven tire wear on one side"],
      es: ["Zumbido o gruñido que cambia de tono con la velocidad", "El ruido se hace más fuerte al girar ligeramente hacia un lado", "Vibración en el volante a velocidad", "Desgaste desigual de la llanta de un lado"],
    },
    difficulty: { en: "Hard — often better suited to a shop with a press", es: "Difícil — a menudo mejor en un taller con prensa hidráulica" },
    toolsNeeded: {
      en: ["Jack + jack stands", "Socket set", "Torque wrench (hub nuts need very high, specific torque)"],
      es: ["Gato + soportes", "Juego de dados", "Llave de torque (las tuercas de la maza necesitan torque muy alto y específico)"],
    },
    partsNeeded: {
      en: ["Wheel hub/bearing assembly (or bearing + race for press-fit designs)", "Axle nut (often single-use, torque-to-yield — check if it needs replacing)"],
      es: ["Maza/rodamiento de rueda (o rodamiento + pista para diseños prensados)", "Tuerca del eje (a menudo de un solo uso — verifica si necesita reemplazo)"],
    },
    steps: [
      { en: "Confirm the diagnosis: a wheel bearing typically produces a humming or grinding noise that changes pitch with vehicle speed, and may get louder when turning slightly to load the bearing on one side.", es: "Confirma el diagnóstico: un rodamiento de rueda suele producir un zumbido o rechinido que cambia de tono con la velocidad, y puede ser más fuerte al girar ligeramente hacia el lado que carga el rodamiento." },
      { en: "Raise and securely support the affected corner on a jack stand, then remove the wheel.", es: "Levanta y apoya firmemente la esquina afectada en un soporte de gato, luego retira la rueda." },
      { en: "Check for play by grabbing the tire at the 12 and 6 o'clock positions and rocking it — noticeable in-and-out play confirms a worn bearing.", es: "Revisa el juego agarrando la llanta en las posiciones de las 12 y las 6 y meciéndola — un juego notable de entrada y salida confirma un rodamiento desgastado." },
      { en: "On many modern vehicles the bearing is part of a sealed hub assembly that bolts to the knuckle — remove the brake caliper and rotor first, then the hub assembly's retaining bolts.", es: "En muchos vehículos modernos el rodamiento es parte de una maza sellada que se atornilla a la mangueta — retira primero la mordaza y el rotor, luego los tornillos de la maza." },
      { en: "On older press-fit designs, the bearing is pressed into the knuckle and genuinely requires a hydraulic press or specialized puller kit — not practical with only basic hand tools.", es: "En diseños más antiguos prensados, el rodamiento está prensado en la mangueta y requiere una prensa hidráulica o un kit extractor especializado — no es práctico con solo herramientas básicas." },
      { en: "Install the new hub/bearing assembly, torque the retaining bolts and axle/hub nut to the manufacturer's exact spec, then reinstall the brake components and wheel.", es: "Instala la maza/rodamiento nuevo, aprieta los tornillos y la tuerca del eje/maza exactamente al torque del fabricante, luego reinstala los componentes de freno y la rueda." },
    ],
    safetyNote: {
      en: "The hub or axle nut torque spec is usually very high (often 150–250+ ft-lbs) and is not optional. If the vehicle uses a press-fit bearing rather than a bolt-on hub assembly, this job needs a shop with a press.",
      es: "El torque de la tuerca de la maza o del eje suele ser muy alto (a menudo 150–250+ lb-pie) y no es opcional. Si el vehículo usa un rodamiento prensado en lugar de una maza atornillable, este trabajo necesita un taller con prensa.",
    },
  },

  "headlight-bulb": {
    id: "headlight-bulb",
    heroImage: "headlight-bulb.svg",
    title: { en: "Replacing a headlight bulb", es: "Reemplazo de un foco del faro" },
    matchPattern: /(headlight bulb|faro fundido|bulb out|foco fundido|headlight out)/i,
    commonSymptoms: {
      en: ["One headlight noticeably dimmer or completely out", "Flickering headlight", "Dashboard bulb-out warning (on vehicles with the feature)"],
      es: ["Un faro notablemente más tenue o completamente apagado", "Faro que parpadea", "Advertencia de foco fundido en el tablero (en vehículos con esta función)"],
    },
    difficulty: { en: "Easy — 10–20 minutes, harder on some vehicles with tight access", es: "Fácil — 10–20 minutos, más difícil en vehículos con poco acceso" },
    toolsNeeded: {
      en: ["Gloves", "Sometimes a screwdriver to access the bulb housing"],
      es: ["Guantes", "A veces un desarmador para acceder al alojamiento del foco"],
    },
    partsNeeded: {
      en: ["Replacement bulb (correct type/size for the vehicle — check owner's manual)"],
      es: ["Foco de reemplazo (tipo/tamaño correcto — revisar el manual del propietario)"],
    },
    steps: [
      { en: "Open the hood and locate the back of the headlight housing for the bulb that's out — check the owner's manual for exact bulb type and access, since some vehicles need a panel removed for access.", es: "Abre el capó y localiza la parte trasera del alojamiento del faro con el foco fundido — revisa el manual para el tipo de foco exacto y el acceso, ya que algunos vehículos requieren quitar un panel." },
      { en: "Unplug the electrical connector from the back of the old bulb, then unclip or twist off the retaining ring or clip holding it in place.", es: "Desconecta el conector eléctrico de la parte trasera del foco viejo, luego desconecta o gira el anillo o clip que lo sujeta." },
      { en: "Pull the old bulb straight out.", es: "Saca el foco viejo en línea recta." },
      { en: "Handle the new bulb by its base only — avoid touching the glass with bare fingers, since oils from skin can cause a halogen bulb to fail prematurely.", es: "Maneja el foco nuevo solo por la base — evita tocar el vidrio con los dedos, ya que el aceite de la piel puede hacer que un foco halógeno falle antes de tiempo." },
      { en: "Insert the new bulb, secure the retaining ring or clip, and reconnect the electrical connector.", es: "Inserta el foco nuevo, asegura el anillo o clip, y reconecta el conector eléctrico." },
      { en: "Turn on the headlights before closing everything up to confirm it works and is seated correctly.", es: "Enciende los faros antes de cerrar todo, para confirmar que funciona y está bien asentado." },
    ],
    safetyNote: {
      en: "If the headlight uses HID or LED technology rather than a simple halogen bulb, the system runs at much higher voltage and often needs a specific procedure — check the vehicle's specifics rather than assuming a simple swap.",
      es: "Si el faro usa tecnología HID o LED en lugar de un foco halógeno simple, el sistema trabaja a mucho más voltaje y a menudo necesita un procedimiento específico — revisa las especificaciones del vehículo en lugar de asumir un cambio simple.",
    },
  },

  "wiper-blades": {
    id: "wiper-blades",
    heroImage: "wiper-blades.svg",
    title: { en: "Replacing wiper blades", es: "Reemplazo de plumillas limpiaparabrisas" },
    matchPattern: /(wiper blade|limpiaparabrisas|wiper streak|raya en el parabrisas)/i,
    commonSymptoms: {
      en: ["Streaking or smearing across the windshield", "Squeaking noise while wiping", "Chattering or skipping motion", "Visible cracking or splitting of the rubber edge"],
      es: ["Rayas o manchas en el parabrisas", "Chillido al limpiar", "Movimiento a saltos o irregular", "Grietas visibles en el borde de hule"],
    },
    difficulty: { en: "Easy — 5 minutes", es: "Fácil — 5 minutos" },
    toolsNeeded: {
      en: ["None"],
      es: ["Ninguna"],
    },
    partsNeeded: {
      en: ["Wiper blade set (correct length for each side — check owner's manual)"],
      es: ["Juego de plumillas (largo correcto para cada lado — revisar el manual)"],
    },
    steps: [
      { en: "Lift the wiper arm away from the windshield until it locks in the raised service position.", es: "Levanta el brazo del limpiador lejos del parabrisas hasta que quede fijo en la posición de servicio." },
      { en: "Find the small release tab where the blade attaches to the metal arm — check the packaging of the new blade for the matching connection style.", es: "Busca la pequeña lengüeta de liberación donde la plumilla se conecta al brazo metálico — revisa el empaque de la plumilla nueva para el estilo de conexión correspondiente." },
      { en: "Press the release tab and slide the old blade off the hook at the end of the arm.", es: "Presiona la lengüeta y desliza la plumilla vieja fuera del gancho al final del brazo." },
      { en: "Slide the new blade onto the hook until it clicks into place.", es: "Desliza la plumilla nueva sobre el gancho hasta que haga clic." },
      { en: "Gently lower the wiper arm back down onto the windshield — don't let it snap down on its own, which can crack the glass or damage the blade.", es: "Baja el brazo suavemente sobre el parabrisas — no lo dejes caer solo, ya que puede rajar el vidrio o dañar la plumilla." },
      { en: "Repeat for the other side, and run the washer fluid to test both blades for even, streak-free contact.", es: "Repite del otro lado, y usa el lavaparabrisas para probar que ambas plumillas limpien parejo, sin rayas." },
    ],
    safetyNote: {
      en: "Never run the wipers dry on a dusty windshield for testing — always use washer fluid or water to avoid scratching the glass.",
      es: "Nunca actives los limpiadores en seco sobre un parabrisas con polvo para probar — siempre usa líquido limpiaparabrisas o agua para no rayar el vidrio.",
    },
  },

  "flat-tire-spare": {
    id: "flat-tire-spare",
    heroImage: "flat-tire-spare.svg",
    title: { en: "Changing a flat tire", es: "Cambio de una llanta ponchada" },
    matchPattern: /(flat tire|llanta ponchada|llanta pinchada|spare tire|llanta de refacci[oó]n|llanta de repuesto)/i,
    commonSymptoms: {
      en: ["Sudden pulling to one side while driving", "Thumping noise or vibration", "Dashboard tire pressure warning light", "Visible object embedded in the tire or a hissing sound"],
      es: ["Jalón repentino hacia un lado al manejar", "Ruido de golpeteo o vibración", "Luz de advertencia de presión de llantas en el tablero", "Objeto visible incrustado en la llanta o un silbido de aire"],
    },
    difficulty: { en: "Easy to moderate — 15–30 minutes", es: "Fácil a moderada — 15–30 minutos" },
    toolsNeeded: {
      en: ["Vehicle jack", "Lug wrench", "Wheel chocks (or heavy rocks)", "Flashlight if at night"],
      es: ["Gato del vehículo", "Llave de cruz", "Cuñas para rueda (o piedras pesadas)", "Lámpara si es de noche"],
    },
    partsNeeded: {
      en: ["Spare tire (already in the vehicle)", "Replacement tire (to restore the spare afterward)"],
      es: ["Llanta de refacción (ya incluida en el vehículo)", "Llanta de reemplazo (para restaurar la refacción después)"],
    },
    steps: [
      { en: "Pull as far off the road as possible onto flat, stable ground, put the vehicle in park (or first/reverse gear) with the parking brake on, and turn on hazard lights.", es: "Orílla el vehículo lo más posible en terreno plano y estable, ponlo en park (o primera/reversa) con el freno de mano puesto, y enciende las intermitentes." },
      { en: "Chock the wheel diagonally opposite the flat, then loosen the lug nuts on the flat tire about a quarter turn each while the wheel is still on the ground.", es: "Coloca una cuña en la rueda diagonalmente opuesta a la ponchada, luego afloja las tuercas de la llanta ponchada un cuarto de vuelta con la rueda todavía en el suelo." },
      { en: "Position the jack at the vehicle's designated jack point nearest the flat tire and raise the vehicle until the flat tire is a few inches off the ground.", es: "Coloca el gato en el punto de apoyo designado del vehículo más cercano a la llanta ponchada y levanta el vehículo hasta que la llanta quede unos centímetros del suelo." },
      { en: "Remove the lug nuts the rest of the way and pull the flat tire off.", es: "Termina de quitar las tuercas y retira la llanta ponchada." },
      { en: "Mount the spare, then thread the lug nuts on by hand in a star pattern before tightening further with the wrench, still without lowering the vehicle.", es: "Monta la llanta de refacción, luego enrosca las tuercas a mano en patrón de estrella antes de apretarlas más con la llave, todavía sin bajar el vehículo." },
      { en: "Lower the vehicle back to the ground, then finish tightening the lug nuts firmly in a star pattern with the vehicle's weight back on the tire.", es: "Baja el vehículo al suelo, luego termina de apretar las tuercas firmemente en patrón de estrella con el peso del vehículo sobre la llanta." },
    ],
    safetyNote: {
      en: "Never go underneath a vehicle supported only by a jack. If the spare is a temporary \"donut\" tire, it typically has a speed limit around 50 mph (80 km/h) and is meant to get the vehicle to a repair shop, not for extended driving.",
      es: "Nunca te metas debajo de un vehículo sostenido solo por un gato. Si la refacción es una llanta temporal tipo \"donut\", normalmente tiene un límite de velocidad de unos 80 km/h y es para llegar a un taller, no para manejo prolongado.",
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
    commonSymptoms: {
      en: ["Engine cranks slowly or clicks but won't start", "Dashboard lights dim when starting", "Corrosion (white/blue/green crust) on the battery terminals", "Battery warning light", "Electronics resetting (clock, radio presets) after being off"],
      es: ["El motor gira lento o hace clic pero no arranca", "Las luces del tablero se atenúan al arrancar", "Corrosión (costra blanca/azul/verde) en los terminales de la batería", "Luz de advertencia de batería", "Los sistemas electrónicos se reinician (reloj, radio) después de estar apagado"],
    },
    difficulty: { en: "Easy — 20–40 minutes", es: "Fácil — 20–40 minutos" },
    toolsNeeded: {
      en: ["Wrench for terminal clamps", "Wire brush or terminal cleaning tool", "Multimeter", "Gloves + eye protection"],
      es: ["Llave para las abrazaderas de terminal", "Cepillo de alambre o herramienta limpia-terminales", "Multímetro", "Guantes y protección para los ojos"],
    },
    partsNeeded: {
      en: ["Car battery (correct group size and CCA rating for the vehicle)", "Terminal cleaning solution or baking soda + water"],
      es: ["Batería para auto (tamaño de grupo y capacidad CCA correctos)", "Solución limpiadora de terminales o bicarbonato con agua"],
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
