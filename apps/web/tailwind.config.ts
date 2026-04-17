import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f5f7ff",
          200: "#c7cdff",
          500: "#5b6cff",
          600: "#4a5ae6",
          700: "#3a48bf",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
