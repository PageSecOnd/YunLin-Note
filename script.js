document.addEventListener('DOMContentLoaded', () => {
    const editor = document.getElementById('editor');
    const preview = document.getElementById('preview');
    const saveButton = document.getElementById('saveButton');
    const togglePreviewButton = document.getElementById('togglePreview');
    const saveStatus = document.getElementById('saveStatus');
    const lastSavedElement = document.getElementById('lastSaved');
    
    const API_URL = 'https://note.backend.yunlinsan.ren/api/notes';
    let timer;
    let lastSaved = null;
    let isPreviewHidden = false;
    
    // 配置marked以使用highlight.js进行代码高亮
    marked.setOptions({
        highlight: function(code, lang) {
            if (lang && hljs.getLanguage(lang)) {
                return hljs.highlight(code, { language: lang }).value;
            }
            return hljs.highlightAuto(code).value;
        },
        breaks: true,
        gfm: true
    });
    
    // 更新预览
    function updatePreview() {
        const content = editor.value;
        preview.innerHTML = marked(content);
    }
    
    // 保存笔记
    async function saveNote() {
        try {
            saveStatus.textContent = '正在保存...';
            
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content: editor.value })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                saveStatus.textContent = '已保存';
                lastSaved = new Date(data.timestamp);
                updateLastSavedTime();
            } else {
                saveStatus.textContent = '保存失败: ' + data.message;
            }
        } catch (error) {
            console.error('保存时出错:', error);
            saveStatus.textContent = '保存失败，请稍后重试';
        }
    }
    
    // 加载笔记
    async function loadNote() {
        try {
            saveStatus.textContent = '加载中...';
            
            const response = await fetch(API_URL);
            const data = await response.json();
            
            if (response.ok && data.content) {
                editor.value = data.content;
                updatePreview();
                
                if (data.lastUpdated) {
                    lastSaved = new Date(data.lastUpdated);
                    updateLastSavedTime();
                }
                
                saveStatus.textContent = '已加载';
                setTimeout(() => {
                    saveStatus.textContent = '所有更改已保存';
                }, 2000);
            } else {
                saveStatus.textContent = '笔记为空或加载失败';
            }
        } catch (error) {
            console.error('加载时出错:', error);
            saveStatus.textContent = '加载失败，请刷新页面重试';
        }
    }
    
    // 更新最后保存时间
    function updateLastSavedTime() {
        if (lastSaved) {
            const now = new Date();
            const diff = now - lastSaved;
            
            if (diff < 60000) {
                lastSavedElement.textContent = '最后保存: 刚刚';
            } else if (diff < 3600000) {
                const minutes = Math.floor(diff / 60000);
                lastSavedElement.textContent = `最后保存: ${minutes}分钟前`;
            } else if (diff < 86400000) {
                const hours = Math.floor(diff / 3600000);
                lastSavedElement.textContent = `最后保存: ${hours}小时前`;
            } else {
                const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
                lastSavedElement.textContent = `最后保存: ${lastSaved.toLocaleDateString('zh-CN', options)}`;
            }
        }
    }
    
    // 自动保存功能
    function setupAutoSave() {
        editor.addEventListener('input', () => {
            saveStatus.textContent = '正在编辑...';
            updatePreview();
            
            clearTimeout(timer);
            timer = setTimeout(() => {
                saveNote();
            }, 2000);
        });
    }
    
    // 切换预览功能
    togglePreviewButton.addEventListener('click', () => {
        const editorContainer = document.querySelector('.editor-container');
        const previewContainer = document.querySelector('.preview-container');
        
        if (isPreviewHidden) {
            previewContainer.classList.remove('hidden');
            editorContainer.classList.remove('fullwidth');
            togglePreviewButton.textContent = '隐藏预览';
        } else {
            previewContainer.classList.add('hidden');
            editorContainer.classList.add('fullwidth');
            togglePreviewButton.textContent = '显示预览';
        }
        
        isPreviewHidden = !isPreviewHidden;
    });
    
    // 保存按钮事件
    saveButton.addEventListener('click', saveNote);
    
    // 加载初始内容
    loadNote();
    
    // 设置自动保存
    setupAutoSave();
    
    // 定期更新保存时间显示
    setInterval(updateLastSavedTime, 60000);
});