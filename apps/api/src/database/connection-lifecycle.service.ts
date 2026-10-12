import { Injectable, Logger } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";

@Injectable()
export class ConnectionLifecycleService {
  private initializationPromise: Promise<void> | undefined;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async ensureConnected(): Promise<void> {
    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }

    if (this.dataSource.isInitialized) {
      return;
    }

    const initilaizaionPromise = this.dataSource.initialize().then(() => undefined);
    this.initializationPromise = initilaizaionPromise;

    try {
      await initilaizaionPromise;
    } finally {
      if (this.initializationPromise === initilaizaionPromise) {
        this.initializationPromise = undefined;
      }
    }
  }
}
