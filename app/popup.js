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
                const tabsData = await getCurrentWindowTabs();
                const idToken = await getAuthIdToken(); // from oauth.js
                if (!idToken) {
                    console.error("Not logged in or no ID token found.");
                    const body = document.body;
                    body.appendChild(document.createElement('h3')).textContent = "Please retry logging in (especially if on incognito window)!";
                    return;
                }
                const tabsTitleUrl = tabsData.map(tab => ({title: tab.title, url: tab.url}));
                await sendTabsToBackend(tabsTitleUrl, idToken);
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

async function getCurrentWindowTabs() {
    return await chrome.tabs.query({windowId: chrome.windows.WINDOW_ID_CURRENT});
}

console.log(getCurrentWindowTabs());

async function sendTabsToBackend(tabsData, idToken) {
    try {
        const payload = {
            tabs: tabsData,
            timestamp: Date.now()
        };

        const response = await fetch('https://5cr4muf9c9.execute-api.us-east-2.amazonaws.com/process-tabs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}` // This is still required by the authorizer
            },
            body: JSON.stringify(payload)
            body: JSON.stringify(payload)
        });
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const result = await response.json();
            console.log('Backend response:', result);
            // You might want to display a success message to the user here
            return result;
        } else {
            const text = await response.text();
            console.log('Backend response (text):', text);
            return { success: true, message: "Your tabs have been sent for processing!" };
        }
    } catch (error) {
        console.error('Error sending data to backend:', error);
        // You might want to display an error message to the user here
        return { success: false, error: error.message };
    }
}