export const SURVEILLANCE_DISEASES = Object.freeze([
  "Typhoid and Paratyphoid",
  "Rotavirus",
  "Cholera",
  "Acute Bloody Diarrhea",
]);

export const DISEASE_CASE_RULES = Object.freeze({
  "Typhoid and Paratyphoid": Object.freeze({
    statuses: Object.freeze(["suspected", "probable", "confirmed"]),
    probableEvidence: Object.freeze([
      {
        value: "typhoid_rdt_positive",
        label: "Positive typhoid rapid diagnostic test",
      },
      {
        value: "epidemiological_link_to_confirmed_outbreak_case",
        label: "Epidemiological link to a confirmed outbreak case",
      },
    ]),
  }),
  Rotavirus: Object.freeze({
    statuses: Object.freeze(["suspected", "confirmed"]),
    probableEvidence: Object.freeze([]),
  }),
  Cholera: Object.freeze({
    statuses: Object.freeze(["suspected", "probable", "confirmed"]),
    probableEvidence: Object.freeze([
      {
        value: "cholera_rdt_positive",
        label: "Positive cholera rapid diagnostic test",
      },
    ]),
  }),
  "Acute Bloody Diarrhea": Object.freeze({
    statuses: Object.freeze(["suspected", "confirmed"]),
    probableEvidence: Object.freeze([]),
  }),
});

