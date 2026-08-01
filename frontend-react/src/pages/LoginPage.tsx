import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Card, Form, Input, Alert, Typography } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '@/auth/AuthContext';
import { ApiError } from '@/api/types';

const schema = z.object({
  email: z.string().min(1, 'Ingrese su email').email('Email inválido'),
  password: z.string().min(1, 'Ingrese su contraseña'),
});
type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  if (user) {
    const from = (location.state as { from?: Location })?.from?.pathname || '/';
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (values: FormValues) => {
    setError(null);
    setLoading(true);
    try {
      await login(values);
      const from = (location.state as { from?: Location })?.from?.pathname || '/';
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
      <Card style={{ width: 380 }}>
        <Typography.Title level={3} style={{ textAlign: 'center', marginBottom: 24 }}>
          ERP Daytona
        </Typography.Title>

        {error && <Alert type="error" title={error} showIcon style={{ marginBottom: 16 }} />}

        <Form layout="vertical" onFinish={handleSubmit(onSubmit)}>
          <Form.Item label="Email" validateStatus={errors.email ? 'error' : ''} help={errors.email?.message}>
            <Controller
              name="email"
              control={control}
              render={({ field }) => <Input {...field} prefix={<UserOutlined />} placeholder="usuario@empresa.pe" autoFocus />}
            />
          </Form.Item>

          <Form.Item label="Contraseña" validateStatus={errors.password ? 'error' : ''} help={errors.password?.message}>
            <Controller
              name="password"
              control={control}
              render={({ field }) => <Input.Password {...field} prefix={<LockOutlined />} placeholder="••••••••" />}
            />
          </Form.Item>

          <Button type="primary" htmlType="submit" block loading={loading}>
            Iniciar sesión
          </Button>
        </Form>
      </Card>
    </div>
  );
}
