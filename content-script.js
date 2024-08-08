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
        // Timetable page found, insert HTML - export button
        const iHtml =
            '<div class="col-sm-12 row">\n' +
            '    <div class="col-md-2"></div>\n' +
            '    <div class="col-md-6 mt-2">\n' +
            '        <button id="exportCalendar" class="btn btn-primary">Export Calendar</button>\n' +
            '    </div>\n' +
            '</div>\n';
        sTT.insertAdjacentHTML("beforeend", iHtml);
        // Add export button click handler
        const exportBtn = document.getElementById("exportCalendar");
        exportBtn.addEventListener('click', exportCalendar);
    };
    // Callback for changes to page_outline div
    const poOCb = (mutationList, observer) => {
        b5pw = document.getElementById("b5-pagewrapper");
        if (b5pw != null) {
            // b5-pagewrapper found, observe for Timetable page
            b5pwO.observe(b5pw, { childList: true });
            observer.disconnect();
        }
    };
    // Use the recommended MutationObserver to observe for needed changes
    const b5pwO = new MutationObserver(b5pwCb);
    let b5pw = document.getElementById("b5-pagewrapper");
    if (b5pw != null) {
        // Direct b5-pagewrapper div found, observe for Timetable page
        b5pwO.observe(b5pw, { childList: true });
    }
    const poO = new MutationObserver(poOCb);
    if (b5pw == null) {
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

// Parse dispayed Academic Caldendar month
function parseACal() {
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
    return cal;
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

// Get Javascript month index based on month string (eg: Aug or August returns 7)
function getMonthIndex(month) {
    return new Date(Date.parse(month + " 1, 2024")).getMonth();
}

// To create unique uid's for events - to avoid duplicates when importing again
// A simple hash from: https://gist.github.com/jlevy/c246006675becc446360a798e2b2d781
const simpleHash = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
    }
    // Convert to 32bit unsigned integer in base 36 and pad with "0" to ensure length is 7.
    return (hash >>> 0).toString(36).padStart(7, "0");
};

// Generate ICS file from parsed timetable events based on the academic calendar
function generateICS(courses, weeklyEvents, ac, calName) {
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
        const [month, year] = monthYear.split('-');
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
                    const start = getICSDateTime(date, event["start"]);
                    const end = getICSDateTime(date, event["end"]);
                    iCal +=
                        'BEGIN:VEVENT\n' +
                        'UID:' + simpleHash(event.toString() + start + end) + '\n' +
                        'DTSTAMP:' + getICSDateTime(new Date(), '00:00') + '\n' +
                        'DTSTART;TZID=Asia/Kolkata:' + start + '\n' +
                        'DTEND;TZID=Asia/Kolkata:' + end + '\n' +
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
                const start = getICSDate(date);
                const end = getICSDate(nextDate);
                iCal +=
                    'BEGIN:VEVENT\n' +
                    'UID:' + simpleHash(info + detail + start + end) + '\n' +
                    'DTSTAMP:' + getICSDateTime(new Date(), '00:00') + '\n' +
                    'DTSTART;TZID=Asia/Kolkata:' + start + '\n' +
                    'DTEND;TZID=Asia/Kolkata:' + end + '\n' +
                    'SUMMARY:' + info + ' ' + detail + '\n' +
                    'END:VEVENT\n';

            }
        }
    }
    iCal += 'END:VCALENDAR\n';
    return iCal;
}

// Save the ics file
function saveICS(ics, ttName) {
    // Create a dummy hidden link to download
    const link = document.createElement('a');
    const url = URL.createObjectURL(
        new Blob([ics], { type: 'text/calendar; charset=utf-8;' })
    );
    link.setAttribute('href', url);
    link.setAttribute("download", ttName + ".ics");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    console.log("VIT Timetable Export Plugin : Exported as '" + ttName + ".ics'");
}

// Parse Academics Calender and Export Timetable Calendar
function parseACalAndExport() {
    const data = JSON.parse(localStorage.getItem("tt-plugin"));
    // Reset localStorage for plugin
    localStorage.removeItem("tt-plugin");
    if (data == null) {
        alert("Error: Please visit the Timetable page and try again");
        return;
    }
    // Callback after Class Group is updated
    const afterClassGroupChange = function () {
        const months = document.querySelectorAll("#getListForSemester a");
        // Function to click on each month of the academic calendar
        function selectMonth(i) {
            const month = months[i];
            const monthClick = `
                const month = this.innerText;
                $(document).ajaxStop(function () {
                    $(this).unbind('ajaxStop');
                    window.dispatchEvent(new CustomEvent('reset', {detail: {'month': month,'n': ` + i + `}}));
                });
                this.click();
                this.removeAttribute('onreset');
            `;
            month.setAttribute("onreset", monthClick);
            month.dispatchEvent(new CustomEvent("reset"));
        }
        let ac = {}
        // Callback after academic calendar for month is displayed
        const afterMonthClick = function(event) {
            const month = event.detail.month;
            // Parse the displayed month
            ac[month] = parseACal();
            if (event.detail.n < months.length - 1) {
                // Select all the months in the academic calendar
                selectMonth(event.detail.n + 1);
            } else {
                // All months parsed
                window.onreset = null;
                const ttName = "VIT-" + data['semester'].replace(/ /g, "-");
                // Generate and save ICS
                const ics = generateICS(data['courses'], data['tt'], ac, ttName);
                saveICS(ics, ttName);
            }
        };
        window.onreset = afterMonthClick;
        selectMonth(0);
    }
    const onreset = `
        $(document).ajaxStop(function () {
            $(this).unbind('ajaxStop');
            window.dispatchEvent(new CustomEvent("reset"));
        });
        this.removeAttribute('onreset');
    `;
    // Callback after semester is updated
    const afterSemesterChange = function () {
        const cg = document.getElementById("classGroupId");
        for (let i = 0; i < cg.options.length; i++) {
            if (cg.options[i].innerText == data['classGroup']) {
                cg.options[i].selected = true;
                break;
            }
        }
        window.onreset = afterClassGroupChange;
        // Change Class Group as per Timetable page
        cg.setAttribute("onreset", onreset);
        cg.dispatchEvent(new CustomEvent("reset"));
        cg.dispatchEvent(new CustomEvent("change"));
    }
    window.onreset = afterSemesterChange;
    // Change semester as per Timetable page
    const semId = document.getElementById("semesterSubId");
    semId.setAttribute("onreset", onreset);
    semId.dispatchEvent(new CustomEvent('reset'));
    semId.selectedIndex = document.querySelector('#semesterSubId option[value=' + data['semId'] + ']').index;
    semId.dispatchEvent(new CustomEvent('change'));
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
    const cg = verifyAndGetClassGroup();
    if (cg == null) {
        alert('Only a single common Class Group is currently supported');
        return;
    }
    const semId = semSubId.options[semSubId.selectedIndex].value;
    const semester = semSubId.options[semSubId.selectedIndex].innerText;
    let data = {
        "semId": semId,
        "semester": semester,
        "classGroup": cg,
        "courses": parseCourses(),
        "tt": parseTT()
    };
    // Save to localStorage for use in Academics Calendar page
    localStorage.setItem("tt-plugin", JSON.stringify(data));
    // Navigate to Academics Calendar page
    // Hack inspired by https://www.youtube.com/watch?v=HVugG0psJkM
    let redirectToACal = `
        $(document).ajaxStop(function () {
            $(this).unbind('ajaxStop');
            window.dispatchEvent(new CustomEvent("reset"));
        });
        document.querySelector('a[data-url="academics/common/CalendarPreview"]').click();
        this.removeAttribute('onreset');
    `;
    window.onreset = parseACalAndExport;
    semSubId.setAttribute('onreset', redirectToACal);
    semSubId.dispatchEvent(new CustomEvent("reset"));
}

// This is the entry point
addObservers();
