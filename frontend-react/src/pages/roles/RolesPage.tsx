import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Card, Button, Typography, Empty, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, SaveOutlined } from '@ant-design/icons';
import { rolesApi } from '@/api/roles';
import { permisosApi } from '@/api/permisos';
import { ApiError } from '@/api/types';
import { RolFormModal } from './RolFormModal';
import { PermisosMatrix } from './PermisosMatrix';
import type { Rol } from '@/types/rol';

export function RolesPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [rolEditando, setRolEditando] = useState<Rol | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [guardando, setGuardando] = useState(false);
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: () => rolesApi.listar({ limit: 100 }),
  });
  const { data: permisosData } = useQuery({
    queryKey: ['permisos'],
    queryFn: () => permisosApi.listar(),
  });

  const roles = rolesData?.data || [];
  const permisos = permisosData?.data || [];
  const rolSeleccionado = roles.find((r) => r.id === selectedId) || null;

  useEffect(() => {
    setSeleccionados(new Set(rolSeleccionado?.permisos.map((rp) => rp.id_permiso) || []));
  }, [rolSeleccionado]);

  const recargarRoles = () => queryClient.invalidateQueries({ queryKey: ['roles'] });

  const guardarPermisos = async () => {
    if (!rolSeleccionado) return;
    setGuardando(true);
    try {
      await rolesApi.asignarPermisos(rolSeleccionado.id, [...seleccionados]);
      message.success('Permisos actualizados correctamente');
      recargarRoles();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : 'Error al guardar los permisos');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div>
      <Row gutter={16}>
        <Col span={8}>
          <Card
            title={<><span>Roles</span></>}
            extra={<Button size="small" icon={<PlusOutlined />} onClick={() => { setRolEditando(null); setModalOpen(true); }} />}
          >
            <div>
              {roles.map((r) => (
                <div
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  style={{
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: r.id === selectedId ? '#e6f4ff' : undefined,
                    borderRadius: 4,
                    borderBottom: '1px solid #f0f0f0',
                  }}
                >
                  <div>
                    <div>{r.nombre}</div>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>{r.descripcion}</Typography.Text>
                  </div>
                  <Button
                    size="small" icon={<EditOutlined />}
                    onClick={(e) => { e.stopPropagation(); setRolEditando(r); setModalOpen(true); }}
                  />
                </div>
              ))}
            </div>
          </Card>
        </Col>

        <Col span={16}>
          <Card
            title={rolSeleccionado ? <>Permisos del rol: <Typography.Text type="secondary">{rolSeleccionado.nombre}</Typography.Text></> : 'Permisos'}
            extra={rolSeleccionado && (
              <Button type="primary" icon={<SaveOutlined />} loading={guardando} onClick={guardarPermisos}>
                Guardar permisos
              </Button>
            )}
          >
            {rolSeleccionado
              ? <PermisosMatrix permisos={permisos} seleccionados={seleccionados} onChange={setSeleccionados} />
              : <Empty description="Seleccione un rol para ver sus permisos" />}
          </Card>
        </Col>
      </Row>

      <RolFormModal
        open={modalOpen}
        rol={rolEditando}
        onClose={() => setModalOpen(false)}
        onSaved={() => { setModalOpen(false); recargarRoles(); }}
      />
    </div>
  );
}
