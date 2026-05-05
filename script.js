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

// Helper to get local YYYY-MM-DD
function getTodayString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Initialization
function init() {
    const savedData = localStorage.getItem('pocketBrownie');
    if (savedData) {
        state = JSON.parse(savedData);
    }
    checkDailyUpdates();
    renderAll();
}

function saveData() {
    localStorage.setItem('pocketBrownie', JSON.stringify(state));
    document.getElementById('brownie-points').innerText = state.points;
}

// UI Navigation
function switchTab(tabName) {
    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
    event.currentTarget.classList.add('active');

    document.querySelectorAll('.tab-view').forEach(view => view.classList.remove('active-view'));
    document.getElementById(`view-${tabName}`).classList.add('active-view');

    const titles = { week: "This Week", todos: "To-Do List", chores: "Chores", habits: "Habits", rewards: "Rewards" };
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
function openModal() {
    editingTaskId = null;
    document.getElementById('modal-title').innerText = "Add New Item";
    document.getElementById('task-title').value = '';
    document.getElementById('task-points').value = '';
    document.getElementById('task-date').value = '';
    document.getElementById('task-folder').value = '';
    document.getElementById('task-notes').value = '';
    document.getElementById('task-recur-type').value = 'weekly';
    document.getElementById('task-recur-days').value = '';
    document.getElementById('task-modal').style.display = 'flex';
    toggleCategoryFields();
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
}

// Task Management
function saveTask() {
    const title = document.getElementById('task-title').value;
    if (!title) return alert("Task needs a title!");

    const taskData = {
        title: title,
        type: document.getElementById('task-category').value,
        points: parseInt(document.getElementById('task-points').value) || 0,
        dueDate: document.getElementById('task-date').value,
        folder: document.getElementById('task-folder').value || 'Uncategorized',
        notes: document.getElementById('task-notes').value,
        recurType: document.getElementById('task-recur-type').value,
        recurInterval: parseInt(document.getElementById('task-recur-days').value) || 1
    };

    if (editingTaskId) {
        const taskIndex = state.tasks.findIndex(t => t.id === editingTaskId);
        if(taskIndex !== -1) {
            state.tasks[taskIndex] = { ...state.tasks[taskIndex], ...taskData };
        }
    } else {
        state.tasks.push({
            id: Date.now(),
            completed: false,
            createdDate: getTodayString(),
            ...taskData
        });
    }

    saveData();
    closeModal();
    renderAll();
}

function editTask(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;

    editingTaskId = id;
    document.getElementById('modal-title').innerText = "Edit Item";
    document.getElementById('task-title').value = task.title;
    document.getElementById('task-category').value = task.type;
    document.getElementById('task-points').value = task.points;
    document.getElementById('task-date').value = task.dueDate || '';
    document.getElementById('task-folder').value = task.folder || '';
    document.getElementById('task-notes').value = task.notes || '';
    document.getElementById('task-recur-type').value = task.recurType || 'weekly';
    document.getElementById('task-recur-days').value = task.recurInterval || '';
    
    toggleCategoryFields();
    document.getElementById('task-modal').style.display = 'flex';
}

function toggleTaskComplete(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;

    if (!task.completed) {
        task.completed = true;
        state.points += task.points;
        
        // NEW: Trigger a 50ms vibration when a task is completed!
        if (navigator.vibrate) {
            navigator.vibrate(50); 
        }
    } else {
        task.completed = false;
        state.points -= task.points;
    }

    if (task.type === 'chores' && task.completed && task.dueDate) {
        let parts = task.dueDate.split('-');
        let currentDue = new Date(parts[0], parts[1] - 1, parts[2]);
        
        if (task.recurType === 'weekly') {
            currentDue.setDate(currentDue.getDate() + 7);
        } else if (task.recurType === 'monthly') {
            currentDue.setMonth(currentDue.getMonth() + 1);
        } else if (task.recurType === 'interval') {
            currentDue.setDate(currentDue.getDate() + task.recurInterval);
        }

        const yyyy = currentDue.getFullYear();
        const mm = String(currentDue.getMonth() + 1).padStart(2, '0');
        const dd = String(currentDue.getDate()).padStart(2, '0');
        
        task.dueDate = `${yyyy}-${mm}-${dd}`;
        task.completed = false; 
    }

    saveData();
    renderAll();
}

function deleteTask(id) {
    state.tasks = state.tasks.filter(t => t.id !== id);
    saveData();
    renderAll();
}

function checkDailyUpdates() {
    const today = getTodayString();
    state.tasks.forEach(task => {
        if (!task.completed && task.dueDate && task.dueDate < today) {
            // Future decay logic
        }
    });
}

function getTaskHTML(task) {
    const today = getTodayString();
    let statusClass = task.completed ? 'completed' : '';
    if (!task.completed && task.dueDate) {
        if (task.dueDate === today) statusClass = 'due-today';
        if (task.dueDate < today) statusClass = 'overdue';
    }

    let subtext = `${task.type === 'todos' ? task.folder : ''} ${task.dueDate ? '| Due: ' + task.dueDate : ''}`;
    if (task.type === 'chores') {
        if (task.recurType === 'weekly') subtext += ' (Weekly)';
        else if (task.recurType === 'monthly') subtext += ' (Monthly)';
        else if (task.recurType === 'interval') subtext += ` (Every ${task.recurInterval} days)`;
    }

    return `
        <div class="task-item ${statusClass}">
            <div class="task-info">
                <h4>${task.title} <span>(${task.points > 0 ? '+' : ''}${task.points} pts)</span></h4>
                <small>${subtext}</small>
                ${task.notes ? `<small><em>${task.notes}</em></small>` : ''}
            </div>
            <div class="task-actions">
                <button class="btn-primary" onclick="toggleTaskComplete(${task.id})">✔</button>
                <button class="btn-edit" onclick="editTask(${task.id})">✎</button>
                <button class="btn-cancel" onclick="deleteTask(${task.id})">🗑</button>
            </div>
        </div>
    `;
}

// Rendering Tasks & Sorting
function renderAll() {
    document.getElementById('brownie-points').innerText = state.points;
    const today = getTodayString();
    
    // Sort logic: First by Date, then Alphabetically if no date
    const sortedTasks = [...state.tasks].sort((a, b) => {
        if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return a.title.localeCompare(b.title);
    });

    const lists = { week: [], todos: [], chores: [], habits: [] };

    sortedTasks.forEach(task => {
        if (task.dueDate) {
            let due = new Date(task.dueDate);
            let now = new Date(today);
            let diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
            
            // Fixed Week Calendar Logic
            if ((diffDays >= 0 && diffDays <= 7) || (diffDays < 0 && !task.completed)) {
                lists.week.push(task);
            }
        }
        if(task.type === 'todos') lists.todos.push(task);
        if(task.type === 'chores') lists.chores.push(task);
        if(task.type === 'habits') lists.habits.push(task);
    });

    ['week', 'chores', 'habits'].forEach(type => {
        const container = document.getElementById(`list-${type}`);
        container.innerHTML = lists[type].map(task => getTaskHTML(task)).join('');
    });

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
                <span>${folderName}</span>
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
    document.getElementById('btn-add-reward').innerText = "Save Changes";
    document.getElementById('btn-cancel-reward').style.display = "inline-block";
}

function cancelEditReward() {
    editingRewardId = null;
    document.getElementById('reward-name').value = '';
    document.getElementById('reward-cost').value = '';
    document.getElementById('btn-add-reward').innerText = "Add Reward";
    document.getElementById('btn-cancel-reward').style.display = "none";
}

function deleteReward(id) {
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
            <div class="task-item">
                <div class="task-info">
                    <h4>${reward.name}</h4>
                    <small>Cost: ${reward.cost} pts</small>
                </div>
                <div class="task-actions">
                    <button class="btn-primary" onclick="buyReward(${reward.id})">Buy</button>
                    <button class="btn-edit" onclick="editReward(${reward.id})">✎</button>
                    <button class="btn-cancel" onclick="deleteReward(${reward.id})">🗑</button>
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

// Start app
window.onload = init;
