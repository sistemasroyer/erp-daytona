import { useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { Layout, Menu, Dropdown, Avatar, type MenuProps } from 'antd';
import { UserOutlined, LogoutOutlined } from '@ant-design/icons';
import { useAuth } from '@/auth/AuthContext';
import { MENU } from './menu';
import { ICONS } from './icons';

const { Sider, Header, Content } = Layout;

export function AppLayout() {
  const { user, hasPermiso, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const menuItems: MenuProps['items'] = useMemo(() => {
    const items: MenuProps['items'] = [];
    MENU.forEach((group, idx) => {
      const visibles = group.items.filter((it) => !it.perm || hasPermiso(it.perm));
      if (visibles.length === 0) return;

      const children = visibles.map((it) => {
        const Icon = ICONS[it.icon];
        return {
          key: it.href,
          icon: Icon ? <Icon /> : null,
          label: <Link to={it.href}>{it.label}</Link>,
        };
      });

      if (!group.header) {
        items.push(...children);
      } else {
        items.push({ key: `group-${idx}`, label: group.header, type: 'group', children });
      }
    });
    return items;
  }, [hasPermiso]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const userMenuItems: MenuProps['items'] = [
    { key: 'rol', label: user?.roles?.[0] ?? user?.email, disabled: true },
    { type: 'divider' },
    { key: 'logout', label: 'Cerrar sesión', icon: <LogoutOutlined />, onClick: handleLogout },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible collapsed={collapsed} onCollapse={setCollapsed} theme="dark" width={250}
        breakpoint="lg" collapsedWidth={0}
        style={{ position: 'sticky', insetInlineStart: 0, top: 0, height: '100vh', overflow: 'auto', zIndex: 20 }}
      >
        <div style={{ color: '#fff', padding: '16px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden' }}>
          {collapsed ? 'ED' : 'ERP Daytona'}
        </div>
        <Menu theme="dark" mode="inline" selectedKeys={[location.pathname]} items={menuItems} />
      </Sider>
      <Layout>
        <Header style={{ position: 'sticky', top: 0, zIndex: 10, width: '100%', background: '#1677ff', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 24px' }}>
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div style={{ color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar icon={<UserOutlined />} size="small" />
              <span>{user?.nombre || 'Usuario'}</span>
            </div>
          </Dropdown>
        </Header>
        <Content style={{ margin: 16 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
