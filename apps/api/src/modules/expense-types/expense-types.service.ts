import { randomUUIDv7 } from 'node:crypto'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Not, Repository } from 'typeorm'
import type { CreateExpenseTypeDto } from '@/modules/expense-types/dto/create-expense-type.dto.js'
import type { UpdateExpenseTypeDto } from '@/modules/expense-types/dto/update-expense-type.dto.js'
import { ExpenseTypeEntity } from '@/modules/expense-types/expense-type.entity.js'

// 报销类型的业务规则都写在这里；读写数据库通过 TypeORM 的 Repository，Controller 不直接碰数据库
@Injectable()
export class ExpenseTypesService {
  constructor(
    @InjectRepository(ExpenseTypeEntity)
    private readonly expenseTypes: Repository<ExpenseTypeEntity>,
  ) {}

  findAll(): Promise<ExpenseTypeEntity[]> {
    // 只按创建时间排，同一时刻创建的两条顺序不固定；再按 id 排一次，顺序才稳定
    return this.expenseTypes.find({ order: { createdAt: 'DESC', id: 'DESC' } })
  }

  async create(dto: CreateExpenseTypeDto): Promise<ExpenseTypeEntity> {
    await this.assertNameAvailable(dto.name)
    // 只取 name、description：请求体里多传的 id、enabled、时间一律不用，免得客户端改掉不该改的字段
    const expenseType = this.expenseTypes.create({
      id: randomUUIDv7(),
      name: dto.name,
      description: dto.description ?? '',
      enabled: true,
    })
    // 用 insert 而不是 save：save 遇到已经带着 id 的对象，会先查一次库，判断该插入还是更新
    await this.expenseTypes.insert(expenseType)
    return expenseType
  }

  async update(id: string, dto: UpdateExpenseTypeDto): Promise<ExpenseTypeEntity> {
    const expenseType = await this.findByIdOrThrow(id)
    if (dto.name !== undefined) {
      // 排除这条记录自己：编辑弹窗会把名称和说明一起提交，只改说明、名称没变时不能报重名
      await this.assertNameAvailable(dto.name, id)
      expenseType.name = dto.name
    }
    if (dto.description !== undefined) {
      expenseType.description = dto.description
    }
    // save 会先按 id 再查一次库，比较出哪些列变了，只更新这些列，并自动刷新 updated_at；没有变化就不发 UPDATE
    return this.expenseTypes.save(expenseType)
  }

  disable(id: string): Promise<ExpenseTypeEntity> {
    return this.setEnabled(id, false)
  }

  enable(id: string): Promise<ExpenseTypeEntity> {
    return this.setEnabled(id, true)
  }

  // 已经是目标状态就直接返回、不报错：连点两次或者网络重试，结果都一样（幂等）
  private async setEnabled(id: string, enabled: boolean): Promise<ExpenseTypeEntity> {
    const expenseType = await this.findByIdOrThrow(id)
    if (expenseType.enabled === enabled) {
      return expenseType
    }
    expenseType.enabled = enabled
    return this.expenseTypes.save(expenseType)
  }

  private async findByIdOrThrow(id: string): Promise<ExpenseTypeEntity> {
    const expenseType = await this.expenseTypes.findOneBy({ id })
    if (!expenseType) {
      throw new NotFoundException('报销类型不存在')
    }
    return expenseType
  }

  // 先查重，给出清楚的 409。两个请求同时提交时都会查到"不存在"，这时由数据库唯一约束兜底：
  // 后插入的那条会失败（本周返回 500，W2 把唯一约束的错误也转成 409）
  private async assertNameAvailable(name: string, excludeId?: string): Promise<void> {
    const taken = await this.expenseTypes.existsBy(
      excludeId === undefined ? { name } : { name, id: Not(excludeId) },
    )
    if (taken) {
      throw new ConflictException('名称已存在')
    }
  }
}
