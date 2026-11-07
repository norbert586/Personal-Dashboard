import type { Metric } from '../meter.ts';
import type { Reading } from '../readings.ts';

export interface Device {
  name: string;
  role: string;
  online: boolean;
  lastSeen: Date;
  uptimeSeconds: number;
  metrics: Metric[];
}

// Sample readings until flightpi exposes a health endpoint (roadmap M3).
export async function getDevices(now: Date): Promise<Reading<Device[]>> {
  return {
    source: 'flightpi',
    provenance: 'sample',
    fetchedAt: now,
    data: [
      {
        name: 'flightpi',
        role: 'Raspberry Pi',
        online: true,
        lastSeen: new Date(now.getTime() - 60_000),
        uptimeSeconds: 12 * 86_400 + 4 * 3_600 + 9 * 60,
        metrics: [
          {
            label: 'CPU temperature',
            value: 52,
            max: 85,
            display: '52 °C',
            high: 65,
            critical: 75,
          },
          { label: 'Load', value: 1.6, max: 4, display: '1.6 of 4 cores', high: 3, critical: 3.8 },
          { label: 'Memory', value: 48, max: 100, display: '48 %', high: 80, critical: 92 },
          { label: 'Disk', value: 83, max: 100, display: '83 %', high: 80, critical: 92 },
        ],
      },
    ],
    detail: 'Add a health endpoint on flightpi to show real readings.',
  };
}
