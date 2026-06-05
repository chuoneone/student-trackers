// 學生小考成績登記系統 GAS 後端資料庫 API
// 檔案路徑：backend/gas_code.js

var SPREADSHEET_NAME = "學生小考成績資料庫";
var SHEET_STUDENTS = "Students";
var SHEET_RECORDS = "QuizRecords";

// 安全驗證密碼（此變數只在 Google 雲端伺服器運作，前端網頁無法透過檢查原始碼看到）
var ACCESS_PASSWORD = "520";

/**
 * 取得或建立資料庫試算表，並確保工作表與預設名單存在
 */
function getOrCreateSpreadsheet() {
  var userProperties = PropertiesService.getUserProperties();
  var spreadsheetId = userProperties.getProperty('GRADE_SPREADSHEET_ID');
  var ss;

  if (spreadsheetId) {
    try {
      ss = SpreadsheetApp.openById(spreadsheetId);
    } catch (e) {
      userProperties.deleteProperty('GRADE_SPREADSHEET_ID');
    }
  }

  if (!ss) {
    var files = DriveApp.getFilesByName(SPREADSHEET_NAME);
    var found = false;
    while (files.hasNext()) {
      var file = files.next();
      if (file.getMimeType() === MimeType.GOOGLE_SHEETS) {
        try {
          ss = SpreadsheetApp.open(file);
          userProperties.setProperty('GRADE_SPREADSHEET_ID', ss.getId());
          found = true;
          break;
        } catch (e) {
          // 忽略開啟失敗者
        }
      }
    }

    if (!found) {
      ss = SpreadsheetApp.create(SPREADSHEET_NAME);
      userProperties.setProperty('GRADE_SPREADSHEET_ID', ss.getId());
    }
  }

  // 1. 初始化學生名單工作表
  var studentsSheet = ss.getSheetByName(SHEET_STUDENTS);
  var isNewStudents = false;
  if (!studentsSheet) {
    studentsSheet = ss.insertSheet(SHEET_STUDENTS);
    studentsSheet.appendRow(["Grade", "Name"]);
    studentsSheet.getRange("A1:B1").setFontWeight("bold").setBackground("#d9ead3");
    isNewStudents = true;
  } else {
    // 檢查並自動更新舊的示範名單
    var values = studentsSheet.getDataRange().getValues();
    var hasOldNames = false;
    for (var i = 1; i < values.length; i++) {
      if (values[i][1] === "王小明" || values[i][0] === "7年級" || values[i][0] === "8年級") {
        hasOldNames = true;
        break;
      }
    }
    if (hasOldNames || studentsSheet.getLastRow() <= 1) {
      studentsSheet.clear();
      studentsSheet.appendRow(["Grade", "Name"]);
      studentsSheet.getRange("A1:B1").setFontWeight("bold").setBackground("#d9ead3");
      isNewStudents = true;
    }
  }

  if (isNewStudents) {
    // 填入示範用學生名單 (保護隱私)
    var defaultStudents = [
      ["八仁", "蘇祐慶"],
      ["八仁", "徐文彥"],
      ["八義", "黃寬益"],
      ["八義", "黃雅璇"],
      ["七仁", "林子龍"],
      ["七義", "楊育翔"],
      ["七義", "徐暄"]
    ];
    
    defaultStudents.forEach(function(student) {
      studentsSheet.appendRow(student);
    });
  }

  // 2. 初始化小考成績工作表
  var recordsSheet = ss.getSheetByName(SHEET_RECORDS);
  if (!recordsSheet) {
    recordsSheet = ss.insertSheet(SHEET_RECORDS);
    recordsSheet.appendRow(["ID", "Date", "Grade", "Name", "Subject", "Score", "Note", "Timestamp"]);
    recordsSheet.getRange("A1:H1").setFontWeight("bold").setBackground("#f3f3f3");
  }

  var defaultSheet = ss.getSheetByName("工作表1");
  if (defaultSheet) {
    try {
      ss.deleteSheet(defaultSheet);
    } catch (e) {
      // 忽略錯誤
    }
  }

  return ss;
}

/**
 * 處理 GET 請求：驗證密碼，若通過則讀取學生名單與情緒統計明細
 */
function doGet(e) {
  // 判斷是否為 API 請求
  if (e.parameter.api === "true" || e.parameter.password) {
    try {
      // 密碼驗證
      var password = e.parameter.password;
      if (password !== ACCESS_PASSWORD) {
        return ContentService.createTextOutput(JSON.stringify({
          status: "error",
          message: "Unauthorized"
        })).setMimeType(ContentService.MimeType.JSON);
      }

      var ss = getOrCreateSpreadsheet();
      var students = getStudentsList(ss.getSheetByName(SHEET_STUDENTS));
      var records = getRecordsData(ss.getSheetByName(SHEET_RECORDS));
      var summary = calculateSummary(records, students);

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        students: students,
        records: records,
        summary: summary
      })).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: error.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  // 否則直接回傳 HTML 前端頁面
  return HtmlService.createHtmlOutputFromFile("index")
    .setTitle("學生小考成績登記系統")
    .addMetaTag("viewport", "width=device-width, initial-scale=1.0")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * 處理 POST 請求：驗證密碼，若通過則新增或刪除紀錄
 */
function doPost(e) {
  try {
    var payload;
    if (e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else {
      payload = e.parameter;
    }

    // 密碼驗證
    if (payload.password !== ACCESS_PASSWORD) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Unauthorized"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var action = payload.action;
    var ss = getOrCreateSpreadsheet();
    var recordsSheet = ss.getSheetByName(SHEET_RECORDS);

    if (action === "addGradeRecord") {
      var newRecord = addGradeRecord(recordsSheet, payload);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Grade record added successfully",
        data: newRecord
      })).setMimeType(ContentService.MimeType.JSON);

    } else if (action === "deleteGradeRecord") {
      var success = deleteGradeRecord(recordsSheet, payload.id);
      if (success) {
        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          message: "Grade record deleted successfully"
        })).setMimeType(ContentService.MimeType.JSON);
      } else {
        return ContentService.createTextOutput(JSON.stringify({
          status: "error",
          message: "Record ID not found"
        })).setMimeType(ContentService.MimeType.JSON);
      }
    } else {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Invalid action: " + action
      })).setMimeType(ContentService.MimeType.JSON);
    }

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 讀取學生名單
 */
function getStudentsList(sheet) {
  var rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];
  
  var list = [];
  for (var i = 1; i < rows.length; i++) {
    list.push({
      grade: String(rows[i][0]),
      name: String(rows[i][1])
    });
  }
  return list;
}

/**
 * 讀取所有小考成績紀錄
 */
function getRecordsData(sheet) {
  var rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];
  
  var records = [];
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    
    var dateVal = row[1];
    var formattedDate = "";
    if (dateVal instanceof Date) {
      formattedDate = Utilities.formatDate(dateVal, Session.getScriptTimeZone(), "yyyy-MM-dd");
    } else {
      formattedDate = String(dateVal);
    }

    records.push({
      id: String(row[0]),
      date: formattedDate,
      grade: String(row[2]),
      name: String(row[3]),
      subject: String(row[4]),
      score: Number(row[5]),
      note: String(row[6]),
      timestamp: String(row[7])
    });
  }

  // 按日期降序排序，若日期相同則按寫入時間降序
  records.sort(function(a, b) {
    return new Date(b.date + 'T00:00:00') - new Date(a.date + 'T00:00:00') || new Date(b.timestamp) - new Date(a.timestamp);
  });

  return records;
}

/**
 * 計算班級成績統計摘要
 */
function calculateSummary(records, students) {
  var summary = {};

  // 動態初始化所有出現的班級/年級
  students.forEach(function(s) {
    var g = s.grade;
    if (!summary[g]) {
      summary[g] = {
        studentStats: {},
        subjectStats: {},
        distribution: { "90-100": 0, "80-89": 0, "70-79": 0, "60-69": 0, "under60": 0 },
        total: 0
      };
    }
    summary[g].studentStats[s.name] = { sum: 0, count: 0, avg: null };
  });

  // 統計數值
  records.forEach(function(r) {
    var g = r.grade;
    var name = r.name;
    var subject = r.subject;
    var score = parseFloat(r.score);
    
    if (isNaN(score)) return;

    if (summary[g]) {
      // 1. 學生累計
      if (!summary[g].studentStats[name]) {
        summary[g].studentStats[name] = { sum: 0, count: 0, avg: null };
      }
      summary[g].studentStats[name].sum += score;
      summary[g].studentStats[name].count += 1;
      
      // 2. 科目累計
      if (!summary[g].subjectStats[subject]) {
        summary[g].subjectStats[subject] = { sum: 0, count: 0, avg: 0 };
      }
      summary[g].subjectStats[subject].sum += score;
      summary[g].subjectStats[subject].count += 1;

      // 3. 區間分布
      if (score >= 90) {
        summary[g].distribution["90-100"]++;
      } else if (score >= 80) {
        summary[g].distribution["80-89"]++;
      } else if (score >= 70) {
        summary[g].distribution["70-79"]++;
      } else if (score >= 60) {
        summary[g].distribution["60-69"]++;
      } else {
        summary[g].distribution["under60"]++;
      }
      summary[g].total++;
    }
  });

  // 計算平均分與百分比
  for (var g in summary) {
    // 學生平均
    var sStats = summary[g].studentStats;
    for (var name in sStats) {
      if (sStats[name].count > 0) {
        sStats[name].avg = parseFloat((sStats[name].sum / sStats[name].count).toFixed(1));
      }
    }
    
    // 科目均分
    var subStats = summary[g].subjectStats;
    for (var sub in subStats) {
      if (subStats[sub].count > 0) {
        subStats[sub].avg = parseFloat((subStats[sub].sum / subStats[sub].count).toFixed(1));
      }
    }
  }

  return summary;
}

/**
 * 新增小考成績紀錄
 */
function addGradeRecord(sheet, payload) {
  var id = Utilities.getUuid();
  var date = payload.date || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  var grade = payload.grade;
  var name = payload.name;
  var subject = payload.subject || "未命名小考";
  var score = Number(payload.score);
  if (isNaN(score)) score = 0;
  var note = payload.note || "";
  var timestamp = new Date().toISOString();

  sheet.appendRow([id, date, grade, name, subject, score, note, timestamp]);

  return {
    id: id,
    date: date,
    grade: grade,
    name: name,
    subject: subject,
    score: score,
    note: note,
    timestamp: timestamp
  };
}

/**
 * 刪除小考成績紀錄
 */
function deleteGradeRecord(sheet, id) {
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === id) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

/**
 * 手動執行此函數：以示範用假名覆寫工作表中的學生名單並清除成績歷史 (保護隱私)
 */
function resetStudentsWithFakeNames() {
  var ss = getOrCreateSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_STUDENTS);
  if (sheet) {
    sheet.clear();
    sheet.appendRow(["Grade", "Name"]);
    sheet.getRange("A1:B1").setFontWeight("bold").setBackground("#d9ead3");
  } else {
    sheet = ss.insertSheet(SHEET_STUDENTS);
    sheet.appendRow(["Grade", "Name"]);
    sheet.getRange("A1:B1").setFontWeight("bold").setBackground("#d9ead3");
  }
  
  var fakeStudents = [
    ["八仁", "蘇祐慶"],
    ["八仁", "徐文彥"],
    ["八義", "黃寬益"],
    ["八義", "黃雅璇"],
    ["七仁", "林子龍"],
    ["七義", "楊育翔"],
    ["七義", "徐暄"]
  ];
  
  fakeStudents.forEach(function(student) {
    sheet.appendRow(student);
  });
  
  var recordsSheet = ss.getSheetByName(SHEET_RECORDS);
  if (recordsSheet) {
    recordsSheet.clear();
    recordsSheet.appendRow(["ID", "Date", "Grade", "Name", "Subject", "Score", "Note", "Timestamp"]);
    recordsSheet.getRange("A1:H1").setFontWeight("bold").setBackground("#f3f3f3");
  }
}
