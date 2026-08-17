# Mentat

A retrieval-augmented chatbot that answers questions about the lore of *Dune*,
drawing on 4,607 wiki articles rather than on whatever the model happens to
remember.

In Dune, thinking machines are outlawed — so the Imperium trained humans to
serve as living computers instead. Those are Mentats. Naming an AI after one is
a small joke, but the framing is honest about how the thing works: a Mentat's
skill is recall and analysis over an archive, not invention, and that is exactly
what retrieval-augmented generation does.

Everything runs on Cloudflare: Workers AI for embeddings and generation,
Vectorize for the vector store, Pages for the frontend and the API function.

## Why retrieval

Ask a small language model about obscure Dune lore and it will answer
confidently and wrongly. It knows the films, thins out across the novels, and
invents freely past that. The failure is quiet — a fabricated answer looks
exactly like a real one.

Retrieval fixes the actual defect rather than papering over it. Each question is
embedded, matched against the corpus, and the closest passages are given to the
model as source material, with instructions to answer only from them and to
admit when the archives are silent.

## Features

- **Grounded answers** — responses are drawn from retrieved passages, not from
  parametric memory
- **Cited sources** — the API returns which articles an answer came from, and
  their similarity scores
- **Honest refusals** — passages below a relevance threshold are discarded
  rather than fed to the model as noise, and the prompt instructs it to say when
  something is not recorded
- **Bounded cost** — conversation history is capped, message length is capped
  server-side, and generation is capped with `max_tokens`

## Architecture

```
                    ┌─────────────────────────────┐
   question ──────▶ │  functions/api/chat.js      │
                    │  (Cloudflare Pages Function)│
                    └──────────┬──────────────────┘
                               │ 1. embed the question
                               ▼
                    ┌─────────────────────────────┐
                    │  Workers AI                 │
                    │  bge-small-en-v1.5 (384d)   │
                    └──────────┬──────────────────┘
                               │ 2. nearest neighbours
                               ▼
                    ┌─────────────────────────────┐
                    │  Vectorize  "dune-lore"     │
                    │  5,396 chunks               │
                    └──────────┬──────────────────┘
                               │ 3. passages as context
                               ▼
                    ┌─────────────────────────────┐
                    │  Workers AI                 │
                    │  llama-3.1-8b-instruct      │
                    └──────────┬──────────────────┘
                               │
                    answer + sources
```

Indexing happens **once**, offline. The vectors then live in Vectorize
permanently — deploys never rebuild them, and no corpus is ever held in memory
at runtime.

## Tech stack

| Layer | |
| --- | --- |
| Frontend | React 18, Vite, Tailwind CSS |
| API | Cloudflare Pages Functions |
| Embeddings | Workers AI — `@cf/baai/bge-small-en-v1.5` |
| Generation | Workers AI — `@cf/meta/llama-3.1-8b-instruct` |
| Vector store | Cloudflare Vectorize |
| Corpus | Dune Fandom wiki, lead sections |

## Running it

### 1. Install

```bash
git clone https://github.com/AimenSajid/Mentat.git
cd Mentat
npm install
```

### 2. Build the corpus

The corpus is not committed — it is a build input, regenerated from the wiki:

```bash
node scripts/extract-wiki.mjs dune dune.json
```

This walks every article in the main namespace and extracts the lead section
only. Full articles are far too long: the "Paul Atreides" page alone cleans to
around 63,000 characters. Lead sections are the summary paragraphs, which is
what retrieval wants. Takes roughly 15 minutes and is resumable.

Result: **4,607 entries, 2.2 MB**, median 283 characters.

### 3. Create the index

```bash
npx wrangler vectorize create dune-lore --dimensions=384 --metric=cosine
```

The dimension count must match the embedding model and is fixed at creation.

### 4. Embed and upload

```bash
$env:CLOUDFLARE_ACCOUNT_ID="..."   # Workers & Pages → Overview
$env:CLOUDFLARE_API_TOKEN="..."    # My Profile → API Tokens, needs Workers AI: Read

npm run index                      # add --dry to preview cost first
```

Then run the `wrangler vectorize insert` commands it prints — output is split
across files to respect Cloudflare's 5,000-vectors-per-file limit.

### 5. Develop

```bash
npx wrangler pages dev -- npm run dev
```

Plain `npm run dev` serves the frontend but not the API function, since bindings
only exist under Wrangler.

## Design notes

**Lead sections, not whole articles.** Median entry length is 283 characters and
p90 is 1,070, so at a 1,000-character chunk size roughly 89% of entries stay a
single whole chunk. Only genuinely long articles split.

**Chunk titles are prepended.** A passage reading *"He was born on Caladan"* is
useless without knowing who. Prefixing the article title keeps mid-article
chunks self-identifying.

**Retrieval depth is its own parameter.** An earlier version of this project
used a single `k` for both how many documents to fetch and how many sentences to
keep from them. That starved retrieval — questions failed because the correct
passage was never fetched, not because ranking was poor. The two are separate
concerns and are configured separately here.

**Weak matches are dropped.** Below a cosine score of 0.35 a result is noise
rather than a weak answer, and passing it to the model invites it to build
something plausible out of nothing.

## Cost

The whole thing fits inside Cloudflare's free tier:

| | |
| --- | --- |
| Vectors stored | 5,396 × 384 dims = 2,072,064 |
| Vectorize free tier | 5,000,000 stored dimensions — **41% used** |
| One-time embedding | ~1,074 neurons |
| Workers AI free tier | 10,000 neurons/day |

Note that the Vectorize storage allowance is account-wide, not per index.

## Credits

Lore text from the [Dune Fandom wiki](https://dune.fandom.com), licensed
CC-BY-SA. All application code written by me.
