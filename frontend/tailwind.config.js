/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        amz: {
          bg: "#0a0e17",
          panel: "#111827",
          panel2: "#161f2e",
          border: "#1f2937",
          accent: "#6366f1",
          accent2: "#22d3ee",
        },
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(99,102,241,0.15), 0 8px 24px -8px rgba(99,102,241,0.25)",
      },
      backgroundImage: {
        "amz-radial": "radial-gradient(circle at top left, rgba(99,102,241,0.12), transparent 45%)",
      },
    },
  },
  plugins: [],
};