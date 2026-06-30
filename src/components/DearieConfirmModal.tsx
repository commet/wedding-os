import Modal from "./Modal";
import { AgentIdentity } from "./AgentIdentity";

type Props = {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "normal" | "warn";
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
};

export default function DearieConfirmModal({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = "아직 아니에요",
  tone = "normal",
  onConfirm,
  onClose,
}: Props) {
  const confirm = async () => {
    await onConfirm();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-5">
        <div className="flex gap-3 border-y border-hair py-4">
          <AgentIdentity compact mood={tone === "warn" ? "watching" : "ready"} />
          <p className="min-w-0 flex-1 whitespace-pre-line text-[14px] leading-[1.75] text-soft">
            {body}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" className="btn-secondary py-3 text-[12px]" onClick={onClose}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn-primary py-3 text-[12px] ${tone === "warn" ? "bg-gold" : ""}`}
            onClick={confirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
