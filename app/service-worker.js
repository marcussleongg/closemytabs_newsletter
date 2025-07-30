chrome.runtime.onInstalled.addListener(() => {
    // Check if the user is already logged in on extension installation/update
    chrome.identity.getAuthToken({ interactive: false }, function(token) {
      if (token) {
        console.log("User already logged in on startup.");
        fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: {
            'Authorization': 'Bearer ' + token
          }
        })
        .then(response => response.json())
        .then(userInfo => {
          chrome.storage.local.set({ userLoggedIn: true, userInfo: userInfo, accessToken: token });
        })
        .catch(error => {
          console.error("Error fetching user info on startup:", error);
          chrome.storage.local.set({ userLoggedIn: false }); // Assume not logged in if error
        });
      } else {
        console.log("User not logged in on startup. Prompt for login when popup opens.");
        chrome.storage.local.set({ userLoggedIn: false });
      }
    });
  });
