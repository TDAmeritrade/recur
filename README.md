# recur
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2FTDAmeritrade%2Frecur.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2FTDAmeritrade%2Frecur?ref=badge_shield)


Recur is persistent storage library that integrates with different types of storage APIs.

## Install

`npm install @tdameritrade/recur`

## Usage

Create a recurring storage object and set the storage container you would like to use. Your app interacts with the recurring storage instance. The storage container can be swapped out with a different API without having to change the usage in you application.

For example, you can use local storage to store application configuration and then switch to indexedDB without affecting your application.

```typescript
import { RecurringStorage, LocalStorageContainer } from '@tdameritrade/recur';

const storage = new RecurringStorage();
const container = new LocalStorageContainer(window.localStorage);

storage.setContainer(container);

await storage.setItem('test', { value: 123 });

const value = await storage.getItem('test'); //=> { value: 123 }
```

All APIs are async and will return Promises.

### Scoping to a specific key

You can scope a storage down to a specific key of a stored item. Take the following example.

```typescript
await storage.setItem('config', { grids: { refreshAsync: true } });

// In our grid component we can use just this grid config.

const gridStorage = storage.scope('grids');

await gridStorage.setItem('refreshAsync', false);
await storage.getItem('config'); //=> { grids: { refreshAsync: false } }
```

### Writing your own containers

A couple containers are provided, but you can easily write your own, for example to communicate with a database. Just implement the `StorageContainer` interface.

### Access control 

Recur has a built in access control mechanism for preventing reads/writes that would result in stale or overwritten data. You can find out more about this by referencing the `StorageTransationQueue`.


## License
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2FTDAmeritrade%2Frecur.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2FTDAmeritrade%2Frecur?ref=badge_large)