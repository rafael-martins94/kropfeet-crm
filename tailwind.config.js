/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#F1F6FA",
          100: "#DCE8F0",
          200: "#B2CCDB",
          300: "#7FA6BE",
          400: "#4B7F9F",
          500: "#1E5C7C",
          600: "#0B3F5C",
          700: "#082C40",
          800: "#061F2E",
          900: "#04141F",
        },
        accent: {
          50: "#F5FAE7",
          100: "#E7F1C5",
          200: "#D3E598",
          300: "#B7D36B",
          400: "#9EBE4F",
          500: "#80A339",
          600: "#62822B",
          700: "#4A6322",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          muted: "#F8FAF7",
          subtle: "#F1F5F9",
        },
        ink: {
          DEFAULT: "#1F2937",
          muted: "#4B5563",
          soft: "#6B7280",
          faint: "#9CA3AF",
        },
        line: "#E5E7EB",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        display: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        numeric: [
          "\"Plus Jakarta Sans\"",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 2px 8px rgba(15, 23, 42, 0.04)",
        "card-hover": "0 2px 4px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.08)",
        elevated: "0 12px 32px rgba(8, 44, 64, 0.12)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(135deg, #0B3F5C 0%, #082C40 55%, #04141F 100%)",
        "brand-soft":
          "radial-gradient(1000px 500px at 10% 0%, rgba(183,211,107,0.12) 0%, transparent 60%), radial-gradient(900px 500px at 110% 110%, rgba(11,63,92,0.18) 0%, transparent 60%)",
      },
    },
  },
  plugins: [],
};
