import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FBFAF7",
        cream: "#FAF8F5",
        ink: "#1B1A17",
        soft: "#635A4C",
        mute: "#C5BDB1",
        line: "#EDE7DE",
        hair: "#E3DCD1",
        gold: "#A88557",
        sage: "#9AAA92",
        taupe: "#C5B9AD",
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
        eyebrow: "0.28em",
      },
    },
  },
  plugins: [],
} satisfies Config;
