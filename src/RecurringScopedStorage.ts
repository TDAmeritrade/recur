/*
 * Copyright 2019 TD Ameritrade. Released under the terms of the 3-Clause BSD license.  # noqa: E501
 */

import { set, unset, has, isObject, get, last } from 'lodash';
import { Subject, Observable, ReplaySubject } from 'rxjs';

import { RecurringStorage } from './RecurringStorage';
import {
  StorageContainerChange,
  StorageChangeType,
  createChangeEvent
} from './StorageContainer';
import { switchMap } from 'rxjs/operators';

/**
 * Scopes down to a key in storage. All calls will interact with that
 * scoped down key.
 */
export class RecurringScopedStorage<
  S extends { [key: string]: any },
  R extends { [key: string]: any } = { [key: string]: any }
> {
  private _changes: Subject<
    StorageContainerChange<S, S[keyof S]>
  > = new Subject();
  readonly changes: Observable<
    StorageContainerChange<S, S[keyof S]>
  > = this._changes.asObservable();

  private _snapshot: ReplaySubject<S> = new ReplaySubject(1);

  /**
   * An observable that emits the last state of the storage.
   */
  readonly snapshot: Observable<S> = this._snapshot.asObservable();

  private resolveInitial: Function = () => {};
  readonly initialized: Promise<void> = new Promise(
    resolve => (this.resolveInitial = resolve)
  );
  protected initializer: () => S = () => ({} as S);

  private _lastSnapshot: S = {} as S;

  constructor(protected path: string[], protected storage: RecurringStorage) {
    this.snapshot.subscribe(snapshot => (this._lastSnapshot = snapshot));
  }

  /**
   * The last snapshot state of the storage.
   * @readonly
   */
  get lastSnapshot(): S {
    return this._lastSnapshot;
  }

  async getItem<K extends keyof S>(key: K): Promise<S[K]> {
    await this.initialized;

    return await this.getAll().then(obj => obj[key]);
  }

  async setItem<K extends keyof S>(key: K, value: S[K]): Promise<void> {
    await this.initialized;

    const item = await this.storage.getItem<S>(this.path[0]!);

    if (item) {
      set(item, [...this.path.slice(1), key], value);
      await this.storage.setItem(this.path[0], item);

      this._changes.next(
        createChangeEvent<S, S[K]>(
          StorageChangeType.UPDATE,
          key as string,
          value,
          this
        )
      );
    }
  }

  /**
   * Sets multiple items. This will be a single write, but
   * will generate a change event for each item.
   * @param values
   */
  async setItems(values: Partial<S>): Promise<void> {
    await this.initialized;

    const item = await this.storage.getItem<S>(this.path[0]!);
    const keys = Object.keys(values);

    if (item) {
      for (const key of keys) {
        set(item, [...this.path.slice(1), key], values[key]);
      }

      await this.storage.setItem(this.path[0], item);

      for (const key of keys) {
        this._changes.next(
          createChangeEvent<S, S[keyof S]>(
            StorageChangeType.UPDATE,
            key as string,
            values[key]!,
            this
          )
        );
      }
    }
  }

  async removeItem<K extends keyof S>(key: K): Promise<void> {
    await this.initialized;

    const item = await this.storage.getItem<S>(this.path[0]!);

    if (item) {
      unset(item, [...this.path.slice(1), key]);

      await this.storage.setItem(this.path[0], item);

      this._changes.next(
        createChangeEvent(
          StorageChangeType.DELETE,
          key as string,
          undefined!,
          this
        )
      );
    }
  }

  async clear(): Promise<void> {
    await this.initialized;

    if (this.path.length > 1) {
      const item = await this.storage.getItem<S>(this.path[0]!);

      if (item) {
        set(item, this.path.slice(1), this.initializer());
        await this.storage.setItem(this.path[0], item);
      }
    } else {
      await this.storage.setItem(this.path[0], this.initializer());
    }

    this._changes.next(
      createChangeEvent(StorageChangeType.CLEARED, '', undefined!, this)
    );
  }

  async getAll(): Promise<S> {
    await this.initialized;

    return await this._getAll();
  }

  async hasItem<K extends keyof S>(key: K): Promise<boolean> {
    await this.initialized;

    return await this.storage
      .getItem<S>(this.path[0]!)
      .then(item => has(item!, [...this.path.slice(1), key]));
  }

  getInitialState(): S {
    return this.initializer();
  }

  /**
   * Scopes to a nested storage key.
   * @param key
   */
  scope<K extends keyof S>(key: K): RecurringScopedStorage<S[K]> {
    return this.scopeWith(
      (path, storage) => new RecurringScopedStorage(path, storage),
      key
    );
  }

  /**
   * Scopes to a nested storage key using the factory to create the scoped storage.
   * @param factory
   * @param key
   */
  scopeWith<T extends RecurringScopedStorage<S[K]>, K extends keyof S>(
    factory: (path: string[], storage: RecurringStorage) => T,
    key: K
  ): T {
    return factory([...this.path, key as string], this.storage);
  }

  destroy(): void {
    this._changes.complete();
    this._snapshot.complete();
  }

  /**
   * Initializes the storage using a custom merge strategy.
   * @see RecurringScopedStorage#initialize
   * @param initializer
   */
  initializeWithStrategy(initializer: (existing?: S, root?: R) => S): this {
    return this._initialize(initializer);
  }

  /**
   * Initializes the scoped storage. This will get the item from storage
   * and if the key that this storage is scoped down to is not created
   * then the initializer function will be called and the result will be set
   * into storage under this storage scoped key.
   * @param initializer
   */
  initialize(initializer: () => S): this {
    return this._initialize(root =>
      this.storage.initializeWith(initializer(), root)
    );
  }

  /**
   * Delegates initialization to a delegate function.
   * This is used when some other service sets and initializes the state.
   * The delegate function resolves to delegator function that will produce
   * the initial state.
   * @param delegate
   */
  delegateInitialization(delegate: () => Promise<[S, () => S]>): this {
    delegate().then(([state, initializer]) => {
      this.initializer = initializer;
      this._snapshot.next(state);
      this.resolveInitial();
    });

    this.listenToChanges();

    return this;
  }

  private _initialize(initializer: (existingState?: S, root?: R) => S): this {
    this.initializer = initializer;
    this.storage
      .getItem(this.path[0])
      .then(item =>
        this.path.length === 1
          ? initializer(item as S)
          : isObject(item)
          ? item
          : {}
      )
      .then(item => {
        const lastKey = last(this.path);

        this.path
          .slice(1)
          .reduce((res: { [key: string]: any }, pathKey: string) => {
            if (pathKey === lastKey) {
              res[pathKey] = initializer(res[pathKey], item as R);
            } else if (!isObject(res[pathKey])) {
              res[pathKey] = {};
            }

            return res[pathKey];
          }, item);

        return item;
      })
      .then(item => this.storage.setItem(this.path[0], item))
      .then(() => this._getAll())
      .then(snapshot => this._snapshot.next(snapshot))
      .then(() => this.resolveInitial());

    this.listenToChanges();

    return this;
  }

  private listenToChanges(): void {
    this.initialized.then(() =>
      this.changes
        .pipe(switchMap(change => change.snapshot))
        .subscribe(snapshot => this._snapshot.next(snapshot))
    );
  }

  private _getAll(): Promise<S> {
    return this.storage
      .getItem(this.path[0])
      .then(item =>
        this.path.length > 1 ? get(item, this.path.slice(1)) : item
      );
  }
}
