import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#07080d",
          900: "#0d1118",
          800: "#141a23",
          700: "#1f2935",
        },
        signal: {
          cyan: "#28d7c7",
          green: "#58e08a",
          amber: "#f2bf5a",
          red: "#ff5c7a",
          violet: "#9b8cff",
        },
      },
      boxShadow: {
        panel: "0 18px 60px rgba(0, 0, 0, 0.35)",
        pixel: "0 0 0 2px rgba(255,255,255,0.08), 0 10px 30px rgba(0,0,0,0.35)",
      },
      fontFamily: {
        mono: ["var(--font-mono)", "Consolas", "monospace"],
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;


