/*
 * Copyright 2019 TD Ameritrade. Released under the terms of the 3-Clause BSD license.  # noqa: E501
 */

import { Subject, Observable } from 'rxjs';

import {
  StorageContainer,
  StorageContainerChange,
  StorageChangeType,
  createChangeEvent
} from './StorageContainer';
import { RecurringScopedStorage } from './RecurringScopedStorage';
import { StorageTransactionQueue } from './StorageTransactionQueue';

/**
 * An interface for apps to interact with a storage container. The type
 * of storage that is written to is abstracted into containers that can
 * be set based on configuration or some application state.
 */
export class RecurringStorage {
  private container!: Promise<StorageContainer>;
  private readonly _changes: Subject<StorageContainerChange> = new Subject();
  protected readonly transactionQueue = new StorageTransactionQueue();
  protected initializerStrategy: (
    toMergeState: any,
    existingState?: any
  ) => any = (state, existing) => ({
    ...state,
    ...existing
  });

  /**
   * Emits change events from the storage container.
   */
  readonly changes: Observable<
    StorageContainerChange
  > = this._changes.asObservable();

  /**
   * Sets the merging strategy for the initial states of scoped storages.
   * @param merger
   */
  setInitializerStrategy<S>(
    merger: (initialState: S, existingState?: S) => S
  ): this {
    this.initializerStrategy = merger;

    return this;
  }

  /**
   * Initializes a storage state with an initial and existing state.
   * @param newState
   * @param existingState
   */
  initializeWith<S>(newState: S, existingState?: S): S {
    return this.initializerStrategy(newState, existingState);
  }

  /**
   * Gets the currently,  set container.
   */
  getContainer(): Promise<StorageContainer> {
    return this.container;
  }

  /**
   * Sets the storage container for the interface.
   * @param container The storage container instance to start writing to.
   * @returns A promise that resolves when the container is set up.
   */
  async setContainer(container: StorageContainer): Promise<void> {
    this.container = new Promise(async resolve => {
      if (this.container) {
        (await this.container).detach();
      }

      container.registerOnChange(async (type, key, value) => {
        this._changes.next(createChangeEvent(type, key, value, container));
      });

      await container.attach();

      this._changes.next(
        createChangeEvent(
          StorageChangeType.CONTAINER_CHANGE,
          '',
          undefined,
          container
        )
      );

      resolve(container);
    });

    await this.container;
  }

  /**
   * Gets an item from storage.
   * @template T
   * @param key The storage item to get at the provided key.
   * @returns A promise that resolves to the item value.
   */
  getItem<T>(key: string): Promise<T | null> {
    return this.transactionQueue
      .queueRead<T | null>(() =>
        this.container.then(container => container.getItem<T>(key))
      )
      .toPromise();
  }

  /**
   * Sets an item in storage.
   * @template T
   * @param key The key to set the value at.
   * @param value The value to set.
   * @returns A promise that resolves when the set is complete.
   */
  setItem<T>(key: string, value: T): Promise<void> {
    return this.transactionQueue
      .queueWrite(() =>
        this.container.then(container => container.setItem<T>(key, value))
      )
      .toPromise();
  }

  /**
   * Removes an item from storage.
   * @param key The key to remove from storage.
   * @returns A promise that resolves when the remove is complete.
   */
  removeItem(key: string): Promise<void> {
    return this.transactionQueue
      .queueWrite(() =>
        this.container.then(container => container.removeItem(key))
      )
      .toPromise();
  }

  /**
   * Clears all items from storage.
   * @returns A promise that resolves when all items are removed.
   */
  clear(): Promise<void> {
    return this.transactionQueue
      .queueWrite(() => this.container.then(container => container.clear()))
      .toPromise();
  }

  /**
   * Gets all items from storage.
   * @template T
   * @returns A promise that resolves with all items from the storage container.
   */
  getAll<T = any>(): Promise<{ [key: string]: T }> {
    return this.transactionQueue
      .queueRead<{ [key: string]: T }>(() =>
        this.container.then(container => container.getAll())
      )
      .toPromise();
  }

  /**
   * Determines whether the storage container has an item.
   * @param key
   * @returns A promise that resolves with a boolean.
   */
  hasItem(key: string): Promise<boolean> {
    return this.transactionQueue
      .queueRead<boolean>(() =>
        this.container.then(container => container.hasItem(key))
      )
      .toPromise();
  }

  /**
   * Creates a new storage instance using the provided container.
   * This is useful when a part of the app uses a different type of storage
   * than the globally configured storage.
   * @param container
   * @returns The new storage interface.
   */
  withContainer(container: StorageContainer): RecurringStorage {
    const storage = new RecurringStorage();

    storage.setContainer(container);

    return storage;
  }

  /**
   * Creates a storage object that is scoped to a specific key of an entry.
   * @template S
   * @param key The key to scope the storage to.
   * @returns A scoped storage object.
   */
  scope<S extends { [key: string]: any }>(
    key: string
  ): RecurringScopedStorage<S> {
    return this.scopeWith<S, RecurringScopedStorage<any>>(
      k => new RecurringScopedStorage<S>([k as string], this),
      key
    );
  }

  /**
   * Creates a storage object that is scoped to a specific key of an entry.
   * @template S
   * @param key The key to scope the storage to.
   * @returns A scoped storage object.
   */
  scopeWith<
    S extends { [key: string]: any },
    T extends RecurringScopedStorage<S>
  >(factory: (path: string) => T, key: string): T {
    return factory(key);
  }

  /**
   * Destroys the storage instance.
   */
  destroy(): void {
    this._changes.complete();
  }

  /**
   * Copies all items from one container to another.
   * @param srcContainer
   * @param destContainer
   */
  static async copy(
    srcContainer: StorageContainer,
    destContainer: StorageContainer,
    queue: StorageTransactionQueue
  ): Promise<void> {
    const items = await queue
      .queueRead(() => srcContainer.getAll())
      .toPromise();

    for (const key of Object.keys(items)) {
      await queue
        .queueWrite(() => destContainer.setItem(key, items[key]))
        .toPromise();
    }
  }

  /**
   * Copies all items from one container to another, but
   * clears the destination container before copying.
   * @param srcContainer
   * @param destContainer
   */
  static async clone(
    srcContainer: StorageContainer,
    destContainer: StorageContainer,
    queue: StorageTransactionQueue
  ): Promise<void> {
    await queue.queueWrite(() => destContainer.clear()).toPromise();
    await RecurringStorage.copy(srcContainer, destContainer, queue);
  }
}
