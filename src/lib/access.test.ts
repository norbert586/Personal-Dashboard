import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { decideAccess, isPrivateAddress } from './access.ts';

describe('isPrivateAddress', () => {
  const privateAddresses = [
    '127.0.0.1',
    '127.8.9.10',
    '10.0.0.5',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.20',
    '100.64.0.1', // Tailscale / CGNAT lower bound
    '100.101.102.103',
    '100.127.255.255', // CGNAT upper bound
    '169.254.10.10',
    '::1',
    '0:0:0:0:0:0:0:1',
    '[::1]',
    'fd7a:115c:a1e0::1', // Tailscale IPv6
    'fc00::1',
    'fe80::1%eth0',
    '::ffff:192.168.1.10', // IPv4-mapped
    '::ffff:7f00:1', // IPv4-mapped loopback, hex form
  ];
  for (const address of privateAddresses) {
    it(`treats ${address} as private`, () => assert.equal(isPrivateAddress(address), true));
  }

  const publicOrInvalid = [
    '8.8.8.8',
    '1.1.1.1',
    '172.32.0.1',
    '172.15.255.255',
    '192.169.0.1',
    '100.63.255.255',
    '100.128.0.1',
    '2001:4860:4860::8888',
    '::ffff:8.8.8.8',
    '',
    'localhost',
    '999.1.1.1',
    '1.2.3',
    '1.2.3.4.5',
    '1::2::3',
    'fd7a:115c:a1e0::1::',
    'not-an-ip',
  ];
  for (const address of publicOrInvalid) {
    it(`treats ${JSON.stringify(address)} as public`, () =>
      assert.equal(isPrivateAddress(address), false));
  }
});

describe('decideAccess', () => {
  it('allows everything on the dev server', () => {
    const decision = decideAccess({ mode: undefined, isDev: true, clientAddress: '8.8.8.8' });
    assert.equal(decision.allowed, true);
  });

  it('fails closed in production when ACCESS_MODE is unset', () => {
    const decision = decideAccess({ mode: undefined, isDev: false, clientAddress: '127.0.0.1' });
    assert.equal(decision.allowed, false);
    assert.match(decision.reason, /ACCESS_MODE is not set/);
  });

  it('allows private addresses in private-network mode', () => {
    const decision = decideAccess({
      mode: 'private-network',
      isDev: false,
      clientAddress: '100.88.1.2',
    });
    assert.equal(decision.allowed, true);
  });

  it('denies public addresses in private-network mode', () => {
    const decision = decideAccess({
      mode: 'private-network',
      isDev: false,
      clientAddress: '203.0.113.9',
    });
    assert.equal(decision.allowed, false);
  });

  it('denies when the client address is unknown', () => {
    const decision = decideAccess({
      mode: 'private-network',
      isDev: false,
      clientAddress: undefined,
    });
    assert.equal(decision.allowed, false);
  });
});
