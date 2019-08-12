/*
 * Copyright 2019 TD Ameritrade. Released under the terms of the 3-Clause BSD license.  # noqa: E501
 */

import { isObject, toString } from 'lodash';

import {
  StorageContainer,
  StorageChangeType,
  OnChangeHandler
} from './StorageContainer';

/**
 * Storage container that persists to local storage.
 */
export class LocalStorageContainer implements StorageContainer {
  private onChange: OnChangeHandler = (() => {}) as any;

  constructor(private readonly localStorage: Storage) {}

  registerOnChange(handler: OnChangeHandler): void {
    this.onChange = handler;
  }

  attach(): Promise<void> {
    return Promise.resolve();
  }

  detach(): Promise<void> {
    return Promise.resolve();
  }

  getItem<T>(key: string): Promise<T | null> {
    return this.attempt<T | null>(() => {
      let item = this.localStorage.getItem(this.getLookupKey(key));

      try {
        item = JSON.parse(item!);
      } catch {
        // Don't do anything.
      }

      return item as any;
    });
  }

  async setItem<T>(key: string, value: T): Promise<void> {
    let storedValue: string = toString(value);

    if (isObject(value)) {
      storedValue = JSON.stringify(value);
    }

    await this.attempt(() =>
      this.localStorage.setItem(
        this.getLookupKey(this.stripLookupKey(key)),
        storedValue
      )
    );
    await this.onChange(StorageChangeType.UPDATE, key, value);
  }

  async removeItem(key: string): Promise<void> {
    await this.attempt(() =>
      this.localStorage.removeItem(this.getLookupKey(key))
    );
    await this.onChange(StorageChangeType.DELETE, key, undefined);
  }

  async clear(): Promise<void> {
    await this.attempt(() => this.localStorage.clear());
    await this.onChange(StorageChangeType.CLEARED, '', undefined);
  }

  async getAll<T = any>(): Promise<{ [key: string]: T }> {
    const result: { [key: string]: T } = {};

    for (const lookupKey of Object.keys(this.localStorage)) {
      const key = this.stripLookupKey(lookupKey);

      result[key] = (await this.getItem(key)) as T;
    }

    return result;
  }

  async hasItem(key: string): Promise<boolean> {
    return Object.prototype.hasOwnProperty.call(
      this.localStorage,
      this.getLookupKey(key)
    );
  }

  getLookupKey(key: string): string {
    return key;
  }

  stripLookupKey(key: string): string {
    return key;
  }

  private async attempt<T>(fn: () => T): Promise<T> {
    try {
      return Promise.resolve(fn());
    } catch (e) {
      return Promise.reject(e);
    }
  }
}
