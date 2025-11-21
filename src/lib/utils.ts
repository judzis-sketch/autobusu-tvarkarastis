import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Removes diacritics from a string by converting it to its decomposed form
 * and removing the combining marks.
 * @param text The input string.
 * @returns The string without diacritics.
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
