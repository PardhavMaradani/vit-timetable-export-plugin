chrome.runtime.onInstalled.addListener(async () => {
    chrome.contextMenus.create({
        title: 'Export VIT Timetable',
        id: 'exportTT',
        documentUrlPatterns: ["https://vtop.vit.ac.in/vtop/content"],
    });
});

function checkTimetablePage() {
  let sTT = document.getElementById("studentTimeTable");
  if (sTT != null) {
    alert("In Timetable page...");
  } else {
    alert("NOT in Timetable page...");
  }
}

chrome.contextMenus.onClicked.addListener((item, tab) => {
    // Query the active tab before injecting the content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        // Use the Scripting API to execute a script
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ['content-script.js'] // inject file
            //func: checkTimetablePage // inject function
        });
    });
});
