/** Lee el número escrito a mano en un campo de cantidad del catálogo.
 *  `value` es `null` cuando el campo quedó vacío o no es un número válido
 *  (en ese caso el llamador solo restaura el valor actual). */
export function parseQuantityInput(event: Event): {
  input: HTMLInputElement;
  value: number | null;
} {
  const input = event.target as HTMLInputElement;
  const n = Math.floor(Number(input.value));
  const valid = input.value.trim() !== '' && Number.isFinite(n) && n >= 0;
  return { input, value: valid ? n : null };
}
