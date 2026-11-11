import assert from 'node:assert/strict';
import { test } from 'node:test';
import { path, withBase } from './paths.ts';

test('at the root, paths stay as they are', () => {
  assert.equal(withBase('/', '/'), '/');
  assert.equal(withBase('/', '/today'), '/today');
  assert.equal(path('/api/feeds.json'), '/api/feeds.json');
});

test('under a base, with or without its trailing slash', () => {
  assert.equal(withBase('/Personal-Dashboard', '/'), '/Personal-Dashboard/');
  assert.equal(withBase('/Personal-Dashboard/', '/today'), '/Personal-Dashboard/today');
  assert.equal(withBase('/Personal-Dashboard/', 'favicon.svg'), '/Personal-Dashboard/favicon.svg');
});
