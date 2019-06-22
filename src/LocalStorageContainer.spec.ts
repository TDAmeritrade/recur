import { StorageContainerTest } from './testing/StorageContainerTest';
import { LocalStorageContainer } from './LocalStorageContainer';

class LocalStorageMock implements Storage {
  getItem(key: string): string {
    return (this as any)[key];
  }

  setItem(key: string, value: string): void {
    (this as any)[key] = value;
  }

  removeItem(key: string): void {
    if (Object.prototype.hasOwnProperty.call(this, key)) {
      delete (this as any)[key];
    }
  }

  clear(): void {
    Object.keys(this).forEach(key => this.removeItem(key));
  }

  key(index: number): string | null {
    return null;
  }

  get length(): number {
    return Object.keys(this).length;
  }
}

describe('LocalStorageContainer', () => {
  new StorageContainerTest(
    () => new LocalStorageContainer(new LocalStorageMock())
  ).generate();
});
