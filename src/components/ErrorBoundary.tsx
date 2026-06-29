import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * 렌더 중 예외가 나도 흰 화면 대신 복구 가능한 안내를 보여준다.
 * 데이터는 localStorage 에 그대로 있으므로 새로고침/홈이동으로 대부분 회복된다.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 운영자 서버로는 보내지 않는다(프라이버시) — 콘솔에만 남긴다.
    console.error("Dearie render error:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="agent-canvas min-h-screen max-w-app mx-auto px-6 pt-24 pb-12">
        <div className="eyebrow-gold mb-4">잠시 문제가 생겼어요</div>
        <h1 className="font-serif text-[26px] leading-[1.4] tracking-[-0.005em] text-ink break-keep">
          화면을 그리는 중 오류가 났어요.
        </h1>
        <p className="mt-4 max-w-[20rem] text-[15px] leading-[1.85] text-soft">
          입력하신 내용은 이 기기에 그대로 저장돼 있어요. 새로고침하거나 홈으로 돌아가면 대부분 다시 열립니다.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-9 min-h-[52px] w-full rounded-none bg-ink px-6 text-[13px] font-medium tracking-[0.04em] text-paper transition active:opacity-85"
        >
          새로고침 →
        </button>
        <a
          href="/dashboard"
          className="mt-4 block text-center min-h-11 text-[13px] text-soft underline underline-offset-4"
        >
          홈으로 돌아가기
        </a>
      </div>
    );
  }
}
