import React from "react";
import { Link } from "react-router-dom";

function IconBrain({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3c-1.5 0-2.8.8-3.5 2-.3-.1-.7-.2-1-.2-1.7 0-3 1.3-3 3v.5c-.6.4-1 1-1 1.7 0 .4.1.7.3 1-.5.6-.8 1.4-.8 2.3 0 1.3.7 2.4 1.8 3-.1.2-.1.5-.1.7 0 1.7 1.3 3 3 3h.3c.5 1.2 1.7 2 3.2 2h.5c1.9 0 3.5-1.2 4-3h.3c1.1 0 2-.9 2-2 0-.3-.1-.5-.2-.8 1-.6 1.7-1.7 1.7-3 0-.9-.3-1.7-.8-2.3.2-.3.3-.6.3-1 0-.7-.4-1.3-1-1.7V8c0-1.7-1.3-3-3-3-.3 0-.7.1-1 .2-.7-1.2-2-2-3.5-2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M9 12h2l1 2 2-4 1 2h2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconMerge({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M8 17v2a2 2 0 002 2h4a2 2 0 002-2v-2M12 4v16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M5 12h5M19 12h-5M15 9l3 3-3 3M9 15L6 12l3-3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconChart({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 19V5M4 19h16M8 15V9M12 15v-4M16 15V7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconBolt({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M13 3L4 14h7l-1 8 9-11h-7l1-8z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const features = [
  {
    title: "Semantic duplicate detection",
    body: "Sentence embeddings surface similar bugs before they fragment your backlog. Merge with confidence.",
    Icon: IconMerge,
  },
  {
    title: "Delay intelligence",
    body: "Deadlines and status drive automatic delay signals and priority nudges so teams react before slippage spreads.",
    Icon: IconBolt,
  },
  {
    title: "Live delivery analytics",
    body: "Dashboards aggregate tasks, bugs, and trends so managers see risk and throughput in one glass view.",
    Icon: IconChart,
  },
];

export default function Landing() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-ai-base text-ai-ink">
      <div className="pointer-events-none absolute inset-0 bg-ai-glow-top" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 bg-ai-glow-mid" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-0 bg-ai-grid bg-grid opacity-90"
        aria-hidden="true"
      />

      <header className="relative z-10 border-b border-ai-line/80 bg-ai-base/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 rounded-lg">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 ring-1 ring-cyan-500/30">
              <IconBrain className="h-5 w-5 text-cyan-400" />
            </span>
            <div>
              <span className="block text-lg font-semibold tracking-tight">Nexus PM</span>
              <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-400/90">
                AI layer
              </span>
            </div>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3" aria-label="Primary">
            <Link to="/login" className="ai-btn-ghost px-3 sm:min-h-0 sm:py-2">
              Sign in
            </Link>
            <Link to="/register" className="ai-btn-primary px-4 py-2.5 text-sm sm:min-h-0">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main id="main-content">
        <section className="relative z-10 mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <p
              className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 font-mono text-xs font-medium text-cyan-300 motion-safe:animate-fade-in"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 motion-safe:animate-pulse" />
              Intelligent agile operations
            </p>
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl motion-safe:animate-fade-up">
              Ship faster with an{" "}
              <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-violet-400 bg-clip-text text-transparent">
                AI-aware
              </span>{" "}
              command center
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-ai-subtle motion-safe:animate-fade-up">
              One workspace for projects, Kanban, sprints, and bugs — with models that detect duplicates
              and spotlight delay risk before your standup does.
            </p>
            <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center motion-safe:animate-fade-up">
              <Link to="/register" className="ai-btn-primary px-8 py-3 text-base">
                Start free
              </Link>
              <Link to="/login" className="ai-btn-secondary px-8 py-3 text-base">
                I have an account
              </Link>
            </div>
          </div>

          <div className="relative mx-auto mt-20 max-w-4xl motion-safe:animate-fade-up">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-cyan-500/15 via-transparent to-violet-500/15 blur-2xl" aria-hidden="true" />
            <div className="relative overflow-hidden rounded-2xl border border-ai-line bg-ai-raised/60 p-1 shadow-ai-card backdrop-blur-xl">
              <div className="rounded-xl bg-ai-base/80 p-4 sm:p-6">
                <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-ai-line pb-4">
                  <span className="font-mono text-xs text-ai-subtle">nexus.dashboard</span>
                  <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] text-emerald-400">
                    live
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { label: "Tasks in flight", value: "—", accent: "text-cyan-400" },
                    { label: "Risk signals", value: "AI", accent: "text-violet-400" },
                    { label: "Duplicates caught", value: "—", accent: "text-sky-400" },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl border border-ai-line bg-ai-surface/50 p-4"
                    >
                      <p className="text-xs font-medium text-ai-subtle">{item.label}</p>
                      <p className={`mt-2 font-mono text-2xl font-semibold ${item.accent}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-center font-mono text-[11px] text-ai-subtle/80">
                  Connect your API — numbers populate from your workspace.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          className="relative z-10 border-t border-ai-line/80 bg-ai-void/40 py-20 backdrop-blur-sm"
          aria-labelledby="features-heading"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 id="features-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
                Built for teams that outgrow static boards
              </h2>
              <p className="mt-3 text-ai-subtle">
                Accessibility-first layout, touch-friendly controls, and a visual language inspired by
                modern AI tooling — without sacrificing clarity.
              </p>
            </div>
            <ul className="mt-14 grid gap-6 md:grid-cols-3">
              {features.map(({ title, body, Icon }) => (
                <li key={title}>
                  <article className="ai-card group h-full p-6 transition duration-200 hover:border-cyan-500/25">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/15 to-violet-500/15 ring-1 ring-white/5">
                      <Icon className="h-6 w-6 text-cyan-400 transition group-hover:text-cyan-300" />
                    </div>
                    <h3 className="text-lg font-semibold">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-ai-subtle">{body}</p>
                  </article>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="relative z-10 py-20">
          <div className="mx-auto max-w-3xl rounded-3xl border border-ai-line bg-gradient-to-br from-ai-raised/90 to-ai-base px-6 py-14 text-center shadow-ai-card sm:px-10">
            <h2 className="text-2xl font-bold sm:text-3xl">Ready to run your next sprint?</h2>
            <p className="mt-3 text-ai-subtle">
              Create an account, invite your team, and let Nexus PM keep bugs and deadlines under
              control.
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:justify-center">
              <Link to="/register" className="ai-btn-primary px-8">
                Create workspace
              </Link>
              <Link to="/login" className="ai-btn-secondary px-8">
                Sign in
              </Link>
            </div>
          </div>
        </section>

        <footer className="relative z-10 border-t border-ai-line py-8 text-center">
          <p className="font-mono text-xs text-ai-subtle">
            Nexus PM — AI-enhanced agile project management
          </p>
        </footer>
      </main>
    </div>
  );
}
