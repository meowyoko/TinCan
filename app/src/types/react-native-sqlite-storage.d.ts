declare module 'react-native-sqlite-storage' {
  export type SQLResultSetRowList = {
    length: number;
    item(index: number): any;
  };

  export type SQLResultSet = {
    insertId: number;
    rowsAffected: number;
    rows: SQLResultSetRowList;
  };

  export interface SQLiteDatabase {
    executeSql(
      statement: string,
      params?: ReadonlyArray<any>,
    ): Promise<[SQLResultSet]>;
    close(): Promise<void>;
  }

  export interface SQLiteStatic {
    enablePromise(enabled: boolean): void;
    openDatabase(config: {
      name: string;
      location?: 'default' | 'Library' | 'Documents' | 'Shared';
    }): Promise<SQLiteDatabase>;
  }

  const SQLite: SQLiteStatic;
  export default SQLite;
}
