/**
 * South African phone numbers. Accepts what people type ("082 123 4567",
 * "0821234567", "+27 82 123 4567", "27821234567") and returns E.164
 * ("+27821234567"), or null if it isn't a valid SA number.
 */
export function normaliseSaPhone(input: string): string | null {
  const trimmed = input.trim();
  if (!/^[+\d\s()\-.]+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, "");
  let subscriber: string;
  if (trimmed.startsWith("+")) {
    if (!digits.startsWith("27")) return null;
    subscriber = digits.slice(2);
  } else if (digits.startsWith("27") && digits.length === 11) {
    subscriber = digits.slice(2);
  } else if (digits.startsWith("0")) {
    subscriber = digits.slice(1);
  } else {
    return null;
  }
  return /^[1-8]\d{8}$/.test(subscriber) ? `+27${subscriber}` : null;
}

/** "+27821234567" -> "0821234567" */
export function nationalForm(e164: string): string {
  return `0${e164.slice(3)}`;
}

/** Digits a person typed while searching, in national form where we can tell ("+27 82…" -> "082…"). */
export function searchDigits(input: string): string {
  const digits = input.replace(/\D/g, "");
  return input.trim().startsWith("+27") || (digits.startsWith("27") && digits.length >= 4) ? `0${digits.slice(2)}` : digits;
}
