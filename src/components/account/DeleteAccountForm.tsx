
import { useEffect, useState, type SyntheticEvent } from "react";
import {
  LuArrowLeft,
  LuArrowRight,
  LuCheck,
  LuInfo,
  LuLoaderCircle,
  LuMail,
  LuShieldCheck,
  LuUserRound,
} from "react-icons/lu";

declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void;
      execute: (
        siteKey: string,
        options: { action: string },
      ) => Promise<string>;
    };
  }
}

import { cooldownRemaining, markSubmitted } from "../../lib/spamGuard";

type Step = "email" | "verification" | "success";

// Minimum gap between verification-code emails.
const OTP_COOLDOWN_MS = 60_000;

const RECAPTCHA_SITE_KEY =
  import.meta.env.PUBLIC_RECAPTCHA_SITE_KEY;

const SUPABASE_URL =
  import.meta.env.PUBLIC_SUPABASE_URL;

const SUPABASE_ANON_KEY =
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

const RECAPTCHA_SCRIPT_ID = "google-recaptcha-v3";

export default function DeleteAccountForm() {
  const [step, setStep] = useState<Step>("email");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [captchaReady, setCaptchaReady] = useState(false);

  // --------------------------------------------------
  // Load reCAPTCHA v3
  // --------------------------------------------------

  useEffect(() => {
    if (!RECAPTCHA_SITE_KEY) {
      console.error("Missing PUBLIC_RECAPTCHA_SITE_KEY.");
      return;
    }

    if (window.grecaptcha) {
      window.grecaptcha.ready(() => {
        setCaptchaReady(true);
      });
      return;
    }

    let script = document.getElementById(
      RECAPTCHA_SCRIPT_ID,
    ) as HTMLScriptElement | null;

    const handleLoad = () => {
      if (!window.grecaptcha) {
        console.error("reCAPTCHA failed to initialize.");
        return;
      }

      window.grecaptcha.ready(() => {
        setCaptchaReady(true);
      });
    };

    const handleError = () => {
      console.error("Unable to load reCAPTCHA script.");
    };

    if (!script) {
      script = document.createElement("script");
      script.id = RECAPTCHA_SCRIPT_ID;
      script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
      script.async = true;
      script.defer = true;

      script.addEventListener("load", handleLoad);
      script.addEventListener("error", handleError);

      document.head.appendChild(script);
    } else {
      script.addEventListener("load", handleLoad);
      script.addEventListener("error", handleError);

      // Handle the case where the script has already loaded.
      if (window.grecaptcha) {
        handleLoad();
      }
    }

    return () => {
      script?.removeEventListener("load", handleLoad);
      script?.removeEventListener("error", handleError);
    };
  }, []);

  // --------------------------------------------------
  // Generate reCAPTCHA token
  // --------------------------------------------------

  const generateRecaptchaToken = async (
    action: string,
  ): Promise<string> => {
    if (!window.grecaptcha || !captchaReady) {
      throw new Error(
        "Security verification is not ready. Please try again.",
      );
    }

    return new Promise((resolve, reject) => {
      window.grecaptcha!.ready(async () => {
        try {
          const token = await window.grecaptcha!.execute(
            RECAPTCHA_SITE_KEY,
            { action },
          );

          if (!token) {
            reject(new Error("Unable to generate security token."));
            return;
          }

          resolve(token);
        } catch {
          reject(
            new Error("Security verification failed. Please try again."),
          );
        }
      });
    });
  };

  const steps = [
    { id: "email", label: "Account details" },
    { id: "verification", label: "Verify email" },
  ];

  const currentStep = steps.findIndex(
    (item) => item.id === step,
  );

  const inputClasses =
    "h-12 w-full rounded-xl border border-white/10 bg-dark-3 px-4 text-sm text-white outline-none transition placeholder:text-gray-500 focus:border-primary focus:ring-2 focus:ring-primary/20";

  const primaryButtonClasses =
    "flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50";

  // --------------------------------------------------
  // Step 1: Request deletion OTP
  // --------------------------------------------------

  const handleEmailSubmit = async (
    event: SyntheticEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setError("");

    const normalizedUsername = username.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedUsername || !normalizedEmail) {
      setError(
        "Please enter your username and registered email address.",
      );
      return;
    }

    if (
      normalizedUsername.length < 3 ||
      normalizedUsername.length > 30 ||
      !/^[a-z0-9_.-]+$/.test(normalizedUsername)
    ) {
      setError("Please enter a valid Gumzo username.");
      return;
    }

    if (
      normalizedEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!captchaReady) {
      setError("Security verification is still loading. Please wait.");
      return;
    }

    const wait = cooldownRemaining("delete-otp", OTP_COOLDOWN_MS);

    if (wait > 0) {
      setError(`Please wait ${wait}s before requesting another code.`);
      return;
    }

    setLoading(true);

    try {
      const recaptchaToken = await generateRecaptchaToken(
        "request_account_deletion",
      );

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/request-account-deletion-otp`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            username: normalizedUsername,
            email: normalizedEmail,
            recaptchaToken,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        // The server already returns one generic message for
        // unknown username / wrong email, so it is safe to show.
        setError(
          data.message ||
            data.error ||
            "Invalid username or email address. Please check your details.",
        );
        return;
      }

      markSubmitted("delete-otp");
      setUsername(normalizedUsername);
      setEmail(normalizedEmail);
      setStep("verification");
      setOtp("");
    } catch (error) {
      console.error("OTP request failed:", error);

      setError(
        error instanceof Error
          ? error.message
          : "Unable to send verification code. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // Step 2: Verify OTP
  // --------------------------------------------------

  const handleOtpSubmit = async (
    event: SyntheticEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setError("");

    if (!/^\d{6}$/.test(otp)) {
      setError("Please enter a valid 6-digit verification code.");
      return;
    }

    if (!captchaReady) {
      setError("Security verification is still loading. Please wait.");
      return;
    }

    setLoading(true);

    try {
      const recaptchaToken = await generateRecaptchaToken(
        "verify_account_deletion",
      );

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/verify-account-deletion-otp`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            username: username.trim().toLowerCase(),
            email: email.trim().toLowerCase(),
            otp,
            recaptchaToken,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(
          data.message ||
            data.error ||
            "Invalid or expired verification code.",
        );
        return;
      }

      // OTP verified and deletion request created in Supabase.
      // Supabase Cron will handle the actual account deletion.
      setStep("success");
    } catch (error) {
      console.error("OTP verification failed:", error);

      setError(
        error instanceof Error
          ? error.message
          : "Unable to verify the code. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // Back to account details
  // --------------------------------------------------

  const handleBack = () => {
    setError("");
    setOtp("");
    setStep("email");
  };

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-dark-2 shadow-xl">
      {/* Progress */}
      {step !== "success" && (
        <div className="border-b border-white/10 px-6 py-6 sm:px-8">
          <div className="flex items-center justify-between">
            {steps.map((item, index) => {
              const completed = index < currentStep;
              const active = index === currentStep;

              return (
                <div
                  key={item.id}
                  className="flex flex-1 items-center"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className={`flex size-9 items-center justify-center rounded-full border text-sm font-semibold transition ${
                        completed
                          ? "border-primary bg-primary text-white"
                          : active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-white/10 bg-dark-3 text-gray-500"
                      }`}
                    >
                      {completed ? <LuCheck size={17} /> : index + 1}
                    </div>

                    <span
                      className={`text-xs ${
                        active || completed
                          ? "font-semibold text-primary"
                          : "text-gray-500"
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>

                  {index !== steps.length - 1 && (
                    <div
                      className={`mx-3 mb-5 h-px flex-1 ${
                        completed ? "bg-primary" : "bg-white/10"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="p-6 sm:p-8">
        {/* Step 1: Account details */}
        {step === "email" && (
          <form onSubmit={handleEmailSubmit}>
            <div className="mb-6">
              <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <LuShieldCheck size={24} />
              </div>

              <h2 className="text-xl font-bold text-white">
                Verify your account
              </h2>

              <p className="mt-2 text-sm leading-6 text-gray-400">
                Enter your Gumzo username and registered email address
                to verify your account before requesting deletion.
              </p>
            </div>

            {/* Username */}
            <div className="mb-5">
              <label
                htmlFor="delete-username"
                className="mb-2 block text-sm font-medium text-gray-300"
              >
                Gumzo username
                <span className="ml-1 text-red-400">*</span>
              </label>

              <div className="relative">
                <LuUserRound
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
                />

                <input
                  id="delete-username"
                  type="text"
                  value={username}
                  onChange={(event) =>
                    setUsername(event.target.value)
                  }
                  placeholder="Enter your username"
                  autoComplete="username"
                  minLength={3}
                  maxLength={30}
                  required
                  className={`${inputClasses} pl-11`}
                />
              </div>
            </div>

            {/* Email */}
            <div className="mb-5">
              <label
                htmlFor="delete-email"
                className="mb-2 block text-sm font-medium text-gray-300"
              >
                Registered email address
                <span className="ml-1 text-red-400">*</span>
              </label>

              <div className="relative">
                <LuMail
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
                />

                <input
                  id="delete-email"
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  className={`${inputClasses} pl-11`}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={
                loading ||
                !captchaReady ||
                !username.trim() ||
                !email.trim()
              }
              className={primaryButtonClasses}
            >
              {loading ? (
                <>
                  <LuLoaderCircle
                    className="animate-spin"
                    size={18}
                  />
                  Sending code...
                </>
              ) : !captchaReady ? (
                <>
                  <LuLoaderCircle
                    className="animate-spin"
                    size={18}
                  />
                  Loading security...
                </>
              ) : (
                <>
                  Send verification code
                  <LuArrowRight size={17} />
                </>
              )}
            </button>

            <p className="mt-4 text-center text-xs leading-5 text-gray-500">
              A verification code will be sent to your registered
              email address.
            </p>
          </form>
        )}

        {/* Step 2: OTP verification */}
        {step === "verification" && (
          <form onSubmit={handleOtpSubmit}>
            <div className="mb-6">
              <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <LuMail size={24} />
              </div>

              <h2 className="text-xl font-bold text-white">
                Check your email
              </h2>

              <p className="mt-2 text-sm leading-6 text-gray-400">
                Enter the 6-digit verification code sent to:
              </p>

              <p className="mt-2 break-all text-sm font-semibold text-primary">
                {email}
              </p>
            </div>

            <div className="mb-5">
              <label
                htmlFor="delete-otp"
                className="mb-2 block text-sm font-medium text-gray-300"
              >
                Verification code
              </label>

              <input
                id="delete-otp"
                type="text"
                value={otp}
                onChange={(event) =>
                  setOtp(
                    event.target.value.replace(/\D/g, "").slice(0, 6),
                  )
                }
                placeholder="000000"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                className={`${inputClasses} text-center text-xl tracking-[0.5em]`}
              />
            </div>

            <button
              type="submit"
              disabled={
                loading ||
                !captchaReady ||
                otp.length !== 6
              }
              className={primaryButtonClasses}
            >
              {loading ? (
                <>
                  <LuLoaderCircle
                    className="animate-spin"
                    size={18}
                  />
                  Verifying...
                </>
              ) : (
                <>
                  Verify and submit request
                  <LuArrowRight size={17} />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleBack}
              disabled={loading}
              className="mt-4 flex w-full items-center justify-center gap-2 text-sm text-gray-400 transition hover:text-white disabled:opacity-50"
            >
              <LuArrowLeft size={16} />
              Change account details
            </button>

            <p className="mt-5 text-center text-xs leading-5 text-gray-500">
              After successful verification, your account deletion
              request will be submitted automatically.
            </p>
          </form>
        )}

        {/* Success */}
        {step === "success" && (
          <div className="py-6 text-center">
            <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full border border-green-500/20 bg-green-500/10 text-green-400">
              <LuCheck size={32} />
            </div>

            <h2 className="text-xl font-bold text-white">
              Deletion request submitted
            </h2>

            <p className="mt-3 text-sm leading-7 text-gray-400">
              Your email has been verified and your Gumzo account
              deletion request has been submitted successfully.
              Your account and associated data will be permanently
              deleted automatically.
            </p>

            <p className="mt-4 rounded-xl border border-white/10 bg-dark-3 p-4 text-xs leading-6 text-gray-400">
              You don't need to take any further action. The deletion
              process will be handled securely by Gumzo.
            </p>

            <a
              href="/"
              className="mt-7 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-7 text-sm font-semibold text-white transition hover:brightness-110"
            >
              Back to Gumzo
            </a>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-3 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4"
          >
            <LuInfo
              size={18}
              className="mt-0.5 shrink-0 text-yellow-400"
            />

            <p className="text-xs leading-6 text-yellow-200">
              {error}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
