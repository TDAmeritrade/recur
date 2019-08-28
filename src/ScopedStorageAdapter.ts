import { BehaviorSubject, Subscription, Observable, EMPTY } from 'rxjs';
import { switchMap, filter, take, mapTo, tap, distinctUntilChanged } from 'rxjs/operators';

import { StorageTransactionType } from './StorageTransactionQueue';

export type StateKey<S extends { [key: string]: any }> = keyof S;
export type StateValue<
  S extends { [key: string]: any },
  K extends keyof S
> = S[K];

export interface ScopedStorageAdapterContext<S extends { [key: string]: any }> {
  setInitialized(initialized: boolean): void;
  setSetter(setter: (value: S) => Promise<void>): void;
  setGetter(getter: () => Promise<S>): void;
  setSnapshotSource(source: Observable<S>): void;
  setTransaction(
    fn: (type: StorageTransactionType, fn: () => Promise<any>) => Promise<any>
  ): void;
}

export class ScopedStorageAdapter<
  S extends { [key: string]: any }
> extends Subscription {
  private readonly _initialized = new BehaviorSubject<boolean>(false);
  private _setter!: (value: S) => Promise<void>;
  private _getter!: () => Promise<S>;
  private _transaction!: <T>(
    type: StorageTransactionType,
    fn: () => Promise<T>
  ) => Promise<T>;
  private _snapshotSource!: Observable<S>;

  readonly initialized = this._initialized.asObservable();

  readonly snapshot = this.initialized.pipe(
    distinctUntilChanged(),
    switchMap(initialized => (initialized ? this._snapshotSource : EMPTY))
  );

  constructor(
    private _sink: (
      adapter: ScopedStorageAdapter<S>,
      context: ScopedStorageAdapterContext<S>
    ) => void,
    private _stateInitializer: () => S
  ) {
    super(() => this._initialized.complete());

    this._sink(this, {
      setInitialized: initialized => this._initialized.next(initialized),
      setSetter: setter => (this._setter = setter),
      setGetter: getter => (this._getter = getter),
      setTransaction: fn => (this._transaction = fn),
      setSnapshotSource: source => (this._snapshotSource = source)
    });
  }

  whenInitialized(): Promise<void> {
    return this.initialized.pipe(
      filter(Boolean),
      take(1),
      mapTo(undefined)
    ).toPromise();
  }

  async setItem(value: S): Promise<void> {
    await this._setter(value);
  }

  async getItem(): Promise<S> {
    return await this._getter();
  }

  getInitialState(): S {
    return this._stateInitializer();
  }

  async transaction<T>(
    type: StorageTransactionType,
    fn: () => Promise<T>
  ): Promise<T> {
    return this.whenInitialized().then(() => this._transaction(type, fn));
  }

  async readTransaction<T>(
    fn: () => Promise<T>
  ): Promise<T> {
    return this.transaction(StorageTransactionType.READ, fn);
  }

  async writeTransaction<T>(
    fn: () => Promise<T>
  ): Promise<T> {
    return this.transaction(StorageTransactionType.WRITE, fn);
  }
}
