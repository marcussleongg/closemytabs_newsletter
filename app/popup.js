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
  
console.log('popup.js loaded');
