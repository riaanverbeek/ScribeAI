import { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { Mic, FileText, Brain, ListChecks, BarChart3, Users, Shield, Clock, ChevronDown, ChevronRight, Menu, X, Globe, Zap, Headphones, Upload, MonitorSmartphone, Wifi, WifiOff, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTenant } from "@/contexts/TenantContext";
import heroPhoneImage from "@assets/Landing_Page_Phone_on_velvet_1777299418458.png";
import uploadIconImage from "@assets/image_1777300070649.png";

function FadeInSection({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-200">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left group"
        aria-expanded={open}
        data-testid={`faq-toggle-${question.slice(0, 20).replace(/\s/g, '-').toLowerCase()}`}
      >
        <span className="text-lg font-medium text-gray-900 pr-4">{question}</span>
        <ChevronDown className={`w-5 h-5 text-gray-500 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-gray-600 leading-relaxed">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const FEATURE_FALLBACKS: Record<string, string | null> = {
  feature_record_anywhere: "https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/69a032b28b63023b38615aad_subscriptions-mockup.avif",
  feature_upload_audio: uploadIconImage as string,
  feature_ai_transcription: "https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/6847ec356628c2a227d91171_649d1e05c93495e5f993b68c762e2973_sealand.avif",
  feature_smart_summaries: "https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/6847f81ccf587c065ecf0f99_viro.avif",
};

const features = [
  {
    icon: Mic,
    title: "Record Anywhere",
    description: "Record sessions directly on your mobile phone or browser with auto-save protection.",
    dbKey: "feature_record_anywhere",
  },
  {
    icon: Upload,
    title: "Upload Audio",
    description: "Upload pre-recorded audio files in any format. We handle the conversion automatically.",
    dbKey: "feature_upload_audio",
  },
  {
    icon: Brain,
    title: "AI Transcription",
    description: "Accurate speech-to-text powered by OpenAI, supporting English and Afrikaans.",
    dbKey: "feature_ai_transcription",
  },
  {
    icon: FileText,
    title: "Smart Summaries",
    description: "AI-generated summaries with customizable templates tailored to your workflow.",
    dbKey: "feature_smart_summaries",
  },
];

const whyCards = [
  {
    number: "01",
    title: "Save hours of manual note-taking",
    description: "Let AI handle the transcription and summary while you focus on what matters — the conversation.",
  },
  {
    number: "02",
    title: "Never miss an action item",
    description: "Automatic extraction of action items with assigned owners ensures nothing falls through the cracks.",
  },
  {
    number: "03",
    title: "Understand every topic discussed",
    description: "AI-powered topic analysis breaks down your sessions into clear, categorized themes.",
  },
  {
    number: "04",
    title: "Organize by client",
    description: "Keep all sessions organized per client with complete history, context, and follow-ups.",
  },
  {
    number: "05",
    title: "Works offline, everywhere",
    description: "Record sessions offline with automatic sync when you're back online. Full iOS Safari support.",
  },
];

const ANALYSIS_FALLBACKS: Record<string, string> = {
  analysis_transcription: "https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/67b6a54863fef312ee10a657_07d1f6af50b652880869efea31757511_Apple_Pay-mockup.avif",
  analysis_summaries: "https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/67acb7a335d39e9be1abb2e0_361c6e22b14d270e7f01a39591c74511_express-card.avif",
  analysis_action_items: "https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/697cb2897c7218d5bea66cec_express-stitch_bnpl.avif",
  analysis_topics: "https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/67b6a88e59792c71771123cc_d23ab24d70c0df2739760b4a37afae34_Capitec_pay.avif",
};

const analysisFeatures = [
  {
    title: "AI Transcription",
    description: "Full speech-to-text transcription supporting English and Afrikaans, with speaker detection and timestamps.",
    dbKey: "analysis_transcription",
  },
  {
    title: "Intelligent Summaries",
    description: "Customizable AI summaries using templates. Get formal minutes, casual recaps, or clinical notes — whatever fits your workflow.",
    dbKey: "analysis_summaries",
  },
  {
    title: "Action Items",
    description: "Automatically extracted to-do items with assignees and deadlines, ready to share with your team.",
    dbKey: "analysis_action_items",
  },
  {
    title: "Topic Analysis",
    description: "Visual breakdown of key topics discussed, with sentiment indicators and time spent per topic.",
    dbKey: "analysis_topics",
  },
];

function buildFaqs(name: string) {
  return [
    {
      question: "How does the free trial work?",
      answer: "You get a full month of free access to all features when you sign up — no credit card required. After the trial, you can subscribe for R199/month to continue using AI-powered features, or stay on the free tier which includes recording and uploading.",
    },
    {
      question: "What audio formats are supported?",
      answer: `${name} supports all common audio formats including WAV, MP3, M4A, WebM, OGG, AAC, and CAF. We automatically convert uploaded files to the optimal format for transcription.`,
    },
    {
      question: "Which languages are supported for transcription?",
      answer: `Currently, ${name} supports English and Afrikaans for AI transcription. We're working on expanding language support.`,
    },
    {
      question: `Can I use ${name} on my phone?`,
      answer: `Yes! ${name} is fully responsive and works on all mobile browsers. It includes special optimizations for iOS Safari, including call interruption recovery so you never lose a recording.`,
    },
    {
      question: "Does recording work offline?",
      answer: `Yes. ${name} uses IndexedDB to store recordings locally when you're offline. When you regain connection, your recordings are automatically synced and ready for processing.`,
    },
    {
      question: "How secure is my data?",
      answer: "Your session data is encrypted at rest and in transit. We use secure cloud storage, and all data is isolated per organization in our multi-tenant architecture. You own your data.",
    },
    {
      question: `Can I share ${name} with my team?`,
      answer: `Yes! ${name} supports multi-tenant organizations. Each organization gets their own branded workspace with isolated data, users, and settings.`,
    },
    {
      question: "What happens when I cancel my subscription?",
      answer: "You keep access to all your existing sessions, transcripts, and summaries. You can still record and upload new sessions, but AI processing features will require an active subscription.",
    },
  ];
}

function hexToHSL(hex: string): { h: number; s: number; l: number } | null {
  const match = hex.match(/^#([0-9a-f]{6})$/i);
  if (!match) return null;
  const r = parseInt(match[1].substring(0, 2), 16) / 255;
  const g = parseInt(match[1].substring(2, 4), 16) / 255;
  const b = parseInt(match[1].substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function parseColorToHSL(color: string | null): { h: number; s: number; l: number } | null {
  if (!color) return null;
  const hexResult = hexToHSL(color);
  if (hexResult) return hexResult;
  const hslMatch = color.match(/hsl\(\s*(\d+)\s*,?\s*(\d+)%?\s*,?\s*(\d+)%?\s*\)/i);
  if (hslMatch) return { h: parseInt(hslMatch[1]), s: parseInt(hslMatch[2]), l: parseInt(hslMatch[3]) };
  const plainMatch = color.match(/^(\d+)\s+(\d+)%?\s+(\d+)%?$/);
  if (plainMatch) return { h: parseInt(plainMatch[1]), s: parseInt(plainMatch[2]), l: parseInt(plainMatch[3]) };
  return null;
}

function useBrandColors(primaryColor: string | null) {
  return useMemo(() => {
    const hsl = parseColorToHSL(primaryColor);
    if (!hsl) {
      return {
        solid: "rgb(245, 158, 11)",
        solidHover: "rgb(217, 119, 6)",
        light: "rgba(245, 158, 11, 0.1)",
        lightBg: "rgb(254, 243, 199)",
        lightBgHover: "rgb(253, 230, 138)",
        text: "rgb(180, 83, 9)",
        textLight: "rgb(245, 158, 11)",
        border: "rgba(245, 158, 11, 0.2)",
        borderLight: "rgb(253, 230, 138)",
        shadow: "rgba(245, 158, 11, 0.25)",
        shadowDark: "rgba(245, 158, 11, 0.2)",
        isCustom: false,
      };
    }
    const { h, s, l } = hsl;
    return {
      solid: `hsl(${h}, ${s}%, ${l}%)`,
      solidHover: `hsl(${h}, ${s}%, ${Math.max(l - 8, 10)}%)`,
      light: `hsla(${h}, ${s}%, ${l}%, 0.1)`,
      lightBg: `hsl(${h}, ${Math.min(s, 80)}%, 90%)`,
      lightBgHover: `hsl(${h}, ${Math.min(s, 80)}%, 82%)`,
      text: `hsl(${h}, ${s}%, ${Math.max(l - 20, 15)}%)`,
      textLight: `hsl(${h}, ${s}%, ${l}%)`,
      border: `hsla(${h}, ${s}%, ${l}%, 0.2)`,
      borderLight: `hsl(${h}, ${Math.min(s, 80)}%, 80%)`,
      shadow: `hsla(${h}, ${s}%, ${l}%, 0.25)`,
      shadowDark: `hsla(${h}, ${s}%, ${l}%, 0.2)`,
      isCustom: true,
    };
  }, [primaryColor]);
}

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);
  const { branding } = useTenant();
  const brandName = branding.name || "ScribeAI";
  const brandTagline = branding.tagline || "Session transcription & analysis";
  const brandLogo = branding.logoUrl;
  const c = useBrandColors(branding.primaryColor);
  const faqs = useMemo(() => buildFaqs(brandName), [brandName]);

  const { data: landingImages } = useQuery<Record<string, string | null>>({
    queryKey: ["/api/landing/images"],
    staleTime: 5 * 60 * 1000,
  });

  const img = (key: string, fallback: string | null = null): string | null =>
    landingImages?.[key] ?? fallback;

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setMobileMenuOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Navigation */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? "bg-white/95 backdrop-blur-lg shadow-sm border-b border-gray-100" : "bg-transparent"
        }`}
        data-testid="landing-nav"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            <div className="flex items-center gap-2">
              {brandLogo ? (
                <img src={brandLogo} alt={brandName} className="h-9 w-auto object-contain" />
              ) : (
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(to bottom right, ${c.solid}, ${c.solidHover})`, boxShadow: `0 4px 14px ${c.shadowDark}` }}>
                  <Mic className="text-white w-5 h-5" />
                </div>
              )}
              <span className={`font-bold text-xl tracking-tight transition-colors ${scrolled ? "text-gray-900" : "text-white"}`} data-testid="landing-logo">
                {brandName}
              </span>
            </div>

            <div className="hidden lg:flex items-center gap-8">
              {[
                { label: "Features", id: "features" },
                { label: "How it works", id: "how-it-works" },
                { label: "Pricing", id: "pricing" },
                { label: "FAQ", id: "faq" },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`text-sm font-medium transition-colors ${scrolled ? "text-gray-600" : "text-white/80"}`}
                  onMouseEnter={(e) => (e.currentTarget.style.color = c.solid)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "")}
                  data-testid={`nav-link-${item.id}`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="hidden lg:flex items-center gap-3">
              <Link href="/login">
                <Button variant="ghost" className={`${scrolled ? "text-gray-700 hover:text-gray-900" : "text-white hover:text-white hover:bg-white/10"}`} data-testid="nav-sign-in">
                  Sign In
                </Button>
              </Link>
              <Link href="/register">
                <Button className="text-white" style={{ backgroundColor: c.solid, boxShadow: `0 4px 14px ${c.shadow}` }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = c.solidHover)} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = c.solid)} data-testid="nav-get-started">
                  Start Free Trial
                </Button>
              </Link>
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`lg:hidden p-2 ${scrolled ? "text-gray-700" : "text-white"}`}
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle navigation menu"
              data-testid="nav-mobile-toggle"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="lg:hidden bg-white border-b shadow-lg overflow-hidden"
            >
              <div className="px-4 py-4 space-y-2">
                {["features", "how-it-works", "pricing", "faq"].map(id => (
                  <button
                    key={id}
                    onClick={() => scrollToSection(id)}
                    className="block w-full text-left px-3 py-2 text-gray-700 font-medium capitalize"
                    onMouseEnter={(e) => (e.currentTarget.style.color = c.solid)}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "")}
                    data-testid={`mobile-nav-${id}`}
                  >
                    {id.replace(/-/g, " ")}
                  </button>
                ))}
                <hr className="my-2" />
                <Link href="/login" className="block px-3 py-2 text-gray-700 font-medium" data-testid="mobile-nav-sign-in">Sign In</Link>
                <Link href="/register">
                  <Button className="w-full text-white mt-1" style={{ backgroundColor: c.solid }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = c.solidHover)} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = c.solid)} data-testid="mobile-nav-get-started">Start Free Trial</Button>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden bg-[#0f1724]" data-testid="hero-section">
        <div className="absolute inset-0">
          {img("hero_background", "https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/6966282312b5b12ce0e89f07_fd0594781ebf9b9b5ea63a330706ec38_the_north_face-image.avif") && (
            <img
              src={img("hero_background", "https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/6966282312b5b12ce0e89f07_fd0594781ebf9b9b5ea63a330706ec38_the_north_face-image.avif")!}
              alt=""
              className="w-full h-full object-cover opacity-20"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-br from-[#0f1724] via-[#0f1724]/95 to-[#0f1724]/80" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 lg:py-40">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              <Badge className="mb-6" style={{ backgroundColor: c.light, color: c.textLight, borderColor: c.border }} data-testid="hero-badge">
                1 Month Free Trial — No credit card required
              </Badge>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight" data-testid="hero-heading">
                AI-powered session
                <span style={{ color: c.textLight }}> transcription</span> &amp; analysis
              </h1>
              <p className="mt-6 text-lg text-gray-300 leading-relaxed max-w-xl" data-testid="hero-subheading">
                Record or upload your sessions and let AI handle the rest — accurate transcripts, smart summaries, action items, and topic analysis. All in one platform.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link href="/register">
                  <Button size="lg" className="text-white px-8 h-12 text-base" style={{ backgroundColor: c.solid, boxShadow: `0 10px 25px ${c.shadow}` }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = c.solidHover)} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = c.solid)} data-testid="hero-cta-primary">
                    Start Free Trial
                    <ChevronRight className="w-5 h-5 ml-1" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline" className="border-gray-600 text-gray-300 hover:bg-white/5 hover:text-white px-8 h-12 text-base" data-testid="hero-cta-secondary">
                    Sign In
                  </Button>
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="hidden lg:block"
            >
              <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-black/40 border border-white/10">
                <img
                  src={img("hero_main", heroPhoneImage as string)!}
                  alt={`${brandName} Dashboard`}
                  className="w-full h-auto"
                  data-testid="hero-image"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Capability Cards */}
      <section className="py-20 lg:py-28 bg-white" id="features" data-testid="features-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInSection>
            <div className="max-w-2xl">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
                Everything you need to capture and analyze sessions
              </h2>
              <p className="mt-4 text-lg text-gray-500">
                From recording to insights, {brandName} handles every step of your session workflow.
              </p>
            </div>
          </FadeInSection>

          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feat, idx) => (
              <FadeInSection key={feat.title} delay={idx * 0.1}>
                <div className="group relative bg-gray-50 rounded-2xl p-6 hover:bg-gray-100 transition-colors cursor-default border border-gray-100 hover:border-gray-200" data-testid={`feature-card-${idx}`}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: c.lightBg }}>
                    <feat.icon className="w-6 h-6" style={{ color: c.text }} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{feat.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{feat.description}</p>
                  <div className="mt-4 rounded-xl overflow-hidden">
                    {(() => {
                      const featImg = img(feat.dbKey, FEATURE_FALLBACKS[feat.dbKey] ?? null);
                      return featImg ? (
                        <img
                          src={featImg}
                          alt={feat.title}
                          className="w-full h-32 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="w-full h-32 rounded-xl bg-gray-100 border border-gray-200" />
                      );
                    })()}
                  </div>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* Brand Logos */}
      <section className="py-12 bg-gray-50 border-y border-gray-100" data-testid="brands-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm font-medium text-gray-400 uppercase tracking-widest mb-8">
            Trusted by leading organizations
          </p>
          <div className="flex flex-wrap justify-center items-center gap-8 lg:gap-16 opacity-50">
            {[
              "https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/67ace672d2fd33776ba71638_testimonial-1.avif",
              "https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/67acec34430fd4299a30f7b6_Fundnation.svg",
              "https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/67acec4d43fd0a756718ca74_90815b874d01ff8fd3514fb45cccf26c_Virgio%20Tours.svg",
            ].map((src, idx) => (
              <img key={idx} src={src} alt="Partner" className="h-10 sm:h-12 grayscale object-contain" />
            ))}
          </div>
        </div>
      </section>

      {/* Feature Showcase Carousel */}
      <section className="py-20 lg:py-28 bg-white" data-testid="showcase-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInSection>
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
                  Powerful analysis, beautifully simple
                </h2>
                <p className="mt-4 text-gray-500 text-lg">
                  Every session is transformed into actionable insights.
                </p>

                <div className="mt-8 space-y-2">
                  {analysisFeatures.map((af, idx) => (
                    <button
                      key={af.title}
                      onClick={() => setActiveFeature(idx)}
                      className={`w-full text-left p-4 rounded-xl transition-all border-2 ${
                        activeFeature === idx
                          ? ""
                          : "bg-gray-50 border-transparent hover:bg-gray-100"
                      }`}
                      style={activeFeature === idx ? { backgroundColor: c.light, borderColor: c.borderLight } : {}}
                      data-testid={`showcase-tab-${idx}`}
                    >
                      <h4 className="font-semibold" style={activeFeature === idx ? { color: c.text } : { color: "rgb(17, 24, 39)" }}>
                        {af.title}
                      </h4>
                      {activeFeature === idx && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="text-sm text-gray-600 mt-1 leading-relaxed"
                        >
                          {af.description}
                        </motion.p>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeFeature}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.3 }}
                    className="rounded-2xl overflow-hidden shadow-2xl border border-gray-200"
                  >
                    <img
                      src={img(analysisFeatures[activeFeature].dbKey, ANALYSIS_FALLBACKS[analysisFeatures[activeFeature].dbKey])!}
                      alt={analysisFeatures[activeFeature].title}
                      className="w-full h-auto"
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* Why ScribeAI */}
      <section className="py-20 lg:py-28 bg-[#0f1724]" id="why" data-testid="why-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInSection>
            <div className="grid lg:grid-cols-[1fr_2fr] gap-12">
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold text-white">
                  Why {brandName}?
                </h2>
                <p className="mt-4 text-gray-400 text-lg">
                  Built for professionals who value their time.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {whyCards.map((card, idx) => (
                  <FadeInSection key={card.number} delay={idx * 0.08}>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/[0.08] transition-colors" data-testid={`why-card-${idx}`}>
                      <span className="font-bold text-sm" style={{ color: c.textLight }}>{card.number}</span>
                      <h3 className="text-white font-semibold mt-2 mb-2">{card.title}</h3>
                      <p className="text-gray-400 text-sm leading-relaxed">{card.description}</p>
                    </div>
                  </FadeInSection>
                ))}
              </div>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 lg:py-28 bg-white" id="how-it-works" data-testid="how-it-works-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInSection>
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">How it works</h2>
              <p className="mt-4 text-lg text-gray-500">Three simple steps from session to insights.</p>
            </div>
          </FadeInSection>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                icon: Mic,
                title: "Record or Upload",
                description: "Record directly in your browser or upload an existing audio file. Supports all major formats.",
                dbKey: "how_it_works_1",
                fallback: "https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/69663b84fc504f0df1534ed6_branded-checkout.avif",
              },
              {
                step: "2",
                icon: Brain,
                title: "AI Processes",
                description: "Our AI transcribes the audio, generates a summary, extracts action items, and analyzes topics.",
                dbKey: "how_it_works_2",
                fallback: "https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/696e302cb8add1529a839450_express-checkout.avif",
              },
              {
                step: "3",
                icon: BarChart3,
                title: "Review & Act",
                description: "Access your complete session breakdown with transcripts, summaries, tasks, and topic insights.",
                dbKey: "how_it_works_3",
                fallback: "https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/69a05952570b7e2e468fe3c1_rest-mockup.avif",
              },
            ].map((item, idx) => (
              <FadeInSection key={item.step} delay={idx * 0.15}>
                <div className="text-center" data-testid={`step-card-${idx}`}>
                  <div className="relative rounded-2xl overflow-hidden shadow-lg border border-gray-200 mb-6">
                    <img src={img(item.dbKey, item.fallback)!} alt={item.title} className="w-full h-48 object-cover" />
                    <div className="absolute top-3 left-3 w-8 h-8 rounded-full text-white flex items-center justify-center text-sm font-bold shadow-lg" style={{ backgroundColor: c.solid }}>
                      {item.step}
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <item.icon className="w-5 h-5" style={{ color: c.solid }} />
                    <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                  </div>
                  <p className="text-gray-500 text-sm leading-relaxed">{item.description}</p>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* Mobile & Offline */}
      <section className="py-20 lg:py-28 bg-gray-50" data-testid="mobile-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInSection>
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="order-2 lg:order-1">
                <div className="rounded-2xl overflow-hidden shadow-2xl border border-gray-200">
                  <img
                    src={img("mobile_section", "https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/69a032b28b63023b38615aad_subscriptions-mockup.avif")!}
                    alt="Mobile recording"
                    className="w-full h-auto"
                  />
                </div>
              </div>

              <div className="order-1 lg:order-2">
                <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
                  Built for mobile. Works offline.
                </h2>
                <p className="mt-4 text-lg text-gray-500">
                  {brandName} is designed to work anywhere, even without an internet connection.
                </p>

                <div className="mt-8 space-y-4">
                  {[
                    { icon: MonitorSmartphone, text: "Fully responsive — works on any device" },
                    { icon: WifiOff, text: "Record offline with automatic sync" },
                    { icon: Headphones, text: "iOS Safari call interruption recovery" },
                    { icon: Zap, text: "Auto-save every 5 seconds to protect your recordings" },
                    { icon: Globe, text: "English and Afrikaans transcription support" },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: c.lightBg }}>
                        <item.icon className="w-4 h-4" style={{ color: c.text }} />
                      </div>
                      <span className="text-gray-700 font-medium">{item.text}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-8">
                  <Link href="/register">
                    <Button className="text-white" style={{ backgroundColor: c.solid, boxShadow: `0 4px 14px ${c.shadow}` }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = c.solidHover)} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = c.solid)} data-testid="mobile-cta">
                      Try it free
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* Security */}
      <section className="py-20 lg:py-28 bg-white" data-testid="security-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInSection>
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
                  Security &amp; privacy, built in
                </h2>
                <p className="mt-4 text-lg text-gray-500 leading-relaxed">
                  Your session data is sensitive. {brandName} is built with security-first principles to keep your information safe.
                </p>
                <div className="mt-6 space-y-3">
                  {[
                    "End-to-end encryption for all data",
                    "Secure cloud storage with data isolation",
                    "Multi-tenant architecture with strict access controls",
                    "Role-based access control for teams",
                    "You own your data — export or delete anytime",
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Shield className="w-4 h-4 shrink-0" style={{ color: c.solid }} />
                      <span className="text-gray-600">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl overflow-hidden shadow-2xl border border-gray-200">
                <img
                  src={img("security_section", "https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/68484eb295961514ce7dd0d8_express-security-and-privacy-2.avif")!}
                  alt="Security"
                  className="w-full h-auto"
                />
              </div>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 lg:py-28 bg-gray-50" id="pricing" data-testid="pricing-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInSection>
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Simple, transparent pricing</h2>
              <p className="mt-4 text-lg text-gray-500">Start with a free trial. Upgrade when you're ready.</p>
            </div>
          </FadeInSection>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <FadeInSection delay={0}>
              <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm" data-testid="pricing-free">
                <h3 className="text-lg font-semibold text-gray-900">Free</h3>
                <p className="text-sm text-gray-500 mt-1">Always available, no subscription needed</p>
                <div className="mt-4 mb-6">
                  <span className="text-4xl font-bold text-gray-900">R0</span>
                  <span className="text-gray-500 ml-1">/month</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {[
                    "Record sessions in browser",
                    "Upload audio files",
                    "Audio format conversion",
                    "Basic session management",
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                      <Check className="w-4 h-4 text-gray-400 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/register">
                  <Button variant="outline" className="w-full" data-testid="pricing-free-cta">Get Started</Button>
                </Link>
              </div>
            </FadeInSection>

            <FadeInSection delay={0.1}>
              <div className="bg-[#0f1724] rounded-2xl border-2 p-8 shadow-xl relative" style={{ borderColor: `${c.solid}4d` }} data-testid="pricing-pro">
                <div className="absolute -top-3 right-6">
                  <Badge className="text-white border-0 shadow-lg" style={{ backgroundColor: c.solid }}>1 Month Free Trial</Badge>
                </div>
                <h3 className="text-lg font-semibold text-white">Pro</h3>
                <p className="text-sm text-gray-400 mt-1">Full AI-powered analysis suite</p>
                <div className="mt-4 mb-6">
                  <span className="text-4xl font-bold text-white">R199</span>
                  <span className="text-gray-400 ml-1">/month</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {[
                    "Everything in Free",
                    "AI transcription (English & Afrikaans)",
                    "Smart session summaries",
                    "Automatic action item extraction",
                    "Topic analysis & insights",
                    "Client management",
                    "Customizable summary templates",
                    "Offline recording with sync",
                    "Priority support",
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-gray-300">
                      <Check className="w-4 h-4 shrink-0" style={{ color: c.textLight }} />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/register">
                  <Button className="w-full text-white" style={{ backgroundColor: c.solid, boxShadow: `0 4px 14px ${c.shadow}` }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = c.solidHover)} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = c.solid)} data-testid="pricing-pro-cta">
                    Start Free Trial
                  </Button>
                </Link>
                <p className="text-center text-xs text-gray-500 mt-3">Pay via PayFast or Stripe</p>
              </div>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 lg:py-28 bg-white" id="faq" data-testid="faq-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-[1fr_2fr] gap-12">
            <FadeInSection>
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
                  Frequently asked questions
                </h2>
                <p className="mt-4 text-gray-500">
                  Can't find what you're looking for?{" "}
                  <a href="mailto:support@fant-app.com" className="font-medium" style={{ color: c.solid }}>
                    Get in touch
                  </a>
                </p>
              </div>
            </FadeInSection>

            <FadeInSection delay={0.1}>
              <div>
                {faqs.map((faq, idx) => (
                  <FAQItem key={idx} question={faq.question} answer={faq.answer} />
                ))}
              </div>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 lg:py-28 bg-gray-50" data-testid="cta-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeInSection>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 max-w-3xl mx-auto">
              Transform your session workflow, today
            </h2>
            <p className="mt-6 text-lg text-gray-500 max-w-xl mx-auto">
              Join professionals who save hours every week with AI-powered session analysis.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/register">
                <Button size="lg" className="text-white px-8 h-12 text-base" style={{ backgroundColor: c.solid, boxShadow: `0 10px 25px ${c.shadow}` }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = c.solidHover)} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = c.solid)} data-testid="cta-primary">
                  Start Free Trial
                  <ChevronRight className="w-5 h-5 ml-1" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="px-8 h-12 text-base" data-testid="cta-secondary">
                  Sign In
                </Button>
              </Link>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0f1724] text-gray-400 py-16" data-testid="footer">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                {brandLogo ? (
                  <img src={brandLogo} alt={brandName} className="h-9 w-auto object-contain" />
                ) : (
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(to bottom right, ${c.solid}, ${c.solidHover})` }}>
                    <Mic className="text-white w-5 h-5" />
                  </div>
                )}
                <span className="text-white font-bold text-xl">{brandName}</span>
              </div>
              <p className="text-sm leading-relaxed max-w-sm">
                {brandTagline}. Record, transcribe, summarize, and extract insights from every session.
              </p>
            </div>

            <div>
              <h4 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><button onClick={() => scrollToSection("features")} className="transition-colors" onMouseEnter={(e) => (e.currentTarget.style.color = c.textLight)} onMouseLeave={(e) => (e.currentTarget.style.color = "")} data-testid="footer-features">Features</button></li>
                <li><button onClick={() => scrollToSection("pricing")} className="transition-colors" onMouseEnter={(e) => (e.currentTarget.style.color = c.textLight)} onMouseLeave={(e) => (e.currentTarget.style.color = "")} data-testid="footer-pricing">Pricing</button></li>
                <li><button onClick={() => scrollToSection("faq")} className="transition-colors" onMouseEnter={(e) => (e.currentTarget.style.color = c.textLight)} onMouseLeave={(e) => (e.currentTarget.style.color = "")} data-testid="footer-faq">FAQ</button></li>
                <li><Link href="/login" className="transition-colors" onMouseEnter={(e: any) => (e.currentTarget.style.color = c.textLight)} onMouseLeave={(e: any) => (e.currentTarget.style.color = "")} data-testid="footer-sign-in">Sign In</Link></li>
                <li><Link href="/register" className="transition-colors" onMouseEnter={(e: any) => (e.currentTarget.style.color = c.textLight)} onMouseLeave={(e: any) => (e.currentTarget.style.color = "")} data-testid="footer-get-started">Get Started</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/privacy-policy" className="transition-colors" onMouseEnter={(e: any) => (e.currentTarget.style.color = c.textLight)} onMouseLeave={(e: any) => (e.currentTarget.style.color = "")} data-testid="footer-privacy">Privacy Policy</Link></li>
                <li><Link href="/terms-of-use" className="transition-colors" onMouseEnter={(e: any) => (e.currentTarget.style.color = c.textLight)} onMouseLeave={(e: any) => (e.currentTarget.style.color = "")} data-testid="footer-terms-of-use">Website Terms of Use</Link></li>
                <li><Link href="/terms-and-conditions" className="transition-colors" onMouseEnter={(e: any) => (e.currentTarget.style.color = c.textLight)} onMouseLeave={(e: any) => (e.currentTarget.style.color = "")} data-testid="footer-tcs">Ts&amp;Cs</Link></li>
                <li><Link href="/paia-manual" className="transition-colors" onMouseEnter={(e: any) => (e.currentTarget.style.color = c.textLight)} onMouseLeave={(e: any) => (e.currentTarget.style.color = "")} data-testid="footer-paia">PAIA Manual</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm">&copy; {new Date().getFullYear()} {brandName}. All rights reserved.</p>
            <div className="flex items-center gap-6 text-sm">
              <Link href="/privacy-policy" className="transition-colors" onMouseEnter={(e: any) => (e.currentTarget.style.color = c.textLight)} onMouseLeave={(e: any) => (e.currentTarget.style.color = "")}>Privacy Policy</Link>
              <Link href="/terms-of-use" className="transition-colors" onMouseEnter={(e: any) => (e.currentTarget.style.color = c.textLight)} onMouseLeave={(e: any) => (e.currentTarget.style.color = "")}>Website Terms of Use</Link>
              <Link href="/terms-and-conditions" className="transition-colors" onMouseEnter={(e: any) => (e.currentTarget.style.color = c.textLight)} onMouseLeave={(e: any) => (e.currentTarget.style.color = "")}>Ts&amp;Cs</Link>
              <Link href="/paia-manual" className="transition-colors" onMouseEnter={(e: any) => (e.currentTarget.style.color = c.textLight)} onMouseLeave={(e: any) => (e.currentTarget.style.color = "")}>PAIA Manual</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
