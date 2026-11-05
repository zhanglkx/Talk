import { Typography } from 'antd'
import ExpenseTypesTable from '@/features/expense-types/ExpenseTypesTable.tsx'

export default function ExpenseTypesPage() {
  return (
    <>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        报销类型
      </Typography.Title>
      <ExpenseTypesTable />
    </>
  )
}
