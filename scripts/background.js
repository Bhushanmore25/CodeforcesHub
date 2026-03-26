let active_polls = {};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'AUTH_SUCCESS') {
    chrome.storage.local.set({ github_token: request.token }, () => {
      sendResponse({ success: true });
    });
    return true; 
  }

  if (request.type === 'START_POLLING') {
    if (!active_polls[request.deviceCode]) {
      pollForToken(request.deviceCode, request.interval);
    }
    sendResponse({ success: true });
    return true;
  }

  if (request.type === 'UPLOAD_TO_GITHUB') {
    handleUpload(request.payload).then(() => {
      sendResponse({ success: true });
    }).catch(err => {
      console.error("Upload failed", err);
      sendResponse({ success: false, error: err.toString() });
    });
    return true;
  }
});

async function handleUpload(payload) {
  const { code, problemInfo, repo, token, username } = payload;
  
  const rating = problemInfo.rating || 'Unrated';
  const folderName = `${rating}_${problemInfo.contestName}_${problemInfo.contestId}_${problemInfo.index}`;
  
  const readmeContent = btoa(unescape(encodeURIComponent(problemInfo.text)));
  await uploadFile(token, repo, `${folderName}/README.md`, readmeContent, "Add Problem Description");
  
  const codeContent = btoa(unescape(encodeURIComponent(code)));
  const extension = getExtension(problemInfo.programmingLanguage);
  await uploadFile(token, repo, `${folderName}/Solution${extension}`, codeContent, `Add ${problemInfo.programmingLanguage} solution`);
  
  await updateRootReadme(token, repo, rating, folderName, problemInfo);
}

function getExtension(language) {
  if (language.includes('C++')) return '.cpp';
  if (language.includes('Py')) return '.py';
  if (language.includes('Java')) return '.java';
  return '.txt'; 
}

async function uploadFile(token, repo, filepath, contentB64, message, sha = undefined) {

  const body = { message, content: contentB64 };
  if (sha) body.sha = sha;

  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${filepath}`, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} trying to upload ${filepath}`);
  return res.json();
}

async function updateRootReadme(token, repo, rating, folderName, problemInfo) {
  const filepath = 'README.md';
  let sha = undefined;
  let decodedContent = '';


  try {
    const getRes = await fetch(`https://api.github.com/repos/${repo}/contents/${filepath}`, {
      headers: { Authorization: `token ${token}` }
    });
    if (getRes.ok) {
      const data = await getRes.json();
      sha = data.sha;
      decodedContent = decodeURIComponent(escape(atob(data.content)));
    }
  } catch (err) {}

  
  if (!decodedContent || decodedContent.trim() === '') {
    decodedContent = `# 🏆 Codeforces Solutions Repository
This repository contains my accepted Codeforces solutions, automatically processed and synced by **CodeforcesHub**.

---
`;
  }

  
  const problemLink = `https://codeforces.com/contest/${problemInfo.contestId}/problem/${problemInfo.index}`;
  const displayId = `${problemInfo.contestId}${problemInfo.index}`;


  const ratingSectionHeader = `## 🟢 Rating: ${rating}`;
  const tableHeader = `| Problem | Contest | Code | Language |\n| :--- | :--- | :---: | :---: |\n`;
  const cleanContestName = problemInfo.contestName.replace(/_/g, ' '); 
  const newRow = `| [${displayId}](${problemLink}) | ${cleanContestName} | [View Solution](./${folderName}) | ${problemInfo.programmingLanguage || 'C++'} |\n`;

  if (!decodedContent.includes(ratingSectionHeader)) {

    decodedContent += `\n${ratingSectionHeader}\n${tableHeader}${newRow}`;
  } else {

    const targetIdx = decodedContent.indexOf(tableHeader, decodedContent.indexOf(ratingSectionHeader));
    
    if (targetIdx !== -1) {
      const insertionPoint = targetIdx + tableHeader.length;
      decodedContent = decodedContent.slice(0, insertionPoint) + newRow + decodedContent.slice(insertionPoint);
    } else {
      
      decodedContent += newRow;
    }
  }

  const contentB64 = btoa(unescape(encodeURIComponent(decodedContent)));
  await uploadFile(token, repo, filepath, contentB64, `Update Root README with ${displayId}`, sha);
}

function pollForToken(deviceCode, intervalSeconds) {
  const CLIENT_ID = 'Ov23li44ueEaLhRt3Zzj';
  if (active_polls[deviceCode]) clearInterval(active_polls[deviceCode]);

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
        delete active_polls[deviceCode];
        chrome.storage.local.set({ github_token: tokenData.access_token }, () => {
          chrome.storage.local.remove(['pending_device_code', 'pending_interval']);
          console.log("GitHub token authenticated and saved!");
        });
      } else if (tokenData.error === 'slow_down') {
        console.warn("Polling too fast, waiting...", tokenData);
      } else if (tokenData.error !== 'authorization_pending') {
        clearInterval(pollInterval);
        delete active_polls[deviceCode];
        chrome.storage.local.remove(['pending_device_code', 'pending_interval']);
        console.error("Authorization failed or expired:", tokenData.error, tokenData.error_description || tokenData);
      }
    } catch (err) {
      clearInterval(pollInterval);
      delete active_polls[deviceCode];
      console.error('Network error while polling for token.', err);
    }
  }, intervalSeconds * 1000);
  
  active_polls[deviceCode] = pollInterval;
}
