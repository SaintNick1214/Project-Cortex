import { Database } from "./fixture";
// The accepted03A dependency now uses bounded take(2), rather than unique().
// Preserve the historical fixture and original218 assertions byte for byte.
const query = Database.prototype.query;
Database.prototype.query = function (table: string) {
  const result = query.call(this, table);
  return Object.assign(result, { take: async (limit: number) => (await result.collect()).slice(0, limit) });
};
