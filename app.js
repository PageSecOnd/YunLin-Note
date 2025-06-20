const API_BASE = "https://backend.note.yunlinsan.ren"; // 替换为你的 Vercel 部署后端地址

const textarea = document.getElementById('note-input');
const rendered = document.getElementById('rendered-markdown');
const status = document.getElementById('saved-status');

// Markdown 实时预览
textarea.addEventListener('input', () => {
  rendered.innerHTML = marked.parse(textarea.value);
});

// 保存内容到后端
document.getElementById('save-btn').onclick = async () => {
  const content = textarea.value;
  status.textContent = "保存中...";
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content })
  });
  if (res.ok) {
    status.textContent = "已保存";
    setTimeout(() => status.textContent = "", 2000);
  } else {
    status.textContent = "保存失败";
  }
};

// 加载内容
window.onload = async () => {
  const res = await fetch(API_BASE);
  const data = await res.json();
  textarea.value = data.content || '';
  rendered.innerHTML = marked.parse(textarea.value);
};