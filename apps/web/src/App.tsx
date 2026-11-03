import { ConfigProvider, Result } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { Navigate, Route, Routes } from 'react-router'
import AppLayout from '@/layouts/AppLayout.tsx'
import ExpenseTypesPage from '@/pages/ExpenseTypesPage.tsx'

export default function App() {
  // Ant Design 组件默认是英文（例如空状态显示 No data），在最外层统一切成中文
  return (
    <ConfigProvider locale={zhCN}>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/expense-types" replace />} />
          <Route path="expense-types" element={<ExpenseTypesPage />} />
          <Route
            path="*"
            element={<Result status="404" title="404" subTitle="页面不存在，请从左侧菜单进入。" />}
          />
        </Route>
      </Routes>
    </ConfigProvider>
  )
}
