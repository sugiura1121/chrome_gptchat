document.addEventListener('DOMContentLoaded', function() {
    const chatContainer = document.getElementById('chatContainer');
    const textInput = document.getElementById('textInput');
    const sendBtn = document.getElementById('sendBtn');
    const clearBtn = document.getElementById('clearBtn');
    const settingsToggle = document.getElementById('settingsToggle');
    const settingsPanel = document.getElementById('settingsPanel');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const apiStatus = document.getElementById('apiStatus');
    const saveApiKey = document.getElementById('saveApiKey');
    const typingIndicator = document.getElementById('typingIndicator');

    let apiKey = '';
    let conversationHistory = [];

    // 設定パネルの表示/非表示
    settingsToggle.addEventListener('click', function() {
        settingsPanel.classList.toggle('collapsed');
    });

    // APIキーの保存
    saveApiKey.addEventListener('click', function() {
        const key = apiKeyInput.value.trim();
        if (key) {
            apiKey = key;
            chrome.storage.local.set({ 'openai_api_key': key }, function() {
                apiStatus.textContent = 'APIキーが保存されました';
                apiStatus.className = 'api-status success';
                sendBtn.disabled = false;
                settingsPanel.classList.add('collapsed');
            });
        } else {
            apiStatus.textContent = 'APIキーを入力してください';
            apiStatus.className = 'api-status error';
        }
    });

    // 保存されたAPIキーの読み込み
    chrome.storage.local.get(['openai_api_key'], function(result) {
        if (result.openai_api_key) {
            apiKey = result.openai_api_key;
            apiKeyInput.value = apiKey;
            apiStatus.textContent = 'APIキーが設定されています';
            apiStatus.className = 'api-status success';
            sendBtn.disabled = false;
            settingsPanel.classList.add('collapsed');
        } else {
            sendBtn.disabled = true;
        }
    });

    // 現在の時刻を取得
    function getCurrentTime() {
        const now = new Date();
        return now.toLocaleTimeString('ja-JP', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    // メッセージを追加
    function addMessage(content, type = 'user') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = getCurrentTime();
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = content;
        
        messageDiv.appendChild(timeDiv);
        messageDiv.appendChild(contentDiv);
        
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // OpenAI APIにリクエスト送信
    async function sendToGPT(message) {
        if (!apiKey) {
            addMessage('APIキーが設定されていません', 'system');
            return;
        }

        // ユーザーメッセージを履歴に追加
        conversationHistory.push({ role: 'user', content: message });

        // 入力を無効化
        sendBtn.disabled = true;
        textInput.disabled = true;
        typingIndicator.classList.add('show');

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: conversationHistory,
                    max_tokens: 500,
                    temperature: 0.7
                })
            });

            const data = await response.json();

            if (response.ok) {
                const gptResponse = data.choices[0].message.content;
                addMessage(gptResponse, 'gpt');
                
                // GPTの応答を履歴に追加
                conversationHistory.push({ role: 'assistant', content: gptResponse });
                
                // 履歴が長くなりすぎないよう制限（最新10往復のみ保持）
                if (conversationHistory.length > 20) {
                    conversationHistory = conversationHistory.slice(-20);
                }
            } else {
                addMessage(`エラー: ${data.error?.message || '不明なエラーが発生しました'}`, 'system');
            }
        } catch (error) {
            addMessage(`接続エラー: ${error.message}`, 'system');
        } finally {
            // 入力を有効化
            sendBtn.disabled = false;
            textInput.disabled = false;
            typingIndicator.classList.remove('show');
            textInput.focus();
        }
    }

    // メッセージ送信
    async function sendMessage() {
        const message = textInput.value.trim();
        if (message && !sendBtn.disabled) {
            addMessage(message, 'user');
            textInput.value = '';
            
            // GPTに送信
            await sendToGPT(message);
        }
    }

    // チャットをクリア
    function clearChat() {
        chatContainer.innerHTML = `
            <div class="message system">
                <div class="message-time">システム</div>
                <div class="message-content">
                    🤖 GPTチャットボットへようこそ！<br>
                    まず上の設定からOpenAI APIキーを設定してください。
                </div>
            </div>
        `;
        conversationHistory = [];
    }

    // イベントリスナーを設定
    sendBtn.addEventListener('click', sendMessage);
    clearBtn.addEventListener('click', clearChat);
    
    // Enterキーで送信（Shift+Enterで改行）
    textInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // 入力欄にフォーカス
    textInput.focus();
});