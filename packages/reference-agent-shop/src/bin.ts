#!/usr/bin/env node
import { bootAgent, loadFixtures } from "./agent.js";

const PORT = Number(process.env.PORT ?? 4001);
const SECRET = process.env.OPENKARTA_SECRET ?? "halcyon-shop-dev-secret-32-bytes!";
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL;
const OWNER_TOKEN = process.env.OPENKARTA_OWNER_TOKEN;
const fx = loadFixtures("./fixtures");

if (PUBLIC_BASE_URL) fx.manifest.baseUrl = PUBLIC_BASE_URL;

const url = await bootAgent(fx, PORT, SECRET, OWNER_TOKEN);
console.log(`[halcyon-shop] listening on ${url} (manifest baseUrl=${fx.manifest.baseUrl})`);
