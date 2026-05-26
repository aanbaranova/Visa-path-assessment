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

The three routes are:
- Skilled Worker Visa: requires employer sponsorship, status depends entirely on that employer, cannot freelance or run a business, must update visa with every job change. ILR after 5 years (possibly extended to 10).
- Global Talent Visa: no sponsor needed, work for anyone or yourself, but must stay active in your endorsed professional field when extending or settling. ILR after 3 or 5 years.
- Innovator Founder Visa: must run your own business, locked into one endorsed business idea, mandatory progress reviews at 12 and 24 months, visa can be cut short if milestones not met. ILR after 3 years if milestones hit.

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
  "tradeoffs": "This section has two parts, written as flowing prose paragraphs with a blank line between each part and between each visa paragraph.\n\nPART 1 — WHO THEY ARE (1 paragraph): Start by describing what this person values and needs, based on ALL their answers. Reference their career direction, financial approach, relationship with their visa status, and settlement priorities. Do NOT mention visas yet. Write in second person. 3-4 sentences.\n\nPART 2 — VISA CONFLICTS (one paragraph per conflicting visa): For each visa that does NOT fit this person, write one paragraph. Lead with what the person values, then show the specific visa restriction that creates friction. Structure: 'You [what they value/need]. [Visa name] [specific restriction that conflicts with that]. That makes this route a poor fit.' Only include visas that genuinely conflict with their answers. If a visa fits, do not include it here. Keep each paragraph to 2 sentences.",
  "routes": ["Route Name"],
  "route_reasons": "For each recommended route, explain in 2-3 sentences specifically WHY it fits this person. Reference their actual answers — career direction, financial needs, settlement priorities. Write in second person. If two routes are recommended, write one paragraph per route separated by a blank line."
}

Rules:
- routes must be chosen from: Skilled Worker Visa, Global Talent Visa, Innovator Founder Visa
- 1 or 2 routes maximum in the routes array
- tradeoffs Part 1 must come before Part 2 — always lead with the person, not the visas
- never start a paragraph with a visa name — always start with 'You' 
- tradeoffs must be concrete and specific, never abstract
- route_reasons must explain fit using their specific answers, not generic visa benefits
- use hyphens not em dashes throughout`;

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
