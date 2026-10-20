import type { BusinessProfile } from "../profile";

/**
 * Example client settings: a fictional hair salon. Copy this file to set up a new client
 * (see docs/business/NEW_CLIENT.md). Every field is explained in `../profile.ts`.
 */
export const brightCutsSalon: BusinessProfile = {
  id: "bright-cuts-salon",
  name: "Bright Cuts Salon",
  kind: "a hair salon",
  demo: true,
  address: "48 Market Street, above the bakery",
  directions: "Paid parking on Market Square, two minutes' walk. Lift available.",
  hours: [
    null,
    ["09:00", "18:00"],
    ["09:00", "18:00"],
    ["09:00", "20:00"],
    ["09:00", "18:00"],
    ["08:30", "16:00"],
    null,
  ],
  services: [
    {
      id: "womens_cut",
      name: "Women's cut and blow-dry",
      minutes: 60,
      price: "€55",
      keywords: [
        "women's cut",
        "womens cut",
        "ladies cut",
        "blow-dry",
        "blow dry",
        "blowdry",
        "haircut",
      ],
    },
    {
      id: "mens_cut",
      name: "Men's cut",
      minutes: 30,
      price: "€30",
      keywords: ["men's cut", "mens cut", "gents", "beard", "trim", "fade", "buzz cut"],
    },
    {
      id: "colour",
      name: "Colour and cut",
      minutes: 120,
      price: "from €110",
      keywords: ["colour", "color", "dye", "highlights", "balayage", "roots", "foils"],
    },
    {
      id: "kids_cut",
      name: "Children's cut",
      minutes: 30,
      price: "€20",
      keywords: ["kids", "child", "children", "son", "daughter", "children's cut"],
    },
  ],
  serviceWord: "service",
  booking: { windowDays: 42, minimumNoticeMinutes: 120, slotMinutes: 30, referencePrefix: "BC" },
  facts: [
    "Card and cash accepted; no deposits needed.",
    "Please give 24 hours' notice to cancel or move an appointment.",
    "A patch test is needed 48 hours before a first colour; it takes 5 minutes and is free.",
  ],
  handoff: "I'll pass a message to the salon team and they'll call you back the same day.",
  careRules: [
    "First-time colour clients need a patch test 48 hours before: mention it kindly and offer to book it too.",
  ],
  noAdviceOn:
    "medical advice about skin, scalp or allergic reactions (suggest a pharmacist or doctor)",
  examples: [
    {
      visitor: "can I get highlights saturday morning",
      receptionist:
        "(check_availability returns 8:30 am and 10 am) Lovely. For a colour and cut on Saturday morning I have 8:30 or 10 am. Have you had colour with us before? If not, we'll need a quick patch test first.",
    },
  ],
};
