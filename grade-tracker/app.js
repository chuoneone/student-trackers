// 學生小考成績登記系統 前端邏輯 (c:\Users\USER\Desktop\netlify\frontend\app.js)

const GAS_API_URL = "https://script.google.com/macros/s/AKfycbzp19TPHRWvVvCENwuRplLVQ0o0ww__fM03nf1W9rFS_wgUqo8XeXXqM0Lrv1e5r5LMfQ/exec";

// 全局狀態
let allStudents = [];
let allRecords = [];
let gradeSummary = {};
let currentGrade = "七年級";
let trendChartInstance = null;
let distChartInstance = null;

// DOM 元素 - 解鎖畫面
const lockScreen = document.getElementById("lockScreen");
const lockForm = document.getElementById("lockForm");
const passwordInput = document.getElementById("passwordInput");
const lockErrorMsg = document.getElementById("lockErrorMsg");
const lockCard = document.querySelector(".lock-card");

// DOM 元素 - 主程式
const mainApp = document.getElementById("mainApp");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const refreshBtn = document.getElementById("refreshBtn");
const logoutBtn = document.getElementById("logoutBtn");

const studentsGrid = document.getElementById("studentsGrid");
const studentCountBadge = document.getElementById("studentCountBadge");
const noTrendChartData = document.getElementById("noTrendChartData");
const noDistChartData = document.getElementById("noDistChartData");
const searchInput = document.getElementById("searchInput");
const historyList = document.getElementById("historyList");
const noHistoryData = document.getElementById("noHistoryData");

// DOM 元素 - 紀錄與明細視窗 (Modal)
const recordModal = document.getElementById("recordModal");
const recordForm = document.getElementById("recordForm");
const recordStudentName = document.getElementById("recordStudentName");
const recordDate = document.getElementById("recordDate");
const gradeSubject = document.getElementById("gradeSubject");
const gradeScore = document.getElementById("gradeScore");
const noteInput = document.getElementById("recordNote");
const closeRecordModalBtn = document.getElementById("closeRecordModalBtn");
const cancelRecordBtn = document.getElementById("cancelRecordBtn");
const saveRecordBtn = document.getElementById("saveRecordBtn");
const btnText = document.getElementById("btnText");
const btnLoader = document.getElementById("btnLoader");
const personalHistoryList = document.getElementById("personalHistoryList");
const noPersonalHistory = document.getElementById("noPersonalHistory");

// 初始化事件監聽
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  checkAuth();

  // 綁定解鎖事件
  lockForm.addEventListener("submit", handleUnlock);

  // 綁定登出
  logoutBtn.addEventListener("click", handleLock);

  // 年級切換
  const tabBtns = document.querySelectorAll(".class-tab-btn");
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const grade = btn.getAttribute("data-grade");
      switchGrade(grade);
    });
  });

  // 明細紀錄與 Modal 關閉
  closeRecordModalBtn.addEventListener("click", () => showRecordModal(false));
  cancelRecordBtn.addEventListener("click", () => showRecordModal(false));
  recordModal.addEventListener("click", (e) => {
    if (e.target === recordModal) showRecordModal(false);
  });

  // 提交小考成績
  recordForm.addEventListener("submit", handleRecordSubmit);

  // 搜尋與同步
  searchInput.addEventListener("input", renderHistory);
  refreshBtn.addEventListener("click", fetchData);
  themeToggleBtn.addEventListener("click", toggleTheme);
});

// 主題處理 (Light / Dark)
function initTheme() {
  const savedTheme = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const newTheme = currentTheme === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);
  updateThemeIcon(newTheme);
  if (allStudents.length > 0) {
    renderCharts(); // 重新渲染圖表以載入新的文字色彩
  }
}

function updateThemeIcon(theme) {
  const icon = themeToggleBtn.querySelector("i");
  icon.className = theme === "light" ? "fa-solid fa-sun" : "fa-solid fa-moon";
}

// 驗證與登入處理
function checkAuth() {
  // 自動在背景設定密碼 520 以利向後端 API 通訊，使用者不需要手動輸入密碼
  sessionStorage.setItem("system_password", "520");
  sessionStorage.setItem("system_unlocked", "true");
  
  lockScreen.classList.add("hidden");
  mainApp.classList.remove("hidden");
  fetchData();
}

// 密碼驗證解鎖 (後端安全驗證)
async function handleUnlock(e) {
  e.preventDefault();
  const enteredPassword = passwordInput.value;
  
  showToast("正在驗證密碼...", "info");
  lockErrorMsg.classList.add("hidden");
  
  try {
    const response = await fetch(`${GAS_API_URL}?password=${encodeURIComponent(enteredPassword)}`);
    if (!response.ok) throw new Error("網路連線錯誤");
    
    const result = await response.json();
    if (result.status === "success") {
      sessionStorage.setItem("system_password", enteredPassword);
      sessionStorage.setItem("system_unlocked", "true");
      
      allStudents = result.students || [];
      allRecords = result.records || [];
      gradeSummary = result.summary || {};
      
      lockScreen.classList.add("hidden");
      mainApp.classList.remove("hidden");
      showToast("解鎖成功", "success");
      
      renderStudents();
      renderHistory();
      renderCharts();
    } else if (result.message === "Unauthorized") {
      throw new Error("密碼錯誤");
    } else {
      throw new Error(result.message || "驗證失敗");
    }
  } catch (error) {
    console.error(error);
    const displayMsg = error.message === "密碼錯誤" ? "密碼錯誤，請重新輸入！" : `連線失敗: ${error.message}`;
    showToast(displayMsg, "error");
    
    // 錯誤動畫與抖動
    lockCard.classList.add("shake");
    lockErrorMsg.textContent = displayMsg;
    lockErrorMsg.classList.remove("hidden");
    passwordInput.select();
    
    setTimeout(() => {
      lockCard.classList.remove("shake");
    }, 500);
  }
}

function handleLock() {
  sessionStorage.removeItem("system_unlocked");
  sessionStorage.removeItem("system_password");
  checkAuth();
  showToast("系統已鎖定", "info");
}

// 切換年級標籤
function switchGrade(grade) {
  currentGrade = grade;
  const tabBtns = document.querySelectorAll(".class-tab-btn");
  tabBtns.forEach(btn => {
    if (btn.getAttribute("data-grade") === grade) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
  renderStudents();
  renderHistory();
  renderCharts();
}

// 開啟小考成績登記與管理 Modal
function showRecordModal(show, studentName = "") {
  if (show) {
    recordStudentName.value = studentName;
    gradeSubject.value = "";
    gradeScore.value = "";
    noteInput.value = "";
    recordDate.value = new Date().toISOString().split("T")[0];
    
    // 渲染此學生的個人小考成績明細
    renderPersonalHistory(studentName);
    
    recordModal.classList.add("active");
  } else {
    recordModal.classList.remove("active");
  }
}

// 同步獲取資料庫資料
function parseRecordDate(value) {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

  const text = String(value).trim();
  const dateOnlyMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const parsed = new Date(text);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function getDateKey(value) {
  const date = parseRecordDate(value);
  if (!date) return String(value || "");

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatRecordDate(value, includeYear = true) {
  const date = parseRecordDate(value);
  if (!date) return String(value || "");

  return new Intl.DateTimeFormat("zh-TW", {
    ...(includeYear ? { year: "numeric" } : {}),
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function formatSubject(value) {
  const text = String(value || "");
  const looksLikeDate = /^\d{4}-\d{1,2}-\d{1,2}/.test(text)
    || /^[A-Z][a-z]{2} [A-Z][a-z]{2} \d{1,2} \d{4} .*GMT[+-]\d{4}/.test(text);

  return looksLikeDate && parseRecordDate(text) ? formatRecordDate(text) : text;
}

async function fetchData() {
  const password = sessionStorage.getItem("system_password");
  if (!password) {
    handleLock();
    return;
  }

  showToast("正在從雲端同步名單與成績...", "info");
  refreshBtn.disabled = true;
  refreshBtn.querySelector("i").classList.add("fa-spin");

  try {
    const response = await fetch(`${GAS_API_URL}?password=${encodeURIComponent(password)}`);
    if (!response.ok) throw new Error("網路連線錯誤");
    
    const result = await response.json();
    if (result.status === "success") {
      allStudents = result.students || [];
      allRecords = result.records || [];
      gradeSummary = result.summary || {};
      
      renderStudents();
      renderHistory();
      renderCharts();
      
      showToast("成績資料庫同步完成", "success");
    } else if (result.message === "Unauthorized") {
      showToast("登入已過期，請重新解鎖", "error");
      handleLock();
    } else {
      throw new Error(result.message || "讀取失敗");
    }
  } catch (error) {
    console.error(error);
    showToast(`同步失敗: ${error.message}`, "error");
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.querySelector("i").classList.remove("fa-spin");
  }
}

// 渲染學生卡片網格 (動態計算平均分與外框著色)
function renderStudents() {
  studentsGrid.innerHTML = "";
  
  const filteredStudents = allStudents.filter(s => s.grade === currentGrade);
  studentCountBadge.textContent = `${filteredStudents.length} 位學生`;

  const stats = (gradeSummary[currentGrade] && gradeSummary[currentGrade].studentStats) || {};

  filteredStudents.forEach(student => {
    const card = document.createElement("div");
    card.className = "student-card card-glass";
    
    let borderClass = "grade-none";
    let scoreText = "尚未登記小考";
    
    const studentInfo = stats[student.name];
    if (studentInfo && studentInfo.count > 0) {
      const avg = studentInfo.avg;
      const count = studentInfo.count;
      scoreText = `平均：${avg} 分 (${count}次)`;
      
      if (avg >= 90) borderClass = "grade-excellent";
      else if (avg >= 80) borderClass = "grade-good";
      else if (avg >= 60) borderClass = "grade-average";
      else borderClass = "grade-poor";
    }

    const initial = student.name ? student.name.charAt(0) : "?";

    card.innerHTML = `
      <div class="student-avatar ${borderClass}">
        ${initial}
      </div>
      <div class="student-name">${student.name}</div>
      <div class="student-status-label ${borderClass}" title="${scoreText}">
        ${scoreText}
      </div>
      <button class="record-action-btn" data-name="${student.name}">
        <i class="fa-solid fa-graduation-cap"></i> 登記與管理
      </button>
    `;

    card.querySelector(".record-action-btn").addEventListener("click", (e) => {
      const name = e.currentTarget.getAttribute("data-name");
      showRecordModal(true, name);
    });

    studentsGrid.appendChild(card);
  });
}

// 渲染 Modal 內的個人成績明細
function renderPersonalHistory(studentName) {
  personalHistoryList.innerHTML = "";
  
  const filtered = allRecords.filter(r => r.name === studentName);
  
  if (filtered.length === 0) {
    noPersonalHistory.classList.remove("hidden");
  } else {
    noPersonalHistory.classList.add("hidden");
    
    filtered.forEach(r => {
      const li = document.createElement("li");
      li.className = "personal-history-item";
      
      let scoreColor = "var(--text-secondary)";
      if (r.score >= 90) scoreColor = "var(--color-calm)";
      else if (r.score >= 80) scoreColor = "var(--color-sad)";
      else if (r.score >= 60) scoreColor = "var(--color-anxious)";
      else scoreColor = "var(--color-angry)";

      li.innerHTML = `
        <div class="personal-history-meta">
          <div class="personal-history-title">${escapeHTML(formatSubject(r.subject))}</div>
          <div class="personal-history-sub">
            <span><i class="fa-regular fa-calendar"></i> ${formatRecordDate(r.date)}</span>
            ${r.note ? `<span title="${escapeHTML(r.note)}"><i class="fa-regular fa-comment"></i> ${escapeHTML(r.note)}</span>` : ""}
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span class="personal-history-score" style="color: ${scoreColor};">${r.score} 分</span>
          <button class="delete-record-btn" title="刪除此分數" data-id="${r.id}" style="padding: 4px 8px; font-size: 0.75rem;">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </div>
      `;

      li.querySelector(".delete-record-btn").addEventListener("click", async (e) => {
        const id = e.currentTarget.getAttribute("data-id");
        if (confirm(`確定要刪除該筆「${formatSubject(r.subject)}」的成績嗎？`)) {
          await handleDeleteGradeRecord(id, studentName);
        }
      });

      personalHistoryList.appendChild(li);
    });
  }
}

// 渲染全體歷程紀錄
function renderHistory() {
  historyList.innerHTML = "";
  
  const searchVal = searchInput.value.toLowerCase().trim();
  
  const filtered = allRecords.filter(r => {
    const matchGrade = r.grade === currentGrade;
    const matchSearch = r.name.toLowerCase().includes(searchVal) || r.subject.toLowerCase().includes(searchVal);
    return matchGrade && matchSearch;
  });

  if (filtered.length === 0) {
    noHistoryData.classList.remove("hidden");
  } else {
    noHistoryData.classList.add("hidden");
    
    filtered.forEach(r => {
      const li = document.createElement("li");
      li.className = "history-item";
      
      let scoreStyle = "grade-none";
      if (r.score >= 90) scoreStyle = "grade-excellent";
      else if (r.score >= 80) scoreStyle = "grade-good";
      else if (r.score >= 60) scoreStyle = "grade-average";
      else scoreStyle = "grade-poor";

      li.innerHTML = `
        <div class="history-meta">
          <span class="history-emo-indicator" style="font-weight: 700; font-size: 1rem; color: var(--text-primary); width: auto; margin-right: 0.5rem;">
            ${r.score}分
          </span>
          <div class="history-details">
            <h4>
              ${r.name} 
              <span class="student-status-label ${scoreStyle}" style="font-size:0.65rem; padding:1px 6px">${escapeHTML(formatSubject(r.subject))}</span>
            </h4>
            <div class="history-time"><i class="fa-regular fa-calendar"></i> ${formatRecordDate(r.date)}</div>
            ${r.note ? `<div class="history-note"><i class="fa-regular fa-comment"></i> ${escapeHTML(r.note)}</div>` : ""}
          </div>
        </div>
        <div class="history-actions">
          <button class="delete-record-btn" title="刪除此筆記錄" data-id="${r.id}">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </div>
      `;

      li.querySelector(".delete-record-btn").addEventListener("click", async (e) => {
        const id = e.currentTarget.getAttribute("data-id");
        if (confirm(`確定要刪除 ${r.name} 的「${formatSubject(r.subject)}」小考成績嗎？`)) {
          await handleDeleteGradeRecord(id);
        }
      });

      historyList.appendChild(li);
    });
  }
}

// 提交小考成績
async function handleRecordSubmit(e) {
  e.preventDefault();
  
  const name = recordStudentName.value;
  const date = recordDate.value;
  const subject = gradeSubject.value.trim();
  const score = parseInt(gradeScore.value);
  const note = noteInput.value.trim();
  const password = sessionStorage.getItem("system_password");
  
  if (isNaN(score) || score < 0 || score > 100) {
    showToast("小考分數必須在 0 - 100 之間！", "error");
    return;
  }

  if (!password) {
    handleLock();
    return;
  }

  setSubmitting(true);

  const payload = {
    action: "addGradeRecord",
    password: password,
    grade: currentGrade,
    name: name,
    date: date,
    subject: subject,
    score: score,
    note: note
  };

  try {
    const response = await fetch(GAS_API_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error("伺服器回應錯誤");
    const result = await response.json();

    if (result.status === "success") {
      showToast("成績登記成功", "success");

      showRecordModal(false);
      await fetchData();
    } else if (result.message === "Unauthorized") {
      showToast("登入已逾期，請重新解鎖", "error");
      handleLock();
    } else {
      throw new Error(result.message || "登記失敗");
    }
  } catch (error) {
    console.error(error);
    showToast(`登記失敗: ${error.message}`, "error");
  } finally {
    setSubmitting(false);
  }
}

// 刪除小考成績紀錄 (共用 API)
async function handleDeleteGradeRecord(id, studentName = "") {
  showToast("正在刪除成績...", "info");
  const password = sessionStorage.getItem("system_password");

  if (!password) {
    handleLock();
    return;
  }

  const payload = {
    action: "deleteGradeRecord",
    password: password,
    id: id
  };

  try {
    const response = await fetch(GAS_API_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error("伺服器回應錯誤");
    const result = await response.json();

    if (result.status === "success") {
      showToast("小考成績已刪除", "success");
      await fetchData(); // 重新整理
      if (studentName) {
        renderPersonalHistory(studentName); // 更新個人明細
      }
    } else if (result.message === "Unauthorized") {
      showToast("登入已逾期，請重新解鎖", "error");
      handleLock();
    } else {
      throw new Error(result.message || "刪除失敗");
    }
  } catch (error) {
    console.error(error);
    showToast(`刪除失敗: ${error.message}`, "error");
  }
}

// 提交中狀態設定
function setSubmitting(isSubmitting) {
  if (isSubmitting) {
    saveRecordBtn.disabled = true;
    btnText.textContent = "儲存中...";
    btnLoader.classList.remove("hidden");
  } else {
    saveRecordBtn.disabled = false;
    btnText.textContent = "儲存成績";
    btnLoader.classList.add("hidden");
  }
}

// 渲染圖表分析組件
function renderCharts() {
  renderTrendChart();
  renderDistChart();
}

// 1. 歷次小考均分走勢折線圖
function renderTrendChart() {
  if (trendChartInstance) {
    trendChartInstance.destroy();
    trendChartInstance = null;
  }

  const gradeRecords = allRecords
    .filter(r => r.grade === currentGrade && parseRecordDate(r.date))
    .sort((a, b) => parseRecordDate(a.date) - parseRecordDate(b.date));

  if (gradeRecords.length === 0) {
    noTrendChartData.classList.remove("hidden");
    document.getElementById("gradeTrendChart").style.display = "none";
    return;
  }

  noTrendChartData.classList.add("hidden");
  const chartCanvas = document.getElementById("gradeTrendChart");
  chartCanvas.style.display = "block";

  const currentTheme = document.documentElement.getAttribute("data-theme");
  const textColor = currentTheme === "light" ? "#1e293b" : "#f3f4f6";
  const gridColor = currentTheme === "light" ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
  const palette = ["#7c3aed", "#059669", "#2563eb", "#d97706", "#e11d48", "#0891b2", "#9333ea", "#4f46e5"];

  const dates = [...new Set(gradeRecords.map(r => getDateKey(r.date)))];
  const students = [...new Set(gradeRecords.map(r => r.name))];
  const scoresByStudentAndDate = new Map();

  gradeRecords.forEach(record => {
    const key = `${record.name}\u0000${getDateKey(record.date)}`;
    const scores = scoresByStudentAndDate.get(key) || [];
    scores.push(Number(record.score));
    scoresByStudentAndDate.set(key, scores);
  });

  const datasets = students.map((studentName, index) => {
    const color = palette[index % palette.length];
    return {
      label: studentName,
      data: dates.map(date => {
        const scores = scoresByStudentAndDate.get(`${studentName}\u0000${date}`);
        if (!scores || scores.length === 0) return null;
        return Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1));
      }),
      borderColor: color,
      backgroundColor: color,
      borderWidth: 2.5,
      pointBackgroundColor: color,
      pointBorderColor: "#ffffff",
      pointHoverRadius: 6,
      spanGaps: true,
      fill: false,
      tension: 0.25
    };
  });

  trendChartInstance = new Chart(chartCanvas, {
    type: "line",
    data: {
      labels: dates.map(date => formatRecordDate(date, false)),
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: textColor, font: { size: 10 } }
        },
        y: {
          min: 0,
          max: 100,
          grid: { color: gridColor },
          ticks: { color: textColor, stepSize: 20 }
        }
      },
      plugins: {
        legend: {
          display: true,
          labels: { color: textColor, usePointStyle: true, boxWidth: 8 }
        },
        tooltip: {
          callbacks: {
            title: function(items) {
              return formatRecordDate(dates[items[0].dataIndex]);
            },
            label: function(context) {
              return ` ${context.dataset.label}: ${context.raw} 分`;
            }
          }
        }
      }
    }
  });
}

// 2. 成績分布直方圖
function renderDistChart() {
  if (distChartInstance) {
    distChartInstance.destroy();
    distChartInstance = null;
  }

  const currentSummary = gradeSummary[currentGrade];
  const dist = (currentSummary && currentSummary.distribution) || { "90-100": 0, "80-89": 0, "70-79": 0, "60-69": 0, "under60": 0 };
  const total = (currentSummary && currentSummary.total) || 0;

  if (total === 0) {
    noDistChartData.classList.remove("hidden");
    document.getElementById("gradeDistChart").style.display = "none";
    return;
  }

  noDistChartData.classList.add("hidden");
  const chartCanvas = document.getElementById("gradeDistChart");
  chartCanvas.style.display = "block";

  const labels = ["90 - 100分", "80 - 89分", "70 - 79分", "60 - 69分", "60分以下"];
  const datasetValues = [
    dist["90-100"] || 0,
    dist["80-89"] || 0,
    dist["70-79"] || 0,
    dist["60-69"] || 0,
    dist["under60"] || 0
  ];

  const currentTheme = document.documentElement.getAttribute("data-theme");
  const textColor = currentTheme === "light" ? "#1e293b" : "#f3f4f6";
  const gridColor = currentTheme === "light" ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";

  const backgroundColors = [
    "#10b981", // 90+ 綠
    "#3b82f6", // 80-89 藍
    "#a855f7", // 70-79 紫
    "#fb923c", // 60-69 橘
    "#f43f5e"  // 60- 紅
  ];

  distChartInstance = new Chart(chartCanvas, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        data: datasetValues,
        backgroundColor: backgroundColors,
        borderRadius: 6,
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: textColor }
        },
        y: {
          grid: { color: gridColor },
          ticks: { color: textColor, precision: 0 }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              return ` 人數: ${context.raw} 人`;
            }
          }
        }
      }
    }
  });
}

// Toast 提示框
let toastTimer = null;
function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  toast.className = `toast toast-${type}`;
  
  let iconHtml = "";
  if (type === "success") iconHtml = '<i class="fa-solid fa-circle-check"></i>';
  else if (type === "error") iconHtml = '<i class="fa-solid fa-circle-exclamation"></i>';
  else if (type === "info") iconHtml = '<i class="fa-solid fa-spinner fa-spin"></i>';

  toast.innerHTML = `${iconHtml} <span>${message}</span>`;
  toast.classList.remove("hidden");

  if (toastTimer) clearTimeout(toastTimer);
  
  if (type !== "info") {
    toastTimer = setTimeout(() => {
      toast.classList.add("hidden");
    }, 3500);
  }
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}
