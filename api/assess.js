module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const { answers } = req.body;

  const prompt = `You are analysing someone's answers to an immigration motivation assessment. The assessment helps internationally-trained professionals understand which UK visa path fits the life they want to build, not which one they qualify for.

THE THREE ROUTES:

SKILLED WORKER VISA:
- Requires a licensed employer to sponsor you
- Immigration status tied directly to that employer - lose your job, lose your status
- Cannot freelance, consult, or run your own business on the side
- Every job change requires a new visa application
- You CAN be employed stably at one company for years - this is the most common use case
- ILR after 5 years (government has proposed extending to 10 years)
- FITS: people who want stable employment and are comfortable with employer dependency
- CONFLICTS: people who want flexibility, multiple income streams, freelancing, or their own business

GLOBAL TALENT VISA:
- No employer sponsor needed
- You CAN work as a full-time employee at one company - does NOT require freelancing or self-employment
- You can also freelance, consult, have multiple income streams, or run a business
- Key restriction: when extending or applying for ILR, must show work in endorsed professional field. Does not need to be self-employed - just active in their field.
- ILR after 3 years (research/academia) or 5 years (other fields)
- FITS: people who want freedom to work however they choose, employed or self-employed, in their field
- CONFLICTS: people who need to work entirely outside their endorsed field

INNOVATOR FOUNDER VISA:
- Must run own business - employment as primary activity not permitted
- Locked into one endorsed business idea - major changes require re-endorsement
- Mandatory progress reviews at 12 and 24 months
- Visa can be cut short if endorsement withdrawn
- ILR after 3 years if milestones met
- FITS: people who want to build their own business and accept the accountability structure
- CONFLICTS: people who want stable employment, need predictable income, or do not want to be tied to one business idea

Their answers:
Q1 (When it comes to your career, which sounds most like you?): ${answers.q1}
Q2 (Which trade-off feels easier to accept?): ${answers.q2}
Q3 (Would you make different career choices if your immigration status was not a factor?): ${answers.q3}
Q4 (What would stress you more?): ${answers.q4}
Q5 (How would you feel if your settlement timeline doubled?): ${answers.q5}
Q6 (How comfortable are you with financial uncertainty?): ${answers.q6}

Generate a profile in this EXACT JSON format. Raw JSON only, no markdown, no backticks. All string values must be valid JSON - no unescaped newlines inside strings.

{
  "priorities": "3-5 values separated by commas, lowercase",
  "who_they_are": "1 paragraph, 3-4 sentences. Describe what this person values based on ALL answers. Cover career direction, financial approach, relationship with visa status, settlement priorities. Do NOT mention any visa. Second person.",
  "visa_conflicts": "One sentence per conflicting visa only, each separated by a double pipe ||. Format each as: You [what they value]. [Visa name] [specific conflict]. That makes this route a poor fit. Only include visas that truly conflict. Never start with a visa name.",
  "routes": ["Route Name"],
  "route_reasons": "One paragraph per recommended route, separated by a double pipe ||. 2-3 sentences each. Explain specifically why it fits using their actual answers. Start with You."
}

CRITICAL RULES:
- Maximum 2 routes
- When someone wants stable employment at one company, recommend BOTH Skilled Worker Visa AND Global Talent Visa - same career goal, but Global Talent does not tie status to employer
- Global Talent only conflicts if person needs to work outside their endorsed field
- Never start any paragraph with a visa name
- Use hyphens not em dashes`;

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

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (parseError) {
      // Try to fix common JSON issues - replace literal newlines in strings
      const fixed = clean.replace(/\n/g, ' ').replace(/\r/g, '');
      parsed = JSON.parse(fixed);
    }

    // Convert pipe-separated fields to arrays for the frontend
    if (parsed.visa_conflicts) {
      parsed.visa_conflicts = parsed.visa_conflicts.split('||').map(s => s.trim()).filter(Boolean);
    }
    if (parsed.route_reasons) {
      parsed.route_reasons = parsed.route_reasons.split('||').map(s => s.trim()).filter(Boolean);
    }

    res.status(200).json(parsed);

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
