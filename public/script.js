document.addEventListener('DOMContentLoaded', () => {
    const chatWindow = document.getElementById('chat-window');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const newChatBtn = document.getElementById('new-chat-btn');
    const chatListUl = document.getElementById('chat-list');
    const chatTokenCountSpan = document.getElementById('chat-token-count'); // Added for token count

    let currentChatId = null;
    let localChatHistory = []; // Stores {role, content} for the current API call's history

    const API_BASE_URL = '/api'; // Assuming your API routes are under /api

    // --- Display Functions ---
    function displayMessage(text, sender, toolInfo = null) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender === 'user' ? 'user-message' : 'bot-message');

        const p = document.createElement('p');
        p.textContent = text;
        messageDiv.appendChild(p);

        if (sender === 'bot' && toolInfo && toolInfo.toolName) {
            const toolInfoDiv = document.createElement('div');
            toolInfoDiv.classList.add('tool-info');

            let toolDetails = `Tool Used: ${toolInfo.toolName}`;
            if (toolInfo.arguments && Object.keys(toolInfo.arguments).length > 0) {
                toolDetails += `\nArguments: ${JSON.stringify(toolInfo.arguments)}`;
            }
            if (toolInfo.success) {
                toolDetails += `\nOutput: ${toolInfo.output}`;
            } else {
                toolDetails += `\nError: ${toolInfo.error || 'Tool execution failed'}`;
            }

            const pre = document.createElement('pre');
            pre.textContent = toolDetails;
            toolInfoDiv.appendChild(pre);
            messageDiv.appendChild(toolInfoDiv);
        }

        chatWindow.appendChild(messageDiv);
        chatWindow.scrollTop = chatWindow.scrollHeight; // Auto-scroll to bottom
    }

    function updateChatTokenDisplay(count) {
        if (chatTokenCountSpan) {
            chatTokenCountSpan.textContent = count;
        }
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
        updateChatTokenDisplay(0); // Reset token count display when switching chats

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
            // Fetch chat details which include messages and total token count
            const chatDetails = await fetchAPI(`/chats/${currentChatId}`); // Assuming this endpoint returns the full chat object
            chatWindow.innerHTML = ''; // Clear current messages
            localChatHistory = [];

            if (chatDetails && chatDetails.messages) {
                chatDetails.messages.forEach(msg => {
                    // For historical messages, we don't have toolExecutionInfo per message from this endpoint
                    // So, toolInfo will be null for these.
                    displayMessage(msg.content, msg.sender, null);
                    localChatHistory.push({ role: msg.sender === 'bot' ? 'assistant' : 'user', content: msg.content });
                });
            }
            if (chatDetails && chatDetails.tokenCount !== undefined) {
                updateChatTokenDisplay(chatDetails.tokenCount);
            } else {
                 // Fallback if /chats/:id doesn't return messages or tokenCount directly in this format
                 // This part might need adjustment based on the actual response of GET /chats/:id
                const messages = await fetchAPI(`/chats/${currentChatId}/messages`);
                 messages.forEach(msg => {
                    displayMessage(msg.content, msg.sender);
                    localChatHistory.push({ role: msg.sender === 'bot' ? 'assistant' : 'user', content: msg.content });
                });
                // We might need a separate call to get total token count or it comes with chat list
            }

        } catch (error) {
            console.error(`Error fetching messages for chat ${currentChatId}:`, error);
            displayMessage(`Error loading messages for chat ${currentChatId}.`, 'bot');
        }
    }

    // --- Chat Action Functions ---
    async function handleNewChat() {
        console.log('Creating new chat...');
        try {
            const newChatData = await fetchAPI('/chats', 'POST'); // newChatData includes {id, userId, tokenCount, createdAt, updatedAt}
            currentChatId = newChatData.id;
            chatWindow.innerHTML = ''; // Clear messages
            localChatHistory = [];
            updateChatTokenDisplay(newChatData.tokenCount || 0); // New chats have 0 tokens initially
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

            const responseData = await fetchAPI(`/chats/${currentChatId}/messages`, 'POST', payload);

            if (responseData && responseData.botMessage && responseData.botMessage.content) {
                // Pass toolExecutionInfo to displayMessage for the bot's message
                displayMessage(responseData.botMessage.content, 'bot', responseData.toolExecutionInfo);
                localChatHistory.push({ role: 'assistant', content: responseData.botMessage.content });

                // Update total chat token count display
                if (responseData.updatedTokenCount !== undefined) {
                    updateChatTokenDisplay(responseData.updatedTokenCount);
                }
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
