"use client";

import { useEffect, useRef, useState } from "react";

const modeOptions = [
  "math",
  "science",
  "factoids",
  "coding",
  "writing",
  "reading",
  "fast general",
];

export default function Page() {
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState("fast general"); // store dropdown value
  const [response, setResponse] = useState("");       // store backend answer
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const textarea = promptRef.current;
    if (!textarea) return;

    const resize = () => {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 224)}px`;
    };

    textarea.addEventListener("input", resize);
    resize();

    return () => {
      textarea.removeEventListener("input", resize);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // prevent form from refreshing the page
    if (!promptRef.current) return;

    const query = promptRef.current.value;

    setLoading(true);
    setResponse("");

    try {
      const res = await fetch("/api/chat", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, mode }),
    });

      const data = await res.json();
      setResponse(data.answer || "No response from backend.");
    } catch (err) {
      console.error(err);
      setResponse("Error: something went wrong");
    }

    setLoading(false);
  };

  return (
    <main className="appShell">
      <h1 className="brand">RouteAI</h1>

      <form className="promptForm" onSubmit={handleSubmit}>
        <label className="srOnly" htmlFor="modeSelect">
          Response mode
        </label>
        <select
          id="modeSelect"
          name="mode"
          className="modeSelect"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
        >
          {modeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <label className="srOnly" htmlFor="prompt">
          Message RouteAI
        </label>
        <textarea
          id="prompt"
          name="prompt"
          ref={promptRef}
          className="promptInput"
          rows={1}
          placeholder="Message RouteAI"
        />

        <button className="sendButton" type="submit" aria-label="Send message">
          <span aria-hidden="true">↑</span>
        </button>
      </form>

      {loading && <p>Loading...</p>}
      {response && (
        <div>
          <h2>Answer:</h2>
          <p>{response}</p>
        </div>
      )}

      <style jsx>{`
        :global(:root) {
          color-scheme: dark;
        }

        :global(*) {
          box-sizing: border-box;
        }

        :global(body) {
          margin: 0;
          min-height: 100vh;
          display: grid;
          place-items: center;
          font-family: Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          background: radial-gradient(circle at top, #171717 0%, #0b0b0b 55%);
          color: #f2f2f2;
        }

        .appShell {
          width: min(900px, calc(100vw - 2rem));
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.25rem;
        }

        .brand {
          margin: 0;
          font-size: clamp(2.5rem, 8vw, 4.25rem);
          line-height: 1;
          letter-spacing: 0.04em;
          font-weight: 700;
        }

        .promptForm {
          width: 100%;
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: end;
          gap: 0.65rem;
          padding: 0.72rem;
          border: 1px solid #2f2f2f;
          border-radius: 1.55rem;
          background-color: #141414;
          box-shadow: 0 4px 24px rgb(0 0 0 / 0.45), inset 0 1px 0 rgb(255 255 255 / 0.03);
        }

        .promptForm:focus-within {
          border-color: #4b4b4b;
        }

        .modeSelect {
          align-self: stretch;
          border: 1px solid #2f2f2f;
          border-radius: 1rem;
          background: #1c1c1c;
          color: #f2f2f2;
          font-size: 0.95rem;
          padding: 0.6rem 0.75rem;
          outline: none;
          min-width: 11.75rem;
          text-transform: capitalize;
        }

        .modeSelect:focus-visible {
          border-color: #4b4b4b;
        }

        .promptInput {
          resize: none;
          border: none;
          outline: none;
          background: transparent;
          color: #f2f2f2;
          font-size: 1rem;
          line-height: 1.45;
          min-height: 1.8rem;
          max-height: 14rem;
          padding: 0.55rem 0;
        }

        .promptInput::placeholder {
          color: #949494;
        }

        .sendButton {
          border: none;
          border-radius: 999px;
          width: 2.25rem;
          height: 2.25rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #2a2a2a;
          color: #f2f2f2;
          cursor: pointer;
          transition: background-color 140ms ease;
          font-size: 1rem;
        }

        .sendButton:hover {
          background: #3a3a3a;
        }

        .sendButton:focus-visible {
          outline: 2px solid #949494;
          outline-offset: 2px;
        }

        .srOnly {
          position: absolute;
          width: 1px;
          height: 1px;
          margin: -1px;
          padding: 0;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          border: 0;
        }

        @media (max-width: 760px) {
          .promptForm {
            grid-template-columns: 1fr auto;
          }

          .modeSelect {
            grid-column: 1 / -1;
            min-width: 0;
          }
        }
      `}</style>
    </main>
  );
}
