/*
 * Copyright 2019 TD Ameritrade. Released under the terms of the 3-Clause BSD license.  # noqa: E501
 */

import {
  Subject,
  Observable,
  OperatorFunction,
  Subscriber,
  Observer
} from 'rxjs';
import { uniqueId } from 'lodash';
import { share } from 'rxjs/operators';

export enum StorageTransactionType {
  READ = 'READ',
  WRITE = 'WRITE'
}

export interface StorageTransaction {
  id: string;
  type: StorageTransactionType;
  work: () => Promise<any>;
}

export interface StorageTransactionResult<T> extends StorageTransaction {
  type: StorageTransactionType;
  result: T;
}

/**
 * Queues storage transactions to avoid race conditions.
 */
export class StorageTransactionQueue {
  private _queueSource$ = new Subject<StorageTransaction>();
  private queue$ = this._queueSource$.asObservable().pipe(
    StorageTransactionQueue.queueTransactions<any>(),
    share()
  );

  queueRead<T>(work: () => Promise<T>): Observable<T> {
    return this.queue<T>({
      work,
      id: uniqueId(),
      type: StorageTransactionType.READ
    });
  }

  queueWrite(work: StorageTransaction['work']): Observable<void> {
    return this.queue({
      work,
      id: uniqueId(),
      type: StorageTransactionType.WRITE
    });
  }

  queue<T>(transaction: StorageTransaction): Observable<T> {
    return new Observable<T>(subscriber => {
      const subscription = this.queue$.subscribe({
        next: nextTrans => {
          if (transaction.id === nextTrans.id) {
            subscriber.next(nextTrans.result);
            subscriber.complete();
          }
        },
        error: err => subscriber.error(err),
        complete: () => subscriber.complete()
      });

      this._queueSource$.next(transaction);

      return subscription;
    });
  }

  static queueTransactions<T>(): OperatorFunction<
    StorageTransaction,
    StorageTransactionResult<T>
  > {
    return source =>
      new Observable<StorageTransactionResult<T>>(subscriber =>
        source.subscribe(new StorageTransactionQueueSubscriber(subscriber))
      );
  }
}

export class StorageTransactionQueueSubscriber<T>
  implements Observer<StorageTransaction> {
  private _queue: StorageTransaction[] = [];
  private isIdle = true;

  constructor(private subscriber: Subscriber<StorageTransactionResult<T>>) {}

  error(err: Error): void {
    this.subscriber.error(err);
  }

  next(transaction: StorageTransaction): void {
    this._queue.push(transaction);

    if (this.isIdle) {
      this.run();
    }
  }

  complete(): void {
    this.subscriber.complete();
  }

  async run(): Promise<void> {
    this.isIdle = false;

    const next = this._queue.shift();

    if (next) {
      if (next.type === StorageTransactionType.WRITE) {
        const result = await next.work();

        this.subscriber.next({
          ...next,
          result
        });

        this.run();
      } else {
        const reads = [next];
        let nextRead = this._queue[0];

        while (nextRead && nextRead.type !== StorageTransactionType.WRITE) {
          reads.push(nextRead);
          this._queue.shift();
          nextRead = this._queue[0];
        }

        (await Promise.all(
          reads.map(trans =>
            trans.work().then(result => ({ ...trans, result }))
          )
        )).forEach(result => this.subscriber.next(result));

        this.run();
      }
    } else {
      this.isIdle = true;
    }
  }
}
