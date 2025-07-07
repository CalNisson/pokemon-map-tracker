let loadfile_selector;

function ShowConfig() {
    html.config.window.classList.remove("window_hidden");
    HideConfigNetwork();
}
function HideConfig() {
    html.config.window.classList.add("window_hidden");
}
function ShowHelp() {
    html.help.window.classList.remove("window_hidden");
}
function HideHelp() {
    html.help.window   .classList.add("window_hidden");
    html.help.changelog.classList.remove("config_hidden");
    for (let t of html.help.versions) {
        t.classList.remove("config_hidden");
    }
}

function LoadFile() { loadfile_selector.click(); }

function FileUploaded(event) {
    let reader = new FileReader();
    reader.onload = function() {
        let lines = reader.result.split("\n");

        // First parse progress trackers as before
        while (lines.length > 0 && lines[0].startsWith("#") && !lines[0].startsWith("#ENCOUNTERS")) { 
            let fields = lines[0].split(",");
            let current_game = games[fields[0].substring(1, fields[0].length)];
            fields.shift();
            current_game.obtained.clear();
            for (let p of fields) {
                current_game.obtained.add(p);
            }
            lines.shift();
        }

        // Next, separate encounter lines starting at #ENCOUNTERS marker
        let encounterStartIndex = lines.findIndex(line => line.trim() === "#ENCOUNTERS");
        let warpLines = [];
        let encounterLines = [];

        if (encounterStartIndex >= 0) {
            warpLines = lines.slice(0, encounterStartIndex);
            encounterLines = lines.slice(encounterStartIndex + 1);
        } else {
            warpLines = lines;
        }

        // Parse warps as before
        LinesToWarps(warpLines);

        // Parse encounters if any
        if (encounterLines.length > 0) {
            populateEncounterTable(encounterLines);
        }

        // Sync with connections if connected
        if (connected_to || connections.length > 0) {
            let text = lines.join("\n");
            if (connected_to) {
                connected_to.send(text);
            }
            else {
                for (let c of connections) {
                    c.connection.send(text);
                }
            }
        }

        RerenderAll();
    }
    reader.readAsText(loadfile_selector.files[0]);
}

function populateEncounterTable(encounterLines) {
    const tbody = document.querySelector("#encounter-table tbody");
    if (!tbody) return;
    tbody.innerHTML = ""; // clear existing rows

    for (let line of encounterLines) {
        if (line.trim().length === 0) continue;
        let parts = line.split(",");
        if (parts.length < 4) {
            console.warn("Skipping invalid encounter line:", line);
            continue;
        }
        let [location, encounter, nickname, status] = parts;

        let row = document.createElement("tr");

        let locCell = document.createElement("td");
        locCell.textContent = location;
        row.appendChild(locCell);

        let encCell = document.createElement("td");
        let encInput = document.createElement("input");
        encInput.type = "text";
        encInput.setAttribute("list", "pokemon-list"); // your datalist if exists
        encInput.value = encounter;
        encCell.appendChild(encInput);
        row.appendChild(encCell);

        let nickCell = document.createElement("td");
        let nickInput = document.createElement("input");
        nickInput.type = "text";
        nickInput.value = nickname;
        nickCell.appendChild(nickInput);
        row.appendChild(nickCell);

        let statCell = document.createElement("td");
        let statSelect = document.createElement("select");

        // Assuming STATUSES is defined globally as your status options array
        for (let s of STATUSES) {
            let opt = document.createElement("option");
            opt.value = s;
            opt.textContent = s;
            if (s === status) opt.selected = true;
            statSelect.appendChild(opt);
        }
        statCell.appendChild(statSelect);
        row.appendChild(statCell);

        tbody.appendChild(row);
    }
}


function SaveFile() {
    let text = "";
    for (let key_game in games) {
        if (!games[key_game].ready) { continue; }
        
        text += "#" + games[key_game].name + ",";
        for (let p of games[key_game].obtained) {
            text += p + ",";
        }
        text = text.substring(0, text.length-1);
        text += "\n";
    }
    for (let key_game in games) {
        if (!games[key_game].ready) { continue; }

        text += WarpsToText(games[key_game]);
    }

    // Add Encounter Tracker data here as CSV after a special marker
    text += "#ENCOUNTERS\n";
    const encounters = collectEncounterData();
    for (let e of encounters) {
        // CSV line: location,encounter,nickname,status
        text += `${e.location},${e.encounter},${e.nickname},${e.status}\n`;
    }

    if (text.length == 0) {
        alert("There's nothing to save.");
        return;
    }

    let time = new Date();
    let d = time.getFullYear() + "-" + (time.getMonth()+1) + "-" + time.getDate() + "_" + time.getHours() + "." + time.getMinutes() + "." + time.getSeconds();
    let a = document.createElement("a");
    a.href = window.URL.createObjectURL(new Blob([text], {type: "text/plain"}));
    a.download = d + "_" + TRACKER_NAME + ".txt";
    a.click();
}

// Helper to collect encounter rows from the table
function collectEncounterData() {
    const tbody = document.querySelector("#encounter-table tbody");
    if (!tbody) return [];
    const encounters = [];

    for (let row of tbody.rows) {
        let cells = row.cells;
        encounters.push({
            location: cells[0].textContent.trim(),
            encounter: cells[1].querySelector('input')?.value.trim() || "",
            nickname: cells[2].querySelector('input')?.value.trim() || "",
            status: cells[3].querySelector('select')?.value || ""
        });
    }
    return encounters;
}

function WarpsToText (current_game) {
    let text = "";
    for (let key_location in current_game.warps) {
        if (!current_game.warps[key_location]) continue;

        for (let key_warp in current_game.warps[key_location]) {
            let warp = current_game.warps[key_location][key_warp];
            if (!warp) continue;

            text += current_game.name + "," + key_location + "," + key_warp + ",";
            if (warp.link_type) text += warp.link_type;
            text += ",";
            if (warp.link_location) text += warp.link_location;
            text += ",";
            if (warp.link) text += warp.link;
            text += ",";
            if (warp.modifier && warp.modifier != "null") text += warp.modifier;
            text += "\n";
        }
    }
    return text;
}
function LinesToWarps (lines) {
    for (let line of lines) {
        if (line.length == 0) continue;

        let f = line.split(",");
        if (f.length < 6) {
            console.error("ERROR: Invalid line in save file: " + line);
            continue;
        }
        
        ChangeWarpOffline(games[f[0]], f[1], f[2], f[3], f[4], f[5], f[6]);
    }
}

function ResetButton() {
    if (confirm ("You and ALL connected users will lose all data. Are you sure to continue?")) {
        ResetTracker();

        if (connected_to || connections.length > 0) {
            if (connected_to) {
                connected_to.send(RESET_MESSAGE);
            }
            else {
                for (let c of connections) {
                    c.connection.send(RESET_MESSAGE);
                }
            }
        }
    }
}

function InitTrackerToUnknowns() {
    for (let key_game in games) {
        // assuming these are always being tracked
        if (games[key_game].is_item_tracker) {
            games[key_game].unknown_marks = {
                unknown:           games[key_game].marks[0][0],
                corridor:          games[key_game].marks[0][1],
                
                item_overworld:    games[key_game].marks[1][0],
                item_event:        games[key_game].marks[1][2],
                item_surf:         games[key_game].marks[1][3],
                item_cut:          games[key_game].marks[1][4],
                item_strength:     games[key_game].marks[1][5],
                item_rocksmash:    games[key_game].marks[1][6],
                item_whirl:        games[key_game].marks[1][7],
                item_basement_key: games[key_game].marks[1][8],
                item_phone:        games[key_game].marks[1][9],
            }
        }
        else {
            games[key_game].unknown_marks = {
                unknown:           games[key_game].marks[0][0],
                corridor:          games[key_game].marks[0][1],
            }

        }
        let marks = games[key_game].unknown_marks;
        for (let key in marks) {
            marks[key][1] = 0;
        }
        for (let key_location in games[key_game].warps) {
            for (let key_warp in games[key_game].warps[key_location]) {
                let w = games[key_game].warps[key_location][key_warp];
                w.link_type = LINKTYPE_MARK;
                w.modifier  = null;

                if (w.corridor) {
                    w.link = "corridor";
                    marks.corridor[1] += 1;
                    continue;
                }
                
                if (w.item) {
                    let name = "item_" + w.item;
                    if (!marks["item_" + w.item]) {
                        name = "item_event";
                    }
                    w.link = name;
                    marks[name][1] += 1;
                    continue;
                }

                w.link = "unknown";
                marks.unknown[1] += 1;
            }
        }
    }
}
function ResetTracker() {
    for (let key_game in games) {
        for (let array of [games[key_game].marks, games[key_game].progress, games[key_game].modifiers]) {
            for (let row of array) {
                for (let element of row) {
                    if (element[1] !== undefined && element[1] !== null) {
                        element[1] = 0;
                    }
                }
            }
        }
        games[key_game].obtained = new Set();
    }
    InitTrackerToUnknowns();
    RerenderAll();
}

function ChangeSmooth(checked) {
    localStorage.setItem(CACHE.SMOOTH_IMAGES, checked);
    RerenderLayer(LAYER_LOCATION);
}
function ChangeKeyboardControls(checked) { localStorage.setItem(CACHE.KEYBOARD_DISABLED, checked); }
function ChangeTooltips(checked)         { localStorage.setItem(CACHE.TOOLTIPS_DISABLED, checked); }
function ChangeFitToScreen(checked) {
    localStorage.setItem(CACHE.FIT_TO_SCREEN, checked);
    SetCanvasDimensions();
}


function ResetColor() { ChangeLineColor(DEFAULT_COLOR); }
function ChangeLineColor(color) {
    localStorage.setItem(CACHE.LINE_COLOR, color);
    line_color = color;
    html.config.line_color.value = color;
}

function ChangeGame(new_game) {
    if (!game.ready) return; // Return if game is being loaded
    game.button.disabled = false;
    game = new_game;
    game.button.disabled = true;
    localStorage.setItem(CACHE.GAME_LOADED, game.name);

    current_state = STATE_DEFAULT;
    current_location = game.start_location;
    left_click  = { down: false };
    right_click = { down: false };
    current_markcycle = undefined;

    RerenderAll();
    if (!game.ready) {
        LoadImages();
    }
    else {
        SetDimensions();
    }
}