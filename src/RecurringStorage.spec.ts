import { RecurringStorage } from './RecurringStorage';
import { MemoryContainer } from './MemoryContainer';
import { StorageChangeType } from './StorageContainer';
import { RecurringScopedStorage } from './RecurringScopedStorage';
import { StorageTransactionQueue } from './StorageTransactionQueue';

describe('RecurringStorage', () => {
  let storage: RecurringStorage;
  let container: MemoryContainer;

  beforeEach(() => {
    storage = new RecurringStorage();
    container = new MemoryContainer();
  });

  afterEach(() => {
    storage.destroy();
  });

  describe('when setting the container', () => {
    beforeEach(() => {
      container.detach = jest.fn(container.detach);
      container.attach = jest.fn(container.attach);
    });

    it('should attach the container', async () => {
      await storage.setContainer(container);
      expect(container.attach).toHaveBeenCalled();
    });

    it('should emit a container change event', done => {
      storage.changes.subscribe(async event => {
        const snapshot = await event.snapshot;

        expect(event.type).toBe(StorageChangeType.CONTAINER_CHANGE);
        expect(event.key).toBe('');
        expect(event.value).toBe(undefined);
        expect(snapshot).toEqual({});

        done();
      });
      storage.setContainer(container);
    });

    describe('when there is an existing container', () => {
      it('should detach the previous container', async () => {
        await storage.setContainer(container);
        await storage.setContainer(new MemoryContainer());
        expect(container.detach).toHaveBeenCalled();
      });
    });
  });

  describe('when the container has a storage changes', () => {
    beforeEach(async () => {
      await storage.setContainer(container);
    });

    it('should emit an event', done => {
      storage.changes.subscribe(async event => {
        const snapshot = await event.snapshot;

        expect(event.type).toBe(StorageChangeType.UPDATE);
        expect(event.key).toBe('test');
        expect(event.value).toBe(123);
        expect(snapshot).toEqual({ test: 123 });

        done();
      });

      container.setItem('test', 123);
    });
  });

  describe('when getting an item', () => {
    beforeEach(async () => {
      await storage.setContainer(container);
    });

    it('should get the item from the container', async () => {
      await storage.setItem('test', 123);
      expect(await storage.getItem('test')).toBe(123);
    });
  });

  describe('when setting an item', () => {
    beforeEach(async () => {
      await storage.setContainer(container);
    });

    it('should set the item', async () => {
      await storage.setItem('test', 123);
      expect(await storage.getItem('test')).toBe(123);
    });
  });

  describe('when removing an item', () => {
    beforeEach(async () => {
      await storage.setContainer(container);
    });

    it('should remove the item', async () => {
      await storage.setItem('test', 123);
      await storage.removeItem('test');
      expect(await storage.hasItem('test')).toBe(false);
    });
  });

  describe('when clearing all items', () => {
    beforeEach(async () => {
      await storage.setContainer(container);
    });

    it('should clear all items', async () => {
      await storage.setItem('test', 123);
      await storage.clear();
      expect(await storage.getAll()).toEqual({});
    });
  });

  describe('when getting all items', () => {
    beforeEach(async () => {
      await storage.setContainer(container);
    });

    it('should clear all items', async () => {
      await storage.setItem('test', 123);
      expect(await storage.getAll()).toEqual({ test: 123 });
    });
  });

  describe('when determining whether an item exists', () => {
    beforeEach(async () => {
      await storage.setContainer(container);
    });

    describe('when an item exists', () => {
      it('should return true', async () => {
        await storage.setItem('test', 123);
        expect(await storage.hasItem('test')).toBe(true);
      });
    });

    describe('when an item does not exist', () => {
      it('should return true', async () => {
        expect(await storage.hasItem('blorg')).toBe(false);
      });
    });
  });

  describe('when using a new container', () => {
    it('should return a new instance using the container', async () => {
      const container = new MemoryContainer();
      const newStorage = storage.withContainer(container);

      expect(newStorage).toBeInstanceOf(RecurringStorage);
      expect(await newStorage.getContainer()).toBe(container);
    });
  });

  describe('when scoping storage', () => {
    it('should return a scoped storage', () => {
      const scoped = storage.scope('test', () => ({}));

      expect(scoped).toBeInstanceOf(RecurringScopedStorage);
    });
  });

  describe('when copying containers', () => {
    it('should copy all the items', async () => {
      const src = new MemoryContainer();
      const dest = new MemoryContainer();

      await src.setItem('test', 1);
      await src.setItem('test2', 2);
      await dest.setItem('test3', 3);

      await RecurringStorage.copy(src, dest, new StorageTransactionQueue());

      expect(await dest.getAll()).toEqual({
        test: 1,
        test2: 2,
        test3: 3
      });
    });
  });

  describe('when cloning containers', () => {
    it('should copy all the items', async () => {
      const src = new MemoryContainer();
      const dest = new MemoryContainer();

      await src.setItem('test', 1);
      await src.setItem('test2', 2);
      await dest.setItem('test3', 3);

      await RecurringStorage.clone(src, dest, new StorageTransactionQueue());

      expect(await dest.getAll()).toEqual({
        test: 1,
        test2: 2
      });
    });
  });
});
