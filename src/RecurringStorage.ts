/*
 * Copyright 2019 TD Ameritrade. Released under the terms of the 3-Clause BSD license.  # noqa: E501
 */

import { has, isObject } from 'lodash';
import {
  Subject,
  Observable,
  ConnectableObservable,
  combineLatest
} from 'rxjs';
import {
  switchMap,
  publishReplay,
  filter,
  map,
  mapTo,
  shareReplay
} from 'rxjs/operators';

import {
  StorageContainer,
  StorageContainerChange,
  StorageChangeType,
  createChangeEvent
} from './StorageContainer';
import { RecurringScopedStorage } from './RecurringScopedStorage';
import { StorageTransactionQueue } from './StorageTransactionQueue';
import { StorageApi } from './StorageApi';
import { ScopedStorageAdapter } from './ScopedStorageAdapter';

/**
 * An interface for apps to interact with a storage container. The type
 * of storage that is written to is abstracted into containers that can
 * be set based on configuration or some application state.
 */
export class RecurringStorage<
  S extends { [key: string]: any } = { [key: string]: any }
> implements StorageApi<S> {
  private container!: Promise<StorageContainer>;
  private readonly _changes: Subject<StorageContainerChange> = new Subject();
  private readonly _initializersChanged: Subject<
    [keyof S, () => S[keyof S]]
  > = new Subject();
  protected readonly transactionQueue = new StorageTransactionQueue();
  protected readonly stateInitializers = new Map<keyof S, () => S[keyof S]>();
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
   * Emits the current state on subscription.
   */
  readonly snapshot: Observable<S> = this._changes.asObservable().pipe(
    switchMap(() => this.getAll()),
    publishReplay(1)
  );

  constructor() {
    (this.snapshot as ConnectableObservable<S>).connect();

    combineLatest(
      this.snapshot,
      this._initializersChanged.asObservable().pipe(
        mapTo(this.stateInitializers),
        shareReplay(1)
      )
    ).subscribe(([snapshot, initializers]) => {
      for (const [key, initializer] of initializers.entries()) {
        if (!has(snapshot, key) || !isObject(snapshot[key])) {
          this.setItem(key, initializer());
        }
      }
    });
  }

  async registerStateInitializer<K extends keyof S>(
    key: K,
    initializer: () => S[K]
  ): Promise<void> {
    this.stateInitializers.set(key, initializer);

    await this.setItem(
      key,
      this.initializeWith(initializer(), await this.getItem(key))
    );

    this._initializersChanged.next([key, initializer]);
  }

  getStateInitializerOrThrow<K extends keyof S>(key: K): () => S[K] {
    const initializer = this.stateInitializers.get(key);

    if (!initializer) {
      throw new Error(`No state initializer for key ${key}`);
    }

    return initializer as () => S[K];
  }

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
        this._changes.next(
          createChangeEvent(type, key, value, container as any)
        );
      });

      await container.attach();

      this._changes.next(
        createChangeEvent(
          StorageChangeType.CONTAINER_CHANGE,
          '',
          undefined,
          container as any
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
  getItem<K extends keyof S>(key: K): Promise<S[K]> {
    return this.transactionQueue
      .queueRead<S[K]>(() =>
        this.container.then(container => container.getItem<S[K]>(key as string))
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
  setItem<K extends keyof S>(
    key: K,
    value: S[K]
  ): Promise<void> {
    return this.transactionQueue
      .queueWrite(() =>
        this.container.then(container =>
          container.setItem<S[K]>(key as string, value)
        )
      )
      .toPromise();
  }

  /**
   * Removes an item from storage.
   * @param key The key to remove from storage.
   * @returns A promise that resolves when the remove is complete.
   */
  removeItem(
    key: string
  ): Promise<void> {
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
      .queueWrite(() =>
        this.container.then(container => container.clear())
      )
      .toPromise();
  }

  /**
   * Gets all items from storage.
   * @template T
   * @returns A promise that resolves with all items from the storage container.
   */
  getAll(): Promise<S> {
    return this.transactionQueue
      .queueRead<S>(() => this.container.then(container => container.getAll()))
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
   * Sets multiple items in storage.
   * @param items Items to put in storage.
   */
  async setItems(
    items: Partial<S>
  ): Promise<void> {
    for (const key of Object.keys(items)) {
      await this.transactionQueue
        .queueWrite(() =>
          this.container.then(container =>
            container.setItem(key, items[key])
          )
        )
        .toPromise();
    }
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
  scope<K extends keyof S>(
    key: K,
    stateInitializer: () => S[K]
  ): RecurringScopedStorage<S, K> {
    return this.scopeWith<K, RecurringScopedStorage<S, K>>(
      (_key, adapter) => new RecurringScopedStorage<S, K>(key, adapter),
      key,
      stateInitializer
    );
  }

  /**
   * Creates a storage object that is scoped to a specific key of an entry.
   * @template S
   * @param key The key to scope the storage to.
   * @returns A scoped storage object.
   */
  scopeWith<K extends keyof S, T extends RecurringScopedStorage<S, K>>(
    factory: (key: K, adapter: ScopedStorageAdapter<S[K]>) => T,
    key: K,
    stateInitializer?: () => S[K]
  ): T {
    let registerPromise = Promise.resolve();

    if (stateInitializer) {
      registerPromise = this.registerStateInitializer(key, stateInitializer);
    }

    return factory(
      key,
      new ScopedStorageAdapter<S[K]>(
        async (adapter, context) => {
          context.setGetter(() => this.getItem(key));
          context.setSetter(value => this.setItem(key, value));
          context.setSnapshotSource(
            this.snapshot.pipe(map(value => value[key]))
          );

          adapter.add(
            combineLatest(this.snapshot, registerPromise).subscribe(([value]) =>
              context.setInitialized(has(value, key) && isObject(value[key]))
            )
          );
        },
        () => this.getStateInitializerOrThrow(key)()
      )
    );
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
