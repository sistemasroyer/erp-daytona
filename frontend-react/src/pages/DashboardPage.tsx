import { Typography } from 'antd';
import { useAuth } from '@/auth/AuthContext';

export function DashboardPage() {
  const { user } = useAuth();
  return (
    <div>
      <Typography.Title level={3}>Bienvenido, {user?.nombre}</Typography.Title>
    </div>
  );
}
