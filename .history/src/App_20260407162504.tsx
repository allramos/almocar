import React, { useEffect, useMemo, useRef, useState } from "react";
import { compileAndRun, Step } from "./interpreter";
import { examples } from "./examples/matriz";
import { CodeView } from "./components/CodeView";
import { VariablesPanel } from "./components/VariablesPanel";
import { ArrayView } from "./components/ArrayView";
import { Controls } from "./components/Controls";
import { Mascot } from "./components/Mascot";
import { TraceLog } from "./components/TraceLog";
import { OutputPanel } from "./components/OutputPanel";

type Mode = "editing" | "running";
type Theme = "dark" | "light";

export default function App() {
  const [exampleKey, setExampleKey] = useState<string>("matriz");
  const [source, setSource] = useState<string>(examples.matriz.code);
  const [mode, setMode] = useState<Mode>("editing");
  const [steps, setSteps] = useState<Step[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(800);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem("almocar.theme") as Theme) ?? "dark",
  );
  const [language, setLanguage] = useState<string>("c");
  const [aboutOpen, setAboutOpen] = useState(false);
  const playRef = useRef<number | null>(null);

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
    if (mode === "editing") return "idle";
    if (!current) return "idle";
    if (current.status === "error") return "error";
    if (current.status === "success") return "success";
    return "cooking";
  }, [mode, current]);

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
    const result = compileAndRun(source);
    setSteps(result.steps);
    setStepIndex(0);
    setMode("running");
    setPlaying(false);
    setError(result.ok ? null : (result.error ?? "Erro desconhecido"));
  }

  function voltarEditar() {
    setMode("editing");
    setPlaying(false);
  }

  function loadExample(key: string) {
    setExampleKey(key);
    setSource(examples[key].code);
    setMode("editing");
    setSteps([]);
    setStepIndex(0);
    setError(null);
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
        language={language}
        onLanguageChange={setLanguage}
        onAbout={() => setAboutOpen(true)}
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

      <main className="flex-1 grid gap-3 px-6 pb-3 grid-cols-12 min-h-0">
        {/* Código */}
        <section className="col-span-12 lg:col-span-4 panel flex flex-col min-h-0">
          <div className="panel-title">
            <span className="chapter">I</span>
            <span className="label">Código</span>
            <span className="meta">
              {mode === "editing" ? "edição" : "execução"}
            </span>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <CodeView
              source={source}
              activeLine={mode === "running" ? current?.line : undefined}
              editable={mode === "editing"}
              onChange={setSource}
            />
          </div>
        </section>

        {/* Estruturas + variáveis */}
        <section className="col-span-12 lg:col-span-5 flex flex-col gap-3 min-h-0">
          <div className="flex-[1.6] min-h-0">
            <ArrayView vars={current?.scope ?? []} />
          </div>
          <div className="flex-1 min-h-0">
            <VariablesPanel vars={current?.scope ?? []} />
          </div>
        </section>

        {/* Saída + trace */}
        <section className="col-span-12 lg:col-span-3 flex flex-col gap-3 min-h-0">
          <div className="flex-1 min-h-0">
            <OutputPanel output={current?.output ?? ""} />
          </div>
          <div className="flex-[1.6] min-h-0">
            <TraceLog
              steps={visSteps}
              current={visStepIndex}
              onSelect={setStepIndex}
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
}: {
  exampleKey: string;
  onExample: (k: string) => void;
  onCozinhar: () => void;
  onEditar: () => void;
  mode: Mode;
  theme: Theme;
  onToggleTheme: () => void;
  language: string;
  onLanguageChange: (l: string) => void;
  onAbout: () => void;
}) {
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

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <select
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
          className="menu-select"
          title="Linguagem"
        >
          <option value="c">C</option>
        </select>
        <select
          value={exampleKey}
          onChange={(e) => onExample(e.target.value)}
          className="menu-select min-w-[200px]"
          title="Exemplo"
        >
          {Object.entries(examples).map(([k, v]) => (
            <option key={k} value={k}>
              {v.name}
            </option>
          ))}
        </select>
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
        {mode === "editing" ? (
          <button onClick={onCozinhar} className="btn btn-primary">
            Executar
          </button>
        ) : (
          <button onClick={onEditar} className="btn">
            Editar
          </button>
        )}
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
          <p>
            <span className="text-ink font-medium">ALMOÇAR</span> é um acrônimo
            <span className="text-ember">Ambiente</span>{" "}
                  <span className="text-ink">Lúdico</span>{" "}
                  <span className="text-ink">de</span>{" "}
                  <span className="text-ink">Monitoramento</span>{" "}
                  <span className="text-ink">de</span>{" "}
                  <span className="text-ink">Operações</span>{" "}
                  <span className="text-ink">e</span>{" "}
                  <span className="text-ink">Código</span>{" "}
                  <span className="text-ink">Algorítmico</span>{" "}
                  <span className="text-ink">Responsivo</span>.
          </p>
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
            <br />
            Curso Técnico em Informática ·{" "}
            <span className="text-ink">Colégio Técnico de Bom Jesus</span>
            <br />
            Disciplina de Programação Estruturada · turma 2026.1
          </p>
        </div>
      </div>
    </div>
  );
}
