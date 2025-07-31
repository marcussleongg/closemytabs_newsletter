// Function to handle Google Sign-In and retrieve ID Token
async function signInWithGoogle() {
    try {
        const manifest = chrome.runtime.getManifest();
        const clientId = manifest.oauth2.client_id;
        const scopes = manifest.oauth2.scopes.join(' ');
        const redirectUri = chrome.identity.getRedirectURL();
        console.log("IMPORTANT: Your redirect URI is:", redirectUri);
        const nonce = Math.random().toString(36).substring(2, 15);

        let authUrl = `https://accounts.google.com/o/oauth2/v2/auth`;
        authUrl += `?client_id=${clientId}`;
        authUrl += `&redirect_uri=${encodeURIComponent(redirectUri)}`;
        authUrl += `&response_type=id_token`;
        authUrl += `&scope=${encodeURIComponent(scopes)}`;
        authUrl += `&nonce=${nonce}`;
        console.log("Constructed Auth URL:", authUrl);

        const responseUrl = await new Promise((resolve, reject) => {
            console.log("Launching web auth flow...");
            chrome.identity.launchWebAuthFlow(
                { url: authUrl, interactive: true },
                (redirectUrl) => {
                    if (chrome.runtime.lastError || !redirectUrl) {
                        console.error("launchWebAuthFlow Error:", chrome.runtime.lastError?.message);
                        return reject(new Error(chrome.runtime.lastError?.message || "Auth flow failed. User may have cancelled."));
                    }
                    console.log("launchWebAuthFlow Success. Response URL:", redirectUrl);
                    resolve(redirectUrl);
                }
            );
        });

        const urlFragment = new URL(responseUrl).hash.substring(1);
        const params = new URLSearchParams(urlFragment);
        const idToken = params.get('id_token');

        if (!idToken) {
            console.error("Could not extract ID token from auth response. Full response fragment:", urlFragment);
            throw new Error("Could not extract ID token from auth response.");
        }

        const payload = JSON.parse(atob(idToken.split('.')[1]));

        if (payload.aud !== clientId) {
            throw new Error("ID Token audience mismatch.");
        }
        if (payload.nonce !== nonce) {
            throw new Error("Nonce mismatch. Possible replay attack.");
        }

        console.log("Successfully obtained Google ID Token:", idToken);
        console.log("User Info from ID Token:", payload);

        await new Promise(resolve => {
            chrome.storage.local.set({
                userLoggedIn: true,
                userInfo: {
                    email: payload.email,
                    name: payload.name,
                    given_name: payload.given_name,
                },
                idToken: idToken
            }, resolve);
        });
        
        console.log("User logged in and token stored.");
        return { idToken, userInfo: payload };

    } catch (error) {
        console.error("Google Sign-In error:", error.message);
        await new Promise(resolve => {
            chrome.storage.local.set({ userLoggedIn: false, userInfo: null, idToken: null }, resolve);
        });
        throw error;
    }
}

// Function to handle Google Sign-Out
async function signOutGoogle() {
    try {
        const result = await new Promise(resolve => {
            chrome.storage.local.get('idToken', resolve);
        });
        const idToken = result.idToken;

        if (idToken) {
            // Revoking the token is best practice but not strictly required for sign-out.
            // Google doesn't have a simple GET-based revocation endpoint for ID tokens.
            // Clearing local data is the most important step for the extension's state.
            console.log("ID token found, will clear local storage for sign-out.");
        }

        // Clear all user-related data from storage
        await new Promise(resolve => {
            chrome.storage.local.remove(['userLoggedIn', 'userInfo', 'idToken'], resolve);
        });
        console.log("User data cleared from storage.");

    } catch (error) {
        console.error("Google Sign-Out error:", error.message);
    }
}

// Function to get the current ID Token for API calls
async function getAuthIdToken() {
      return new Promise(resolve => {
          chrome.storage.local.get('idToken', function(result) {
              resolve(result.idToken);
          });
      });
  }