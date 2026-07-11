import { heroui } from "@heroui/react";

const FREEE_BLUE = "#2864F0";

const sharedLayout = {
  radius: {
    small: "4px",
    medium: "6px",
    large: "8px",
  },
  fontSize: {
    tiny: "0.6875rem",
    small: "0.8125rem",
    medium: "0.875rem",
    large: "1rem",
  },
  lineHeight: {
    tiny: "1rem",
    small: "1.25rem",
    medium: "1.375rem",
    large: "1.5rem",
  },
};

export default heroui({
  themes: {
    light: {
      colors: {
        background: "#F5F7FA",
        foreground: "#333333",
        primary: {
          50: "#eef3fe",
          100: "#d9e5fd",
          200: "#b3cbfb",
          300: "#8db1f9",
          400: "#6797f7",
          500: FREEE_BLUE,
          600: "#2050c0",
          700: "#183c90",
          800: "#102860",
          900: "#081430",
          DEFAULT: FREEE_BLUE,
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "#EBEEF2",
          foreground: "#333333",
        },
        focus: FREEE_BLUE,
        content1: "#FFFFFF",
        content2: "#F5F7FA",
        content3: "#EBEEF2",
        content4: "#E2E6EB",
        default: {
          50: "#FAFAFA",
          100: "#F5F5F5",
          200: "#EBEBEB",
          300: "#DCDCDC",
          400: "#B8B8B8",
          500: "#999999",
          600: "#666666",
          700: "#4D4D4D",
          800: "#333333",
          900: "#1A1A1A",
          DEFAULT: "#EBEBEB",
          foreground: "#333333",
        },
        success: {
          DEFAULT: "#00A854",
          foreground: "#ffffff",
        },
        warning: {
          DEFAULT: "#F5A623",
          foreground: "#1A1A1A",
        },
        danger: {
          DEFAULT: "#E53935",
          foreground: "#ffffff",
        },
      },
      layout: sharedLayout,
    },
    dark: {
      colors: {
        background: "#0F1419",
        foreground: "#E8EAED",
        primary: {
          50: "#0d1a33",
          100: "#142952",
          200: "#1c3870",
          300: "#254890",
          400: "#3d6fd4",
          500: "#5B8DF7",
          600: "#7BA4F9",
          700: "#9BBBFB",
          800: "#BDD2FD",
          900: "#E0EAFE",
          DEFAULT: "#5B8DF7",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "#2D3A4D",
          foreground: "#E8EAED",
        },
        focus: "#5B8DF7",
        content1: "#1A2332",
        content2: "#0F1419",
        content3: "#243044",
        content4: "#2D3A4D",
        default: {
          50: "#1A2332",
          100: "#243044",
          200: "#2D3A4D",
          300: "#3D4D63",
          400: "#5C6B80",
          500: "#7A8799",
          600: "#9AA0A6",
          700: "#B8BEC5",
          800: "#D4D8DD",
          900: "#E8EAED",
          DEFAULT: "#2D3A4D",
          foreground: "#E8EAED",
        },
        success: {
          DEFAULT: "#34C759",
          foreground: "#0F1419",
        },
        warning: {
          DEFAULT: "#FFB020",
          foreground: "#0F1419",
        },
        danger: {
          DEFAULT: "#FF5252",
          foreground: "#ffffff",
        },
      },
      layout: sharedLayout,
    },
  },
});
