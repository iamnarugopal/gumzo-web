import {
  LuClock,
  LuFlag,
  LuHeartHandshake,
  LuMessageSquare,
  LuShieldCheck,
  LuUsers,
} from "react-icons/lu";

const features = [
  {
    icon: LuFlag,
    title: "Review Reports",
    description:
      "Review reported messages and profiles to help keep conversations respectful and safe.",
  },
  {
    icon: LuUsers,
    title: "Manage Communities",
    description:
      "Help manage chat rooms, guide conversations and maintain a welcoming environment.",
  },
  {
    icon: LuShieldCheck,
    title: "Moderation Actions",
    description:
      "Take appropriate action against rule violations and protect community members.",
  },
  {
    icon: LuMessageSquare,
    title: "Member Support",
    description:
      "Help members resolve issues and make their Gumzo experience better.",
  },
];

export default function ModComingSoon() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-dark-3 px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
      {/* Background glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 size-[350px] -translate-x-1/2 rounded-full bg-primary/10 blur-[100px] sm:size-[500px] sm:blur-[140px]" />

      <div className="mx-auto w-full max-w-5xl">
        {/* Hero */}
        <section className="mx-auto max-w-3xl text-center">
          <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary sm:size-16">
            <LuShieldCheck className="size-7 sm:size-[34px]" />
          </div>

          <span className="inline-flex max-w-full items-center justify-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-primary sm:px-4 sm:text-xs sm:tracking-widest">
            <LuClock className="size-3.5 shrink-0" />
            Moderator Programme
          </span>

          <h1 className="mt-5 text-4xl font-bold leading-tight text-white sm:mt-6 sm:text-5xl md:text-6xl lg:text-7xl">
            Coming <span className="text-primary">Soon</span>
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-gray-400 sm:mt-5 sm:text-base sm:leading-7">
            Great communities are built by great people. We're preparing
            the Gumzo Moderator Programme, giving passionate community
            members the opportunity to help make Gumzo a safer and
            friendlier place.
          </p>
        </section>

        {/* Responsibilities */}
        <section className="mt-12 sm:mt-16 lg:mt-20">
          <div className="mb-6 text-center sm:mb-8">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              What Will You Do?
            </h2>

            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-gray-400 sm:mt-3">
              Help us create a better community through these responsibilities.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:gap-5">
            {features.map(({ icon: Icon, title, description }, index) => (
              <article
                key={title}
                className="flex items-start gap-3 rounded-xl border border-white/10 bg-dark-2/70 p-4 transition-colors hover:border-primary/30 sm:gap-4 sm:rounded-2xl sm:p-5 lg:p-6"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:size-12 sm:rounded-xl">
                  <Icon className="size-5 sm:size-[22px]" />
                </div>

                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-semibold text-primary sm:text-xs">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <h3 className="mt-1 text-sm font-semibold text-white sm:text-base">
                    {title}
                  </h3>

                  <p className="mt-2 text-xs leading-5 text-gray-400 sm:text-sm sm:leading-6">
                    {description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Application announcement */}
        <section className="mt-8 rounded-xl border border-primary/20 bg-primary/5 px-4 py-7 text-center sm:mt-12 sm:rounded-2xl sm:px-8 sm:py-9">
          <LuHeartHandshake className="mx-auto size-7 text-primary sm:size-[30px]" />

          <h2 className="mt-3 text-xl font-bold text-white sm:mt-4 sm:text-2xl">
            Be Part of the Gumzo Team
          </h2>

          <p className="mx-auto mt-3 max-w-xl text-xs leading-6 text-gray-400 sm:text-sm sm:leading-7">
            Think you have what it takes to become a moderator?
            We're preparing the application process. Stay connected
            and get ready to take the next step.
          </p>

          <div className="mt-5 inline-flex max-w-full items-center justify-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-2.5 text-[11px] font-semibold text-primary sm:px-5 sm:text-xs">
            <LuClock className="size-3.5 shrink-0" />
            Applications Opening Soon
          </div>
        </section>
      </div>
    </main>
  );
}