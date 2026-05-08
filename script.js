// State Management
let state = {
    points: 0,
    tasks: [],
    rewards: []
};

let editingTaskId = null;
let editingRewardId = null;
let collapsedFolders = new Set();
let shuffleInterval; // For the randomizer
let currentSubtasks = []; // Holds subtasks temporarily while modal is open

const DIFFICULTY_MAP = { trivial: 2, easy: 5, medium: 10, hard: 20, expert: 30 };

function loadQuotes() {
    fetch('quotes.txt')
        .then(response => {
            // If the file doesn't exist, this throws an error and jumps to .catch
            if (!response.ok) throw new Error("File not found");
            return response.text();
        })
        .then(text => {
            // Split by line breaks and filter out any empty lines
            const quotes = text.split(/\r?\n/).filter(line => line.trim() !== '');
            if (quotes.length > 0) {
                // Pick a random quote
                const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
                
                // Inject it into both HTML locations
                const qDesktop = document.getElementById('quote-desktop');
                const qMobile = document.getElementById('quote-mobile');
                if (qDesktop) qDesktop.innerText = `${randomQuote}`;
                if (qMobile) qMobile.innerText = `${randomQuote}`;
            }
        })
        .catch(err => {
            // Silently fail if file isn't found - page acts like nothing is wrong
            console.log("Quotes file not found or empty, skipping.");
        });
}

// Ensure points are always rounded down for display, keeping decimals hidden in state
function updatePointsDisplay() {
    document.getElementById('brownie-points').innerText = Math.floor(state.points);
}

// Helper to get local YYYY-MM-DD
function getTodayString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

const THEME_PRESETS = [
    '#d4a373', // Your Original Default (Pocket Brownie)
    '#e76f51', // Coral Red
    '#2a9d8f', // Teal
    '#e9c46a', // Yellow
    '#8ab17d', // Sage Green
    '#b5838d'  // Mauve/Purple
];

// Initialization
function init() {
    const savedData = localStorage.getItem('pocketBrownie');
    if (savedData) {
        state = JSON.parse(savedData);
        if (!state.themeColor) state.themeColor = THEME_PRESETS[0];
    } else {
        // PRESET TUTORIAL DATA
        state.tasks = [
            { id: 1, title: "Welcome to Pocket Brownie! 🎉", type: "todos", difficulty: "trivial", 
                folder: "Tutorial", notes: "Click the ✔ to complete this task!", createdDate: getTodayString() },
            { id: 2, title: "Add task", type: "todos", difficulty: "trivial", 
                folder: "Tutorial", notes: "Click the '+' icon located at the top right to add a task item.", 
                createdDate: getTodayString() },
            { id: 2, title: "Edit task", type: "todos", difficulty: "trivial", 
                folder: "Tutorial", notes: "Click on any task to edit it", 
                createdDate: getTodayString() },
            { id: 4, title: "Due dates", type: "todos", difficulty: "easy", "dueDate": "2000-01-01", 
                folder: "Tutorial", notes: "Tasks due or overdue will be colored and indicated on the 'Calendar' tab.", 
                createdDate: getTodayString() },
            { id: 5, title: "Checklist", type: "chores", difficulty: "trivial", recurType: "monthly", recurInterval: 1, 
                dueDate: getTodayString(), subtasks: [{id: 11, title: "Check one subtask to get partial points", completed: false}, 
                {id: 12, title: "Check all subtasks or the main task to receive all points✨", completed: false}, 
                {id: 13, title: "The due date will be pushed back by a set time once the 'Chore' is complete ⏰", completed: false}],
                createdDate: getTodayString() },
            { id: 6, title: "Drink Water", type: "habits", difficulty: "trivial", 
                folder: "Health", notes: "Habits don't have due dates, do them anytime, multiple times!", 
                "habitReset": "daily", "habitCount": 0, createdDate: getTodayString() }
        ];
        state.rewards = [
            { id: 101, name: "Guilt-free Gaming Hour", cost: 30 },
            { id: 102, name: "Treat", cost: 50 }
        ];
        state.points = 0;
        state.themeColor = THEME_PRESETS[0];
        saveData();
    }
    applyThemeColor(state.themeColor);
    // Auto-collapse all folders on load
    state.tasks.forEach(task => {
        if (task.folder) collapsedFolders.add(task.folder);
    });
    
    // Explicitly collapse the future calendar folders
    collapsedFolders.add('dash-Tomorrow');
    collapsedFolders.add('dash-Upcoming');
    
    // Ensure Overdue and Today stay open
    collapsedFolders.delete('dash-Overdue');
    collapsedFolders.delete('dash-Today');

    // Call our quotes!
    loadQuotes();
    
    checkDailyUpdates();
    renderAll();
}

function saveData() {
    localStorage.setItem('pocketBrownie', JSON.stringify(state));
    updatePointsDisplay();
}
// --- THEME LOGIC ---

function openThemeModal() {
    renderThemeSwatches();
    document.getElementById('theme-modal').style.display = 'flex';
}

function closeThemeModal(event) {
    // If an event is passed, only close if the background (not the modal content) was clicked
    if (event && event.target.id !== 'theme-modal') return;
    document.getElementById('theme-modal').style.display = 'none';
}

function renderThemeSwatches() {
    const container = document.getElementById('theme-swatches');
    container.innerHTML = ''; // Clear previous swatches

    THEME_PRESETS.forEach(color => {
        const isActive = state.themeColor === color ? 'active' : '';
        container.innerHTML += `
            <div class="theme-swatch ${isActive}" 
                 style="background-color: ${color};" 
                 onclick="setThemeColor('${color}')">
            </div>
        `;
    });
}

function setThemeColor(color) {
    state.themeColor = color;
    applyThemeColor(color);
    saveData();
    renderThemeSwatches(); // Re-render to update the "active" highlight ring
}

function applyThemeColor(color) {
    // Dynamically overwrites the CSS root variable!
    document.documentElement.style.setProperty('--accent', color);
    
    // Optional: Update the meta theme-color so the mobile browser's top bar matches
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', color);
}

// UI Navigation with Animation Support
function switchTab(tabName, direction = 'fade') {
    // 1. Safely highlight the correct navbar item without relying on mouse events
    document.querySelectorAll('.nav-links li').forEach(li => {
        li.classList.remove('active');
        // If the li's onclick attribute contains our target tab, highlight it
        if (li.getAttribute('onclick').includes(tabName)) {
            li.classList.add('active');
        }
    });

    // 2. Hide all views and remove old animation classes
    document.querySelectorAll('.tab-view').forEach(view => {
        view.classList.remove('active-view', 'slide-left', 'slide-right', 'fade');
    });

    // 3. Show the new view and apply the requested animation
    const activeView = document.getElementById(`view-${tabName}`);
    activeView.classList.add('active-view', direction);

    // 4. Update Header Title
    const titles = { calendar: "Calendar", todos: "To-Do List", chores: "Chores", habits: "Habits", rewards: "Rewards" };
    document.getElementById('current-tab-title').innerText = titles[tabName];
    
    renderAll();
}

function toggleFolder(folderName) {
    if (collapsedFolders.has(folderName)) {
        collapsedFolders.delete(folderName);
    } else {
        collapsedFolders.add(folderName);
    }
    renderAll();
}

// Modal Logic
function openModal(defaultFolder = '') { // Now accepts a folder name
    editingTaskId = null;
    currentSubtasks = []; // Reset subtasks
    document.getElementById('modal-title').innerText = "Add New Item";
    document.getElementById('task-title').value = '';
    document.getElementById('task-difficulty').value = 'medium'; // Default
    document.getElementById('task-date').value = '';
    
    // NEW: Set the folder if passed
    document.getElementById('task-folder').value = defaultFolder; 
    
    document.getElementById('task-notes').value = '';
    document.getElementById('new-subtask-title').value = '';
    document.getElementById('task-habit-reset').value = 'daily'; 

    // NEW: Auto-detect active tab and set category
    const activeViewId = document.querySelector('.tab-view.active-view').id;
    let currentTab = activeViewId.replace('view-', '');
    
    if (currentTab === 'calendar' || currentTab === 'rewards') {
        currentTab = 'todos'; // Default to To-Do on tabs that aren't categories
    }
    document.getElementById('task-category').value = currentTab;

    renderModalSubtasks();
    document.getElementById('task-modal').style.display = 'flex';
    toggleCategoryFields()
}

function closeModal() {
    document.getElementById('task-modal').style.display = 'none';
    editingTaskId = null;
}

function toggleCategoryFields() {
    const type = document.getElementById('task-category').value;
    const recurType = document.getElementById('task-recur-type').value;

    document.getElementById('date-group').style.display = (type === 'habits') ? 'none' : 'block';
    document.getElementById('folder-group').style.display = (type === 'todos') ? 'block' : 'none';
    document.getElementById('chore-group').style.display = (type === 'chores') ? 'block' : 'none';
    document.getElementById('task-recur-days').style.display = (recurType === 'interval') ? 'block' : 'none';
    document.getElementById('habit-group').style.display = (type === 'habits') ? 'block' : 'none';
    document.getElementById('subtasks-group').style.display = (type === 'chores') ? 'block' : 'none';
}

// Task Management
function saveTask() {
    const title = document.getElementById('task-title').value;
    if (!title) return alert("Task needs a title!");

    const taskType = document.getElementById('task-category').value;
    
    const taskData = {
        title: title,
        type: taskType,
        difficulty: document.getElementById('task-difficulty').value,
        dueDate: document.getElementById('task-date').value,
        folder: document.getElementById('task-folder').value || 'Uncategorized',
        notes: document.getElementById('task-notes').value,
        recurType: document.getElementById('task-recur-type').value,
        recurInterval: parseInt(document.getElementById('task-recur-days').value) || 1,
        subtasks: taskType === 'chores' ? [...currentSubtasks] : [],
        habitReset: document.getElementById('task-habit-reset').value,
        habitCount: editingTaskId ? (state.tasks.find(t=>t.id===editingTaskId).habitCount || 0) : 0,
        lastResetDate: editingTaskId ? (state.tasks.find(t=>t.id===editingTaskId).lastResetDate || getTodayString()) : getTodayString()
    };

    if (editingTaskId) {
        const taskIndex = state.tasks.findIndex(t => t.id === editingTaskId);
        if(taskIndex !== -1) {
            state.tasks[taskIndex] = { ...state.tasks[taskIndex], ...taskData };
        }
    } else {
        state.tasks.push({ id: Date.now(), completed: false, createdDate: getTodayString(), ...taskData });
    }

    saveData();
    closeModal();
    renderAll();
}

function editTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;

    editingTaskId = id;
    currentSubtasks = task.subtasks ? [...task.subtasks] : []; // Load existing subtasks
    
    document.getElementById('modal-title').innerText = "Edit Item";
    document.getElementById('task-title').value = task.title;
    document.getElementById('task-category').value = task.type;
    document.getElementById('task-difficulty').value = task.difficulty || 'medium';
    document.getElementById('task-date').value = task.dueDate || '';
    document.getElementById('task-folder').value = task.folder || '';
    document.getElementById('task-notes').value = task.notes || '';
    document.getElementById('task-recur-type').value = task.recurType || 'weekly';
    document.getElementById('task-recur-days').value = task.recurInterval || '';
    document.getElementById('task-habit-reset').value = task.habitReset || 'daily';
    
    renderModalSubtasks();
    toggleCategoryFields();
    document.getElementById('task-modal').style.display = 'flex';
}

function toggleTaskComplete(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;

    let pts = calculateTaskPoints(task);

    if (task.type === 'habits') {
        task.habitCount = (task.habitCount || 0) + 1;
        state.points += pts;
        
        if (navigator.vibrate) navigator.vibrate(50);
        
        triggerCelebration(id, () => {
            saveData();
            renderAll();
        });
        return; // Stop the rest of the function from running
    }

    if (!task.completed) {
        // Complete main task and all its subtasks
        if (task.subtasks && task.subtasks.length > 0) {
            let subPts = pts / task.subtasks.length;
            task.subtasks.forEach(s => {
                if (!s.completed) {
                    s.completed = true;
                    state.points += subPts;
                }
            });
        } else {
            state.points += pts;
        }
        task.completed = true;
        if (navigator.vibrate) navigator.vibrate(50);
        // NEW: Trigger celebration, THEN render and save
        triggerCelebration(id, () => {
            handleChoreRecurrence(task);
            saveData();
            renderAll();
        });
        return;
    } else {
        // Incomplete task
        if (task.subtasks && task.subtasks.length > 0) {
            let subPts = pts / task.subtasks.length;
            task.subtasks.forEach(s => {
                if (s.completed) {
                    s.completed = false;
                    state.points -= subPts;
                }
            });
        } else {
            state.points -= pts;
        }
        task.completed = false;
    }
    saveData(); 
    renderAll();
}

function deleteTask(id) {
    if (!confirm("Are you sure you want to delete this item?")) return;
    
    state.tasks = state.tasks.filter(t => t.id !== id);
    saveData();
    renderAll();
}

function checkDailyUpdates() {
    let dataChanged = false;
    const today = getTodayString();
    
    state.tasks.forEach(task => {
        // Handle Habit Resets
        if (task.type === 'habits' && task.habitReset && task.habitReset !== 'never') {
            if (!task.lastResetDate) task.lastResetDate = task.createdDate || today;

            let shouldReset = false;
            // Create proper Date objects for accurate math
            const lastDate = new Date(task.lastResetDate + 'T00:00:00');
            const currDate = new Date(today + 'T00:00:00');

            if (task.habitReset === 'daily' && today > task.lastResetDate) {
                shouldReset = true;
            } else if (task.habitReset === 'weekly') {
                const diffDays = Math.floor((currDate - lastDate) / (1000 * 60 * 60 * 24));
                if (diffDays >= 7) shouldReset = true;
            } else if (task.habitReset === 'monthly') {
                if (currDate.getMonth() !== lastDate.getMonth() || currDate.getFullYear() !== lastDate.getFullYear()) {
                    shouldReset = true;
                }
            }

            if (shouldReset) {
                task.habitCount = 0;
                task.lastResetDate = today;
                dataChanged = true;
            }
        }
    });
    state.tasks.forEach(task => {
        if (!task.completed && task.dueDate && task.dueDate < today) {
            // Future decay logic
        }
    });
    if (dataChanged) saveData();
}

function toggleSubtaskComplete(taskId, subtaskId) {
    const task = state.tasks.find(t => t.id === taskId);
    const subtask = task.subtasks.find(s => s.id === subtaskId);
    
    let totalPts = calculateTaskPoints(task);
    let subPts = totalPts / task.subtasks.length;

    if (!subtask.completed) {
        subtask.completed = true;
        state.points += subPts;
        if (navigator.vibrate) navigator.vibrate(20);
    } else {
        subtask.completed = false;
        state.points -= subPts;
    }

    // Auto-complete main task if all subtasks are checked
    let allDone = task.subtasks.every(s => s.completed);
    if (allDone && !task.completed) {
        task.completed = true;
        if (navigator.vibrate) navigator.vibrate(50);
        setTimeout(() => {
            handleChoreRecurrence(task);
            saveData(); 
            renderAll();
        }, 150); // tiny delay so the user sees the final checkbox get ticked
        return; // handleChoreRecurrence already calls renderAll
    } else if (!allDone && task.completed) {
        task.completed = false;
    }
    
    saveData(); 
    renderAll();
}

function handleChoreRecurrence(task) {
    if (task.type === 'chores' && task.dueDate) {
        let parts = task.dueDate.split('-');
        let currentDue = new Date(parts[0], parts[1] - 1, parts[2]);
        
        if (task.recurType === 'weekly') currentDue.setDate(currentDue.getDate() + 7);
        else if (task.recurType === 'monthly') currentDue.setMonth(currentDue.getMonth() + 1);
        else if (task.recurType === 'interval') currentDue.setDate(currentDue.getDate() + task.recurInterval);

        const yyyy = currentDue.getFullYear();
        const mm = String(currentDue.getMonth() + 1).padStart(2, '0');
        const dd = String(currentDue.getDate()).padStart(2, '0');
        
        task.dueDate = `${yyyy}-${mm}-${dd}`;
        task.completed = false; 
        
        // Reset subtasks for the new cycle
        if (task.subtasks) {
            task.subtasks.forEach(s => s.completed = false);
        }
    }
}

function undoHabit(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task || task.type !== 'habits') return;
    
    if ((task.habitCount || 0) > 0) {
        task.habitCount -= 1;
        state.points -= calculateTaskPoints(task);
        saveData();
        renderAll();
    }
}

function getTaskHTML(task) {
    let statusClass = task.completed ? 'completed' : '';
    let relDate = getRelativeDateString(task.dueDate);
    
    if (!task.completed && task.dueDate) {
        if (relDate === 'Due today') statusClass = 'due-today';
        if (relDate === 'Overdue') statusClass = 'overdue';
    }

    // Points Display Math
    let ptsValue = calculateTaskPoints(task);
    let isOverdue = (relDate === 'Overdue' && !task.completed);
    let ptsDisplay = `+${ptsValue}`;
    if (isOverdue) ptsDisplay += ` (Half pts)`;

    // Subtasks HTML
    let subtasksHTML = '';
    if (task.type === 'chores' && task.subtasks && task.subtasks.length > 0) {
        subtasksHTML = '<div class="subtasks-container" style="margin-top: 10px; border-top: 1px solid #333; padding-top: 10px;">';
        task.subtasks.forEach(sub => {
            let checked = sub.completed ? 'checked' : '';
            let textClass = sub.completed ? 'style="text-decoration:line-through; opacity:0.6;"' : '';
            subtasksHTML += `
                <label onclick="event.stopPropagation();" style="display:flex; align-items:center; gap:8px; margin-bottom: 6px; font-size:0.95rem; cursor:pointer;">
                    <input type="checkbox" ${checked} onchange="toggleSubtaskComplete(${task.id}, ${sub.id})" style="transform: scale(1.3); cursor:pointer;">
                    <span ${textClass}>${sub.title}</span>
                </label>
            `;
        });
        subtasksHTML += '</div>';
        ptsDisplay = `${ptsValue} pts total`; // Change formatting if divided
    }

    let subtext = `${task.dueDate ? '| ' + relDate : ''}`;
    let completeBtnHTML = `<button class="btn-primary complete-btn-${task.id}" onclick="event.stopPropagation(); toggleTaskComplete(${task.id})">✔</button>`;    
    if (task.type === 'chores') {
        if (task.recurType === 'weekly') subtext += ' (Weekly)';
        else if (task.recurType === 'monthly') subtext += ' (Monthly)';
        else if (task.recurType === 'interval') subtext += ` (Every ${task.recurInterval} days)`;
    } else if (task.type === 'habits') {
        let count = task.habitCount || 0;
        let resetText = task.habitReset ? task.habitReset.charAt(0).toUpperCase() + task.habitReset.slice(1) : 'Daily';
        subtext = `Resets: ${resetText} | <strong style="color:var(--accent);">${count}</strong>`;
        completeBtnHTML = `
            <button class="btn-cancel" onclick="event.stopPropagation(); undoHabit(${task.id})" title="Undo">➖</button>
            <button class="btn-primary complete-btn-${task.id}" onclick="event.stopPropagation(); toggleTaskComplete(${task.id})">➕</button>
    `;
}

    return `
        <div class="task-item ${statusClass}" onclick="editTask(${task.id})">
            <div class="task-top-row">
                <div class="task-info">
                    <h4 style="margin-bottom:4px;">${task.title} <span style="font-weight:normal; font-size:0.8rem; color:var(--accent);">(${ptsDisplay})</span></h4>
                    <small>${subtext}</small>
                </div>
                <div class="task-actions" style="margin-left: 10px;">
                    ${completeBtnHTML}
                    <button class="btn-cancel" onclick="event.stopPropagation(); deleteTask(${task.id})">🗑</button>
                </div>
            </div>
            ${task.notes ? `<small><em>${task.notes}</em></small>` : ''}
            ${subtasksHTML}
        </div>
    `;
}

// Rendering Tasks & Sorting
function renderAll() {
    updatePointsDisplay();
    const today = getTodayString();
    
    // Sort logic: Date -> Points (Descending) -> Alphabetical
    const sortedTasks = [...state.tasks].sort((a, b) => {
        // 1. Sort by Due Date first
        if (a.dueDate && b.dueDate) {
            const dateA = new Date(a.dueDate);
            const dateB = new Date(b.dueDate);
            if (dateA < dateB) return -1;
            if (dateA > dateB) return 1;
        } else if (a.dueDate) {
            return -1; // 'a' has a date, push it up
        } else if (b.dueDate) {
            return 1;  // 'b' has a date, push it up
        }
        
        // 2. If dates match (or neither has a date), sort by Points (highest first)
        const ptsA = calculateTaskPoints(a);
        const ptsB = calculateTaskPoints(b);
        if (ptsB !== ptsA) {
            return ptsB - ptsA; 
        }
        
        // 3. Fallback to alphabetical if everything else is tied
        return a.title.localeCompare(b.title);
    });

    const lists = { calendar: [], todos: [], chores: [], habits: [] };

    sortedTasks.forEach(task => {
        
        // NEW: "Upcoming" Dashboard Logic
        let isHabitZero = task.type === 'habits' && (task.habitCount || 0) === 0;
        let isPendingTaskWithDate = (task.type === 'todos' || task.type === 'chores') && task.dueDate && !task.completed;
        
        // Push everything that matches into the first tab
        if (isPendingTaskWithDate || isHabitZero) {
            lists.calendar.push(task); 
        }

        // Standard Tab Logic
        if(task.type === 'todos') lists.todos.push(task);
        if(task.type === 'chores') lists.chores.push(task);
        if(task.type === 'habits') lists.habits.push(task);
    });

    // Render Chores and Habits normally
    ['chores', 'habits'].forEach(type => {
        const container = document.getElementById(`list-${type}`);
        container.innerHTML = lists[type].map(task => getTaskHTML(task)).join('');
    });

    // NEW: Render Dashboard (Calendar) with Collapsible Date Folders
    const calendarContainer = document.getElementById('list-calendar');
    const dateGroups = {
        "Overdue": [],
        "Today": [],
        "Tomorrow": [],
        "Upcoming": []
    };

    lists.calendar.forEach(task => {
        // Zero-count habits go into Today so you see them immediately
        if (task.type === 'habits') {
            dateGroups["Today"].push(task); 
        } else if (task.dueDate) {
            let due = new Date(task.dueDate);
            let now = new Date(today);
            let diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
            
            if (diffDays < 0) dateGroups["Overdue"].push(task);
            else if (diffDays === 0) dateGroups["Today"].push(task);
            else if (diffDays === 1) dateGroups["Tomorrow"].push(task);
            else dateGroups["Upcoming"].push(task);
        }
    });

    let calendarHTML = '';
    const groupOrder = ["Overdue", "Today", "Tomorrow", "Upcoming"];

    groupOrder.forEach(groupName => {
        if (dateGroups[groupName].length > 0) {
            // We give these folders a "dash-" prefix so they don't accidentally link to To-Do folders with the same name
            const folderKey = `dash-${groupName}`;
            const isCollapsed = collapsedFolders.has(folderKey);
            
            // Add custom colors to the folder titles to make urgent items pop!
            let titleColor = 'var(--text-main)';
            if (groupName === 'Overdue') titleColor = 'var(--overdue)';
            if (groupName === 'Today') titleColor = 'var(--due-today)';

            calendarHTML += `
                <div class="folder-header" onclick="toggleFolder('${folderKey}')">
                    <span style="color: ${titleColor};">${groupName}</span>
                    <div class="folder-header-actions">
                        <span class="caret ${isCollapsed ? 'collapsed' : ''}">▼</span>
                    </div>
                </div>
                <div class="folder-content ${isCollapsed ? 'collapsed' : ''}">
                    ${dateGroups[groupName].map(task => getTaskHTML(task)).join('')}
                </div>
            `;
        }
    });

    // Friendly empty state
    if (calendarHTML === '') {
        calendarHTML = `<p style="text-align:center; color:var(--text-muted); margin-top:2rem;">All caught up! 🎉</p>`;
    }

    calendarContainer.innerHTML = calendarHTML;

    // Render To-Dos (Grouped by Folder and Sorted Alphabetically)
    const todosContainer = document.getElementById('list-todos');
    const folders = {};
    
    lists.todos.forEach(task => {
        const folderName = task.folder || 'Uncategorized';
        if (!folders[folderName]) folders[folderName] = [];
        folders[folderName].push(task);
    });

    let todosHTML = '';
    // Sort folder names alphabetically
    const sortedFolders = Object.keys(folders).sort((a, b) => a.localeCompare(b));

    sortedFolders.forEach(folderName => {
        const isCollapsed = collapsedFolders.has(folderName);
        todosHTML += `
            <div class="folder-header" onclick="toggleFolder('${folderName}')">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <button class="btn-primary" onclick="event.stopPropagation(); openModal('${folderName}')" style="width: 28px; height: 28px; font-size: 16px; padding: 0; display: inline-flex; justify-content: center; align-items: center;" title="Add task to folder">+</button>
                    <span>${folderName}</span>
                </div>
                <div class="folder-header-actions">
                    <button class="btn-random" onclick="startRandomizer('${folderName}', event)" title="Pick Random Task">🎲</button>
                    <span class="caret ${isCollapsed ? 'collapsed' : ''}">▼</span>
                </div>
            </div>
            <div class="folder-content ${isCollapsed ? 'collapsed' : ''}">
                ${folders[folderName].map(task => getTaskHTML(task)).join('')}
            </div>
        `;
    });
    todosContainer.innerHTML = todosHTML;

    renderRewards();
}

// Randomizer System
function startRandomizer(folderName, event) {
    event.stopPropagation(); // Stops the folder from opening/closing

    const folderTasks = state.tasks.filter(t => t.folder === folderName && t.type === 'todos' && !t.completed);
    
    if (folderTasks.length === 0) {
        alert(`No uncompleted tasks left in ${folderName}!`);
        return;
    }

    document.getElementById('random-folder-name').innerText = `Choosing from: ${folderName}`;
    document.getElementById('btn-close-random').style.display = 'none';
    document.getElementById('random-modal').style.display = 'flex';
    
    const displayBox = document.getElementById('random-animation-box');
    let counter = 0;
    const duration = 2000; // Spin for 2 seconds
    const speed = 100; // Swap text every 100ms

    shuffleInterval = setInterval(() => {
        const randomTask = folderTasks[Math.floor(Math.random() * folderTasks.length)];
        displayBox.innerText = randomTask.title;
        counter += speed;

        if (counter >= duration) {
            clearInterval(shuffleInterval);
            const winner = folderTasks[Math.floor(Math.random() * folderTasks.length)];
            displayBox.innerHTML = `🎉 <br> <span style="color:var(--text-main); font-size:1.8rem; margin-top:10px; display:block;">${winner.title}</span>`;
            document.getElementById('btn-close-random').style.display = 'inline-block';
        }
    }, speed);
}

function closeRandomModal() {
    clearInterval(shuffleInterval);
    document.getElementById('random-modal').style.display = 'none';
}

// Rewards System
function saveReward() {
    const name = document.getElementById('reward-name').value;
    const cost = parseInt(document.getElementById('reward-cost').value);
    
    if (!name || !cost) return alert("Please enter a name and cost.");

    if (editingRewardId) {
        const reward = state.rewards.find(r => r.id === editingRewardId);
        if (reward) {
            reward.name = name;
            reward.cost = cost;
        }
        cancelEditReward();
    } else {
        state.rewards.push({ id: Date.now(), name, cost });
        document.getElementById('reward-name').value = '';
        document.getElementById('reward-cost').value = '';
    }
    
    saveData();
    renderRewards();
}

function editReward(id) {
    const reward = state.rewards.find(r => r.id === id);
    if (!reward) return;

    editingRewardId = id;
    document.getElementById('reward-name').value = reward.name;
    document.getElementById('reward-cost').value = reward.cost;
    document.getElementById('btn-add-reward').innerText = "+";
    document.getElementById('btn-cancel-reward').style.display = "inline-block";
}

function cancelEditReward() {
    editingRewardId = null;
    document.getElementById('reward-name').value = '';
    document.getElementById('reward-cost').value = '';
    document.getElementById('btn-add-reward').innerText = "+";
    document.getElementById('btn-cancel-reward').style.display = "none";
}

function deleteReward(id) {
    if (!confirm("Are you sure you want to delete this reward?")) return;
    
    state.rewards = state.rewards.filter(r => r.id !== id);
    if(editingRewardId === id) cancelEditReward();
    saveData();
    renderRewards();
}

function buyReward(id) {
    const reward = state.rewards.find(r => r.id === id);
    if (state.points >= reward.cost) {
        state.points -= reward.cost;
        alert(`You bought: ${reward.name}! Enjoy!`);
        saveData();
        renderAll();
    } else {
        alert("Not enough Brownie Points!");
    }
}

function renderRewards() {
    const container = document.getElementById('list-rewards');
    container.innerHTML = '';
    state.rewards.forEach(reward => {
        container.innerHTML += `
            <div class="reward-item" onclick="editReward(${reward.id})">
                <div class="task-info">
                    <h4>${reward.name}</h4>
                    <small>Cost: ${reward.cost} pts</small>
                </div>
                <div class="task-actions">
                    <button class="btn-primary" onclick="event.stopPropagation(); buyReward(${reward.id})">Buy</button>
                    <button class="btn-cancel" onclick="event.stopPropagation(); deleteReward(${reward.id})">🗑</button>
                </div>
            </div>
        `;
    });
}

// --- Backup & Restore Functions ---

function exportData() {
    // 1. Convert current state to a string
    const dataStr = JSON.stringify(state, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    // 2. Create a temporary "download link"
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    
    // 3. Name the file with today's date
    const date = new Date().toISOString().split('T')[0];
    link.download = `brownie-backup-${date}.json`;
    link.href = url;
    
    // 4. Trigger the download and cleanup
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            
            // Basic validation to ensure it's a Pocket Brownie file
            if (importedData.hasOwnProperty('points') && importedData.hasOwnProperty('tasks')) {
                if (confirm("This will overwrite your current tasks and points. Proceed?")) {
                    state = importedData;
                    saveData(); // Save to localStorage
                    renderAll(); // Refresh the screen
                    alert("Data restored successfully!");
                }
            } else {
                alert("Invalid backup file format.");
            }
        } catch (err) {
            alert("Error reading file: " + err.message);
        }
    };
    reader.readAsText(file);
}

function calculateTaskPoints(task) {
    // Fallback for old tasks that used manual numbers before the update
    if (!task.difficulty && task.points) return task.points; 
    
    let base = DIFFICULTY_MAP[task.difficulty] || 0;
    
    // Halve points once if overdue
    const today = getTodayString();
    if (task.dueDate && task.dueDate < today) {
        base = base / 2;
    }
    return base;
}

function getRelativeDateString(dueDate) {
    if (!dueDate) return "";
    const due = new Date(dueDate.split('-')[0], dueDate.split('-')[1] - 1, dueDate.split('-')[2]);
    const now = new Date(getTodayString().split('-')[0], getTodayString().split('-')[1] - 1, getTodayString().split('-')[2]);
    
    const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return "Overdue";
    if (diffDays === 0) return "Due today";
    if (diffDays === 1) return "Due tomorrow";
    return `Due in ${diffDays} days`;
}

function renderModalSubtasks() {
    const list = document.getElementById('modal-subtask-list');
    list.innerHTML = '';
    currentSubtasks.forEach((sub, index) => {
        list.innerHTML += `
            <li style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-panel); padding:6px; border-radius:4px;">
                <span style="font-size:0.9rem;">${sub.title}</span>
                <button class="btn-cancel" style="padding:2px 6px; font-size:0.8rem;" onclick="removeModalSubtask(event, ${index})">✕</button>
            </li>
        `;
    });
}

function addModalSubtask(event) {
    event.preventDefault(); // Stop modal from closing
    const input = document.getElementById('new-subtask-title');
    if (input.value.trim()) {
        currentSubtasks.push({ id: Date.now() + Math.random(), title: input.value.trim(), completed: false });
        input.value = '';
        renderModalSubtasks();
    }
}

function removeModalSubtask(event, index) {
    event.preventDefault();
    currentSubtasks.splice(index, 1);
    renderModalSubtasks();
}

// --- CELEBRATION EFFECTS ---

// 1. Synthesize a happy "Ding!" sound offline
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playDing() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.type = 'sine';
    // Start at a high pitch (A5) and slide up rapidly to an even higher pitch (A6)
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); 
    oscillator.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.1); 
    
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime); // Volume
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3); // Fade out
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.3);
}

// 2. Native, offline confetti particle system
// Updated to accept X and Y coordinates
function fireConfetti(x, y) {
    const colors = ['#d4a373', '#e76f51', '#2a9d8f', '#e0e0e0', '#f4a261'];
    for (let i = 0; i < 40; i++) {
        let confetti = document.createElement('div');
        confetti.style.position = 'fixed';
        confetti.style.width = '7px';
        confetti.style.height = '7px';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        
        // Start exactly at the button's center
        confetti.style.top = y + 'px';
        confetti.style.left = x + 'px';
        
        confetti.style.zIndex = '9999';
        confetti.style.pointerEvents = 'none';
        confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px'; 
        
        document.body.appendChild(confetti);

        let angle = Math.random() * Math.PI * 2;
        let velocity = 6 + Math.random() * 12; // Explosive speed
        let vx = Math.cos(angle) * velocity;
        let vy = Math.sin(angle) * velocity - 5; 

        let opacity = 1;

        function animate() {
            vy += 0.4; // Gravity
            let currentTop = parseFloat(confetti.style.top);
            let currentLeft = parseFloat(confetti.style.left);
            confetti.style.top = (currentTop + vy) + 'px';
            confetti.style.left = (currentLeft + vx) + 'px';
            
            opacity -= 0.02;
            confetti.style.opacity = opacity;

            if (opacity > 0) {
                requestAnimationFrame(animate);
            } else {
                confetti.remove();
            }
        }
        requestAnimationFrame(animate);
    }
}

function triggerCelebration(taskId, callback) {
    playDing();
    
    // Find all checkmark buttons for this specific task
    const btns = document.querySelectorAll(`.complete-btn-${taskId}`);
    
    // Find the exact one that is currently visible on the screen
    const visibleBtn = Array.from(btns).find(b => b.offsetParent !== null);
    if (visibleBtn) {
        // Find the button's position on the screen
        const rect = visibleBtn.getBoundingClientRect();
        const centerX = rect.left + (rect.width / 2);
        const centerY = rect.top + (rect.height / 2);
        
        // Fire confetti from that center point
        fireConfetti(centerX, centerY);
        
        visibleBtn.classList.add('spin-anim');
        setTimeout(callback, 400); 
    } else {
        callback();
    }
}

// --- Mobile SWIPE NAVIGATION LOGIC ---
let touchStartX = 0;
let touchEndX = 0;
let touchStartY = 0;
let touchEndY = 0;

// Order of your tabs for swiping
const tabOrder = ['calendar', 'todos', 'chores', 'habits', 'rewards'];

// Listen to the main content area so swiping on the navbar doesn't trigger it
const contentArea = document.querySelector('.content');

contentArea.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
});

contentArea.addEventListener('touchend', e => {
    touchEndX = e.changedTouches[0].screenX;
    touchEndY = e.changedTouches[0].screenY;
    handleSwipe();
});

function handleSwipe() {
    const swipeDistanceX = touchEndX - touchStartX;
    const swipeDistanceY = Math.abs(touchEndY - touchStartY);
    
    // We only trigger if the horizontal swipe is greater than 50px
    // AND the vertical scroll is less than 50px (so scrolling down doesn't accidentally switch tabs)
    if (Math.abs(swipeDistanceX) > 50 && swipeDistanceY < 50) {
        // Find which tab is currently active
        const currentActive = document.querySelector('.nav-links li.active');
        let currentIndex = 0;
        
        // Match the active tab to our tabOrder array
        tabOrder.forEach((tab, index) => {
            if (currentActive.getAttribute('onclick').includes(tab)) {
                currentIndex = index;
            }
        });

        // Swipe Left (Go forward)
        if (swipeDistanceX < 0 && currentIndex < tabOrder.length - 1) {
            switchTab(tabOrder[currentIndex + 1], 'slide-left');
        }
        // Swipe Right (Go backward)
        if (swipeDistanceX > 0 && currentIndex > 0) {
            switchTab(tabOrder[currentIndex - 1], 'slide-right');
        }
    }
}

// --- MOBILE KEYBOARD FIX ---
// Forces the viewport to snap back to normal when the keyboard closes
document.addEventListener('focusout', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        setTimeout(() => {
            window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
        }, 100);
    }
});

// Start app
window.onload = init;
