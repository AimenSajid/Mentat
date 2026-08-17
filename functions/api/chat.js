/**
 * Retrieval-augmented chat endpoint.
 *
 * Runs entirely on Cloudflare: Workers AI for both the query embedding and
 * generation, Vectorize for retrieval. No external API key, and no corpus in
 * memory — the index was built once by scripts/build-index.mjs and lives in
 * Vectorize.
 */

// Kept in sync with src/pages/Chat.jsx, which enforces the same limits in the
// UI. These are the authoritative ones — the client can be bypassed.
const MAX_HISTORY = 10
const MAX_CHARS = 1000

// Must match the model used to build the index. Embeddings from a different
// model are not comparable, and the index is fixed at 384 dimensions.
const EMBEDDING_MODEL = "@cf/baai/bge-small-en-v1.5"
const GENERATION_MODEL = "@cf/meta/llama-3.1-8b-instruct"

// How many passages to retrieve. The school version of this project conflated
// "documents to retrieve" with "sentences to keep" behind a single k, which
// starved retrieval — these are deliberately separate concerns now.
const TOP_K = 5

// Below this cosine score a match is noise rather than a weak answer.
const MIN_SCORE = 0.35

const SYSTEM_PROMPT = [
  "You are a Mentat, a human trained to serve as a living computer for the",
  "Great Houses of the Imperium, and an expert in the lore of Dune.",
  "",
  "Answer ONLY from the archive passages provided below. They are authoritative.",
  "If the passages do not contain the answer, say plainly that the archives do",
  "not record it. Never invent names, dates, or events — a Mentat who fabricates",
  "data is worse than useless.",
  "",
  "Speak with measured precision and a little gravity. Never break character,",
  "and never mention being an AI or a language model — thinking machines are",
  "forbidden.",
  "",
  "Keep answers to two or three sentences unless asked for more.",
].join("\n")

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })

export async function onRequestPost(context) {
  const { request, env } = context

  try {
    const body = await request.json().catch(() => null)
    const messages = body?.messages ?? []

    if (!messages.length) {
      return json({ error: "No messages sent." }, 400)
    }
    if (messages.length > MAX_HISTORY) {
      return json({ error: `Too many messages: send at most ${MAX_HISTORY}.` }, 400)
    }
    const tooLong = messages.find(
      (m) => typeof m?.content !== "string" || m.content.length > MAX_CHARS
    )
    if (tooLong) {
      return json({ error: `Each message is limited to ${MAX_CHARS} characters.` }, 400)
    }

    if (!env.AI || !env.VECTORIZE) {
      return json({ error: "Server misconfigured: AI or Vectorize binding missing." }, 500)
    }

    // Retrieve against the latest user message, not the whole transcript —
    // earlier turns would dilute the query vector.
    const query = [...messages].reverse().find((m) => m.role === "user")?.content
    if (!query) {
      return json({ error: "No user message to answer." }, 400)
    }

    const embedded = await env.AI.run(EMBEDDING_MODEL, { text: [query] })
    const queryVector = embedded.data[0]

    const results = await env.VECTORIZE.query(queryVector, {
      topK: TOP_K,
      returnMetadata: "all",
    })

    const passages = (results.matches ?? [])
      .filter((m) => m.score >= MIN_SCORE && m.metadata?.text)
      .map((m) => m.metadata.text)

    const archive = passages.length
      ? passages.map((p, i) => `[${i + 1}] ${p}`).join("\n\n")
      : "(no relevant records found)"

    // The retrieved context goes in a system turn so it is clearly reference
    // material rather than something the user said.
    const prompt = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: `Archive passages:\n\n${archive}` },
      ...messages.map(({ role, content }) => ({ role, content })),
    ]

    const completion = await env.AI.run(GENERATION_MODEL, {
      messages: prompt,
      max_tokens: 220,
      temperature: 0.6,
    })

    const reply =
      completion.response?.trim() || "The archives are silent. Ask again."

    return json({
      reply,
      // Surfaced so the UI can show what the answer was drawn from — the
      // difference between a demo and a black box.
      sources: (results.matches ?? [])
        .filter((m) => m.score >= MIN_SCORE)
        .map((m) => ({
          title: m.metadata?.title,
          score: Number(m.score.toFixed(3)),
        })),
    })
  } catch (err) {
    console.error("Chat function error:", err)
    return json({ error: err.message || "The archives could not be reached." }, 500)
  }
}
