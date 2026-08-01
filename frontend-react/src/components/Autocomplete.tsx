import { useEffect, useRef, useState } from 'react';
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

  useEffect(() => {
    if (value !== undefined && value !== texto) setTexto(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    const handleClickFuera = (e: MouseEvent) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) setMostrar(false);
    };
    document.addEventListener('click', handleClickFuera);
    return () => document.removeEventListener('click', handleClickFuera);
  }, []);

  const handleChange = (value: string) => {
    setTexto(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (value.trim().length < minLength) { setResultados([]); setMostrar(false); return; }
    timerRef.current = setTimeout(async () => {
      setCargando(true);
      try {
        const items = await buscar(value.trim());
        setResultados(items);
        setMostrar(true);
      } catch {
        setResultados([]);
      } finally {
        setCargando(false);
      }
    }, debounceMs);
  };

  const seleccionar = (item: T) => {
    setTexto(getLabel(item));
    setMostrar(false);
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
      />
      {mostrar && resultados.length > 0 && (
        <div style={{
          position: 'absolute', zIndex: 1060, width: '100%', maxHeight: 240, overflowY: 'auto',
          background: '#fff', border: '1px solid #d9d9d9', borderRadius: 6, marginTop: 4,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}>
          {resultados.map((item, i) => (
            <div
              key={i}
              className="autocomplete-opcion"
              onClick={() => seleccionar(item)}
              style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: i < resultados.length - 1 ? '1px solid #f0f0f0' : undefined }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
            >
              {renderOpcion(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
