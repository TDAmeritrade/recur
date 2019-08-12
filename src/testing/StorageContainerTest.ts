/*
 * Copyright 2019 TD Ameritrade. Released under the terms of the 3-Clause BSD license.  # noqa: E501
 */

import { StorageContainer, StorageChangeType } from '../StorageContainer';

export class StorageContainerTest {
  constructor(private setup: () => StorageContainer) {}

  generate(): void {
    let container: StorageContainer;
    let onChange: jest.Mock;

    beforeEach(async () => {
      onChange = jest.fn(() => Promise.resolve());
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
        expect(await container.getItem('test')).toEqual({ abc: 123 });
      });
    });

    describe('when setting an item', () => {
      it('should set the item as a string', async () => {
        await container.setItem('test', true);
        expect(await container.getItem('test')).toBe(true);
      });

      it('should trigger a change event', async () => {
        await container.setItem('test', true);
        expect(onChange).toHaveBeenCalledWith(
          StorageChangeType.UPDATE,
          'test',
          true
        );
      });
    });

    describe('when removing an item', () => {
      it('should remove the item', async () => {
        await container.setItem('test', true);
        expect(await container.hasItem('test')).toBe(true);
        await container.removeItem('test');
        expect(await container.hasItem('test')).toBe(false);
      });

      it('should trigger a change event', async () => {
        await container.setItem('test', true);
        await container.removeItem('test');
        expect(onChange).toHaveBeenCalledWith(
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
        expect(await container.hasItem('test')).toBe(false);
      });

      it('should trigger a change event', async () => {
        await container.setItem('test', true);
        await container.clear();
        expect(onChange).toHaveBeenCalledWith(
          StorageChangeType.CLEARED,
          '',
          undefined
        );
      });
    });

    describe('when getting all items', () => {
      it('should get all items', async () => {
        await container.setItem('test', {});
        expect(await container.getAll()).toEqual({ test: {} });
      });
    });

    describe('when determining whether there is an item', () => {
      describe('when there is an item', () => {
        it('should return true', async () => {
          await container.setItem('test', {});
          expect(await container.hasItem('test')).toBe(true);
        });
      });

      describe('when there is not an item', () => {
        it('should return false', async () => {
          expect(await container.hasItem('test')).toBe(false);
        });
      });
    });
  }
}
