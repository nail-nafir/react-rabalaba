import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Radio, ShieldCheck, Zap, Cpu } from "lucide-react";

interface AuthShellProps {
  title: string;
  description: string;
  children: ReactNode;
  /** Secondary line under the card (e.g. the "no account? sign up" link). */
  footer?: ReactNode;
}

/** Premium split layout shared by the login + register pages:
 *  - Left side: futuristic dark terminal and finance showcase (desktop only)
 *  - Right side: clean spacious card for form entry */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: AuthShellProps) {
  return (
    <div className="flex min-h-[85vh] w-full items-center justify-center bg-background px-4 py-8 md:px-6">
      {/* Outer wrapper container with responsive split layout */}
      <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl transition-all duration-300 hover:shadow-primary/5 grid grid-cols-1 md:grid-cols-12 min-h-137.5">
        {/* Left Panel: Tech/Finance Showcase (Desktop only) */}
        <div className="relative hidden md:flex md:col-span-5 bg-slate-950 text-slate-200 p-8 flex-col justify-between overflow-hidden border-r border-white/5">
          {/* Glowing purple accent behind */}
          <div
            className="absolute inset-0 pointer-events-none z-0"
            style={{
              backgroundImage:
                "radial-gradient(circle at 100% 0%, var(--color-primary) 0%, transparent 60%), linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px)",
              backgroundSize: "100% 100%, 20px 20px, 20px 20px",
            }}
          />
          <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none z-0" />

          {/* Logo */}
          <div className="relative z-10">
            <Link
              to="/"
              className="flex items-center gap-2.5 group hover:no-underline"
            >
              <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-linear-to-br from-primary via-primary/80 to-primary/60 text-primary-foreground shadow-lg shadow-primary/20 transition-transform duration-300 group-hover:scale-105">
                <Radio className="h-4.5 w-4.5 relative z-10" />
                <div className="absolute inset-0 rounded-lg border border-white/20 z-0" />
              </div>
              <div className="flex flex-col -space-y-0.5">
                <span className="text-sm font-black tracking-tighter uppercase text-white leading-none">
                  Raba<span className="text-primary">Laba</span>
                </span>
                <span className="text-[7px] font-bold tracking-[0.2em] uppercase text-slate-400 mt-0.5 leading-none">
                  Terminal
                </span>
              </div>
            </Link>
          </div>

          {/* Simulated Terminal and Data Visualizations */}
          <div className="relative z-10 my-auto space-y-6">
            <div className="rounded-xl border border-white/5 bg-white/2 backdrop-blur-md p-4 space-y-3 shadow-inner">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">
                    Engine: online
                  </span>
                </div>
                <span className="text-[9px] font-mono text-primary font-bold">
                  V-1.0
                </span>
              </div>

              {/* Candlestick/Trend Line simulation */}
              <div className="h-24 w-full relative pt-2">
                <svg
                  className="w-full h-full overflow-visible"
                  viewBox="0 0 200 80"
                >
                  <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="var(--color-primary)"
                        stopOpacity="0.3"
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--color-primary)"
                        stopOpacity="0"
                      />
                    </linearGradient>
                  </defs>
                  {/* Fill area */}
                  <path
                    d="M 0 55 Q 25 35 50 45 T 100 15 T 150 40 T 200 8 L 200 80 L 0 80 Z"
                    fill="url(#chartGrad)"
                  />
                  {/* Glow stroke */}
                  <path
                    d="M 0 55 Q 25 35 50 45 T 100 15 T 150 40 T 200 8"
                    fill="none"
                    stroke="var(--color-primary)"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  {/* Candle bodies */}
                  <rect
                    x="45"
                    y="38"
                    width="6"
                    height="12"
                    fill="#10b981"
                    rx="1"
                  />
                  <line
                    x1="48"
                    y1="32"
                    x2="48"
                    y2="54"
                    stroke="#10b981"
                    strokeWidth="1"
                  />

                  <rect
                    x="95"
                    y="10"
                    width="6"
                    height="18"
                    fill="#10b981"
                    rx="1"
                  />
                  <line
                    x1="98"
                    y1="4"
                    x2="98"
                    y2="30"
                    stroke="#10b981"
                    strokeWidth="1"
                  />

                  <rect
                    x="145"
                    y="30"
                    width="6"
                    height="15"
                    fill="#ef4444"
                    rx="1"
                  />
                  <line
                    x1="148"
                    y1="24"
                    x2="148"
                    y2="48"
                    stroke="#ef4444"
                    strokeWidth="1"
                  />
                  {/* Spark marker dot */}
                  <circle cx="200" cy="8" r="2.5" fill="#ffffff" />
                </svg>
              </div>

              {/* Logs */}
              <div className="space-y-1 font-mono text-[9px] text-slate-400">
                <p className="text-emerald-400/90">
                  &gt; ALGO: BUY BTC @ $67,420 [TP1 hit]
                </p>
                <p className="text-primary/90">
                  &gt; PERFORMANCE: Win rate 76.4% [+12.4R]
                </p>
                <p className="text-slate-500">
                  &gt; SYSTEM: Live stream synced in 4ms
                </p>
              </div>
            </div>

            {/* Micro details */}
            <div className="space-y-4 text-xs">
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white/4 border border-white/5 text-primary shrink-0 mt-0.5">
                  <Zap className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h4 className="font-semibold text-white text-xs">
                    Rule-based Signals
                  </h4>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    Systematic multi-asset analysis with targeted exit zones.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white/4 border border-white/5 text-primary shrink-0 mt-0.5">
                  <Cpu className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h4 className="font-semibold text-white text-xs">
                    Auto Journal Tracking
                  </h4>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    Automatic tracking logs every performance metric
                    transparently.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Secure footer */}
          <div className="relative z-10 flex items-center gap-1.5 text-[9px] text-slate-500 font-mono">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            <span>End-to-End Encrypted</span>
          </div>
        </div>

        {/* Right Panel: Clean form layout */}
        <div className="col-span-12 md:col-span-7 p-6 sm:p-8 md:p-10 flex flex-col justify-between bg-card">
          {/* Mobile Header (Hidden on Desktop) */}
          <div className="flex justify-between items-center md:hidden mb-6">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-primary via-primary/80 to-primary/60 text-primary-foreground">
                <Radio className="h-4 w-4" />
              </div>
              <span className="text-sm font-black uppercase tracking-tighter text-foreground leading-none">
                Raba<span className="text-primary">Laba</span>
              </span>
            </Link>
          </div>

          {/* Main Form Holder */}
          <div className="my-auto space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                {title}
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {description}
              </p>
            </div>

            <div className="space-y-4">{children}</div>
          </div>

          {/* Footer Area */}
          {footer && (
            <div className="mt-8 text-left text-xs text-muted-foreground border-t border-border/40 pt-4">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
