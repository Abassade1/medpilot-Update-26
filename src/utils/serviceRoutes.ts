import type { ServiceDto } from "../api/types";

/** Where a service card leads. Every service has a destination; unknown or unreleased ones say so. */
export function openService(navigation: { navigate: (...a: any[]) => void }, service: ServiceDto) {
  switch (service.code) {
    case "transport":
      return navigation.navigate("MedicalTransport");
    case "specialist":
      return navigation.navigate("SpecialistTreatments");
    case "pet":
      return navigation.navigate("PetSpecialist");
    default:
      // Organs Upgrade, Chronic Prescriptions and anything else not yet bookable.
      return navigation.navigate("ComingSoon", { title: service.title, description: service.description });
  }
}
