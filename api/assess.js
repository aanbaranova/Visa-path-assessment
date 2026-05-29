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
- Immigration status is directly tied to that employer - if employment ends, status becomes precarious and the person must act quickly to secure a new sponsor
- Side work is restricted - cannot freely freelance, consult, or run a business as a primary income source
- Every job change requires a new visa application
- CAN be employed stably at one company for years - most common use case
- ILR after 5 years (government has proposed extending to 10 years)
- FITS: people who want stable employment and are comfortable with employer dependency
- CONFLICTS: people who want career flexibility, multiple income streams, freelancing, or their own business

GLOBAL TALENT VISA:
- No employer sponsor needed
- CAN work as a full-time employee at one company - does NOT require freelancing or self-employment
- Can also freelance, consult, have multiple income streams, or run a business
- Key restriction: when extending or applying for ILR, must show earnings and work in endorsed professional field
- ILR after 3 or 5 years depending on your endorsement type
- FITS: people who want freedom to work however they choose in their endorsed field - employed, freelance, or running a business
- CONFLICTS: people who want to work primarily outside their endorsed professional field

INNOVATOR FOUNDER VISA:
- Must run own business - employment as primary activity not permitted
- Locked into one endorsed business idea - major changes require re-endorsement
- Mandatory progress reviews at 12 and 24 months
- Visa can be cut short if endorsement withdrawn
- Supplementary employment is allowed but only in skilled roles (Level 3 qualification minimum) and must remain secondary to the business - you cannot pivot to employment as your main activity
- ILR after 3 years if milestones met
- FITS: people who want to build their own business, can accept financial uncertainty, and are comfortable with milestone accountability
- CONFLICTS: people who want stable employment, need predictable income, or do not want to be tied to one business idea with mandatory reviews

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
  "who_they_are": "1 paragraph, 3-4 sentences. Who this person is based on ALL their answers. Cover career direction, financial approach, relationship with visa status, settlement priorities. Do NOT mention any visa. Second person.",
  "routes": ["Route Name"],
  "route_reasons": "One entry per recommended route in format VISANAME: reason. Separate entries with ||. Each reason is 2-3 sentences explaining specifically why it fits. Start each with You.",
  "visa_conflicts": "One paragraph per conflicting visa separated by ||. 2-3 sentences each. First sentence: what the person values or needs. Second sentence: the specific visa restriction that conflicts - be precise and accurate. Third sentence: That makes this route a poor fit. Never start with a visa name - always start with You."
}

CRITICAL RULES:
- A visa must NEVER appear in both routes and visa_conflicts. Never both.
- Maximum 2 routes.
- FINANCIAL PREDICTABILITY TIEBREAKER: If someone wants to build a business BUT also needs predictable income or finds business uncertainty stressful (Q6), do NOT recommend Innovator Founder Visa - recommend Global Talent Visa only, and note in route_reasons that Global Talent allows entrepreneurship while also permitting a return to employment if needed.
- When someone wants to freelance or consult: recommend Global Talent Visa only. Innovator Founder is for business founders, not freelancers.
- When someone explicitly wants to build their own business AND is comfortable with financial uncertainty (Q6): recommend BOTH Global Talent Visa AND Innovator Founder Visa.
- When someone wants stable employment: recommend BOTH Skilled Worker Visa AND Global Talent Visa.
- When someone wants to work outside their endorsed field: recommend Innovator Founder Visa only.
- Global Talent ONLY conflicts if the person wants to work primarily outside their endorsed field.
- Innovator Founder conflicts if someone wants stable employment, needs predictable income, or does not want milestone accountability.
- Skilled Worker conflicts if someone wants freelancing, multiple income streams, or their own business.
- When Q4 answer is "Feeling tied to one professional field" and Global Talent is recommended: dedicate a full sentence in route_reasons to the endorsed field restriction tension.
- Global Talent settlement timeline: always say "3 or 5 years depending on your endorsement type" - never a flat 5 years and never attribute the timeline to field alone.
- Never frame Global Talent as "you do not have to freelance" - frame positively.
- Always use exact visa names: Skilled Worker Visa, Global Talent Visa, Innovator Founder Visa.
- Never start any paragraph with a visa name - always start with You.
- Use hyphens not em dashes.
- For Innovator Founder conflicts: never say employment is completely prohibited. Say supplementary employment is limited to skilled roles and must remain secondary to the business - it cannot become the primary activity.
- For Skilled Worker conflicts: say side work is restricted not prohibited. Say status becomes precarious if employment ends, not lost immediately.`;

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
        max_tokens: 1600,
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

    // Parse route_reasons into a map keyed by visa name
    if (parsed.route_reasons && typeof parsed.route_reasons === 'string') {
      const entries = parsed.route_reasons.split('||').map(s => s.trim()).filter(Boolean);
      const reasonMap = {};
      entries.forEach(entry => {
        const colonIdx = entry.indexOf(':');
        if (colonIdx > -1) {
          const key = entry.substring(0, colonIdx).trim();
          const val = entry.substring(colonIdx + 1).trim();
          // Normalise key to exact visa name
          if (key.toLowerCase().includes('skilled')) reasonMap['Skilled Worker Visa'] = val;
          else if (key.toLowerCase().includes('global')) reasonMap['Global Talent Visa'] = val;
          else if (key.toLowerCase().includes('innovator')) reasonMap['Innovator Founder Visa'] = val;
        } else {
          // No colon - fallback, assign to first unmatched route
          reasonMap['_fallback_' + Object.keys(reasonMap).length] = entry;
        }
      });
      parsed.route_reasons = reasonMap;
    }

    // Parse visa_conflicts to array
    if (parsed.visa_conflicts && typeof parsed.visa_conflicts === 'string') {
      parsed.visa_conflicts = parsed.visa_conflicts.split('||').map(s => s.trim()).filter(Boolean);
    }

    // Replace straight apostrophes and literal unicode escapes with smart apostrophes
    const smartify = str => str
      .replace(/\\u2019/g, '\u2019')
      .replace(/\u2018/g, '\u2019')
      .replace(/'/g, '\u2019');

    if (parsed.priorities) parsed.priorities = smartify(parsed.priorities);
    if (parsed.who_they_are) parsed.who_they_are = smartify(parsed.who_they_are);
    if (Array.isArray(parsed.visa_conflicts)) parsed.visa_conflicts = parsed.visa_conflicts.map(smartify);
    if (parsed.route_reasons && typeof parsed.route_reasons === 'object') {
      Object.keys(parsed.route_reasons).forEach(k => {
        parsed.route_reasons[k] = smartify(parsed.route_reasons[k]);
      });
    }

    res.status(200).json(parsed);

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
