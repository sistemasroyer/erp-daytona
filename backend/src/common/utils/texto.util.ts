/** Pasa a MAYÚSCULAS (con reglas de español: ñ → Ñ, á → Á) los campos de texto indicados.
 * Devuelve una copia; los campos ausentes, null o no-string quedan igual. Se usa en los
 * services (alta, edición e importaciones) para que todo texto libre se guarde en
 * mayúsculas sin importar cómo lo escribió el usuario. Nunca incluir emails, contraseñas,
 * PIN, tokens, URLs ni valores de enum. */
export function aMayusculas<T extends object>(obj: T, campos: readonly (keyof T)[]): T {
  const copia = { ...obj };
  for (const campo of campos) {
    const valor = copia[campo];
    if (typeof valor === 'string') copia[campo] = mayus(valor) as T[keyof T];
  }
  return copia;
}

/** Igual que `aMayusculas` para un solo valor (null/undefined pasan sin cambios). */
export function mayus<V extends string | null | undefined>(valor: V): V {
  return (typeof valor === 'string' ? valor.toLocaleUpperCase('es-PE') : valor) as V;
}
