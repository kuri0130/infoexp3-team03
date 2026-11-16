import random

from flask import Blueprint, jsonify

from backend.db import connect

omikuji_bp = Blueprint("omikuji", __name__)

FORTUNES = [
    {
        "tier": "daikichi",
        "label": "大吉",
        "weight": 15,
        "advices": [
            "今日の運勢は最高潮！思い切った挑戦が大きな実を結びそうです。",
            "素晴らしい出会いや閃きに恵まれる予感。直感を信じて進みましょう！",
            "願い事が叶いやすい絶好の一日。周りの人にも幸運を分けられそう！",
        ],
    },
    {
        "tier": "chukichi",
        "label": "中吉",
        "weight": 20,
        "advices": [
            "とても良い流れが来ています。丁寧な行動がさらなる幸運を引き寄せます。",
            "コツコツ続けてきたことが評価されそう。自信を持って大丈夫！",
            "嬉しいニュースが舞い込むかも。笑顔で過ごすのが吉です。",
        ],
    },
    {
        "tier": "shokichi",
        "label": "小吉",
        "weight": 25,
        "advices": [
            "ささやかな幸せがたくさん見つかる日。身近な楽しみを大切にしましょう。",
            "焦らずマイペースに進めば万事うまくいきます。",
            "ちょっとした気分転換が良いアイデアを運んでくれそうです。",
        ],
    },
    {
        "tier": "kichi",
        "label": "吉",
        "weight": 18,
        "advices": [
            "穏やかで安定した一日になりそう。いつも通りのペースが強みになります。",
            "礼儀と感謝を忘れなければ、思わぬ助けが得られそうです。",
            "新しいことを少しだけ始めてみると、良い習慣になりそう。",
        ],
    },
    {
        "tier": "suekichi",
        "label": "末吉",
        "weight": 12,
        "advices": [
            "今は力を蓄えるとき。後半に向けて運気はぐんぐん上昇していきます！",
            "小さな準備を怠らなければ、やがて大きなチャンスに変わります。",
            "深呼吸して落ち着けば、隠れていた良い選択肢が見えてきます。",
        ],
    },
    {
        "tier": "kyo",
        "label": "凶",
        "weight": 8,
        "advices": [
            "少し慎重に動くと安心な日。確認をひと手間増やせば災いを避けられます。",
            "無理をせず休息をとるのが一番の開運アクション！",
            "ここで厄を落としたので、あとは運気が上がるだけです。",
        ],
    },
    {
        "tier": "daikyo",
        "label": "大凶",
        "weight": 2,
        "advices": [
            "超レアな大凶を引き当てた強運の持ち主！これ以上下がらないので上昇あるのみ！",
            "今日は守りに入れば無敵。温かい飲み物でも飲んでゆっくり過ごしましょう。",
            "逆転の兆しあり！ピンチを笑いに変える余裕が福を呼びます。",
        ],
    },
]

LUCKY_ITEMS = [
    "黄金のペン",
    "お気に入りのマグカップ",
    "白いハンカチ",
    "イヤホン",
    "付箋メモ",
    "温かいお茶",
    "スニーカー",
    "小さなキーホルダー",
    "手帳",
    "チョコレート",
]

LUCKY_COLORS = [
    "ゴールド",
    "茜色",
    "ラベンダー",
    "翡翠グリーン",
    "スカイブルー",
    "桜ピンク",
    "山吹色",
    "スノーホワイト",
]


@omikuji_bp.post("/api/threads/<int:thread_id>/omikuji")
def draw_omikuji(thread_id):
    with connect() as con:
        thread = con.execute(
            "SELECT id, thread_type FROM threads WHERE id = ?",
            (thread_id,),
        ).fetchone()
        if thread is None:
            return jsonify({"error": "thread not found"}), 404
        if thread["thread_type"] != "omikuji":
            return jsonify({"error": "omikuji is only available in the omikuji thread"}), 400

    fortune = random.choices(
        FORTUNES,
        weights=[f["weight"] for f in FORTUNES],
        k=1,
    )[0]
    advice = random.choice(fortune["advices"])
    lucky_item = random.choice(LUCKY_ITEMS)
    lucky_color = random.choice(LUCKY_COLORS)

    message_text = (
        f"🎋 おみくじ結果：【{fortune['label']}】\n"
        f"{advice}\n"
        f"✨ ラッキーアイテム：{lucky_item} / ラッキーカラー：{lucky_color}"
    )

    return jsonify({
        "message_text": message_text,
        "omikuji": {
            "tier": fortune["tier"],
            "label": fortune["label"],
            "advice": advice,
            "lucky_item": lucky_item,
            "lucky_color": lucky_color,
        },
    })
