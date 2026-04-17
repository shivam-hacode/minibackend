const moment = require("moment");
const redis = require("./redisClient.js");

/** Same key shape as FetchAllResultWithoutAuthcode: `results:${year}-${0-11 month}` */
function monthAggregateKey(isoDateStr) {
  const d = moment(isoDateStr, "YYYY-MM-DD", true);
  if (!d.isValid()) return null;
  return `results:${d.year()}-${d.month()}`;
}

async function invalidateMonthResultsCache(isoDateStr) {
  const key = monthAggregateKey(isoDateStr);
  if (!key) return;
  try {
    await redis.del(key);
  } catch (e) {
    console.error("[redis] invalidateMonthResultsCache:", e.message);
  }
}

/** GetResultsWithDate uses `results:date:${categoryname}:${date}:${mode}` */
async function invalidateDateViewCaches(categoryname, isoDateStr) {
  if (!categoryname || !isoDateStr) return;
  const modes = ["scraper", "manual", "auto"];
  for (const mode of modes) {
    try {
      await redis.del(`results:date:${categoryname}:${isoDateStr}:${mode}`);
    } catch (e) {
      console.error("[redis] invalidateDateViewCaches:", e.message);
    }
  }
}

async function invalidateResultsByMonthCache(categoryname, isoDateStr) {
  if (!categoryname || !isoDateStr) return;
  for (const mode of ["scraper", "manual", "auto"]) {
    try {
      await redis.del(`resultsByMonth:${categoryname}:${isoDateStr}:${mode}`);
    } catch (e) {
      console.error("[redis] invalidateResultsByMonthCache:", e.message);
    }
  }
}

async function invalidateAfterResultWrite(categoryname, isoDateStr) {
  await invalidateMonthResultsCache(isoDateStr);
  await invalidateDateViewCaches(categoryname, isoDateStr);
  await invalidateResultsByMonthCache(categoryname, isoDateStr);
}

module.exports = {
  invalidateMonthResultsCache,
  invalidateDateViewCaches,
  invalidateAfterResultWrite,
  monthAggregateKey,
};
