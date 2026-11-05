import { useState } from 'react'
import { Button, Flex, Typography } from 'antd'
import type { ExpenseType } from '@/api/index.ts'
import ExpenseTypeFormModal from '@/features/expense-types/ExpenseTypeFormModal.tsx'
import ExpenseTypesTable from '@/features/expense-types/ExpenseTypesTable.tsx'

interface FormState {
  open: boolean
  /** 不传表示新增 */
  record?: ExpenseType
  // 每次打开换一个 key，弹窗重新挂载：表单回到这一次的初始值，不残留上一次的输入和错误提示
  key: number
}

export default function ExpenseTypesPage() {
  const [formState, setFormState] = useState<FormState>({ open: false, key: 0 })

  function openForm(record?: ExpenseType) {
    setFormState((prev) => ({ open: true, record, key: prev.key + 1 }))
  }

  return (
    <>
      <Flex justify="space-between" align="center" style={{ marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          报销类型
        </Typography.Title>
        <Button type="primary" onClick={() => openForm()}>
          新增类型
        </Button>
      </Flex>
      <ExpenseTypesTable onEdit={openForm} />
      <ExpenseTypeFormModal
        key={formState.key}
        open={formState.open}
        record={formState.record}
        // 关闭只改 open、不清 record：下次打开会换 key 重新挂载，不需要在这里清理
        onClose={() => setFormState((prev) => ({ ...prev, open: false }))}
      />
    </>
  )
}
