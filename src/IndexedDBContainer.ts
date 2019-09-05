/*
 * Copyright 2019 TD Ameritrade. Released under the terms of the 3-Clause BSD license.  # noqa: E501
 */

import {
  StorageContainer,
  OnChangeHandler,
  StorageChangeType
} from './StorageContainer';

export interface IndexedDBContainerOptions {
  /**
   * The name of the database.
   */
  databaseName: string;
  /**
   * The database version. Increment this when you want to make
   * changes to the database structure. Since this mostly determined
   * by the container, you won't need to often.
   */
  databaseVersion: number;
  /**
   * A migration function that is invoked when the database version
   * is increased.
   */
  migration?: (db: IDBDatabase, storeKey: string) => void;
}

const STORE_KEY = 'data';

/**
 * Storage container for indexed DB.
 */
export class IndexedDBContainer implements StorageContainer {
  static readonly STORE_KEY = STORE_KEY;

  private dbResolveHandler: Function = () => {};
  private isAttached: boolean = false;
  private onChange: OnChangeHandler = (() => {}) as any;

  private db!: Promise<IDBDatabase>;

  constructor(
    private readonly idbFactory: IDBFactory,
    private readonly options: IndexedDBContainerOptions
  ) {
    this.setDBHandler();
  }

  registerOnChange(handler: OnChangeHandler): void {
    this.onChange = handler;
  }

  attach(): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = this.idbFactory.open(
        this.options.databaseName,
        this.options.databaseVersion
      );

      req.onerror = err => reject(err);
      req.onupgradeneeded = event => {
        const db = (event.target as any).result as IDBDatabase;

        db.createObjectStore(STORE_KEY);

        if (this.options.migration) {
          this.options.migration(db, STORE_KEY);
        }
      };

      req.onsuccess = async event => {
        const db = (event.target as any).result as IDBDatabase;

        this.isAttached = true;
        this.dbResolveHandler(db);
        resolve();
      };
    });
  }

  async detach(): Promise<void> {
    if (this.isAttached) {
      (await this.db).close();
      this.isAttached = false;
      this.setDBHandler();
    }
  }

  getItem<T>(key: string): Promise<T> {
    return this.makeRequest(
      store => store.get(key),
      (event, resolve, reject) => resolve((event.target as any).result),
      'readonly'
    );
  }

  setItem<T>(key: string, value: T): Promise<void> {
    return this.makeRequest(
      store => store.put(value, key),
      (event, resolve, reject) => {
        this.onChange(StorageChangeType.UPDATE, key, value).then(() =>
          resolve()
        );
      },
      'readwrite'
    );
  }

  removeItem(key: string): Promise<void> {
    return this.makeRequest(
      store => store.delete(key),
      (event, resolve, reject) => {
        this.onChange(StorageChangeType.DELETE, key, undefined).then(() =>
          resolve()
        );
      },
      'readwrite'
    );
  }

  clear(): Promise<void> {
    return this.makeRequest(
      store => store.clear(),
      (event, resolve, reject) => {
        this.onChange(StorageChangeType.CLEARED, '', undefined).then(() =>
          resolve()
        );
      },
      'readwrite'
    );
  }

  hasItem(key: string): Promise<boolean> {
    return this.makeRequest(
      store => store.getAllKeys(),
      (event, resolve, reject) =>
        resolve(
          Array.isArray((event.target as any).result) &&
            ((event.target as any).result as string[]).indexOf(key) !== -1
        ),
      'readonly'
    );
  }

  getAll<T>(): Promise<T> {
    return new Promise(async (resolve, reject) => {
      const result = {} as { [key: string]: any };

      (await this.db)
        .transaction(STORE_KEY, 'readonly')
        .objectStore(STORE_KEY)
        .openCursor().onsuccess = event => {
        const cursor = (event.target as any).result as
          | IDBCursorWithValue
          | undefined;

        if (cursor) {
          try {
            result[cursor.key as string] = cursor.value;
            cursor.continue();
          } catch (e) {
            reject(e);
          }
        } else {
          resolve(result as T);
        }
      };
    });
  }

  private makeRequest<T>(
    handler: (store: IDBObjectStore) => IDBRequest,
    resultHandler: (event: Event, resolve: Function, reject: Function) => void,
    type: 'readonly' | 'readwrite'
  ): Promise<T> {
    return new Promise(async (resolve, reject) => {
      const req = handler(
        (await this.db).transaction(STORE_KEY, type).objectStore(STORE_KEY)
      );

      req.onsuccess = value => resultHandler(value, resolve, reject);
      req.onerror = err => reject(err);
    });
  }

  private setDBHandler() {
    this.db = new Promise(resolve => (this.dbResolveHandler = resolve));
  }
}
