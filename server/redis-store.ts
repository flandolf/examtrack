import { Redis } from "@upstash/redis"
import type { KeyValueStore } from "@opencoredev/loginwithchatgpt-server"

export class RedisStore<T> implements KeyValueStore<T> {
  private readonly redis: Redis
  private readonly prefix: string

  constructor(redis: Redis, prefix: string) {
    this.redis = redis
    this.prefix = prefix
  }

  async get(key: string): Promise<T | undefined> {
    return (await this.redis.get<T>(`${this.prefix}${key}`)) ?? undefined
  }

  async set(key: string, value: T, options?: { ttlMs?: number }): Promise<void> {
    await this.redis.set(`${this.prefix}${key}`, value, options?.ttlMs ? { px: Math.max(1, Math.ceil(options.ttlMs)) } : undefined)
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(`${this.prefix}${key}`)
  }
}

export function createRedisStore<T>(prefix: string): RedisStore<T> | undefined {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return undefined
  return new RedisStore<T>(Redis.fromEnv(), prefix)
}
