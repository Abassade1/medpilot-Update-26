/**
 * Bundled image assets.
 *
 * The API returns asset *keys* rather than URLs, and `assetSource()` maps each
 * key onto one of these requires — so imagery stays byte-identical to the
 * approved design without a CDN. This file holds no application data: every
 * catalog, booking and report now comes from the API.
 */
export const images = {
  // Brand assets exported from the Figma file
  logoMark: require("../../assets/images/logo-mark.png"),
  avatar: require("../../assets/images/avatar.jpg"),
  cancer: require("../../assets/images/cancer.png"),
  cardiacTreatment: require("../../assets/images/cardiac-treatment.png"),
  privateNurse: require("../../assets/images/private-nurse.png"),
  petCare: require("../../assets/images/pet-care.png"),
  nurseDoctor: require("../../assets/images/nurse-doctor.png"),
  svcMedevac: require("../../assets/images/svc-medevac.png"),
  svcDna: require("../../assets/images/svc-dna.png"),
  svcPet: require("../../assets/images/svc-pet.png"),
  svcBrain: require("../../assets/images/svc-brain.png"),
  svcHand: require("../../assets/images/svc-hand.png"),
  logoKingFahad: require("../../assets/images/logo-king-fahad.png"),
  logoErn: require("../../assets/images/logo-ern.png"),
  logoSnuh: require("../../assets/images/logo-snuh.png"),
  logoBurjeel: require("../../assets/images/logo-burjeel.png"),
  logoNyp: require("../../assets/images/logo-nyp.png"),
  emirates: require("../../assets/images/emirates.png"),
  medevac: require("../../assets/images/medevac.png"),
  pacific: require("../../assets/images/pacific.png"),
  airportAerial: require("../../assets/images/airport-aerial.png"),
  logoEms: require("../../assets/images/logo-ems.png"),
  logoPacific: require("../../assets/images/logo-pacific.png"),
  logoUber: require("../../assets/images/logo-uber.png"),
  facilityIcu: require("../../assets/images/facility-icu.png"),
  facilityStretcher: require("../../assets/images/facility-stretcher.png"),
  facilityGas: require("../../assets/images/facility-gas.png"),
  illusMailbox: require("../../assets/images/illus-mailbox.png"),
  illusRecords: require("../../assets/images/illus-records.png"),
  illusPassword: require("../../assets/images/illus-password.png"),
  faceId: require("../../assets/images/face-id.png"),
  opticId: require("../../assets/images/optic-id.png"),
  tabHome: require("../../assets/images/tab-home.png"),
  tabActivities: require("../../assets/images/tab-activities.png"),
  tabAux: require("../../assets/images/tab-aux.png"),
  tabAppointments: require("../../assets/images/tab-appointments.png"),
  // Generic placeholder photos (no direct Figma export available)
  surgery: require("../../assets/images/surgery.jpg"),
  icu: require("../../assets/images/icu.jpg"),
  jet: require("../../assets/images/jet.jpg"),
  food: require("../../assets/images/food.jpg"),
  doctor1: require("../../assets/images/doctor1.jpg"),
  doctor2: require("../../assets/images/doctor2.jpg"),
  petVet: require("../../assets/images/pet-vet.jpg"),
  horses: require("../../assets/images/horses.jpg"),
  dogGroom: require("../../assets/images/dog-groom.jpg"),
  woman1: require("../../assets/images/woman1.jpg"),
  woman2: require("../../assets/images/woman2.jpg"),
} as const;
