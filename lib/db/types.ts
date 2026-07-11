export type SqlValue = string | number | bigint | boolean | null;
export type SqlArgs = Record<string, SqlValue>;
export type SqlRow = Record<string, SqlValue>;

export interface SqlResult {
  rows: SqlRow[];
  rowsAffected: number;
}

export interface Database {
  execute(sql: string, args?: SqlArgs): Promise<SqlResult>;
}
