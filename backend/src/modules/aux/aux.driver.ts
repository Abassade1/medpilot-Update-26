/**
 * AUX intelligence behind a driver seam (spec §19, Q5).
 *
 * `deterministic` — rule-based content reproducing the approved frontend copy;
 *   runs everywhere with zero PHI egress. `llm` — the production integration
 *   point; requires a BAA-covered provider and is intentionally not enabled
 *   until Q5 (regulatory posture) is resolved.
 */
export interface TriageOutput {
  title: string;
  summary: string;
  possibleCauses: string;
  recommendedTreatment: string;
  severity: "routine" | "urgent" | "emergency";
}
export interface MealOutput {
  calories: number;
  baselineDeltaPct: number;
  segments: { label: string; percentage: number; colorHex: string }[];
  details: { code: string; label: string; body?: string }[];
}

export interface AuxDriver {
  readonly modelVersion: string;
  triage(symptom: string, condition: string, memberConditions: string[]): Promise<TriageOutput>;
  analyzeMeal(): Promise<MealOutput>;
  translate(fields: Record<string, string>, locale: string): Promise<Record<string, string> | null>;
}

const CHEST_PAIN: TriageOutput = {
  title: "Chest pain",
  summary:
    "Fast and/or difficult breathing — your breathing will become hard work, and you may see the ribs or skin under the neck “sucking in” or nostrils flaring when they are breathing, younger babies may bob their heads when breathing.",
  possibleCauses:
    "Gastroesophageal reflux disease (GERD or chronic heartburn) is the most common cause of chest pain. Heart issue or not, you should get medical attention to get a diagnosis and the treatment you need.",
  recommendedTreatment:
    "Chest pain treatment depends on the cause of the pain. If a heart attack is causing your chest pain, you’ll get emergency treatment as soon as you seek help. This can include medication and a procedure or surgery to restore blood flow to your heart.",
  severity: "urgent",
};

const CHEST_PAIN_FR: Record<string, string> = {
  title: "Douleur thoracique",
  summary:
    "Respiration rapide et/ou difficile — respirer devient un effort ; vous pouvez voir les côtes ou la peau sous le cou « se creuser », ou les narines s'ouvrir à chaque inspiration.",
  possibleCauses:
    "Le reflux gastro-œsophagien (RGO ou brûlures d'estomac chroniques) est la cause la plus fréquente de douleur thoracique. Problème cardiaque ou non, consultez un professionnel de santé pour obtenir un diagnostic et le traitement dont vous avez besoin.",
  recommendedTreatment:
    "Le traitement dépend de la cause de la douleur. En cas d'infarctus, un traitement d'urgence est mis en place dès la prise en charge : médicaments, intervention ou chirurgie pour rétablir la circulation sanguine vers le cœur.",
};

const GENERIC: Record<string, Partial<TriageOutput>> = {
  coughing: { title: "Coughing", severity: "routine" },
  difficult_breathing: { title: "Difficult breathing", severity: "emergency" },
  severe_headache: { title: "Severe headache", severity: "urgent" },
};

export class DeterministicAuxDriver implements AuxDriver {
  readonly modelVersion = "deterministic/2026-08";

  async triage(symptom: string, _condition: string, memberConditions: string[]): Promise<TriageOutput> {
    if (symptom === "chest_pain") {
      // member's recorded cardiac history raises severity
      const cardiac = memberConditions.some((c) => c.includes("heart") || c.includes("blood_pressure"));
      return { ...CHEST_PAIN, severity: cardiac ? "emergency" : "urgent" };
    }
    const g = GENERIC[symptom] ?? {};
    return {
      title: g.title ?? "Symptom check",
      summary:
        "Based on what you've told us, your symptoms deserve attention. Monitor how you feel over the next hours and note any changes in intensity.",
      possibleCauses:
        "Several common conditions can produce these symptoms. Only a clinical examination can establish the cause with confidence.",
      recommendedTreatment:
        "Rest, stay hydrated, and arrange a consultation with a clinician. Seek emergency care immediately if symptoms worsen suddenly.",
      severity: g.severity ?? "routine",
    };
  }

  async analyzeMeal(): Promise<MealOutput> {
    return {
      calories: 250,
      baselineDeltaPct: 14,
      // sums to 100 — fixes the 130% defect in the frontend mock (spec §10)
      segments: [
        { label: "Carbohydrate", percentage: 40, colorHex: "#2563EB" },
        { label: "fat & oil", percentage: 23, colorHex: "#F59E0B" },
        { label: "Vegetable", percentage: 20, colorHex: "#16A34A" },
        { label: "Red meat", percentage: 17, colorHex: "#E02D2D" },
      ],
      details: [
        { code: "nutrition", label: "Nutrition value" },
        { code: "ingredient", label: "Active Ingridient" },
        { code: "health", label: "Health factors" },
        { code: "warning", label: "Not suitable for!" },
      ],
    };
  }

  async translate(fields: Record<string, string>, locale: string): Promise<Record<string, string> | null> {
    if (locale !== "fr") return null;
    if (fields.title === CHEST_PAIN.title) return CHEST_PAIN_FR;
    return null;
  }
}
