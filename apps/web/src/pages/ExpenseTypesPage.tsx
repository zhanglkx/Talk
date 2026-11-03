import { Empty, Typography } from 'antd'

export default function ExpenseTypesPage() {
  return (
    <>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        报销类型
      </Typography.Title>
      <Empty description="报销类型功能开发中" />
    </>
  )
}
