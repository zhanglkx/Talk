import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import AppLayout from '@/layouts/AppLayout.tsx'

export default function App() {
  // Ant Design 组件默认是英文（例如空状态显示 No data），在最外层统一切成中文
  return (
    <ConfigProvider locale={zhCN}>
      <AppLayout />
    </ConfigProvider>
  )
}
