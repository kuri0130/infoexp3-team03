import { updateCharCount } from './utils.js';

const TOPICS = [
    '一日だけ動物と話せるなら、どの動物と何を話す？',
    '無人島に一つだけ持っていくなら何？',
    '一週間の休みができたら、何をして過ごしたい？',
    '子どものころ信じていた、変わった思い込みは？',
    '好きなおにぎりの具、最強の一つを選ぶなら？',
    '未来の自分に一つだけ質問できるなら？',
    'もし新しい祝日を作れるなら、どんな日？',
    '給食や学食で、もう一度食べたいメニューは？',
    '一つだけ超能力を選べるなら、何がいい？',
    '最近ちょっと嬉しかったことは？',
    '一生ひとつの季節で暮らすなら、春夏秋冬どれ？',
    '自分だけの博物館を作るなら、何を展示する？',
    '一日だけ別の仕事を体験できるなら、何をする？',
    '好きな映画や本の世界に入れるなら、どの作品？',
    '明日から新しい名前で呼ばれるなら、どんな名前？',
    'カレーに入れると意外とおいしいものは？',
    'タイムマシンで過去か未来へ行くなら、どっち？',
    '一つだけ家事を自動化できるなら、何を任せる？',
    '自分を文房具にたとえると、何だと思う？',
    '一日だけ透明人間になれたら、何をしてみたい？',
    '理想の放課後・仕事終わりの過ごし方は？',
    '世界から一つだけ苦手な食べ物をなくせるなら？',
    '新しい部活を作るなら、どんな活動をする？',
    '今までで一番「自分らしい」と思った瞬間は？',
    'もし雲に乗れるなら、どこへ行ってみたい？',
    '一つだけ昔の流行を復活させるなら、何？',
    '自分の町に新しいお店を一つ作るなら？',
    '一日だけ有名人になれるなら、何をしてみたい？',
    '理想のロボットに手伝ってほしいことは？',
    'あなたの気分を天気で表すと、今日は何？'
];

export function initTopicRoulette() {
    const result = document.querySelector('#topic-result');
    const drawButton = document.querySelector('#draw-topic-button');
    const useButton = document.querySelector('#use-topic-button');
    let currentTopic = '';
    let previousIndex = -1;

    drawButton.addEventListener('click', () => {
        let index;
        do {
            index = Math.floor(Math.random() * TOPICS.length);
        } while (index === previousIndex);

        previousIndex = index;
        currentTopic = TOPICS[index];
        result.textContent = currentTopic;
        useButton.hidden = false;
    });

    useButton.addEventListener('click', () => {
        if (!currentTopic) return;

        const threadForm = document.querySelector('#thread-form');
        const titleInput = document.querySelector('#thread-title');
        const messageInput = document.querySelector('#thread-message');
        titleInput.value = currentTopic;
        messageInput.value = `お題: ${currentTopic}`;
        updateCharCount(titleInput);
        updateCharCount(messageInput);
        threadForm.hidden = false;
        titleInput.focus();
        useButton.hidden = true;
        currentTopic = '';
    });
}
