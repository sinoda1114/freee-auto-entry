"use client";

import { useEffect, useId, useRef, useState, type PointerEvent } from "react";
import { usePathname } from "next/navigation";
import { AiConsultationPanel } from "./AiConsultationPanel";
import {
  clampConsultationPanelSize,
  CONSULTATION_PANEL_CLASS,
  loadConsultationPanelSize,
  saveConsultationPanelSize,
  type ConsultationPanelSize,
  type ConsultationViewMode,
} from "@/lib/ai/consultation-ui";

type ResizeEdge = "left" | "top" | "top-left";

export function AiConsultationWidget({
  companyId,
}: {
  companyId: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ConsultationViewMode>("compact");
  const [panelSize, setPanelSize] = useState<ConsultationPanelSize>(() => {
    if (typeof window === "undefined") {
      return { width: 480, height: 420 };
    }
    return loadConsultationPanelSize();
  });
  const [isResizing, setIsResizing] = useState(false);
  const dragRef = useRef<{
    edge: ResizeEdge;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    pointerId: number;
  } | null>(null);
  const panelId = useId();
  const panelClass = CONSULTATION_PANEL_CLASS[viewMode];
  const isFullscreen = viewMode === "fullscreen";

  useEffect(() => {
    if (!open || isFullscreen) {
      return;
    }
    saveConsultationPanelSize(panelSize);
  }, [open, isFullscreen, panelSize]);

  useEffect(() => {
    function handleResize() {
      setPanelSize((current) => clampConsultationPanelSize(current));
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    function onPointerMove(event: globalThis.PointerEvent) {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      const nextWidth =
        drag.edge === "top" ? drag.startWidth : drag.startWidth - dx;
      const nextHeight =
        drag.edge === "left" ? drag.startHeight : drag.startHeight - dy;
      setPanelSize(
        clampConsultationPanelSize({ width: nextWidth, height: nextHeight }),
      );
    }

    function onPointerUp(event: globalThis.PointerEvent) {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }
      dragRef.current = null;
      setIsResizing(false);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, []);

  if (pathname.startsWith("/ai-consultation")) {
    return null;
  }

  function beginResize(edge: ResizeEdge, event: PointerEvent<HTMLDivElement>) {
    if (isFullscreen) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = {
      edge,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: panelSize.width,
      startHeight: panelSize.height,
      pointerId: event.pointerId,
    };
    setIsResizing(true);
  }

  const shellStyle = isFullscreen
    ? undefined
    : {
        width: panelSize.width,
        height: panelSize.height,
        maxWidth: "calc(100vw - 2rem)",
        maxHeight: "calc(100dvh - 6rem)",
      };

  return (
    <>
      {open ? (
        <div
          data-testid="ai-consultation-shell"
          className={`fixed z-50 flex flex-col ${
            isResizing ? "" : "transition-[width,height] duration-200 ease-out"
          } ${isFullscreen ? panelClass.shell : "bottom-20 right-4"}`}
          style={shellStyle}
        >
          {!isFullscreen ? (
            <>
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="幅を変更"
                title="左右にドラッグして幅を変更"
                className="absolute inset-y-2 left-0 z-10 w-3 -translate-x-1/2 cursor-ew-resize touch-none"
                onPointerDown={(event) => beginResize("left", event)}
              />
              <div
                role="separator"
                aria-orientation="horizontal"
                aria-label="高さを変更"
                title="上下にドラッグして高さを変更"
                className="absolute inset-x-2 top-0 z-10 h-3 -translate-y-1/2 cursor-ns-resize touch-none"
                onPointerDown={(event) => beginResize("top", event)}
              />
              <div
                role="separator"
                aria-label="大きさを変更"
                title="ドラッグして大きさを変更"
                className="absolute top-0 left-0 z-20 size-4 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize touch-none"
                onPointerDown={(event) => beginResize("top-left", event)}
              />
            </>
          ) : null}
          <AiConsultationPanel
            companyId={companyId}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onClose={() => setOpen(false)}
            autoFocusQuestion
            panelId={panelId}
            shellClassName="h-full"
            bodyClassName={panelClass.body}
          />
        </div>
      ) : null}

      <button
        type="button"
        aria-label={open ? "AI相談を閉じる" : "AIに相談する"}
        aria-expanded={open}
        aria-controls={panelId}
        className="fixed bottom-4 right-4 z-50 flex h-12 w-[7.5rem] items-center justify-center rounded-full bg-gradient-to-r from-[var(--freee-hero-from)] to-[var(--freee-hero-to)] text-sm font-bold text-white shadow-lg transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--freee-blue)] focus-visible:ring-offset-2 sm:h-14 sm:w-40 sm:text-lg"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "閉じる" : "AIに相談"}
      </button>
    </>
  );
}
