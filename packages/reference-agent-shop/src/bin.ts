#!/usr/bin/env node
import { bootAgent, loadFixtures } from './agent.js';

const PORT   = Number(process.env.PORT ?? 4001);
const SECRET = process.env.OPENKARTA_SECRET ?? 'halcyon-shop-dev-secret-32-bytes!';
const fx     = loadFixtures('./fixtures');

const url = await bootAgent(fx, PORT, SECRET);
console.log(`[halcyon-shop] listening on ${url}`);
