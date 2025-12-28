/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cortex: {
          50: "#f0f7ff",
          100: "#e0effe",
          200: "#b9dffc",
          300: "#7cc5fa",
          400: "#36a8f5",
          500: "#0c8ce6",
          600: "#006fc4",
          700: "#0159a0",
          800: "#064b84",
          900: "#0b3f6d",
          950: "#072848",
        },
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        flow: "flow 2s ease-in-out infinite",
      },
      keyframes: {
        flow: {
          "0%, 100%": { opacity: "0.3" },
          "50%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
