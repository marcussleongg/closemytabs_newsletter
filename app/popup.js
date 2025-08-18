// Function to update the UI based on login status
function updateUI(isLoggedIn, userInfo) {
    const loggedOutContent = document.getElementById('loggedOutContent');
    const loggedInContent = document.getElementById('loggedInContent');
  
    if (isLoggedIn) {
      loggedOutContent.style.display = 'none';
      loggedInContent.style.display = 'block';
      // Show the initial generate state when logged in
      showGenerateState();
    } else {
      loggedOutContent.style.display = 'block';
      loggedInContent.style.display = 'none';
    }
}

// Function to show status messages to the user
function showStatusMessage(message, type = 'info') {
    // Remove any existing status message
    const existingMessage = document.querySelector('.status-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    const statusDiv = document.createElement('div');
    statusDiv.className = 'status-message';
    statusDiv.textContent = message;
    
    // Add styling based on type
    const baseStyle = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    
    const typeStyles = {
        success: 'background: #4CAF50; color: white;',
        error: 'background: #f44336; color: white;',
        info: 'background: rgba(255, 255, 255, 0.9); color: #333;'
    };
    
    statusDiv.style.cssText = baseStyle + typeStyles[type];
    
    // Add CSS animation
    if (!document.querySelector('#statusAnimationStyle')) {
        const style = document.createElement('style');
        style.id = 'statusAnimationStyle';
        style.textContent = `
            @keyframes slideIn {
                from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
                to { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(statusDiv);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
        if (statusDiv.parentNode) {
            statusDiv.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => statusDiv.remove(), 300);
        }
    }, 4000);
}

// Functions to manage UI states
function showGenerateState() {
    document.getElementById('generateState').style.display = 'block';
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('successState').style.display = 'none';
}

function showLoadingState() {
    document.getElementById('generateState').style.display = 'none';
    document.getElementById('loadingState').style.display = 'block';
    document.getElementById('successState').style.display = 'none';
}

function showSuccessState() {
    document.getElementById('generateState').style.display = 'none';
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('successState').style.display = 'block';
}
  
    // Add event listeners when the DOM is loaded
  document.addEventListener('DOMContentLoaded', function() {
    const loginButton = document.getElementById('loginButton');
    const generateButton = document.getElementById('generateButton');
    const settingsButton = document.getElementById('settingsButton');

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

    if (generateButton) {
        generateButton.addEventListener('click', async () => {
            try {
                // Show loading state
                showLoadingState();
                
                const tabsData = await getCurrentWindowTabs();
                const idToken = await getAuthIdToken(); // from oauth.js
                if (!idToken) {
                    console.error("Not logged in or no ID token found.");
                    showStatusMessage("Please retry logging in!", 'error');
                    showGenerateState(); // Reset to initial state
                    return;
                }
                const tabsTitleUrl = tabsData.map(tab => ({title: tab.title, url: tab.url}));
                const result = await sendTabsToBackend(tabsTitleUrl, idToken);
                
                if (result.success !== false) {
                    showSuccessState();
                } else {
                    showStatusMessage('Failed to generate newsletter. Please try again.', 'error');
                    showGenerateState(); // Reset to initial state
                }
            } catch (error) {
                console.error("Error generating newsletter:", error);
                showStatusMessage('Error generating newsletter. Please try again.', 'error');
                showGenerateState(); // Reset to initial state
            }
        });
    }

    if (settingsButton) {
        settingsButton.addEventListener('click', () => {
            // For now, just sign out - you can expand this later
            signOutGoogle();
            updateUI(false, null);
        });
    }
  
    // Check initial login state when the popup opens
    chrome.storage.local.get(['userLoggedIn', 'userInfo'], function(result) {
      updateUI(result.userLoggedIn, result.userInfo);
    });
  });

  // Function to display tabs in the new UI structure
function displayCurrentTabs() {
    chrome.tabs.query({windowId: chrome.windows.WINDOW_ID_CURRENT}, (tabs) => {
        const tabsContainer = document.getElementById('tabsContainer');
        
        if (tabs.length > 0) {
            tabsContainer.innerHTML = `
                <h3>Current tabs (${tabs.length}):</h3>
                <ul></ul>
            `;
            
            const tabsList = tabsContainer.querySelector('ul');
            tabs.forEach(tab => {
                const listItem = document.createElement('li');
                listItem.textContent = tab.title || tab.url;
                listItem.title = tab.url; // Show full URL on hover
                tabsList.appendChild(listItem);
            });
            
            tabsContainer.style.display = 'block';
        }
    });
}

// Call displayCurrentTabs when DOM is loaded
//document.addEventListener('DOMContentLoaded', displayCurrentTabs);

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
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify(payload)
        });
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const result = await response.json();
            console.log('Backend response:', result);
            return result;
        } else {
            const text = await response.text();
            console.log('Backend response (text):', text);
            return { success: true, message: "Your tabs have been sent for processing!" };
        }
    } catch (error) {
        console.error('Error sending data to backend:', error);
        return { success: false, error: error.message };
    }
}