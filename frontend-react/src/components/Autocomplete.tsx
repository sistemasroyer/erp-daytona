import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  /** Ancho mínimo de la lista de resultados (px), aunque el buscador sea más angosto. */
  anchoMinimo?: number;
}

/** Buscador con debounce + dropdown de resultados bajo el input. Reemplaza el patrón que
 * se repetía a mano (setTimeout + fetch + lista posicionada absoluta) en varias pantallas
 * de la app vieja (búsqueda de cliente en ventas, de producto en inventario/kardex/ajustes,
 * de proveedor en órdenes de compra). */
export function Autocomplete<T>({
  placeholder, value, buscar, renderOpcion, getLabel, onSelect, minLength = 2, debounceMs = 300, anchoMinimo = 0,
}: Props<T>) {
  const [texto, setTexto] = useState(value ?? '');
  const [resultados, setResultados] = useState<T[]>([]);
  const [mostrar, setMostrar] = useState(false);
  const [cargando, setCargando] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
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
      const objetivo = e.target as Node;
      if (contenedorRef.current?.contains(objetivo) || listaRef.current?.contains(objetivo)) return;
      cerrar();
    };
    document.addEventListener('click', handleClickFuera);
    return () => document.removeEventListener('click', handleClickFuera);
  }, []);

  // La lista se dibuja en un portal con posición fija: así no la recorta el contenedor donde
  // está el buscador (cabecera de una Card, un modal con scroll) y puede ser más ancha que él,
  // para que los nombres largos se lean completos.
  const abierta = mostrar && resultados.length > 0;
  useLayoutEffect(() => {
    if (!abierta) { setPos(null); return; }
    const actualizar = () => {
      const r = contenedorRef.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.min(Math.max(r.width, anchoMinimo), window.innerWidth - 16);
      const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
      const top = r.bottom + 4;
      setPos({ top, left, width, maxHeight: Math.max(200, Math.min(400, window.innerHeight - top - 8)) });
    };
    actualizar();
    window.addEventListener('scroll', actualizar, true);
    window.addEventListener('resize', actualizar);
    return () => {
      window.removeEventListener('scroll', actualizar, true);
      window.removeEventListener('resize', actualizar);
    };
  }, [abierta, anchoMinimo]);

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
      {abierta && pos && createPortal(
        <div ref={listaRef} id={listaId} role="listbox" style={{
          position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 1060, maxHeight: pos.maxHeight, overflowY: 'auto',
          background: '#fff', border: '1px solid #d9d9d9', borderRadius: 8,
          boxShadow: '0 6px 16px rgba(0,0,0,0.15)', whiteSpace: 'normal', overflowWrap: 'anywhere',
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
        </div>,
        document.body,
      )}
    </div>
  );
}
