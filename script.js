document.addEventListener('DOMContentLoaded', function() {
    const editor = document.getElementById('editor');
    const preview = document.getElementById('preview');
    const syncStatus = document.getElementById('syncStatus');
    const statusDot = syncStatus.querySelector('.status-dot');
    const statusText = syncStatus.querySelector('.status-text');
    const lastUpdatedElement = document.getElementById('lastUpdated');
    const toggleViewBtn = document.getElementById('toggleViewBtn');
    const createNewBtn = document.getElementById('createNewBtn');
    const container = document.querySelector('.inline-editor-container');
    const currentNoteIdElement = document.getElementById('currentNoteId');
    
    // Check if we were redirected from a note page
    const redirectPath = sessionStorage.getItem('redirectPath');
    if (redirectPath && window.location.pathname === '/') {
        // Clear the redirect path
        sessionStorage.removeItem('redirectPath');
        
        // Update history state to show the correct URL
        window.history.replaceState(null, '', redirectPath);
        
        // Now currentNoteId will be correctly set from the URL
        currentNoteId = getIdFromUrl();
        currentNoteIdElement.textContent = currentNoteId || 'Home';
    }
    
    let socket = null;
    let isConnected = false;
    let lastTypingTime = 0;
    let viewMode = localStorage.getItem('viewMode') || 'editor'; // editor, preview, dual
    const typingDelay = 500; // ms delay before sending updates
    
    // Get note ID from URL path
    let currentNoteId = getIdFromUrl();
    
    // Display current note ID
    currentNoteIdElement.textContent = currentNoteId || 'Home';
    
    // API URL
    const API_URL = 'https://note.backend.yunlinsan.ren';
    
    // Set up markdown rendering with syntax highlighting
    function renderMarkdown() {
        const markdownText = editor.value;
        preview.innerHTML = marked.parse(markdownText);
        
        // Apply syntax highlighting
        document.querySelectorAll('#preview pre code').forEach((block) => {
            hljs.highlightBlock(block);
        });
    }
    
    // Get note ID from URL
    function getIdFromUrl() {
        const path = window.location.pathname;
        
        // Check if path has exactly 7 characters (/ followed by 6 chars)
        if (path.length === 7 && path.startsWith('/')) {
            return path.substring(1); // Remove leading slash
        }
        
        return null; // Home page or invalid path
    }
    
    // Generate a random 6-character ID
    function generateRandomId() {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
    
    // Navigate to a new note
    function navigateToNote(noteId) {
        window.location.href = `/${noteId}`;
    }
    
    // Connect to WebSocket server
    function connectToServer() {
        if (!currentNoteId) return; // Don't connect if on home page
        
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.close();
        }
        
        try {
            // WebSocket connection to backend
            const wsUrl = `${API_URL.replace('https://', 'wss://').replace('http://', 'ws://')}/ws/${currentNoteId}`;
            socket = new WebSocket(wsUrl);
            
            socket.onopen = function() {
                isConnected = true;
                updateConnectionStatus(true);
                console.log(`Connected to note: ${currentNoteId}`);
                
                // Request the current note content from server
                const message = {
                    type: 'get_content',
                    noteId: currentNoteId
                };
                socket.send(JSON.stringify(message));
            };
            
            socket.onclose = function() {
                isConnected = false;
                updateConnectionStatus(false);
                console.log('Connection closed');
                
                // Auto-reconnect after a delay
                setTimeout(() => {
                    if (!isConnected && getIdFromUrl() === currentNoteId) {
                        connectToServer();
                    }
                }, 3000);
            };
            
            socket.onerror = function(error) {
                isConnected = false;
                updateConnectionStatus(false, 'Connection error');
                console.error('WebSocket error:', error);
                
                // Fallback to polling if WebSockets fail
                if (!isConnected && getIdFromUrl() === currentNoteId) {
                    setupPollingFallback();
                }
            };
            
            socket.onmessage = function(event) {
                const data = JSON.parse(event.data);
                
                if (data.type === 'content_update') {
                    // Only update if we're not the sender
                    if (data.sender !== socket.id) {
                        editor.value = data.content;
                        renderMarkdown();
                        updateLastUpdated();
                    }
                } else if (data.type === 'initial_content') {
                    editor.value = data.content;
                    renderMarkdown();
                    updateLastUpdated(data.lastUpdated);
                }
            };
        } catch (error) {
            console.error('Failed to connect:', error);
            updateConnectionStatus(false, 'Failed to connect');
            setupPollingFallback();
        }
    }
    
    // Fallback to polling if WebSockets are not supported
    function setupPollingFallback() {
        if (!currentNoteId) return; // Don't poll if on home page
        
        updateConnectionStatus(true, 'Connected (polling mode)');
        
        // Initial content fetch
        fetchNoteContent();
        
        // Setup polling interval
        const pollingInterval = setInterval(() => {
            if (getIdFromUrl() !== currentNoteId) {
                clearInterval(pollingInterval);
                return;
            }
            fetchNoteContent();
        }, 2000);
    }
    
    // Fetch note content via REST API
    function fetchNoteContent() {
        fetch(`${API_URL}/api/notes/${currentNoteId}`)
            .then(response => response.json())
            .then(data => {
                if (data.content !== editor.value) {
                    editor.value = data.content;
                    renderMarkdown();
                    updateLastUpdated(data.lastUpdated);
                }
            })
            .catch(error => {
                console.error('Error fetching note:', error);
            });
    }
    
    // Update note content via REST API
    function updateNoteContent(content) {
        fetch(`${API_URL}/api/notes/${currentNoteId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content })
        })
        .then(() => {
            updateLastUpdated();
        })
        .catch(error => {
            console.error('Error updating note:', error);
        });
    }
    
    // Update UI to show connection status
    function updateConnectionStatus(connected, message = null) {
        if (connected) {
            statusDot.classList.add('connected');
            statusText.textContent = message || `Connected`;
        } else {
            statusDot.classList.remove('connected');
            statusText.textContent = message || 'Disconnected';
        }
    }
    
    // Format date for display
    function formatDate(timestamp) {
        if (!timestamp) {
            return 'Never';
        }
        
        const date = new Date(timestamp);
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    }
    
    // Update last updated timestamp
    function updateLastUpdated(timestamp = null) {
        const time = timestamp || Date.now();
        lastUpdatedElement.textContent = formatDate(time);
    }
    
    // Send content changes to server
    function sendContentUpdate() {
        if (!currentNoteId) return; // Don't send updates if on home page
        
        if (isConnected) {
            if (socket && socket.readyState === WebSocket.OPEN) {
                const message = {
                    type: 'content_update',
                    noteId: currentNoteId,
                    content: editor.value,
                    sender: socket.id
                };
                socket.send(JSON.stringify(message));
            } else {
                // Fallback to REST API if WebSocket is not available
                updateNoteContent(editor.value);
            }
        }
    }
    
    // Toggle between view modes (editor, preview, dual)
    function toggleView() {
        container.classList.remove('editor-mode', 'preview-mode', 'dual-view');
        
        if (viewMode === 'editor') {
            viewMode = 'preview';
            container.classList.add('preview-mode');
            toggleViewBtn.textContent = 'Show Editor';
        } else if (viewMode === 'preview') {
            viewMode = 'dual';
            container.classList.add('dual-view');
            toggleViewBtn.textContent = 'Show Editor Only';
        } else {
            viewMode = 'editor';
            container.classList.add('editor-mode');
            toggleViewBtn.textContent = 'Show Preview';
        }
        
        localStorage.setItem('viewMode', viewMode);
    }
    
    // Set initial view mode
    function initViewMode() {
        container.classList.remove('editor-mode', 'preview-mode', 'dual-view');
        
        if (viewMode === 'preview') {
            container.classList.add('preview-mode');
            toggleViewBtn.textContent = 'Show Editor';
        } else if (viewMode === 'dual') {
            container.classList.add('dual-view');
            toggleViewBtn.textContent = 'Show Editor Only';
        } else {
            // Default to editor mode
            container.classList.add('editor-mode');
            toggleViewBtn.textContent = 'Show Preview';
        }
    }
    
    // Handle home page content
    function setupHomePage() {
        editor.value = `# Welcome to Markdown Notepad

This is the home page. You can:

- Create a new note using the "Create New Note" button
- Or navigate directly to a note by adding a 6-character ID to the URL
  - For example: ${window.location.origin}/abcdef

## Features

- Markdown rendering with syntax highlighting
- Real-time updates across devices
- Toggle between editor, preview, and split view modes
`;
        renderMarkdown();
        editor.setAttribute('readonly', 'readonly');
        updateConnectionStatus(true, 'Home Page');
    }
    
    // Event listener for editor changes
    editor.addEventListener('input', function() {
        renderMarkdown();
        
        // Debounce sending updates to the server
        const now = Date.now();
        if (now - lastTypingTime > typingDelay) {
            lastTypingTime = now;
            sendContentUpdate();
        } else {
            clearTimeout(editor.typingTimer);
            editor.typingTimer = setTimeout(function() {
                lastTypingTime = Date.now();
                sendContentUpdate();
            }, typingDelay);
        }
    });
    
    // Toggle view button handler
    toggleViewBtn.addEventListener('click', toggleView);
    
    // Create new note button handler
    createNewBtn.addEventListener('click', function() {
        const newNoteId = generateRandomId();
        navigateToNote(newNoteId);
    });
    
    // Initialize the application
    initViewMode();
    
    // Check if we're on the home page or a note page
    if (!currentNoteId) {
        setupHomePage();
    } else {
        // Auto-save content to localStorage as backup
        const localStorageKey = `markdown-content-${currentNoteId}`;
        
        // Restore content from localStorage if available
        const savedContent = localStorage.getItem(localStorageKey);
        if (savedContent) {
            editor.value = savedContent;
            renderMarkdown();
        }
        
        // Set up autosave
        setInterval(() => {
            if (editor.value) {
                localStorage.setItem(localStorageKey, editor.value);
            }
        }, 5000);
        
        // Connect to server
        connectToServer();
    }
    
    // Handle history navigation (back/forward buttons)
    window.addEventListener('popstate', function() {
        window.location.reload();
    });
});