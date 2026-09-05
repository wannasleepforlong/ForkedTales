import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0b0812",
          900: "#0b0812",
          800: "#141024",
          700: "#1e1836",
          600: "#2a2247",
        },
        parchment: {
          DEFAULT: "#f4ecd8",
          muted: "#c9c2b1",
        },
        accent: {
          DEFAULT: "#e0b04a",
          hi: "#f4c96a",
          lo: "#a8811f",
        },
        rose: {
          DEFAULT: "#d97a8a",
        },
        teal: {
          DEFAULT: "#79b8a6",
        },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "grain":
          "radial-gradient(rgba(255,255,255,0.02) 1px, transparent 1px)",
        "hero-glow":
          "radial-gradient(ellipse at top, rgba(224,176,74,0.18), transparent 60%)",
      },
      backgroundSize: {
        grain: "3px 3px",
      },
      boxShadow: {
        glow: "0 0 40px -10px rgba(224, 176, 74, 0.35)",
        inset: "inset 0 1px 0 rgba(255,255,255,0.04)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-slow": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-in": "fade-in 400ms ease-out both",
        "fade-in-slow": "fade-in-slow 900ms ease-out both",
        shimmer: "shimmer 3s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
