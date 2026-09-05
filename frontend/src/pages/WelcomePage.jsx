import { createElement, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  Check,
  ClipboardList,
  Database,
  FileText,
  MapPin,
  ShieldCheck,
  Smartphone,
  TrendingUp,
} from "lucide-react";

import logo from "../../../mobile/assets/foodsafe_logo.png";

const activityCards = [
  {
    area: "District 4",
    tone: "blue",
    time: "Citizen reporting",
    id: "REPORT",
    description:
      "Symptoms, case count, location, and a suspected food source are submitted through the mobile app.",
    status: "Status: Reported",
    context: "Awaiting health-team review",
  },
  {
    area: "CESU",
    tone: "blue",
    time: "Official surveillance",
    id: "DATASET",
    description:
      "A validated official case workbook is incorporated into the cumulative surveillance history.",
    status: "Status: Validated",
    context: "Analytics updated",
  },
  {
    area: "District 1",
    tone: "amber",
    time: "Operational signal",
    id: "REVIEW",
    description:
      "Counted citizen reports reached the configured rolling 24-hour review trigger for the district.",
    status: "Status: Review flagged",
    context: "Not an outbreak declaration",
  },
];

const benefits = [
  {
    icon: FileText,
    title: "Submit a disease report",
    description:
      "Citizens can record symptoms, case count, and suspected exposure details from the mobile app.",
  },
  {
    icon: MapPin,
    title: "Understand nearby risk",
    description:
      "Mobile maps combine official surveillance data with eligible citizen-report activity by Manila barangay.",
  },
  {
    icon: ClipboardList,
    title: "Support case review",
    description:
      "Authorized health teams investigate reports and record suspected, probable, confirmed, or ruled-out outcomes.",
  },
  {
    icon: TrendingUp,
    title: "Plan with forecasts",
    description:
      "District-level monthly Prophet forecasts use validated CESU records as decision support—not observed cases.",
  },
];

const reportFlow = [
  {
    time: "01",
    tag: "VERIFY",
    description:
      "A citizen account is verified through a time-limited SMS code before registration is completed.",
  },
  {
    time: "02",
    tag: "REPORT",
    description:
      "The mobile app records symptoms, report location, optional exposure location, and suspected food source.",
  },
  {
    time: "03",
    tag: "REVIEW",
    description:
      "The report enters the health-team workflow for investigation and evidence-based classification.",
  },
  {
    time: "04",
    tag: "SIGNAL",
    alert: true,
    description:
      "Eligible reports contribute to a rolling 24-hour district review trigger while remaining separate from official case counts.",
  },
];

function ActivityStack() {
  const [activeCard, setActiveCard] = useState(0);

  useEffect(() => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reducedMotion) return undefined;

    const interval = window.setInterval(() => {
      setActiveCard((current) => (current + 1) % activityCards.length);
    }, 3600);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div
      className="relative h-[290px] sm:h-[275px]"
      aria-label="Illustrative FoodSafe activity"
    >
      {activityCards.map((card, index) => {
        const position =
          (index - activeCard + activityCards.length) % activityCards.length;
        const positionClass = [
          "z-30 translate-x-0 translate-y-0 scale-100 opacity-100",
          "z-20 translate-x-3 translate-y-6 scale-[0.96] opacity-70 sm:translate-x-4",
          "z-10 translate-x-6 translate-y-12 scale-[0.92] opacity-40 sm:translate-x-8",
        ][position];

        return (
          <article
            key={card.id}
            className={`absolute left-0 top-0 h-[205px] w-[88%] overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-[0_14px_36px_rgba(19,76,140,0.14)] transition-all duration-500 motion-reduce:transition-none ${positionClass}`}
          >
            <div className="flex items-center justify-between gap-3">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  card.tone === "amber"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-blue-100 text-blue-800"
                }`}
              >
                {card.area}
              </span>
              <span className="text-xs text-slate-500">{card.time}</span>
            </div>
            <p className="mt-3 font-mono text-xs font-semibold tracking-wide text-slate-500">
              {card.id}
            </p>
            <p className="mt-1 line-clamp-3 text-sm leading-6 text-slate-900">
              {card.description}
            </p>
            <div className="absolute inset-x-5 bottom-4 flex items-center justify-between gap-3 border-t border-dashed border-slate-200 pt-3 text-[11px] text-slate-500">
              <span>{card.status}</span>
              <span className="text-right">{card.context}</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh] bg-[#eef3f9] text-[#0e1b2a]">
      <header className="sticky top-0 z-50 border-b border-blue-950/30 bg-[#0c3a6b]/95 text-white shadow-sm backdrop-blur">
        <nav className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-7">
          <a href="#top" aria-label="FoodSafe Manila home">
            <img
              src={logo}
              alt="FoodSafe Manila"
              className="h-9 w-auto select-none object-contain sm:h-10"
              draggable="false"
              decoding="async"
            />
          </a>
          <Link
            to="/login"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/70 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white hover:text-[#0c3a6b]"
          >
            Sign in for health officials
          </Link>
        </nav>
      </header>

      <main id="top">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:px-7 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:py-24">
          <div>
            <p className="text-sm font-semibold text-[#134c8c]">
              A public-health surveillance tool for Manila
            </p>
            <h1 className="mt-4 max-w-2xl font-serif text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.5rem]">
              Catching foodborne disease signals earlier.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
              FoodSafe brings citizen reports, validated CESU case records,
              district maps, operational review signals, and monthly forecasting
              into one coordinated system.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                aria-disabled="true"
                title="Android download coming soon"
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#134c8c] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0c3a6b]"
              >
                Download for Android
              </button>
              <Link
                to="/request-access"
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#134c8c] px-5 py-2.5 text-sm font-semibold text-[#134c8c] transition hover:bg-[#e1ebf7]"
              >
                Request dashboard access
              </Link>
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Illustrative system activity
            </p>
            <ActivityStack />
          </div>
        </section>

        <section
          id="how-it-works"
          className="border-y border-slate-200 bg-white py-20 sm:py-24"
        >
          <div className="mx-auto grid max-w-6xl gap-10 px-5 sm:px-7 lg:grid-cols-[0.88fr_1.12fr] lg:gap-14">
            <div>
              <p className="text-sm font-semibold text-[#134c8c]">
                One system, two connected experiences
              </p>
              <h2 className="mt-3 max-w-md font-serif text-3xl font-semibold leading-tight sm:text-4xl">
                Clear reporting for citizens. Better context for health teams.
              </h2>
              <p className="mt-5 max-w-md leading-7 text-slate-600">
                Citizens use the mobile app to report suspected foodborne
                disease and view nearby risk. Authorized personnel use the web
                dashboard to review reports alongside official surveillance
                evidence.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {benefits.map(({ icon, title, description }) => (
                <article
                  key={title}
                  className="rounded-xl border border-slate-200 bg-[#eef3f9] p-5"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e1ebf7] text-[#134c8c]">
                    {createElement(icon, {
                      className: "h-5 w-5",
                      "aria-hidden": true,
                    })}
                  </div>
                  <h3 className="mt-4 font-semibold text-slate-950">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-7">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-[#134c8c]">
                From report to operational context
              </p>
              <h2 className="mt-3 font-serif text-3xl font-semibold leading-tight sm:text-4xl">
                What happens after a citizen submits a report.
              </h2>
              <p className="mt-4 leading-7 text-slate-600">
                Reports are retained for review and audit. Citizen activity can
                prompt follow-up, but it does not become an official confirmed
                case or an outbreak declaration automatically.
              </p>
            </div>

            <div className="mt-10 overflow-hidden rounded-2xl bg-[#0b2038] p-5 shadow-[0_22px_55px_rgba(11,32,56,0.25)] sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5 font-mono text-xs">
                <div className="flex items-center gap-2 text-slate-200">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-300 opacity-50 motion-reduce:hidden" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-300" />
                  </span>
                  citizen_report_flow
                </div>
                <span className="text-slate-500">workflow: auditable</span>
              </div>

              <ol className="relative ml-1 mt-3 border-l border-white/15 pl-7">
                {reportFlow.map((step) => (
                  <li
                    key={step.tag}
                    className="relative grid gap-2 border-b border-white/[0.06] py-5 last:border-0 sm:grid-cols-[3rem_6rem_1fr] sm:gap-5"
                  >
                    <span
                      className={`absolute -left-[2.08rem] top-7 h-2.5 w-2.5 rounded-full border-2 bg-[#0b2038] ${
                        step.alert ? "border-amber-400" : "border-sky-300"
                      }`}
                    />
                    <span className="font-mono text-xs text-slate-500">
                      {step.time}
                    </span>
                    <span
                      className={`font-mono text-xs font-semibold tracking-wide ${
                        step.alert ? "text-amber-300" : "text-sky-300"
                      }`}
                    >
                      {step.tag}
                    </span>
                    <span className="text-sm leading-6 text-slate-300">
                      {step.description}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white py-16">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 sm:px-7 md:grid-cols-3">
            <div className="flex gap-4">
              <Smartphone className="mt-1 h-6 w-6 shrink-0 text-[#134c8c]" />
              <div>
                <h3 className="font-semibold">Citizen mobile app</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Registration, reports, alerts, nearby risk, and personal report history.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <Database className="mt-1 h-6 w-6 shrink-0 text-[#134c8c]" />
              <div>
                <h3 className="font-semibold">Authoritative data boundary</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Validated CESU uploads remain distinct from citizen-submitted reports.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <Bell className="mt-1 h-6 w-6 shrink-0 text-[#134c8c]" />
              <div>
                <h3 className="font-semibold">Operational notifications</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Report-review triggers and system events help authorized teams follow up.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="px-5 py-10 sm:px-7">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-6 border-b border-slate-300 pb-7 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex w-fit items-center gap-3 rounded-lg bg-[#0c3a6b] px-3 py-2">
              <img
                src={logo}
                alt="FoodSafe Manila"
                className="h-7 w-auto object-contain"
                draggable="false"
                loading="lazy"
              />
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm text-slate-600">
              <Link className="hover:text-[#134c8c]" to="/login">
                Health official sign in
              </Link>
              <Link className="hover:text-[#134c8c]" to="/request-access">
                Request access
              </Link>
            </div>
          </div>
          <div className="mt-6 flex items-start gap-3 text-sm leading-6 text-slate-600">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#134c8c]" />
            <p>
              <strong className="text-slate-900">
                FoodSafe Manila supports surveillance and early review of
                foodborne disease signals; it is not a substitute for medical
                care.
              </strong>{" "}
              Seek immediate professional help for a medical emergency.
            </p>
          </div>
          <p className="mt-5 flex items-center gap-2 text-xs text-slate-500">
            <Check className="h-4 w-4" aria-hidden="true" />© 2026 FoodSafe Manila
          </p>
        </div>
      </footer>
    </div>
  );
}
