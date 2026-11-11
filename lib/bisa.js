const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getSupabaseConfig() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    const error = new Error('The BISA backend is not configured. Set its Supabase environment variables in Vercel.');
    error.status = 503;
    throw error;
  }
  return { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, serviceKey: SUPABASE_SERVICE_ROLE_KEY };
}

function jsonResponse(res, status, value) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(value);
}

function endpoint(methods, action) {
  return async (req, res) => {
    if (!methods.includes(req.method)) {
      res.setHeader('Allow', methods.join(', '));
      return jsonResponse(res, 405, { error: 'Method not allowed.' });
    }

    try {
      await action(req, res);
    } catch (error) {
      console.error('BISA API request failed:', error);
      if (!res.headersSent) {
        const status = Number.isInteger(error.status) ? error.status : 500;
        const message = status >= 500 && status !== 503
          ? 'The request could not be completed. Please try again or contact the BISA administrator.'
          : error.message;
        jsonResponse(res, status, { error: message });
      }
    }
  };
}

async function supabaseRequest(path, options) {
  const config = getSupabaseConfig();
  const response = await fetch(`${config.url}${path}`, {
    ...options,
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      ...(options && options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options && options.headers ? options.headers : {})
    }
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!response.ok) {
    const error = new Error(typeof data === 'string' ? data : data?.message || data?.error || 'Supabase request failed.');
    error.status = response.status;
    throw error;
  }
  return data;
}

function encodeStoragePath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

async function signStorageObject(path, expiresIn = 3600) {
  const result = await supabaseRequest(
    `/storage/v1/object/sign/business-media/${encodeStoragePath(path)}`,
    { method: 'POST', body: JSON.stringify({ expiresIn }) }
  );
  const { url } = getSupabaseConfig();
  return `${url}${result.signedURL.startsWith('/') ? result.signedURL : `/${result.signedURL}`}`;
}

async function downloadStoragePrefix(path) {
  const config = getSupabaseConfig();
  const response = await fetch(`${config.url}/storage/v1/object/authenticated/business-media/${encodeStoragePath(path)}`, {
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      Range: 'bytes=0-31'
    }
  });
  if (!response.ok) {
    const error = new Error('An uploaded file could not be verified.');
    error.status = response.status;
    throw error;
  }
  return new Uint8Array(await response.arrayBuffer());
}

async function requireAdmin(req, allowedRoles = []) {
  const config = getSupabaseConfig();
  const authorization = req.headers.authorization || '';
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    const error = new Error('Please sign in with an authorized administrator account.');
    error.status = 401;
    throw error;
  }

  const userResponse = await fetch(`${config.url}/auth/v1/user`, {
    headers: { apikey: config.anonKey, Authorization: `Bearer ${token}` }
  });
  if (!userResponse.ok) {
    const error = new Error('Your administrator session has expired. Please sign in again.');
    error.status = 401;
    throw error;
  }
  const user = await userResponse.json();
  const roles = await supabaseRequest(
    `/rest/v1/admin_roles?select=role_name&profile_id=eq.${encodeURIComponent(user.id)}`
  );
  const roleNames = roles.map((role) => role.role_name);
  if (!roleNames.length || (allowedRoles.length && !roleNames.some((role) => allowedRoles.includes(role)))) {
    const error = new Error('Your account does not have permission to perform this action.');
    error.status = 403;
    throw error;
  }
  return { user, roles: roleNames };
}

async function recordActivity(applicationId, actorId, action, details) {
  return supabaseRequest('/rest/v1/application_activity_logs', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      application_id: applicationId || null,
      actor_profile_id: actorId || null,
      action,
      details: details || null
    })
  });
}

function assert(condition, message, status = 400) {
  if (!condition) {
    const error = new Error(message);
    error.status = status;
    throw error;
  }
}

module.exports = {
  assert,
  downloadStoragePrefix,
  encodeStoragePath,
  endpoint,
  getSupabaseConfig,
  jsonResponse,
  recordActivity,
  requireAdmin,
  signStorageObject,
  supabaseRequest
};
