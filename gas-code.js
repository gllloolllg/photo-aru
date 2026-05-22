/**
 * Googleスプレッドシートからお題と得点を取得し、JSONで返すGASスクリプト
 * 
 * 【設定手順】
 * 1. スプレッドシートのメニュー「拡張機能」＞「Apps Script」を開きます。
 * 2. このコードをエディタに貼り付けます。
 * 3. 画面右上の「デプロイ」＞「新しいデプロイ」をクリックします。
 * 4. 種類の選択で「ウェブアプリ」を選択します。
 * 5. 各設定を以下のように設定します：
 *    - 説明: 任意（例: photo-aru-api）
 *    - 次のユーザーとして実行: 「自分」（あなたのGoogleアカウント）
 *    - アクセスできるユーザー: 「全員」（Everyone） ※ログイン不要でアクセス可能にするため
 * 6. 「デプロイ」をクリックし、表示された「ウェブアプリのURL」をコピーして、
 *    `script.js` の `SHEET_URL` に設定してください。
 */

function doGet() {
  // アクティブなスプレッドシートのシートを取得
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  var result = [];
  
  // 1行目がヘッダー（お題, 得点など）の場合はスキップ
  var startIndex = 0;
  if (data.length > 0 && (data[0][0] === "お題" || data[0][0] === "題名" || data[0][0] === "topic")) {
    startIndex = 1;
  }
  
  for (var i = startIndex; i < data.length; i++) {
    var topicText = data[i][0]; // A列: お題
    var score = data[i][1];     // B列: 得点
    
    // お題が空でない場合のみリストに追加
    if (topicText && topicText.toString().trim() !== "") {
      result.push({
        text: topicText.toString().trim(),
        stars: Number(score) || 1 // 数値に変換（デフォルトは1）
      });
    }
  }
  
  // JSON形式でレスポンスを返す（CORS対応）
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
