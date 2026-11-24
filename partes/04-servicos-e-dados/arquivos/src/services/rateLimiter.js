
const STORAGE_KEY = 'api_request_timestamps';
const LIMIT = 20; // Changed from 50 to 20 requests per minute
const WINDOW_MS = 60000; // 1 minute

const getStoredTimestamps = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveTimestamps = (timestamps) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(timestamps));
  // Dispatch event for cross-tab sync
  window.dispatchEvent(new Event('rate_limit_updated'));
};

/**
 * Removes timestamps older than the window
 */
export const clearOldRequests = () => {
  const now = Date.now();
  const timestamps = getStoredTimestamps();
  // Filter timestamps that are within the window (now - ts < 60000)
  const validTimestamps = timestamps.filter(ts => (now - ts) < WINDOW_MS);
  
  if (validTimestamps.length !== timestamps.length) {
    saveTimestamps(validTimestamps);
  }
  return validTimestamps;
};

/**
 * Checks current rate limit status without recording a request
 */
export const checkRateLimit = () => {
  const timestamps = clearOldRequests();
  const now = Date.now();
  const usage = timestamps.length;
  const allowed = usage < LIMIT;
  
  let resetTime = null;
  let waitSeconds = 0;

  if (usage > 0) {
    // The oldest request dictates when a slot will free up
    // Timestamps are appended, so index 0 is oldest
    const oldest = timestamps[0];
    const expiry = oldest + WINDOW_MS;
    
    // If we are at limit, we must wait until oldest expires
    // If we are not at limit, resetTime is still useful info (when the next oldest expires)
    if (!allowed) {
        resetTime = expiry;
        waitSeconds = Math.max(0, Math.ceil((expiry - now) / 1000));
    }
  }

  return {
    allowed,
    remaining: Math.max(0, LIMIT - usage),
    usage,
    limit: LIMIT,
    resetTime,
    waitSeconds
  };
};

/**
 * Records a new request if allowed
 */
export const recordRequest = () => {
  // Sync state first
  clearOldRequests();
  
  const status = checkRateLimit();
  if (!status.allowed) return false;

  const timestamps = getStoredTimestamps();
  timestamps.push(Date.now());
  saveTimestamps(timestamps);
  
  return true;
};

export const getRemainingRequests = () => {
  return checkRateLimit().remaining;
};

export const getResetTime = () => {
  return checkRateLimit().resetTime;
};
