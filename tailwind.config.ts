import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#07080B",
          900: "#0B0D12",
          850: "#10131A",
          800: "#151922",
          750: "#1A1F2A",
          700: "#222835",
          600: "#2E3545",
          500: "#454E61",
          400: "#6B7487",
          300: "#9AA2B2",
          200: "#C6CBD5",
          100: "#E7E9EE",
        },
        royal: {
          300: "#9DB4FF",
          400: "#7393FF",
          500: "#4A6CF7",
          600: "#2F55E4",
          700: "#2443BD",
          800: "#1D3591",
          900: "#152660",
        },
      },
      fontFamily: {
        sans: ['"Inter Variable"', "system-ui", "sans-serif"],
        display: ['"Barlow Condensed"', '"Inter Variable"', "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.6)",
        glow: "0 0 0 1px rgba(74,108,247,0.35), 0 8px 30px -8px rgba(47,85,228,0.45)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "none" } },
        "scale-in": { from: { opacity: "0", transform: "scale(0.97)" }, to: { opacity: "1", transform: "none" } },
        "slide-up": { from: { opacity: "0", transform: "translateY(16px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: {
        "fade-in": "fade-in .25s ease-out both",
        "scale-in": "scale-in .18s ease-out both",
        "slide-up": "slide-up .25s cubic-bezier(.2,.8,.2,1) both",
      },
    },
  },
  plugins: [],
};

export default config;
