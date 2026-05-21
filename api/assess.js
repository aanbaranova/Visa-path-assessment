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
- Skilled Worker Visa: requires employer sponsorship, status depends entirely on that employer, cannot freelance or run a business, must update visa with every job change
- Global Talent Visa: no sponsor needed, work for anyone or yourself, but must stay active in your endorsed professional field when extending or settling
- Innovator Founder Visa: must run your own business, locked into one endorsed business idea, mandatory progress reviews at 12 and 24 months, visa can be cut short if milestones not met

Their answers:
Q1 (Which statement sounds most like you?): ${answers.q1}
Q2 (Which trade-off feels easier to accept?): ${answers.q2}
Q3 (Imagine your life in 3 years): ${answers.q3}
Q4 (What would stress you more?): ${answers.q4}
Q5 (How would you feel if settlement timeline doubled?): ${answers.q5}
Q6 (How do you think about financial risk?): ${answers.q6}

Generate a profile in this EXACT JSON format — raw JSON only, no markdown, no backticks:
{
  "priorities": "3-5 values separated by commas, lowercase",
  "tradeoffs": "For each visa that does NOT fit this person, write one short paragraph. Always name the visa directly. Structure: '[Visa name] requires [specific restriction]. You value [what their answers show]. That conflict means this route may not suit you.' Only include visas that conflict with their answers. If all three conflict, include all three. If only one conflicts, include only one. Keep each paragraph to 2 sentences maximum. Separate paragraphs with a blank line.",
  "routes": ["Route Name"],
  "question": "One sharp question for them to sit with. Specific to their answers. 15-25 words max."
}

Rules:
- routes must be from: Skilled Worker Visa, Global Talent Visa, Innovator Founder Visa
- 1 or 2 routes max in routes array
- tradeoffs must name visas directly, never refer to them as 'this route' or 'that path'
- tradeoffs must be simple and concrete, not abstract
- closing question must feel personal to these specific answers`;

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
        max_tokens: 800,
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
