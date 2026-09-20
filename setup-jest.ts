import '@testing-library/jest-dom';
import { setupZonelessTestEnv } from 'jest-preset-angular/setup-env/zoneless';
import { deserialize, serialize } from 'node:v8';

// jest-environment-jsdom does not expose structuredClone; Dexie and fake-indexeddb require it.
if (typeof globalThis.structuredClone !== 'function') {
  globalThis.structuredClone = <T>(value: T): T => deserialize(serialize(value)) as T;
}

setupZonelessTestEnv();
