import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { bearing, compass, distanceMiles } from './geo.ts';

describe('geo', () => {
  it('names the nearest of 16 compass points', () => {
    assert.equal(compass(0), 'N');
    assert.equal(compass(11.2), 'N');
    assert.equal(compass(11.3), 'NNE');
    assert.equal(compass(280), 'W');
    assert.equal(compass(359), 'N');
    assert.equal(compass(-90), 'W');
    assert.equal(compass(720 + 135), 'SE');
  });

  it('measures miles between points', () => {
    // One degree of latitude is about 69 miles.
    assert.ok(Math.abs(distanceMiles({ lat: 42, lon: -83 }, { lat: 43, lon: -83 }) - 69.09) < 0.05);
    assert.equal(distanceMiles({ lat: 42.72, lon: -83.03 }, { lat: 42.72, lon: -83.03 }), 0);
  });

  it('finds the bearing from one point to another', () => {
    assert.ok(Math.abs(bearing({ lat: 42, lon: -83 }, { lat: 43, lon: -83 }) - 0) < 1e-9);
    assert.ok(Math.abs(bearing({ lat: 0, lon: 0 }, { lat: 0, lon: 1 }) - 90) < 1e-9);
    assert.ok(Math.abs(bearing({ lat: 43, lon: -83 }, { lat: 42, lon: -83 }) - 180) < 1e-9);
  });
});
