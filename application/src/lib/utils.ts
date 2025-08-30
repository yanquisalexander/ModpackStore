import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { ApiErrorPayload, ApiErrorDetail } from "@/types/ApiResponses";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const handleApiError = async (response: Response): Promise<never> => {
  let errorMessage = "Error desconocido";

  try {
    const errorData: ApiErrorPayload = await response.json();

    if (errorData.errors && errorData.errors.length > 0) {
      // Usar el primer error del array
      const firstError: ApiErrorDetail = errorData.errors[0];
      errorMessage = firstError.detail || firstError.title || `Error ${firstError.status}: ${firstError.code}`;
    }
  } catch (parseError) {
    // Si no se puede parsear como JSON, usar el mensaje de HTTP
    errorMessage = `Error ${response.status}: ${response.statusText}`;
  }

  throw new Error(errorMessage);
};