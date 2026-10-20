import type { BusinessProfile } from "../profile";

/** The website demo: a fictional dental clinic. Nothing here is a real business. */
export const harborLaneDental: BusinessProfile = {
  id: "harbor-lane-dental",
  name: "Harbor Lane Dental",
  kind: "a dental clinic",
  demo: true,
  address: "12 Harbor Lane, next to the old ferry terminal",
  directions: "Free parking behind the building; the number 4 bus stops outside.",
  hours: [
    ["09:00", "17:00"],
    ["09:00", "17:00"],
    ["09:00", "19:00"],
    ["09:00", "17:00"],
    ["09:00", "16:00"],
    ["09:00", "13:00"],
    null,
  ],
  services: [
    {
      id: "checkup",
      name: "Check-up",
      minutes: 30,
      price: "€45",
      keywords: ["check-up", "checkup", "check up", "exam", "examination", "routine"],
    },
    {
      id: "cleaning",
      name: "Hygiene cleaning",
      minutes: 60,
      price: "€70",
      keywords: ["clean", "cleaning", "cleaned", "hygiene", "hygienist", "scale", "polish"],
    },
    {
      id: "whitening",
      name: "Teeth whitening",
      minutes: 60,
      price: "€250",
      keywords: ["whiten", "whitening", "bleach"],
    },
    {
      id: "urgent",
      name: "Urgent visit",
      minutes: 30,
      price: "€60",
      urgent: true,
      keywords: [
        "urgent",
        "emergency",
        "pain",
        "painful",
        "toothache",
        "hurts",
        "hurting",
        "broken",
        "chipped",
        "swollen",
      ],
    },
  ],
  serviceWord: "treatment",
  booking: { windowDays: 60, minimumNoticeMinutes: 60, slotMinutes: 30, referencePrefix: "HL" },
  facts: [],
  handoff:
    "In the real system I'd pass a message to the team and they'd call you back. In this demo I can only help with bookings and questions.",
  careRules: [
    "Toothache, swelling or a broken tooth: be kind and calm and offer the earliest urgent visit. Facial swelling that affects breathing or swallowing, heavy bleeding that won't stop, or a head injury: tell them to call their local emergency number now, before anything else, and don't push a booking.",
  ],
  noAdviceOn: "diagnosis, medication or treatment advice (you are not a dentist)",
  examples: [
    {
      visitor: "can I get a cleaning thursday afternoon? oh and is there parking",
      receptionist:
        "(check_availability returns 2 pm, 3:30 pm and 4 pm) There's free parking right behind the building. For Thursday afternoon I have 2 pm or half past three. Would either of those suit you?",
    },
    {
      visitor: "(A proposal for Thursday at 2 pm is waiting.) ok what about 4 instead",
      receptionist:
        "(checks Thursday, 4 pm is free, proposes it) Sure, 4 pm on Thursday is free. So that's a hygiene cleaning on Thursday the 23rd at 4 pm for Sam. Is that right?",
    },
    {
      visitor: "my tooth is killing me since saturday",
      receptionist:
        "(finds the earliest urgent slot) Oh, I'm sorry, that sounds really painful. The earliest urgent visit I have is today at 2:30 pm. Shall I hold that for you?",
    },
  ],
};
