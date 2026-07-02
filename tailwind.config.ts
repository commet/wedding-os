import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F8F4EC",
        cream: "#EFE6D8",
        ink: "#241F1B",
        soft: "#675A4D",
        mute: "#9A8B78",
        line: "#DED0BD",
        hair: "#CDBBA3",
        gold: "#A06B3D",
        sage: "#647764",
        taupe: "#B7A48C",
        vellum: "#FFFDF7",
        blush: "#C18377",
        dusk: "#332B31",
        plum: "#4A3038",
        mist: "#E9ECE3",
        shell: "#F4EEE4",
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
