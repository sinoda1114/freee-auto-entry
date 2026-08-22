"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  clampConsultationFontSize,
  CONSULTATION_FONT_SIZE_MAX,
  CONSULTATION_FONT_SIZE_MIN,
} from "@/lib/ai/consultation-ui";

interface ConsultationFontSizeControlProps {
  fontSize: number;
  onFontSizeChange: (fontSize: number | ((prev: number) => number)) => void;
  actionClassName: string;
}

export function ConsultationFontSizeControl({
  fontSize,
  onFontSizeChange,
  actionClassName,
}: ConsultationFontSizeControlProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    const element = rootRef.current;
    if (!element) {
      return;
    }
    function handleWheel(event: globalThis.WheelEvent) {
      if (Math.abs(event.deltaY) < 1) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      onFontSizeChange((prev) => prev + (event.deltaY < 0 ? 1 : -1));
    }
    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => element.removeEventListener("wheel", handleWheel);
  }, [onFontSizeChange]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={actionClassName}
        aria-label={`文字サイズ ${fontSize}ピクセル。クリックで調整`}
        aria-expanded={open}
        aria-controls={panelId}
        title="文字サイズ（ホイールでも変更）"
        onClick={() => setOpen((value) => !value)}
      >
        Aa
      </button>
      {open ? (
        <div
          id={panelId}
          role="group"
          aria-label="文字サイズ調整"
          className="absolute top-full right-0 z-20 mt-1 flex flex-col items-center gap-1 rounded-lg border border-[var(--freee-border)] bg-[var(--freee-surface)] px-2.5 py-2 shadow-lg"
        >
          <span className="text-[10px] font-semibold text-[var(--freee-text-muted)]">
            大
          </span>
          <input
            type="range"
            min={CONSULTATION_FONT_SIZE_MIN}
            max={CONSULTATION_FONT_SIZE_MAX}
            step={1}
            value={fontSize}
            aria-label="文字サイズ"
            aria-valuetext={`${fontSize}ピクセル`}
            onChange={(event) =>
              onFontSizeChange(
                clampConsultationFontSize(Number(event.target.value)),
              )
            }
            className="h-28 w-5 cursor-ns-resize accent-[var(--freee-blue)] [writing-mode:vertical-lr] [direction:rtl]"
          />
          <span className="text-[10px] font-semibold text-[var(--freee-text-muted)]">
            小
          </span>
          <span className="text-[10px] tabular-nums text-[var(--freee-text-muted)]">
            {fontSize}px
          </span>
        </div>
      ) : null}
    </div>
  );
}
