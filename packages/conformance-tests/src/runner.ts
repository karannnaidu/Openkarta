import { CapabilitiesManifest } from '@openkarta/spec';
import { runBusPack } from './packs/bus.js';
import { runCorePack } from './packs/core.js';
import { runFlightPack } from './packs/flight.js';
import { runProductPack } from './packs/product.js';
import { runServicePack } from './packs/service.js';
import { runStayPack } from './packs/stay.js';
import type { PackName, PackReport } from './types.js';

const PACK_RUNNERS: Record<PackName, (ctx: { baseUrl: string; userToken?: string }) => Promise<PackReport>> = {
  core:    runCorePack,
  product: runProductPack,
  stay:    runStayPack,
  flight:  runFlightPack,
  bus:     runBusPack,
  service: runServicePack,
};

export const runAll = async (baseUrl: string, userToken?: string): Promise<{
  manifest: CapabilitiesManifest; packReports: PackReport[];
}> => {
  const m = await (await fetch(`${baseUrl}/v0/discover`)).json();
  const manifest = CapabilitiesManifest.parse(m);
  const packs: PackName[] = ['core', ...manifest.supportedItemTypes as PackName[]];
  const packReports: PackReport[] = [];
  for (const p of packs) {
    const ctx = userToken !== undefined ? { baseUrl, userToken } : { baseUrl };
    packReports.push(await PACK_RUNNERS[p](ctx));
  }
  return { manifest, packReports };
};
