import { Alert, Button, Flex, Table, Tag } from 'antd'
import type { TableProps } from 'antd'
import type { ExpenseType } from '@/api/index.ts'
import ExpenseTypeRowActions from '@/features/expense-types/ExpenseTypeRowActions.tsx'
import { useExpenseTypes } from '@/features/expense-types/hooks.ts'

interface ExpenseTypesTableProps {
  onEdit: (record: ExpenseType) => void
}

export default function ExpenseTypesTable({ onEdit }: ExpenseTypesTableProps) {
  const { data, error, isPending, isError, isFetching, refetch } = useExpenseTypes()
  // 第一次加载失败时表里没有数据，不能显示「暂无数据」，否则看起来像真的没有类型
  const failedWithoutData = isError && data === undefined

  const columns: TableProps<ExpenseType>['columns'] = [
    { title: '名称', dataIndex: 'name' },
    // 后端不填说明时返回空字符串（不是 null）
    { title: '说明', dataIndex: 'description', render: (_, record) => record.description || '—' },
    {
      title: '状态',
      dataIndex: 'enabled',
      render: (_, record) => (record.enabled ? <Tag color="success">启用</Tag> : <Tag>停用</Tag>),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => <ExpenseTypeRowActions record={record} onEdit={onEdit} />,
    },
  ]

  return (
    <Flex vertical gap="middle">
      {isError && (
        <Alert
          type="error"
          showIcon
          title="报销类型加载失败"
          description={error.message}
          action={
            <Button size="small" loading={isFetching} onClick={() => void refetch()}>
              重试
            </Button>
          }
        />
      )}
      <Table<ExpenseType>
        rowKey="id"
        columns={columns}
        dataSource={data}
        // 顺序用接口返回的（后端按创建时间倒序），表格不再排序；类型很少，不分页
        pagination={false}
        loading={isPending || (failedWithoutData && isFetching)}
        locale={failedWithoutData ? { emptyText: '加载失败' } : undefined}
      />
    </Flex>
  )
}
