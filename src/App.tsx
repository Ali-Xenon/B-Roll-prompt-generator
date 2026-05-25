import { useState } from "react";
import { 
  Sparkles, 
  FileText, 
  Copy, 
  Check, 
  Image as ImageIcon, 
  Loader2, 
  AlertCircle, 
  Film, 
  ChevronRight, 
  BookOpen, 
  Play, 
  Info,
  Layers,
  HelpCircle,
  Clapperboard,
  Heart,
  Download
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { SAMPLE_PODCAST_SCRIPT } from "./sampleScript";
import { BrollSegment, AnalyzeResponse } from "./types";

export default function App() {
  const [script, setScript] = useState<string>(SAMPLE_PODCAST_SCRIPT);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [segments, setSegments] = useState<BrollSegment[]>([]);
  const [activeSegmentId, setActiveSegmentId] = useState<number | null>(null);

  // General state to show which prompt was copied
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const handleExportTXT = () => {
    if (segments.length === 0) return;
    
    let content = "=== NANOBANANA 2 B-ROLL PROMPTS REPORT ===\n";
    content += `Export Date: ${new Date().toLocaleString()}\n\n`;
    
    segments.forEach((seg, index) => {
      content += `[Segment ${index + 1}]\n`;
      content += `Dialogue Trigger Quote: "${seg.dialogueQuote}"\n`;
      content += `Context: ${seg.context}\n`;
      content += `Nanobanana 2 Prompt:\n${seg.brollPrompt}\n`;
      content += `--------------------------------------------------------------------------------\n\n`;
    });

    const blob = new Blob([content], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "nanobanana_broll_prompts.txt");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportCSV = () => {
    if (segments.length === 0) return;
    
    // CSV Header with standard format
    let csvContent = "Segment Number,Dialogue Quote,Visual Context,Nanobanana 2 Prompt\n";
    
    segments.forEach((seg, index) => {
      const idStr = `"${index + 1}"`;
      const quoteStr = `"${seg.dialogueQuote.replace(/"/g, '""')}"`;
      const contextStr = `"${seg.context.replace(/"/g, '""')}"`;
      const promptStr = `"${seg.brollPrompt.replace(/"/g, '""')}"`;
      
      csvContent += `${idStr},${quoteStr},${contextStr},${promptStr}\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "nanobanana_broll_prompts.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAnalyze = async () => {
    if (!script.trim()) {
      setAnalysisError("Please paste or type a podcast dialogue script first.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    setSegments([]);
    setActiveSegmentId(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ script }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to analyze script.");
      }

      const data: AnalyzeResponse = await response.json();
      if (!data.segments || data.segments.length === 0) {
        throw new Error("No B-roll opportunities could be detected. Try expanding your script.");
      }

      // Initialize segments
      const initialized = data.segments.map((seg) => ({
        ...seg,
        isGeneratingImage: false,
        generatedImageUrl: undefined,
        generationError: undefined,
      }));

      setSegments(initialized);
      setActiveSegmentId(initialized[0]?.id || null);
    } catch (err: any) {
      console.error(err);
      setAnalysisError(err.message || "An unexpected error occurred while analyzing the script.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const copyToClipboard = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const generateBrollImage = async (id: number) => {
    const targetSegment = segments.find((s) => s.id === id);
    if (!targetSegment) return;

    // Set loading state for this specific segment
    setSegments((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, isGeneratingImage: true, generationError: undefined, generatedImageUrl: undefined }
          : s
      )
    );

    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: targetSegment.brollPrompt }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Image generation failed.");
      }

      const data = await response.json();
      if (!data.imageUrl) {
        throw new Error("No image data returned from generator.");
      }

      setSegments((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, generatedImageUrl: data.imageUrl, isGeneratingImage: false } : s
        )
      );
    } catch (err: any) {
      console.error(err);
      setSegments((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                generationError: err.message || "Could not generate image. Standard limits might apply.",
                isGeneratingImage: false,
              }
            : s
        )
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-slate-300 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* Top Professional Header */}
      <header className="border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Film className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight leading-none uppercase">
                Nanobanana 2
              </h1>
              <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mt-1">
                B-Roll Architect & Prompt Engine
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              type="button"
              onClick={() => copyToClipboard(script, 99999)}
              className="px-4 py-2 bg-slate-800/40 border border-white/5 rounded-md text-xs font-medium hover:bg-slate-800/80 hover:text-white transition-colors"
            >
              {copiedId === 99999 ? "Copied Transcript!" : "Copy Full Transcript"}
            </button>
            <button 
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-bold shadow-lg shadow-indigo-500/20 active:scale-95 disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none transition-all"
            >
              {isAnalyzing ? "ANALYZING..." : "ANALYZE SCRIPT"}
            </button>
          </div>
        </div>
      </header>

      {/* Main Workflow Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:px-6 lg:py-8 flex flex-col lg:flex-row gap-8">
        
        {/* Left Side Pane: Podcast Script Input */}
        <div className="w-full lg:w-[420px] shrink-0 flex flex-col gap-6">
          <div className="bg-[#121214] border border-white/5 rounded-xl p-5 flex flex-col gap-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2 text-indigo-400 font-display font-bold text-xs uppercase tracking-wider">
                <FileText className="w-4 h-4" />
                <span>Podcast Dialogue Script</span>
              </div>
              <button
                type="button"
                onClick={() => setScript(SAMPLE_PODCAST_SCRIPT)}
                className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors bg-slate-800/30 hover:bg-slate-800/60 border border-white/5 px-2 py-1 rounded-md"
              >
                Reset to Sample
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Paste your podcast dialogue transcript below. The model will analyze the timeline, extract 10 to 12 aesthetic cutaways, and write descriptive cinematic prompts optimized for Nanobanana 2.
            </p>

            <div className="relative">
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder="Paste your dialogue script here... (e.g. Leo: Welcome...)"
                className="w-full h-[400px] lg:h-[450px] bg-[#0a0a0a] border border-white/5 rounded-lg p-4 text-sm font-sans leading-relaxed focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-300 resize-none placeholder-slate-700 shadow-inner"
              />
              <div className="absolute bottom-3 right-3 text-[10px] text-slate-500 font-mono bg-[#121214] px-2 py-0.5 rounded border border-white/5">
                {script.length.toLocaleString()} chars
              </div>
            </div>

            {analysisError && (
              <div className="bg-rose-950/20 border border-rose-900/40 rounded-lg p-3.5 flex items-start gap-2.5 text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                <div>
                  <span className="font-semibold block mb-0.5">Analysis Failed</span>
                  <span>{analysisError}</span>
                </div>
              </div>
            )}

            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="w-full relative mt-2 overflow-hidden bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded-lg shadow-lg shadow-indigo-600/10 select-none transition-all duration-200 flex items-center justify-center gap-2 group active:scale-[0.98] disabled:bg-slate-850 disabled:text-slate-650"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span className="text-xs uppercase tracking-wider font-bold">WRITING PROMPTS...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-indigo-300 group-hover:rotate-12 transition-transform" />
                  <span className="text-xs uppercase tracking-wider font-bold">ANALYZE DIALOGUE</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Guide card */}
          <div className="bg-[#121214]/60 border border-white/5 rounded-xl p-4 flex gap-3 text-slate-500 text-xs leading-relaxed">
            <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-slate-400 font-bold block mb-1 uppercase tracking-wider text-[10px]">Storyboard Protocol</span>
              <span>Each analyzed segment isolates a single dialogue trigger from the transcript and pairs it with a custom atmospheric prompt. Use copy-paste values or trigger live preview renders instantly.</span>
            </div>
          </div>
        </div>

        {/* Right Side Pane: Timeline Segments */}
        <div className="flex-1 flex flex-col gap-6">
          {segments.length === 0 ? (
            <div className="flex-1 min-h-[400px] border border-dashed border-white/5 bg-[#121214]/20 rounded-xl flex flex-col items-center justify-center p-8 text-center">
              <div className="relative mb-4">
                <div className="absolute inset-0 bg-indigo-500/5 blur-xl rounded-full"></div>
                <div className="relative border border-white/5 bg-[#121214] p-4 rounded-xl">
                  <Film className="w-8 h-8 text-slate-650" />
                </div>
              </div>
              <h3 className="text-base font-bold text-white mb-2 tracking-tight uppercase">No Storyboard Discovered Yet</h3>
              <p className="text-sm text-slate-500 max-w-sm leading-relaxed mb-6">
                Paste your show dialogue on the left and discover visually rich moments for cinematic cutaway generation.
              </p>
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/5 px-5 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-colors"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    <span>Run Sample Analysis Now</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              
              {/* Segment Header summary stats */}
              <div className="bg-[#121214] border border-white/5 p-4 rounded-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <div className="bg-slate-900 p-2 rounded border border-white/5 text-indigo-400">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-white uppercase tracking-wider">B-Roll Storyboard Timeline</h2>
                    <p className="text-[10px] text-slate-500 mt-0.5">Customized for Nanobanana 2 image pipelines</p>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full px-3 py-1.5 font-mono">
                    {segments.filter(s => s.generatedImageUrl).length} / {segments.length} Previews Loaded
                  </span>
                  
                  <div className="flex items-center gap-2 border-l border-white/10 pl-3">
                    <button
                      onClick={handleExportTXT}
                      className="inline-flex items-center gap-1 bg-slate-850 hover:bg-slate-800 border border-white/5 text-[10px] text-slate-300 font-bold px-2.5 py-1.5 rounded transition-colors uppercase tracking-wider cursor-pointer"
                      title="Export prompts as plain text (.txt)"
                    >
                      <Download className="w-3.2 h-3.2 text-indigo-400" />
                      <span>Export TXT</span>
                    </button>
                    
                    <button
                      onClick={handleExportCSV}
                      className="inline-flex items-center gap-1 bg-slate-850 hover:bg-slate-800 border border-white/5 text-[10px] text-slate-300 font-bold px-2.5 py-1.5 rounded transition-colors uppercase tracking-wider cursor-pointer"
                      title="Export prompts table as (.csv) for Spreadsheet/Dall-E"
                    >
                      <Download className="w-3.2 h-3.2 text-indigo-400" />
                      <span>Export CSV</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Storyboard List */}
              <div className="space-y-4">
                {segments.map((item, index) => {
                  const isActive = activeSegmentId === item.id;
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className={`group relative overflow-hidden bg-[#121214] rounded-xl border transition-all duration-300 ${
                        isActive 
                          ? "border-indigo-500/40 shadow-xl bg-[#121214]" 
                          : "border-white/5 hover:border-indigo-550/20"
                      }`}
                    >
                      {/* Segment Index Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-white/5 bg-[#1a1a1c]/60">
                        <div className="flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded bg-slate-800 text-[10px] font-mono font-bold flex items-center justify-center text-slate-400 group-hover:text-indigo-400 shrink-0">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="text-[10px] font-bold tracking-widest uppercase text-slate-500 font-mono">
                            Timeline Marker & Scene Cue
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyToClipboard(item.brollPrompt, item.id)}
                            className="inline-flex items-center gap-1.5 text-[11px] text-slate-300 bg-slate-800/40 hover:bg-slate-700/80 border border-white/5 px-2.5 py-1.5 rounded-md font-medium transition-colors"
                            title="Copy prompt to clipboard"
                          >
                            {copiedId === item.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-indigo-400" />
                                <span className="text-indigo-400 font-semibold font-mono">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-slate-400" />
                                <span>Copy Prompt</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => generateBrollImage(item.id)}
                            disabled={item.isGeneratingImage}
                            className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-md font-bold transition-all ${
                              item.generatedImageUrl 
                                ? "bg-[#1a1a1c] text-indigo-400 border border-indigo-500/20 hover:bg-slate-800" 
                                : "bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20"
                            } disabled:opacity-50`}
                          >
                            {item.isGeneratingImage ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                                <span>Diffusing Visual...</span>
                              </>
                            ) : item.generatedImageUrl ? (
                              <>
                                <ImageIcon className="w-3.5 h-3.5" />
                                <span>Regenerate</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>Generate Image</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Card Content (Dialogue Quote, Context and Polish Prompt) */}
                      <div className="p-5 flex flex-col md:flex-row gap-6">
                        <div className="flex-1 flex flex-col gap-4">
                          
                          {/* Dialogue Trigger block */}
                          <div className="flex flex-col gap-1.5 bg-[#0a0a0a] py-3 px-4 rounded-lg border border-white/5">
                            <span className="text-[9px] font-mono tracking-wider text-slate-500 uppercase flex items-center gap-1">
                              <BookOpen className="w-3 h-3 text-indigo-400" />
                              <span>Dialogue Link Quote</span>
                            </span>
                            <blockquote className="text-xs italic text-slate-300 border-l border-indigo-500/40 pl-3 py-0.5">
                              "{item.dialogueQuote}"
                            </blockquote>
                          </div>

                          {/* Contextual Narrative Alignment */}
                          <div className="text-xs leading-relaxed text-slate-450">
                            <span className="font-semibold text-slate-400 block mb-0.5 uppercase text-[9px] tracking-wider font-mono">Theme & Target Context:</span>
                            {item.context}
                          </div>

                          {/* Polished B-roll prompt block (one box for pasting prompt/copying easily) */}
                          <div className="flex flex-col gap-2">
                            <span className="text-[9px] font-mono tracking-wider text-indigo-400 uppercase">
                              Optimized B-Roll Prompt (For Nanobanana 2)
                            </span>
                            <div className="relative group/prompt">
                              <div className="w-full bg-[#0a0a0a] border border-white/5 text-slate-300 font-mono text-xs select-all rounded-lg p-3 leading-relaxed break-words shadow-inner overflow-y-auto max-h-[120px]">
                                {item.brollPrompt}
                              </div>
                              <button
                                onClick={() => copyToClipboard(item.brollPrompt, item.id)}
                                className="absolute right-2 top-2 opacity-0 group-hover/prompt:opacity-100 transition-opacity bg-[#121214] border border-white/5 p-1.5 rounded text-slate-400 hover:text-white"
                                title="Copy prompt code"
                              >
                                {copiedId === item.id ? (
                                  <Check className="w-3.5 h-3.5 text-indigo-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Image Output Display Area */}
                        <div className="w-full md:w-[260px] shrink-0 flex flex-col bg-[#0a0a0a] rounded-lg p-3 border border-white/5 items-center justify-center min-h-[170px] relative overflow-hidden">
                          {item.isGeneratingImage ? (
                            <div className="flex flex-col items-center gap-3 text-center p-4">
                              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                              <span className="text-[10px] font-mono text-slate-500 animate-pulse uppercase tracking-wider">
                                Diffusing frame...
                              </span>
                            </div>
                          ) : item.generatedImageUrl ? (
                            <div className="relative w-full h-full flex flex-col justify-between">
                              <img
                                src={item.generatedImageUrl}
                                alt={`Generated B-Roll Segment ${item.id}`}
                                className="w-full aspect-video object-cover rounded border border-white/5 shadow-xl"
                                referrerPolicy="no-referrer"
                              />
                              <div className="mt-2 text-[9px] font-mono text-slate-500 text-center flex items-center justify-center gap-1 uppercase tracking-widest">
                                <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
                                <span>Nanobanana 2 Cinema Wide Frame</span>
                              </div>
                            </div>
                          ) : item.generationError ? (
                            <div className="flex flex-col items-center justify-center text-center p-3 gap-2">
                              <AlertCircle className="w-6 h-6 text-rose-500/90" />
                              <div className="text-[11px] text-rose-300 font-sans leading-relaxed">
                                <span className="font-semibold block text-xs mb-0.5 uppercase">Model busy</span>
                                <span className="text-slate-500 text-[10px] line-clamp-3">
                                  {item.generationError}
                                </span>
                              </div>
                              <button
                                onClick={() => generateBrollImage(item.id)}
                                className="mt-2 text-[9px] bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 px-2 rounded font-mono"
                              >
                                Retry Preview
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center text-center p-4 text-slate-700">
                              <ImageIcon className="w-8 h-8 text-neutral-800 mb-2 animate-pulse" />
                              <span className="text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider text-[10px]">Preview Ready</span>
                              <span className="text-[10px] text-slate-650 max-w-[200px]">
                                Press \"Generate Image\" to start the rendering process.
                              </span>
                            </div>
                          )}
                        </div>

                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer Area */}
      <footer className="border-t border-white/5 bg-[#0a0a0a] py-6 px-6 text-center text-xs text-slate-600 font-sans mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
              Nanobanana Engine Online
            </span>
            <span>Model: v2.4-Turbo</span>
          </div>
          <div className="text-[10px] text-slate-500 uppercase tracking-widest leading-relaxed">
            READY FOR CUE EXTRACTION & COMPILATION
          </div>
        </div>
      </footer>
    </div>
  );
}

