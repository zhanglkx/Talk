import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DatabaseReadinessService } from "./database-readiness.service.js";
import { ConnectionLifecycleService } from "./connection-lifecycle.service.js";
import { createDatabaseOptions } from "./database-options.js";

// 组装数据库：用共享配置生成唯一的连接，并把连接服务和就绪检查提供给别的模块。
@Module({
  imports: [
    // forRootAsync 会等配置模块读完环境变量，再生成这一份连接配置。
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        createDatabaseOptions(configService.getOrThrow<string>("DATABASE_URL")),
    }),
  ],
  // 两个服务共用上面这一份连接。导出后别的模块才能注入，不能各自再连一个库。
  providers: [DatabaseReadinessService, ConnectionLifecycleService],
  exports: [DatabaseReadinessService, ConnectionLifecycleService],
})
export class DatabaseModule {}
