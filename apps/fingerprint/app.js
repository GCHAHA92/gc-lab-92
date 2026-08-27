const $ = (selector) => document.querySelector(selector);
const TARGETS = [7 * 60, 10 * 60, 13 * 60, 16 * 60, 19 * 60];
const WINDOW_MINUTES = 10;

let files = { attendance: null, fingerprint: null };
let analysis = null;
let activeFilter = "failed";
let searchText = "";
let sortState = { key: "name", direction: 1 };

function normalizeText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeName(value) {
  return normalizeText(value);
}

function normalizeHeader(value) {
  return normalizeText(value).replace(/\s/g, "");
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatMinutes(minutes) {
  return `${pad(Math.floor(minutes / 60) % 24)}:${pad(Math.floor(minutes % 60))}`;
}

function formatDateKey(key) {
  return key && key.length === 8 ? `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}` : key;
}

function nextDateKey(key) {
  if (!key || key.length !== 8) return "";
  const date = new Date(Number(key.slice(0, 4)), Number(key.slice(4, 6)) - 1, Number(key.slice(6, 8)) + 1);
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

function displayTime(value) {
  return value == null ? "없음" : formatMinutes(value);
}

function toDateKey(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}${pad(value.getMonth() + 1)}${pad(value.getDate())}`;
  }
  const text = normalizeText(value);
  const compact = text.replace(/\D/g, "");
  if (compact.length >= 8) return compact.slice(0, 8);
  return "";
}

function toMinutes(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getHours() * 60 + value.getMinutes();
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= 0 && value < 1) return Math.round(value * 24 * 60);
    const rounded = Math.round(value);
    const hour = Math.floor(rounded / 100);
    const minute = rounded % 100;
    if (hour <= 47 && minute < 60) return hour * 60 + minute;
  }
  const text = normalizeText(value);
  const colon = text.match(/(\d{1,2})\s*:\s*(\d{2})/);
  if (colon) return Number(colon[1]) * 60 + Number(colon[2]);
  const digits = text.replace(/\D/g, "");
  if (!digits) return null;
  const padded = digits.padStart(4, "0").slice(-4);
  const hour = Number(padded.slice(0, 2));
  const minute = Number(padded.slice(2));
  return hour <= 47 && minute < 60 ? hour * 60 + minute : null;
}

function parseEventDateTime(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return {
      date: `${value.getFullYear()}${pad(value.getMonth() + 1)}${pad(value.getDate())}`,
      minutes: value.getHours() * 60 + value.getMinutes(),
      time: `${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`,
    };
  }
  const text = normalizeText(value);
  const match = text.match(/(\d{4})[-/.]?(\d{2})[-/.]?(\d{2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] || 0);
  return {
    date: `${match[1]}${match[2]}${match[3]}`,
    minutes: hour * 60 + minute,
    time: `${pad(hour)}:${pad(minute)}:${pad(second)}`,
  };
}

function findHeaderRow(rows, requiredHeaders) {
  return rows.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    return requiredHeaders.every((header) => headers.includes(header));
  });
}

function findColumn(headers, candidates) {
  const normalized = headers.map(normalizeHeader);
  return candidates.map(normalizeHeader).map((candidate) => normalized.indexOf(candidate)).find((index) => index >= 0) ?? -1;
}

async function readRows(file) {
  if (typeof XLSX === "undefined") throw new Error("엑셀 처리 모듈을 불러오지 못했습니다. 인터넷 연결을 확인해주세요.");
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
}

function parseAttendance(rows) {
  const headerRow = findHeaderRow(rows, ["고유식별번호", "근무일자", "출근시간", "퇴근시간"]);
  if (headerRow < 0) throw new Error("출퇴근시간 파일에서 필수 열을 찾지 못했습니다.");
  const headers = rows[headerRow];
  const idCol = findColumn(headers, ["고유식별번호", "식별번호"]);
  const dateCol = findColumn(headers, ["근무일자", "일자", "근무일"]);
  const startCol = findColumn(headers, ["출근시간", "출근"]);
  const endCol = findColumn(headers, ["퇴근시간", "퇴근"]);
  let nameCol = findColumn(headers, ["이름", "성명", "직원명", "근무자"]);

  if (nameCol < 0) {
    const firstCandidate = Math.max(idCol, dateCol, startCol, endCol) + 1;
    let best = { column: firstCandidate, score: -1 };
    for (let column = firstCandidate; column < Math.min(firstCandidate + 4, headers.length); column += 1) {
      const score = rows.slice(headerRow + 1, headerRow + 31).filter((row) => {
        const value = normalizeText(row[column]);
        return value && /[가-힣A-Za-z]/.test(value);
      }).length;
      if (score > best.score) best = { column, score };
    }
    nameCol = best.column;
  }

  const records = rows.slice(headerRow + 1).map((row, index) => {
    const id = normalizeText(row[idCol]);
    const date = toDateKey(row[dateCol]);
    const start = toMinutes(row[startCol]);
    const end = toMinutes(row[endCol]);
    const name = normalizeName(row[nameCol]);
    return { sourceRow: headerRow + index + 2, id, date, start, end, name };
  }).filter((row) => row.id && row.date && row.name);

  if (!records.length) throw new Error("출퇴근시간 파일에서 점검할 근무내역을 찾지 못했습니다.");
  return records;
}

function parseFingerprints(rows) {
  const headerRow = findHeaderRow(rows, ["발생시각", "이름"]);
  if (headerRow < 0) throw new Error("지문내역 파일에서 발생시각·이름 열을 찾지 못했습니다.");
  const headers = rows[headerRow];
  const dateTimeCol = findColumn(headers, ["발생시각", "인식시각", "일시"]);
  const nameCol = findColumn(headers, ["이름", "성명"]);
  const statusCol = findColumn(headers, ["상태", "구분"]);
  const deviceCol = findColumn(headers, ["장치명", "장소", "위치"]);
  const map = new Map();
  const dates = new Set();
  let eventCount = 0;

  for (const row of rows.slice(headerRow + 1)) {
    const event = parseEventDateTime(row[dateTimeCol]);
    const name = normalizeName(row[nameCol]);
    if (!event || !name) continue;
    const status = statusCol >= 0 ? normalizeText(row[statusCol]) : "지문";
    const device = deviceCol >= 0 ? normalizeText(row[deviceCol]) : "";
    const key = `${event.date}|${name}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({ ...event, status, device });
    dates.add(event.date);
    eventCount += 1;
  }

  if (!eventCount) throw new Error("지문내역 파일에서 인식기록을 찾지 못했습니다.");
  map.forEach((events) => events.sort((a, b) => a.minutes - b.minutes));
  return { map, dates, eventCount };
}

function boundaryCheck(record, fingerprints, kind) {
  const expected = kind === "start" ? record.start : record.end;
  const prefix = kind === "start" ? "출근" : "퇴근";
  const overnight = record.start != null && record.end != null && record.end < record.start;
  const eventDate = kind === "end" && overnight ? nextDateKey(record.date) : record.date;
  const sourceAvailable = fingerprints.dates.has(eventDate);
  const events = fingerprints.map.get(`${eventDate}|${record.name}`) || [];
  const candidates = events.filter((event) => event.status.startsWith(prefix));
  const actual = kind === "start" ? candidates[0] || null : candidates[candidates.length - 1] || null;

  if (expected == null) return { kind, ok: false, state: "missingValue", expected, actual, eventDate, sourceAvailable };
  if (!sourceAvailable) return { kind, ok: false, state: "dataNeeded", expected, actual, eventDate, sourceAvailable };
  if (!actual) return { kind, ok: false, state: "missingEvent", expected, actual, eventDate, sourceAvailable };
  if (actual.minutes !== expected) return { kind, ok: false, state: "mismatch", expected, actual, eventDate, sourceAvailable };
  return { kind, ok: true, state: "ok", expected, actual, eventDate, sourceAvailable };
}

function compare(attendance, fingerprints) {
  const rows = attendance.map((record) => {
    const canCheckMiddle = record.start != null && record.end != null;
    const adjustedEnd = canCheckMiddle && record.end < record.start ? record.end + 24 * 60 : record.end;
    const events = fingerprints.map.get(`${record.date}|${record.name}`) || [];
    const checks = TARGETS.map((target) => {
      const required = canCheckMiddle && record.start <= target + WINDOW_MINUTES && adjustedEnd >= target - WINDOW_MINUTES;
      const matches = required
        ? events.filter((event) => Math.abs(event.minutes - target) <= WINDOW_MINUTES)
        : [];
      const closest = matches.slice().sort((a, b) => Math.abs(a.minutes - target) - Math.abs(b.minutes - target))[0] || null;
      return { target, evaluable: canCheckMiddle, required, ok: canCheckMiddle && (!required || matches.length > 0), closest, matches };
    });
    const startCheck = boundaryCheck(record, fingerprints, "start");
    const endCheck = boundaryCheck(record, fingerprints, "end");
    const middleMissingCount = checks.filter((check) => check.required && !check.ok).length;
    const boundaryIssueCount = [startCheck, endCheck].filter((check) => !check.ok && check.state !== "dataNeeded").length;
    const dataNeededCount = [startCheck, endCheck].filter((check) => check.state === "dataNeeded").length;
    const middleOk = canCheckMiddle && checks.every((check) => check.ok);
    const ok = middleOk && startCheck.ok && endCheck.ok;
    return {
      ...record,
      checks,
      startCheck,
      endCheck,
      canCheckMiddle,
      middleOk,
      ok,
      middleMissingCount,
      missingCount: middleMissingCount,
      requiredCount: checks.filter((check) => check.required).length,
      boundaryIssueCount,
      dataNeededCount,
    };
  });

  return {
    rows,
    totalCount: rows.length,
    passCount: rows.filter((row) => row.ok).length,
    failCount: rows.filter((row) => !row.ok).length,
    requiredCount: rows.reduce((sum, row) => sum + row.requiredCount, 0),
    missingCount: rows.reduce((sum, row) => sum + row.missingCount, 0),
    middleMissingPersonCount: new Set(
      rows.filter((row) => row.missingCount > 0).map((row) => row.id || row.name),
    ).size,
    middleFailCount: rows.filter((row) => !row.middleOk).length,
    boundaryIssueCount: rows.filter((row) => row.boundaryIssueCount > 0).length,
    dataNeededCount: rows.filter((row) => row.dataNeededCount > 0).length,
    fingerprintCount: fingerprints.eventCount,
  };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function checkCell(check) {
  if (!check.evaluable) return '<span class="check need">판정불가</span>';
  if (!check.required) return '<span class="check na">—</span>';
  if (!check.ok) return '<span class="check fail">누락</span>';
  const event = check.closest;
  const details = check.matches.map((item) => `${item.time} ${item.status}${item.device ? ` / ${item.device}` : ""}`).join("\n");
  return `<span class="check pass" title="${escapeHtml(details)}">${escapeHtml(event.time.slice(0, 5))}</span>`;
}

function boundaryMethod(check) {
  if (!check.actual) return "";
  if (check.actual.status.includes("카드")) return "카드";
  if (check.actual.status.includes("지문")) return "지문";
  return check.actual.status;
}

function boundaryCell(check) {
  const label = check.kind === "start" ? "출근" : "퇴근";
  if (check.state === "missingValue") return `<span class="check fail">ERP ${label}시간 없음</span>`;
  if (check.state === "dataNeeded") return `<span class="check need" title="${formatDateKey(check.eventDate)} 기록이 필요합니다.">익일자료 필요</span>`;
  if (check.state === "missingEvent") return `<span class="check fail">${label}기록 없음</span>`;
  const details = `${check.actual.time} ${check.actual.status}${check.actual.device ? ` / ${check.actual.device}` : ""}`;
  if (check.state === "mismatch") return `<span class="check fail" title="${escapeHtml(details)}">불일치 ${escapeHtml(check.actual.time.slice(0, 5))}</span>`;
  return `<span class="check pass boundary" title="${escapeHtml(details)}">${escapeHtml(check.actual.time.slice(0, 5))} ${escapeHtml(boundaryMethod(check))}</span>`;
}

function filteredRows() {
  if (!analysis) return [];
  const filtered = analysis.rows.filter((row) => {
    if (activeFilter === "failed" && row.ok) return false;
    if (activeFilter === "passed" && !row.ok) return false;
    return !searchText || row.name.toLocaleLowerCase("ko").includes(searchText);
  });
  const direction = sortState.direction;
  return filtered.sort((a, b) => {
    let left;
    let right;
    if (sortState.key === "date") { left = a.date; right = b.date; }
    else if (sortState.key === "work") { left = a.start ?? Number.MAX_SAFE_INTEGER; right = b.start ?? Number.MAX_SAFE_INTEGER; }
    else if (sortState.key === "status") { left = a.ok ? 1 : 0; right = b.ok ? 1 : 0; }
    else { left = a.name; right = b.name; }
    return typeof left === "number" ? (left - right) * direction : String(left).localeCompare(String(right), "ko") * direction;
  });
}

function renderTable() {
  const rows = filteredRows();
  $("#resultBody").innerHTML = rows.length ? rows.map((row) => `
    <tr class="${row.ok ? "passed" : "failed"}">
      <td>${escapeHtml(row.name)}</td>
      <td>${formatDateKey(row.date)}</td>
      <td>${displayTime(row.start)}~${displayTime(row.end)}</td>
      <td>${boundaryCell(row.startCheck)}</td>
      <td>${boundaryCell(row.endCheck)}</td>
      ${row.checks.map(checkCell).map((cell) => `<td>${cell}</td>`).join("")}
      <td><span class="status-pill ${row.ok ? "ok" : row.dataNeededCount ? "need" : "fail"}">${row.ok ? "정상" : row.boundaryIssueCount + row.missingCount > 0 ? `확인 ${row.boundaryIssueCount + row.missingCount}` : "자료 필요"}</span></td>
    </tr>`).join("") : '<tr><td colspan="11" class="empty">조건에 맞는 결과가 없습니다.</td></tr>';
  $("#rowNote").textContent = `현재 ${rows.length.toLocaleString()}명 표시 · 출퇴근은 첫 출근·마지막 퇴근 기록을 비교하며 지문과 카드를 모두 인정합니다.`;
}

function render() {
  $("#totalCount").textContent = analysis.totalCount.toLocaleString();
  $("#passCount").textContent = analysis.passCount.toLocaleString();
  $("#failCount").textContent = analysis.failCount.toLocaleString();
  $("#missingCount").textContent = analysis.middleMissingPersonCount.toLocaleString();
  $("#boundaryCount").textContent = analysis.boundaryIssueCount.toLocaleString();
  $("#dataNeededCount").textContent = analysis.dataNeededCount.toLocaleString();
  $("#notice").className = "notice ok";
  $("#notice").textContent = `점검 완료: ${analysis.totalCount.toLocaleString()}명 중 ${analysis.failCount.toLocaleString()}명 확인 필요 · 중간지문 누락 ${analysis.middleMissingPersonCount.toLocaleString()}명 · 출퇴근 확인 ${analysis.boundaryIssueCount.toLocaleString()}명`;
  $("#results").classList.remove("hidden");
  renderTable();
  $("#results").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function runAnalysis() {
  if (!files.attendance || !files.fingerprint) return;
  $("#run").disabled = true;
  $("#notice").className = "notice";
  $("#notice").textContent = "두 파일을 읽고 지문기록을 비교하고 있습니다...";
  try {
    const [attendanceRows, fingerprintRows] = await Promise.all([readRows(files.attendance), readRows(files.fingerprint)]);
    const attendance = parseAttendance(attendanceRows);
    const fingerprints = parseFingerprints(fingerprintRows);
    analysis = compare(attendance, fingerprints);
    render();
  } catch (error) {
    $("#notice").className = "notice error";
    $("#notice").textContent = error.message || "파일을 점검하지 못했습니다.";
    $("#results").classList.add("hidden");
  } finally {
    $("#run").disabled = false;
  }
}

function setFile(kind, file) {
  if (!file) return;
  analysis = null;
  $("#results").classList.add("hidden");
  files[kind] = file;
  const prefix = kind === "attendance" ? "attendance" : "fingerprint";
  $(`#${prefix}Label`).textContent = file.name;
  $(`#${prefix}Drop`).classList.add("ready");
  $("#run").disabled = !(files.attendance && files.fingerprint);
  $("#notice").className = "notice";
  $("#notice").textContent = files.attendance && files.fingerprint ? "두 파일이 준비되었습니다. 비교하기를 눌러주세요." : "나머지 파일도 선택해주세요.";
}

function setupUpload(kind, inputSelector, dropSelector) {
  const input = $(inputSelector);
  const drop = $(dropSelector);
  input.addEventListener("change", () => setFile(kind, input.files[0]));
  ["dragenter", "dragover"].forEach((eventName) => drop.addEventListener(eventName, (event) => {
    event.preventDefault();
    drop.classList.add("drag");
  }));
  ["dragleave", "drop"].forEach((eventName) => drop.addEventListener(eventName, (event) => {
    event.preventDefault();
    drop.classList.remove("drag");
  }));
  drop.addEventListener("drop", (event) => setFile(kind, event.dataTransfer.files[0]));
}

function publicRow(row) {
  const result = {
    "고유식별번호": row.id,
    "이름": row.name,
    "근무일자": formatDateKey(row.date),
    "출근시간": displayTime(row.start),
    "출근검증": boundaryExportText(row.startCheck),
    "퇴근시간": displayTime(row.end),
    "퇴근검증": boundaryExportText(row.endCheck),
  };
  row.checks.forEach((check) => {
    const key = `${formatMinutes(check.target)} 검증`;
    result[key] = !check.evaluable ? "판정불가" : !check.required ? "해당없음" : check.ok ? `정상 (${check.closest.time})` : "누락";
  });
  result["중간지문누락수"] = row.missingCount;
  result["출퇴근확인수"] = row.boundaryIssueCount;
  result["익일자료필요"] = row.dataNeededCount ? "Y" : "N";
  result["최종검증"] = row.ok ? "정상" : row.boundaryIssueCount + row.missingCount > 0 ? "확인필요" : "자료필요";
  return result;
}

function boundaryExportText(check) {
  const label = check.kind === "start" ? "출근" : "퇴근";
  if (check.state === "missingValue") return `확인필요 - ERP ${label}시간 없음`;
  if (check.state === "dataNeeded") return `자료필요 - ${formatDateKey(check.eventDate)}`;
  if (check.state === "missingEvent") return `확인필요 - ${label}기록 없음`;
  const record = `${check.actual.time} ${check.actual.status}`;
  if (check.state === "mismatch") return `확인필요 - 원기록 ${record}`;
  return `정상 - ${record}`;
}

function styleRange(sheet, reference, style) {
  const range = XLSX.utils.decode_range(reference);
  for (let row = range.s.r; row <= range.e.r; row += 1) {
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: column });
      if (!sheet[address]) sheet[address] = { t: "s", v: "" };
      sheet[address].s = style;
    }
  }
}

function makeDetailSheet(rows) {
  const data = rows.map(publicRow);
  const sheet = XLSX.utils.json_to_sheet(data.length ? data : [{ "결과": "대상 없음" }]);
  const headers = data.length ? Object.keys(data[0]) : ["결과"];
  const lastColumn = XLSX.utils.encode_col(headers.length - 1);
  const headerStyle = { fill: { patternType: "solid", fgColor: { rgb: "173F70" } }, font: { bold: true, color: { rgb: "FFFFFF" } }, alignment: { horizontal: "center", vertical: "center" }, border: { bottom: { style: "medium", color: { rgb: "0B1E35" } } } };
  const bodyStyle = { font: { color: { rgb: "1F2937" } }, alignment: { vertical: "center" }, border: { bottom: { style: "thin", color: { rgb: "D9E0E8" } } } };
  const bandStyle = { ...bodyStyle, fill: { patternType: "solid", fgColor: { rgb: "F2F6FA" } } };
  const failStyle = { ...bodyStyle, fill: { patternType: "solid", fgColor: { rgb: "FFE3E8" } }, font: { bold: true, color: { rgb: "8F1730" } } };
  styleRange(sheet, `A1:${lastColumn}1`, headerStyle);
  for (let index = 0; index < data.length; index += 1) {
    const excelRow = index + 2;
    styleRange(sheet, `A${excelRow}:${lastColumn}${excelRow}`, data[index]["최종검증"] !== "정상" ? failStyle : excelRow % 2 ? bandStyle : bodyStyle);
  }
  sheet["!cols"] = headers.map((header) => ({ wch: /출근검증|퇴근검증/.test(header) ? 32 : /검증/.test(header) ? 20 : /이름/.test(header) ? 18 : /식별/.test(header) ? 16 : 13 }));
  sheet["!rows"] = [{ hpt: 28 }];
  sheet["!autofilter"] = { ref: sheet["!ref"] };
  sheet["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" };
  sheet["!views"] = [{ showGridLines: false }];
  return sheet;
}

function exportExcel() {
  if (!analysis) return;
  const workbook = XLSX.utils.book_new();
  const summaryRows = [
    ["주말 중간지문 점검 결과"],
    [`출퇴근 파일: ${files.attendance.name}`],
    [`지문내역 파일: ${files.fingerprint.name}`],
    [],
    ["구분", "건수"],
    ["점검 인원", analysis.totalCount],
    ["최종 정상", analysis.passCount],
    ["최종 확인 필요", analysis.failCount],
    ["필요 지문 구간", analysis.requiredCount],
    ["중간지문 누락 인원", analysis.middleMissingPersonCount],
    ["중간지문 누락 구간", analysis.missingCount],
    ["출퇴근 확인 인원", analysis.boundaryIssueCount],
    ["익일자료 필요 인원", analysis.dataNeededCount],
    [],
    ["점검 기준", "내용"],
    ["기준시각", "07:00 · 10:00 · 13:00 · 16:00 · 19:00"],
    ["인정시간", "각 기준시각 전후 10분"],
    ["중간지문", "출근·퇴근·출입 기록 모두 인정"],
    ["출근검증", "ERP 출근시간과 당일 첫 출근 기록 비교(지문·카드 인정)"],
    ["퇴근검증", "ERP 퇴근시간과 당일 마지막 퇴근 기록 비교(지문·카드 인정)"],
    ["야간근무", "다음 날 지문자료가 없으면 익일자료 필요로 표시"],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet["!merges"] = [XLSX.utils.decode_range("A1:B1"), XLSX.utils.decode_range("A2:B2"), XLSX.utils.decode_range("A3:B3")];
  summarySheet["!cols"] = [{ wch: 22 }, { wch: 64 }];
  summarySheet["!rows"] = [{ hpt: 34 }, { hpt: 21 }, { hpt: 21 }];
  summarySheet["!views"] = [{ showGridLines: false }];
  const titleStyle = { fill: { patternType: "solid", fgColor: { rgb: "173F70" } }, font: { bold: true, color: { rgb: "FFFFFF" }, sz: 16 }, alignment: { horizontal: "center", vertical: "center" } };
  const noteStyle = { fill: { patternType: "solid", fgColor: { rgb: "E8F0F8" } }, font: { color: { rgb: "354A62" } }, alignment: { vertical: "center" } };
  const headerStyle = { fill: { patternType: "solid", fgColor: { rgb: "207A70" } }, font: { bold: true, color: { rgb: "FFFFFF" } }, alignment: { horizontal: "center", vertical: "center" } };
  const bodyStyle = { border: { bottom: { style: "thin", color: { rgb: "D9E0E8" } } }, alignment: { vertical: "center" } };
  const warningStyle = { ...bodyStyle, fill: { patternType: "solid", fgColor: { rgb: "FFE3E8" } }, font: { bold: true, color: { rgb: "8F1730" } } };
  styleRange(summarySheet, "A1:B1", titleStyle);
  styleRange(summarySheet, "A2:B3", noteStyle);
  styleRange(summarySheet, "A5:B5", headerStyle);
  styleRange(summarySheet, "A14:B14", headerStyle);
  for (let row = 6; row <= 12; row += 1) styleRange(summarySheet, `A${row}:B${row}`, [8, 10, 11, 12].includes(row) ? warningStyle : bodyStyle);
  for (let row = 15; row <= 20; row += 1) styleRange(summarySheet, `A${row}:B${row}`, bodyStyle);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "요약");
  XLSX.utils.book_append_sheet(workbook, makeDetailSheet(analysis.rows.filter((row) => !row.ok)), "확인필요");
  XLSX.utils.book_append_sheet(workbook, makeDetailSheet(analysis.rows), "전체결과");
  XLSX.writeFile(workbook, "주말_중간지문_점검결과.xlsx");
}

setupUpload("attendance", "#attendanceFile", "#attendanceDrop");
setupUpload("fingerprint", "#fingerprintFile", "#fingerprintDrop");
$("#run").addEventListener("click", runAnalysis);
$("#download").addEventListener("click", exportExcel);
$("#reset").addEventListener("click", () => location.reload());
$("#search").addEventListener("input", (event) => { searchText = event.target.value.trim().toLocaleLowerCase("ko"); renderTable(); });
document.querySelectorAll(".tab").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
  button.classList.add("active");
  activeFilter = button.dataset.filter;
  renderTable();
}));
document.querySelectorAll("#resultTable th[data-sort]").forEach((header) => header.addEventListener("click", () => {
  const key = header.dataset.sort;
  sortState = sortState.key === key ? { key, direction: sortState.direction * -1 } : { key, direction: 1 };
  renderTable();
}));

function updateClock() {
  const now = new Date();
  $("#clock").textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
updateClock();
setInterval(updateClock, 30000);
