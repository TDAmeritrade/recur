import { RecurringScopedStorage } from './RecurringScopedStorage';
import { RecurringStorage } from './RecurringStorage';
import { MemoryContainer } from './MemoryContainer';
import { StorageChangeType } from './StorageContainer';

describe('RecurringScopedStorage', () => {
  let storage: RecurringScopedStorage<{ test: { id: string } }>;
  let appStorage: RecurringStorage;

  beforeEach(async () => {
    appStorage = new RecurringStorage();
    appStorage.setContainer(new MemoryContainer());
    storage = new RecurringScopedStorage<{ test: { id: string } }>(
      ['value'],
      appStorage
    ).initialize(() => ({
      test: { id: '' }
    }));

    await appStorage.getContainer();
  });

  describe('when getting an item', () => {
    it('should get the item', async () => {
      await storage.setItem('test', { id: '123' });
      expect(await storage.getItem('test')).toEqual({ id: '123' });
    });
  });

  describe('when setting an item', () => {
    it('should set the item', async () => {
      await storage.setItem('test', { id: '123' });
      expect(await storage.getItem('test')).toEqual({ id: '123' });
    });

    it('should trigger a change event', done => {
      storage.changes.subscribe(async event => {
        const snapshot = await event.snapshot;

        expect(event.type).toBe(StorageChangeType.UPDATE);
        expect(event.key).toBe('test');
        expect(event.value).toEqual({ id: '123' });
        expect(snapshot).toEqual({ test: { id: '123' } });

        done();
      });
      storage.setItem('test', { id: '123' });
    });
  });

  describe('when removing an item', () => {
    it('should remove the item', async () => {
      await storage.removeItem('test');
      expect(await storage.hasItem('test')).toBe(false);
    });

    it('should trigger a change event', done => {
      storage.changes.subscribe(async event => {
        const snapshot = await event.snapshot;

        expect(event.type).toBe(StorageChangeType.DELETE);
        expect(event.key).toBe('test');
        expect(event.value).toBe(undefined);
        expect(snapshot).toEqual({});

        done();
      });
      storage.removeItem('test');
    });
  });

  describe('when clearing all items', () => {
    it('should clear all items back to the initializer values', async () => {
      await storage.setItem('test', { id: '123' });
      await storage.clear();
      expect(await storage.getItem('test')).toEqual({ id: '' });
    });

    it('should trigger a change event', done => {
      storage.changes.subscribe(async event => {
        const snapshot = await event.snapshot;

        expect(event.type).toBe(StorageChangeType.CLEARED);
        expect(event.key).toBe('');
        expect(event.value).toBe(undefined);
        expect(snapshot).toEqual({ test: { id: '' } });

        done();
      });
      storage.clear();
    });
  });

  describe('when getting all items', () => {
    it('should get all items', async () => {
      expect(await storage.getAll()).toEqual({ test: { id: '' } });
    });
  });

  describe('when determining whether there is an item', () => {
    describe('when there is an item', () => {
      it('should return true', async () => {
        expect(await storage.hasItem('test')).toBe(true);
      });
    });

    describe('when there is not an item', () => {
      it('should return false', async () => {
        await storage.removeItem('test');
        expect(await storage.hasItem('test')).toBe(false);
      });
    });
  });

  describe('when merging initial state', () => {
    it('should use the correct merge strategy', async () => {
      appStorage.setInitializerStrategy((initial, existing) => ({
        ...existing,
        ...initial
      }));

      await appStorage.setItem('blorg', { resource: { value: 123 } });
      await appStorage
        .scope('blorg')
        .scope('resource')
        .initialize(() => ({ value: 555 })).initialized;

      expect(await appStorage.getItem('blorg')).toEqual({
        resource: { value: 555 }
      });
    });
  });
});
