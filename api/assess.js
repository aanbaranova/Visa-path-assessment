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
- Immigration status is directly tied to that employer - if employment ends, your status becomes precarious and you need to act quickly to secure a new sponsor or resolve your situation
- Side work is restricted - you cannot freely freelance, consult, or run your own business as a primary income source alongside your sponsored role
- Every job change requires a new visa application and your new employer must be a licensed sponsor
- You CAN be employed stably at one company for years - this is the most common use case
- ILR after 5 years (government has proposed extending to 10 years)
- FITS: people who want stable employment and are comfortable with employer dependency
- CONFLICTS: people who want career flexibility, multiple income streams, freelancing, or their own business

GLOBAL TALENT VISA:
- No employer sponsor needed
- You CAN work as a full-time employee at one company - does NOT require freelancing or self-employment
- You can also freelance, consult, have multiple income streams, or run a business
- Key restriction: when extending or applying for ILR, must show earnings and work in your endorsed professional field. If your business or work is in your endorsed field, this is not a problem. If you want to work primarily outside your endorsed field, this is a conflict.
- ILR after 3 years (research/academia) or 5 years (other fields)
- FITS: people who want freedom to work however they choose - employed, freelance, or running a business - as long as that work is in their endorsed professional field
- CONFLICTS: people who want to work primarily outside their endorsed professional field

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

Generate a profile in this EXACT JSON format. Raw JSON only, no markdown, no backticks. All string values must be valid JSON with no unescaped newlines.

{
  "priorities": "3-5 values separated by commas, lowercase",
  "who_they_are": "1 paragraph, 3-4 sentences. Who this person is based on ALL their answers. Cover career direction, financial approach, relationship with visa status, settlement priorities. Do NOT mention any visa. Second person. No apostrophes - use full words instead (e.g. you are instead of you're, do not instead of don't).",
  "routes": ["Route Name"],
  "route_reasons": "One paragraph per recommended route separated by ||. 2-3 sentences each explaining specifically why it fits their answers. Start each with You. No apostrophes.",
  "visa_conflicts": "One paragraph per conflicting visa separated by ||. 2-3 sentences each. First sentence: what the person values or needs. Second sentence: the specific visa restriction that conflicts - be precise and accurate, do not overstate restrictions. Third sentence: That makes this route a poor fit. Never start with a visa name - always start with You. No apostrophes."
}

CRITICAL RULES:
- Maximum 2 routes
- When someone wants to freelance or consult, recommend Global Talent Visa only. Do NOT recommend Innovator Founder Visa - freelancing and consulting are not the same as building an endorsed business with milestone accountability.
- When someone explicitly wants to build and run their own business (not freelance or consult), recommend BOTH Global Talent Visa AND Innovator Founder Visa. In route_reasons for Global Talent, always note it works as long as the business stays in their endorsed professional field. In route_reasons for Innovator Founder, note the milestone accountability structure.
- When someone wants stable employment at one company, recommend BOTH Skilled Worker Visa AND Global Talent Visa - same career goal but Global Talent does not tie status to employer.
- When someone wants to work outside their endorsed professional field, recommend ONLY Innovator Founder Visa and flag Global Talent as a conflict.
- Global Talent ONLY conflicts if the person wants to work primarily outside their endorsed professional field. It does NOT conflict with entrepreneurship or freelancing within their field.
- Innovator Founder conflicts if someone wants stable employment, needs predictable income, or does not want to be accountable to an endorsing body with milestone reviews.
- Skilled Worker conflicts if someone wants freelancing, multiple income streams, or their own business.
- When the person answered Q4 (what would stress you more) with "Feeling tied to one professional field", and Global Talent Visa is recommended, the route_reasons for Global Talent MUST explicitly name this tension. Do not mention the endorsed field restriction in passing - dedicate a full sentence to it. For example: "This route does give you flexibility in how you work, but it requires you to show earnings in your endorsed professional field when extending or applying for settlement - given that being tied to one field is your biggest stress point, this is worth thinking through carefully before choosing this route."
- When mentioning Global Talent Visa settlement timeline, always say "3 or 5 years depending on your field" - never state it as a flat 5 years. Research and academia route is 3 years, other fields are 5 years.
- When describing Global Talent Visa benefits, never frame it as "you do not have to freelance" or "without any requirement to freelance" - no visa requires freelancing. Instead frame it positively: you can work as an employee, freelance, consult, or run a business - the choice is yours.
- Always use the exact visa names: Skilled Worker Visa, Global Talent Visa, Innovator Founder Visa. Never shorten to "Skilled Worker route", "Global Talent route", etc.
- Never start any paragraph with a visa name - always start with You
- Use hyphens not em dashes
- No apostrophes anywhere in the output - rephrase to avoid them
- For Skilled Worker Visa conflicts: say side work is restricted, not prohibited. Say status becomes precarious if employment ends, not that status is lost immediately.`;

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
      const fixed = clean.replace(/\n/g, ' ').replace(/\r/g, '');
      parsed = JSON.parse(fixed);
    }

    // Convert pipe-separated fields to arrays
    if (parsed.visa_conflicts) {
      parsed.visa_conflicts = parsed.visa_conflicts.split('||').map(s => s.trim()).filter(Boolean);
    }
    if (parsed.route_reasons) {
      parsed.route_reasons = parsed.route_reasons.split('||').map(s => s.trim()).filter(Boolean);
    }

    // Replace straight apostrophes with smart ones in all string fields
    const smartify = str => str.replace(/'/g, '\u2019');
    if (parsed.priorities) parsed.priorities = smartify(parsed.priorities);
    if (parsed.who_they_are) parsed.who_they_are = smartify(parsed.who_they_are);
    if (parsed.visa_conflicts) parsed.visa_conflicts = parsed.visa_conflicts.map(smartify);
    if (parsed.route_reasons) parsed.route_reasons = parsed.route_reasons.map(smartify);

    res.status(200).json(parsed);

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
