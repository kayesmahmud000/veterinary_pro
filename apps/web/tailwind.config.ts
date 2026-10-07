import type { Config } from "tailwindcss";

export default {
  content: { relative: true, files: ["./src/**/*.{ts,tsx}"] },
  // Preserve the current native form/heading defaults during this styling migration.
  // Foundations are composed with utilities in src/lib/ui/site.styles.ts.
  corePlugins: { preflight: false, container: false },
  theme: {
    extend: {
      colors: {
        ink: "#183f32",
        muted: "#53655c",
        paper: "#fafbf7",
        line: "#dfe5dc",
        green: "#214e3a",
        amber: "#eac474",
      },
      fontFamily: {
        sans: [
          "Arial",
          "Helvetica",
          "Nirmala UI",
          "Noto Sans Bengali",
          "Vrinda",
          "sans-serif",
        ],
        bengali: [
          "Nirmala UI",
          "Noto Sans Bengali",
          "Vrinda",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
