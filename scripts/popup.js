const CLIENT_ID = 'Ov23li44ueEaLhRt3Zzj';

chrome.storage.local.get(['cf_handle', 'github_token', 'github_repo'], function(data) {
  if (data.cf_handle) {
    document.getElementById('cf-handle').value = data.cf_handle;
  }
  if (data.github_repo) {
    document.getElementById('gh-repo').value = data.github_repo;
    document.getElementById('linked-repo').innerText = data.github_repo;
  }
  
  if (data.github_token) {
    document.getElementById('btn-auth-github').innerText = '✅ GitHub Authenticated';
    document.getElementById('btn-auth-github').disabled = true;
  }

  if (data.cf_handle && data.github_token && data.github_repo) {
    document.getElementById('cf-status').innerText = 'Ready to sync!';
  }
});

document.getElementById('btn-auth-github').addEventListener('click', async () => {
  const authStatus = document.getElementById('auth-status');
  authStatus.innerText = 'Requesting authorization code...';
  
  try {
    const response = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        scope: 'repo' 
      })
    });
    
    const data = await response.json();
    
    if (data.user_code) {
      authStatus.innerHTML = `Please copy this code: <b>${data.user_code}</b><br>and enter it at <a href="${data.verification_uri}" target="_blank">${data.verification_uri}</a>`;
      chrome.tabs.create({ url: data.verification_uri });
      
      pollForToken(data.device_code, data.interval);
    } else {
      authStatus.innerText = 'Failed to get authorization code. Check Client ID.';
    }
  } catch (error) {
    authStatus.innerText = 'Error connecting to GitHub.';
    console.error(error);
  }
});

function pollForToken(deviceCode, intervalSeconds) {
  const authStatus = document.getElementById('auth-status');
  const pollInterval = setInterval(async () => {
    try {
      const resp = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        })
      });
      
      const tokenData = await resp.json();
      
      if (tokenData.access_token) {
        clearInterval(pollInterval);
        chrome.storage.local.set({ github_token: tokenData.access_token });
        authStatus.innerText = 'Successfully authenticated with GitHub!';
        document.getElementById('btn-auth-github').innerText = '✅ GitHub Authenticated';
        document.getElementById('btn-auth-github').disabled = true;
      } else if (tokenData.error !== 'authorization_pending') {
        clearInterval(pollInterval);
        authStatus.innerText = 'Authorization failed or expired. Please try again.';
      }
    } catch (err) {
      clearInterval(pollInterval);
      authStatus.innerText = 'Network error while polling for token.';
    }
  }, intervalSeconds * 1000);
}
document.getElementById('save-cf-handle').addEventListener('click', async () => {
  const handle = document.getElementById('cf-handle').value.trim();
  const repo = document.getElementById('gh-repo').value.trim();
  
  chrome.storage.local.get(['github_token'], async (storageData) => {
    if (!handle || !repo) {
      document.getElementById('cf-status').innerText = 'Please fill all fields.';
      return;
    }
    
    if (!storageData.github_token) {
      document.getElementById('cf-status').innerText = 'Please authenticate with GitHub first.';
      return;
    }
    
    try {
      const statusObj = document.getElementById('cf-status');
      statusObj.innerText = 'Verifying...';
      const res = await fetch(`https://codeforces.com/api/user.info?handles=${handle}`);
      const json = await res.json();
      if (json.status === 'OK') {
        chrome.storage.local.set({ 
          cf_handle: handle,
          github_repo: repo
        });
        document.getElementById('linked-repo').innerText = repo;
        statusObj.innerText = 'Verified! Submissions are now tracked completely.';
      } else {
        statusObj.innerText = 'Invalid handle.';
      }
    } catch (err) {
      console.error(err);
      document.getElementById('cf-status').innerText = 'Error connecting to Codeforces.';
    }
  });
});
