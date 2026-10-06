import { writeFileSync } from "node:fs";
import { publicMobilePolicies } from "./mobilePolicies.js";

// Bundle the same documents/version the backend validates; regenerate after policy edits.
writeFileSync(new URL("../../mobile/assets/mobile-policies.json", import.meta.url),
  `${JSON.stringify(publicMobilePolicies(), null, 2)}\n`, "utf8");
console.log("Exported mobile/assets/mobile-policies.json");
