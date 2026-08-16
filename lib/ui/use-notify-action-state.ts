"use client";

import { useEffect, useRef } from "react";
import { notifyError, notifySuccess } from "./notify";

export function useNotifyActionState(
  state: { status: string; message?: string },
  successTitle = "完了しました",
): void {
  const previous = useRef(state);

  useEffect(() => {
    if (state === previous.current) return;
    previous.current = state;

    if (state.status === "success" || state.status === "done") {
      notifySuccess(successTitle, state.message);
    } else if (state.status === "error") {
      notifyError("失敗しました", state.message);
    }
  }, [state, successTitle]);
}
