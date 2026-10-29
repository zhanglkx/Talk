import { Injectable } from '@nestjs/common'
import {
  CreateExpenseTypeDto,
  UpdateExpenseTypeDto,
} from '@/modules/expense-types/dto/create-expense-type.dto.js'

@Injectable()
export class ExpenseTypesService {
  async findAll() {
    return [
      {
        id: 1,
        name: 'Food',
      },
    ]
  }

  async create(createExpenseTypeDto: CreateExpenseTypeDto) {
    return {
      id: 1,
      name: 'Food',
    }
  }

  async update(id: string, updateExpenseTypeDto: UpdateExpenseTypeDto) {
    return {
      id: 1,
      name: 'Food',
    }
  }

  async disable(id: string) {
    return {
      id: 1,
      name: 'Food',
    }
  }

  async enable(id: string) {
    return {
      id: 1,
      name: 'Food',
    }
  }
}
