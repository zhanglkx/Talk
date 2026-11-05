import { Button } from 'antd'
import type { ExpenseType } from '@/api/index.ts'

interface ExpenseTypeRowActionsProps {
  record: ExpenseType
  onEdit: (record: ExpenseType) => void
}

export default function ExpenseTypeRowActions({ record, onEdit }: ExpenseTypeRowActionsProps) {
  return (
    <Button type="link" size="small" onClick={() => onEdit(record)}>
      编辑
    </Button>
  )
}
