// Import logger
importScripts('logger.js');

// Prevent concurrent rule updates
let isUpdatingRules = false;

// Default blocked sites
const DEFAULT_BLOCKED_SITES = [
  'youtube.com',
  'linkedin.com',
  'facebook.com',
  'twitter.com',
  'reddit.com',
  'instagram.com'
];

// Clean up expired temporary unblocks
async function cleanupExpiredUnblocks() {
  const { temporaryUnblocks } = await chrome.storage.sync.get('temporaryUnblocks');
  if (!temporaryUnblocks) return;
  
  const now = Date.now();
  const activeUnblocks = {};
  let cleaned = false;
  
  for (const [site, data] of Object.entries(temporaryUnblocks)) {
    if (data.expiresAt > now) {
      activeUnblocks[site] = data;
    } else {
      cleaned = true;
      // Clear alarm if it exists
      chrome.alarms.clear(`reblock_${site}`);
    }
  }
  
  if (cleaned) {
    await chrome.storage.sync.set({ temporaryUnblocks: activeUnblocks });
    logger.log('Cleaned up expired temporary unblocks');
  }
}

// Initialize storage with default sites and enabled state
chrome.runtime.onInstalled.addListener(async () => {
  logger.log('Extension installed/updated');
  
  // Clean up expired unblocks first
  await cleanupExpiredUnblocks();
  
  const { blockedSites, isEnabled } = await chrome.storage.sync.get(['blockedSites', 'isEnabled']);
  logger.log('Initial storage state:', { blockedSites, isEnabled });
  
  if (!blockedSites) {
    await chrome.storage.sync.set({ blockedSites: DEFAULT_BLOCKED_SITES });
    logger.log('Set default blocked sites');
  }
  
  // Default to enabled if not set
  if (isEnabled === undefined) {
    await chrome.storage.sync.set({ isEnabled: true });
    logger.log('Set default isEnabled to true');
  }
  
  // Update blocking rules
  await updateBlockingRules();
});

// Also clean up on startup (when service worker wakes up)
chrome.runtime.onStartup.addListener(async () => {
  logger.log('Extension startup');
  await cleanupExpiredUnblocks();
  await updateBlockingRules();
});

// Listen for storage changes - this is the SINGLE SOURCE OF TRUTH
chrome.storage.onChanged.addListener(async (changes, area) => {
  logger.log('Storage changed:', { area, changes });
  if (area === 'sync' && (changes.blockedSites || changes.isEnabled || changes.temporaryUnblocks)) {
    // Always read the CURRENT state from storage to avoid race conditions
    // The changes object tells us WHAT changed, but we read current state to be safe
    const { blockedSites, isEnabled } = await chrome.storage.sync.get(['blockedSites', 'isEnabled']);
    logger.log('Reading current state from storage:', { blockedSites, isEnabled, isEnabledType: typeof isEnabled, isEnabledStrictFalse: isEnabled === false });
    await updateBlockingRulesWithState(isEnabled, blockedSites);
  }
});

// Handle alarms for re-blocking sites after temporary unblock expires
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name.startsWith('reblock_')) {
    const domain = alarm.name.replace('reblock_', '');
    logger.log('Temporary unblock expired for:', domain);
    
    // Remove from temporary unblocks
    const { temporaryUnblocks } = await chrome.storage.sync.get('temporaryUnblocks');
    const unblocks = temporaryUnblocks || {};
    
    // Remove this domain and any variations (with/without www)
    const domainsToRemove = [domain];
    for (const [storedDomain] of Object.entries(unblocks)) {
      if (extractDomain(storedDomain) === domain || extractDomain(domain) === storedDomain) {
        domainsToRemove.push(storedDomain);
      }
    }
    
    domainsToRemove.forEach(d => delete unblocks[d]);
    await chrome.storage.sync.set({ temporaryUnblocks: unblocks });
    logger.log('Removed expired temporary unblock for:', domain);
    
    // Update rules to re-block the site
    await updateBlockingRules();
  }
});

// Update declarative net request rules
async function updateBlockingRules() {
  logger.log('updateBlockingRules called');
  const { blockedSites, isEnabled } = await chrome.storage.sync.get(['blockedSites', 'isEnabled']);
  logger.log('Storage values:', { blockedSites, isEnabled, isEnabledType: typeof isEnabled });
  await updateBlockingRulesWithState(isEnabled, blockedSites);
}

// Helper function to extract and normalize domain from URL
function extractDomain(url) {
  try {
    if (!url) return '';
    // Remove protocol
    let domain = url.replace(/^(https?:\/\/)?/, '');
    // Remove path and query
    domain = domain.split('/')[0];
    // Remove port
    domain = domain.split(':')[0];
    // Remove www. prefix for consistency
    domain = domain.replace(/^www\./, '');
    return domain.toLowerCase().trim();
  } catch (e) {
    return url ? url.toLowerCase().trim() : '';
  }
}

// Check if a domain is temporarily unblocked (handles www variants)
function isTemporarilyUnblocked(domain, unblocks) {
  if (!domain || !unblocks || Object.keys(unblocks).length === 0) {
    logger.log(`isTemporarilyUnblocked("${domain}"): returning false (empty check)`);
    return false;
  }
  
  const normalized = extractDomain(domain);
  if (!normalized) {
    logger.log(`isTemporarilyUnblocked("${domain}"): returning false (could not normalize)`);
    return false;
  }
  
  const now = Date.now();
  logger.log(`isTemporarilyUnblocked: checking "${domain}" (normalized: "${normalized}") against ${Object.keys(unblocks).length} unblocks`);
  
  // Check each stored unblock
  for (const [storedDomain, data] of Object.entries(unblocks)) {
    if (!data || !data.expiresAt) {
      logger.log(`  Skipping "${storedDomain}" - invalid data`);
      continue;
    }
    
    const storedNormalized = extractDomain(storedDomain);
    const isMatch = storedNormalized === normalized;
    const isExpired = data.expiresAt <= now;
    
    logger.log(`  Comparing: stored="${storedDomain}" (normalized: "${storedNormalized}") vs check="${domain}" (normalized: "${normalized}")`);
    logger.log(`    Match: ${isMatch}, Expired: ${isExpired}, ExpiresAt: ${new Date(data.expiresAt)}`);
    
    if (isMatch && !isExpired) {
      logger.log(`  ✓ MATCH FOUND: "${domain}" is temporarily unblocked!`);
      return true;
    }
  }
  
  logger.log(`  ✗ NO MATCH: "${domain}" is NOT temporarily unblocked`);
  return false;
}

// Update blocking rules with explicit state
async function updateBlockingRulesWithState(isEnabled, blockedSites) {
  // Prevent concurrent updates
  if (isUpdatingRules) {
    logger.warn('updateBlockingRulesWithState already in progress, skipping');
    return;
  }
  
  isUpdatingRules = true;
  logger.log('updateBlockingRulesWithState called with:', { 
    isEnabled, 
    isEnabledType: typeof isEnabled, 
    isEnabledStrictFalse: isEnabled === false,
    isEnabledLooseFalse: isEnabled == false,
    blockedSites 
  });
  
  try {
  
  // Get temporary unblocks and filter out expired ones
  const { temporaryUnblocks } = await chrome.storage.sync.get('temporaryUnblocks');
  const unblocks = temporaryUnblocks || {};
  const now = Date.now();
  const activeUnblocks = {};
  
  logger.log('Raw temporary unblocks from storage:', unblocks);
  
  for (const [site, data] of Object.entries(unblocks)) {
    if (!data) continue;
    const expiresAt = data.expiresAt || 0;
    const isExpired = expiresAt <= now;
    logger.log(`Checking unblock for "${site}": expiresAt=${new Date(expiresAt)}, now=${new Date(now)}, expired=${isExpired}`);
    
    if (!isExpired) {
      activeUnblocks[site] = data;
    }
  }
  
  // Update storage if any expired
  if (Object.keys(activeUnblocks).length !== Object.keys(unblocks).length) {
    await chrome.storage.sync.set({ temporaryUnblocks: activeUnblocks });
    logger.log('Cleaned up expired unblocks');
  }
  
  logger.log('Active temporary unblocks (after filtering expired):', activeUnblocks);
  logger.log('Active temporary unblock domains:', Object.keys(activeUnblocks));
  
  const sites = blockedSites || [];
  
  logger.log('=== FILTERING SITES ===');
  logger.log('All blocked sites:', sites);
  logger.log('Active temporary unblocks:', Object.keys(activeUnblocks));
  logger.log('Temporary unblocks detail:', activeUnblocks);
  
  // Filter out temporarily unblocked sites
  const sitesToBlock = sites.filter(site => {
    const isUnblocked = isTemporarilyUnblocked(site, activeUnblocks);
    if (isUnblocked) {
      logger.log(`✓ EXCLUDING "${site}" from blocking (temporarily unblocked)`);
    } else {
      logger.log(`✗ BLOCKING "${site}" (not temporarily unblocked)`);
    }
    return !isUnblocked;
  });
  
  logger.log('=== FILTERING COMPLETE ===');
  logger.log('Sites to block (after filtering):', sitesToBlock);
  logger.log(`Filtered out ${sites.length - sitesToBlock.length} temporarily unblocked sites`);
  
  // ALWAYS remove all existing rules first
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const ruleIdsToRemove = existingRules.map(rule => rule.id);
  logger.log('Existing rules to remove:', ruleIdsToRemove.length, ruleIdsToRemove);
  
  if (ruleIdsToRemove.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: ruleIdsToRemove
    });
    logger.log('Removed all existing rules');
    
    // Verify rules were actually removed
    const rulesAfterRemoval = await chrome.declarativeNetRequest.getDynamicRules();
    logger.log('Rules after removal:', rulesAfterRemoval.length, rulesAfterRemoval);
  } else {
    logger.log('No existing rules to remove');
  }
  
  // If blocking is explicitly disabled, stop here (don't add any rules)
  logger.log('Checking isEnabled:', { 
    isEnabled, 
    'isEnabled === false': isEnabled === false,
    'isEnabled !== false': isEnabled !== false,
    'isEnabled == false': isEnabled == false
  });
  
  if (isEnabled === false) {
    logger.log('BLOCKING IS DISABLED - Not adding any rules. Returning early.');
    return;
  }
  
  logger.log('BLOCKING IS ENABLED - Adding rules for sites:', sitesToBlock);
  
  // Default to enabled if undefined/null
  // Create rules for blocked sites (excluding temporarily unblocked)
  // We need THREE patterns per site:
  // 1. *://site.com/* (root domain)
  // 2. *://*.site.com/* (any subdomain)
  // 3. *://www.site.com/* (www subdomain specifically)
  
  const allRules = [];
  let ruleId = 1;
  
  sitesToBlock.forEach((site) => {
    // Rule for root domain: *://youtube.com/*
    allRules.push({
      id: ruleId++,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: {
          url: chrome.runtime.getURL(`blocked.html?site=${encodeURIComponent(site)}`)
        }
      },
      condition: {
        urlFilter: `*://${site}/*`,
        resourceTypes: ['main_frame']
      }
    });
    
    // Rule for any subdomain: *://*.youtube.com/*
    allRules.push({
      id: ruleId++,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: {
          url: chrome.runtime.getURL(`blocked.html?site=${encodeURIComponent(site)}`)
        }
      },
      condition: {
        urlFilter: `*://*.${site}/*`,
        resourceTypes: ['main_frame']
      }
    });
    
    // Rule for www subdomain: *://www.youtube.com/*
    allRules.push({
      id: ruleId++,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: {
          url: chrome.runtime.getURL(`blocked.html?site=${encodeURIComponent(site)}`)
        }
      },
      condition: {
        urlFilter: `*://www.${site}/*`,
        resourceTypes: ['main_frame']
      }
    });
  });
  logger.log('Created rules:', allRules.length, 'rules');
  
  if (allRules.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: allRules
    });
    logger.log('Successfully added', allRules.length, 'rules');
    
    // Verify rules were added
    const finalRules = await chrome.declarativeNetRequest.getDynamicRules();
    logger.log('Final rules count:', finalRules.length);
  } else {
    logger.log('No rules to add');
  }
  } finally {
    isUpdatingRules = false;
    logger.log('updateBlockingRulesWithState completed');
  }
}

// Handle messages from popup and blocked page
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  logger.log('Message received:', request);
  
  if (request.action === 'updateRules') {
    logger.log('updateRules message received, calling updateBlockingRules');
    // Trigger update by reading from storage (storage listener will also fire, but that's ok)
    updateBlockingRules().then(() => {
      logger.log('updateBlockingRules completed');
      sendResponse({ success: true });
    });
    return true; // Keep the message channel open for async response
  }
  
  if (request.action === 'temporaryUnblock') {
    handleTemporaryUnblock(request).then((result) => {
      sendResponse(result);
    });
    return true; // Keep the message channel open for async response
  }
});

// Handle temporary unblock request
async function handleTemporaryUnblock(request) {
  const { site, reason, durationMinutes } = request;
  logger.log('Temporary unblock request:', { site, reason, durationMinutes });
  
  if (!site || !reason || !durationMinutes) {
    logger.error('Invalid temporary unblock request');
    return { success: false, error: 'Invalid request' };
  }
  
  // Extract and normalize domain from site
  const domain = extractDomain(site);
  logger.log('Extracted domain:', domain, 'from site:', site);
  
  if (!domain) {
    logger.error('Could not extract domain from site:', site);
    return { success: false, error: 'Invalid site' };
  }
  
  // Calculate expiration time
  const expiresAt = Date.now() + (durationMinutes * 60 * 1000);
  
  // Get existing temporary unblocks
  const { temporaryUnblocks } = await chrome.storage.sync.get('temporaryUnblocks');
  const unblocks = temporaryUnblocks || {};
  
  // Remove any existing unblock for this domain (in case of re-unblocking)
  const existingAlarmName = `reblock_${domain}`;
  chrome.alarms.clear(existingAlarmName);
  
  // Add or update the temporary unblock (use normalized domain as key)
  unblocks[domain] = {
    site: domain,
    originalSite: site,
    reason: reason,
    unblockedAt: Date.now(),
    expiresAt: expiresAt,
    durationMinutes: durationMinutes
  };
  
  // Store the temporary unblock - this will trigger the storage change listener
  await chrome.storage.sync.set({ temporaryUnblocks: unblocks });
  logger.log('Temporary unblock stored:', unblocks[domain]);
  logger.log('All temporary unblocks:', Object.keys(unblocks));
  
  // Set alarm to re-block after duration
  const alarmName = `reblock_${domain}`;
  chrome.alarms.create(alarmName, {
    when: expiresAt
  });
  logger.log('Alarm set for:', alarmName, 'at', new Date(expiresAt));
  
  // The storage change listener will automatically fire and update rules
  // Wait a moment for it to process, then verify
  logger.log('Waiting for storage change listener to update rules...');
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Manually trigger rule update to ensure it happens immediately
  // (storage listener might have race condition, so we do both)
  logger.log('Manually updating rules to ensure immediate effect...');
  await updateBlockingRules();
  
  // Verify rules were updated correctly
  const currentRules = await chrome.declarativeNetRequest.getDynamicRules();
  logger.log('Current rules after unblock:', currentRules.length);
  
  // Check if the site is still in any rules
  const siteInRules = currentRules.some(rule => {
    const urlFilter = rule.condition?.urlFilter || '';
    const normalizedFilter = extractDomain(urlFilter.replace(/\*/g, '').replace(/^.*:\/\//, '').replace(/\/.*$/, ''));
    const normalizedDomain = extractDomain(domain);
    return normalizedFilter === normalizedDomain || urlFilter.includes(normalizedDomain);
  });
  
  logger.log(`Site "${domain}" is in rules:`, siteInRules);
  if (siteInRules) {
    logger.error('ERROR: Site is still in blocking rules after temporary unblock!');
    logger.log('All current rules:', currentRules.map(r => ({
      id: r.id,
      urlFilter: r.condition?.urlFilter
    })));
  } else {
    logger.log('SUCCESS: Site is NOT in blocking rules - temporary unblock worked!');
  }
  
  return { success: true };
}
