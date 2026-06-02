/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Pretendard", "system-ui", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
      boxShadow: {
        soft: "0 12px 30px -20px rgba(15, 23, 42, 0.45)",
      },
    },
  },
  plugins: [],
};

