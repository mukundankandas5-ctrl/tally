/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        appbg: "#0A0F1E",
        accent: "#3B82F6",
        success: "#22C55E",
        danger: "#EF4444",
      },
      boxShadow: {
        soft: "0 24px 80px rgba(2, 6, 23, 0.42)",
        card: "0 16px 44px rgba(15, 23, 42, 0.12)",
      },
    },
  },
  plugins: [],
};
