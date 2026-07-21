import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "../../../mobile/assets/foodsafe_logo.png";

export default function AuthPageLayout({
  children,
  title,
  description,
  backTo = "/",
  backLabel = "Back to home",
  onBack,
  contentWidth = "compact",
  centerContent = false,
}) {
  const contentWidthClass = {
    compact: "max-w-md",
    comfortable: "max-w-lg",
    wide: "max-w-3xl",
  }[contentWidth];

  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.1fr)] xl:grid-cols-2">
      <aside className="relative hidden h-screen overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 p-12 text-white lg:sticky lg:top-0 lg:flex lg:flex-col">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10" />
        <div className="absolute -bottom-36 -left-24 h-96 w-96 rounded-full bg-indigo-400/20" />

        <img
          src={logo}
          className="relative h-12 w-auto self-start object-contain"
          alt="FoodSafe Manila"
          draggable="false"
        />

        <div className="relative my-auto max-w-lg">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-blue-200">
            Manila Health Department
          </p>
          <h1 className="text-4xl font-bold leading-tight xl:text-5xl">
            Safer food starts with better information.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-8 text-blue-100">
            Monitor foodborne disease data, identify emerging trends, and help
            protect communities across Manila.
          </p>
        </div>

        <p className="relative text-sm text-blue-200">
          Food safety monitoring and analytics
        </p>
      </aside>

      <div className="min-w-0 bg-white">
        <header className="flex h-20 items-center bg-blue-700 px-6 sm:px-10 lg:hidden">
          <img
            src={logo}
            className="h-9 w-auto object-contain"
            alt="FoodSafe Manila"
            draggable="false"
          />
        </header>

        <main
          className={`relative flex min-h-[calc(100vh-5rem)] justify-center px-6 pb-12 pt-24 sm:px-10 lg:min-h-screen lg:px-16 lg:py-24 ${
            centerContent ? "items-center" : "items-start"
          }`}
        >
          <Link
            to={backTo}
            onClick={onBack}
            className="absolute left-6 top-7 inline-flex items-center gap-2 text-sm font-medium text-gray-600 transition-colors hover:text-blue-700 sm:left-10 lg:left-16"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>

          <div className={`w-full ${contentWidthClass || "max-w-md"}`}>
            <div className="mb-8">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900">
                {title}
              </h2>
              {description && (
                <p className="mt-3 leading-7 text-gray-600">{description}</p>
              )}
            </div>

            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
