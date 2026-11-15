/**
 * Collects triangles for one mesh of the delivery world. Every triangle carries which texture tile
 * it wears, a tint, and how brightly its windows glow at night (tiles.ts). Positions are zone
 * metres (east, north, up); triangles that run anticlockwise seen from outside face outward.
 */
import { BufferGeometry, Float32BufferAttribute, Mesh, type Material } from 'three';
import { TILE, type P3, type Tint } from './space.ts';

export class MeshBuilder {
  private readonly pos: number[] = [];
  private readonly nor: number[] = [];
  private readonly uv: number[] = [];
  private readonly tint: number[] = [];
  private readonly layer: number[] = [];
  private readonly glow: number[] = [];

  get triangles(): number {
    return this.layer.length / 3;
  }

  /** A triangle with a texture position (in tiles) at each corner. */
  tri(
    a: P3,
    b: P3,
    c: P3,
    ua: number,
    va: number,
    ub: number,
    vb: number,
    uc: number,
    vc: number,
    layer: number,
    tint: Tint,
    glow = 0,
  ): void {
    // Zone (east, north, up) is three.js (x, y, z) = (east, up, -north).
    const ax = a[0];
    const ay = a[2];
    const az = -a[1];
    const e1x = b[0] - ax;
    const e1y = b[2] - ay;
    const e1z = -b[1] - az;
    const e2x = c[0] - ax;
    const e2y = c[2] - ay;
    const e2z = -c[1] - az;
    let nx = e1y * e2z - e1z * e2y;
    let ny = e1z * e2x - e1x * e2z;
    let nz = e1x * e2y - e1y * e2x;
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-9) return;
    nx /= len;
    ny /= len;
    nz /= len;
    this.pos.push(ax, ay, az, b[0], b[2], -b[1], c[0], c[2], -c[1]);
    this.nor.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    this.uv.push(ua, va, ub, vb, uc, vc);
    this.tint.push(tint[0], tint[1], tint[2], tint[0], tint[1], tint[2], tint[0], tint[1], tint[2]);
    this.layer.push(layer, layer, layer);
    this.glow.push(glow, glow, glow);
  }

  /** A four-sided face, corners in order; the texture runs u0 to u1 from a to b, v0 to v1 from a to d. */
  quad(
    a: P3,
    b: P3,
    c: P3,
    d: P3,
    u0: number,
    v0: number,
    u1: number,
    v1: number,
    layer: number,
    tint: Tint,
    glow = 0,
  ): void {
    this.tri(a, b, c, u0, v0, u1, v0, u1, v1, layer, tint, glow);
    this.tri(a, c, d, u0, v0, u1, v1, u0, v1, layer, tint, glow);
  }

  /** A triangle textured by where it is on the map, so overlapping ground never disagrees. */
  flat(a: P3, b: P3, c: P3, layer: number, tint: Tint): void {
    this.tri(
      a,
      b,
      c,
      a[0] / TILE,
      a[1] / TILE,
      b[0] / TILE,
      b[1] / TILE,
      c[0] / TILE,
      c[1] / TILE,
      layer,
      tint,
    );
  }

  /** A four-sided piece of ground, corners anticlockwise. */
  flatQuad(a: P3, b: P3, c: P3, d: P3, layer: number, tint: Tint): void {
    this.flat(a, b, c, layer, tint);
    this.flat(a, c, d, layer, tint);
  }

  /** The mesh, or null when nothing was added. */
  build(material: Material): Mesh | null {
    if (!this.layer.length) return null;
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new Float32BufferAttribute(this.uv, 2));
    g.setAttribute('tint', new Float32BufferAttribute(this.tint, 3));
    g.setAttribute('layer', new Float32BufferAttribute(this.layer, 1));
    g.setAttribute('glow', new Float32BufferAttribute(this.glow, 1));
    return new Mesh(g, material);
  }
}
