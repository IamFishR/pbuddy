document.addEventListener('DOMContentLoaded', () => {
    const chatWindow = document.getElementById('chat-window');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const newChatBtn = document.getElementById('new-chat-btn');
    const chatListUl = document.getElementById('chat-list');

    let currentChatId = null;
    let localChatHistory = []; // Stores {role, content} for the current API call's history

    const API_BASE_URL = '/api'; // Assuming your API routes are under /api

    // --- Display Functions ---
    function displayMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender === 'user' ? 'user-message' : 'bot-message');

        const p = document.createElement('p');
        p.textContent = text;
        messageDiv.appendChild(p);

        chatWindow.appendChild(messageDiv);
        chatWindow.scrollTop = chatWindow.scrollHeight; // Auto-scroll to bottom
    }

    // --- API Helper ---
    async function fetchAPI(endpoint, method = 'GET', body = null) {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
        };
        if (body) {
            options.body = JSON.stringify(body);
        }
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                throw new Error(`API Error (${response.status}): ${errorData.message || 'Unknown error'}`);
            }
            return response.json();
        } catch (error) {
            console.error('Fetch API error:', error);
            displayMessage(`Error: ${error.message}`, 'bot'); // Display error in chat window
            throw error; // Re-throw for the caller to handle if needed
        }
    }

    // --- Chat List Functions ---
    async function loadChats() {
        console.log('Loading chats...');
        try {
            const chats = await fetchAPI('/chats');
            chatListUl.innerHTML = ''; // Clear existing list
            if (chats && chats.length > 0) {
                chats.forEach(chat => {
                    const li = document.createElement('li');
                    // Display chat ID and maybe part of the last message or date
                    const lastMsg = chat.messages && chat.messages.length > 0 ? chat.messages[0].content : 'New chat';
                    const preview = lastMsg.substring(0, 20) + (lastMsg.length > 20 ? '...' : '');
                    li.textContent = `Chat ${chat.id} - ${preview}`;
                    li.dataset.chatId = chat.id;
                    li.addEventListener('click', () => selectChat(chat.id));
                    chatListUl.appendChild(li);
                });
                // Automatically select the most recent chat if none is selected
                if (!currentChatId && chats.length > 0) {
                     // selectChat(chats[0].id); // Select the first (most recent) chat
                }
            } else {
                chatListUl.innerHTML = '<li>No chats yet. Start a new one!</li>';
            }
        } catch (error) {
            chatListUl.innerHTML = '<li>Error loading chats.</li>';
            console.error('Error loading chats:', error);
        }
    }

    async function selectChat(chatId) {
        if (currentChatId === chatId) return; // Already selected

        currentChatId = chatId;
        console.log(`Selecting chat ID: ${currentChatId}`);

        // Highlight active chat in the list
        document.querySelectorAll('#chat-list li').forEach(li => {
            if (li.dataset.chatId === String(chatId)) {
                li.classList.add('active-chat');
            } else {
                li.classList.remove('active-chat');
            }
        });

        chatWindow.innerHTML = ''; // Clear current messages
        localChatHistory = [];

        try {
            const messages = await fetchAPI(`/chats/${currentChatId}/messages`);
            messages.forEach(msg => {
                displayMessage(msg.content, msg.sender);
                localChatHistory.push({ role: msg.sender === 'bot' ? 'assistant' : 'user', content: msg.content });
            });
        } catch (error) {
            console.error(`Error fetching messages for chat ${currentChatId}:`, error);
            displayMessage(`Error loading messages for chat ${currentChatId}.`, 'bot');
        }
    }

    // --- Chat Action Functions ---
    async function handleNewChat() {
        console.log('Creating new chat...');
        try {
            const newChatData = await fetchAPI('/chats', 'POST');
            currentChatId = newChatData.id;
            chatWindow.innerHTML = ''; // Clear messages
            localChatHistory = [];
            console.log('New chat created with ID:', currentChatId);
            await loadChats(); // Refresh chat list
            // Automatically select the new chat in the list
            document.querySelectorAll('#chat-list li').forEach(li => {
                 if (li.dataset.chatId === String(currentChatId)) {
                    li.classList.add('active-chat');
                } else {
                    li.classList.remove('active-chat');
                }
            });

        } catch (error) {
            console.error('Error creating new chat:', error);
        }
    }

    async function handleSendMessage() {
        const messageText = messageInput.value.trim();
        if (!messageText) return;

        if (!currentChatId) {
            displayMessage('Please select a chat or start a new one before sending messages.', 'bot');
            // Or, optionally, create a new chat automatically here
            // await handleNewChat();
            // if (!currentChatId) return; // If new chat creation failed
            return;
        }

        displayMessage(messageText, 'user');
        localChatHistory.push({ role: 'user', content: messageText });
        messageInput.value = ''; // Clear input field

        try {
            // The backend expects { message: "current_prompt", history: [{role, content}, ...] }
            const payload = {
                message: messageText,
                history: localChatHistory.slice(0, -1) // Send history *before* the current user message
            };

            const botResponse = await fetchAPI(`/chats/${currentChatId}/messages`, 'POST', payload);

            if (botResponse && botResponse.botMessage && botResponse.botMessage.content) {
                displayMessage(botResponse.botMessage.content, 'bot');
                localChatHistory.push({ role: 'assistant', content: botResponse.botMessage.content });
            } else {
                 displayMessage('Received an empty or unexpected response from the bot.', 'bot');
            }
        } catch (error) {
            console.error('Error sending message or getting bot response:', error);
            // Error is already displayed by fetchAPI's catch block
        }
    }

    // --- Event Listeners ---
    sendButton.addEventListener('click', handleSendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Prevent new line in textarea
            handleSendMessage();
        }
    });
    newChatBtn.addEventListener('click', handleNewChat);

    // --- Initial Load ---
    loadChats();
    // Consider what to do if no chats exist - perhaps prompt to create one or auto-create.
    // For now, if no chats, selectChat won't be called, currentChatId will be null.
    // User must click "New Chat" or select an existing one.
});
