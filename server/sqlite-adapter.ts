// Universal SQLite adapter: Native high-performance bun:sqlite when running in Bun,
// with graceful fallback to better-sqlite3 when running in Node.js.

let Database: any;

if (typeof Bun !== 'undefined') {
  const { Database: NativeBunDatabase } = await import('bun:sqlite');

  const normalizeParams = (args: any[]) => {
    if (args.length === 1 && args[0] && typeof args[0] === 'object' && !Array.isArray(args[0])) {
      const entries: [string, any][] = [];
      for (const [k, v] of Object.entries(args[0])) {
        entries.push([k, v]);
        if (!k.startsWith('@') && !k.startsWith('$') && !k.startsWith(':')) {
          entries.push([`@${k}`, v]);
          entries.push([`$${k}`, v]);
        }
      }
      return [Object.fromEntries(entries)];
    }
    return args;
  };

  class StatementWrapper {
    private stmt: any;
    constructor(stmt: any) {
      this.stmt = stmt;
    }
    run(...args: any[]) {
      return this.stmt.run(...normalizeParams(args));
    }
    get(...args: any[]) {
      const res = this.stmt.get(...normalizeParams(args));
      return res === null ? undefined : res;
    }
    all(...args: any[]) {
      return this.stmt.all(...normalizeParams(args));
    }
  }

  Database = class BunSqliteAdapter {
    private raw: any;
    constructor(filename: string, options?: any) {
      this.raw = new NativeBunDatabase(filename, options);
    }
    pragma(pragmaStr: string) {
      return this.raw.exec(`PRAGMA ${pragmaStr};`);
    }
    exec(sql: string) {
      return this.raw.exec(sql);
    }
    prepare(sql: string) {
      return new StatementWrapper(this.raw.prepare(sql));
    }
    transaction(fn: (...args: any[]) => any) {
      return this.raw.transaction(fn);
    }
    close() {
      return this.raw.close();
    }
  };
} else {
  const { default: BetterSqlite3 } = await import('better-sqlite3');
  Database = BetterSqlite3;
}

export default Database;
