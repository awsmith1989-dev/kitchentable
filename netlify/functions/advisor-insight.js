import { arkansasCareers } from './arkansas-careers.js';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

function findRelevantCareers(postSecondaryPlans, interests, strongSubjects) {
  const results = [];
  const interestsLower = (interests || '').toLowerCase();
  const subjectsLower = (strongSubjects || []).join(' ').toLowerCase();
  const combined = interestsLower + ' ' + subjectsLower;

  const includeHighSchool = postSecondaryPlans?.includes('Straight to Work') ||
                             postSecondaryPlans?.includes('Military');
  const includeAssociate = postSecondaryPlans?.includes('2-Year College') ||
                            postSecondaryPlans?.includes('Trade School / Vocational');
  const includeBachelor = postSecondaryPlans?.includes('4-Year College');

  const keywords = {
    health: ['health', 'medicine', 'nursing', 'doctor', 'medical', 'hospital', 'biology', 'science'],
    tech: ['computer', 'coding', 'technology', 'software', 'data', 'programming', 'gaming', 'robotics'],
    business: ['business', 'entrepreneur', 'sales', 'marketing', 'management', 'finance', 'money'],
    education: ['teach', 'school', 'education', 'kids', 'children', 'tutor'],
    arts: ['art', 'design', 'creative', 'music', 'writing', 'media', 'film'],
    trades: ['weld', 'build', 'construct', 'mechanical', 'electric', 'plumb', 'hvac', 'car', 'engine'],
    social: ['social work', 'community', 'counseling', 'mental health', 'nonprofit', 'people'],
    law: ['law', 'legal', 'criminal', 'police', 'justice', 'court'],
    environment: ['environment', 'nature', 'agriculture', 'farm', 'outdoor', 'conservation'],
    culinary: ['cook', 'food', 'restaurant', 'culinary', 'chef', 'bake'],
    sports: ['sports', 'athletic', 'fitness', 'physical therapy', 'kinesiology', 'basketball', 'football'],
  };

  const matchedCategories = Object.entries(keywords)
    .filter(([, words]) => words.some(w => combined.includes(w)))
    .map(([cat]) => cat);

  const careerCategories = {
    health: ['Registered Nurses', 'Dental Hygienists', 'Respiratory Therapists',
             'Diagnostic Medical Sonographers', 'Physical Therapist Assistants',
             'Occupational Therapy Assistants', 'Cardiovascular Technologists and Technicians',
             'Medical and Health Services Managers', 'Dietitians and Nutritionists',
             'Substance Abuse and Mental Health Counselors', 'Nuclear Medicine Technologists'],
    tech: ['Software Developers', 'Information Security Analysts', 'Data Scientists',
           'Computer and Information Systems Managers', 'Computer Systems Analysts',
           'Network and Computer Systems Administrators', 'Web Developers',
           'Computer Network Architects', 'Database Administrators'],
    business: ['Marketing Managers', 'Sales Managers', 'Financial Managers',
               'Management Analysts', 'Personal Financial Advisors', 'Accountants and Auditors',
               'Human Resources Managers', 'Project Management Specialists', 'Chief Executives',
               'Training and Development Managers', 'Logisticians'],
    education: ['Elementary School Teachers', 'Middle School Teachers', 'Secondary School Teachers',
                'Preschool Teachers (except special education)', 'Substance Abuse and Mental Health Counselors'],
    arts: ['Graphic Designers', 'Web and Digital Interface Designers', 'Writers and Authors',
           'Web Developers'],
    trades: ['Electricians', 'Plumbers, Pipefitters and Steamfitters', 'Carpenters',
             'Sheet Metal Workers', 'Millwrights', 'Automotive Body and Related Repairers',
             'Farm Equipment Mechanics and Service Technicians', 'Brickmasons and Blockmasons'],
    social: ['Social Workers', 'Substance Abuse and Mental Health Counselors',
             'Social and Community Service Managers', 'Child Care Workers',
             'Recreational Therapists'],
    law: ['Police and Sheriffs Patrol Officers', 'Paralegal and Legal Assistants'],
    environment: ['Environmental Engineers', 'Agricultural Technicians',
                  'Farm Equipment Mechanics and Service Technicians'],
    culinary: ['Chefs and Head Cooks', 'Food Service Managers', 'Food Science Technicians'],
    sports: ['Physical Therapist Assistants', 'Occupational Therapy Assistants',
             'Recreational Therapists'],
  };

  const allCareers = [
    ...arkansasCareers.highSchoolDiploma.map(c => ({ ...c, level: 'High School Diploma' })),
    ...arkansasCareers.associateDegree.map(c => ({ ...c, level: 'Associate Degree' })),
    ...arkansasCareers.bachelorsDegree.map(c => ({ ...c, level: "Bachelor's Degree" })),
  ];

  matchedCategories.forEach(cat => {
    const catCareers = careerCategories[cat] || [];
    catCareers.forEach(title => {
      const career = allCareers.find(c => c.title === title);
      if (!career) return;
      const levelMatch =
        (career.level === 'High School Diploma' && includeHighSchool) ||
        (career.level === 'Associate Degree' && includeAssociate) ||
        (career.level === "Bachelor's Degree" && includeBachelor) ||
        !postSecondaryPlans?.length;
      if (levelMatch && !results.find(r => r.title === title)) {
        results.push(career);
      }
    });
  });

  const outlookOrder = { AA: 0, A: 1, BA: 2, D: 3 };
  results.sort((a, b) =>
    (outlookOrder[a.outlook] - outlookOrder[b.outlook]) || ((b.wage ?? 0) - (a.wage ?? 0))
  );

  return results.slice(0, 4);
}

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        keyPrefix: process.env.ANTHROPIC_API_KEY?.substring(0, 8) || null,
      }),
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { prompt, postSecondaryPlans, interests, strongSubjects, strengths, riasecCodes, specificCareerInterest, collegeProximity } = JSON.parse(event.body || '{}');

    if (!prompt) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing prompt' }) };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Missing Anthropic API key' }),
      };
    }

    const relevantCareers = findRelevantCareers(postSecondaryPlans, interests, strongSubjects);

    const proximityLabel =
      collegeProximity === 'close_to_home' ? 'Wants to stay close to home' :
      collegeProximity === 'weekend_distance' ? 'Wants to be close enough to come home on weekends' :
      collegeProximity === 'ready_to_go_far' ? 'Ready to go far from home' :
      null;

    const riasecLabels = {
      R: 'Realistic (hands-on, practical)',
      I: 'Investigative (analytical, curious)',
      A: 'Artistic (creative, expressive)',
      S: 'Social (people-oriented, caring)',
      E: 'Enterprising (leadership, persuasion)',
      C: 'Conventional (organized, detail-oriented)',
    };
    const riasecContext = riasecCodes?.length > 0
      ? `- Vocational interest profile (RIASEC): ${riasecCodes.map(c => riasecLabels[c] ?? c).join(', ')}\n`
      : '';

    const onboardingContext = (strengths?.length || riasecCodes?.length || specificCareerInterest || proximityLabel)
      ? `\nStudent profile (from onboarding):\n${
          riasecContext
        }${
          strengths?.length ? `- Things they enjoy doing: ${strengths.join(', ')}\n` : ''
        }${
          specificCareerInterest ? `- Specific career interest: ${specificCareerInterest}\n` : ''
        }${
          proximityLabel ? `- College proximity preference: ${proximityLabel}\n` : ''
        }`
      : '';

    const careerContext = relevantCareers.length > 0
      ? `Arkansas career matches based on this student's interests and goals:\n${relevantCareers.map(c =>
          `- ${c.title} | Education: ${c.level} | Arkansas workers: ${c.workers?.toLocaleString() ?? 'N/A'} | Job outlook: ${c.outlook} (${arkansasCareers.outlookLabels[c.outlook]}) | Median annual wage: $${c.wage?.toLocaleString() ?? 'N/A'}`
        ).join('\n')}`
      : '';

    const systemPrompt = `You are a warm, encouraging advisory advisor for a K-12 student in Arkansas.
You have access to real Arkansas labor market data from the 2025-2026 Arkansas Next career guide.

Your response must:
- Be 4-5 sentences maximum
- Speak directly to the student in second person ("You", "Your")
- Lead with a genuine strength or celebration
- Reference at least one specific Arkansas career by name, including its median wage and job outlook
- Connect the student's academic strengths in specific subjects to career requirements where relevant
- Connect their GPA trend to their career readiness in a constructive way
- If their GPA is below 2.5 and they want a 4-year college path, gently note that there are strong 2-year college and trade pathways that could also lead to great outcomes
- Use warm, asset-based language — never shame or deficit framing
- End with one specific, concrete action they can take this week

${careerContext}
${onboardingContext}
Never make up career data. Only reference careers from the Arkansas data provided above.
Never mention specific GPA numbers — speak in terms of trends and momentum instead.
Keep the response to 4-5 sentences. Be specific, not generic.`;

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', response.status, errorText);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to generate insight' }),
      };
    }

    const data = await response.json();
    const insight = typeof data.content?.[0]?.text === 'string'
      ? data.content[0].text.trim()
      : 'Unable to generate insight';

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ insight }),
    };
  } catch (error) {
    console.error('Error calling Anthropic API:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Failed to generate insight' }),
    };
  }
};
