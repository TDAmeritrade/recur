/*
 * Copyright 2019 TD Ameritrade. Released under the terms of the 3-Clause BSD license.  # noqa: E501
 */

import { set, unset, has, get, isObject } from 'lodash';
import { Subject, Observable, Subscription } from 'rxjs';
import { map, filter, mapTo, take } from 'rxjs/operators';

import {
  StorageContainerChange,
  StorageChangeType,
  createChangeEvent
} from './StorageContainer';
import { StorageApi } from './StorageApi';
import { ScopedStorageAdapter } from './ScopedStorageAdapter';

/**
 * Scopes down to a key in storage. All calls will interact with that
 * scoped down key.
 */
export class RecurringScopedStorage<
  R extends { [key: string]: any } = { [key: string]: any },
  K extends keyof R = string
> extends Subscription implements StorageApi<R[K]> {
  private _changes: Subject<
    StorageContainerChange<R[K], R[K][keyof R[K]]>
  > = new Subject();
  readonly changes: Observable<
    StorageContainerChange<R[K], R[K][keyof R[K]]>
  > = this._changes.asObservable();

  /**
   * An observable that emits the last state of the storage.
   */
  readonly snapshot = this.adapter.snapshot;

  private _lastSnapshot: R[K] = {} as R[K];

  constructor(
    protected readonly key: keyof R,
    protected readonly adapter: ScopedStorageAdapter<R[K]>
  ) {
    super(() => this._changes.complete());
    this.add(this.adapter);
    this.snapshot.subscribe(snapshot => (this._lastSnapshot = snapshot));
  }

  /**
   * The last snapshot state of the storage.
   * @readonly
   */
  get lastSnapshot(): R[K] {
    return this._lastSnapshot;
  }

  get initialized(): Promise<void> {
    return this.adapter.initialized
      .pipe(
        filter<boolean>(Boolean),
        take(1),
        mapTo(undefined)
      )
      .toPromise();
  }

  async getItem<H extends keyof R[K]>(key: H): Promise<R[K][H]> {
    await this.initialized;

    return get(await this.adapter.getItem(), key);
  }

  async setItem<H extends keyof R[K]>(key: H, value: R[K][H]): Promise<void> {
    await this.initialized;

    const item = await this.adapter.getItem();

    if (item) {
      set(item, key, value);
      await this.adapter.setItem(item);

      this._changes.next(
        createChangeEvent<R[K], R[K][H]>(
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
  async setItems(values: Partial<R[K]>): Promise<void> {
    await this.initialized;

    const item = await this.adapter.getItem();
    const keys = Object.keys(values);

    if (item) {
      for (const key of keys) {
        set(item, key, values[key]);
      }

      await this.adapter.setItem(item);

      for (const key of keys) {
        this._changes.next(
          createChangeEvent<R[K], R[K][keyof R[K]]>(
            StorageChangeType.UPDATE,
            key as string,
            values[key]!,
            this
          )
        );
      }
    }
  }

  async removeItem<H extends keyof R[K]>(key: H): Promise<void> {
    await this.initialized;

    const item = await this.adapter.getItem();

    if (item) {
      unset(item, key);

      await this.adapter.setItem(item);

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
    await this.adapter.setItem(this.adapter.getInitialState());

    this._changes.next(
      createChangeEvent(StorageChangeType.CLEARED, '', undefined!, this)
    );
  }

  async getAll(): Promise<R[K]> {
    await this.initialized;

    return await this.adapter.getItem();
  }

  async hasItem<H extends keyof R[K]>(key: H): Promise<boolean> {
    await this.initialized;

    return has(await this.adapter.getItem(), key);
  }

  /**
   * Scopes to a nested storage key.
   * @param key
   */
  scope<H extends keyof R[K]>(key: H): RecurringScopedStorage<R[K], H> {
    return this.scopeWith(
      (key, adapter) => new RecurringScopedStorage<R[K], H>(key, adapter),
      key
    );
  }

  /**
   * Scopes to a nested storage key using the factory to create the scoped storage.
   * @param factory
   * @param key
   */
  scopeWith<S extends RecurringScopedStorage<R[K], H>, H extends keyof R[K]>(
    factory: (key: H, adapter: ScopedStorageAdapter<R[K][H]>) => S,
    key: H
  ): S {
    return factory(
      key,
      new ScopedStorageAdapter(
        (adapter, context) => {
          context.setGetter(() => this.getItem(key));
          context.setSetter(value => this.setItem(key, value));
          context.setSnapshotSource(
            this.snapshot.pipe(map(snapshot => snapshot[key]))
          );
          adapter.add(
            this.snapshot.subscribe(snapshot =>
              context.setInitialized(
                has(snapshot, key) && isObject(snapshot[key])
              )
            )
          );
        },
        () => this.adapter.getInitialState()[key]
      )
    );
  }
}
