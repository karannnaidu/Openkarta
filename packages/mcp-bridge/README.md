# @openkarta/mcp-bridge

Use OpenKarta from any MCP-aware host (Claude Desktop, MCP-aware editors, …).

The bridge is a thin local stdio MCP server. It exposes OpenKarta's 8 verbs as MCP tools and routes each call to the appropriate merchant in the OpenKarta registry. There is no LLM in the bridge — your host owns it. There is no account, no API key, no telemetry.

## Install (Claude Desktop)

Edit your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "openkarta": {
      "command": "npx",
      "args": ["-y", "@openkarta/mcp-bridge"]
    }
  }
}
```

Restart Claude Desktop. The 8 OpenKarta tools should appear under the connected servers.

## Tools

| Name | Purpose |
|---|---|
| `search` | Search across registered OpenKarta agents for items of a given type. |
| `add_to_cart` | Add an item to a cart. Stateless — the result returns the cart. |
| `view_cart` | Echo a cart you supply. |
| `quote` | Quote a cart against the agent. Returns a signed quote token. |
| `checkout` | Place an order using a cart + signed quote + payment method. |
| `order_status` | Fetch fulfilment status for an order. |
| `cancel_order` | Cancel an open order. |
| `return_order` | Initiate a return for a delivered order. |

The cart and quote are passed through tool I/O — the LLM threads them between calls. There is no per-process cart state, so multi-tab hosts are safe.

## Errors

Every error returns a structured JSON payload with `code`, `message`, and `hint`. Codes come from OpenKarta's closed enum (`quote_expired`, `payment_declined`, …) plus a small set of bridge-internal codes (`bridge_registry_unavailable`, `bridge_invalid_merchant`, …). The `hint` is an LLM-targeted recovery instruction.

## Troubleshooting

**Server didn't start.** Check Claude Desktop's developer log. Most failures are network-related — the bridge fetches the public registry on startup.

**A tool call failed with `bridge_invalid_merchant`.** The agentId you supplied isn't in the public registry. Run `search` first and use an `agentId` it returns.

**The quote expired.** Quote tokens are short-lived. Call `quote` again on the same cart to get a fresh token, then `checkout`.

## Browse merchants

The current registry is at <https://registry.openkarta.org>.

## License

MIT.
