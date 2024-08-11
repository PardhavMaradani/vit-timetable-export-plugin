chrome.runtime.onInstalled.addListener(async () => {
    chrome.contextMenus.create({
        title: 'Export ICS File',
        id: 'exportICSFile',
        documentUrlPatterns: ["https://vtop.vit.ac.in/vtop/content"],
    });
});

chrome.contextMenus.onClicked.addListener((item, tab) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ['content-script.js']
        });
    });
});
