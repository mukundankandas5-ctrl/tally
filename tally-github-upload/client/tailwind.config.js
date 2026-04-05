/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0F172A",
        mist: "#F4F1EA",
        dune: "#D6C8AF",
        sea: "#0F766E",
        slateblue: "#1E3A5F",
        ember: "#B45309",
      },
      boxShadow: {
        panel: "0 28px 60px rgba(15, 23, 42, 0.12)",
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        rise: "rise 0.5s ease-out",
      },
    },
  },
  plugins: [],
};
