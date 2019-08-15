import { get } from 'lodash';
import { take, map } from 'rxjs/operators';

import { RecurringScopedStorage } from './RecurringScopedStorage';
import { RecurringStorage } from './RecurringStorage';

/**
 * A scoped storage object the initializes based on the given root key of an object.
 */
export class ParentPathInitializedScopedStorage<
  S extends { [key: string]: any }
> extends RecurringScopedStorage<S> {
  constructor(
    path: string[],
    storage: RecurringStorage,
    private parentInitializer: RecurringScopedStorage<any>
  ) {
    super(path, storage);
  }

  initialize(): this {
    return this.delegateInitialization(() =>
      this.parentInitializer.snapshot
        .pipe(
          map(
            value =>
              [
                value,
                () =>
                  get(
                    this.parentInitializer.getInitialState(),
                    this.path.slice(1),
                    {}
                  )
              ] as [S, () => S]
          ),
          take(1)
        )
        .toPromise()
    );
  }

  scope<K extends keyof S>(key: K): ParentPathInitializedScopedStorage<S[K]> {
    return this.scopeWith(
      (path, storage) =>
        new ParentPathInitializedScopedStorage<S[K]>(
          path,
          storage,
          this.parentInitializer
        ),
      key
    );
  }
}
