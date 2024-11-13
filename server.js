const http = require('http');
const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const DOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const PORT = 6001;
const app = express();
app.use(cors({
    origin: '*',  // すべてのオリジンを許可
    methods: ['GET', 'POST', 'PUT', 'DELETE'],  // 許可するHTTPメソッドを指定
    allowedHeaders: ['Content-Type', 'Authorization']  // 許可するヘッダーを指定
}));

// 静的ファイルを提供するための設定
app.use(express.static('public'));
app.use(express.static('src'));

const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: 'リクエストの制限を超えました。しばらく待ってから再試行してください。'
});

app.use(limiter);

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let clients = {}; // クライアント情報
let matchingRequests = []; // マッチング待ちリスト

const window = new JSDOM('').window;
const purify = DOMPurify(window);

app.get('/status', (req, res) => {
    res.json({ connectedClients: Object.keys(clients).length });
});

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);

        // ユーザーIDが送信されている場合、ユーザー情報を登録
        if (data.id) {
            clients[data.id] = { ws, matched: false, id: data.id };
        }

        // メッセージの送信
        if (data.to && data.message) {
            const sanitizedMessage = purify.sanitize(data.message);
            const targetClient = clients[data.to];
            const timestamp = new Date().toISOString();

            if (targetClient) {
                targetClient.ws.send(JSON.stringify({
                    from: data.id,  
                    message: sanitizedMessage,
                    timestamp: timestamp
                }));
            }
        }

        // ファイルの送信
        if (data.to && data.file) {
            const targetClient = clients[data.to];
            const timestamp = new Date().toISOString();

            if (targetClient) {
                targetClient.ws.send(JSON.stringify({
                    from: data.id,  
                    file: data.file,
                    timestamp: timestamp
                }));
            }
        }

        // マッチングリクエスト
        if (data.matchRequest) {
            matchingRequests.push(data.id);

            if (matchingRequests.length > 1) {
                const otherClients = matchingRequests.filter(id => id !== data.id);
                if (otherClients.length > 0) {
                    const randomIndex = Math.floor(Math.random() * otherClients.length);
                    const matchedId = otherClients[randomIndex];

                    // すでにマッチングしているクライアントを除外
                    if (clients[matchedId] && !clients[matchedId].matched) {
                        const targetClient = clients[matchedId];
                        if (targetClient) {
                            // 両者にマッチング通知
                            targetClient.ws.send(JSON.stringify({
                                from: 'system',
                                message: `あなたはクライアントID ${data.id} とマッチングしました`,
                                matchedId: data.id
                            }));

                            ws.send(JSON.stringify({
                                from: 'system',
                                message: `あなたはクライアントID ${matchedId} とマッチングしました`,
                                matchedId: matchedId
                            }));

                            targetClient.matched = true;
                            ws.matched = true;

                            // マッチングリストから削除
                            matchingRequests = matchingRequests.filter(id => id !== data.id && id !== matchedId);
                        }
                    }
                }
            }
        }
    });

    // 切断時の処理
    ws.on('close', () => {
        for (const id in clients) {
            if (clients[id].ws === ws) {
                // 切断されたユーザーのマッチング状態を確認
                if (clients[id].matched) {
                    const matchedId = Object.keys(clients).find(clientId => clients[clientId].matched && clientId !== id);
                    if (matchedId) {
                        // 相手に通知
                        clients[matchedId].ws.send(JSON.stringify({
                            from: 'system',
                            message: `クライアントID ${id} が切断されました。マッチングが解除されました。`
                        }));

                        // 相手のマッチング状態を解除
                        clients[matchedId].matched = false;
                    }
                }

                // マッチングリストから削除
                matchingRequests = matchingRequests.filter(clientId => clientId !== id);
                delete clients[id];
                break;
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`WebSocketサーバーがポート ${PORT} で起動しました`);
});
