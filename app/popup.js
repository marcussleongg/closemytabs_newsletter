// Function to update the UI based on login status
function updateUI(isLoggedIn, userInfo) {
    const loggedOutContent = document.getElementById('loggedOutContent');
    const loggedInContent = document.getElementById('loggedInContent');
    const userNameSpan = document.getElementById('userName');
  
    if (isLoggedIn) {
      loggedOutContent.style.display = 'none';
      loggedInContent.style.display = 'block';
      userNameSpan.textContent = userInfo.given_name || userInfo.name || userInfo.email || 'User';
    } else {
      loggedOutContent.style.display = 'block';
      loggedInContent.style.display = 'none';
    }
  }
  
  // Add event listeners when the DOM is loaded
  document.addEventListener('DOMContentLoaded', function() {
    const loginButton = document.getElementById('loginButton');
    const logoutButton = document.getElementById('logoutButton');
    const sendTabsButton = document.getElementById('sendTabsButton');
  
    if (loginButton) {
      loginButton.addEventListener('click', async () => {
        try {
          const { userInfo } = await signInWithGoogle();
          updateUI(true, userInfo);
        } catch (error) {
          // Error is already logged by signInWithGoogle, just update UI
          updateUI(false, null);
        }
      });
    }
  
    if (logoutButton) {
      logoutButton.addEventListener('click', async () => {
        await signOutGoogle();
        updateUI(false, null);
      });
    }
  
    if (sendTabsButton) {
        sendTabsButton.addEventListener('click', async () => {
            try {
                const tabsData = await getTabsUnaccessedPastDayInfo();
                const idToken = await getAuthIdToken(); // from oauth.js
                if (!idToken) {
                    console.error("Not logged in or no ID token found.");
                    // Optionally, prompt the user to log in again
                    return;
                }
                await sendTabsToBackend(tabsData, idToken);
            } catch (error) {
                console.error("Error sending tabs to backend:", error);
            }
        });
    }
  
    // Check initial login state when the popup opens
    chrome.storage.local.get(['userLoggedIn', 'userInfo'], function(result) {
      updateUI(result.userLoggedIn, result.userInfo);
    });
  });
  
  // The onMessage listener is no longer needed as the popup handles its own UI updates directly.

  chrome.tabs.query({windowId: chrome.windows.WINDOW_ID_CURRENT}, (tabs) => {
    const body = document.body;
    
    const tabsHeader = document.createElement('h3');
    tabsHeader.textContent = 'The tabs you\'re on are:';
    body.appendChild(tabsHeader);
    
    const tabsList = document.createElement('ul');
    for (let i = 0; i < tabs.length; i++) {
        const listItem = document.createElement('li');
        listItem.textContent = tabs[i].url;
        tabsList.appendChild(listItem);
    }
    body.appendChild(tabsList);
});
  
console.log('popup.js loaded me');
let hasRun = false;

async function getTabsUnaccessedPastDayInfo() {
    let allTabs = await chrome.tabs.query({});

    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const oneMinAgo = Date.now() - (1 * 60 * 1000);
    // potentially add tab.lastAccessed < certain period of time
    const tabsUnaccessed = allTabs.filter(tab => tab.lastAccessed > oneMinAgo);
    const tabsTitleUrl = tabsUnaccessed.map(tab => ({title: tab.title, url: tab.url}));
    return tabsTitleUrl;
}

async function logTabsUnaccessedPastDayInfo () {
    let tabsInfo = await getTabsUnaccessedPastDayInfo();
    console.log('Info for tabs accessed in last minute:', tabsInfo);
}

logTabsUnaccessedPastDayInfo();

async function sendTabsToBackend(tabsData, idToken) {
    try {
        const response = await fetch('https://eaf3nblqhg.execute-api.us-east-2.amazonaws.com/default/produceAndSendNewsletter', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
                tabs: tabsData,
                timestamp: Date.now()
            })
        });
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const result = await response.json();
            console.log('Backend response:', result);
            return result;
        } else {
            // Handle non-JSON response
            const text = await response.text();
            console.log('Backend response (text):', text);
            return { success: true, message: text };
        }
    } catch (error) {
        console.error('Error sending data to backend:', error);
        return { success: false, error: error.message };
    }
}

/* if (!hasRun) {
    hasRun = true;
    (async () => {
        const tabsData = await getTabsUnaccessedPastDayInfo();
        sendTabsToBackend(tabsData);
    })();
} */