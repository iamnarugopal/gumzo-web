
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
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

const MAX_ATTACHMENTS = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_VIDEO_SIZE = 20 * 1024 * 1024;

const allowedExtensions = {
  image: ["jpg", "jpeg", "png", "webp", "gif"],
  video: ["mp4", "mov", "avi", "mkv", "webm"],
  file: ["pdf", "doc", "docx", "txt", "csv", "zip"],
};

type FileType = "image" | "video" | "file";

type Status = {
  message: string;
  type: "success" | "error";
} | null;

function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

function getFileType(file: File): FileType | null {
  const extension = getFileExtension(file.name);

  if (allowedExtensions.image.includes(extension)) return "image";
  if (allowedExtensions.video.includes(extension)) return "video";
  if (allowedExtensions.file.includes(extension)) return "file";

  return null;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SupportForm() {
  const [category, setCategory] = useState("general_support");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<Status>(null);
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedCategory =
    categories.find((item) => item.value === category) ?? categories[0];

  const showAttachments = category === "bug_report";

  const inputClass =
    "block w-full min-w-0 rounded-xl border border-white/10 bg-dark-3 py-3.5 pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-primary focus:ring-2 focus:ring-primary/20";

  const iconClass =
    "pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-500";

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

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);

    if (selectedFiles.length > MAX_ATTACHMENTS) {
      setStatus({
        message: "You can only upload up to 5 attachments.",
        type: "error",
      });

      event.target.value = "";
      setFiles([]);
      return;
    }

    const invalidFiles: string[] = [];

    for (const file of selectedFiles) {
      const type = getFileType(file);

      if (!type) {
        invalidFiles.push(`${file.name}: Unsupported file format.`);
        continue;
      }

      if (type === "video" && file.size > MAX_VIDEO_SIZE) {
        invalidFiles.push(`${file.name}: Video exceeds 20 MB.`);
        continue;
      }

      if (type !== "video" && file.size > MAX_FILE_SIZE) {
        invalidFiles.push(`${file.name}: File exceeds 5 MB.`);
      }
    }

    if (invalidFiles.length > 0) {
      setStatus({
        message: invalidFiles.join(" "),
        type: "error",
      });

      event.target.value = "";
      setFiles([]);
      return;
    }

    setFiles(selectedFiles);
    setStatus(null);
  };

  const removeFile = (index: number) => {
    const updatedFiles = files.filter((_, i) => i !== index);

    setFiles(updatedFiles);

    // Keep the native file input synchronized with React state.
    if (fileInputRef.current) {
      const dataTransfer = new DataTransfer();

      updatedFiles.forEach((file) => {
        dataTransfer.items.add(file);
      });

      fileInputRef.current.files = dataTransfer.files;
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submitting) return;

    setStatus(null);

    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();
    const trimmedDescription = description.trim();

    const usernamePattern = /^[a-zA-Z0-9_.-]+$/;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

    if (!trimmedDescription) {
      setStatus({
        message: "Please provide a description.",
        type: "error",
      });
      return;
    }

    if (showAttachments && files.length > MAX_ATTACHMENTS) {
      setStatus({
        message: "You can only upload up to 5 attachments.",
        type: "error",
      });
      return;
    }

    setSubmitting(true);

   
try {
  const formData = new FormData();

  formData.append("username", trimmedUsername);
  formData.append("contact_email", trimmedEmail);
  formData.append("category", category);
  formData.append("description", trimmedDescription);

  // Append multiple attachments
  files.forEach((file) => {
    formData.append("attachments", file);
  });

  const response = await fetch(
    `${import.meta.env.PUBLIC_SUPABASE_URL}/functions/v1/submit-support`,
    {
      method: "POST",
      headers: {
        apikey: import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${import.meta.env.PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: formData,
    },
  );

  const data = await response.json();

  if (!response.ok || !data.success) {
    console.error("Support submission error:", data);

    throw new Error(
      data.details || data.error || "Unable to submit support ticket.",
    );
  }

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
                  Add screenshots, videos or relevant files.
                </p>
              </div>

              <span className="shrink-0 text-xs font-medium text-primary">
                {files.length} / {MAX_ATTACHMENTS}
              </span>
            </div>

            {/* Selected Files */}
            <div className="mb-3 space-y-2">
              {files.map((file, index) => {
                const type = getFileType(file);

                return (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-white/10 bg-dark-3 p-3"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                        {type === "image"
                          ? "IMG"
                          : type === "video"
                            ? "VID"
                            : "FILE"}
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
                <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <LuUpload size={25} />
                </div>

                <span className="text-sm font-semibold text-gray-200">
                  Click to upload files
                </span>

                <span className="mt-2 text-xs leading-5 text-gray-500">
                  Images and documents up to 5 MB · Videos up to 20 MB
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
              accept=".jpg,.jpeg,.png,.webp,.gif,.mp4,.mov,.avi,.mkv,.webm,.pdf,.doc,.docx,.txt,.csv,.zip"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        )}

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
          disabled={submitting}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-linear-to-r from-primary to-secondary px-6 py-4 text-sm font-bold text-white shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:shadow-primary/30 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        >
          <LuSend size={18} />
          {submitting ? "Submitting..." : "Submit Support Ticket"}
        </button>

        <p className="text-center text-xs leading-6 text-gray-500">
          Please provide accurate information so we can assist you better.
        </p>

      </form>
    </div>
  );
}
