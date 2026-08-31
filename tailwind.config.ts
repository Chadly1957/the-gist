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
        // Brand scale built around the two Gist brand colors:
        // 500 = #16db93 (bright accent green), 700 = #146763 (deep teal).
        green: {
          50:  "#f4fbf7",
          100: "#e4f6ee",
          200: "#c4eedb",
          300: "#8fe5c1",
          400: "#50e2aa",
          500: "#16db93",
          600: "#17a185",
          700: "#146763",
          800: "#0d4a49",
          900: "#072c2c",
        },
      },
    },
  },
  plugins: [],
};

export default config;
