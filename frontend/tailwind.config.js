/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ai: {
          void: "#06080f",
          base: "#0b0f1a",
          surface: "#111827",
          raised: "#1a2234",
          line: "rgba(148, 163, 184, 0.14)",
          subtle: "#94a3b8",
          ink: "#f1f5f9",
        },
      },
      fontFamily: {
        sans: ["Outfit", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      backgroundImage: {
        "ai-grid":
          "linear-gradient(rgba(56, 189, 248, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(56, 189, 248, 0.04) 1px, transparent 1px)",
        "ai-glow-top":
          "radial-gradient(ellipse 90% 60% at 50% -30%, rgba(34, 211, 238, 0.22), transparent 55%)",
        "ai-glow-mid":
          "radial-gradient(ellipse 60% 40% at 80% 50%, rgba(139, 92, 246, 0.12), transparent 50%)",
      },
      backgroundSize: {
        grid: "40px 40px",
      },
      boxShadow: {
        "ai-glow": "0 0 48px -12px rgba(34, 211, 238, 0.35)",
        "ai-card": "0 4px 32px -8px rgba(0, 0, 0, 0.55)",
        "ai-inset": "inset 0 1px 0 0 rgba(255, 255, 255, 0.04)",
      },
      animation: {
        "fade-up": "fadeUp 0.55s ease-out both",
        "fade-in": "fadeIn 0.45s ease-out both",
        "float": "float 5s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
    },
  },
  plugins: [],
};
