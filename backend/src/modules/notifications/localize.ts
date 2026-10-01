export type Lang = "en" | "fr" | "ar";

/**
 * Notification copy is stored in English and translated when it is shown or sent, using the
 * member's saved language. Fixed sentences are matched exactly; sentences with a name or date in
 * them use a `{placeholder}` template. Anything not listed here is delivered in English.
 * Machine-drafted: needs native and medical review before release.
 */
const FIXED: Record<string, [string, string]> = {
  "Request received": ["Demande reçue", "تم استلام الطلب"],
  "Your appointment request is in. A representative will be in contact shortly.": ["Votre demande de rendez-vous a bien été reçue. Un conseiller vous contactera sous peu.", "تم استلام طلب موعدك. سيتواصل معك أحد الممثلين قريباً."],
  "Change received": ["Modification reçue", "تم استلام التغيير"],
  "Your new time has been sent for confirmation. Your previous slot is released.": ["Votre nouvel horaire a été envoyé pour confirmation. Votre créneau précédent est libéré.", "تم إرسال الوقت الجديد للتأكيد. وتم تحرير موعدك السابق."],
  "Your appointment request has been updated.": ["Votre demande de rendez-vous a été mise à jour.", "تم تحديث طلب موعدك."],
  "Appointment confirmed": ["Rendez-vous confirmé", "تم تأكيد الموعد"],
  "Your appointment has been confirmed. Open the app for details.": ["Votre rendez-vous est confirmé. Ouvrez l'application pour les détails.", "تم تأكيد موعدك. افتح التطبيق للتفاصيل."],
  "Appointment update": ["Mise à jour du rendez-vous", "تحديث الموعد"],
  "Appointment cancelled": ["Rendez-vous annulé", "تم إلغاء الموعد"],
  "We couldn't confirm your appointment request. Open the app for details.": ["Nous n'avons pas pu confirmer votre demande de rendez-vous. Ouvrez l'application pour les détails.", "لم نتمكن من تأكيد طلب موعدك. افتح التطبيق للتفاصيل."],
  "Transport request received": ["Demande de transport reçue", "تم استلام طلب النقل"],
  "Our dispatch team has your request and will confirm shortly.": ["Notre équipe de régulation a bien reçu votre demande et la confirmera sous peu.", "استلم فريق التنسيق طلبك وسيؤكده قريباً."],
  "Transport confirmed": ["Transport confirmé", "تم تأكيد النقل"],
  "Transport update": ["Mise à jour du transport", "تحديث النقل"],
  "Transport cancelled": ["Transport annulé", "تم إلغاء النقل"],
  "Your medical transport has been confirmed. Open the app for the details.": ["Votre transport médical est confirmé. Ouvrez l'application pour les détails.", "تم تأكيد نقلك الطبي. افتح التطبيق للتفاصيل."],
  "We couldn't confirm your transport request. Open the app for details.": ["Nous n'avons pas pu confirmer votre demande de transport. Ouvrez l'application pour les détails.", "لم نتمكن من تأكيد طلب النقل. افتح التطبيق للتفاصيل."],
  "Request confirmed": ["Demande confirmée", "تم تأكيد الطلب"],
  "Request update": ["Mise à jour de la demande", "تحديث الطلب"],
  "Request cancelled": ["Demande annulée", "تم إلغاء الطلب"],
  "The provider has confirmed your request. Open the app for the details.": ["Le prestataire a confirmé votre demande. Ouvrez l'application pour les détails.", "أكد مقدّم الخدمة طلبك. افتح التطبيق للتفاصيل."],
  "The provider couldn't take your request. Open the app for details.": ["Le prestataire n'a pas pu prendre en charge votre demande. Ouvrez l'application pour les détails.", "لم يتمكن مقدّم الخدمة من قبول طلبك. افتح التطبيق للتفاصيل."],
  "Your request has been sent. You'll be notified when the provider responds.": ["Votre demande a été envoyée. Vous serez averti lorsque le prestataire répondra.", "تم إرسال طلبك. سيتم إشعارك عندما يرد مقدّم الخدمة."],
  "We're on it": ["Nous nous en occupons", "نحن نتولى الأمر"],
  "Your request has reached our care team. Someone will contact you shortly.": ["Votre demande a été transmise à notre équipe de soins. Quelqu'un vous contactera sous peu.", "وصل طلبك إلى فريق الرعاية لدينا. سيتواصل معك أحدهم قريباً."],
  "Booking request sent": ["Demande de réservation envoyée", "تم إرسال طلب الحجز"],
  "Booking confirmed": ["Réservation confirmée", "تم تأكيد الحجز"],
  "Booking update": ["Mise à jour de la réservation", "تحديث الحجز"],
  "Booking completed": ["Réservation terminée", "اكتمل الحجز"],
  "Booking cancelled": ["Réservation annulée", "تم إلغاء الحجز"],
  "Appointment tomorrow": ["Rendez-vous demain", "موعدك غداً"],
  "Transport tomorrow": ["Transport demain", "النقل غداً"],
  "Booking tomorrow": ["Réservation demain", "حجزك غداً"],
  "How was your appointment?": ["Comment s'est passé votre rendez-vous ?", "كيف كان موعدك؟"],
  "Your appointment is complete. Tap to rate your visit.": ["Votre rendez-vous est terminé. Touchez pour noter votre visite.", "اكتمل موعدك. المس لتقييم زيارتك."],
  "How was your transport?": ["Comment s'est passé votre transport ?", "كيف كان نقلك؟"],
  "Your transport is complete. Tap to rate it.": ["Votre transport est terminé. Touchez pour le noter.", "اكتمل نقلك. المس لتقييمه."],
  "How was your visit?": ["Comment s'est passée votre visite ?", "كيف كانت زيارتك؟"],
  "Your booking is complete. Tap to rate your visit.": ["Votre réservation est terminée. Touchez pour noter votre visite.", "اكتمل حجزك. المس لتقييم زيارتك."],
};

const PATTERNS: { en: RegExp; fr: string; ar: string; keys: string[] }[] = [
  { en: /^(Your appointment|Your transport pickup|Your booking) is tomorrow\. Tap for the details\.$/, keys: ["what"],
    fr: "{what} a lieu demain. Touchez pour les détails.", ar: "{what} غداً. المس لعرض التفاصيل." },
  { en: /^(Your appointment|Your transport pickup|Your booking) is tomorrow at (.+)\. Tap for the details\.$/, keys: ["what", "time"],
    fr: "{what} a lieu demain à {time}. Touchez pour les détails.", ar: "{what} غداً الساعة {time}. المس لعرض التفاصيل." },
  { en: /^(.+) confirmed your booking for (.+)\.$/, keys: ["name", "date"],
    fr: "{name} a confirmé votre réservation du {date}.", ar: "أكد {name} حجزك بتاريخ {date}." },
  { en: /^(.+) couldn't take your booking\. Open the app for details\.$/, keys: ["name"],
    fr: "{name} n'a pas pu prendre votre réservation. Ouvrez l'application pour les détails.", ar: "لم يتمكن {name} من قبول حجزك. افتح التطبيق للتفاصيل." },
  { en: /^Your booking with (.+) is complete\.$/, keys: ["name"],
    fr: "Votre réservation chez {name} est terminée.", ar: "اكتمل حجزك لدى {name}." },
  { en: /^(.+) cancelled your booking\. Open the app for details\.$/, keys: ["name"],
    fr: "{name} a annulé votre réservation. Ouvrez l'application pour les détails.", ar: "ألغى {name} حجزك. افتح التطبيق للتفاصيل." },
  { en: /^(.+) will confirm your booking shortly\.$/, keys: ["name"],
    fr: "{name} confirmera votre réservation sous peu.", ar: "سيؤكد {name} حجزك قريباً." },
];

const WHAT: Record<string, [string, string]> = {
  "Your appointment": ["Votre rendez-vous", "موعدك"],
  "Your transport pickup": ["Votre prise en charge", "استقبالك في النقل"],
  "Your booking": ["Votre réservation", "حجزك"],
};

export function localizeText(lang: Lang, text: string): string {
  if (lang === "en") return text;
  const i = lang === "fr" ? 0 : 1;
  const fixed = FIXED[text];
  if (fixed) return fixed[i]!;
  for (const p of PATTERNS) {
    const m = p.en.exec(text);
    if (!m) continue;
    const vars: Record<string, string> = {};
    p.keys.forEach((k, n) => { const v = m[n + 1]!; vars[k] = k === "what" ? (WHAT[v]?.[i] ?? v) : v; });
    return (lang === "fr" ? p.fr : p.ar).replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "");
  }
  return text;
}

export function normalizeLang(v: string | null | undefined): Lang {
  return v === "fr" || v === "ar" ? v : "en";
}
