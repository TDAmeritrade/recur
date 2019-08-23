import { Observable } from 'rxjs';

export interface StorageApi<T extends { [key: string]: any }> {
  snapshot: Observable<T>;
  setItem(key: keyof T, value: T[keyof T]): Promise<void>;
  setItems(key: Partial<T>): Promise<void>;
  getItem<K extends keyof T>(key: K): Promise<T[K]>;
  removeItem(key: keyof T): Promise<void>;
  getAll(): Promise<T>;
  clear(): Promise<void>;
}
