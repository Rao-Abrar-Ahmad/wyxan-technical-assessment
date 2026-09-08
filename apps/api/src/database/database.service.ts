import { Injectable, Logger, OnModuleDestroy, ConflictException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ClientSession, Connection } from 'mongoose';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  /**
   * Execute an operation within a MongoDB multi-document transaction.
   * Required for ADR-0001 (guard flip + movement append) and ADR-0002.
   */
  async runInTransaction<T>(
    fn: (session: ClientSession) => Promise<T>,
  ): Promise<T> {
    const session = await this.connection.startSession();
    try {
      let result: T;
      await session.withTransaction(async () => {
        result = await fn(session);
      });
      return result!;
    } catch (err: any) {
      if (
        err.code === 112 ||
        err.errorLabels?.includes('TransientTransactionError') ||
        err.message?.includes('WriteConflict') ||
        err.message?.includes('Write conflict')
      ) {
        throw new ConflictException(
          'Concurrent transaction conflict. Another transaction updated this resource.',
        );
      }
      throw err;
    } finally {
      await session.endSession();
    }
  }

  getConnection(): Connection {
    return this.connection;
  }

  async onModuleDestroy() {
    // Graceful disconnect if needed
  }
}
