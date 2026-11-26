import mongoose from 'mongoose';
import { join } from 'node:path';
import { dataDirectory, mongoDbName, mongoUri } from './config.js';
import { defineModels } from './models.js';

export async function openDatabase({ memory = false } = {}) {
  let testServer;
  let connection;
  try {
    if (memory) {
      const { MongoMemoryReplSet } = await import('mongodb-memory-server');
      testServer = await MongoMemoryReplSet.create({ binary: { downloadDir: join(dataDirectory, 'mongodb-binaries') }, replSet: { count: 1 } });
    }
    const uri = testServer?.getUri() || mongoUri;
    if (!uri) throw new Error('Set MONGO_URI in backend/.env.local.');
    connection = mongoose.createConnection(uri, { dbName: memory ? 'shopease_test' : mongoDbName, serverSelectionTimeoutMS: 8000 });
    await connection.asPromise();
    const models = defineModels(connection);
    await Promise.all(Object.values(models).map(model => model.init()));
    return {
      ...models,
      name: connection.name,
      ping: () => connection.db.command({ ping: 1 }),
      transaction: (operation) => connection.transaction(operation),
      close: async () => {
        await connection.close();
        await testServer?.stop();
      },
    };
  } catch (error) {
    await connection?.close();
    await testServer?.stop();
    throw error;
  }
}
