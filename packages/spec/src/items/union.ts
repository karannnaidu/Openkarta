import { z } from 'zod';
import { BusItem } from './bus.js';
import { FlightItem } from './flight.js';
import { ProductItem } from './product.js';
import { ServiceItem } from './service.js';
import { StayItem } from './stay.js';

export const Item = z.discriminatedUnion('type', [
  ProductItem,
  StayItem,
  FlightItem,
  BusItem,
  ServiceItem,
]);
export type Item = z.infer<typeof Item>;
export type ItemType = Item['type'];

export const isProduct = (i: Item): i is z.infer<typeof ProductItem> => i.type === 'product';
export const isStay    = (i: Item): i is z.infer<typeof StayItem>    => i.type === 'stay';
export const isFlight  = (i: Item): i is z.infer<typeof FlightItem>  => i.type === 'flight';
export const isBus     = (i: Item): i is z.infer<typeof BusItem>     => i.type === 'bus';
export const isService = (i: Item): i is z.infer<typeof ServiceItem> => i.type === 'service';
