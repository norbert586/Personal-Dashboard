import { test, expect } from '@playwright/test';
import { CLOSED_PORT } from '../../playwright.config.ts';

test('an unconfigured production server refuses every request (fail closed)', async ({
  request,
}) => {
  for (const path of ['/', '/anything-else']) {
    const response = await request.get(`http://127.0.0.1:${CLOSED_PORT}${path}`);
    expect(response.status()).toBe(403);

    const body = await response.text();
    expect(body).toContain('This console is private.');
    // Nothing private, and nothing about how the gate is configured, reaches the visitor.
    expect(body).not.toContain('Norbert');
    expect(body).not.toContain('ACCESS_MODE');
  }
});
