// Import logger (inline for popup)
const logger = {
  log: (...args) => console.log('[ChromeLock Popup]', ...args),
  error: (...args) => console.error('[ChromeLock Popup ERROR]', ...args),
  warn: (...args) => console.warn('[ChromeLock Popup WARN]', ...args)
};

// Load and display blocked sites
async function loadBlockedSites() {
  const { blockedSites } = await chrome.storage.sync.get('blockedSites');
  const sites = blockedSites || [];
  
  const blockedList = document.getElementById('blockedList');
  const emptyMessage = document.getElementById('emptyMessage');
  
  blockedList.innerHTML = '';
  
  if (sites.length === 0) {
    emptyMessage.style.display = 'block';
    return;
  }
  
  emptyMessage.style.display = 'none';
  
  sites.forEach(site => {
    const siteItem = document.createElement('div');
    siteItem.className = 'site-item';
    
    const siteName = document.createElement('span');
    siteName.className = 'site-name';
    siteName.textContent = site;
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn btn-remove';
    removeBtn.textContent = '×';
    removeBtn.title = 'Remove site';
    removeBtn.addEventListener('click', () => removeSite(site));
    
    siteItem.appendChild(siteName);
    siteItem.appendChild(removeBtn);
    blockedList.appendChild(siteItem);
  });
}

// Add a new site to block
async function addSite() {
  const input = document.getElementById('siteInput');
  let site = input.value.trim().toLowerCase();
  
  if (!site) return;
  
  // Clean up the input - remove protocol and www
  site = site.replace(/^(https?:\/\/)?(www\.)?/, '');
  // Remove trailing slash
  site = site.replace(/\/$/, '');
  // Extract just the domain
  site = site.split('/')[0];
  
  if (!site) {
    alert('Please enter a valid website');
    return;
  }
  
  const { blockedSites } = await chrome.storage.sync.get('blockedSites');
  const sites = blockedSites || [];
  
  if (sites.includes(site)) {
    alert('This site is already blocked');
    input.value = '';
    return;
  }
  
  sites.push(site);
  await chrome.storage.sync.set({ blockedSites: sites });
  
  // Notify background script to update rules
  chrome.runtime.sendMessage({ action: 'updateRules' });
  
  input.value = '';
  loadBlockedSites();
}

// Remove a site from the blocked list
async function removeSite(siteToRemove) {
  const { blockedSites } = await chrome.storage.sync.get('blockedSites');
  const sites = blockedSites || [];
  
  const updatedSites = sites.filter(site => site !== siteToRemove);
  await chrome.storage.sync.set({ blockedSites: updatedSites });
  
  // Notify background script to update rules
  chrome.runtime.sendMessage({ action: 'updateRules' });
  
  loadBlockedSites();
}

// NEW: Load and set toggle state
async function loadToggleState() {
  const { isEnabled } = await chrome.storage.sync.get('isEnabled');
  logger.log('loadToggleState - storage isEnabled:', isEnabled, 'type:', typeof isEnabled);
  const toggle = document.getElementById('toggleEnabled');
  const statusText = document.getElementById('statusText');
  
  // Default to true if not set
  const enabled = isEnabled !== false;
  logger.log('loadToggleState - computed enabled:', enabled);
  
  toggle.checked = enabled;
  statusText.textContent = enabled ? 'Enabled' : 'Disabled';
  statusText.className = enabled ? 'status-text enabled' : 'status-text disabled';
}

// NEW: Toggle blocking on/off
async function toggleBlocking() {
  const toggle = document.getElementById('toggleEnabled');
  const statusText = document.getElementById('statusText');
  const isEnabled = toggle.checked;
  
  logger.log('toggleBlocking - toggle.checked:', toggle.checked, 'isEnabled:', isEnabled, 'type:', typeof isEnabled);
  
  // Update storage - the storage change listener will automatically update rules
  await chrome.storage.sync.set({ isEnabled });
  logger.log('toggleBlocking - Set storage isEnabled to:', isEnabled);
  
  // Verify it was set correctly
  const verify = await chrome.storage.sync.get('isEnabled');
  logger.log('toggleBlocking - Verified storage isEnabled:', verify.isEnabled, 'type:', typeof verify.isEnabled, 'strict false:', verify.isEnabled === false);
  
  statusText.textContent = isEnabled ? 'Enabled' : 'Disabled';
  statusText.className = isEnabled ? 'status-text enabled' : 'status-text disabled';
  
  // Also send message for immediate update (redundant but ensures responsiveness)
  logger.log('toggleBlocking - Sending updateRules message');
  chrome.runtime.sendMessage({ action: 'updateRules' }, (response) => {
    logger.log('toggleBlocking - Received response:', response);
  });
}

// Event listeners
document.getElementById('addBtn').addEventListener('click', addSite);
document.getElementById('siteInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    addSite();
  }
});

// NEW: Toggle event listener
document.getElementById('toggleEnabled').addEventListener('change', toggleBlocking);

// Load sites and toggle state on popup open
loadBlockedSites();
loadToggleState();

