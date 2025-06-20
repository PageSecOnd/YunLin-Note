// 配置后端 API 地址
const API_BASE_URL = 'https://note.backend.yunlinsan.ren/api';

// 获取 DOM 元素
const editor = document.getElementById('editor');
const preview = document.getElementById('preview');
const status = document.getElementById('status');

// 保存计时器
let saveTimer = null;
let lastContent = '';

// 初始化应用
async function init() {
    // 从后端加载内容
    try {
        const response = await fetch(`${API_BASE_URL}/notes`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            mode: 'cors'
        });
        
        if (response.ok) {
            const data = await response.json();
            editor.value = data.content || '';
            lastContent = editor.value;
            updatePreview();
            status.textContent = '加载成功';
        } else {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    } catch (error) {
        console.error('加载笔记失败:', error);
        status.textContent = '加载失败 - 使用本地存储';
        loadFromLocalStorage();
    }

    // 设置编辑器事件监听
    editor.addEventListener('input', handleEditorInput);
    
    // 自动保存
    setInterval(saveContentIfChanged, 5000);
}

// 处理编辑器输入
function handleEditorInput() {
    updatePreview();
    
    // 防抖保存
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        saveContentIfChanged();
    }, 1000);
}

// 更新预览
function updatePreview() {
    preview.innerHTML = marked.parse(editor.value);
}

// 检查内容是否改变并保存
async function saveContentIfChanged() {
    const currentContent = editor.value;
    if (currentContent !== lastContent) {
        await saveContent(currentContent);
        lastContent = currentContent;
    }
}

// 保存内容到后端
async function saveContent(content) {
    try {
        status.textContent = '保存中...';
        
        const response = await fetch(`${API_BASE_URL}/notes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content }),
            mode: 'cors'
        });
        
        if (response.ok) {
            status.textContent = '已保存 ' + new Date().toLocaleTimeString();
            saveToLocalStorage(content);
        } else {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    } catch (error) {
        console.error('保存到后端失败:', error);
        saveToLocalStorage(content);
        status.textContent = '后端保存失败 - 已保存到本地存储';
    }
}

// 本地存储作为后备
function saveToLocalStorage(content) {
    try {
        localStorage.setItem('noteContent', content);
    } catch (e) {
        console.error('本地存储失败:', e);
    }
}

function loadFromLocalStorage() {
    try {
        const content = localStorage.getItem('noteContent') || '';
        editor.value = content;
        lastContent = content;
        updatePreview();
    } catch (e) {
        console.error('从本地存储加载失败:', e);
    }
}

// 初始化应用
init();