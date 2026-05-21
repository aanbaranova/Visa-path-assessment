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
- Skilled Worker Visa: stability, employer-sponsored, predictable path to ILR after 5 years, but status depends on employer
- Global Talent Visa: freedom to work for anyone or yourself, no sponsor needed, ILR after 3-5 years, but must stay active in endorsed professional field
- Innovator Founder Visa: run your own business, ILR possible after 3 years if business hits milestones reviewed at 12 and 24 months

Their answers:
Q1: ${answers.q1}
Q2: ${answers.q2}
Q3: ${answers.q3}
Q4: ${answers.q4}
Q5: ${answers.q5}
Q6: ${answers.q6}

Generate a profile in this EXACT JSON format — raw JSON only, no markdown, no backticks:
{
  "priorities": "3-5 values separated by commas, lowercase",
  "routes": ["Route Name"],
  "tradeoffs": "1-2 sentences on trade-offs they seem least comfortable with. Second person, honest.",
  "question": "One sharp question for them to sit with. Specific to their answers. 15-25 words max."
}

Rules: routes from Skilled Worker Visa / Global Talent Visa / Innovator Founder Visa only. 1 or 2 routes max.`;

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
