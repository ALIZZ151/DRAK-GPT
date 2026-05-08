let lastSendAt = 0;

export function canSendNow(cooldownMs = 700) {
  const now = Date.now();
  if (now - lastSendAt < cooldownMs) return false;
  lastSendAt = now;
  return true;
}

export function resetClientRateLimit() {
  lastSendAt = 0;
}
