// Get the blocked site from URL parameter
const urlParams = new URLSearchParams(window.location.search);
let blockedSite = urlParams.get('site') || 'this site';

// Store original blocked site for form submission
const originalBlockedSite = blockedSite;

if (blockedSite !== 'this site') {
  document.getElementById('blockedSiteText').textContent = 
    `${blockedSite} has been blocked by ChromeLock to help you stay focused and productive.`;
}

document.getElementById('unblockForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const reason = document.getElementById('reason').value.trim();
  const duration = parseInt(document.getElementById('duration').value);
  const timeUnit = document.getElementById('timeUnit').value;
  
  // Validation
  let isValid = true;
  
  if (!reason) {
    document.getElementById('reasonError').classList.add('show');
    isValid = false;
  } else {
    document.getElementById('reasonError').classList.remove('show');
  }
  
  if (!duration || duration < 1) {
    document.getElementById('durationError').classList.add('show');
    isValid = false;
  } else {
    document.getElementById('durationError').classList.remove('show');
  }
  
  if (!isValid) return;
  
  // Calculate duration in minutes
  const durationMinutes = timeUnit === 'hours' ? duration * 60 : duration;
  
    // Send message to background script
  try {
    console.log('Sending temporary unblock request:', {
      site: originalBlockedSite,
      reason: reason,
      durationMinutes: durationMinutes
    });
    
    const response = await chrome.runtime.sendMessage({
      action: 'temporaryUnblock',
      site: originalBlockedSite,
      reason: reason,
      durationMinutes: durationMinutes
    });
    
    console.log('Received response:', response);
    
    if (response && response.success) {
      // Wait for rules to update, then redirect
      // Use window.location.replace to avoid adding to history
      let redirectUrl = originalBlockedSite;
      if (!redirectUrl.startsWith('http://') && !redirectUrl.startsWith('https://')) {
        redirectUrl = `https://${redirectUrl}`;
      }
      
      console.log('=== TEMPORARY UNBLOCK SUCCESS ===');
      console.log('Original site:', originalBlockedSite);
      console.log('Redirect URL:', redirectUrl);
      console.log('Waiting 1.5 seconds for rules to update...');
      
      // Give Chrome more time to process the rule updates
      setTimeout(() => {
        console.log('Redirecting now to:', redirectUrl);
        console.log('If you still see blocked page, check background script logs');
        window.location.replace(redirectUrl);
      }, 1500);
    } else {
      const errorMsg = response?.error || 'Failed to unblock site. Please try again.';
      console.error('Unblock failed:', errorMsg);
      alert(errorMsg);
    }
  } catch (error) {
    console.error('Error unblocking site:', error);
    alert('An error occurred. Please try again. Check the console for details.');
  }
});

// go back button (inline onclick is blocked by the mv3 csp)
document.getElementById('goBackBtn').addEventListener('click', () => window.history.back());
