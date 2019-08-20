import { StorageContainerTest } from './testing/StorageContainerTest';
import { IndexedDBContainer } from './IndexedDBContainer';
import {JEST_TESTER} from './testing/JestTester';

require('fake-indexeddb/auto');

describe('IndexedDBContainer', () => {
  new StorageContainerTest(() => {
    try {
      indexedDB.deleteDatabase('Test');
    } catch {}

    return new IndexedDBContainer(indexedDB, {
      databaseName: 'Test',
      databaseVersion: 1
    });
  }, JEST_TESTER).generate();
});
