import { StorageContainerTest } from './testing/StorageContainerTest';
import { MemoryContainer } from './MemoryContainer';

describe('MemoryContainer', () => {
  new StorageContainerTest(() => new MemoryContainer()).generate();
});
