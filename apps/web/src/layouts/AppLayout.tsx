import { Empty, Layout, Menu, Typography, theme } from 'antd'
import ApiStatus from '@/layouts/ApiStatus.tsx'

const { Header, Sider, Content } = Layout

// 目前只有一个菜单项；S7 接上路由后，选中哪一项、内容区显示什么都跟着地址变化
const menuItems = [{ key: 'expense-types', label: '报销类型' }]

export default function AppLayout() {
  const { token } = theme.useToken()
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
            defaultSelectedKeys={['expense-types']}
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
          <Empty description="报销类型功能开发中" />
        </Content>
      </Layout>
    </Layout>
  )
}
