import cron from "node-cron";
import { refreshProphetPredictions } from "../services/predictions/refreshProphetPredictions.js";

export function registerPredictionCron() {
  // Monthly fallback: 1st day of each month at 01:00 server time
  cron.schedule("0 1 1 * *", async () => {
    try {
      await refreshProphetPredictions({
        trigger: "monthly_fallback",
        force: false,
      });
    } catch (e) {
      console.error("Monthly forecast refresh failed:", e?.message || e);
    }
  });
}

