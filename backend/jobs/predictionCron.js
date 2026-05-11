import cron from "node-cron";
import { refreshMonthlyDistrictPredictions } from "../services/predictions/refreshMonthlyDistrictPredictions.js";

export function registerPredictionCron() {
  // Monthly fallback: 1st day of each month at 01:00 server time
  cron.schedule("0 1 1 * *", async () => {
    try {
      await refreshMonthlyDistrictPredictions({
        trigger: "monthly_fallback",
        horizonMonths: 1,
        force: false,
      });
    } catch (e) {
      console.error("Monthly forecast refresh failed:", e?.message || e);
    }
  });
}

