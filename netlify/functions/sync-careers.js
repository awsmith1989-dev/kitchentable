import { config as loadDotenv } from 'dotenv';
loadDotenv();

const ONET_BASE = 'https://api-v2.onetcenter.org';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

function getOnetHeaders() {
  const API_KEY = process.env.ONET_API_KEY;
  if (!API_KEY) throw new Error('Missing ONET_API_KEY environment variable');
  return {
    'X-API-Key': API_KEY,
    'Accept': 'application/json',
  };
}

function getSupabaseHeaders() {
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseKey) return null;
  return {
    'apikey': supabaseKey,
    'Authorization': 'Bearer ' + supabaseKey,
    'Content-Type': 'application/json',
  };
}

async function testOnetConnection(headers) {
  const testResponse = await fetch(`${ONET_BASE}/about/`, { headers });
  if (!testResponse.ok) {
    const body = await testResponse.text();
    throw new Error(`O*NET connection test failed — HTTP ${testResponse.status}: ${body.slice(0, 200)}`);
  }
  const testData = await testResponse.json();
  console.log('O*NET connection test:', JSON.stringify(testData, null, 2));
  return testData;
}

// Fetches all careers from /mnm/careers/ and filters client-side for bright_outlook.
// The API does not support server-side bright_outlook filtering — returns all 923 entries
// regardless of the query param. We paginate with start/end and filter locally.
async function fetchBrightOutlookCareers(headers) {
  const all = [];
  const pageSize = 100;
  let start = 1;

  while (true) {
    const end = start + pageSize - 1;
    const url = `${ONET_BASE}/mnm/careers/?start=${start}&end=${end}`;
    const resp = await fetch(url, { headers });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`O*NET careers fetch failed — HTTP ${resp.status}: ${body.slice(0, 200)}`);
    }

    const data = await resp.json();
    const batch = data.career ?? [];
    all.push(...batch);

    const total = data.total ?? 0;
    if (all.length >= total || batch.length === 0) break;

    start += pageSize;
  }

  const brightOutlook = all.filter(c => c.tags?.bright_outlook === true);
  console.log(`O*NET — fetched ${all.length} total, ${brightOutlook.length} with bright_outlook`);
  return { all: brightOutlook, totalFetched: all.length };
}

// Upserts bright outlook careers to the careers table and returns added/updated counts.
async function upsertCareers(careers) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const sbHeaders = getSupabaseHeaders();
  if (!supabaseUrl || !sbHeaders) return { skipped: true, reason: 'missing Supabase credentials' };

  // Get existing codes to calculate added vs updated
  const existingResp = await fetch(
    `${supabaseUrl}/rest/v1/careers?select=code`,
    { headers: { ...sbHeaders, 'Prefer': 'return=representation' } }
  );

  let existingCodes = new Set();
  if (existingResp.ok) {
    const rows = await existingResp.json();
    existingCodes = new Set(rows.map(r => r.code));
  }

  const payload = careers.map(c => ({
    code: c.code,
    title: c.title,
    bright_outlook: true,
    onet_href: c.href ?? null,
    synced_at: new Date().toISOString(),
  }));

  const upsertResp = await fetch(`${supabaseUrl}/rest/v1/careers`, {
    method: 'POST',
    headers: {
      ...sbHeaders,
      'Prefer': 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(payload),
  });

  if (!upsertResp.ok) {
    const errText = await upsertResp.text();
    console.error('careers upsert failed:', upsertResp.status, errText);
    return { upsertError: errText, status: upsertResp.status };
  }

  const added = careers.filter(c => !existingCodes.has(c.code)).length;
  const updated = careers.filter(c => existingCodes.has(c.code)).length;
  return { added, updated };
}

async function logToSupabase(status, payload) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const sbHeaders = getSupabaseHeaders();
  if (!supabaseUrl || !sbHeaders) {
    console.warn('Supabase credentials missing — skipping career_sync_log write');
    return null;
  }

  const resp = await fetch(`${supabaseUrl}/rest/v1/career_sync_log`, {
    method: 'POST',
    headers: { ...sbHeaders, 'Prefer': 'return=representation' },
    body: JSON.stringify({ ...payload, synced_at: new Date().toISOString() }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error('career_sync_log insert failed:', resp.status, errText);
    return { insertError: errText };
  }

  const rows = await resp.json();
  return rows?.[0] ?? null;
}

export const handler = async (event) => {
  const trigger = event.queryStringParameters?.trigger;
  const isScheduled = event.httpMethod === 'POST' && !trigger;
  const isManual = trigger === 'manual';

  if (!isScheduled && !isManual) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Add ?trigger=manual to run manually' }),
    };
  }

  let onetHeaders;
  try {
    onetHeaders = getOnetHeaders();
  } catch (err) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }

  // Step 1 — verify connection
  let connectionData;
  try {
    connectionData = await testOnetConnection(onetHeaders);
  } catch (err) {
    const logRow = await logToSupabase('error', { status: 'error', message: err.message, careers_fetched: 0, details: { phase: 'connection_test' } });
    return { statusCode: 502, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message, log: logRow }) };
  }

  // Step 2 — fetch bright outlook careers
  let careers, totalFetched;
  try {
    ({ all: careers, totalFetched } = await fetchBrightOutlookCareers(onetHeaders));
  } catch (err) {
    const logRow = await logToSupabase('error', { status: 'error', message: err.message, careers_fetched: 0, details: { phase: 'fetch_careers' } });
    return { statusCode: 502, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message, log: logRow }) };
  }

  // Step 3 — upsert to careers table
  const upsertResult = await upsertCareers(careers);

  // Step 4 — write sync log
  const logPayload = {
    status: 'success',
    careers_fetched: careers.length,
    careers_added: upsertResult.added ?? null,
    careers_updated: upsertResult.updated ?? null,
    message: `Fetched ${totalFetched} O*NET occupations, ${careers.length} with bright outlook. Added: ${upsertResult.added ?? 'n/a'}, Updated: ${upsertResult.updated ?? 'n/a'}.`,
    details: {
      trigger: isManual ? 'manual' : 'scheduled',
      total_onet_records: totalFetched,
      api_version: connectionData.api_version,
      database: connectionData.database?.name,
      upsert: upsertResult,
      sample: careers.slice(0, 5).map(c => ({ code: c.code, title: c.title })),
    },
  };

  const logRow = await logToSupabase('success', logPayload);

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      success: true,
      connectionData,
      totalOnetRecords: totalFetched,
      careersFetched: careers.length,
      upsert: upsertResult,
      sample: careers.slice(0, 10).map(c => ({ code: c.code, title: c.title })),
      log: logRow,
    }),
  };
};
