import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FCFBF8",
        cream: "#F5F0E8",
        ink: "#1B1A17",
        soft: "#5F5548",
        mute: "#A69A8B",
        line: "#E8DFD2",
        hair: "#D9CEC0",
        gold: "#8B6339",
        sage: "#60775E",
        taupe: "#B9AA99",
      },
      fontFamily: {
        sans: ['"Pretendard"', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        serif: ['"Noto Serif KR"', '"Gowun Batang"', 'Georgia', 'serif'],
        hand: ['"Nanum Pen Script"', 'cursive'],
      },
      maxWidth: {
        app: "480px",
      },
      letterSpacing: {
        eyebrow: "0",
      },
    },
  },
  plugins: [],
} satisfies Config;
