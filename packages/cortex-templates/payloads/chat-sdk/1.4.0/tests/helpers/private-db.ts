export class PrivateDb {
  tables: Record<string, Array<Record<string, any>>> = {};
  writes: unknown[] = [];
  constructor(tables: Record<string, Array<Record<string, any>>> = {}) {
    this.tables = structuredClone(tables);
  }
  query(table: string) {
    let rows = [...(this.tables[table] || [])];
    const value = (row: any, key: string) =>
      key.split(".").reduce((current, part) => current?.[part], row);
    const builder: any = {
      withIndex: (_: string, select: (q: any) => unknown) => {
        const q = {
          eq: (key: string, expected: unknown) => {
            rows = rows.filter((row) => value(row, key) === expected);
            return q;
          },
        };
        select(q);
        return builder;
      },
      filter: (predicate: (q: any) => (row: any) => boolean) => {
        const q = {
          field: (key: string) => (row: any) => value(row, key),
          eq: (field: (row: any) => unknown, expected: unknown) => (row: any) =>
            field(row) === expected,
          and:
            (...predicates: Array<(row: any) => boolean>) =>
            (row: any) =>
              predicates.every((p) => p(row)),
        };
        rows = rows.filter(predicate(q));
        return builder;
      },
      order: () => builder,
      take: async (count: number) => rows.slice(0, count),
      collect: async () => rows,
      unique: async () => {
        if (rows.length > 1) throw new Error("Duplicate record");
        return rows[0] || null;
      },
      first: async () => rows[0] || null,
    };
    return builder;
  }
  async insert(table: string, row: Record<string, any>) {
    const id = `${table}-${this.writes.length}`;
    (this.tables[table] ||= []).push({ ...row, _id: id });
    this.writes.push(["insert", table]);
    return id;
  }
  async patch(id: string, patch: Record<string, unknown>) {
    const row = Object.values(this.tables)
      .flat()
      .find((row) => row._id === id);
    if (!row) throw new Error("Missing record");
    Object.assign(row, patch);
    this.writes.push(["patch", id]);
  }
  async delete(id: string) {
    for (const table of Object.keys(this.tables))
      this.tables[table] = this.tables[table].filter((row) => row._id !== id);
    this.writes.push(["delete", id]);
  }
}
export const invoke = (
  operation: any,
  db: PrivateDb,
  args: Record<string, unknown>,
) => operation._handler({ db }, args);
