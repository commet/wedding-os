import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F7F2E8",
        cream: "#ECE1D0",
        ink: "#241F22",
        soft: "#63574E",
        mute: "#948470",
        line: "#D8C8B3",
        hair: "#C8B49A",
        gold: "#94663F",
        sage: "#566D5E",
        taupe: "#AE987C",
        vellum: "#FFFDF6",
        blush: "#B66D70",
        dusk: "#2E2830",
        plum: "#4D3040",
        mist: "#E2E8DD",
        shell: "#F1E9DC",
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
