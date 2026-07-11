import { HeroUIProvider } from "@heroui/react";
import { render as rtlRender, type RenderOptions } from "@testing-library/react";
import type { ReactElement } from "react";

export function render(ui: ReactElement, options?: RenderOptions) {
  return rtlRender(<HeroUIProvider>{ui}</HeroUIProvider>, options);
}

export * from "@testing-library/react";
