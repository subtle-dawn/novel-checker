import { useMemo, useState } from "react";
import "./App.css";

type Issue = {
  id: string;
  label: string;
  original: string;
  suggestion?: string;
  start: number;
  end: number;
};

function findIssues(text: string): Issue[] {
  const issues: Issue[] = [];

  // 半角のダブルクォーテーション
  for (const match of text.matchAll(/"([^"\n]*)"/g)) {
    const start = match.index ?? 0;

    issues.push({
      id: `quote-${start}`,
      label: "半角ダブルクォーテーション",
      original: match[0],
      suggestion: `〝${match[1]}〟`,
      start,
      end: start + match[0].length,
    });
  }

  // 算用数字
  for (const match of text.matchAll(/[0-9]+/g)) {
    const start = match.index ?? 0;

    issues.push({
      id: `number-${start}`,
      label: "算用数字",
      original: match[0],
      start,
      end: start + match[0].length,
    });
  }

  return issues.sort((a, b) => a.start - b.start);
}

function App() {
  const [text, setText] = useState("");

  const issues = useMemo(() => findIssues(text), [text]);

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
          <h2>チェック結果</h2>

          {issues.length === 0 ? (
            <p className="empty-message">
              現在、指摘はありません。
            </p>
          ) : (
            <ul className="issue-list">
              {issues.map((issue) => (
                <li key={issue.id} className="issue">
                  <strong>{issue.label}</strong>

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