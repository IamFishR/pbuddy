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
        const messageWrapper = document.createElement('div'); // Outer div for alignment
        messageWrapper.classList.add('message', 'flex');

        const messageBubble = document.createElement('div');
        // Base classes for all bubbles: p-3 rounded-lg max-w-xs lg:max-w-md xl:max-w-lg
        messageBubble.classList.add('p-3', 'rounded-lg', 'max-w-xs', 'lg:max-w-md', 'xl:max-w-lg', 'break-words');

        if (sender === 'user') {
            messageWrapper.classList.add('justify-end');
            // User message specific classes: bg-blue-600 text-white
            messageBubble.classList.add('bg-blue-600', 'text-white');
        } else { // Bot or system message
            messageWrapper.classList.add('justify-start');
            // Bot message specific classes: bg-gray-700 text-gray-200
            messageBubble.classList.add('bg-gray-700', 'text-gray-200');
        }

        const p = document.createElement('p');
        p.textContent = text;
        messageBubble.appendChild(p);

        if (sender === 'bot' && toolInfo && toolInfo.toolName) {
            const toolInfoDiv = document.createElement('div');
            // Tailwind classes for tool info box: bg-gray-600 border border-gray-500 p-2 mt-2 rounded text-xs text-gray-200 (changed from text-gray-300)
            toolInfoDiv.classList.add('bg-gray-600', 'border', 'border-gray-500', 'p-2', 'mt-2', 'rounded', 'text-xs', 'text-gray-200');

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
            pre.classList.add('whitespace-pre-wrap', 'break-all'); // Tailwind for pre formatting
            pre.textContent = toolDetails;
            toolInfoDiv.appendChild(pre);
            messageBubble.appendChild(toolInfoDiv); // Append tool info inside the message bubble
        }

        messageWrapper.appendChild(messageBubble);
        chatWindow.appendChild(messageWrapper);
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
            const chats = await fetchAPI('/chats'); // Assuming this returns an array of chat objects
            chatListUl.innerHTML = ''; // Clear existing list
            if (chats && chats.length > 0) {
                chats.forEach(chat => {
                    const li = document.createElement('li');
                    // Tailwind classes for chat list items
                    li.classList.add('p-2', 'hover:bg-gray-700', 'rounded-md', 'cursor-pointer', 'text-gray-300', 'truncate');

                    const lastMsg = chat.messages && chat.messages.length > 0 ? chat.messages[0].content : 'New chat';
                    const preview = lastMsg.substring(0, 25) + (lastMsg.length > 25 ? '...' : ''); // Slightly longer preview
                    li.textContent = `Chat ${chat.id} - ${preview}`;
                    li.dataset.chatId = chat.id;

                    if (String(chat.id) === String(currentChatId)) { // Check if it's the currently active chat
                        li.classList.add('bg-gray-700', 'text-white', 'font-semibold'); // Active chat styling
                    }

                    li.addEventListener('click', () => selectChat(chat.id));
                    chatListUl.appendChild(li);
                });
            } else {
                const li = document.createElement('li');
                li.classList.add('p-2', 'text-gray-500');
                li.textContent = 'No chats yet. Start a new one!';
                chatListUl.appendChild(li);
            }
        } catch (error) {
            const li = document.createElement('li');
            li.classList.add('p-2', 'text-red-400');
            li.textContent = 'Error loading chats.';
            chatListUl.appendChild(li);
            console.error('Error loading chats:', error);
        }
    }

    async function selectChat(chatId) {
        if (String(currentChatId) === String(chatId)) return;

        currentChatId = chatId;
        console.log(`Selecting chat ID: ${currentChatId}`);
        updateChatTokenDisplay(0);
        await loadChats(); // Reload chat list to update active state styling

        chatWindow.innerHTML = '';
        localChatHistory = [];

        try {
            const chatDetails = await fetchAPI(`/chats/${currentChatId}`);
            if (chatDetails && chatDetails.messages) {
                chatDetails.messages.forEach(msg => {
                    displayMessage(msg.content, msg.sender, null); // toolInfo is null for historical messages
                    localChatHistory.push({ role: msg.sender === 'bot' ? 'assistant' : 'user', content: msg.content });
                });
            }
            if (chatDetails && chatDetails.tokenCount !== undefined) {
                updateChatTokenDisplay(chatDetails.tokenCount);
            }
        } catch (error) {
            console.error(`Error fetching messages for chat ${currentChatId}:`, error);
            displayMessage(`Error loading messages for chat ${currentChatId}.`, 'bot');
        }
    }

    // --- Chat Action Functions ---
    // Add auto-resize for textarea
    const autoResizeTextarea = (textarea) => {
        textarea.style.height = 'auto'; // Reset height
        textarea.style.height = textarea.scrollHeight + 'px'; // Set to scroll height
    };

    messageInput.addEventListener('input', () => autoResizeTextarea(messageInput));
    async function handleNewChat() {
        console.log('Creating new chat...');
        try {
            const newChatData = await fetchAPI('/chats', 'POST'); // newChatData includes {id, userId, tokenCount, createdAt, updatedAt}
            currentChatId = newChatData.id;
            chatWindow.innerHTML = ''; // Clear messages
            localChatHistory = [];
            updateChatTokenDisplay(newChatData.tokenCount || 0); // New chats have 0 tokens initially
            console.log('New chat created with ID:', currentChatId);
            await loadChats(); // Refresh chat list to show new chat and make it active
            // selectChat(currentChatId); // This will be handled by loadChats highlighting logic if currentChatId matches
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
