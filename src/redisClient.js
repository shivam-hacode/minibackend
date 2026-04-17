require("dotenv").config();

const { Redis } = require("@upstash/redis");

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.warn(
    "[redis] Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN — Redis cache will fail until .env is set on the server."
  );
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

module.exports = redis;
