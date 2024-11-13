
const ws = new WebSocket('wss://puyopuyo.psannetwork.net');
let userId = null;
let matchedUserId = null; // マッチングしたユーザーIDを格納

// WebSocket接続の確立時の処理
ws.onopen = () => {
    userId = 'user_' + Math.floor(Math.random() * 1000); // ランダムなユーザーIDの生成
    console.log(`接続成功! ユーザーID: ${userId}`);
requestMatching();
    // サーバーにユーザーIDを送信
    ws.send(JSON.stringify({ id: userId }));
};

// WebSocketのメッセージ受信時の処理
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    // メッセージが含まれている場合
    if (data.message) {
        console.log(`${data.message}`);

        if (data.message) {
            if (data.message.includes("start")) {
                gamestartcount();
            }
        }
        if (data.message) {
            if (data.message.includes("you win")) {
                				gameOverDisplayed = true;

		let moveDown = setInterval(() => {
			ctx.clearRect(0, 0, canvas.width, canvas.height);

			for (let y = 0; y < rows; y++) {
				for (let x = 0; x < cols; x++) {
					if (board[y][x]) {
						ctx.drawImage(images[board[y][x]], x * puyoSize, y * puyoSize, puyoSize,
							puyoSize);
					}
				}
			}

			ctx.translate(0, 20);
			if (ctx.getTransform().f >= canvas.height) {
				clearInterval(moveDown);
				ctx.translate(0, -canvas.height);
                showtext("you win")
			}
		}, 30);
            }
        }
        // 連鎖を受信
        if (data.message) {
            if (data.message.includes("ren")) {
                // "ren" の後の数字部分を抽出して rens に格納
                const rens = [];
                
                // 正規表現で "ren" の後に続く数字をすべて取得
                const matches = data.message.match(/ren(\d+)/g);
                
                if (matches) {
                    matches.forEach(match => {
                        const number = match.replace('ren', ''); // "ren" を削除して数字部分を取得
                        rens.push(Number(number)); // 数字を配列に格納
                    });
                }
        
                console.log(rens); // 例えば "rens" を確認する
 
                triggerGrayPuyo(rens);
            }
        }


        

        
        // マッチング通知を受け取った場合
        if (data.message.startsWith('あなたはクライアントID')) {
            // マッチング成功メッセージから相手のIDを取得
            matchedUserId = data.matchedId;
            console.log(`マッチング成功！相手のID: ${matchedUserId}`);
            startgameclients();
        } else {
            // その他のメッセージ（ボードデータを受信した場合）
            const boardState = JSON.parse(data.message); // メッセージをパースしてボード状態に変換
            drawBoardOnCanvas(boardState); // 受信したボードデータを描画
        }
    }
};

// メッセージ送信関数
function sendMessage(toId, message) {
    if (toId && message) {
        ws.send(JSON.stringify({
            id: userId,
            to: toId,
            message: JSON.stringify(message) // JSON形式に変換して送信
        }));
        //console.log(`メッセージ送信: ${JSON.stringify(message)} -> 送信先: ${toId}`);
    }
}

// マッチングリクエスト関数
function requestMatching() {
    ws.send(JSON.stringify({
        id: userId,
        matchRequest: true
    }));
    console.log('マッチングリクエストを送信しました');
}



// WebSocketエラー時の処理
ws.onerror = (error) => {
    console.error('WebSocket エラー:', error);
    if (error.message) console.error('エラーメッセージ:', error.message);
    if (error.code) console.error('エラーコード:', error.code);
};

// 接続が切れたときの処理
ws.onclose = () => {
    console.log('サーバーとの接続が閉じられました。');
};

// ボードの各セルサイズを設定
const cellSize = 40; // セル1つあたりのピクセル数

// ボード状態をcanvasに描画する関数
function drawBoardOnCanvas(boardState) {
    const canvas = document.getElementById('others'); // `others`というIDのcanvasを取得
    const ctx = canvas.getContext('2d');
    
    // canvasをクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // ボードの各セルを描画
    for (let y = 0; y < boardState.length; y++) {
        for (let x = 0; x < boardState[y].length; x++) {
            const colorName = boardState[y][x];

            if (colorName && colorName !== 0 && images[colorName]) { // 色が指定されている場合
                ctx.drawImage(images[colorName], x * cellSize, y * cellSize, cellSize, cellSize); // 画像を描画
            } else {
                ctx.fillStyle = 'white'; // 空セルは白で塗りつぶし
                ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }
    }
}

// 現在のボード状態と操作中のぷよの状態を表示する関数
function logCurrentState() {
    if (!matchedUserId) {
        console.log("まだマッチングされていません");
        return; // マッチングされていない場合は何もしない
    }
    const currentBoard = board.map(row => row.slice()); // 現在のボードをコピー
    const { x, y, shape, rotation } = currentPuyo;
    const [dx, dy] = getRotationOffset(rotation);

    // currentPuyoのぷよをボードに反映
    if (isValidPosition(x, y, rotation)) {
        currentBoard[y][x] = shape[0].color; // ぷよの1つ目
        currentBoard[y + dy][x + dx] = shape[1].color; // ぷよの2つ目
    }

    // WebSocket経由でマッチングした相手に送信
    sendMessage(matchedUserId, currentBoard);
}
// 定期的に状態を送信
setInterval(logCurrentState, 100); // 0.1秒ごとに状態を送信




function startgameclients() {
    sendMessage(matchedUserId, "start");
    sendMessage(userId, "start");

}

