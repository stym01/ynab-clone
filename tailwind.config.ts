import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: "#005a70",
          hover: "#004758",
        },
        sidebar: {
          dark: "#002b36",
          darker: "#00222b",
          light: "#003d4c",
        },
        status: {
          positive: "#00a35c",
          positiveHover: "#008f51",
          negative: "#d33c40",
          neutral: "#e5e7eb",
        },
        bg: {
          primary: "#ffffff",
          secondary: "#f8fafc",
        },
        border: {
          DEFAULT: "#e2e8f0",
        },
        text: {
          primary: "#1e293b",
          secondary: "#64748b",
        }
      },
    },
  },
  plugins: [],
};
export default config;
