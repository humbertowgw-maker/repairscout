import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { generateText, Output } from "ai";
import { z } from "zod";

const DiagnosisSchema = z.object({
  summary: z.string(),
  safetyLevel: z.enum(["bajo", "moderado", "alto", "crítico"]),
  safetyMessage: z.string(),
  possibleCauses: z.array(
    z.object({
      probability: z.number().min(1).max(99),
      title: z.string(),
      reason: z.string(),
      test: z.string(),
      urgency: z.string(),
      tone: z.enum(["danger", "warn", "neutral"]),
    }),
  ).min(1).max(4),
  estimate: z.object({
    low: z.number().nonnegative(),
    high: z.number().nonnegative(),
    partsLow: z.number().nonnegative(),
    partsHigh: z.number().nonnegative(),
    laborLow: z.number().nonnegative(),
    laborHigh: z.number().nonnegative(),
    laborHoursLow: z.number().nonnegative(),
    laborHoursHigh: z.number().nonnegative(),
    confidence: z.enum(["Baja", "Media", "Alta"]),
    repairLabel: z.string(),
  }),
  questions: z.array(z.string()).max(4),
});

function fallbackDiagnosis(description) {
  const normalized = description.toLowerCase();
  const brakeConcern = /(fren|brake|rechin|grind)/.test(normalized);
  const startingConcern = /(no enciende|no arranca|won't start|bater)/.test(normalized);

  if (startingConcern) {
    return {
      summary: "El problema parece estar relacionado con el sistema de arranque o la alimentación eléctrica.",
      safetyLevel: "moderado",
      safetyMessage: "No intentes arrancar repetidamente si notas olor a quemado, humo o cables calientes.",
      possibleCauses: [
        {
          probability: 72,
          title: "Batería descargada o deteriorada",
          reason: "Una batería con bajo voltaje es una de las causas más comunes cuando el motor no arranca.",
          test: "Medir el voltaje en reposo y durante el intento de arranque.",
          urgency: "Revisar primero",
          tone: "warn",
        },
        {
          probability: 38,
          title: "Conexión eléctrica deficiente",
          reason: "Terminales flojos o corroídos pueden impedir que llegue suficiente corriente al motor de arranque.",
          test: "Inspeccionar terminales, tierras y caída de voltaje en los cables.",
          urgency: "Verificar",
          tone: "neutral",
        },
      ],
      estimate: {
        low: 120,
        high: 480,
        partsLow: 80,
        partsHigh: 310,
        laborLow: 40,
        laborHigh: 170,
        laborHoursLow: 0.5,
        laborHoursHigh: 1.5,
        confidence: "Media",
        repairLabel: "Diagnóstico del sistema de arranque y posible reemplazo de batería",
      },
      questions: ["¿Las luces del tablero encienden?", "¿Escuchas un clic al girar la llave?"],
    };
  }

  if (brakeConcern) {
    return {
      summary: "Los síntomas apuntan primero al sistema de frenos delantero.",
      safetyLevel: "alto",
      safetyMessage: "Limita el uso del vehículo hasta que los frenos sean inspeccionados.",
      possibleCauses: [
        {
          probability: 78,
          title: "Pastillas de freno delanteras desgastadas",
          reason: "El rechinido al frenar suele aparecer cuando queda muy poco material de fricción.",
          test: "Inspeccionar el grosor de las pastillas y la superficie de los rotores.",
          urgency: "No lo pospongas",
          tone: "danger",
        },
        {
          probability: 54,
          title: "Rotores delanteros rayados",
          reason: "El contacto de metal con metal puede producir surcos, ruido y vibración.",
          test: "Medir el grosor y la desviación lateral de los rotores.",
          urgency: "Inspeccionar hoy",
          tone: "warn",
        },
        {
          probability: 21,
          title: "Rodamiento de rueda desgastado",
          reason: "Un rodamiento dañado puede producir un rechinido que cambia con la velocidad.",
          test: "Elevar el vehículo y revisar juego y ruido en la rueda.",
          urgency: "Descartar",
          tone: "neutral",
        },
      ],
      estimate: {
        low: 230,
        high: 540,
        partsLow: 40,
        partsHigh: 220,
        laborLow: 174,
        laborHigh: 261,
        laborHoursLow: 1.2,
        laborHoursHigh: 1.8,
        confidence: "Alta",
        repairLabel: "Inspección y posible reemplazo de frenos delanteros",
      },
      questions: ["¿Sientes vibración en el pedal?", "¿El ruido ocurre solamente al frenar?"],
    };
  }

  return {
    summary: "Se requiere más información y una inspección física para acotar la causa.",
    safetyLevel: "moderado",
    safetyMessage: "Deja de conducir si aparecen humo, olor a combustible, pérdida de frenos, sobrecalentamiento o luces rojas.",
    possibleCauses: [
      {
        probability: 45,
        title: "Falla relacionada con el síntoma reportado",
        reason: "La descripción permite orientar la inspección, pero todavía no identifica un sistema con suficiente certeza.",
        test: "Realizar escaneo OBD-II, inspección visual y prueba de manejo controlada.",
        urgency: "Diagnosticar",
        tone: "warn",
      },
    ],
    estimate: {
      low: 120,
      high: 650,
      partsLow: 0,
      partsHigh: 400,
      laborLow: 120,
      laborHigh: 250,
      laborHoursLow: 1,
      laborHoursHigh: 2,
      confidence: "Baja",
      repairLabel: "Diagnóstico inicial del vehículo",
    },
    questions: ["¿Cuándo comenzó?", "¿Hay luces de advertencia o códigos OBD-II?"],
  };
}

export async function diagnoseVehicle(input) {
  const vehicle = input.vehicle || {};
  const systemPrompt = `Eres un asistente automotriz bilingüe para RepairScout. Responde en español.
Tu evaluación es preliminar y nunca debe presentarse como un diagnóstico confirmado.
Prioriza seguridad. Indica claramente cuándo no se debe conducir.
No inventes boletines técnicos, retiros, precios exactos, disponibilidad de piezas ni procedimientos OEM.
Las probabilidades son estimaciones orientativas y no deben sumar necesariamente 100.
Los costos deben ser rangos prudentes en dólares estadounidenses basados en reparación independiente general.`;
  const userPrompt = JSON.stringify({
    vehicle,
    mileage: input.mileage,
    description: input.description,
    obdCodes: input.obdCodes || [],
    zip: input.zip,
  });

  if (!process.env.OPENAI_API_KEY && (process.env.VERCEL === "1" || process.env.VERCEL_OIDC_TOKEN || process.env.AI_GATEWAY_API_KEY)) {
    try {
      const { output } = await generateText({
        model: process.env.AI_GATEWAY_MODEL || "openai/gpt-5.4",
        system: systemPrompt,
        prompt: userPrompt,
        output: Output.object({ schema: DiagnosisSchema }),
        providerOptions: {
          gateway: {
            tags: ["app:repairscout", "feature:diagnosis"],
          },
        },
      });

      return {
        ...output,
        source: "ai-gateway",
      };
    } catch (error) {
      console.error("AI Gateway diagnosis failed:", error);
      return { ...fallbackDiagnosis(input.description), source: "fallback" };
    }
  }

  if (!process.env.OPENAI_API_KEY) {
    return { ...fallbackDiagnosis(input.description), source: "fallback" };
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.parse({
    model: process.env.OPENAI_MODEL || "gpt-5.5",
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: systemPrompt,
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: userPrompt,
          },
        ],
      },
    ],
    text: {
      format: zodTextFormat(DiagnosisSchema, "vehicle_diagnosis"),
    },
  });

  return {
    ...response.output_parsed,
    source: "openai",
  };
}
