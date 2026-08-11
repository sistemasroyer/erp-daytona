import { Alert, Button, Space } from 'antd';
import dayjs from 'dayjs';
import type { BorradorGuardado } from '@/hooks/useBorrador';

interface Props<T> {
  borradores: BorradorGuardado<T>[];
  resumen: (datos: T) => string;
  onRestaurar: (borrador: BorradorGuardado<T>) => void;
  onDescartar: (clave: string) => void;
}

export function BorradorBanner<T>({ borradores, resumen, onRestaurar, onDescartar }: Props<T>) {
  if (borradores.length === 0) return null;

  return (
    <Alert
      type="warning"
      showIcon
      style={{ marginBottom: 16 }}
      message={borradores.length === 1 ? 'Tenés un borrador sin terminar' : `Tenés ${borradores.length} borradores sin terminar`}
      description={
        <Space orientation="vertical" style={{ width: '100%' }}>
          {borradores.map((b) => (
            <div key={b.clave} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <span>
                {dayjs(b.fecha).format('DD/MM/YYYY HH:mm')} — {resumen(b.datos)}
              </span>
              <Space size="small">
                <Button size="small" type="primary" onClick={() => onRestaurar(b)}>Recuperar</Button>
                <Button size="small" onClick={() => onDescartar(b.clave)}>Descartar</Button>
              </Space>
            </div>
          ))}
        </Space>
      }
    />
  );
}
