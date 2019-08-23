/*
 * Copyright 2019 TD Ameritrade. Released under the terms of the 3-Clause BSD license.  # noqa: E501
 * recur is a trademark of TD Ameritrade IP Company, Inc. All rights reserved.
 */

import { StorageApi } from './StorageApi';

export const ALL_KEYS = 'ALL_KEYS';

export enum StorageChangeType {
  DELETE = 'DELETE',
  UPDATE = 'UPDATE',
  CLEARED = 'CLEARED',
  CONTAINER_CHANGE = 'CONTAINER_CHANGE'
}

export function createChangeEvent<S = any, V = any>(
  type: StorageChangeType,
  key: string,
  value: V,
  container: StorageApi<S>
): StorageContainerChange<S, V> {
  return {
    type,
    key,
    value,
    // Create a getter so the snapshot is lazy.
    get snapshot() {
      const promise = container.getAll() as Promise<S>;

      Object.defineProperty(this, 'snapshot', {
        configurable: true,
        writable: false,
        value: promise
      });

      return promise;
    }
  };
}

export interface StorageContainerChange<S = any, V = any> {
  /**
   * The type of change made.
   */
  type: StorageChangeType;
  /**
   * The key that was changed.
   */
  key: string;
  /**
   * The value the key was changed to.
   */
  value: V;
  /**
   * The current state of storage.
   */
  snapshot: Promise<S>;
}

export type OnChangeHandler = (
  type: StorageChangeType,
  key: string,
  value: any
) => Promise<void>;

/**
 * A container for a persisted storage container.
 * @interface StorageContainer
 */
export interface StorageContainer<S = any> {
  /**
   * Registers an on change handler that signals a change was made to storage.
   * @param onChange
   */
  registerOnChange(onChange: OnChangeHandler): void;
  /**
   * Invoked when the container is being attached.
   */
  attach(): Promise<void>;
  /**
   * Invoked when the container is being detached.
   */
  detach(): Promise<void>;
  /**
   * Gets an item from storage.
   * @param key
   */
  getItem<T>(key: string): Promise<T>;
  /**
   * Sets an item in storage.
   * @param key
   * @param value
   */
  setItem<T>(key: string, value: T): Promise<void>;
  /**
   * Removes an item from storage.
   * @param key
   */
  removeItem(key: string): Promise<void>;
  /**
   * Clears all items from storage.
   */
  clear(): Promise<void>;
  /**
   * Gets all items from storage.
   */
  getAll(): Promise<S>;
  /**
   * Determines whether an item exists in storage.
   * @param key
   */
  hasItem(key: string): Promise<boolean>;
}
