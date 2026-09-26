import { useEffect, useId, useRef, useState } from 'react';
import { Input, Spin } from 'antd';

interface Props<T> {
  placeholder?: string;
  /** Fuerza el texto mostrado (p.ej. tras una selección hecha fuera del componente,
   * como al importar un XML). Sin esta prop el input se maneja de forma no controlada. */
  value?: string;
  buscar: (query: string) => Promise<T[]>;
  renderOpcion: (item: T) => React.ReactNode;
  getLabel: (item: T) => string;
  onSelect: (item: T) => void;
  minLength?: number;
  debounceMs?: number;
}

/** Buscador con debounce + dropdown de resultados bajo el input. Reemplaza el patrón que
 * se repetía a mano (setTimeout + fetch + lista posicionada absoluta) en varias pantallas
 * de la app vieja (búsqueda de cliente en ventas, de producto en inventario/kardex/ajustes,
 * de proveedor en órdenes de compra). */
export function Autocomplete<T>({
  placeholder, value, buscar, renderOpcion, getLabel, onSelect, minLength = 2, debounceMs = 300,
}: Props<T>) {
  const [texto, setTexto] = useState(value ?? '');
  const [resultados, setResultados] = useState<T[]>([]);
  const [mostrar, setMostrar] = useState(false);
  const [cargando, setCargando] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const versionRef = useRef(0);
  const [activo, setActivo] = useState(-1);
  const listaId = useId();
  const cerrar = () => {
    versionRef.current++;
    if (timerRef.current) clearTimeout(timerRef.current);
    setCargando(false);
    setMostrar(false);
  };
  useEffect(() => () => {
    versionRef.current++;
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);
  useEffect(() => {
    if (mostrar && activo >= 0) document.getElementById(`${listaId}-${activo}`)?.scrollIntoView({ block: 'nearest' });
  }, [activo, mostrar, listaId]);

  useEffect(() => {
    if (value !== undefined && value !== texto) setTexto(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    const handleClickFuera = (e: MouseEvent) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) cerrar();
    };
    document.addEventListener('click', handleClickFuera);
    return () => document.removeEventListener('click', handleClickFuera);
  }, []);

  const handleChange = (value: string) => {
    const version = ++versionRef.current;
    setActivo(-1);
    setResultados([]);
    setMostrar(false);
    setCargando(false);
    setTexto(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (value.trim().length < minLength) { setResultados([]); setMostrar(false); return; }
    timerRef.current = setTimeout(async () => {
      setCargando(true);
      try {
        const items = await buscar(value.trim());
        if (version !== versionRef.current) return;
        setResultados(items);
        setMostrar(true);
      } catch {
        if (version === versionRef.current) setResultados([]);
      } finally {
        if (version === versionRef.current) setCargando(false);
      }
    }, debounceMs);
  };

  const seleccionar = (item: T) => {
    setTexto(getLabel(item));
    cerrar();
    onSelect(item);
  };

  return (
    <div ref={contenedorRef} style={{ position: 'relative' }}>
      <Input
        placeholder={placeholder}
        value={texto}
        onChange={(e) => handleChange(e.target.value)}
        suffix={<Spin size="small" style={{ visibility: cargando ? 'visible' : 'hidden' }} />}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={mostrar && resultados.length > 0}
        aria-controls={mostrar ? listaId : undefined}
        aria-activedescendant={mostrar && activo >= 0 ? `${listaId}-${activo}` : undefined}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === 'Escape' || e.key === 'Tab') { cerrar(); return; }
          if (!resultados.length || !['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) return;
          e.preventDefault();
          e.stopPropagation();
          if (e.key === 'Enter') {
            if (mostrar && !e.repeat) seleccionar(resultados[activo < 0 ? 0 : activo]);
          } else {
            setMostrar(true);
            setActivo((prev) => prev < 0 ? (e.key === 'ArrowDown' ? 0 : resultados.length - 1) : (prev + (e.key === 'ArrowDown' ? 1 : -1) + resultados.length) % resultados.length);
          }
        }}
      />
      {mostrar && resultados.length > 0 && (
        <div id={listaId} role="listbox" style={{
          position: 'absolute', zIndex: 1060, width: '100%', maxHeight: 240, overflowY: 'auto',
          background: '#fff', border: '1px solid #d9d9d9', borderRadius: 6, marginTop: 4,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}>
          {resultados.map((item, i) => (
            <div
              key={i}
              id={`${listaId}-${i}`}
              role="option"
              aria-selected={activo === i}
              className="autocomplete-opcion"
              onClick={() => seleccionar(item)}
              onMouseDown={(e) => e.preventDefault()}
              style={{ padding: '8px 12px', cursor: 'pointer', background: activo === i ? '#e6f4ff' : '#fff', borderBottom: i < resultados.length - 1 ? '1px solid #f0f0f0' : undefined }}
              onMouseEnter={() => setActivo(i)}
            >
              {renderOpcion(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
