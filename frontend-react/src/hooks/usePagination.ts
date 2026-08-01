import { useState } from 'react';

/** Estado de página + búsqueda compartido por las pantallas de listado paginado
 * (equivalente al `paginaActual`/`f-search` que cada página vieja repetía a mano). */
export function usePagination(limit = 20) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const buscar = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  return { page, setPage, search, buscar, limit };
}
