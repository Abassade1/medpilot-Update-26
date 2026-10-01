import { localizeText } from "../src/modules/notifications/localize";

describe("localizeText", () => {
  it("returns English unchanged", () => {
    expect(localizeText("en", "Request received")).toBe("Request received");
  });
  it("translates fixed sentences", () => {
    expect(localizeText("fr", "Appointment confirmed")).toBe("Rendez-vous confirmé");
    expect(localizeText("ar", "Appointment confirmed")).toBe("تم تأكيد الموعد");
  });
  it("fills names and times into templates", () => {
    expect(localizeText("fr", "Your appointment is tomorrow at 09:30. Tap for the details."))
      .toBe("Votre rendez-vous a lieu demain à 09:30. Touchez pour les détails.");
    expect(localizeText("fr", "Acme Clinic confirmed your booking for 2026-10-05."))
      .toBe("Acme Clinic a confirmé votre réservation du 2026-10-05.");
  });
  it("leaves unknown text in English rather than guessing", () => {
    expect(localizeText("ar", "Something we never translated")).toBe("Something we never translated");
  });
});
