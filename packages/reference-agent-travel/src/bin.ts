#!/usr/bin/env node
import { bootAgent, loadFixtures } from "./agent.js";

const PORT = Number(process.env.PORT ?? 4003);
const SECRET = process.env.OPENKARTA_SECRET ?? "halcyon-travel-dev-secret-32-byte";
const fx = loadFixtures("./fixtures");

const url = await bootAgent(fx, PORT, SECRET);
console.log(`[halcyon-travel] listening on ${url}`);
