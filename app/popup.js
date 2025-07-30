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
    // potentially add tab.lastAccessed < certain period of time
    const tabsUnaccessed = allTabs.filter(tab => tab.lastAccessed > oneDayAgo);
    const tabsTitleUrl = tabsUnaccessed.map(tab => ({title: tab.title, url: tab.url}));
    return tabsTitleUrl;
}

async function logTabsUnaccessedPastDayInfo () {
    let tabsInfo = await getTabsUnaccessedPastDayInfo();
    console.log('Info for tabs accessed in last 24 hours:', tabsInfo);
}

logTabsUnaccessedPastDayInfo();

async function sendTabsToBackend(tabsData) {
    try {
        const response = await fetch('https://eaf3nblqhg.execute-api.us-east-2.amazonaws.com/default/produceAndSendNewsletter', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
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

if (!hasRun) {
    hasRun = true;
    (async () => {
        const tabsData = await getTabsUnaccessedPastDayInfo();
        sendTabsToBackend(tabsData);
    })();
}