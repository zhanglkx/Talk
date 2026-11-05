import { App, Button, Flex, Popconfirm } from 'antd'
import type { ExpenseType } from '@/api/index.ts'
import { useSetExpenseTypeEnabled } from '@/features/expense-types/hooks.ts'

interface ExpenseTypeRowActionsProps {
  record: ExpenseType
  onEdit: (record: ExpenseType) => void
}

export default function ExpenseTypeRowActions({ record, onEdit }: ExpenseTypeRowActionsProps) {
  const { message } = App.useApp()
  const setEnabled = useSetExpenseTypeEnabled()

  function changeEnabled(enabled: boolean) {
    setEnabled.mutate(
      { id: record.id, enabled },
      { onError: () => void message.error(`${enabled ? '启用' : '停用'}失败，请稍后重试`) },
    )
  }

  return (
    <Flex gap="small">
      <Button type="link" size="small" onClick={() => onEdit(record)}>
        编辑
      </Button>
      {record.enabled ? (
        // 停用会影响员工填单，先确认；启用没有副作用，直接执行
        <Popconfirm
          title={`确定停用「${record.name}」？`}
          description="停用后不能再用于新的报销单，已有单据不受影响。"
          okText="停用"
          okButtonProps={{ danger: true }}
          onConfirm={() => changeEnabled(false)}
        >
          <Button type="link" size="small" danger loading={setEnabled.isPending}>
            停用
          </Button>
        </Popconfirm>
      ) : (
        <Button
          type="link"
          size="small"
          loading={setEnabled.isPending}
          onClick={() => changeEnabled(true)}
        >
          启用
        </Button>
      )}
    </Flex>
  )
}
