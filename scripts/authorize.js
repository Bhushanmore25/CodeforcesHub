
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');

if (code && window.location.hostname === 'github.com') {
  chrome.runtime.sendMessage({ 
    type: 'AUTH_SUCCESS', 
    token: 'DUMMY_TOKEN_PLEASE_REPLACE' 
  }, (response) => {
    if (response && response.success) {
      alert("CodeforcesHub: Authenticated successfully! You can close this tab and open the extension popup.");
    }
  });
}
