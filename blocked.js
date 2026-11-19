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
  
  const durationMinutes = duration;
  
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

// rotating focus quotes
const quotes = [
  { text: 'The successful warrior is the average person, with laser-like focus.', author: 'Bruce Lee' },
  { text: 'Concentrate all your thoughts upon the work at hand. The sun\'s rays do not burn until brought to a focus.', author: 'Alexander Graham Bell' },
  { text: 'It is not that we have a short time to live, but that we waste a lot of it.', author: 'Seneca' },
  { text: 'The ability to concentrate is the ability to say no to a thousand other good ideas.', author: 'Steve Jobs' },
  { text: 'You will never reach your destination if you stop and throw stones at every dog that barks.', author: 'Winston Churchill' },
  { text: 'Where your attention goes, your life goes.', author: 'Anonymous' },
  { text: 'Lost time is never found again.', author: 'Benjamin Franklin' },
  { text: 'Focus on being productive instead of busy.', author: 'Tim Ferriss' },
  { text: 'What we pay attention to determines what we become.', author: 'Cal Newport' },
  { text: 'Do not dwell in the past, do not dream of the future, concentrate the mind on the present moment.', author: 'Buddha' }
];

const quoteEl = document.getElementById('quote');
const quoteText = document.getElementById('quoteText');
const quoteAuthor = document.getElementById('quoteAuthor');
let quoteIndex = Math.floor(Math.random() * quotes.length);

function showQuote() {
  quoteText.textContent = `"${quotes[quoteIndex].text}"`;
  quoteAuthor.textContent = quotes[quoteIndex].author;
}

showQuote();

// fade out, swap, fade in every 12 seconds
setInterval(() => {
  quoteEl.classList.add('fade');
  setTimeout(() => {
    quoteIndex = (quoteIndex + 1) % quotes.length;
    showQuote();
    quoteEl.classList.remove('fade');
  }, 500);
}, 12000);
