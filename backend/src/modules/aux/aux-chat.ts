/**
 * Rule-based assistant replies.
 *
 * This is deliberately NOT a language model and says so. It recognises what a
 * member is trying to do, answers plainly, and points at the feature that does
 * it. It never diagnoses, and anything that sounds like an emergency or a crisis
 * is answered with safety guidance first, before any feature suggestion.
 *
 * Kept as a pure function so every rule can be tested without a database.
 */
export type ChatAction =
  | "triage" | "meal" | "hospitals" | "appointments" | "transport"
  | "pet" | "specialists" | "upgrade" | "packages" | "profile";

export interface Suggestion { label: string; action: ChatAction }
export interface ChatReply {
  intent: string;
  text: string;
  suggestions: Suggestion[];
  /** True when the reply is safety guidance, so the app can style it prominently. */
  urgent: boolean;
}

const SUGGEST: Record<ChatAction, Suggestion> = {
  triage: { label: "Check my symptoms", action: "triage" },
  meal: { label: "Analyse a meal", action: "meal" },
  hospitals: { label: "Find a hospital", action: "hospitals" },
  appointments: { label: "My appointments", action: "appointments" },
  transport: { label: "Medical transport", action: "transport" },
  pet: { label: "Pet specialists", action: "pet" },
  specialists: { label: "Independent specialists", action: "specialists" },
  upgrade: { label: "See plans", action: "upgrade" },
  packages: { label: "Medical packages", action: "packages" },
  profile: { label: "My profile", action: "profile" },
};
const pick = (...a: ChatAction[]) => a.map((x) => SUGGEST[x]);

const CRISIS = /\b(suicid\w*|kill myself|killing myself|end my life|want to die|self[- ]?harm|hurt myself)\b/i;
const EMERGENCY =
  /\b(chest pain|heart attack|can'?t breathe|cannot breathe|not breathing|difficulty breathing|trouble breathing|struggling to breathe|unconscious|passed out|stroke|seizure|overdos\w*|severe bleeding|bleeding heavily|choking|anaphyla\w*)\b/i;

const RULES: { intent: string; test: RegExp; text: string; actions: ChatAction[] }[] = [
  {
    intent: "symptoms",
    test: /\b(pain|ache|aching|fever|cough|nausea|nauseous|dizz\w*|rash|headache|migraine|vomit\w*|sick|symptom\w*|hurt\w*|swelling|swollen)\b/i,
    text: "I can walk you through a short symptom check and summarise what to do next. It isn't a diagnosis — a clinician should always confirm. Tap below to start.",
    actions: ["triage", "hospitals"],
  },
  {
    intent: "pets",
    test: /\b(pet|pets|dog|dogs|cat|cats|puppy|kitten|vet|veterinar\w*|groom\w*|sitter\w*|sitting|pet[- ]?sit\w*)\b/i,
    text: "For your pet you can book a vet or grooming appointment, or arrange a sitter while you're away.",
    actions: ["pet"],
  },
  {
    intent: "meal",
    test: /\b(meal|food|eat|eating|ate|calorie\w*|diet|nutrition|dinner|lunch|breakfast|carbs?|protein)\b/i,
    text: "You can photograph a meal and I'll estimate its calories and nutrient balance. These are estimates only, not dietary advice.",
    actions: ["meal"],
  },
  {
    intent: "appointments",
    test: /\b(appointment\w*|book\w*|schedule\w*|reschedul\w*|cancel\w*|my bookings?)\b/i,
    text: "You can see, change or cancel your appointments from the Appointments tab, and book a new one from any hospital's page.",
    actions: ["appointments", "hospitals"],
  },
  {
    intent: "hospitals",
    test: /\b(hospital\w*|clinic\w*|doctor\w*|physician\w*|specialist\w*|treatment\w*|surgery|surgeon|cardio\w*|cancer|oncolog\w*|neuro\w*)\b/i,
    text: "I can help you find a hospital or a treatment package. Browse facilities by specialty and country, then book an appointment.",
    actions: ["hospitals", "packages"],
  },
  {
    intent: "transport",
    test: /\b(transport\w*|ambulance\w*|jet|boat|evac\w*|flight\w*|repatriat\w*|airlift\w*|fly)\b/i,
    text: "Medical transport is available by private jet, ambulance and speed boat, depending on where you are. Choose your location and I'll show only what actually serves it.",
    actions: ["transport"],
  },
  {
    intent: "caregivers",
    test: /\b(nurse\w*|caregiver\w*|care giver\w*|carer\w*|home care|live[- ]in)\b/i,
    text: "Independent nurses and caregivers can support you at home. Browse their profiles, see their services and availability, then book or send a message.",
    actions: ["specialists"],
  },
  {
    intent: "plans",
    test: /\b(upgrade|pro plan|subscription|subscribe|price|pricing|cost|free plan|limit\w*|unlimited)\b/i,
    text: "MedPilot Basic is free with monthly limits on meal analyses, clinic access and evacuation requests. Pro removes the limits.",
    actions: ["upgrade"],
  },
];

const GREETING = /^\s*(hi|hello|hey|hiya|good (morning|afternoon|evening))\b/i;
const THANKS = /\b(thanks|thank you|cheers|appreciate)\b/i;

export function respond(message: string): ChatReply {
  const text = message.trim();

  // Safety first, always, and ahead of any feature suggestion.
  if (CRISIS.test(text)) {
    return {
      intent: "crisis", urgent: true, suggestions: [],
      text:
        "I'm really sorry you're feeling this way, and I'm glad you said something. You don't have to face this alone. " +
        "If you're in immediate danger, please call your local emergency number now. " +
        "In Canada and the US you can call or text 988 at any time to reach someone who will listen; in the UK call Samaritans on 116 123. " +
        "I'm an automated assistant and can't give you the support a person can.",
    };
  }
  if (EMERGENCY.test(text)) {
    return {
      intent: "emergency", urgent: true, suggestions: pick("transport"),
      text:
        "This could be an emergency. Please call your local emergency number now — 911 in Canada and the US, 112 across most of Europe, 999 in the UK. " +
        "Don't wait for an app. I'm an automated assistant and can't assess an emergency. " +
        "If you need to be transferred to another facility afterwards, medical transport is below.",
    };
  }

  const hits = RULES.filter((r) => r.test.test(text));
  if (hits.length > 0) {
    const [first, ...rest] = hits;
    const actions = [...new Set(hits.flatMap((h) => h.actions))].slice(0, 3);
    return {
      intent: first!.intent, urgent: false, suggestions: pick(...actions),
      text: rest.length > 0 ? `${first!.text} I can also help with ${rest.map((r) => r.intent).join(" and ")}.` : first!.text,
    };
  }
  if (THANKS.test(text)) {
    return { intent: "thanks", urgent: false, suggestions: [], text: "You're welcome. Let me know if there's anything else I can help with." };
  }
  if (GREETING.test(text) || text.length < 4) {
    return {
      intent: "greeting", urgent: false, suggestions: pick("triage", "meal", "hospitals"),
      text: "Hello! I can check symptoms, analyse a meal, help you find a hospital or specialist, or arrange medical transport. What do you need?",
    };
  }
  return {
    intent: "unknown", urgent: false, suggestions: pick("triage", "hospitals", "transport"),
    text:
      "I'm a simple assistant, so I might have missed what you meant. I can help with symptoms, meals, hospitals and packages, appointments, medical transport, pets, and home care. " +
      "Try describing what's wrong or what you need in a few words.",
  };
}
