
import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import {
  LuBug,
  LuChevronDown,
  LuCircleAlert,
  LuCircleCheck,
  LuLifeBuoy,
  LuLightbulb,
  LuMail,
  LuSend,
  LuShieldAlert,
  LuTrash2,
  LuUpload,
  LuUserRound,
} from "react-icons/lu";
import {
  cooldownRemaining,
  markSubmitted,
  MIN_FILL_TIME_MS,
} from "../../lib/spamGuard";

const COOLDOWN_MS = 60_000;

// --------------------------------------------------
// reCAPTCHA v3
// --------------------------------------------------

declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void;
      execute: (
        siteKey: string,
        options: { action: string }
      ) => Promise<string>;
    };
  }
}

const SITE_KEY = import.meta.env.PUBLIC_RECAPTCHA_SITE_KEY;
const RECAPTCHA_ACTION = "submit_support";

// --------------------------------------------------
// Categories
// --------------------------------------------------

const categories = [
  {
    label: "General Support",
    value: "general_support",
    description: "Help with your account or general questions.",
    icon: LuLifeBuoy,
    fieldLabel: "Description",
    placeholder: "Describe your issue or question in detail...",
  },
  {
    label: "App Suggestion",
    value: "app_suggestion",
    description: "Share an idea or suggest a new feature.",
    icon: LuLightbulb,
    fieldLabel: "Suggestion",
    placeholder: "Share your idea or feature request in detail...",
  },
  {
    label: "Bug Report",
    value: "bug_report",
    description: "Report an issue or unexpected app behaviour.",
    icon: LuBug,
    fieldLabel: "Describe Bug",
    placeholder:
      "Describe the bug in detail. Include steps to reproduce if applicable...",
  },
  {
    label: "Mute / Ban Appeal",
    value: "false_mute_ban_appeal",
    description:
      "Appeal a mute or ban you believe was applied incorrectly.",
    icon: LuShieldAlert,
    fieldLabel: "Description",
    placeholder: "Provide details and context for your mute/ban appeal...",
  },
];

// --------------------------------------------------
// Attachment configuration
// --------------------------------------------------

const MAX_ATTACHMENTS = 5;
const MIN_DESCRIPTION_LENGTH = 10;

// Bug report attachments are images only (same as the app and the server). The size and the
// types below are the most the server accepts and are used until the admin's settings load.
// The admin can narrow them in the app (Management > App Settings > Media); the form reads
// them from /api/support-settings so both always match.
const DEFAULT_LIMITS = {
  maxKb: 5 * 1024,
  exts: ["jpg", "jpeg", "png", "webp", "gif"],
};

type Limits = typeof DEFAULT_LIMITS;

type Status = {
  message: string;
  type: "success" | "error";
} | null;

// --------------------------------------------------
// Helpers
// --------------------------------------------------

function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

function formatLimit(kb: number) {
  if (kb < 1024) return `${kb} KB`;

  const mb = kb / 1024;

  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
}

function formatExts(exts: string[]) {
  const labels = exts.map((ext) => (ext === "jpeg" ? "jpg" : ext).toUpperCase());

  return [...new Set(labels)].join(", ");
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// --------------------------------------------------
// Component
// --------------------------------------------------

export default function SupportForm() {
  const [category, setCategory] = useState("general_support");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<Status>(null);
  const [submitting, setSubmitting] = useState(false);
  const [captchaReady, setCaptchaReady] = useState(false);
  const [limits, setLimits] = useState<Limits>(DEFAULT_LIMITS);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [website, setWebsite] = useState(""); // honeypot
  const mountedAt = useRef(Date.now());

  const selectedCategory =
    categories.find((item) => item.value === category) ?? categories[0];

  const showAttachments = category === "bug_report";

  // ------------------------------------------------
  // Load Google reCAPTCHA v3
  // ------------------------------------------------

  useEffect(() => {
    if (!SITE_KEY) {
      console.error("Missing PUBLIC_RECAPTCHA_SITE_KEY.");
      return;
    }

    let cancelled = false;

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-recaptcha-v3="true"]'
    );

    const initialize = () => {
      if (cancelled || !window.grecaptcha) return;

      window.grecaptcha.ready(() => {
        if (!cancelled) {
          setCaptchaReady(true);
        }
      });
    };

    if (existingScript) {
      if (window.grecaptcha) {
        initialize();
      } else {
        existingScript.addEventListener("load", initialize, {
          once: true,
        });
      }

      return () => {
        cancelled = true;
        existingScript.removeEventListener("load", initialize);
      };
    }

    const script = document.createElement("script");

    script.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;
    script.async = true;
    script.defer = true;
    script.dataset.recaptchaV3 = "true";

    script.addEventListener("load", initialize);

    script.addEventListener(
      "error",
      () => {
        if (!cancelled) {
          setCaptchaReady(false);
          console.error("Failed to load Google reCAPTCHA.");
        }
      },
      { once: true }
    );

    document.head.appendChild(script);

    return () => {
      cancelled = true;
      script.removeEventListener("load", initialize);
    };
  }, []);

  // ------------------------------------------------
  // Attachment rules set by the admin in the app
  // ------------------------------------------------

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/support-settings", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (
          !data?.success ||
          typeof data.max_kb !== "number" ||
          !Array.isArray(data.exts) ||
          data.exts.length === 0
        ) {
          return;
        }

        // Never allow more than the form's built-in maximum.
        const exts = data.exts.filter(
          (ext: unknown): ext is string =>
            typeof ext === "string" && DEFAULT_LIMITS.exts.includes(ext)
        );

        if (exts.length === 0) return;

        setLimits({
          maxKb: Math.min(data.max_kb, DEFAULT_LIMITS.maxKb),
          exts,
        });
      })
      .catch(() => {
        // Keep the defaults if the settings cannot be loaded.
      });

    return () => controller.abort();
  }, []);

  // ------------------------------------------------
  // Styles
  // ------------------------------------------------

  const inputClass =
    "block w-full min-w-0 rounded-xl border border-white/10 bg-dark-3 py-3.5 pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-primary focus:ring-2 focus:ring-primary/20";

  const iconClass =
    "pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-500";

  // ------------------------------------------------
  // Category change
  // ------------------------------------------------

  const handleCategoryChange = (value: string) => {
    setCategory(value);
    setStatus(null);

    if (value !== "bug_report") {
      setFiles([]);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // ------------------------------------------------
  // File selection
  // ------------------------------------------------

  const handleFileChange = (
    event: SyntheticEvent<HTMLInputElement>
  ) => {
    const input = event.currentTarget;
    const selectedFiles = Array.from(input.files ?? []);

    if (selectedFiles.length > MAX_ATTACHMENTS) {
      setStatus({
        message: "You can only upload up to 5 attachments.",
        type: "error",
      });

      input.value = "";
      setFiles([]);
      return;
    }

    const invalidFiles: string[] = [];

    for (const file of selectedFiles) {
      if (!limits.exts.includes(getFileExtension(file.name))) {
        invalidFiles.push(
          `${file.name}: Only ${formatExts(limits.exts)} images are allowed.`
        );
        continue;
      }

      if (file.size > limits.maxKb * 1024) {
        invalidFiles.push(
          `${file.name}: Image exceeds ${formatLimit(limits.maxKb)}.`
        );
      }
    }

    if (invalidFiles.length > 0) {
      setStatus({
        message: invalidFiles.join(" "),
        type: "error",
      });

      input.value = "";
      setFiles([]);
      return;
    }

    setFiles(selectedFiles);
    setStatus(null);
  };

  // ------------------------------------------------
  // Remove attachment
  // ------------------------------------------------

  const removeFile = (index: number) => {
    const updatedFiles = files.filter((_, i) => i !== index);

    setFiles(updatedFiles);

    if (fileInputRef.current) {
      const dataTransfer = new DataTransfer();

      updatedFiles.forEach((file) => {
        dataTransfer.items.add(file);
      });

      fileInputRef.current.files = dataTransfer.files;
    }
  };

  // ------------------------------------------------
  // Form submission
  // ------------------------------------------------

  const handleSubmit = async (
    event: SyntheticEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (submitting) return;

    setStatus(null);

    // Honeypot: real users never see or fill this field.
    if (website) {
      if (import.meta.env.DEV) {
        console.warn("Honeypot field was filled; submission silently dropped.");
      }
      setStatus({
        message: "Your support ticket has been submitted successfully.",
        type: "success",
      });
      return;
    }

    if (Date.now() - mountedAt.current < MIN_FILL_TIME_MS) {
      setStatus({
        message: "Please take a moment to review your request and try again.",
        type: "error",
      });
      return;
    }

    const wait = cooldownRemaining("support", COOLDOWN_MS);

    if (wait > 0) {
      setStatus({
        message: `Please wait ${wait}s before submitting another ticket.`,
        type: "error",
      });
      return;
    }

    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();
    const trimmedDescription = description.trim();

    const usernamePattern = /^[a-zA-Z0-9_.-]+$/;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Validate username
    if (
      trimmedUsername.length < 3 ||
      trimmedUsername.length > 30 ||
      !usernamePattern.test(trimmedUsername)
    ) {
      setStatus({
        message: "Please enter a valid Gumzo username.",
        type: "error",
      });
      return;
    }

    // Validate email
    if (
      !emailPattern.test(trimmedEmail) ||
      trimmedEmail.length > 254
    ) {
      setStatus({
        message: "Please enter a valid contact email address.",
        type: "error",
      });
      return;
    }

    // Validate description
    if (!trimmedDescription) {
      setStatus({
        message: "Please provide a description.",
        type: "error",
      });
      return;
    }

    if (trimmedDescription.length < MIN_DESCRIPTION_LENGTH) {
      setStatus({
        message: `Description must contain at least ${MIN_DESCRIPTION_LENGTH} characters.`,
        type: "error",
      });
      return;
    }

    // Validate attachments
    if (showAttachments && files.length > MAX_ATTACHMENTS) {
      setStatus({
        message: "You can only upload up to 5 attachments.",
        type: "error",
      });
      return;
    }

    // Check configuration
    if (!SITE_KEY) {
      setStatus({
        message: "Support submission is currently unavailable.",
        type: "error",
      });

      console.error("Missing environment variables.");
      return;
    }

    if (!captchaReady || !window.grecaptcha) {
      setStatus({
        message: "Security verification is loading. Please try again.",
        type: "error",
      });
      return;
    }

    setSubmitting(true);

    try {
      // --------------------------------------------
      // Generate fresh reCAPTCHA v3 token
      // --------------------------------------------

      const recaptchaToken = await window.grecaptcha.execute(
        SITE_KEY,
        {
          action: RECAPTCHA_ACTION,
        }
      );

      if (!recaptchaToken) {
        throw new Error(
          "Unable to generate security verification token."
        );
      }

      // --------------------------------------------
      // Build multipart form data
      // --------------------------------------------

      const formData = new FormData();

      formData.append("username", trimmedUsername);
      formData.append("contact_email", trimmedEmail);
      formData.append("category", category);
      formData.append("description", trimmedDescription);
      formData.append("recaptchaToken", recaptchaToken);

      // Append attachments
      if (showAttachments) {
        files.forEach((file) => {
          formData.append("attachments", file);
        });
      }

      // --------------------------------------------
      // Submit to Supabase Edge Function
      // --------------------------------------------

      const response = await fetch(
        "/api/submit-support",
        {
          method: "POST",
          headers: {
          },
          body: formData,
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        // Never surface server internals (`details`) to the user.
        throw new Error(
          typeof data?.error === "string" && data.error.length <= 200
            ? data.error
            : "Unable to submit support ticket."
        );
      }

      // --------------------------------------------
      // Success
      // --------------------------------------------

      markSubmitted("support");

      setStatus({
        message: `Your support ticket has been submitted successfully. Ticket ID: ${data.ticketId}`,
        type: "success",
      });

      // Reset form
      setUsername("");
      setEmail("");
      setDescription("");
      setFiles([]);
      setCategory("general_support");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Support form submission failed:", error);

      setStatus({
        message:
          error instanceof Error
            ? error.message
            : "Something went wrong. Please try again.",
        type: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ------------------------------------------------
  // Render
  // ------------------------------------------------

  return (
    <div className="rounded-2xl border border-white/10 bg-dark-2 p-5 shadow-2xl shadow-black/20 sm:p-8">
      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Category */}
        <div>
          <label
            htmlFor="category"
            className="mb-2 block text-sm font-semibold text-gray-200"
          >
            Issue Category <span className="text-danger">*</span>
          </label>

          <div className="relative">
            <select
              id="category"
              name="category"
              required
              value={category}
              onChange={(event) =>
                handleCategoryChange(event.target.value)
              }
              className="w-full appearance-none rounded-xl border border-white/10 bg-dark-3 py-3.5 pl-4 pr-12 text-sm text-white outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {categories.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <LuChevronDown
              size={19}
              className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
            />
          </div>

          <p className="mt-2 text-xs leading-5 text-gray-500">
            {selectedCategory.description}
          </p>
        </div>

        {/* Username */}
        <div>
          <label
            htmlFor="username"
            className="mb-2 block text-sm font-semibold text-gray-200"
          >
            Username <span className="text-danger">*</span>
          </label>

          <div className="relative">
            <LuUserRound size={19} className={iconClass} />

            <input
              type="text"
              id="username"
              name="username"
              required
              minLength={3}
              maxLength={30}
              autoComplete="username"
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
                setStatus(null);
              }}
              placeholder="Enter your Gumzo username"
              className={inputClass}
            />
          </div>

          <p className="mt-2 text-xs text-gray-500">
            Enter the username associated with your Gumzo account.
          </p>
        </div>

        {/* Contact Email */}
        <div>
          <label
            htmlFor="contact-email"
            className="mb-2 block text-sm font-semibold text-gray-200"
          >
            Contact Email <span className="text-danger">*</span>
          </label>

          <div className="relative">
            <LuMail size={19} className={iconClass} />

            <input
              type="email"
              id="contact-email"
              name="contact_email"
              required
              maxLength={254}
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setStatus(null);
              }}
              placeholder="your.email@example.com"
              className={inputClass}
            />
          </div>

          <p className="mt-2 text-xs text-gray-500">
            We'll use this email to respond to your request.
          </p>
        </div>

        {/* Description */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label
              htmlFor="description"
              className="text-sm font-semibold text-gray-200"
            >
              {selectedCategory.fieldLabel}{" "}
              <span className="text-danger">*</span>
            </label>

            <span className="shrink-0 text-xs text-gray-500">
              {description.length} / 1000
            </span>
          </div>

          <textarea
            id="description"
            name="description"
            required
            maxLength={1000}
            rows={6}
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
              setStatus(null);
            }}
            placeholder={selectedCategory.placeholder}
            className="block w-full min-w-0 resize-y rounded-xl border border-white/10 bg-dark-3 px-4 py-4 text-sm leading-7 text-white outline-none transition placeholder:text-gray-600 focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Attachments */}
        {showAttachments && (
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <label className="text-sm font-semibold text-gray-200">
                  Attachments
                </label>

                <p className="mt-1 text-xs text-gray-500">
                  Add screenshots that show the problem.
                </p>
              </div>

              <span className="shrink-0 text-xs font-medium text-primary-light">
                {files.length} / {MAX_ATTACHMENTS}
              </span>
            </div>

            {/* Selected Files */}
            <div className="mb-3 space-y-2">
              {files.map((file, index) => {
                return (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-white/10 bg-dark-3 p-3"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary-light">
                        IMG
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-gray-200">
                          {file.name}
                        </p>

                        <p className="mt-1 text-[11px] text-gray-500">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      aria-label={`Remove ${file.name}`}
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg text-danger transition hover:bg-danger/10"
                    >
                      <LuTrash2 size={17} />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Upload Area */}
            {files.length < MAX_ATTACHMENTS && (
              <label
                htmlFor="attachments"
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-dark-3 px-4 py-8 text-center transition hover:border-primary/50 hover:bg-primary/5"
              >
                <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary-light">
                  <LuUpload size={25} />
                </div>

                <span className="text-sm font-semibold text-gray-200">
                  Click to upload images
                </span>

                <span className="mt-2 text-xs leading-5 text-gray-500">
                  {formatExts(limits.exts)} · up to {formatLimit(limits.maxKb)} each
                </span>

                <span className="mt-1 text-xs text-gray-500">
                  Maximum 5 attachments
                </span>
              </label>
            )}

            <input
              ref={fileInputRef}
              id="attachments"
              name="attachments"
              type="file"
              multiple
              accept={limits.exts.map((ext) => `.${ext}`).join(",")}
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        )}

        {/* Honeypot (hidden from real users) */}
        <div
          aria-hidden="true"
          style={{ position: "absolute", left: "-9999px", height: 0, overflow: "hidden" }}
        >
          <label htmlFor="support-hp">Leave this field empty</label>
          <input
            id="support-hp"
            name="hp_field_do_not_fill"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            data-lpignore="true"
            data-1p-ignore="true"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        {/* reCAPTCHA v3 Status */}
        <p className="text-xs text-gray-500" aria-live="polite">
          {captchaReady
            ? "Protected by Google reCAPTCHA."
            : "Loading security verification..."}
        </p>

        {/* Status */}
        {status && (
          <div
            role="status"
            aria-live="polite"
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-6 ${
              status.type === "success"
                ? "border-success/30 bg-success/10 text-success"
                : "border-danger/30 bg-danger/10 text-danger"
            }`}
          >
            {status.type === "success" ? (
              <LuCircleCheck size={19} className="mt-0.5 shrink-0" />
            ) : (
              <LuCircleAlert size={19} className="mt-0.5 shrink-0" />
            )}

            <span>{status.message}</span>
          </div>
        )}

        {/* Submit */}
        <button
          id="submit-button"
          type="submit"
          disabled={submitting || !captchaReady}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-linear-to-r from-primary to-secondary px-6 py-4 text-sm font-bold text-white shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:shadow-primary/30 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        >
          <LuSend size={18} />
          {submitting ? "Submitting..." : "Submit Support Ticket"}
        </button>

        <p className="text-center text-xs leading-6 text-gray-500">
          Please provide accurate information so we can assist you better.
        </p>

        <p className="text-center text-xs leading-6 text-gray-500">
          This site is protected by reCAPTCHA and the Google{" "}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Privacy Policy
          </a>{" "}
          and{" "}
          <a
            href="https://policies.google.com/terms"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Terms of Service
          </a>{" "}
          apply.
        </p>
      </form>
    </div>
  );
}
