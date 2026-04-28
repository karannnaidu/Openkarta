#!/usr/bin/env node
import { bootAgent, loadFixtures } from "./agent.js";

const PORT = Number(process.env.PORT ?? 4002);
const SECRET = process.env.OPENKARTA_SECRET ?? "halcyon-stays-dev-secret-32-bytes!";
const fx = loadFixtures("./fixtures");

const url = await bootAgent(fx, PORT, SECRET);
console.log(`[halcyon-stays] listening on ${url}`);
