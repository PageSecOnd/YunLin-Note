document.addEventListener('DOMContentLoaded', function() {
    const editor = document.getElementById('editor');
    const preview = document.getElementById('preview');
    const noteIdInput = document.getElementById('noteId');
    const connectBtn = document.getElementById('connectBtn');
    const syncStatus = document.getElementById('syncStatus');
    const statusDot = syncStatus.querySelector('.status-dot');
    const statusText = syncStatus.querySelector('.status-text');
    
    const modal = document.getElementById('helpModal');
    const helpBtn = document.getElementById('helpBtn');
    const closeBtn = document.querySelector('.close');
    
    let socket = null;
    let currentNoteId = '';
    let isConnected = false;
    let lastTypingTime = 0;
    const typingDelay = 500; // ms delay before sending updates
    
    // API URL - Replace with your Vercel deployment URL
    const API_URL = 'https://markdown-notepad-backend.vercel.app'; 
    
    // Initialize with a random note ID suggestion
    noteIdInput.value = generateRandomId();
    
    // Set up markdown rendering
    function renderMarkdown() {
        const markdownText = editor.value;
        preview.innerHTML = marked.parse(markdownText);
    }
    
    // Generate a random ID for notes
    function generateRandomId(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
    
    // Connect to WebSocket server
    function connectToServer(noteId) {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.close();
        }
        
        try {
            // WebSocket connection to Vercel
            // Note: Vercel supports WebSockets on their paid plans
            // For free plans, we'll use a compatible service or fallback to polling
            const wsUrl = `${API_URL.replace('https://', 'wss://').replace('http://', 'ws://')}/ws/${noteId}`;
            socket = new WebSocket(wsUrl);
            
            socket.onopen = function() {
                isConnected = true;
                currentNoteId = noteId;
                updateConnectionStatus(true);
                console.log(`Connected to note: ${noteId}`);
                
                // Request the current note content from server
                const message = {
                    type: 'get_content',
                    noteId: noteId
                };
                socket.send(JSON.stringify(message));
            };
            
            socket.onclose = function() {
                isConnected = false;
                updateConnectionStatus(false);
                console.log('Connection closed');
                
                // Auto-reconnect after a delay
                setTimeout(() => {
                    if (!isConnected && currentNoteId === noteId) {
                        connectToServer(noteId);
                    }
                }, 3000);
            };
            
            socket.onerror = function(error) {
                isConnected = false;
                updateConnectionStatus(false, 'Connection error');
                console.error('WebSocket error:', error);
                
                // Fallback to polling if WebSockets fail
                if (!isConnected && currentNoteId === noteId) {
                    setupPollingFallback(noteId);
                }
            };
            
            socket.onmessage = function(event) {
                const data = JSON.parse(event.data);
                
                if (data.type === 'content_update') {
                    // Only update if we're not the sender
                    if (data.sender !== socket.id) {
                        editor.value = data.content;
                        renderMarkdown();
                    }
                } else if (data.type === 'initial_content') {
                    editor.value = data.content;
                    renderMarkdown();
                }
            };
        } catch (error) {
            console.error('Failed to connect:', error);
            updateConnectionStatus(false, 'Failed to connect');
            setupPollingFallback(noteId);
        }
    }
    
    // Fallback to polling if WebSockets are not supported on Vercel free tier
    function setupPollingFallback(noteId) {
        currentNoteId = noteId;
        updateConnectionStatus(true, 'Connected (polling mode)');
        
        // Initial content fetch
        fetchNoteContent(noteId);
        
        // Setup polling interval
        const pollingInterval = setInterval(() => {
            if (currentNoteId !== noteId) {
                clearInterval(pollingInterval);
                return;
            }
            fetchNoteContent(noteId);
        }, 2000);
    }
    
    // Fetch note content via REST API
    function fetchNoteContent(noteId) {
        fetch(`${API_URL}/api/notes/${noteId}`)
            .then(response => response.json())
            .then(data => {
                if (data.content !== editor.value) {
                    editor.value = data.content;
                    renderMarkdown();
                }
            })
            .catch(error => {
                console.error('Error fetching note:', error);
            });
    }
    
    // Update note content via REST API
    function updateNoteContent(noteId, content) {
        fetch(`${API_URL}/api/notes/${noteId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content })
        })
        .catch(error => {
            console.error('Error updating note:', error);
        });
    }
    
    // Update UI to show connection status
    function updateConnectionStatus(connected, message = null) {
        if (connected) {
            statusDot.classList.add('connected');
            statusText.textContent = message || `Connected to: ${currentNoteId}`;
        } else {
            statusDot.classList.remove('connected');
            statusText.textContent = message || 'Disconnected';
        }
    }
    
    // Send content changes to server
    function sendContentUpdate() {
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
                updateNoteContent(currentNoteId, editor.value);
            }
        }
    }
    
    // Event listener for editor changes
    editor.addEventListener('input', function() {
        renderMarkdown();
        
        // Debounce sending updates to the server
        const now = Date.now();
        if (now - lastTypingTime > typingDelay) {
            lastTypingTime = now;
            if (isConnected) {
                sendContentUpdate();
            }
        } else {
            clearTimeout(editor.typingTimer);
            editor.typingTimer = setTimeout(function() {
                lastTypingTime = Date.now();
                if (isConnected) {
                    sendContentUpdate();
                }
            }, typingDelay);
        }
    });
    
    // Connect button handler
    connectBtn.addEventListener('click', function() {
        const noteId = noteIdInput.value.trim();
        if (noteId) {
            connectToServer(noteId);
        }
    });
    
    // Modal handlers for markdown help
    helpBtn.addEventListener('click', function(e) {
        e.preventDefault();
        modal.style.display = 'block';
    });
    
    closeBtn.addEventListener('click', function() {
        modal.style.display = 'none';
    });
    
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    // Initial markdown rendering
    renderMarkdown();
    
    // Automatically focus the editor
    editor.focus();
});