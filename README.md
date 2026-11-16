# MiniBoard — 情報科学演習III

## 主な機能

- **スレッド管理**
  - スレッドの新規作成、一覧からの切り替え、自分が作成したスレッドの削除ができます。
  - 各スレッドの投稿数や最終更新日時が表示されます。
- **投稿・返信・編集・削除**
  - ニックネーム（任意・空欄時は「匿名」）とメッセージ（最大300文字）を投稿できます。
  - 投稿への返信（1階層）や、自分が投稿したメッセージの編集・削除が可能です。
- **画像添付**
  - 1投稿あたり最大2枚（各5MBまで、PNG / JPEG / GIF / WebP）の画像を添付できます。
- **リアクション（Good / Bad）**
  - 各投稿・返信に対して Good / Bad を1ブラウザにつき1票投票できます。同じボタンを押すと取り消し、別のボタンを押すと変更できます。
- **お題ガチャ**
  - 話すテーマをランダムに引き、そのままスレッド作成フォームのタイトル・最初のメッセージに反映できます。
- **おみくじ**
  - おみくじスレッドではおみくじを引くことができ、結果がそのままスレッドに投稿されます。
- **弾幕モード**
  - 「弾幕モード」を ON にすると、スレッド内の投稿が画面上に流れたり、クイックスタンプ（`🎉` `👏` `🔥` `草` `神` `💡`）や任意テキストを画面に飛ばしたりできます。
- **リアルタイム更新**
  - 他のユーザーが押した Good / Bad、新規投稿・返信・編集・削除、スレッドの作成・削除、弾幕モードで飛ばしたスタンプやコメントが、リロードなしでリアルタイムに反映されます。

## Local / Codespaces
```bash
pip install -r requirements.txt
python app.py
```

## Docker
```bash
docker build -t miniboard .
docker run --rm -p 5000:5000 miniboard
```

## API
- `GET /api/events` — リアルタイム更新用 SSE ストリーム
- `GET /api/threads` / `POST /api/threads` / `DELETE /api/threads/<id>`
- `GET /api/messages` / `POST /api/messages` / `PUT /api/messages/<id>` / `DELETE /api/messages/<id>`
- `POST /api/messages/<id>/votes` (`{"voter_id": "...", "vote": "good" | "bad"}`)
- `DELETE /api/messages/<id>/votes` (`{"voter_id": "..."}`)
- `GET /api/images` / `GET /api/messages/<id>/images` / `POST /api/messages/<id>/images`
- `POST /api/threads/<id>/omikuji`
- `POST /api/danmaku` (`{"text": "...", "thread_id": ..., "sender_id": "..."}`)

> 授業用。Public URLに個人情報・秘密情報を入力しないこと。
