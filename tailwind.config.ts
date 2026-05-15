import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FAF8F5",
        gold: "#B8956A",
        sage: "#A8B5A0",
        taupe: "#C5B9AD",
        ink: "#3A3A3A",
        soft: "#6B6B6B",
        line: "#E8E2DC",
      },
      fontFamily: {
        sans: ['"Pretendard"', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        serif: ['"Noto Serif KR"', '"Gowun Batang"', 'Georgia', 'serif'],
        hand: ['"Nanum Pen Script"', 'cursive'],
      },
      maxWidth: {
        app: "480px",
      },
    },
  },
  plugins: [],
} satisfies Config;
