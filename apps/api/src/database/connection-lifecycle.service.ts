import { Injectable } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'

// 只负责建立连接。不查询，不建表；失败交给调用方处理。
@Injectable()
export class ConnectionLifecycleService {
  // 只表示正在进行的那一次连接。结束后清掉。
  private initializationPromise: Promise<void> | undefined

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async ensureConnected(): Promise<void> {
    // 已有连接在进行就等待同一次，避免两个请求同时 initialize。
    if (this.initializationPromise) {
      await this.initializationPromise
      return
    }

    // 已经连上。再次 initialize 会失败。
    if (this.dataSource.isInitialized) {
      return
    }

    // 先记下这次尝试再等待。遇到 await 之前后到的调用一定能看见它。
    const initializationPromise = this.dataSource.initialize().then(() => undefined)
    this.initializationPromise = initializationPromise

    try {
      await initializationPromise
    } finally {
      // 只清掉自己这次。失败后标记消失，下一次才能重试；是否已连上由 isInitialized 记住。
      if (this.initializationPromise === initializationPromise) {
        this.initializationPromise = undefined
      }
    }
  }
}
