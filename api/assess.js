module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const { answers } = req.body;

  const prompt = `You are analysing someone's answers to an immigration motivation assessment. The assessment helps internationally-trained professionals understand which UK visa path fits the life they want to build — not which one they qualify for.

THE THREE ROUTES — read carefully, the distinctions matter:

SKILLED WORKER VISA:
- Requires a licensed employer to sponsor you
- Your immigration status is tied directly to that employer — if you lose your job, you lose your status
- You cannot freelance, consult, or run your own business on the side
- Every job change requires a new visa application with your new employer's cooperation
- You CAN be employed stably at one company for years — this is the most common use case
- ILR after 5 years (government has proposed extending this to 10 years)
- FITS: people who want stable employment at one company and are comfortable with employer dependency
- CONFLICTS: people who want career flexibility, multiple income streams, freelancing, or their own business

GLOBAL TALENT VISA:
- No employer sponsor needed — you are free to work however you choose
- You CAN work as a full-time employee at one company — this route does not require freelancing or self-employment
- You can also freelance, consult, have multiple income streams, or run a business — entirely your choice
- The key restriction: when you extend your visa or apply for ILR, you must show you have been working in your endorsed professional field. You do not need to be self-employed — you just need to remain active in your field.
- ILR after 3 years (research/academia route) or 5 years (other fields)
- FITS: people who want freedom to work however they choose, whether employed or self-employed, as long as they stay in their field
- CONFLICTS: people who specifically need to work entirely outside their endorsed field

INNOVATOR FOUNDER VISA:
- You must run your own business — employment as your primary activity is not permitted
- Your business idea must be endorsed before you apply and you are locked into it — major changes require re-endorsement
- Mandatory progress reviews at 12 and 24 months — endorsing body checks your milestones
- If your endorsing body withdraws endorsement, your visa can be cut short
- Supplementary employment allowed only in skilled roles (Level 3 minimum) and secondary to your business
- ILR after 3 years if business milestones are met
- FITS: people who want to build their own business and are comfortable with the accountability structure
- CONFLICTS: people who want stable employment, need predictable income, or do not want to be tied to one business idea

Their answers:
Q1 (When it comes to your career, which sounds most like you?): ${answers.q1}
Q2 (Which trade-off feels easier to accept?): ${answers.q2}
Q3 (Would you make different career choices if your immigration status wasn't a factor?): ${answers.q3}
Q4 (What would stress you more?): ${answers.q4}
Q5 (How would you feel if your settlement timeline doubled?): ${answers.q5}
Q6 (How comfortable are you with financial uncertainty?): ${answers.q6}

Generate a profile in this EXACT JSON format — raw JSON only, no markdown, no backticks:
{
  "priorities": "3-5 values separated by commas, lowercase. Derived from all 6 answers — career direction, financial needs, relationship with visa constraints, settlement priorities.",
  "tradeoffs": "Two parts, written as flowing prose with a blank line between each paragraph.\n\nPART 1 — WHO THEY ARE (1 paragraph, 3-4 sentences): Describe what this person values and needs based on ALL their answers. Cover career direction, financial approach, relationship with visa status, and settlement priorities. Do NOT mention any visa yet. Write in second person.\n\nPART 2 — VISA CONFLICTS (one paragraph per conflicting visa only): For each visa that genuinely conflicts with this person's answers, write one paragraph. Start with what the person values or needs, then name the specific restriction that creates friction. Never start a paragraph with a visa name — always start with 'You'. Keep to 2 sentences per paragraph. Only include visas that truly conflict — if a visa fits, leave it out entirely.",
  "routes": ["Route Name"],
  "route_reasons": "For each recommended route, write 2-3 sentences explaining specifically why it fits this person's answers. Reference their career direction, financial needs, and settlement priorities directly. Start with 'You'. If two routes are recommended, one paragraph per route separated by a blank line."
}

CRITICAL RULES:
- routes array: choose only from Skilled Worker Visa, Global Talent Visa, Innovator Founder Visa. Maximum 2 routes.
- Global Talent Visa does NOT conflict with wanting stable employment at one company — it is fully compatible with full-time employment. Only flag it as a conflict if the person specifically needs to work outside their endorsed field.
- Skilled Worker Visa DOES conflict with wanting freelancing, multiple income streams, or running a business.
- When someone wants stable employment at one company, recommend BOTH Skilled Worker Visa AND Global Talent Visa. They serve the same career goal but with a critical difference: Skilled Worker ties status to the employer, Global Talent does not. Always surface this distinction in route_reasons.
- Never start any paragraph with a visa name. Always start with 'You'.
- Use hyphens not em dashes.
- tradeoffs and route_reasons must be specific to these answers, never generic.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(500).json({ error: JSON.stringify(data) });
    }

    const text = data.content.map(i => i.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    res.status(200).json(parsed);

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
