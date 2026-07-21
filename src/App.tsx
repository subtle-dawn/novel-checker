import { useEffect, useMemo, useState } from "react";
import "./App.css";

// ========================================
// 型定義
// ========================================

type Issue = {
  id: string;
  label: string;
  description: string;
  original: string;
  suggestion?: string;
  start: number;
  end: number;
};

// ========================================
// 漢数字変換
// ========================================

// 数字 → 漢数字
const kanjiDigits = [
  "〇",
  "一",
  "二",
  "三",
  "四",
  "五",
  "六",
  "七",
  "八",
  "九",
];

// 1～9999の位
const smallUnits = ["", "十", "百", "千"];
// 万・億・兆...
const largeUnits = ["", "万", "億", "兆", "京"];

// ========================================
// 漢数字変換関数
// ========================================

// 0～9999を漢数字へ変換
function convertUnder10000(value: number): string {
  if (value === 0) {
    return "";
  }

  let result = "";

  for (let position = 3; position >= 0; position -= 1) {
    const divisor = 10 ** position;
    const digit = Math.floor(value / divisor) % 10;

    if (digit === 0) {
      continue;
    }

    if (!(digit === 1 && position > 0)) {
      result += kanjiDigits[digit];
    }

    result += smallUnits[position];
  }

  return result;
}

// 算用数字を漢数字へ変換
function arabicNumberToKanji(numberText: string): string {
  if (/^0+$/.test(numberText)) {
    return "〇";
  }

  if (numberText.length > 1 && numberText.startsWith("0")) {
    return convertDigitsOneByOne(numberText);
  }

  let value: bigint;

  try {
    value = BigInt(numberText);
  } catch {
    return numberText;
  }

  if (value === 0n) {
    return "〇";
  }

  let result = "";
  let unitIndex = 0;

  while (value > 0n) {
    const group = Number(value % 10000n);

    if (group !== 0) {
      if (unitIndex >= largeUnits.length) {
        return convertDigitsOneByOne(numberText);
      }

      result =
        convertUnder10000(group) +
        largeUnits[unitIndex] +
        result;
    }

    value /= 10000n;
    unitIndex += 1;
  }

  return result;
}

// 西暦などを一文字ずつ漢数字へ変換
function convertDigitsOneByOne(numberText: string): string {
  return [...numberText]
    .map((digit) => kanjiDigits[Number(digit)])
    .join("");
}

// ========================================
// 校正処理
// ========================================

// 原稿から指摘一覧を作成する
function findIssues(text: string): Issue[] {
  const issues: Issue[] = [];

  // 指摘を追加する共通処理
  const addMatches = (
    pattern: RegExp,
    label: string,
    description: string,
    getSuggestion?: (match: RegExpMatchArray) => string,
  ) => {
    for (const match of text.matchAll(pattern)) {
      const start = match.index ?? 0;

      issues.push({
        id: `${label}-${start}`,
        label,
        description,
        original: match[0],
        suggestion: getSuggestion?.(match),
        start,
        end: start + match[0].length,
      });
    }
  };

  // 半角ダブルクォーテーション
  addMatches(
    /"([^"\n]*)"/g,
    "半角ダブルクォーテーション",
    "半角のダブルクォーテーションが使われています。",
    (match) => `〝${match[1]}〟`,
  );

  // 算用数字
  for (const match of text.matchAll(/[0-9]+/g)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const nextCharacter = text[end];

    const isYear = nextCharacter === "年";

    issues.push({
      id: `number-${start}`,
      label: isYear ? "西暦の算用数字" : "算用数字",
      description: isYear
        ? "西暦が算用数字で書かれています。"
        : "算用数字が使われています。漢数字に変換するか確認してください。",
      original: match[0],
      suggestion: isYear
        ? convertDigitsOneByOne(match[0])
        : arabicNumberToKanji(match[0]),
      start,
      end,
    });
  }

  // 三点リーダー
  addMatches(
    /(?:・・・|\.{3}|(?<!…)…(?!…))/g,
    "三点リーダー",
    "三点リーダーは二つ並べて使う表記に統一します。",
    () => "……",
  );

  // ダッシュ
  addMatches(
    /(?:ーー|(?<!―)―(?!―))/g,
    "ダッシュ",
    "ダッシュは二つ並べて使う表記に統一します。",
    () => "――",
  );

  // 閉じかぎ括弧直前の句点
  addMatches(
    /。」/g,
    "閉じかぎ括弧前の句点",
    "会話文末の句点を削除します。",
    () => "」",
  );

  // 半角感嘆符
  addMatches(
    /!/g,
    "半角感嘆符",
    "半角の感嘆符が使われています。",
    () => "！",
  );

  // 半角疑問符
  addMatches(
    /\?/g,
    "半角疑問符",
    "半角の疑問符が使われています。",
    () => "？",
  );

  // 感嘆符・疑問符の直後に全角スペースがない
  addMatches(
    /[！？](?=[^\s\n」』）])/g,
    "感嘆符・疑問符後の空白",
    "感嘆符や疑問符の後ろに全角スペースがありません。",
    (match) => `${match[0]}　`,
  );

  // 半角スペース
  addMatches(
    / /g,
    "半角スペース",
    "半角スペースが使われています。",
    () => "　",
  );

  // 行頭の一字下げ漏れ
  const lines = text.split("\n");
  let offset = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    const shouldIndent =
      trimmed.length > 0 &&
      !line.startsWith("　") &&
      !line.startsWith("「") &&
      !line.startsWith("『") &&
      !line.startsWith("〝") &&
      !line.startsWith("〈") &&
      !line.startsWith("【");

    if (shouldIndent) {
      issues.push({
        id: `indent-${offset}`,
        label: "行頭の一字下げ",
        description: "地の文の行頭が一字下げされていません。",
        original: line.slice(0, Math.min(line.length, 20)),
        suggestion: "　",
        start: offset,
        end: offset,
      });
    }
    
    offset += line.length + 1;
  }

  return issues.sort((a, b) => a.start - b.start);
}
// ========================================
// Reactコンポーネント
// ========================================

function App() {
  // ----------------------------------------
  // State（状態）
  // ----------------------------------------
  const [text, setText] = useState("");

  const [checkedIssueIds, setCheckedIssueIds] = useState<Set<string>>(
    new Set(),
  );

  // ----------------------------------------
  // Memo（計算結果）
  // ----------------------------------------

  const issues = useMemo(() => findIssues(text), [text]);

  // ----------------------------------------
  // Effect（自動実行）
  // ----------------------------------------

  useEffect(() => {
    setCheckedIssueIds(new Set(issues.map(issue => issue.id)));
  }, [issues]);

  // ----------------------------------------
  // Event（ボタン・入力イベント）
  // ----------------------------------------

  const replaceIssue = (issue: Issue) => {
      if (issue.suggestion === undefined) {
        return;
      }

      setText(
        text.slice(0, issue.start) +
          issue.suggestion +
          text.slice(issue.end),
      );
    };

    const toggleIssueChecked = (issueId: string) => {
    setCheckedIssueIds((current) => {
      const next = new Set(current);

      if (next.has(issueId)) {
        next.delete(issueId);
      } else {
        next.add(issueId);
      }

      return next;
    });
  };

  const replaceCheckedIssues = () => {
    const targetIssues = issues
      .filter(
        issue =>
          checkedIssueIds.has(issue.id) &&
          issue.suggestion !== undefined
      )
      .sort((a, b) => b.start - a.start);

    let nextText = text;

    for (const issue of targetIssues) {
      nextText =
        nextText.slice(0, issue.start) +
        issue.suggestion! +
        nextText.slice(issue.end);
    }

    setText(nextText);
  };

  // ----------------------------------------
  // Render（画面表示）
  // ----------------------------------------

  return (
    <main className="app">
      <header className="header">
        <h1>日本語小説表記チェッカー</h1>
        <p>
          入力内容はブラウザ内だけで処理され、外部には送信されません。
        </p>
      </header>

      <div className="workspace">
        <section className="editor-panel">
          <label htmlFor="novel-text">原稿</label>

          <textarea
            id="novel-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={'例：彼は"ありがとう"と言った。2人は歩き出した。'}
            spellCheck={false}
          />

          <div className="text-information">
            {text.length.toLocaleString()}文字
          </div>
        </section>

        <section className="issues-panel">
          <div className="issues-header">
            <h2>チェック結果</h2>

            <button
              onClick={replaceCheckedIssues}
              type="button"
            >
              チェックした指摘を全て修正
            </button>
          </div>

          {issues.length === 0 ? (
            <p className="empty-message">
              現在、指摘はありません。
            </p>
          ) : (
            <ul className="issue-list">
              {issues.map((issue) => (
                <li key={issue.id} className="issue">
                  <label className="issue-title">
                    <input
                      type="checkbox"
                      checked={checkedIssueIds.has(issue.id)}
                      onChange={() => toggleIssueChecked(issue.id)}
                    />

                    <strong>{issue.label}</strong>
                  </label>

                  <p className="issue-description">
                    {issue.description}
                  </p>

                  <div className="issue-content">
                    <code>{issue.original}</code>

                    {issue.suggestion !== undefined && (
                      <>
                        <span>→</span>
                        <code>{issue.suggestion}</code>
                      </>
                    )}
                  </div>

                  {issue.suggestion !== undefined ? (
                    <button
                      type="button"
                      onClick={() => replaceIssue(issue)}
                    >
                      修正する
                    </button>
                  ) : (
                    <p className="issue-note">
                      漢数字にする必要があるか確認してください。
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

export default App;