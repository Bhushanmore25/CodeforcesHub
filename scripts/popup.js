const CLIENT_ID = 'Ov23li44ueEaLhRt3Zzj';

chrome.storage.local.get(['cf_handle', 'github_token', 'github_repo', 'pending_device_code', 'pending_interval'], function(data) {
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
    document.getElementById('auth-status').innerText = 'Ready!';
  } else if (data.pending_device_code) {
    document.getElementById('auth-status').innerText = 'Resuming authorization check...';
    // Resume polling in case background worker slept when popup closed
    chrome.runtime.sendMessage({
      type: 'START_POLLING',
      deviceCode: data.pending_device_code,
      interval: data.pending_interval || 5
    });
  }

  if (data.cf_handle && data.github_token && data.github_repo) {
    document.getElementById('cf-status').innerText = 'Ready to sync!';
  }
});

// Always update UI instantly if background script succeeds while popup is open
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.github_token) {
    document.getElementById('btn-auth-github').innerText = '✅ GitHub Authenticated';
    document.getElementById('btn-auth-github').disabled = true;
    document.getElementById('auth-status').innerText = 'Successfully authenticated with GitHub!';
    
    // Check if everything else is ready
    chrome.storage.local.get(['cf_handle', 'github_repo'], (data) => {
      if (data.cf_handle && data.github_repo) {
        document.getElementById('cf-status').innerText = 'Ready to sync!';
      }
    });
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
      // Save pending state so we survive popup closing
      chrome.storage.local.set({ 
        pending_device_code: data.device_code,
        pending_interval: data.interval
      });

      try {
        await navigator.clipboard.writeText(data.user_code);
        authStatus.innerHTML = `Copied code: <b style="font-size: 16px;">${data.user_code}</b><br><br><a href="${data.verification_uri}" target="_blank" style="color: #0366d6; text-decoration: underline;">Click here to Authorize on GitHub</a>`;
      } catch (e) {
        authStatus.innerHTML = `Please copy this code: <b style="font-size: 16px;">${data.user_code}</b><br><br><a href="${data.verification_uri}" target="_blank" style="color: #0366d6; text-decoration: underline;">Click here to Authorize on GitHub</a>`;
      }
      
      chrome.runtime.sendMessage({
        type: 'START_POLLING',
        deviceCode: data.device_code,
        interval: data.interval
      });
    } else {
      authStatus.innerText = 'Failed to get authorization code. Check Client ID.';
    }
  } catch (error) {
    authStatus.innerText = 'Error connecting to GitHub.';
    console.error(error);
  }
});
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
