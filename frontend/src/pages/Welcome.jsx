import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bell,
  MonitorSmartphone,
  Shield,
  Smartphone,
  Users,
} from "lucide-react";

const adminFeatures = [
  { icon: BarChart3, text: "Advanced analytics and data visualization" },
  { icon: Activity, text: "Real-time outbreak monitoring" },
  { icon: Shield, text: "Risk prediction and forecasting" },
  { icon: Users, text: "User management and access control" },
];

const citizenFeatures = [
  { icon: Bell, text: "Early warning notifications" },
  { icon: Activity, text: "Location-based outbreak alerts" },
  { icon: Shield, text: "Health tips and prevention guides" },
  { icon: Activity, text: "Nearby outbreak tracking" },
];

function BrandMark() {
  return (
    <div className="bg-blue-600 p-2 rounded-lg">
      <Activity className="w-6 h-6 text-white" />
    </div>
  );
}

function FeatureList({ items, accent }) {
  return (
    <ul className="space-y-3 text-left">
      {items.map(({ icon: Icon, text }, idx) => (
        <li key={idx} className="flex items-start gap-3">
          <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${accent}`} />
          <span className="text-sm text-gray-700">{text}</span>
        </li>
      ))}
    </ul>
  );
}

function LandingCard({
  icon,
  title,
  subtitle,
  features,
  buttonTo,
  buttonText,
  buttonClass,
  hoverBorderClass,
  footnote,
  accent,
}) {
  return (
    <div
      className={[
        "bg-white rounded-2xl shadow-xl p-8 border-2 border-transparent transition-all",
        hoverBorderClass,
      ].join(" ")}
    >
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
        {icon}
      </div>

      <h2 className="text-2xl font-semibold mb-2">{title}</h2>
      <p className="text-gray-600 mb-6">{subtitle}</p>

      <div className="mb-8">
        <FeatureList items={features} accent={accent} />
      </div>

      <Link
        to={buttonTo}
        className={[
          "w-full text-white py-3 rounded-xl transition-colors inline-flex items-center justify-center gap-2",
          buttonClass,
        ].join(" ")}
      >
        {buttonText}
        <ArrowRight className="w-4 h-4" />
      </Link>

      <p className="text-xs text-gray-500 mt-4">{footnote}</p>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandMark />
            <div>
              <h1 className="text-lg font-semibold leading-tight">
                DOH Disease Monitoring
              </h1>
              <p className="text-xs text-gray-600">
                Department of Health - Philippines
              </p>
            </div>
          </div>

          <Link
            to="/login"
            className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm font-medium"
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm mb-6">
          <Shield className="w-4 h-4" />
          <span>Protecting Public Health Together</span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
          Foodborne Illness <br className="hidden sm:block" />
          Monitoring &amp; Alerts
        </h1>

        <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto mb-12">
          Advanced disease surveillance system for health officials and early
          warning alerts for citizens
        </p>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <LandingCard
            icon={
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl flex items-center justify-center">
                <MonitorSmartphone className="w-8 h-8 text-white" />
              </div>
            }
            title="Admin Dashboard"
            subtitle="For DOH officials, health analysts, and researchers"
            features={adminFeatures}
            buttonTo="/login"
            buttonText="Access Admin Portal"
            buttonClass="bg-blue-600 hover:bg-blue-700"
            hoverBorderClass="hover:border-blue-500"
            footnote="Requires admin approval"
            accent="text-blue-600"
          />

          <LandingCard
            icon={
              <div className="w-16 h-16 bg-gradient-to-br from-green-600 to-green-700 rounded-2xl flex items-center justify-center">
                <Smartphone className="w-8 h-8 text-white" />
              </div>
            }
            title="Citizen Alert App"
            subtitle="For general public to receive health alerts"
            features={citizenFeatures}
            buttonTo="/mobile"
            buttonText="Open Mobile App"
            buttonClass="bg-green-600 hover:bg-green-700"
            hoverBorderClass="hover:border-green-500"
            footnote="Free for all citizens"
            accent="text-green-600"
          />
        </div>
      </section>

      {/* Value Props */}
      <section className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-center text-3xl font-semibold mb-4">
            Comprehensive Disease Surveillance
          </h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            Our system combines advanced analytics for health officials with
            real-time alerts for citizens
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="w-7 h-7 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Data Analytics</h3>
              <p className="text-sm text-gray-600">
                Advanced visualization and trend analysis for informed
                decision-making
              </p>
            </div>

            <div className="text-center">
              <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Bell className="w-7 h-7 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Real-Time Alerts</h3>
              <p className="text-sm text-gray-600">
                Instant notifications to citizens about disease outbreaks in
                their area
              </p>
            </div>

            <div className="text-center">
              <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Shield className="w-7 h-7 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Risk Prediction</h3>
              <p className="text-sm text-gray-600">
                AI-powered forecasting to predict and prevent disease outbreaks
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="font-medium">DOH Disease Monitoring System</span>
          </div>

          <p className="text-sm text-gray-400 mb-2">
            Department of Health - Republic of the Philippines
          </p>
          <p className="text-xs text-gray-500">
            © 2026 All rights reserved. Data Privacy Act of 2012 Compliant.
          </p>
        </div>
      </footer>
    </div>
  );
}
