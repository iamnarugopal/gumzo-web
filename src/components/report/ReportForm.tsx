
import { useState, type FormEvent } from "react";
import { LuMail, LuSend, LuUserRound } from "react-icons/lu";

const reportOptions = [
  { id: "inappropriate-content", label: "Inappropriate Content" },
  { id: "sexual-content", label: "Sexual Content" },
  { id: "rude-disrespectful", label: "Rude or Disrespectful" },
  { id: "harassment-bullying", label: "Harassment or Bullying" },
  { id: "hate-threats", label: "Hate or Threats" },
  { id: "spam-scam", label: "Spam or Scam" },
];

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export default function ReportForm() {
  const [reportedUsername, setReportedUsername] = useState("");
  const [reporterUsername, setReporterUsername] = useState("");
  const [email, setEmail] = useState("");
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submitting) return;

    setMessage("");

    const reported = reportedUsername.trim();
    const reporter = reporterUsername.trim();
    const contactEmail = email.trim();

    // Validate reported username
    if (reported.length < 3 || reported.length > 30) {
      setMessage("Please enter a valid reported username.");
      return;
    }

    // Validate reporter username
    if (reporter.length < 3 || reporter.length > 30) {
      setMessage("Please enter a valid Gumzo username.");
      return;
    }

    // Prevent self-reporting
    if (reported.toLowerCase() === reporter.toLowerCase()) {
      setMessage("You cannot report your own account.");
      return;
    }

    // Validate email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      setMessage("Please enter a valid contact email address.");
      return;
    }

    // Validate reason
    if (!selectedReason) {
      setMessage("Please select one reason for reporting.");
      return;
    }

    // Check configuration
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      setMessage("Report submission is currently unavailable.");
      console.error("Missing Supabase environment variables.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/submit-report`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
          body: JSON.stringify({
            reportedUsername: reported,
            reporterUsername: reporter,
            email: contactEmail,
            reason: selectedReason,
          }),
        },
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setMessage(
          data?.error || "Unable to submit your report. Please try again.",
        );
        return;
      }

      if (!data?.success) {
        setMessage(data?.error || "Unable to submit your report.");
        return;
      }

      setMessage(data.message || "Your report has been submitted successfully.");

      // Reset form after successful submission
      setReportedUsername("");
      setReporterUsername("");
      setEmail("");
      setSelectedReason(null);
    } catch (error) {
      console.error("Report submission failed:", error);
      setMessage("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "block w-full min-w-0 rounded-xl border border-white/10 bg-dark-3 py-3.5 pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-primary focus:ring-2 focus:ring-primary/20";

  const iconClass =
    "pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-500";

  return (
    <div className="rounded-2xl border border-white/10 bg-dark-2 p-5 shadow-xl shadow-black/20 sm:p-8">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Reported User */}
        <div>
          <label
            htmlFor="reported-username"
            className="mb-2 block text-sm font-semibold text-gray-200"
          >
            Who are you reporting? (Username)
            <span className="ml-1 text-danger">*</span>
          </label>

          <div className="relative">
            <LuUserRound size={19} className={iconClass} />

            <input
              id="reported-username"
              name="reported_username"
              type="text"
              required
              minLength={3}
              maxLength={30}
              autoComplete="off"
              value={reportedUsername}
              onChange={(e) => {
                setReportedUsername(e.target.value);
                setMessage("");
              }}
              placeholder="Enter the user's Gumzo username"
              className={inputClass}
            />
          </div>
        </div>

        {/* Report Reasons */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-200">
            Reason for reporting <span className="text-danger">*</span>
          </label>

          <div
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            role="radiogroup"
            aria-label="Reason for reporting"
          >
            {reportOptions.map((option) => {
              const selected = selectedReason === option.id;

              return (
                <label
                  key={option.id}
                  style={{
                    borderColor: selected
                      ? "#A82DDB"
                      : "rgba(255,255,255,0.1)",
                    backgroundColor: selected
                      ? "rgba(168,45,219,0.12)"
                      : "#0A0714",
                  }}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-4 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-200">
                    {option.label}
                  </span>

                  <input
                    type="radio"
                    name="reportReason"
                    value={option.id}
                    checked={selected}
                    onChange={() => {
                      setSelectedReason(option.id);
                      setMessage("");
                    }}
                    className="sr-only"
                  />

                  <span
                    aria-hidden="true"
                    style={{
                      borderColor: selected ? "#A82DDB" : "#6B7280",
                    }}
                    className="flex size-5 shrink-0 items-center justify-center rounded-full border-2"
                  >
                    {selected && (
                      <span
                        style={{ backgroundColor: "#A82DDB" }}
                        className="size-2.5 rounded-full"
                      />
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Reporter Username */}
        <div>
          <label
            htmlFor="reporter-username"
            className="mb-2 block text-sm font-semibold text-gray-200"
          >
            Your Gumzo Username
            <span className="ml-1 text-danger">*</span>
          </label>

          <div className="relative">
            <LuUserRound size={19} className={iconClass} />

            <input
              id="reporter-username"
              name="reporter_username"
              type="text"
              required
              minLength={3}
              maxLength={30}
              autoComplete="username"
              value={reporterUsername}
              onChange={(e) => {
                setReporterUsername(e.target.value);
                setMessage("");
              }}
              placeholder="Enter your Gumzo username"
              className={inputClass}
            />
          </div>
        </div>

        {/* Contact Email */}
        <div>
          <label
            htmlFor="report-email"
            className="mb-2 block text-sm font-semibold text-gray-200"
          >
            Your Email Address
            <span className="ml-1 text-danger">*</span>
          </label>

          <div className="relative">
            <LuMail size={19} className={iconClass} />

            <input
              id="report-email"
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setMessage("");
              }}
              placeholder="your.email@example.com"
              className={inputClass}
            />
          </div>

          <p className="mt-2 text-xs text-gray-500">
            We'll use this email if we need more information about your
            report.
          </p>
        </div>

        {/* Validation Message */}
        {message && (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-xl border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning"
          >
            {message}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-linear-to-r from-primary to-secondary px-6 py-4 text-sm font-bold text-white shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:shadow-primary/30 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        >
          <LuSend size={18} />
          {submitting ? "Submitting Report..." : "Submit Report"}
        </button>

        <p className="text-center text-xs leading-6 text-gray-500">
          Every report matters. Please provide accurate information and use
          the reporting system responsibly.
        </p>
      </form>
    </div>
  );
}
