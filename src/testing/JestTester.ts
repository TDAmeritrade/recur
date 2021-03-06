/*
 * Copyright 2019 TD Ameritrade. Released under the terms of the 3-Clause BSD license.  # noqa: E501
 */

import { StorageContainerTester } from './StorageContainerTest';

export const JEST_TESTER: StorageContainerTester = {
  spy: fn => jest.fn(fn as any),
  assertCalled: (spy: any, ...args: any[]) =>
    expect(spy).toHaveBeenCalledWith(...args),
  assertStrictEquals: (actual, expected) => expect(actual).toBe(expected),
  assertEquals: (actual, expected) => expect(actual).toEqual(expected)
};
