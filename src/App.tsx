import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { compileAndRun } from "./interpreter";
import type { Step } from "./interpreter";
import { getLanguage, getAllLanguages } from "./languages";
import type { Language } from "./languages";
import { CodeView } from "./components/CodeView";
import { VariablesPanel } from "./components/VariablesPanel";
import { ArrayView } from "./components/ArrayView";
import { Controls } from "./components/Controls";
import { Mascot } from "./components/Mascot";
import { TraceLog } from "./components/TraceLog";
import { TerminalPanel } from "./components/TerminalPanel";
import { ReplPanel } from "./components/ReplPanel";
import type { VarSnapshot } from "./interpreter";

type Mode = "editing" | "running";
type Theme = "dark" | "light";

// ---------- Compartilhamento por URL (deflate nativo) ----------

// Dicionário: tokens comuns → bytes de controle (0x01-0x1F, exceto 0x00/0x09/0x0A/0x0D)
const TOKEN_DICT: [string, string][] = [
  ['System.out.println', '\x01'], ['fimalgoritmo', '\x02'], ['console.log', '\x03'],
  ['fimenquanto', '\x04'], ['#include', '\x05'], ['<stdio.h>', '\x06'],
  ['function', '\x07'], ['escreva', '\x08'], ['inteiro', '\x0B'],
  ['enquanto', '\x0C'], ['algoritmo', '\x0E'], ['println', '\x0F'],
  ['return', '\x10'], ['printf', '\x11'], ['String', '\x12'],
  ['public', '\x13'], ['static', '\x14'], ['fimse', '\x15'],
  ['float', '\x16'], ['while', '\x17'], ['scanf', '\x18'],
  ['senao', '\x19'], ['entao', '\x1A'], ['void', '\x1B'],
  ['main', '\x1C'], ['leia', '\x1D'], ['para', '\x1E'],
  ['fimpara', '\x1F'],
];

function dictEncode(s: string): string {
  for (const [word, byte] of TOKEN_DICT) s = s.split(word).join(byte);
  return s;
}
function dictDecode(s: string): string {
  for (const [word, byte] of TOKEN_DICT) s = s.split(byte).join(word);
  return s;
}

function minifyForShare(source: string): string {
  return source
    .split('\n')
    .map(l => l.trimStart())
    .filter(l => l.length > 0)
    .join('\n');
}

async function compressToURL(langId: string, source: string): Promise<string> {
  const payload = `${langId}\0${dictEncode(minifyForShare(source))}`;
  const stream = new Blob([payload]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const buf = await new Response(stream).arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const b64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${window.location.origin}${window.location.pathname}#s=${b64}`;
}

async function shortenIfPossible(longURL: string): Promise<string> {
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return longURL;
  try {
    const res = await fetch(`https://is.gd/create.php?format=json&url=${encodeURIComponent(longURL)}`);
    if (!res.ok) return longURL;
    const data = await res.json();
    return data.shorturl ?? longURL;
  } catch {
    return longURL;
  }
}

async function decompressFromURL(): Promise<{ langId: string; source: string } | null> {
  try {
    const hash = window.location.hash.slice(1);
    if (!hash) return null;
    const params = new URLSearchParams(hash);
    const s = params.get('s');
    if (s) {
      const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      const text = await new Response(stream).text();
      const sep = text.indexOf('\0');
      if (sep < 0) return null;
      return { langId: text.slice(0, sep), source: dictDecode(text.slice(sep + 1)) };
    }
    // Formato legado (base64 simples)
    const langId = params.get('lang');
    const code = params.get('code');
    if (!langId || !code) return null;
    return { langId, source: decodeURIComponent(escape(atob(code))) };
  } catch {
    return null;
  }
}

// ---------- Layout persistido ----------
interface LayoutConfig {
  colLeft: number;   // fração da largura para coluna esquerda (0-1)
  colRight: number;  // fração da largura para coluna direita (0-1)
  midSplit: number;  // fração vertical da coluna central (topo, 0-1)
  rightSplit: number; // fração vertical da coluna direita (topo, 0-1)
}

const DEFAULT_LAYOUT: LayoutConfig = {
  colLeft: 0.333,
  colRight: 0.25,
  midSplit: 0.45,
  rightSplit: 0.42,
};

const LAYOUT_KEY = "almocar.layout";

function loadLayout(): LayoutConfig {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (raw) return { ...DEFAULT_LAYOUT, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_LAYOUT };
}
function saveLayout(l: LayoutConfig) {
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(l));
}

function DragDivider({
  direction,
  onDrag,
}: {
  direction: "col" | "row";
  onDrag: (delta: number, total: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startPos = direction === "col" ? e.clientX : e.clientY;
      const parent = ref.current?.parentElement;
      if (!parent) return;
      const total =
        direction === "col" ? parent.offsetWidth : parent.offsetHeight;

      const onMove = (ev: MouseEvent) => {
        const cur = direction === "col" ? ev.clientX : ev.clientY;
        onDrag(cur - startPos, total);
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      document.body.style.cursor =
        direction === "col" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [direction, onDrag],
  );

  return (
    <div
      ref={ref}
      className={`drag-divider drag-divider-${direction}`}
      onMouseDown={onMouseDown}
    />
  );
}

export default function App() {
  const [exampleKey, setExampleKey] = useState<string>(() => Object.keys(getLanguage("c").examples)[0]);
  const [source, setSource] = useState<string>(() => Object.values(getLanguage("c").examples)[0].code);
  const [mode, setMode] = useState<Mode>("editing");
  const [steps, setSteps] = useState<Step[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(800);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem("almocar.theme") as Theme) ?? "dark",
  );
  const [languageId, setLanguageId] = useState<string>("c");
  const lang: Language = useMemo(() => getLanguage(languageId), [languageId]);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [collectedInputs, setCollectedInputs] = useState<string[]>([]);
  const [waitingForInput, setWaitingForInput] = useState(false);
  const [inputConv, setInputConv] = useState("");
  const playRef = useRef<number | null>(null);
  const sourceRef = useRef(source);
  const langRef = useRef(lang);
  useEffect(() => { sourceRef.current = source; }, [source]);
  useEffect(() => { langRef.current = lang; }, [lang]);
  const [layout, setLayout] = useState<LayoutConfig>(loadLayout);
  const [fontSize, setFontSize] = useState<number>(
    () => Number(localStorage.getItem("almocar.fontSize")) || 12.5,
  );
  const [arrayZoom, setArrayZoom] = useState<number>(
    () => Number(localStorage.getItem("almocar.arrayZoom")) || 1,
  );
  const [replMode, setReplMode] = useState(false);
  const [replScope, setReplScope] = useState<VarSnapshot[]>([]);
  const [replStorage, setReplStorage] = useState<Record<string, string> | undefined>();

  function changeFontSize(delta: number) {
    setFontSize((prev) => {
      const next = Math.min(24, Math.max(8, +(prev + delta).toFixed(1)));
      localStorage.setItem("almocar.fontSize", String(next));
      return next;
    });
  }

  function changeArrayZoom(delta: number) {
    setArrayZoom((prev) => {
      const next = Math.min(2, Math.max(0.5, +(prev + delta).toFixed(2)));
      localStorage.setItem("almocar.arrayZoom", String(next));
      return next;
    });
  }

  function updateLayout(patch: Partial<LayoutConfig>) {
    setLayout((prev) => {
      const next = { ...prev, ...patch };
      saveLayout(next);
      return next;
    });
  }

  function resetLayout() {
    setLayout({ ...DEFAULT_LAYOUT });
    saveLayout({ ...DEFAULT_LAYOUT });
    setFontSize(12.5);
    localStorage.setItem("almocar.fontSize", "12.5");
    setArrayZoom(1);
    localStorage.setItem("almocar.arrayZoom", "1");
  }

  // Carrega código compartilhado da URL (async por causa do deflate nativo).
  useEffect(() => {
    if (!window.location.hash) return;
    decompressFromURL().then((shared) => {
      if (shared) {
        const formatted = getLanguage(shared.langId).format(shared.source);
        setSource(formatted);
        setLanguageId(shared.langId);
        setExampleKey('');
      }
      history.replaceState(null, '', window.location.pathname);
    });
  }, []);

  // Aplica o tema na raiz do documento.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("theme-dark", "theme-light");
    root.classList.add(`theme-${theme}`);
    localStorage.setItem("almocar.theme", theme);
  }, [theme]);

  // Em modo edição, ignoramos o estado da execução anterior para que os
  // painéis (variáveis, matriz, saída, status) fiquem limpos.
  const current = mode === "running" ? steps[stepIndex] : undefined;
  const visSteps = mode === "running" ? steps : [];
  const visStepIndex = mode === "running" ? stepIndex : 0;
  const mood = useMemo<"idle" | "cooking" | "success" | "error">(() => {
    if (mode === "editing" && error) return "error";
    if (mode === "editing") return "idle";
    if (!current) return "idle";
    if (current.status === "error") return "error";
    if (current.status === "success") return "success";
    return "cooking";
  }, [mode, current, error]);

  // Extrai a linha do erro da mensagem (ex: "linha 5, col 3") para destacar no código.
  const errorLine = useMemo(() => {
    if (mode === "running" && current?.status === "error") return current.line;
    if (mode === "editing" && error) {
      const m = error.match(/linha\s+(\d+)/);
      return m ? parseInt(m[1], 10) : undefined;
    }
    return undefined;
  }, [mode, current, error]);

  useEffect(() => {
    if (!playing) return;
    if (stepIndex >= steps.length - 1) {
      setPlaying(false);
      return;
    }
    playRef.current = window.setTimeout(
      () => setStepIndex((i) => Math.min(i + 1, steps.length - 1)),
      speed,
    );
    return () => {
      if (playRef.current) window.clearTimeout(playRef.current);
    };
  }, [playing, stepIndex, steps.length, speed]);

  function cozinhar() {
    setCollectedInputs([]);
    executeWith([]);
  }

  function executeWith(inputs: string[], jumpToEnd = false) {
    const result = compileAndRun(sourceRef.current, langRef.current, {
      inputs: inputs.join(" "),
      requestMoreInput: () => null,
    });

    // Se houve erro de compilação, permanece em modo edição.
    if (!result.ok && !result.needsInput) {
      setError(result.error ?? "Erro desconhecido");
      return;
    }

    setSteps(result.steps);
    setMode("running");
    setPlaying(false);
    if (result.needsInput) {
      setWaitingForInput(true);
      setInputConv(result.inputConv ?? "");
      setStepIndex(result.steps.length - 1);
      setError(null);
    } else {
      setWaitingForInput(false);
      setInputConv("");
      setStepIndex(jumpToEnd ? Math.max(0, result.steps.length - 1) : 0);
      setError(null);
    }
  }

  function handleInputSubmit(value: string) {
    const newInputs = [...collectedInputs, value];
    setCollectedInputs(newInputs);
    executeWith(newInputs, true);
  }

  function voltarEditar() {
    setMode("editing");
    setPlaying(false);
    setWaitingForInput(false);
    setInputConv("");
  }

  function formatarCodigo() {
    setSource((s) => lang.format(s));
  }

  // Atalhos globais: ←/→ navegam entre passos durante a execução.
  // Ctrl+Enter alterna entre executar e parar.
  // Ignora quando o foco está em um campo editável (textarea/input/select).
  useEffect(() => {
    function isEditable(t: EventTarget | null): boolean {
      if (!(t instanceof HTMLElement)) return false;
      const tag = t.tagName;
      return (
        tag === "TEXTAREA" ||
        tag === "INPUT" ||
        tag === "SELECT" ||
        t.isContentEditable
      );
    }
    function onKey(e: KeyboardEvent) {
      // Ctrl+Enter: executar ou parar
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (mode === "editing") cozinhar();
        else voltarEditar();
        return;
      }
      if (mode !== "running") return;
      if (isEditable(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === ' ') {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setStepIndex((i) => Math.min(steps.length - 1, i + 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setStepIndex((i) => Math.max(0, i - 1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, steps.length]);

  function loadExample(key: string) {
    setExampleKey(key);
    setSource(lang.examples[key].code);
    setMode("editing");
    setSteps([]);
    setStepIndex(0);
    setError(null);
    setCollectedInputs([]);
    setWaitingForInput(false);
    setInputConv("");
  }

  function handleLanguageChange(newLangId: string) {
    const newLang = getLanguage(newLangId);
    setLanguageId(newLangId);
    const firstKey = Object.keys(newLang.examples)[0];
    setExampleKey(firstKey);
    setSource(newLang.examples[firstKey].code);
    setMode("editing");
    setSteps([]);
    setStepIndex(0);
    setError(null);
    setCollectedInputs([]);
    setWaitingForInput(false);
    setInputConv("");
    if (newLangId !== 'javascript') {
      setReplMode(false);
      setReplScope([]);
      setReplStorage(undefined);
    }
  }

  return (
    <div
      className="h-screen flex flex-col overflow-hidden relative"
      style={{ zIndex: 0 }}
    >
      <Header
        exampleKey={exampleKey}
        onExample={loadExample}
        onCozinhar={cozinhar}
        onEditar={voltarEditar}
        mode={mode}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        language={lang}
        onLanguageChange={handleLanguageChange}
        onAbout={() => setAboutOpen(true)}
        onResetLayout={resetLayout}
        replMode={replMode}
        onToggleRepl={() => {
          setReplMode(r => !r);
          setReplScope([]);
          setReplStorage(undefined);
        }}
        onNew={() => {
          setSource('');
          setExampleKey('');
          setMode('editing');
          setSteps([]);
          setStepIndex(0);
          setError(null);
          setCollectedInputs([]);
          setWaitingForInput(false);
          setInputConv('');
        }}
        onShare={async () => {
          const longURL = await compressToURL(languageId, source);
          const url = await shortenIfPossible(longURL);
          await navigator.clipboard.writeText(url);
        }}
        onDownload={() => {
          const extMap: Record<string, string> = { c: '.c', java: '.java', javascript: '.js', portugol: '.por' };
          const ext = extMap[languageId] ?? '.txt';
          const blob = new Blob([source], { type: 'text/plain;charset=utf-8' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `codigo${ext}`;
          a.click();
          URL.revokeObjectURL(a.href);
        }}
      />
      {aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} />}

      <div className="px-6 pb-3">
        <Mascot
          mood={mood}
          message={current?.description ?? error ?? undefined}
          stepIndex={visStepIndex}
          totalSteps={visSteps.length}
        />
      </div>

      <main className="flex-1 flex gap-0 px-6 pb-3 min-h-0">
        {/* I — Código / Console */}
        {replMode ? (
          <section style={{ width: `${layout.colLeft * 100}%`, minWidth: 200 }} className="flex flex-col min-h-0">
            <ReplPanel
              language={lang}
              fontSize={fontSize}
              onChangeFontSize={changeFontSize}
              onScopeChange={(scope, storage) => {
                setReplScope(scope);
                setReplStorage(storage);
              }}
            />
          </section>
        ) : (
        <section className="panel code-panel flex flex-col min-h-0" style={{ width: `${layout.colLeft * 100}%`, minWidth: 200 }}>
          <div className="panel-title">
            <span className="chapter">I</span>
            <span className="label">Código</span>
            <span className="meta">
              {mode === "editing" ? "edição" : "execução"}
            </span>
            <span className="flex items-center gap-1 ml-auto">
              <button
                onClick={() => changeFontSize(-1)}
                className="panel-action"
                title="Diminuir fonte"
                style={{ padding: '0 5px', minWidth: 0 }}
              >
                A−
              </button>
              <span className="text-[10px] tabular-nums text-ink-mute" style={{ minWidth: 28, textAlign: 'center' }}>
                {fontSize}px
              </span>
              <button
                onClick={() => changeFontSize(1)}
                className="panel-action"
                title="Aumentar fonte"
                style={{ padding: '0 5px', minWidth: 0 }}
              >
                A+
              </button>
            </span>
            {mode === "editing" ? (
              <>
                <button
                  onClick={formatarCodigo}
                  className="panel-action"
                  title="Formatar código (re-indentar)"
                >
                  Formatar
                </button>
                <button
                  onClick={cozinhar}
                  className="panel-action panel-action-primary"
                  title="Executar o código (Ctrl+Enter)"
                >
                  Executar
                </button>
              </>
            ) : (
              <button
                onClick={voltarEditar}
                className="panel-action panel-action-stop"
                title="Voltar para edição"
              >
                ■ Parar
              </button>
            )}
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <CodeView
              source={source}
              activeLine={mode === "running" ? current?.line : undefined}
              errorLine={errorLine}
              editable={mode === "editing"}
              onChange={(s) => {
                setSource(s);
                if (error) setError(null);
              }}
              onFormat={formatarCodigo}
              highlight={lang.highlight}
              fontSize={fontSize}
            />
          </div>
        </section>
        )}

        {/* Divider left|center */}
        <DragDivider direction="col" onDrag={(delta, total) => {
          updateLayout({ colLeft: Math.min(0.6, Math.max(0.15, layout.colLeft + delta / total)) });
        }} />

        {/* II — Estruturas  +  III — Terminal */}
        <section className="flex flex-col gap-0 min-h-0" style={{ width: `${(1 - layout.colLeft - layout.colRight) * 100}%`, minWidth: 200 }}>
          <div
            className="flex-shrink-0 min-h-0 flex"
            style={{ height: `${layout.midSplit * 100}%`, minHeight: 60 }}
          >
            <ArrayView vars={replMode ? replScope : (current?.scope ?? [])} zoom={arrayZoom} onZoomChange={changeArrayZoom} storage={replMode ? replStorage : current?.storage} />
          </div>
          <DragDivider direction="row" onDrag={(delta, total) => {
            updateLayout({ midSplit: Math.min(0.8, Math.max(0.15, layout.midSplit + delta / total)) });
          }} />
          <div className="flex-1 min-h-0">
            <TerminalPanel
              output={current?.output ?? ""}
              waitingForInput={
                waitingForInput && stepIndex === steps.length - 1
              }
              inputConv={inputConv}
              onSubmit={handleInputSubmit}
              fontSize={fontSize}
            />
          </div>
        </section>

        {/* Divider center|right */}
        <DragDivider direction="col" onDrag={(delta, total) => {
          updateLayout({ colRight: Math.min(0.5, Math.max(0.12, layout.colRight - delta / total)) });
        }} />

        {/* IV — Variáveis  +  V — Trace */}
        <section className="flex flex-col gap-0 min-h-0" style={{ width: `${layout.colRight * 100}%`, minWidth: 150 }}>
          <div className="flex-shrink-0 min-h-0" style={{ height: `${layout.rightSplit * 100}%`, minHeight: 60 }}>
            <VariablesPanel vars={replMode ? replScope : (current?.scope ?? [])} fontSize={fontSize} />
          </div>
          <DragDivider direction="row" onDrag={(delta, total) => {
            updateLayout({ rightSplit: Math.min(0.8, Math.max(0.15, layout.rightSplit + delta / total)) });
          }} />
          <div className="flex-1 min-h-0">
            <TraceLog
              steps={visSteps}
              current={visStepIndex}
              onSelect={setStepIndex}
              fontSize={fontSize}
            />
          </div>
        </section>
      </main>

      <div className="px-6 pb-4">
        <Controls
          step={visStepIndex}
          total={visSteps.length}
          playing={playing}
          speed={speed}
          disabled={mode === "editing"}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onPrev={() => setStepIndex((i) => Math.max(0, i - 1))}
          onNext={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}
          onReset={() => {
            setStepIndex(0);
            setPlaying(false);
          }}
          onJump={(i) => setStepIndex(i)}
          onSpeedChange={setSpeed}
        />
      </div>
    </div>
  );
}

function Header({
  exampleKey,
  onExample,
  onCozinhar,
  onEditar,
  mode,
  theme,
  onToggleTheme,
  language,
  onLanguageChange,
  onAbout,
  onResetLayout,
  onNew,
  onShare,
  onDownload,
  replMode,
  onToggleRepl,
}: {
  exampleKey: string;
  onExample: (k: string) => void;
  onCozinhar: () => void;
  onEditar: () => void;
  mode: Mode;
  theme: Theme;
  onToggleTheme: () => void;
  language: Language;
  onLanguageChange: (l: string) => void;
  onAbout: () => void;
  onResetLayout: () => void;
  onNew: () => void;
  onShare: () => Promise<void>;
  onDownload: () => void;
  replMode: boolean;
  onToggleRepl: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const allLanguages = getAllLanguages();
  return (
    <header className="px-6 pt-5 pb-4 flex items-baseline gap-6 border-b border-bg-crust">
      <h1 className="wordmark select-none">
        almo<span className="accent">ç</span>ar
      </h1>
      <span className="smallcaps text-ink-fade hidden lg:inline">
        execução passo a passo · caderno editorial
      </span>

      <button onClick={onAbout} className="btn">
        Sobre
      </button>
      <button onClick={onNew} className="btn">
        Novo
      </button>
      {language.id === 'javascript' && (
        <button
          onClick={onToggleRepl}
          className={`btn${replMode ? ' btn-active' : ''}`}
          title={replMode ? 'Voltar ao editor' : 'Abrir console interativo (REPL)'}
        >
          {replMode ? '⌨ Editor' : '⟩_ Console'}
        </button>
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <select
          value={language.id}
          onChange={(e) => onLanguageChange(e.target.value)}
          className="menu-select"
          title="Linguagem"
        >
          {allLanguages.map((lang) => (
            <option key={lang.id} value={lang.id}>
              {lang.name}
            </option>
          ))}
        </select>
        <select
          value={exampleKey}
          onChange={(e) => onExample(e.target.value)}
          className="menu-select min-w-[200px]"
          title="Exemplo"
        >
          {exampleKey === '' && (
            <option value="" disabled>— selecione um exemplo —</option>
          )}
          {Object.entries(language.examples).map(([k, v]) => (
            <option key={k} value={k}>
              {v.name}
            </option>
          ))}
        </select>
        <button
          onClick={onDownload}
          className="btn btn-icon"
          title="Baixar arquivo de código"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
        <button
          onClick={async () => {
            setCopied(true);
            await onShare();
            setTimeout(() => setCopied(false), 2000);
          }}
          className="btn"
          title="Copiar link de compartilhamento"
        >
          {copied ? '\u2713 Copiado!' : 'Compartilhar'}
        </button>
        <button
          onClick={onToggleTheme}
          className="btn btn-icon"
          title={
            theme === "dark"
              ? "Mudar para modo claro"
              : "Mudar para modo escuro"
          }
        >
          {theme === "dark" ? "☀" : "☾"}
        </button>
        <button
          onClick={onResetLayout}
          className="btn btn-icon"
          title="Resetar layout dos painéis"
        >
          ⟲
        </button>
      </div>
    </header>
  );
}

function AboutDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      <div
        className="panel max-w-lg w-full p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between mb-4">
          <h2
            className="display text-ink"
            style={{
              fontSize: "32px",
              fontVariationSettings: "'opsz' 144",
              letterSpacing: "-0.02em",
            }}
          >
            sobre o <span className="text-ember">almoçar</span>
          </h2>
          <button
            onClick={onClose}
            className="btn btn-icon"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="text-ink-dim text-[13px] leading-relaxed space-y-4 font-sans">
          <div className="flex flex-col gap-0.5 pl-1">
            <div>
              <span className="text-ember">A </span>mbiente
            </div>
            <div>
              <span className="text-ember">L </span>údico de
            </div>
            <div>
              <span className="text-ember">M </span>onitoramento de
            </div>
            <div>
              <span className="text-ember">O </span>perações e
            </div>
            <div>
              <span className="text-ember">C </span>ódigo
            </div>
            <div>
              <span className="text-ember">A </span>lgorítmico
            </div>
            <div>
              <span className="text-ember">R </span>esponsivo
            </div>
          </div>
          <p>
            A ferramenta permite visualizar a execução de algoritmos passo a
            passo, acompanhando o estado da memória, das variáveis e da saída a
            cada instrução, com o objetivo de auxiliar estudantes a desenvolver
            um modelo mental claro do funcionamento do código.
          </p>
          <div className="hairline my-2" />
          <p className="text-ink-mute text-xs leading-relaxed">
            Desenvolvido por{" "}
            <span className="text-ink">Prof. Allan Jheyson</span>
            {" · "}
            <a
              href="https://github.com/allramos"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink-mute hover:text-ember transition-colors inline-block align-middle"
              title="GitHub @allramos"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </a>
            {" · "}
            <a
              href="https://instagram.com/allramos"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink-mute hover:text-ember transition-colors inline-block align-middle"
              title="Instagram @allramos"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
              </svg>
            </a>
            <br />
            <span className="text-ink">Colégio Técnico de Bom Jesus · </span>
            Curso Técnico em Informática
            <br />
            Turma de
            <span className="text-ink">
              {" "}
              Programação Estruturada · Turma 2026.1
            </span>
          </p>
          <p className="text-ink-mute text-xs leading-relaxed">
            <span>

            MIT License
            <br />
            Copyright (c) 2026 Allan Jheyson
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
