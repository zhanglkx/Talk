import { Injectable, Logger } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { ConnectionLifecycleService } from "./connection-lifecycle.service.js";
import { DataSource } from "typeorm";

@Injectable()
export class DatabaseReadinessService {
  private readonly logger = new Logger(DatabaseReadinessService.name);
  private initializationPromise: Promise<void> | undefined;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly connectionLifecycleService: ConnectionLifecycleService,
  ) {}

  async isReady(): Promise<boolean> {
    try {
      await this.connectionLifecycleService.ensureConnected();
      await this.dataSource.query("SELECT 1");
      return true;
    } catch {
      this.logger.warn("Database readiness check failed");
      return false;
    }
  }
}
