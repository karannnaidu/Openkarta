# `openkarta` CLI

```bash
npm install -g @openkarta/cli
openkarta --help
```

## Commands

| Command | Description |
|---|---|
| `openkarta search --type <type> [--query …]` | Search across registered agents |
| `openkarta cart init --agent-id … --base-url … --type …` | Bind a new cart to one agent + one item type |
| `openkarta cart add --item-id … [-n N]` | Add a line |
| `openkarta cart show` / `cart clear` | Inspect / discard the local cart |
| `openkarta checkout --payment <method> [--yes]` | Quote and place |
| `openkarta orders list / status / cancel / return` | Order lifecycle |
| `openkarta chat [--base-url …] [--model …] [--api-key …]` | Natural-language REPL. Point at any chat endpoint. |

State is stored at `~/.openkarta/` (override with the `OPENKARTA_HOME` env var).

## Examples

```bash
# 1. Find coffee in IN
openkarta search --type product --query coffee --country IN

# 2. Bind a cart to the agent you liked
openkarta cart init \
  --agent-id halcyon-shop \
  --base-url https://halcyon-shop.fly.dev \
  --type product

# 3. Add an item, see the quote, then place
openkarta cart add --item-id p_espresso_250 -n 2
openkarta checkout --payment cod        # shows the quote
openkarta checkout --payment cod --yes  # places it

# 4. Track
openkarta orders list
openkarta orders status ord_xxx
```

## Chat — using your own LLM

`openkarta chat` defaults to OpenRouter but works against any chat-completions endpoint:

```bash
# OpenRouter (default)
export OPENROUTER_API_KEY=sk-or-…
openkarta chat
openkarta chat --model openai/gpt-4o

# OpenAI directly
export OPENAI_API_KEY=sk-…
openkarta chat --base-url https://api.openai.com/v1 --model gpt-4o

# Local Ollama (no key needed)
openkarta chat --base-url http://localhost:11434/v1 --model llama3.1:70b
```

Env-var fallback order for the API key: `--api-key` → `OPENKARTA_LLM_API_KEY` → `OPENROUTER_API_KEY` → `OPENAI_API_KEY`.

The model has to support tool calling. Reliable local choices: Llama 3.1+, Qwen 2.5+, Hermes 3, Mistral function-calling variants.
