import { addToast } from "@heroui/react";

export function notifySuccess(title: string, description?: string): void {
  addToast({
    title,
    description,
    color: "success",
    timeout: 6000,
  });
}

export function notifyError(title: string, description?: string): void {
  addToast({
    title,
    description,
    color: "danger",
    timeout: 8000,
  });
}
