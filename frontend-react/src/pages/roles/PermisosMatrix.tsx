import { Checkbox, Typography, Button, Row, Col, Divider } from 'antd';
import { ACCIONES, type Permiso } from '@/types/permiso';

interface Props {
  permisos: Permiso[];
  seleccionados: Set<string>;
  onChange: (seleccionados: Set<string>) => void;
}

const ETIQUETAS: Record<string, string> = {
  ver: 'ver', crear: 'crear', editar: 'editar', eliminar: 'eliminar', aprobar: 'aprobar', anular: 'anular',
};

export function PermisosMatrix({ permisos, seleccionados, onChange }: Props) {
  const porModulo = new Map<string, Permiso[]>();
  permisos.forEach((p) => {
    if (!porModulo.has(p.modulo)) porModulo.set(p.modulo, []);
    porModulo.get(p.modulo)!.push(p);
  });

  const toggle = (id: string, checked: boolean) => {
    const next = new Set(seleccionados);
    if (checked) next.add(id); else next.delete(id);
    onChange(next);
  };

  const toggleModulo = (perms: Permiso[]) => {
    const todosMarcados = perms.every((p) => seleccionados.has(p.id));
    const next = new Set(seleccionados);
    perms.forEach((p) => (todosMarcados ? next.delete(p.id) : next.add(p.id)));
    onChange(next);
  };

  return (
    <div>
      {[...porModulo.entries()].map(([modulo, perms]) => (
        <div key={modulo} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Typography.Text strong style={{ textTransform: 'capitalize' }}>
              {modulo.replace(/_/g, ' ')}
            </Typography.Text>
            <Button type="link" size="small" onClick={() => toggleModulo(perms)}>Todos</Button>
          </div>
          <Row gutter={[8, 8]}>
            {ACCIONES.map((accion) => {
              const perm = perms.find((p) => p.accion === accion);
              if (!perm) return null;
              return (
                <Col key={accion}>
                  <Checkbox
                    checked={seleccionados.has(perm.id)}
                    onChange={(e) => toggle(perm.id, e.target.checked)}
                  >
                    {ETIQUETAS[accion] || accion}
                  </Checkbox>
                </Col>
              );
            })}
          </Row>
          <Divider style={{ margin: '12px 0 0' }} />
        </div>
      ))}
    </div>
  );
}
