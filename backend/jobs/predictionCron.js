import cron from "node-cron";
import { refreshMonthlyDistrictPredictions } from "../services/predictions/refreshMonthlyDistrictPredictions.js";
import { usesGitHubForecasts } from "../services/predictions/githubForecastJobs.js";

export function registerPredictionCron() {
  // Monthly fallback: first day of each month at 01:00 server time.
  cron.schedule("0 1 1 * *", async () => {
    try {
      // Uploads/manual refresh drive GitHub execution. Never start local Python
      // behind an API configured for remote execution.
      if (usesGitHubForecasts()) return;
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

