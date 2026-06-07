import { config as loadDotenv } from 'dotenv';
loadDotenv();

const SCORECARD_BASE = 'https://api.data.gov/ed/collegescorecard/v1/schools.json';

const FIELDS = [
  'school.name',
  'school.city',
  'school.state',
  'school.school_url',
  'school.ownership',
  'school.carnegie_basic',
  'latest.admissions.admission_rate.overall',
  'latest.cost.avg_net_price.public',
  'latest.cost.avg_net_price.private',
  'latest.completion.rate_suppressed.overall',
  'latest.earnings.10_yrs_after_entry.median',
  'latest.student.size',
].join(',');

const PROGRAM_KEYWORDS = {
  health: ['nursing', 'health', 'medical', 'pharmacy', 'medicine', 'dental', 'therapy'],
  tech: ['computer', 'information technology', 'software', 'cyber', 'data'],
  business: ['business', 'accounting', 'finance', 'marketing', 'management'],
  education: ['education', 'teaching', 'elementary', 'secondary'],
  arts: ['art', 'design', 'communications', 'media', 'journalism'],
  trades: ['welding', 'automotive', 'construction', 'culinary', 'hvac', 'electrical'],
  social: ['social work', 'psychology', 'counseling', 'criminal justice'],
  science: ['biology', 'chemistry', 'environmental', 'agriculture'],
};

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

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const API_KEY = process.env.COLLEGE_SCORECARD_API_KEY;
    if (!API_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'College Scorecard API key not configured' }) };
    }

    const { postSecondaryPlans, interests, topCareers, collegeProximity } = JSON.parse(event.body || '{}');

    const wantsFourYear = postSecondaryPlans?.includes('4-Year College');
    const wantsTwoYear = postSecondaryPlans?.includes('2-Year College') ||
                         postSecondaryPlans?.includes('Trade School / Vocational') ||
                         postSecondaryPlans?.includes('Straight to Work');

    const params = new URLSearchParams({
      'school.state': 'AR',
      'fields': FIELDS,
      'per_page': '30',
      'api_key': API_KEY,
      'school.operating': '1',
    });

    // Filter by degree type
    if (wantsTwoYear && !wantsFourYear) {
      params.append('school.carnegie_basic__range', '1..13'); // Associate/certificate focus
    } else if (wantsFourYear && !wantsTwoYear) {
      params.append('school.carnegie_basic__range', '14..23'); // Bachelor's focus
    }

    const response = await fetch(`${SCORECARD_BASE}?${params}`);
    if (!response.ok) {
      throw new Error(`College Scorecard API returned ${response.status}`);
    }
    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return { statusCode: 200, headers, body: JSON.stringify({ colleges: [] }) };
    }

    const interestsLower = (interests || '').toLowerCase();
    const careerTitles = (topCareers || []).map(c => (c.title || '').toLowerCase()).join(' ');
    const combined = interestsLower + ' ' + careerTitles;

    const studentCategories = Object.entries(PROGRAM_KEYWORDS)
      .filter(([, words]) => words.some(w => combined.includes(w)))
      .map(([cat]) => cat);

    const scored = data.results.map(school => {
      const schoolName = school['school.name'] || '';
      const city = school['school.city'] || '';
      const admitRate = school['latest.admissions.admission_rate.overall'];
      const netPricePublic = school['latest.cost.avg_net_price.public'];
      const netPricePrivate = school['latest.cost.avg_net_price.private'];
      const netPrice = netPricePublic ?? netPricePrivate;
      const completionRate = school['latest.completion.rate_suppressed.overall'];
      const medianEarnings = school['latest.earnings.10_yrs_after_entry.median'];
      const size = school['latest.student.size'];
      const ownership = school['school.ownership'];
      const url = school['school.school_url'] || null;

      let score = 0;
      let matchReason = '';

      // Boost PCCUA for Helena-area students (always, and especially for close_to_home)
      const isPCCUA = schoolName.toLowerCase().includes('phillips');
      if (isPCCUA) {
        score += 30;
        matchReason = 'Local institution with strong workforce programs';
      }

      // Proximity scoring — based on Helena-West Helena location
      const CLOSE_TO_HOME_SCHOOLS = ['phillips', 'arkansas state', 'delta', 'helena', 'forrest city', 'marianna'];
      const isNearDelta = CLOSE_TO_HOME_SCHOOLS.some(k => schoolName.toLowerCase().includes(k) || city.toLowerCase().includes(k));
      if (collegeProximity === 'close_to_home') {
        if (isNearDelta) score += 25;
        else score -= 10;
        if (!matchReason) matchReason = isNearDelta ? 'Close to home in the Delta region' : 'Arkansas school within reach';
      } else if (collegeProximity === 'ready_to_go_far') {
        if (!isNearDelta) score += 10;
        if (!matchReason) matchReason = 'Good fit for students ready to explore beyond home';
      }

      // Completion rate bonus
      if (completionRate > 0.5) score += 20;
      if (completionRate > 0.7) score += 10;

      // Affordability bonus
      if (netPrice != null && netPrice < 8000) score += 20;
      else if (netPrice != null && netPrice < 15000) score += 10;

      // Earnings bonus
      if (medianEarnings > 40000) score += 15;
      if (medianEarnings > 50000) score += 10;

      const typeLabel = ownership === 1 ? 'Public'
                      : ownership === 2 ? 'Private Nonprofit'
                      : 'Private For-Profit';
      const sizeLabel = !size ? 'Unknown'
                      : size < 2000 ? 'Small'
                      : size < 10000 ? 'Medium'
                      : 'Large';

      const admitPercent = admitRate != null
        ? Math.round(admitRate * 100) + '%'
        : 'Open enrollment';
      const priceDisplay = netPrice != null
        ? '$' + Math.round(netPrice).toLocaleString() + '/yr'
        : 'Contact school';
      const earningsDisplay = medianEarnings != null
        ? '$' + Math.round(medianEarnings).toLocaleString() + '/yr'
        : null;
      const completionDisplay = completionRate != null
        ? Math.round(completionRate * 100) + '%'
        : null;

      if (!matchReason) {
        if (completionRate > 0.7) matchReason = 'Strong graduation rate';
        else if (netPrice != null && netPrice < 8000) matchReason = 'Affordable net price after aid';
        else if (medianEarnings > 45000) matchReason = 'Strong graduate earnings';
        else matchReason = 'Good fit for your Arkansas path';
      }

      return {
        name: schoolName,
        city,
        type: typeLabel,
        size: sizeLabel,
        admissionRate: admitPercent,
        netPrice: priceDisplay,
        medianEarnings: earningsDisplay,
        completionRate: completionDisplay,
        url,
        matchReason,
        score,
      };
    });

    const top5 = scored.sort((a, b) => b.score - a.score).slice(0, 5);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ colleges: top5 }),
    };
  } catch (err) {
    console.error('College Scorecard error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
