/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        amz: {
          bg: "#0b0f19",
          panel: "#111827",
          border: "#1f2937",
          accent: "#6366f1",
          accent2: "#22d3ee",
        },
      },
    },
  },
  plugins: [],
};
