# @graphand/server-module-database

Database module for the Graphand server, providing MongoDB and Redis services.

## Features

- **MongoDB Service**: Full-featured MongoDB operations with connection management
- **Redis Service**: Redis client with support for single instance and cluster modes
- **Session Management**: Transaction support for MongoDB operations
- **Environment Scoping**: Support for environment-specific databases

## Installation

This module is part of the Graphand monorepo and uses `ioredis` for Redis connectivity.

## Configuration

### Environment Variables

```env
# MongoDB
DATABASE_MONGO_URI=mongodb://localhost:27017
DATABASE_MONGO_USERNAME=
DATABASE_MONGO_PASSWORD=

# Redis
DATABASE_REDIS_URI=localhost:6379
DATABASE_REDIS_PASSWORD=
DATABASE_REDIS_CLUSTER=false
```

### Module Configuration

```typescript
import { ModuleDatabase } from "@graphand/server-module-database";

const moduleConfig = {
  mongo: {
    uri: process.env.DATABASE_MONGO_URI,
    username: process.env.DATABASE_MONGO_USERNAME,
    password: process.env.DATABASE_MONGO_PASSWORD,
    maxTimeMS: 10000,
    maxCount: 100000,
    maxLimit: 1000,
  },
  redis: {
    uri: process.env.DATABASE_REDIS_URI || "localhost:6379",
    password: process.env.DATABASE_REDIS_PASSWORD,
    cluster: process.env.DATABASE_REDIS_CLUSTER === "true",
  },
  hooks: {
    orderBefore: -2,
    orderAfter: 2,
  },
};
```

## Usage

### Accessing Services

```typescript
// In your server setup
const server = new Server(serverConfig, [[ModuleDatabase, moduleConfig]]);

// Access services through the module
const databaseModule = server.getModule(ModuleDatabase);
const mongoService = databaseModule.service.mongo;
const redisService = databaseModule.service.redis;
```

### Redis Service

```typescript
// Get Redis client
const redisClient = await redisService.getClient();

// Check if Redis is ready
if (redisService.isReady()) {
  // Set a value with TTL (in seconds)
  await redisService.set("cache:key", Buffer.from("value"), 3600);

  // Get a value
  const value = await redisService.get("cache:key");

  // Get keys matching a pattern
  const keys = await redisService.keys("cache:*", true);

  // Delete keys matching a pattern
  const deletedKeys = await redisService.delete("cache:*", true);

  // Health check
  const isHealthy = await redisService.healthz();

  // Cleanup with scope
  await redisService.cleanup("cache:");
}
```

### MongoDB Service

```typescript
// MongoDB operations are available through the DatabaseService
const document = await databaseModule.service.findOne({
  model: YourModel,
  filter: { _id: objectId },
});

const documents = await databaseModule.service.findMany({
  model: YourModel,
  filter: { status: "active" },
});
```

## Redis Cache Strategy Example

You can use the Redis service as a cache strategy:

```typescript
class DataCacheStrategyRedis {
  constructor(private databaseService: DatabaseService) {}

  async get(key: string): Promise<Buffer | null> {
    return this.databaseService.redis.get(key);
  }

  async set(key: string, value: Buffer, ttl?: number): Promise<void> {
    await this.databaseService.redis.set(key, value, ttl);
  }

  async keys(pattern: string, query?: boolean): Promise<string[]> {
    return this.databaseService.redis.keys(pattern, query);
  }

  async delete(pattern: string, query?: boolean): Promise<string[]> {
    return this.databaseService.redis.delete(pattern, query);
  }

  async healthz(): Promise<boolean> {
    return this.databaseService.redis.healthz();
  }

  async cleanup(scope: string): Promise<void> {
    await this.databaseService.redis.cleanup(scope);
  }

  isReady(): boolean {
    return this.databaseService.redis.isReady();
  }
}
```

## Redis Cluster Support

The service automatically detects and supports Redis cluster mode when `cluster: true` is set in configuration. The
service handles both single Redis instances and cluster deployments transparently.

## Connection Management

- **Lazy Connection**: Connections are established only when needed
- **Auto-reconnection**: Built-in reconnection logic with event handling
- **Graceful Shutdown**: Proper connection cleanup on module destruction
- **Health Monitoring**: Real-time connection status monitoring
