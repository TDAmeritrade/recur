/*
 * Copyright 2019 TD Ameritrade. Released under the terms of the 3-Clause BSD license.  # noqa: E501
 */

import { StorageContainer, StorageChangeType } from '../StorageContainer';

export interface StorageContainerTester {
  assertEquals: (actual: any, expected: any) => void;
  assertStrictEquals: (actual: any, expected: any) => void;
  assertCalled: (spy: Function, ...params: any[]) => void;
  spy: (fn: Function) => Function
}

export class StorageContainerTest {
  constructor(
    private setup: () => StorageContainer,
    private tester: StorageContainerTester
  ) {}

  generate(): void {
    let container: StorageContainer;
    let onChange: any;

    beforeEach(async () => {
      onChange = this.tester.spy(() => Promise.resolve());
      container = this.setup();
      container.registerOnChange(onChange);
      await container.attach();
    });

    afterEach(async () => {
      await container.detach();
    });

    describe('when getting an item', () => {
      it('should get the item', async () => {
        await container.setItem('test', { abc: 123 });
        this.tester.assertEquals(await container.getItem('test'), { abc: 123 });
      });
    });

    describe('when setting an item', () => {
      it('should set the item as a string', async () => {
        await container.setItem('test', true);
        this.tester.assertStrictEquals(await container.getItem('test'), true);
      });

      it('should trigger a change event', async () => {
        await container.setItem('test', true);
        this.tester.assertCalled(onChange, 
          StorageChangeType.UPDATE,
          'test',
          true
        );
      });
    });

    describe('when removing an item', () => {
      it('should remove the item', async () => {
        await container.setItem('test', true);
        this.tester.assertStrictEquals(await container.hasItem('test'), true);
        await container.removeItem('test');
        this.tester.assertStrictEquals(await container.hasItem('test'), false);
      });

      it('should trigger a change event', async () => {
        await container.setItem('test', true);
        await container.removeItem('test');
        this.tester.assertCalled(onChange, 
          StorageChangeType.DELETE,
          'test',
          undefined
        );
      });
    });

    describe('when clearing all items', () => {
      it('should clear all items', async () => {
        await container.setItem('test', true);
        await container.clear();
        this.tester.assertStrictEquals(await container.hasItem('test'), false);
      });

      it('should trigger a change event', async () => {
        await container.setItem('test', true);
        await container.clear();
        this.tester.assertCalled(onChange,
          StorageChangeType.CLEARED,
          '',
          undefined
        );
      });
    });

    describe('when getting all items', () => {
      it('should get all items', async () => {
        await container.setItem('test', {});
        this.tester.assertEquals(await container.getAll(), { test: {} });
      });
    });

    describe('when determining whether there is an item', () => {
      describe('when there is an item', () => {
        it('should return true', async () => {
          await container.setItem('test', {});
          this.tester.assertStrictEquals(await container.hasItem('test'), true);
        });
      });

      describe('when there is not an item', () => {
        it('should return false', async () => {
          this.tester.assertStrictEquals(await container.hasItem('test'), false);
        });
      });
    });
  }
}
