import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { Layout, Menu, Dropdown, Avatar, Button, Drawer, Grid, type MenuProps } from 'antd';
import { UserOutlined, LogoutOutlined, MenuOutlined } from '@ant-design/icons';
import { useAuth } from '@/auth/AuthContext';
import { MENU } from './menu';
import { ICONS } from './icons';

const { Sider, Header, Content } = Layout;

export function AppLayout() {
  const { user, hasPermiso, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerAbierto, setDrawerAbierto] = useState(false);
  const screens = Grid.useBreakpoint();
  const esMobile = !screens.lg;

  useEffect(() => {
    setDrawerAbierto(false);
  }, [location.pathname]);

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

  const menuNav = <Menu theme="dark" mode="inline" selectedKeys={[location.pathname]} items={menuItems} />;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {!esMobile && (
        <Sider
          collapsible collapsed={collapsed} onCollapse={setCollapsed} theme="dark" width={250}
          style={{ position: 'sticky', insetInlineStart: 0, top: 0, height: '100vh', overflow: 'auto' }}
        >
          <div style={{ color: '#fff', padding: '16px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden' }}>
            {collapsed ? 'ED' : 'ERP Daytona'}
          </div>
          {menuNav}
        </Sider>
      )}
      <Layout>
        <Header style={{ position: 'sticky', top: 0, zIndex: 10, width: '100%', background: '#1677ff', display: 'flex', alignItems: 'center', justifyContent: esMobile ? 'space-between' : 'flex-end', padding: '0 16px' }}>
          {esMobile && (
            <Button type="text" icon={<MenuOutlined style={{ color: '#fff' }} />} onClick={() => setDrawerAbierto(true)} />
          )}
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div style={{ color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar icon={<UserOutlined />} size="small" />
              <span>{user?.nombre || 'Usuario'}</span>
            </div>
          </Dropdown>
        </Header>
        <Content style={{ margin: 16, overflowX: 'hidden' }}>
          <Outlet />
        </Content>
      </Layout>

      <Drawer
        placement="left" open={esMobile && drawerAbierto} onClose={() => setDrawerAbierto(false)}
        closable={false} width={250} styles={{ body: { padding: 0, background: '#001529' } }}
      >
        <div style={{ color: '#fff', padding: '16px', fontWeight: 700 }}>ERP Daytona</div>
        {menuNav}
      </Drawer>
    </Layout>
  );
}
