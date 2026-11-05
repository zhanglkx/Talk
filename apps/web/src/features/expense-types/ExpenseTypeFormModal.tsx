import { App, Form, Input, Modal } from 'antd'
import { ApiError } from '@/api/index.ts'
import type { ExpenseType } from '@/api/index.ts'
import { useSaveExpenseType } from '@/features/expense-types/hooks.ts'

// 和数据库的 varchar(20)、varchar(100) 一致。本周后端不校验长度，超长会直接返回 500，前端是唯一的防线
const NAME_MAX_LENGTH = 20
const DESCRIPTION_MAX_LENGTH = 100

interface FormValues {
  name: string
  description?: string
}

// 规则写明首尾空格不算：校验和提交都按去掉首尾空格后的值，只有空格的名称算没填
function trimValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : value
}

interface ExpenseTypeFormModalProps {
  open: boolean
  /** 不传表示新增 */
  record?: ExpenseType
  onClose: () => void
}

// 父组件每次打开都换 key，这个组件重新挂载，表单和保存状态都从这一次的初始值开始
export default function ExpenseTypeFormModal({ open, record, onClose }: ExpenseTypeFormModalProps) {
  const [form] = Form.useForm<FormValues>()
  const { message } = App.useApp()
  const save = useSaveExpenseType()

  function handleFinish(values: FormValues) {
    // 确认按钮加载中点不了，但在输入框里按回车仍会提交表单，这里再拦一次
    if (save.isPending) return
    // 说明也去掉首尾空格：只填了空格的说明存成空字符串，和"不填"是同一种写法，列表才会显示「—」
    const input = { name: values.name.trim(), description: (values.description ?? '').trim() }
    save.mutate(
      { id: record?.id, input },
      {
        onSuccess: () => {
          void message.success('已保存')
          onClose()
        },
        onError: (error) => {
          // 按状态码判断，不匹配提示文字：W2 换成统一错误格式后，文字会变
          if (error instanceof ApiError && error.status === 409) {
            form.setFields([{ name: 'name', errors: ['名称已存在'] }])
            return
          }
          void message.error('保存失败，请稍后重试')
        },
      },
    )
  }

  return (
    <Modal
      open={open}
      title={record ? '编辑类型' : '新增类型'}
      okText="保存"
      confirmLoading={save.isPending}
      onOk={() => form.submit()}
      onCancel={onClose}
      // 保存请求发出后不让关闭弹窗，否则看不到成功或失败的结果
      closable={!save.isPending}
      mask={{ closable: !save.isPending }}
      keyboard={!save.isPending}
      cancelButtonProps={{ disabled: save.isPending }}
    >
      <Form<FormValues>
        form={form}
        layout="vertical"
        initialValues={{ name: record?.name ?? '', description: record?.description ?? '' }}
        onFinish={handleFinish}
      >
        <Form.Item
          label="名称"
          name="name"
          rules={[
            { required: true, transform: trimValue, message: '请输入名称' },
            {
              max: NAME_MAX_LENGTH,
              transform: trimValue,
              message: `名称最多 ${NAME_MAX_LENGTH} 个字`,
            },
          ]}
        >
          <Input placeholder="例如：差旅" autoFocus />
        </Form.Item>
        <Form.Item
          label="说明"
          name="description"
          rules={[
            {
              max: DESCRIPTION_MAX_LENGTH,
              transform: trimValue,
              message: `说明最多 ${DESCRIPTION_MAX_LENGTH} 个字`,
            },
          ]}
        >
          <Input.TextArea rows={3} placeholder="选填" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
