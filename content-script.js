console.log("VIT Timetable Export Plugin : content-script.js loaded");

// Add observer for b5-pagewrapper to find Timetable page
// Add observer for page-wrapper to find Calendar page
// Add observer for page_outline to find b5-pagewrapper and page-wrapper (if not already found)
function addObservers() {
    // Callback for changes to b5-pagewrapper div
    const b5pwCb = (mutationList, observer) => {
        let sTT = document.getElementById("studentTimeTable");
        if (sTT == null) {
            return;
        }
        // Timetable page found, insert HTML - export button
        const iHtml =
            '<div class="col-sm-12 row">\n' +
            '    <div class="col-md-2"></div>\n' +
            '    <div class="col-md-6 mt-2">\n' +
            '        <span>' + chrome.runtime.getManifest()["name"] + ' ' + chrome.runtime.getManifest()["version"] + ' : </span>\n' +
            '        <button id="exportCalendar" class="btn btn-primary">Export Calendar</button>\n' +
            '    </div>\n' +
            '</div>\n';
        sTT.insertAdjacentHTML("beforeend", iHtml);
        // Add export button click handler
        const exportBtn = document.getElementById("exportCalendar");
        exportBtn.addEventListener('click', exportCalendar);
    };
    // Callback for changes to page-wrapper div
    const pwCb = (mutationList, observer) => {
        let cV = document.getElementById("calendarView");
        if (cV == null) {
            return;
        }
        // Calendar page found, insert HTML - save, view and clear buttons
        const iHtml =
            '<div class="mb-2" style="width: 100%; float: left;">\n' +
            '    <div style="width: 100%; float: left; text-align: center; display: block; margin: auto;">\n' +
            '        <span>' + chrome.runtime.getManifest()["name"] + ' ' + chrome.runtime.getManifest()["version"] + ' : </span>\n' +
            '        <button id="saveACal" class="btn btn-info">Save</button>\n' +
            '        <button id="viewACal" class="btn btn-info">View saved</button>\n' +
            '        <button id="clearACal" class="btn btn-info">Clear saved</button>\n' +
            '    </div>\n' +
            '</div>\n';
        cV.insertAdjacentHTML("beforebegin", iHtml);
        // Add click handlers for buttons
        document.getElementById("saveACal").addEventListener("click", saveACal);
        document.getElementById("viewACal").addEventListener("click", viewACal);
        document.getElementById("clearACal").addEventListener('click', clearACal);
   };
    // Callback for changes to page_outline div
    const poOCb = (mutationList, observer) => {
        b5pw = document.getElementById("b5-pagewrapper");
        if (b5pw != null) {
            // b5-pagewrapper found, observe for Timetable page
            b5pwO.observe(b5pw, { childList: true });
        }
        pw = document.getElementById("page-wrapper");
        if (pw != null) {
            // page-wrapper found, observe for Calendar page
            pwO.observe(pw, {childList: true});
        }
        if (b5pw != null && pw != null) {
            // Can stop observing in page_outline
            poO.disconnect();
        }
    };
    // Use the recommended MutationObserver to observe for needed changes
    const b5pwO = new MutationObserver(b5pwCb);
    let b5pw = document.getElementById("b5-pagewrapper");
    if (b5pw != null) {
        // Direct b5-pagewrapper div found, observe for Timetable page
        b5pwO.observe(b5pw, { childList: true });
    }
    const pwO = new MutationObserver(pwCb);
    let pw = document.getElementById("page-wrapper");
    if (pw != null) {
        pwO.observe(pw, {childList: true });
    }
    const poO = new MutationObserver(poOCb);
    if (b5pw == null || pw == null) {
        // b5-pagewrapper or page-wrapper not found, observe for them in page_outline
        const po = document.getElementById("page_outline");
        if (po != null) {
            poO.observe(po, { childList: true });
        } else {
            // Nothing we can do
            console.log("VIT Timetable Export Plugin : page_outline ID not found!");
        }
    }
}

// Save Academic Caldendar details for selected Semester, Class Group and Month
function saveACal(e) {
    e.preventDefault(); // prevent default submit
    const semIdEl = document.getElementById("semesterSubId");;
    if (semIdEl.selectedIndex == 0) {
        alert("Please select the Semester, Class Group and Month");
        return;
    }
    const cgEl = document.getElementById("classGroupId");
    if (cgEl.options[cgEl.selectedIndex].value == "COMB") {
        alert("Please select specific Class Group");
        return;
    }
    const month = document.querySelector("#list-wrapper h4").innerText;
    if (month == '') {
        alert("Please select the month");
        return;
    }
    let cal = {};
    // Parse all the columns of the calendar table
    const cols = document.querySelectorAll("#list-wrapper td");
    for (let c = 0; c < cols.length; c++) {
        const col = cols[c];
        const spans = col.querySelectorAll("span");
        const day = spans[0].innerText;
        if (day == '' || spans[1] == undefined) {
            // Ignore non numbered cells
            continue;
        }
        let info = spans[1].innerText;
        let detail = '';
        if (spans[2] != undefined) {
            detail = spans[2].innerText;
        }
        cal[day] = info + '|' + detail
    }
    // Use localStorage to save details
    let o = JSON.parse(localStorage.getItem("tt-plugin"));
    if (o == null) {
        o = {}; // create new object
    }
    const semId = semIdEl.options[semIdEl.selectedIndex].value;
    if (!o.hasOwnProperty(semId)) {
        o[semId] = {};
    }
    o[semId]["name"] = semIdEl.options[semIdEl.selectedIndex].innerText;
    const cg = cgEl.options[cgEl.selectedIndex].innerText;
    if (!o[semId].hasOwnProperty(cg)) {
        o[semId][cg] = {};
    }
    o[semId][cg][month] = cal;
    localStorage.setItem("tt-plugin", JSON.stringify(o));
    alert('Saved Academic Calendar for ' + month);
}

// View Academic Calendar details
function viewACal(e) {
    e.preventDefault(); // prevent default submit
    // read from localStorage
    let o = JSON.parse(localStorage.getItem("tt-plugin"));
    if (o == null) {
        alert("No saved Academic Calendar details found");
        return;
    }
    // Output in simple tree format
    let output = '';
    for (let semId in o) {
        output += o[semId]["name"] + '\n';
        for (let cg in o[semId]) {
            if (cg == "name") {
                continue;
            }
            output += '    ' + cg + '\n';
            for (let month in o[semId][cg]) {
                output += '        ' + month + '\n';
            }
        }
    }
    alert(output);
}

// Clear Academic Calendar details
function clearACal(e) {
    e.preventDefault(); // prevent default submit
    if (confirm("Are you sure you want to clear saved Academic Calendar details?")) {
        localStorage.removeItem("tt-plugin");
    }
}

// Parse the first table that has course details
function parseCourses() {
    let courses = {};
    const table = document.querySelector('table');
    const rows = table.querySelectorAll('tr');
    for (let r = 1; r < rows.length - 1; r++) {
        const cols = rows[r].querySelectorAll("td");
        const course = cols[2].children[0].innerText; // 2nd column, first p tag
        let [id, name] = course.split('-'); // split id and name
        id = id.trim();
        courses[id] = {};
        courses[id]["name"] = name.trim();
        courses[id]["classGroup"] = cols[1].innerText;
        courses[id]["category"] = cols[4].innerText;
        courses[id]["classId"] = cols[6].innerText;
        courses[id]["slotVenue"] = cols[7].innerText.replace(/\r?\n/g, '').replace('-', '- ');
        courses[id]["faculty"] = cols[8].innerText.replace(/\r?\n/g, '').replace('-', '- ');
    }
    return courses;
}

// Formatted date for ics - YYYYMMDD
function getICSDate(date) {
    return (
        date.getFullYear().toString() +
        (date.getMonth() + 1).toString().padStart(2, '0') +
        date.getDate().toString().padStart(2, '0')
    );
}

// Formatted date and time for ics - YYYYMMDDTHHMMSS
function getICSDateTime(date, time) {
    return getICSDate(date) + 'T' + time.replace(/:/g, '') + '00';
}

// Parse the main Timetable
function parseTT() {
    const tt = document.querySelector('#timeTableStyle');
    // Start and End times for theory (0) and lab (1) slots
    let sT = [];
    let eT = [];
    for (let i = 0; i < 2; i++) {
        sT[i] = [];
        eT[i] = [];
    }
    const rows = tt.querySelectorAll('tr');
    // First four rows are the theory and lab timings
    for (let r = 0; r < 4; r++) {
        const evenRow = (r % 2) == 0;
        const tol = (r < 2) ? 0 : 1; // theory or lab
        const cols = rows[r].querySelectorAll('td');
        let cs = evenRow ? 2 : 1; // First column has two merged rows each, fix column start
        for (let c = cs; c < cols.length; c++) {
            if (evenRow) {
                sT[tol][c] = cols[c].innerText;
            } else {
                eT[tol][c + 1] = cols[c].innerText;
            }
        }
    }
    let events = {};
    let day = "";
    // All other rows have weekday schedules
    for (let r = 4; r < rows.length; r++) {
        const tol = (r % 2 == 0) ? 0 : 1; // theory or lab
        let cs = tol ? 1 : 2; // fix column start
        const cols = rows[r].querySelectorAll("td");
        if (tol == 0) {
            // Once for each weekday
            day = cols[0].innerText;
            events[day] = [];
        }
        // All slots in each weekday (both theory and lab)
        for (let c = cs; c < cols.length; c++) {
            const cellText = cols[c].innerText;
            if (cellText == '-' || cellText.indexOf('-') < 0) {
                // Need only cells that have course data
                continue;
            }
            const cc = tol ? c + 1 : c; // correct column for labs
            const [slot, id, type, venue] = cellText.split('-');
            // Create the event object
            let event = {
                id: id,
                type: type,
                venue: venue,
                start: sT[tol][cc],
                end: eT[tol][cc]
            };
            events[day].push(event);
        }
    }
    return events;
}

// Get Javascript month index based on month string (eg: Aug or August returns 7)
function getMonthIndex(month) {
    return new Date(Date.parse(month + " 1, 2024")).getMonth();
}

// Generate ICS file from parsed timetable events based on the academic calendar
function generateICS(ac, calName) {
    // Parse the course details
    const courses = parseCourses();
    // Parse the main timetable to get recurring weekly events
    const weeklyEvents = parseTT();
    // Format copied from a Google Calendar export
    let iCal =
        'BEGIN:VCALENDAR\n' +
        'PRODID:-//https://github.com/PardhavMaradani/ //EN\n' +
        'VERSION:2.0\n' +
        'CALSCALE:GREGORIAN\n' +
        'METHOD:PUBLISH\n' +
        'X-WR-CALNAME:' + calName + '\n' +
        'X-WR-TIMEZONE:Asia/Kolkata\n' +
        'X-WR-CALDESC:' + calName + ' Timetable\n' +
        'BEGIN:VTIMEZONE\n' +
        'TZID:Asia/Kolkata\n' +
        'X-LIC-LOCATION:Asia/Kolkata\n' +
        'BEGIN:STANDARD\n' +
        'TZOFFSETFROM:+0530\n' +
        'TZOFFSETTO:+0530\n' +
        'TZNAME:GMT+5:30\n' +
        'DTSTART:19700101T000000\n' +
        'END:STANDARD\n' +
        'END:VTIMEZONE\n';
    // Iterate over all days of academic calendar
    const weekdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    for (let monthYear in ac) {
        const [month, year] = monthYear.split(' ');
        const monthIndex = getMonthIndex(month);
        for (let day in ac[monthYear]) {
            const [info, detail] = ac[monthYear][day].split('|');
            let addFullDayEvent = true;
            const date = new Date(year, monthIndex, day);
            if (info.startsWith('Instructional Day')) {
                // Instructional Day
                addFullDayEvent = false;
                if (detail != '') {
                    addFullDayEvent = true;
                }
                let weekday = weekdays[date.getDay()];
                let events = weeklyEvents[weekday];
                if (events.length == 0) {
                    // Check for any other weekday order
                    const i = detail.indexOf(' Day Order');
                    if (i != -1) {
                        weekday = detail.substring(1, i).substring(0, 3).toUpperCase();
                        events = weeklyEvents[weekday];
                    }
                }
                // Add events for the weekday
                for (let i = 0; i < events.length; i++) {
                    const event = events[i];
                    const courseId = event['id'];
                    iCal +=
                        'BEGIN:VEVENT\n' +
                        'UID:' + crypto.randomUUID() + '\n' +
                        'DTSTAMP:' + getICSDateTime(new Date(), '00:00') + '\n' +
                        'DTSTART;TZID=Asia/Kolkata:' + getICSDateTime(date, event['start']) + '\n' +
                        'DTEND;TZID=Asia/Kolkata:' + getICSDateTime(date, event['end']) + '\n' +
                        'LOCATION:' + event['venue'] + '\n' +
                        'SUMMARY:(' + event['type'] + ') ' + courses[courseId]["name"] + '\n' +
                        'DESCRIPTION:Class Group: ' + courses[courseId]["classGroup"] + '\\n' +
                            'Category: ' + courses[courseId]["category"] + '\\n' +
                            'Class Id: ' + courses[courseId]["classId"] + '\\n' +
                            'Slot/Venue: ' + courses[courseId]["slotVenue"] + '\\n' +
                            'Faculty: ' + courses[courseId]["faculty"] + '\n' +
                        'END:VEVENT\n';
                }
            }
            if (addFullDayEvent) {
                // Holidays, no instructional days, instructional days with more details
                var nextDate = new Date(date);
                nextDate.setDate(date.getDate() + 1);
                iCal +=
                    'BEGIN:VEVENT\n' +
                    'UID:' + crypto.randomUUID() + '\n' +
                    'DTSTAMP:' + getICSDateTime(new Date(), '00:00') + '\n' +
                    'DTSTART;TZID=Asia/Kolkata:' + getICSDate(date) + '\n' +
                    'DTEND;TZID=Asia/Kolkata:' + getICSDate(nextDate) + '\n' +
                    'SUMMARY:' + info + ' ' + detail + '\n' +
                    'END:VEVENT\n';

            }
        }
    }
    iCal += 'END:VCALENDAR\n';
    return iCal;
}

// Verify that the class group is the same for all courses
function verifyAndGetClassGroup() {
    let cg = null;
    const table = document.querySelector('table');
    const rows = table.querySelectorAll('tr');
    for (let r = 1; r < rows.length - 1; r++) {
        const cols = rows[r].querySelectorAll("td");
        if (cg == null) {
            cg = cols[1].innerText;
        }
        if (cols[1].innerText != cg) {
            return null;
        }
    }
    return cg;
}

// Click handler to export as ICS file
function exportCalendar(e) {
    e.preventDefault(); // prevent default submit
    const semSubId = document.getElementById('semesterSubId');
    if (semSubId.value == '') {
        alert("Please choose a semster...");
        return;
    }
    const semId = semSubId.options[semSubId.selectedIndex].value;
    const semester = semSubId.options[semSubId.selectedIndex].innerText;
    let pluginData = JSON.parse(localStorage.getItem("tt-plugin"));
    let ac = null;
    const cg = verifyAndGetClassGroup();
    if (cg == null) {
        alert('Only a single common Class Group is currently supported');
        return;
    }
    if (pluginData != null) {
        ac = pluginData[semId][cg];
    }
    if (pluginData == null || ac == null) {
        alert(
            'No saved Academic Calendar details found for the selected semester.\n' +
            'Please save from [Academics > Academic Calendar] and try again.\n' +
            'Use Semester "' + semester + '" and Class Group "' + cg + '"\n'
        );
        return;
    }
    // Use the selected semester as timetable name and ICS filename
    const ttName = 'VIT-' + semester.replace(/ /g, '-');
    // Generate the actual ICS data
    const iCal = generateICS(ac, ttName);
    // Create a dummy hidden link to download
    const link = document.createElement('a');
    const url = URL.createObjectURL(
        new Blob([iCal], { type: 'text/calendar; charset=utf-8;' })
    );
    link.setAttribute('href', url);
    link.setAttribute("download", ttName + ".ics");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    console.log("VIT Timetable Export Plugin : Exported as '" + ttName + ".ics'");
}

// This is the entry point
addObservers();
