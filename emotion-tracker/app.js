// 學生情緒紀錄系統 前端邏輯 (c:\Users\USER\Desktop\netlify\frontend\app.js)

const GAS_API_URL = "https://script.google.com/macros/s/AKfycby2SynFUrJPEzSL2IK6vzATYNrJHuJpCjfyBM2Sw8alzgknotJhgmvTtfyeMj01NpZu/exec";

// 全局狀態
let allStudents = [];
let allRecords = [];
let emotionSummary = {};
let currentGrade = "八仁";
let chartInstance = null;

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
const noChartData = document.getElementById("noChartData");
const searchInput = document.getElementById("searchInput");
const historyList = document.getElementById("historyList");
const noHistoryData = document.getElementById("noHistoryData");

// DOM 元素 - 紀錄視窗
const recordModal = document.getElementById("recordModal");
const recordForm = document.getElementById("recordForm");
const recordStudentName = document.getElementById("recordStudentName");
const recordDate = document.getElementById("recordDate");
const noteInput = document.getElementById("recordNote");
const closeRecordModalBtn = document.getElementById("closeRecordModalBtn");
const cancelRecordBtn = document.getElementById("cancelRecordBtn");
const saveRecordBtn = document.getElementById("saveRecordBtn");
const btnText = document.getElementById("btnText");
const btnLoader = document.getElementById("btnLoader");

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

  // 監聽情緒 Radio Button 變更
  const emotionRadios = document.querySelectorAll('input[name="emotion"]');
  const customEmotionGroup = document.getElementById("customEmotionGroup");
  const customEmotionInput = document.getElementById("customEmotionInput");

  emotionRadios.forEach(radio => {
    radio.addEventListener("change", (e) => {
      if (e.target.value === "custom") {
        customEmotionGroup.classList.remove("hidden");
        customEmotionInput.focus();
        customEmotionInput.required = true;
      } else {
        customEmotionGroup.classList.add("hidden");
        customEmotionInput.required = false;
        customEmotionInput.value = "";
      }
    });
  });

  // 提交情緒紀錄
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
  if (allStudents.length > 0) renderChart(); // 重新渲染圖表以載入新的文字色彩
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

// 密碼驗證解鎖 (向 Google Apps Script 發送請求進行後端驗證，前端檢查原始碼看不到密碼)
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
      emotionSummary = result.summary || {};
      
      lockScreen.classList.add("hidden");
      mainApp.classList.remove("hidden");
      showToast("解鎖成功", "success");
      
      renderStudents();
      renderHistory();
      renderChart();
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
  renderChart();
}

// 開啟情緒紀錄 Modal
function showRecordModal(show, studentName = "") {
  if (show) {
    recordStudentName.value = studentName;
    noteInput.value = "";
    recordDate.value = new Date().toISOString().split("T")[0];
    document.getElementById("emoHappy").checked = true; // 預設開心
    
    // 重置自訂情緒相關欄位
    const customEmotionGroup = document.getElementById("customEmotionGroup");
    const customEmotionInput = document.getElementById("customEmotionInput");
    if (customEmotionGroup) customEmotionGroup.classList.add("hidden");
    if (customEmotionInput) {
      customEmotionInput.value = "";
      customEmotionInput.required = false;
    }

    recordModal.classList.add("active");
  } else {
    recordModal.classList.remove("active");
  }
}

// 同步獲取資料庫資料
async function fetchData() {
  const password = sessionStorage.getItem("system_password");
  if (!password) {
    handleLock();
    return;
  }

  showToast("正在從雲端同步名單與紀錄...", "info");
  refreshBtn.disabled = true;
  refreshBtn.querySelector("i").classList.add("fa-spin");

  try {
    const response = await fetch(`${GAS_API_URL}?password=${encodeURIComponent(password)}`);
    if (!response.ok) throw new Error("網路連線錯誤");
    
    const result = await response.json();
    if (result.status === "success") {
      allStudents = result.students || [];
      allRecords = result.records || [];
      emotionSummary = result.summary || {};
      
      renderStudents();
      renderHistory();
      renderChart();
      
      showToast("資料庫同步完成", "success");
    } else if (result.message === "Unauthorized") {
      showToast("登入已過期或密碼失效，請重新解鎖", "error");
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

// 渲染學生卡片網格
function renderStudents() {
  studentsGrid.innerHTML = "";
  
  const filteredStudents = allStudents.filter(s => s.grade === currentGrade);
  studentCountBadge.textContent = `${filteredStudents.length} 位學生`;

  filteredStudents.forEach(student => {
    const lastRecord = allRecords.find(r => r.name === student.name);
    
    const card = document.createElement("div");
    card.className = "student-card card-glass";
    
    let avatarClass = "status-none";
    let emotionChar = "";
    let emotionText = "尚無紀錄";
    
    if (lastRecord) {
      const parsed = parseEmotion(lastRecord.emotion);
      emotionChar = parsed.emoji;
      emotionText = `${parsed.text} ${parsed.emoji}`;
      
      const emo = parsed.emoji;
      if (emo === "😊" || emo === "🤩" || emo === "🤪") {
        avatarClass = "status-happy";
      } else if (emo === "😐") {
        avatarClass = "status-calm";
      } else if (emo === "😢" || emo === "😴") {
        avatarClass = "status-sad";
      } else if (emo === "😡") {
        avatarClass = "status-angry";
      } else if (emo === "😰") {
        avatarClass = "status-anxious";
      } else {
        avatarClass = "status-custom";
      }
    }

    const initial = student.name ? student.name.charAt(0) : "?";

    card.innerHTML = `
      <div class="student-avatar ${avatarClass}">
        ${initial}
        ${emotionChar ? `<span class="emotion-badge">${emotionChar}</span>` : ""}
      </div>
      <div class="student-name">${student.name}</div>
      <div class="student-status-label ${avatarClass}" title="${lastRecord && lastRecord.note ? `備註：${lastRecord.note}` : emotionText}">
        ${emotionText}
      </div>
      <button class="record-action-btn" data-name="${student.name}">
        <i class="fa-solid fa-heart-pulse"></i> 紀錄情緒
      </button>
    `;

    card.querySelector(".record-action-btn").addEventListener("click", (e) => {
      const name = e.currentTarget.getAttribute("data-name");
      showRecordModal(true, name);
    });

    studentsGrid.appendChild(card);
  });
}

// 渲染情緒歷史紀錄
function renderHistory() {
  historyList.innerHTML = "";
  
  const searchVal = searchInput.value.toLowerCase().trim();
  
  const filtered = allRecords.filter(r => {
    const matchGrade = r.grade === currentGrade;
    const matchSearch = r.name.toLowerCase().includes(searchVal) || r.note.toLowerCase().includes(searchVal);
    return matchGrade && matchSearch;
  });

  if (filtered.length === 0) {
    noHistoryData.classList.remove("hidden");
  } else {
    noHistoryData.classList.add("hidden");
    
    filtered.forEach(r => {
      const li = document.createElement("li");
      li.className = "history-item";
      
      const parsed = parseEmotion(r.emotion);
      let emoStyle = "status-none";
      const emo = parsed.emoji;
      
      if (emo === "😊" || emo === "🤩" || emo === "🤪") {
        emoStyle = "status-happy";
      } else if (emo === "😐") {
        emoStyle = "status-calm";
      } else if (emo === "😢" || emo === "😴") {
        emoStyle = "status-sad";
      } else if (emo === "😡") {
        emoStyle = "status-angry";
      } else if (emo === "😰") {
        emoStyle = "status-anxious";
      } else {
        emoStyle = "status-custom";
      }

      li.innerHTML = `
        <div class="history-meta">
          <span class="history-emo-indicator">${parsed.emoji}</span>
          <div class="history-details">
            <h4>
              ${r.name} 
              <span class="student-status-label ${emoStyle}" style="font-size:0.65rem; padding:1px 4px">${parsed.text}</span>
            </h4>
            <div class="history-time"><i class="fa-regular fa-clock"></i> ${r.date}</div>
            ${r.note ? `<div class="history-note"><i class="fa-regular fa-comment"></i> ${escapeHTML(r.note)}</div>` : ""}
          </div>
        </div>
        <div class="history-actions">
          <button class="delete-record-btn" title="刪除此筆記錄" data-id="${r.id}">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </div>
      `;

      li.querySelector(".delete-record-btn").addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-id");
        handleDelete(id);
      });

      historyList.appendChild(li);
    });
  }
}

// 提交情緒紀錄
async function handleRecordSubmit(e) {
  e.preventDefault();
  
  const name = recordStudentName.value;
  const date = recordDate.value;
  const note = noteInput.value.trim();
  const password = sessionStorage.getItem("system_password");
  
  const emotionRadio = document.querySelector('input[name="emotion"]:checked');
  let emotion = emotionRadio ? emotionRadio.value : "😐";

  if (emotion === "custom") {
    const customVal = document.getElementById("customEmotionInput").value.trim();
    if (!customVal) {
      showToast("請輸入自訂情緒名稱", "error");
      return;
    }
    
    // 偵測開頭是否為 Emoji
    let hasEmoji = false;
    try {
      hasEmoji = /^\p{Extended_Pictographic}/u.test(customVal);
    } catch(err) {
      // 降級處理
      const firstChar = Array.from(customVal)[0];
      hasEmoji = firstChar && firstChar.charCodeAt(0) > 127 && !/[\u4e00-\u9fa5]/.test(firstChar);
    }

    if (hasEmoji) {
      emotion = customVal;
    } else {
      emotion = "💬 " + customVal;
    }
  }

  if (!password) {
    handleLock();
    return;
  }

  setSubmitting(true);

  const payload = {
    action: "addRecord",
    password: password,
    grade: currentGrade,
    name: name,
    date: date,
    emotion: emotion,
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
      showToast("情緒紀錄儲存成功", "success");
      showRecordModal(false);
      fetchData(); // 重新整理
    } else if (result.message === "Unauthorized") {
      showToast("登入已逾期，請重新解鎖", "error");
      handleLock();
    } else {
      throw new Error(result.message || "儲存失敗");
    }
  } catch (error) {
    console.error(error);
    showToast(`儲存失敗: ${error.message}`, "error");
  } finally {
    setSubmitting(false);
  }
}

// 刪除情緒紀錄
async function handleDelete(id) {
  if (!confirm("確定要刪除這筆情緒紀錄嗎？")) return;

  showToast("正在刪除紀錄...", "info");
  const password = sessionStorage.getItem("system_password");

  if (!password) {
    handleLock();
    return;
  }

  const payload = {
    action: "deleteRecord",
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
      showToast("紀錄已成功刪除", "success");
      fetchData(); // 重新整理
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
    btnText.textContent = "儲存紀錄";
    btnLoader.classList.add("hidden");
  }
}

// 渲染 Chart.js 情緒比例圖
function renderChart() {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  const gradeSummary = emotionSummary[currentGrade] || { 
    "😊": 0, "😐": 0, "🤩": 0, "😢": 0, "😡": 0, "😰": 0, "😴": 0, "🤪": 0, "其他": 0, 
    "total": 0 
  };
  const total = gradeSummary.total || 0;

  if (total === 0) {
    noChartData.classList.remove("hidden");
    document.getElementById("emotionChart").style.display = "none";
    return;
  }

  noChartData.classList.add("hidden");
  const chartCanvas = document.getElementById("emotionChart");
  chartCanvas.style.display = "block";

  const labels = [
    "開心 😊", "平靜 😐", "興奮 🤩", "難過 😢", "生氣 😡", "焦慮 😰", "疲倦 😴", "搞怪 🤪", "其他 💬"
  ];
  const datasetValues = [
    gradeSummary["😊"] || 0,
    gradeSummary["😐"] || 0,
    gradeSummary["🤩"] || 0,
    gradeSummary["😢"] || 0,
    gradeSummary["😡"] || 0,
    gradeSummary["😰"] || 0,
    gradeSummary["😴"] || 0,
    gradeSummary["🤪"] || 0,
    gradeSummary["其他"] || 0
  ];

  const backgroundColors = [
    "#f59e0b", // 😊 開心
    "#10b981", // 😐 平靜
    "#fb923c", // 🤩 興奮
    "#3b82f6", // 😢 難過
    "#ef4444", // 😡 生氣
    "#a855f7", // 😰 焦慮
    "#6366f1", // 😴 疲倦
    "#ec4899", // 🤪 搞怪
    "#06b6d4"  // 其他
  ];
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const textColor = currentTheme === "light" ? "#1e293b" : "#f3f4f6";
  const borderColor = currentTheme === "light" ? "#ffffff" : "rgba(255,255,255,0.06)";

  chartInstance = new Chart(chartCanvas, {
    type: "doughnut",
    data: {
      labels: labels,
      datasets: [{
        data: datasetValues,
        backgroundColor: backgroundColors,
        borderColor: borderColor,
        borderWidth: 2,
        hoverOffset: 12
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: textColor,
            font: {
              family: "'Plus Jakarta Sans', 'Noto Sans TC', sans-serif",
              size: 11
            },
            padding: 15
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const value = context.raw || 0;
              const percentage = ((value / total) * 100).toFixed(1);
              return ` ${context.label}: ${value} 筆 (${percentage}%)`;
            }
          }
        }
      },
      cutout: "60%"
    }
  });
}

function getEmotionText(emoji) {
  const mapping = {
    "😊": "開心",
    "😐": "平靜",
    "🤩": "興奮",
    "😢": "難過",
    "😡": "生氣",
    "😰": "焦慮",
    "😴": "疲倦",
    "🤪": "搞怪"
  };
  return mapping[emoji] || "其他";
}

// 解析資料庫儲存的情緒格式為 { emoji, text }
function parseEmotion(emoStr) {
  if (!emoStr) return { emoji: "❓", text: "無" };
  
  // 支援舊的只有單個 emoji 的情況
  const mapping = {
    "😊": "開心",
    "😐": "平靜",
    "🤩": "興奮",
    "😢": "難過",
    "😡": "生氣",
    "😰": "焦慮",
    "😴": "疲倦",
    "🤪": "搞怪"
  };
  if (mapping[emoStr]) {
    return { emoji: emoStr, text: mapping[emoStr] };
  }

  // 處理自訂情緒：如 "💬 放鬆" 或 "😎 酷"
  const chars = Array.from(emoStr);
  if (chars.length > 0) {
    const firstChar = chars[0];
    const textPart = emoStr.substring(firstChar.length).trim();
    if (textPart) {
      return { emoji: firstChar, text: textPart };
    } else {
      return { emoji: firstChar, text: getEmotionText(firstChar) };
    }
  }
  return { emoji: "💬", text: emoStr };
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
