
document.addEventListener('submit', async (e) => {
  const actionAttr = e.target.getAttribute ? e.target.getAttribute('action') : null;
  const isSubmitForm = e.target.id === 'editorForm' || 
                       (actionAttr && actionAttr.includes('submit')) ||
                       (e.target.className && typeof e.target.className === 'string' && e.target.className.includes('submit-form'));

  if (isSubmitForm) {
    e.preventDefault();

    let fileInput = document.querySelector('input[name="sourceFile"]');
    let codeInput = document.getElementById('sourceCodeTextarea');
    let languageSelect = document.querySelector('select[name="programTypeId"]');
    
    let code = codeInput ? codeInput.value : '';
    let language = languageSelect ? languageSelect.options[languageSelect.selectedIndex].text : 'C++';
    
    if (!code && fileInput && fileInput.files && fileInput.files.length > 0) {
      try {
        code = await fileInput.files[0].text();
      } catch (err) { }
    }
    
    const urlSegments = window.location.pathname.split('/');
    let contestId = '';
    let index = '';
    
    if (urlSegments.includes('contest') && urlSegments.includes('problem')) {
      contestId = urlSegments[urlSegments.indexOf('contest') + 1];
      index = urlSegments[urlSegments.indexOf('problem') + 1];
    } else if (urlSegments.includes('problemset') && urlSegments.includes('problem')) {
      contestId = urlSegments[urlSegments.indexOf('problem') + 1];
      index = urlSegments[urlSegments.indexOf('problem') + 2];
    } 
    else {
      let submittedProblemIndex = document.querySelector('input[name="submittedProblemIndex"]');
      if (submittedProblemIndex && submittedProblemIndex.value) {
        let match = submittedProblemIndex.value.trim().match(/^(\d+)([A-Z]\d*)$/i);
        if (match) {
          contestId = match[1];
          index = match[2];
        }
      }
    }

    if (contestId && index && code) {
      chrome.storage.local.set({
        pending_submission: {
          code,
          language,
          contestId,
          index,
          timestamp: Math.floor(Date.now() / 1000)
        }
      }, () => {
        e.target.submit();
      });
    } else {
      e.target.submit();
    }
  }
});
chrome.storage.local.get(['pending_submission', 'cf_handle', 'github_token', 'github_repo'], function(data) {
  if (!data.github_token || !data.github_repo || !data.cf_handle) return;
  
  if (data.pending_submission) {
    pollCodeforcesStatus({
      cf_handle: data.cf_handle,
      pending_submission: data.pending_submission,
      github_token: data.github_token,
      github_repo: data.github_repo
    });
  }
});

async function pollCodeforcesStatus(data) {
  const { cf_handle, pending_submission, github_token, github_repo } = data;
  let attempts = 0;
  
  const intervalId = setInterval(async () => {
    attempts++;
    if (attempts > 30) {
      clearInterval(intervalId);
      chrome.storage.local.remove(['pending_submission']);
      return;
    }
    
    try {
      const res = await fetch(`https://codeforces.com/api/user.status?handle=${cf_handle}&from=1&count=5`);
      const json = await res.json();
      
      if (json.status === 'OK') {
        const latestMatch = json.result.find(sub => 
          String(sub.problem.contestId) === String(pending_submission.contestId) &&
          String(sub.problem.index) === String(pending_submission.index)
        );
        
        if (latestMatch) {
          if (latestMatch.verdict === 'OK') {
            clearInterval(intervalId);
            
            let contestName = 'Contest';
            let problemName = 'Unknown';
            let tags = [];
            let problemStatementHtml = "Problem statement couldn't be extracted.";
            
            try {
              const contestRes = await fetch(`https://codeforces.com/api/contest.standings?contestId=${pending_submission.contestId}&from=1&count=1`);
              const contestJson = await contestRes.json();
              if (contestJson.status === 'OK') {
                contestName = contestJson.result.contest.name.replace(/[^a-zA-Z0-9]/g, '_');
              }
              const prob = contestJson.result.problems.find(p => String(p.index) === String(pending_submission.index));
              if (prob) {
                tags = prob.tags || [];
                if (prob.name) problemName = prob.name;
              }
              
              const probUrl = `https://codeforces.com/contest/${pending_submission.contestId}/problem/${pending_submission.index}`;
              const pRes = await fetch(probUrl);
              const pText = await pRes.text();
              const pDoc = (new DOMParser()).parseFromString(pText, "text/html");
              const psDiv = pDoc.querySelector('.problem-statement');
              if (psDiv) {
                problemStatementHtml = psDiv.outerHTML;
              }
            } catch (err) { }
            
            const fullReadmeText = `
${problemStatementHtml}

---
**Problem Name:** ${problemName} <br>
**Tags:** ${tags.join(', ')} <br>
**Problem Link:** [Codeforces ${pending_submission.contestId}${pending_submission.index}](https://codeforces.com/contest/${pending_submission.contestId}/problem/${pending_submission.index})
`;

            const problemInfo = {
              rating: latestMatch.problem.rating || 'Unrated',
              contestName: contestName,
              contestId: latestMatch.problem.contestId,
              index: latestMatch.problem.index,
              text: fullReadmeText,
              programmingLanguage: pending_submission.language
            };
            
            chrome.runtime.sendMessage({
              type: 'UPLOAD_TO_GITHUB',
              payload: {
                code: pending_submission.code,
                problemInfo: problemInfo,
                repo: github_repo,
                token: github_token,
                username: cf_handle
              }
            });
            
            chrome.storage.local.remove(['pending_submission']);
            
          } else if (latestMatch.verdict && latestMatch.verdict !== 'TESTING') {
            clearInterval(intervalId);
            chrome.storage.local.remove(['pending_submission']);
          }
        }
      }
    } catch (e) {
      console.error('API Error', e);
    }
  }, 10000); 
}

if (window.location.href.includes('/submission/')) {
  setTimeout(() => {
    const isAccepted = document.body.innerHTML.includes('Accepted') || document.body.innerHTML.includes('verdict-accepted');
    
    const sourceCodePre = document.getElementById('program-source-text');
    if (sourceCodePre) {
      const btn = document.createElement('button');
      btn.innerText = 'Sync to GitHub (LeetHub/CFHub)';
      btn.style.cssText = 'margin-bottom: 10px; padding: 8px 15px; background-color: #238636; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;';
      
      btn.addEventListener('click', async () => {
        btn.innerText = 'Pushing...';
        btn.disabled = true;
        
        try {
          const code = sourceCodePre.innerText;
          
          const problemLink = document.querySelector('a[href*="/problem/"]');
          let contestId = '0';
          let index = 'A';
          let problemName = 'Unknown';
          
          if (problemLink) {
            const parts = problemLink.href.split('/');
            contestId = parts[parts.indexOf('problem') - 1]; 
            if (contestId === 'problemset') {
              contestId = parts[parts.indexOf('problem') + 1];
              index = parts[parts.indexOf('problem') + 2];
            } else {
              index = parts[parts.indexOf('problem') + 1];
            }
            problemName = problemLink.innerText;
          }
          
          let contestName = 'Contest';
          let rating = 'Unrated';
          let tags = [];
          
          try {
            const cRes = await fetch(`https://codeforces.com/api/contest.standings?contestId=${contestId}&from=1&count=1`);
            const cJson = await cRes.json();
            if (cJson.status === 'OK') {
              contestName = cJson.result.contest.name.replace(/[^a-zA-Z0-9]/g, '_');
              
              const prob = cJson.result.problems.find(p => String(p.index) === String(index));
              if (prob) {
                rating = prob.rating || 'Unrated';
                tags = prob.tags || [];
                if (prob.name) problemName = prob.name;
              }
            }
          } catch (e) { console.error(e); }
          
          let problemStatementHtml = "Problem statement couldn't be extracted.";
          try {
             const probUrl = `https://codeforces.com/contest/${contestId}/problem/${index}`;
             const pRes = await fetch(probUrl);
             const pText = await pRes.text();
             const pDoc = (new DOMParser()).parseFromString(pText, "text/html");
             const psDiv = pDoc.querySelector('.problem-statement');
             if (psDiv) problemStatementHtml = psDiv.outerHTML;
          } catch (e) {}
          
          const fullReadmeText = `
${problemStatementHtml}

---
**Problem Name:** ${problemName} <br>
**Tags:** ${tags.join(', ')} <br>
**Problem Link:** [Codeforces ${contestId}${index}](https://codeforces.com/contest/${contestId}/problem/${index})
`;

          const problemInfo = {
            rating: rating,
            contestName: contestName,
            contestId: contestId,
            index: index,
            text: fullReadmeText,
            programmingLanguage: 'C++' 
          };
          
          const tds = document.querySelectorAll('td');
          tds.forEach(td => {
            if (td.innerText.includes('C++') || td.innerText.includes('Java') || td.innerText.includes('Py')) {
              problemInfo.programmingLanguage = td.innerText.trim();
            }
          });
          
          chrome.storage.local.get(['cf_handle', 'github_token', 'github_repo'], function(data) {
             if (!data.github_token || !data.github_repo || !data.cf_handle) {
                btn.innerText = '❌ Configure Extension First';
                return;
             } 
             chrome.runtime.sendMessage({
                type: 'UPLOAD_TO_GITHUB',
                payload: {
                  code: code,
                  problemInfo: problemInfo,
                  repo: data.github_repo,
                  token: data.github_token,
                  username: data.cf_handle
                }
              }, (response) => {
                if (response && response.success) {
                  btn.innerText = '✅ Synced to GitHub!';
                  btn.style.backgroundColor = '#1f6feb';
                } else {
                  btn.innerText = '❌ Failed to Sync';
                  btn.style.backgroundColor = '#da3633';
                  console.error('Sync error:', response);
                }
              });
          });
          
        } catch (err) {
          btn.innerText = '❌ Error';
          console.error(err);
        }
      });
      
      sourceCodePre.parentNode.insertBefore(btn, sourceCodePre);
    }
  }, 1000);
}

if (window.location.href.includes('/status') || window.location.href.includes('/my')) {
  setTimeout(() => {
    const acceptedSpans = document.querySelectorAll('span.verdict-accepted');
    
    acceptedSpans.forEach(span => {
      if (span.parentNode.querySelector('.cfhub-sync-btn')) return;
      
      const syncBtn = document.createElement('button');
      syncBtn.className = 'cfhub-sync-btn';
      syncBtn.innerText = 'Sync';
      syncBtn.style.cssText = 'margin-left: 10px; padding: 2px 6px; background-color: #238636; color: white; border: none; border-radius: 4px; font-size: 11px; cursor: pointer;';
      
      syncBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        syncBtn.innerText = '...';
        syncBtn.disabled = true;
        
        try {
          const row = span.closest('tr');
          
          const submissionLink = row.querySelector('a.view-source') || row.querySelector('a[href*="/submission/"]');
          if (!submissionLink) throw new Error("Could not find submission URL");
          
          const subRes = await fetch(submissionLink.href);
          const subText = await subRes.text();
          
          
          const parser = new DOMParser();
          const doc = parser.parseFromString(subText, "text/html");
          const sourceCodePre = doc.getElementById('program-source-text');
          if (!sourceCodePre) throw new Error("Could not extract code");
          const code = sourceCodePre.innerText;
          
          const problemLink = row.querySelector('a[href*="/problem/"]');
          let contestId = '0';
          let index = 'A';
          let problemName = 'Unknown';
          
          if (problemLink) {
            const parts = problemLink.href.split('/');
            contestId = parts[parts.indexOf('problem') - 1];
            if (contestId === 'problemset') {
              contestId = parts[parts.indexOf('problem') + 1];
              index = parts[parts.indexOf('problem') + 2];
            } else {
              index = parts[parts.indexOf('problem') + 1];
            }
            problemName = problemLink.innerText.split(' - ').slice(1).join(' - ') || problemLink.innerText;
          }
          
          let language = 'C++';
          const tds = row.querySelectorAll('td');
          if (tds.length >= 5) { 
            language = tds[4].innerText.trim();
          }
          
          let contestName = 'Contest';
          let rating = 'Unrated';
          let tags = [];
          
          try {
            const cRes = await fetch(`https://codeforces.com/api/contest.standings?contestId=${contestId}&from=1&count=1`);
            const cJson = await cRes.json();
            if (cJson.status === 'OK') {
              contestName = cJson.result.contest.name.replace(/[^a-zA-Z0-9]/g, '_');
              const prob = cJson.result.problems.find(p => String(p.index) === String(index));
              if (prob) {
                rating = prob.rating || 'Unrated';
                tags = prob.tags || [];
                if (prob.name) problemName = prob.name;
              }
            }
          } catch (e) { }
          
          let problemStatementHtml = "Problem statement couldn't be extracted.";
          try {
             const probUrl = `https://codeforces.com/contest/${contestId}/problem/${index}`;
             const pRes = await fetch(probUrl);
             const pText = await pRes.text();
             const pDoc = (new DOMParser()).parseFromString(pText, "text/html");
             const psDiv = pDoc.querySelector('.problem-statement');
             if (psDiv) problemStatementHtml = psDiv.outerHTML;
          } catch (e) {}

          const fullReadmeText = `
${problemStatementHtml}

---
**Problem Name:** ${problemName} <br>
**Tags:** ${tags.join(', ')} <br>
**Problem Link:** [Codeforces ${contestId}${index}](https://codeforces.com/contest/${contestId}/problem/${index})
`;

          const problemInfo = {
            rating: rating,
            contestName: contestName,
            contestId: contestId,
            index: index,
            text: fullReadmeText,
            programmingLanguage: language
          };
          
          chrome.storage.local.get(['cf_handle', 'github_token', 'github_repo'], function(data) {
             if (!data.github_token || !data.github_repo || !data.cf_handle) {
                syncBtn.innerText = '❌ Config Missing';
                return;
             }
             chrome.runtime.sendMessage({
                type: 'UPLOAD_TO_GITHUB',
                payload: {
                  code: code,
                  problemInfo: problemInfo,
                  repo: data.github_repo,
                  token: data.github_token,
                  username: data.cf_handle
                }
              }, (response) => {
                if (response && response.success) {
                  syncBtn.innerText = '✅';
                  syncBtn.style.backgroundColor = '#1f6feb';
                } else {
                  syncBtn.innerText = '❌';
                  syncBtn.style.backgroundColor = '#da3633';
                }
              });
          });
          
        } catch (err) {
          syncBtn.innerText = '❌ Error';
          console.error(err);
        }
      });
      
      span.parentNode.appendChild(syncBtn);
    });
  }, 1000);
}
