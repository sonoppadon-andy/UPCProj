/**
 * Google Apps Script backend for index-google-sheets.html
 *
 * 1) Create a Google Sheet.
 * 2) Extensions > Apps Script, paste this file.
 * 3) Set SPREADSHEET_ID below.
 * 4) Run setupSheets() once and authorize.
 * 5) Deploy > New deployment > Web app.
 *    Execute as: Me
 *    Who has access: Anyone (or your organization, if all users are signed in)
 */

const SPREADSHEET_ID = 'PASTE_GOOGLE_SHEET_ID_HERE';
const RUNS_SHEET = 'Runs';
const PASSWORDS_SHEET = 'Passwords';
const TEAMS_SHEET = 'Teams';
const PHOTO_FOLDER_NAME = 'Team Run Evidence Photos';

function setupSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  ensureSheet_(ss, RUNS_SHEET, ['id', 'name', 'team', 'distance', 'date', 'photo', 'ts']);
  ensureSheet_(ss, PASSWORDS_SHEET, ['name', 'password']);
  ensureSheet_(ss, TEAMS_SHEET, ['name', 'team']);
  getPhotoFolder_();
}

function doGet() {
  return json_({ok: true, data: {message: 'Team Run API is ready'}});
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const request = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    let data;

    switch (request.action) {
      case 'loadAll':
        data = loadAll_();
        break;
      case 'replacePersonRuns':
        data = replacePersonRuns_(String(request.name || '').trim(), request.runs || []);
        break;
      case 'savePasswords':
        saveMap_(PASSWORDS_SHEET, request.passwords || {}, 'password');
        data = true;
        break;
      case 'saveTeams':
        saveMap_(TEAMS_SHEET, request.teams || {}, 'team');
        data = true;
        break;
      default:
        throw new Error('Unknown action: ' + request.action);
    }

    return json_({ok: true, data: data});
  } catch (err) {
    return json_({ok: false, error: err.message || String(err)});
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function loadAll_() {
  return {
    runs: readRuns_(),
    passwords: readMap_(PASSWORDS_SHEET, 'password'),
    teams: readMap_(TEAMS_SHEET, 'team')
  };
}

function readRuns_() {
  const sh = getSheet_(RUNS_SHEET);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];

  return values.slice(1).filter(r => r[0]).map(r => ({
    id: String(r[0]),
    name: String(r[1]),
    team: String(r[2] || ''),
    distance: Number(r[3] || 0),
    date: formatDateCell_(r[4]),
    photo: String(r[5] || '') || null,
    ts: Number(r[6] || 0)
  }));
}

function replacePersonRuns_(name, personRuns) {
  if (!name) throw new Error('Name is required');
  if (!Array.isArray(personRuns)) throw new Error('Runs must be an array');

  const sh = getSheet_(RUNS_SHEET);
  const existing = readRuns_().filter(r => r.name !== name);
  const normalized = personRuns.map(r => normalizeRun_(r, name));
  const all = existing.concat(normalized);

  sh.clearContents();
  sh.getRange(1, 1, 1, 7).setValues([['id', 'name', 'team', 'distance', 'date', 'photo', 'ts']]);
  if (all.length) {
    sh.getRange(2, 1, all.length, 7).setValues(all.map(r => [
      r.id, r.name, r.team || '', Number(r.distance), r.date, r.photo || '', Number(r.ts)
    ]));
  }
  sh.setFrozenRows(1);
  return normalized;
}

function normalizeRun_(run, forcedName) {
  const output = {
    id: String(run.id || ('r' + Date.now() + Math.random().toString(36).slice(2, 7))),
    name: forcedName,
    team: String(run.team || ''),
    distance: Number(run.distance || 0),
    date: String(run.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')),
    photo: run.photo ? String(run.photo) : null,
    ts: Number(run.ts || Date.now())
  };
  if (!(output.distance > 0)) throw new Error('Distance must be greater than zero');
  if (output.photo && output.photo.indexOf('data:image/') === 0) {
    output.photo = saveBase64Image_(output.photo, output.id + '.jpg');
  }
  return output;
}

function saveBase64Image_(dataUrl, filename) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error('Invalid image data');
  const blob = Utilities.newBlob(Utilities.base64Decode(match[2]), match[1], filename);
  const file = getPhotoFolder_().createFile(blob);
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (_) {
    // Some Google Workspace policies block public link sharing.
    // In that case, signed-in users with permission to the file can still open it.
  }
  return 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w1000';
}

function readMap_(sheetName, valueHeader) {
  const sh = getSheet_(sheetName);
  const values = sh.getDataRange().getValues();
  const result = {};
  if (values.length < 2) return result;
  values.slice(1).forEach(row => {
    const name = String(row[0] || '').trim();
    if (name) result[name] = String(row[1] || '');
  });
  return result;
}

function saveMap_(sheetName, map, valueHeader) {
  const sh = getSheet_(sheetName);
  const rows = Object.keys(map).sort().map(name => [name, String(map[name] || '')]);
  sh.clearContents();
  sh.getRange(1, 1, 1, 2).setValues([['name', valueHeader]]);
  if (rows.length) sh.getRange(2, 1, rows.length, 2).setValues(rows);
  sh.setFrozenRows(1);
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  sh.setFrozenRows(1);
  return sh;
}

function getSheet_(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  return ensureSheet_(ss, name, name === RUNS_SHEET
    ? ['id', 'name', 'team', 'distance', 'date', 'photo', 'ts']
    : name === PASSWORDS_SHEET ? ['name', 'password'] : ['name', 'team']);
}

function getPhotoFolder_() {
  const props = PropertiesService.getScriptProperties();
  const savedId = props.getProperty('PHOTO_FOLDER_ID');
  if (savedId) {
    try { return DriveApp.getFolderById(savedId); } catch (_) {}
  }
  const folders = DriveApp.getFoldersByName(PHOTO_FOLDER_NAME);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(PHOTO_FOLDER_NAME);
  props.setProperty('PHOTO_FOLDER_ID', folder.getId());
  return folder;
}

function formatDateCell_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(value || '');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
