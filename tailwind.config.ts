import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        serif: ["Georgia", "serif"],
      },
      colors: {
        green: {
          50:  "#f0fafa",
          100: "#d5f4f3",
          200: "#aae8e7",
          300: "#90d8d7",
          400: "#7bcdcb",
          500: "#52b8b6",
          600: "#369b99",
          700: "#24726f",
          800: "#1a5150",
          900: "#0d2e2d",
        },
      },
    },
  },
  plugins: [],
};

export default config;
