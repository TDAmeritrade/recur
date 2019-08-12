/*
 * Copyright 2019 TD Ameritrade. Released under the terms of the 3-Clause BSD license.  # noqa: E501
 */

import {
  StorageContainer,
  StorageChangeType,
  OnChangeHandler
} from './StorageContainer';

/**
 * In memory storage container. This can be extended to persist to a
 * database for database storage on debounced changes.
 */
export class MemoryContainer implements StorageContainer {
  protected storage: { [key: string]: any } = {};
  protected onChange: OnChangeHandler = (() => {}) as any;

  registerOnChange(handler: OnChangeHandler) {
    this.onChange = handler;
  }

  attach(): Promise<void> {
    return Promise.resolve();
  }

  detach(): Promise<void> {
    return Promise.resolve();
  }

  async getItem<T>(key: string): Promise<T | null> {
    return this.storage[key];
  }

  async setItem<T>(key: string, value: T): Promise<void> {
    this.storage[key] = value;
    await this.onChange(StorageChangeType.UPDATE, key, value);
  }

  async removeItem(key: string): Promise<void> {
    if (this.storage.hasOwnProperty(key)) {
      delete this.storage[key];
      await this.onChange(StorageChangeType.DELETE, key, undefined);
    }
  }

  async clear(): Promise<void> {
    this.storage = {};
    await this.onChange(StorageChangeType.CLEARED, '', undefined);
  }

  async getAll<T = any>(): Promise<{ [key: string]: T }> {
    return { ...this.storage };
  }

  async hasItem(key: string): Promise<boolean> {
    return this.storage.hasOwnProperty(key);
  }
}
