import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { parseBackendError } from "@/lib/parseBackendError";
import { platform } from "@tauri-apps/plugin-os";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const handleApiError = async (response: Response): Promise<never> => {
  const parsed = await parseBackendError(response);
  throw parsed;
};

export const isMac = platform() === "macos";