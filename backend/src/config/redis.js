const Redis = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: 3,
  lazyConnect: false,
});

redis.on('error',   (err) => console.error('Redis error:', err));
redis.on('connect', ()    => console.log('Connected to Redis'));

module.exports = redis;
