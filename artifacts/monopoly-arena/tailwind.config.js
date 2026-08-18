/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(39, 44%, 94%)",
        foreground: "hsl(248, 25%, 17%)",
        border: "hsl(35, 25%, 84%)",
        input: "hsl(35, 22%, 82%)",
        ring: "hsl(12, 76%, 56%)",
        card: {
          DEFAULT: "hsl(39, 50%, 98%)",
          foreground: "hsl(248, 25%, 17%)",
          border: "hsl(35, 25%, 84%)",
        },
        popover: {
          DEFAULT: "hsl(39, 50%, 98%)",
          foreground: "hsl(248, 25%, 17%)",
          border: "hsl(35, 25%, 84%)",
        },
        primary: {
          DEFAULT: "hsl(12, 76%, 56%)",
          foreground: "hsl(40, 44%, 98%)",
        },
        secondary: {
          DEFAULT: "hsl(45, 62%, 75%)",
          foreground: "hsl(248, 25%, 17%)",
        },
        muted: {
          DEFAULT: "hsl(36, 28%, 89%)",
          foreground: "hsl(248, 12%, 45%)",
        },
        accent: {
          DEFAULT: "hsl(167, 32%, 35%)",
          foreground: "hsl(40, 44%, 98%)",
        },
        destructive: {
          DEFAULT: "hsl(0, 65%, 50%)",
          foreground: "hsl(40, 44%, 98%)",
        },
        sidebar: {
          DEFAULT: "hsl(247, 28%, 16%)",
          foreground: "hsl(39, 38%, 93%)",
          border: "hsl(247, 20%, 25%)",
          primary: {
            DEFAULT: "hsl(12, 76%, 56%)",
            foreground: "hsl(40, 44%, 98%)",
          },
          accent: {
            DEFAULT: "hsl(247, 20%, 23%)",
            foreground: "hsl(39, 38%, 93%)",
          },
          ring: "hsl(12, 76%, 56%)",
        },
      },
      fontFamily: {
        sans: ["var(--app-font-sans)", "sans-serif"],
        serif: ["var(--app-font-serif)", "serif"],
        mono: ["var(--app-font-mono)", "monospace"],
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        sm: "calc(0.5rem - 4px)",
        md: "calc(0.5rem - 2px)",
        lg: "0.5rem",
        xl: "calc(0.5rem + 4px)",
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}