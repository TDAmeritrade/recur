import { StorageContainerTest } from './testing/StorageContainerTest';
import { MemoryContainer } from './MemoryContainer';
import {JEST_TESTER} from './testing/JestTester';

describe('MemoryContainer', () => {
  new StorageContainerTest(() => new MemoryContainer(), JEST_TESTER).generate();
});
