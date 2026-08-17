/**
 * Builds the Vectorize index for the Dune corpus.
 *
 * Reads dune.json ({ "Title": "lead section text" }), splits each entry into
 * chunks, embeds them with Workers AI, and writes NDJSON files ready for
 * `wrangler vectorize insert`.
 *
 * This runs ONCE, locally. The vectors then live in Vectorize permanently —
 * deploys never touch them. Re-run it only when the corpus changes; IDs are
 * derived from the title, so a re-run upserts rather than duplicating.
 *
 * Setup:
 *   1. Create the index (dimensions must match the embedding model):
 *        wrangler vectorize create dune-lore --dimensions=384 --metric=cosine
 *   2. Export credentials:
 *        $env:CLOUDFLARE_ACCOUNT_ID="..."   # Workers & Pages -> Overview
 *        $env:CLOUDFLARE_API_TOKEN="..."    # needs Workers AI: Read
 *   3. node scripts/build-index.mjs
 *   4. Run the wrangler commands it prints at the end.
 *
 * Flags:
 *   --limit=N     only process the first N corpus entries (for a trial run)
 *   --in=FILE     corpus file (default dune.json)
 *   --out=PREFIX  output prefix (default vectors)
 */

import fs from "node:fs"
import crypto from "node:crypto"

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.split("=").slice(1).join("=") : fallback
}

const IN = arg("in", "dune.json")
const OUT_PREFIX = arg("out", "vectors")
const LIMIT = Number(arg("limit", "0")) || 0

const MODEL = "@cf/baai/bge-small-en-v1.5"
const DIMENSIONS = 384

// bge-small accepts 512 input tokens (~2,000 chars). 1,000 keeps us at roughly
// 250 tokens with headroom, and p90 of the corpus is 1,070 chars — so ~89% of
// entries stay a single whole chunk.
const CHUNK_SIZE = 1000
const CHUNK_OVERLAP = 120

const EMBED_BATCH = 100     // texts per Workers AI request
const VECTORS_PER_FILE = 5000  // Cloudflare's documented ceiling per NDJSON file

// --dry reports the chunk count and projected cost without calling the API.
const DRY = process.argv.includes("--dry")

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN

if (!DRY && (!ACCOUNT_ID || !API_TOKEN)) {
  console.error(
    "Missing credentials.\n" +
    "  CLOUDFLARE_ACCOUNT_ID  — Cloudflare dashboard, Workers & Pages, Overview\n" +
    "  CLOUDFLARE_API_TOKEN   — My Profile, API Tokens; needs Workers AI: Read"
  )
  process.exit(1)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Split text into chunks near CHUNK_SIZE, preferring sentence boundaries so a
 * chunk does not end mid-clause. Overlap carries a little context across the
 * seam, which helps when an answer straddles two chunks.
 */
function chunkText(text) {
  if (text.length <= CHUNK_SIZE) return [text]

  const sentences = text.match(/[^.!?\n]+(?:[.!?]+|\n|$)/g) ?? [text]
  const chunks = []
  let current = ""

  for (const sentence of sentences) {
    if (current.length + sentence.length > CHUNK_SIZE && current) {
      chunks.push(current.trim())
      // Start the next chunk with the tail of the previous one.
      current = current.slice(-CHUNK_OVERLAP) + sentence
    } else {
      current += sentence
    }
  }
  if (current.trim()) chunks.push(current.trim())

  // A single sentence longer than CHUNK_SIZE still needs a hard split.
  return chunks.flatMap((c) =>
    c.length <= CHUNK_SIZE * 1.5
      ? [c]
      : c.match(new RegExp(`.{1,${CHUNK_SIZE}}`, "gs")) ?? [c]
  )
}

/** Stable, short, unique. Re-running the script upserts instead of duplicating. */
const vectorId = (title, index) =>
  crypto.createHash("sha1").update(title).digest("hex").slice(0, 20) + "-" + index

/** Embed a batch of texts, with retry on rate limits and transient errors. */
async function embed(texts, attempt = 0) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${MODEL}`
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: texts }),
    })

    if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`)

    const json = await res.json()
    if (!json.success) {
      throw new Error(JSON.stringify(json.errors ?? json).slice(0, 300))
    }
    return json.result.data
  } catch (err) {
    if (attempt >= 5) throw new Error(`embedding failed after retries: ${err.message}`)
    await sleep(1000 * 2 ** attempt)
    return embed(texts, attempt + 1)
  }
}

async function main() {
  if (!fs.existsSync(IN)) {
    console.error(`Corpus not found: ${IN}\nRun scripts/extract-wiki.mjs first.`)
    process.exit(1)
  }

  const corpus = JSON.parse(fs.readFileSync(IN, "utf8"))
  let entries = Object.entries(corpus)
  if (LIMIT) entries = entries.slice(0, LIMIT)

  // Build the chunk list first, so we know the true vector count before
  // spending anything on embeddings.
  const records = []
  for (const [title, text] of entries) {
    const chunks = chunkText(text)
    chunks.forEach((chunk, i) => {
      records.push({
        id: vectorId(title, i),
        title,
        // Prepending the title keeps mid-article chunks self-identifying —
        // "He was born on Caladan" is useless without knowing who.
        text: chunks.length > 1 ? `${title}: ${chunk}` : chunk,
        part: i,
        of: chunks.length,
      })
    })
  }

  const storedDims = records.length * DIMENSIONS
  console.log(`corpus entries : ${entries.length.toLocaleString()}`)
  console.log(`chunks         : ${records.length.toLocaleString()}`)
  console.log(`stored dims    : ${storedDims.toLocaleString()} (${(storedDims / 5e6 * 100).toFixed(1)}% of the 5M free tier)`)
  console.log(`files to write : ${Math.ceil(records.length / VECTORS_PER_FILE)}\n`)

  if (storedDims > 5_000_000) {
    console.warn("WARNING: this exceeds the Vectorize free tier of 5,000,000 stored dimensions.\n")
  }

  const totalChars = records.reduce((a, r) => a + r.text.length, 0)
  const estTokens = Math.round(totalChars / 4)
  console.log(`approx tokens  : ${estTokens.toLocaleString()}`)
  console.log(`approx neurons : ${Math.round(estTokens / 1e6 * 1841).toLocaleString()} (10,000/day free)`)

  const lens = records.map((r) => r.text.length).sort((a, b) => a - b)
  console.log(`chunk chars    : median ${lens[Math.floor(lens.length / 2)]}, max ${lens[lens.length - 1]}`)
  const overLimit = lens.filter((l) => l > 2000).length
  console.log(`over 512 tokens: ${overLimit} chunk(s) exceed ~2000 chars\n`)

  if (DRY) {
    console.log("Dry run — nothing embedded, nothing written.")
    return
  }

  // Embed in batches, streaming straight out to NDJSON.
  let fileIndex = 0
  let inFile = 0
  const files = []
  let stream = null

  const openNextFile = () => {
    if (stream) stream.end()
    const name = `${OUT_PREFIX}-${String(fileIndex).padStart(2, "0")}.ndjson`
    files.push(name)
    stream = fs.createWriteStream(name)
    fileIndex++
    inFile = 0
  }
  openNextFile()

  const started = Date.now()
  for (let i = 0; i < records.length; i += EMBED_BATCH) {
    const batch = records.slice(i, i + EMBED_BATCH)
    const vectors = await embed(batch.map((r) => r.text))

    batch.forEach((rec, j) => {
      if (inFile >= VECTORS_PER_FILE) openNextFile()
      stream.write(JSON.stringify({
        id: rec.id,
        values: vectors[j],
        // The chunk text rides along as metadata so the Worker can build a
        // prompt straight from query results, with no second lookup.
        metadata: { title: rec.title, text: rec.text, part: rec.part, of: rec.of },
      }) + "\n")
      inFile++
    })

    const done = Math.min(i + EMBED_BATCH, records.length)
    const rate = done / ((Date.now() - started) / 1000)
    const left = Math.round((records.length - done) / rate)
    process.stdout.write(
      `\r  embedded ${done.toLocaleString()}/${records.length.toLocaleString()}  ~${left}s left   `
    )
  }
  stream.end()

  const tokens = Math.round(records.reduce((a, r) => a + r.text.length, 0) / 4)
  const neurons = Math.round(tokens / 1e6 * 1841)

  console.log(`\n\nWrote ${files.length} file(s):`)
  for (const f of files) console.log(`  ${f}`)
  console.log(`\nApprox ${tokens.toLocaleString()} input tokens ≈ ${neurons.toLocaleString()} neurons`)
  console.log(`(free allowance is 10,000 neurons/day)\n`)
  console.log("Now upload them:")
  for (const f of files) console.log(`  wrangler vectorize insert dune-lore --file=${f}`)
}

main().catch((err) => {
  console.error("\nIndexing failed:", err.message)
  process.exit(1)
})
