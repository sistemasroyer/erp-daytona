import { Typography } from 'antd';
import { useAuth } from '@/auth/AuthContext';

// Placeholder de la Fase 0 (fundación). El dashboard real con KPIs de
// ventas/compras/stock (equivalente a frontend/src/pages/dashboard.html)
// se construye en la Fase 1 del plan de migración.
export function DashboardPage() {
  const { user } = useAuth();
  return (
    <div>
      <Typography.Title level={3}>Bienvenido, {user?.nombre}</Typography.Title>
      <Typography.Paragraph>
        Fundación del nuevo frontend en React funcionando: sesión, permisos y layout activos.
      </Typography.Paragraph>
    </div>
  );
}
