import { Layout, Menu, Typography, theme } from 'antd'
import { Link, Outlet, useMatch } from 'react-router'
import ApiStatus from '@/layouts/ApiStatus.tsx'

const { Header, Sider, Content } = Layout

const menuItems = [{ key: '/expense-types', label: <Link to="/expense-types">报销类型</Link> }]

export default function AppLayout() {
  const { token } = theme.useToken()
  // 选中项跟随路由，直接访问、刷新和浏览器前进后退时也能保持一致
  const expenseTypesMatch = useMatch('/expense-types')
  const divider = `1px solid ${token.colorBorderSecondary}`

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingInline: 24,
          background: token.colorBgContainer,
          borderBottom: divider,
        }}
      >
        <Typography.Title level={4} style={{ margin: 0 }}>
          星河报销
        </Typography.Title>
        <ApiStatus />
      </Header>
      <Layout>
        <Sider width={200} theme="light" style={{ borderInlineEnd: divider }}>
          <Menu
            mode="inline"
            selectedKeys={expenseTypesMatch ? ['/expense-types'] : []}
            items={menuItems}
            style={{ borderInlineEnd: 'none' }}
          />
        </Sider>
        <Content
          style={{
            margin: 24,
            padding: 24,
            background: token.colorBgContainer,
            borderRadius: token.borderRadiusLG,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
