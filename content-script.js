console.log("VIT Timetable Export Plugin : content-script.js loaded");

// Add observer for b5-pagewrapper to find Timetable page
// Add observer for page_outline to find b5-pagewrapper (if not already found)
function addObservers() {
    // Callback for changes to b5-pagewrapper div
    const b5pwCb = (mutationList, observer) => {
        let sTT = document.getElementById("studentTimeTable");
        if (sTT == null) {
            return;
        }
        // Timetable page found, insert HTML - export button, from date and # of weeks
        const iHtml =
            '<div class="col-sm-12 row">\n' +
            '    <div class="col-md-2"></div>\n' +
            '    <div class="col-md-6 mt-2">\n' +
            '        <button id="exportCalendar" class="btn btn-primary">Export Calendar</button>\n' +
            '        <label>from</label>\n' +
            '        <input id="fromDate" type="text" class="col-sm-2">\n' +
            '        <label>for</label>\n' +
            '        <input id="rWeeks" type="number" class="col-sm-1" value="18">\n' +
            '        <label>weeks</label>\n' +
            '    </div>\n' +
            '</div>\n';
        sTT.insertAdjacentHTML("beforeend", iHtml);
        // Add current date
        const fromDate = document.getElementById("fromDate");
        fromDate.value = new Date().toLocaleDateString();
        // Add export button click handler
        const exportBtn = document.getElementById("exportCalendar");
        exportBtn.addEventListener('click', exportCalendar);
    };
    // Callback for changes to page_outline div
    const poOCb = (mutationList, observer) => {
        b5pw = document.getElementById("b5-pagewrapper");
        if (b5pw == null) {
            return;
        }
        // b5-pagewrapper found, observe for Timetable page
        b5pwO.observe(b5pw, { childList: true });
        poO.disconnect();
    };
    // Use the recommended MutationObserver to observe for needed changes
    const poO = new MutationObserver(poOCb);
    const b5pwO = new MutationObserver(b5pwCb);
    let b5pw = document.getElementById("b5-pagewrapper");
    if (b5pw != null) {
        // Direct b5-pagewrapper div found, observe for Timetable page
        b5pwO.observe(b5pw, { childList: true });
    } else {
        // b5-pagewrapper not found, observe for it in page_outline
        const po = document.getElementById("page_outline");
        if (po != null) {
            poO.observe(po, { childList: true });
        } else {
            // Nothing we can do
            console.log("VIT Timetable Export Plugin : page_outline ID not found!");
        }
    }
}

// Parse the first table that has course ID to name mapping
function parseCourseNames() {
    let courseNames = new Object();
    const coursesTable = document.querySelector('table');
    const rows = coursesTable.querySelectorAll('tr');
    for (let r = 1; r < rows.length - 1; r++) {
        // 2nd column, first p tag
        const course = rows[r].querySelectorAll('td')[2].children[0].innerText;
        const [id, name] = course.split('-'); // split id and name
        courseNames[id.trim()] = name.trim();
    }
    return courseNames;
}

// Formatted date as needed by ics format - YYYYMMDDT
function getICSDate(date) {
    return (
        date.getFullYear().toString() +
        (date.getMonth() + 1).toString().padStart(2, '0') +
        date.getDate().toString().padStart(2, '0') + 'T'
    );
}

// Calendar events are created from the beginning of week (Monday)
function getNextDate(inputDate, fromDate) {
    if (fromDate == null) {
        // Get Monday of the week of inputDate
        const date = new Date(inputDate);
        let day = date.getDay();
        let diff = date.getDate() - day + (day == 0 ? -6 : 1);
        return new Date(date.setDate(diff));
    }
    const date = new Date(fromDate);
    date.setDate(fromDate.getDate() + 1);
    return date;
}

// Parse the main Timetable
function parseTT(inputDate) {
    const courseNames = parseCourseNames();
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
    let events = [];
    let day = "";
    let date = null;
    // All other rows have weekday schedules
    for (let r = 4; r < rows.length; r++) {
        const tol = (r % 2 == 0) ? 0 : 1; // theory or lab
        let cs = tol ? 1 : 2; // fix column start
        const cols = rows[r].querySelectorAll("td");
        if (tol == 0) {
            // Once for each weekday
            day = cols[0].innerText.substring(0,2);
            date = getNextDate(inputDate, date);
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
                name: courseNames[id],
                type: type,
                venue: venue,
                day: day,
                start: getICSDate(date) + sT[tol][cc].replace(/:/g, '') + "00",
                end: getICSDate(date) + eT[tol][cc].replace(/:/g, '') + "00",
            };
            events.push(event);
        }
    }
    return events;
}

// Generate ICS file from parsed timetable events
function generateICS(calName, inputDate, rWeeks) {
    const events = parseTT(inputDate);
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
    // Iterate over all events
    for (let i = 0; i < events.length; i++) {
        const event = events[i];
        iCal +=
            'BEGIN:VEVENT\n' +
            'UID:' + crypto.randomUUID() + '\n' +
            'DTSTAMP:' + getICSDate(new Date()) + '000000' + '\n' +
            'DTSTART;TZID=Asia/Kolkata:' + event['start'] + '\n' +
            'DTEND;TZID=Asia/Kolkata:' + event['end'] + '\n' +
            'RRULE:FREQ=WEEKLY;WKST=SU;COUNT=' + rWeeks + ';BYDAY=' + event['day'] + '\n' +
            'LOCATION:' + event['venue'] + '\n' +
            'SUMMARY:(' + event['type'] + ') ' + event['name'] + '\n' +
            'END:VEVENT\n';
    }
    iCal += 'END:VCALENDAR\n';
    return iCal;
}

// Click handler to export as ICS file
function exportCalendar(e) {
    e.preventDefault(); // prevent default submit
    const semSubId = document.getElementById('semesterSubId');
    if (semSubId.value == '') {
        alert("Please choose a semster...");
        return;
    }
    const fromDate = document.getElementById('fromDate').value;
    const [day, month, year] = fromDate.split("/");
    const ts = Date.parse(`${month}/${day}/${year}`);
    if (isNaN(ts)) {
        alert("Invalid date. Need in valid DD/MM/YYYY format");
        return;
    }
    const inputDate = new Date(ts);
    const rWeeks = document.getElementById('rWeeks');
    if (rWeeks.value < 1 || rWeeks.value > 26) {
        rWeeks.value = 18; // default weeks for any error cases
    }
    // Use the selected semester as timetable name and ICS filename
    const ttName = 'VIT-' + semSubId.options[semSubId.selectedIndex].innerText.replace(/ /g, '-');
    const iCal = generateICS(ttName, inputDate, rWeeks.value);
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
    console.log("VIT Timetable Export Plugin : Exported as '" + ttName + ".ics" + "' (" + rWeeks.value + " weeks)");
}

// This is the entry point
addObservers();
