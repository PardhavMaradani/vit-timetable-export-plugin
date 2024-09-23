// Save ICS file
function saveICS(calName, ics) {
    // Create a dummy hidden link to download
    const link = document.createElement('a');
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar; charset=utf-8;' }));
    link.setAttribute('href', url);
    link.setAttribute('download', calName + '.ics');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    console.log("VIT Timetable Export Plugin : Exported as '" + calName + ".ics'");
}

// Generate ICS content from events
function generateICS(calName, events) {
    // Format copied from a Google Calendar export
    let ics =
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
    for (let i = 0; i < events.length; i++) {
        const event = events[i];
        ics +=
            'BEGIN:VEVENT\n' +
            'UID:' + simpleHash(event.summary + event.start + event.end) + '\n' +
            'DTSTAMP:' + getICSDate(new Date()) + '\n' +
            'DTSTART;TZID=Asia/Kolkata:' + event.start + '\n' +
            'DTEND;TZID=Asia/Kolkata:' + event.end + '\n' +
            'SUMMARY:' + event.summary + '\n';
        if (event.location != undefined) {
            ics += 'LOCATION:' + event.location + '\n';
        }
        if (event.description != undefined) {
            ics += 'DESCRIPTION:' + event.description + '\n';
        }
        ics += 'END:VEVENT\n';
    }
    ics += 'END:VCALENDAR\n';
    return ics;
}

// To create unique uid's for events - to avoid duplicates when importing again
// A simple hash from: https://gist.github.com/jlevy/c246006675becc446360a798e2b2d781
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
    }
    // Convert to 32bit unsigned integer in base 36 and pad with '0' to ensure length is 7.
    return (hash >>> 0).toString(36).padStart(7, '0');
};

// Get Javascript month index based on month string (eg: Aug or August returns 7)
function getMonthIndex(month) {
    return new Date(Date.parse(month + ' 1, 2024')).getMonth();
}

// Get ICS date and time format from Date object - YYYYMMDDTHHMMSS
function getICSDate(date) {
    return (
        date.getFullYear().toString() +
        (date.getMonth() + 1).toString().padStart(2, '0') +
        date.getDate().toString().padStart(2, '0') + 'T' +
        date.getHours().toString().padStart(2, '0') +
        date.getMinutes().toString().padStart(2, '0') + '00'
    );
}

//  Get ICS date only format from Date object - YYYYMMDD
function getICSDateOnly(date) {
    return (
        date.getFullYear().toString() +
        (date.getMonth() + 1).toString().padStart(2, '0') +
        date.getDate().toString().padStart(2, '0')
    );
}

// Get ICS date and time from separate Date object and time - YYYYMMDDTHHMMSS
function getICSDateTime(date, time) {
    return getICSDateOnly(date) + 'T' + time.replace(/:/g, '') + '00';
}

// Export ICS file from the Exam Schedule page
function exportExamScheduleICS() {
    const semSubId = document.getElementById('semesterSubId');
    const fTC = document.getElementById('fixedTableContainer');
    if (semSubId.value == '' || fTC == null) {
        return alert("Please choose the semster and click on 'Search'");
    }
    let events = [];
    const rows = document.querySelectorAll('#fixedTableContainer > table > tbody > tr.tableContent');
    for (let r = 0; r < rows.length; r++) {
        const cols = rows[r].cells;
        if (cols.length != 13) {
            continue;
        }
        const date = cols[6].innerText;
        if (date == '') {
            continue;
        }
        const [startTime, endTime] = cols[9].innerText.split(' - ');
        const summary = '(' + cols[3].innerText + ') ' + cols[2].innerText;
        const description =
            'Course Code: ' + cols[1].innerText + '\\n' +
            'Class ID: ' + cols[4].innerText + '\\n' +
            'Slot: ' + cols[5].innerText + '\\n' +
            'Seat Location: ' + cols[11].innerText + '\\n' +
            'Seat No: ' + cols[12].innerText
        ;
        const event = {
            summary: summary,
            description: description,
            location: cols[10].innerText,
            start: getICSDate(new Date(Date.parse(date + ' ' + startTime))),
            end: getICSDate(new Date(Date.parse(date + ' ' + endTime)))
        };
        events.push(event);
    }
    const semester = semSubId.options[semSubId.selectedIndex].innerText;
    const calName = 'VIT-Exam-Schedule-' + semester.replace(/ /g, '-');
    saveICS(calName, generateICS(calName, events));
}

// Generate Assignment Upload events and export ICS file
function generateAssignmentEventsAndExport(semester, courseAssignments) {
    let events = [];
    let dummyEventAdded = {};
    for (let i = 0; i < courseAssignments.length; i++) {
        const course = courseAssignments[i];
        for (let j = 0; j < course.assignments.length; j++) {
            const assignment = course.assignments[j];
            const summary = 'Assignment : (' + course.type + ') ' + course.title + ' - ' + assignment.title;
            const description =
                'Course Code: ' + course.code + '\\n' +
                'Course Title: ' + course.title + '\\n' +
                'Course Type: ' + course.type + '\\n' +
                'Assignment Title: ' + assignment.title;
            if (assignment.dueDate == '-') {
                continue;
            }
            const date = new Date(Date.parse(assignment.dueDate));
            const nextDate = new Date(date);
            nextDate.setDate(date.getDate() + 1);
            const event = {
                summary: summary,
                description: description,
                start: getICSDateOnly(date),
                end: getICSDateOnly(nextDate)
            };
            events.push(event);
            if (!(date in dummyEventAdded)) {
                // Add dummy event for IFTTT to trigger on event end and unmute
                const eventForIFTTT = {
                    summary: 'Dummy event to trigger IFTTT unmute for all day events',
                    start: getICSDateTime(date, '00:15'),
                    end: getICSDateTime(date, '00:30'),
                };
                events.push(eventForIFTTT);
                dummyEventAdded[date] = true;
            }
        }
    }
    const calName = 'VIT-Assignment-Upload-Schedule-' + semester.replace(/ /g, '-');
    saveICS(calName, generateICS(calName, events));
}

// Parse the course assignments displayed
function parseCourseAssignments() {
    const courseDetails = document.querySelector('#fixedTableContainer > table > tbody > tr.tableContent').cells;
    let courseAssignments = {
        code: courseDetails[1].innerText,
        title: courseDetails[2].innerText,
        type: courseDetails[3].innerText,
        assignments: []
    };
    const assignmentRows = document.querySelectorAll('#fixedTableContainer')[1].querySelectorAll('table > tbody> tr.tableContent');
    for (let r = 0; r < assignmentRows.length; r++) {
        const cols = assignmentRows[r].cells;
        courseAssignments.assignments.push({
            title: cols[1].innerText,
            dueDate: cols[4].innerText
        });
    }
    return courseAssignments;
}

// To navigate to Academics Calendar page:
//   document.querySelector('a[data-url="academics/common/CalendarPreview"]').click();
// Calling above leads to this error even though the navigation works:
//   Refused to run the JavaScript URL because it violates the following Content Security Policy directive: ...
// This is because of the href='javascript:void(0)' in the anchor tag
// We also need to know when the navigation is complete to make further changes
// We use a hack inspired by https://www.youtube.com/watch?v=HVugG0psJkM and combine this as follows:
//   window.onreset = callbackFunction;
//   element.setAttribute('onreset', clickAndCallbackCode());
//   element.dispatchEvent(new CustomEvent('reset'));
function clickAndCallbackCode() {
    return `
        $(document).ajaxStop(function () {
            $(this).unbind('ajaxStop');
            window.dispatchEvent(new CustomEvent('reset'));
        });
        this.click();
        this.removeAttribute('onreset');
    `;
}

// Export ICS file from the Assignment Upload page
function exportAssignmentUploadICS() {
    const semSubId = document.getElementById('semesterSubId');
    if (semSubId.value == '') {
        return alert('Please choose the semster');
    }
    const semester = semSubId.options[semSubId.selectedIndex].innerText;
    const dashboards = document.querySelectorAll('#fixedTableContainer > table > tbody > tr.tableContent button');
    // Function to click on each dashboard of course
    function selectDashboard(i) {
        dashboards[i].setAttribute('onreset', clickAndCallbackCode());
        dashboards[i].dispatchEvent(new CustomEvent('reset'));
    }
    let courseAssignments = [];
    let dashboardIndex = 0;
    // Callback after dashboard for course is displayed
    const afterDashboardDisplayed = function(event) {
        // Parse the displayed dashboard
        courseAssignments.push(parseCourseAssignments());
        if (dashboardIndex < dashboards.length - 1) {
            // Select the next dashboard of the next course
            selectDashboard(++dashboardIndex);
        } else {
            // All dashboards parsed
            window.onreset = null;
            // Return back to the main Assignment Upload page
            document.querySelector('#daUpload div[align=left] > button').click();
            // Generate Assignment Upload events and export ICS
            generateAssignmentEventsAndExport(semester, courseAssignments);
        }
    };
    window.onreset = afterDashboardDisplayed;
    selectDashboard(dashboardIndex);
}

// Verify that the class group is the same for all courses
function verifyAndGetClassGroup() {
    let cg = null;
    const table = document.querySelector('table');
    const rows = table.querySelectorAll('tr');
    for (let r = 1; r < rows.length - 1; r++) {
        const cols = rows[r].cells;
        if (cg == null) {
            cg = cols[1].innerText;
        }
        if (cols[1].innerText != cg) {
            return null;
        }
    }
    return cg;
}

// Timetable page - Parse the first table that has course details
function parseCourses() {
    let courses = {};
    const table = document.querySelector('table');
    const rows = table.querySelectorAll('tr');
    for (let i = 1; i < rows.length - 1; i++) {
        const cols = rows[i].cells;
        const course = cols[2].children[0].innerText; // 2nd column, first p tag
        let [id, name] = course.split('-'); // split id and name
        id = id.trim();
        courses[id] = {
            name: name.trim(),
            classGroup: cols[1].innerText,
            category: cols[4].innerText,
            classId: cols[6].innerText,
            slotVenue: cols[7].innerText.replace(/\r?\n/g, '').replace('-', '- '),
            faculty: cols[8].innerText.replace(/\r?\n/g, '').replace('-', '- ')
        };
    }
    return courses;
}

// Timetable page - Parse the main Timetable
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
        const cols = rows[r].cells;
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
    let day = '';
    // All other rows have weekday schedules
    for (let r = 4; r < rows.length; r++) {
        const tol = (r % 2 == 0) ? 0 : 1; // theory or lab
        let cs = tol ? 1 : 2; // fix column start
        const cols = rows[r].cells;
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
            if (events[day].length > 0) {
                const prevEvent = events[day][events[day].length - 1];
                if (prevEvent.id == event.id && prevEvent.type == event.type && prevEvent.venue == event.venue) {
                    // Merge consecutive slots of same course
                    prevEvent.end = event.end;
                    continue;
                }
            }
            events[day].push(event);
        }
    }
    return events;
}

// Academics Calendar page - Parse dispayed Academic Caldendar month
function parseACal() {
    let cal = {};
    // Parse all the columns of the calendar table
    const cols = document.querySelectorAll('#list-wrapper td');
    for (let c = 0; c < cols.length; c++) {
        const col = cols[c];
        const spans = col.querySelectorAll('span');
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

// Generate Timetable events as per Academic Calendar and export
function generateTTEventsAndExport(semester, courses, tt, ac) {
    let events = [];
    let dummyEventAdded = {};
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
                let dayEvents = tt[weekday];
                if (dayEvents.length == 0) {
                    // Check for any other weekday order
                    const i = detail.indexOf(' Day Order');
                    if (i != -1) {
                        weekday = detail.substring(1, i).substring(0, 3).toUpperCase();
                        dayEvents = tt[weekday];
                    }
                }
                // Add events for the weekday
                for (let i = 0; i < dayEvents.length; i++) {
                    const dayEvent = dayEvents[i];
                    const courseId = dayEvent.id;
                    const summary = '(' + dayEvent.type + ') ' + courses[courseId].name;
                    const description =
                        'Class Group: ' + courses[courseId].classGroup + '\\n' +
                        'Category: ' + courses[courseId].category + '\\n' +
                        'Class Id: ' + courses[courseId].classId + '\\n' +
                        'Slot/Venue: ' + courses[courseId].slotVenue + '\\n' +
                        'Faculty: ' + courses[courseId].faculty
                    const event = {
                        summary: summary,
                        description: description,
                        location: dayEvent.venue,
                        start: getICSDateTime(date, dayEvent.start),
                        end: getICSDateTime(date, dayEvent.end)
                    };
                    events.push(event);
                }
            }
            if (addFullDayEvent) {
                // Holidays, no instructional days, instructional days with more details
                const nextDate = new Date(date);
                nextDate.setDate(date.getDate() + 1);
                const event = {
                    summary: info + ' ' + detail,
                    start: getICSDateOnly(date),
                    end: getICSDateOnly(nextDate)
                };
                events.push(event);
                if (!(date in dummyEventAdded)) {
                    // Add dummy event for IFTTT to trigger on event end and unmute
                    const eventForIFTTT = {
                        summary: 'Dummy event to trigger IFTTT unmute for all day events',
                        start: getICSDateTime(date, '00:15'),
                        end: getICSDateTime(date, '00:30'),
                    };
                    events.push(eventForIFTTT);
                }
            }
        }
    }
    const calName = 'VIT-' + semester.replace(/ /g, '-');
    saveICS(calName, generateICS(calName, events));
}

// Export ICS file from the Time Table page
function exportTimeTableICS() {
    const semSubId = document.getElementById('semesterSubId');
    if (semSubId.value == '') {
        return alert('Please choose the semster');
    }
    const cg = verifyAndGetClassGroup();
    if (cg == null) {
        return alert('Only a single common Class Group is currently supported');
    }
    const semId = semSubId.options[semSubId.selectedIndex].value;
    const semester = semSubId.options[semSubId.selectedIndex].innerText;
    const courses = parseCourses();
    const tt = parseTT();
    function parseACalMonths() {
        // Callback after Class Group is updated
        const afterClassGroupUpdated = function () {
            const months = document.querySelectorAll('#getListForSemester a');
            // Function to click on each month of the academic calendar
            function selectMonth(i) {
                months[i].setAttribute('onreset', clickAndCallbackCode());
                months[i].dispatchEvent(new CustomEvent('reset'));
            }
            let ac = {}
            let monthIndex = 0;
            // Callback after academic calendar for month is displayed
            const afterMonthDisplayed = function(event) {
                const month = months[monthIndex].innerText;
                // Parse the displayed month
                ac[month] = parseACal();
                if (monthIndex < months.length - 1) {
                    // Select the next month in the academic calendar
                    selectMonth(++monthIndex);
                } else {
                    // All months parsed
                    window.onreset = null;
                    // Generate Timetable events and export ICS
                    generateTTEventsAndExport(semester, courses, tt, ac);
                }
            };
            window.onreset = afterMonthDisplayed;
            selectMonth(monthIndex);
        }
        // Callback after semester is updated
        const afterSemesterUpdated = function () {
            const cgId = document.getElementById('classGroupId');
            for (let i = 0; i < cgId.options.length; i++) {
                if (cgId.options[i].innerText == cg) {
                    cgId.options[i].selected = true;
                    break;
                }
            }
            window.onreset = afterClassGroupUpdated;
            // Change Class Group as per Timetable page
            cgId.setAttribute('onreset', clickAndCallbackCode());
            cgId.dispatchEvent(new CustomEvent('reset'));
            cgId.dispatchEvent(new CustomEvent('change'));
        }
        window.onreset = afterSemesterUpdated;
        // Change semester as per Timetable page
        const aCalSemId = document.getElementById('semesterSubId');
        aCalSemId.setAttribute('onreset', clickAndCallbackCode());
        aCalSemId.dispatchEvent(new CustomEvent('reset'));
        aCalSemId.selectedIndex = document.querySelector('#semesterSubId option[value=' + semId + ']').index;
        aCalSemId.dispatchEvent(new CustomEvent('change'));
    }
    // Navigate to Academics Calendar page
    window.onreset = parseACalMonths;
    const link = document.querySelector('a[data-url="academics/common/CalendarPreview"]');
    link.setAttribute('onreset', clickAndCallbackCode());
    link.dispatchEvent(new CustomEvent('reset'));
}

// Mask to hide student details on top right corner
function toggleStudentMask() {
    const studentMask = document.querySelector('#studentMask');
    if (studentMask) {
        studentMask.remove();
    } else {
        const mask = '<div id="studentMask" style="border-radius:10px;width:115px;height:42px;background-color:black;position:absolute;top:4px;right:105px"></div>';
        document.querySelector('#vtopHeaderBarControl').insertAdjacentHTML('beforeend', mask);
    }
}

// Export ICS file depending on the current page
function exportICS() {
    if (document.getElementById('examSchedule') != null) {
        return exportExamScheduleICS();
    }
    if (document.getElementById('digitalAssignment') != null) {
        return exportAssignmentUploadICS();
    }
    if (document.getElementById('studentTimeTable') != null) {
        return exportTimeTableICS();
    }
    alert(
        'ICS Files can be exported from the following pages:\n' +
        '  - Academics > Time Table\n' +
        '  - Academics > Digital Assignment Upload\n' +
        '  - Examination > Exam Schedule\n'
    );
}

// This is the entry point
exportICS();
