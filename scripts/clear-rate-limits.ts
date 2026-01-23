/**
 * DEV ONLY: Clear all rate limit keys from Redis
 */
import 'dotenv/config';
import Redis from 'ioredis';

async function clearRateLimits() {
  const redis = new Redis(process.env.REDIS_URL!);

  console.log('\n🧹 Clearing rate limits from Redis...\n');

  // Find all rate limit related keys
  const patterns = ['*rate*', '*limit*', '*rl:*', '*127.0.0.1*', '*::1*'];
  let totalDeleted = 0;

  for (const pattern of patterns) {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      for (const key of keys) {
        await redis.del(key);
        console.log(`   Deleted: ${key}`);
        totalDeleted++;
      }
    }
  }

  console.log(`\n✅ Cleared ${totalDeleted} rate limit keys!`);
  console.log('   You can now login at http://localhost:5001\n');

  await redis.quit();
  process.exit(0);
}

clearRateLimits().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
