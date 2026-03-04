import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { Mic, FileText, Brain, ListChecks, BarChart3, Users, Shield, Clock, ChevronDown, ChevronRight, Menu, X, Globe, Zap, Headphones, Upload, MonitorSmartphone, Wifi, WifiOff, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

const features = [
  {
    icon: Mic,
    title: "Record Anywhere",
    description: "Record sessions directly in your browser with real-time audio visualization and auto-save protection.",
    image: "https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/6846aa51ac976418dd0056de_23de25c37fcbbd175c2971f8d64d6563_shopify-checkout.svg",
  },
  {
    icon: Upload,
    title: "Upload Audio",
    description: "Upload pre-recorded audio files in any format. We handle the conversion automatically.",
    image: "https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/68469d59ac976418ddf8804a_01c2abee2ff03762407ec57d20097d4e_skin_creamery.avif",
  },
  {
    icon: Brain,
    title: "AI Transcription",
    description: "Accurate speech-to-text powered by OpenAI, supporting English and Afrikaans.",
    image: "https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/6847ec356628c2a227d91171_649d1e05c93495e5f993b68c762e2973_sealand.avif",
  },
  {
    icon: FileText,
    title: "Smart Summaries",
    description: "AI-generated summaries with customizable templates tailored to your workflow.",
    image: "https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/6847f81ccf587c065ecf0f99_viro.avif",
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

const analysisFeatures = [
  {
    title: "AI Transcription",
    description: "Full speech-to-text transcription supporting English and Afrikaans, with speaker detection and timestamps.",
    image: "https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/67b6a54863fef312ee10a657_07d1f6af50b652880869efea31757511_Apple_Pay-mockup.avif",
  },
  {
    title: "Intelligent Summaries",
    description: "Customizable AI summaries using templates. Get formal minutes, casual recaps, or clinical notes — whatever fits your workflow.",
    image: "https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/67acb7a335d39e9be1abb2e0_361c6e22b14d270e7f01a39591c74511_express-card.avif",
  },
  {
    title: "Action Items",
    description: "Automatically extracted to-do items with assignees and deadlines, ready to share with your team.",
    image: "https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/697cb2897c7218d5bea66cec_express-stitch_bnpl.avif",
  },
  {
    title: "Topic Analysis",
    description: "Visual breakdown of key topics discussed, with sentiment indicators and time spent per topic.",
    image: "https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/67b6a88e59792c71771123cc_d23ab24d70c0df2739760b4a37afae34_Capitec_pay.avif",
  },
];

const faqs = [
  {
    question: "How does the free trial work?",
    answer: "You get a full month of free access to all features when you sign up — no credit card required. After the trial, you can subscribe for R199/month to continue using AI-powered features, or stay on the free tier which includes recording and uploading.",
  },
  {
    question: "What audio formats are supported?",
    answer: "ScribeAI supports all common audio formats including WAV, MP3, M4A, WebM, OGG, AAC, and CAF. We automatically convert uploaded files to the optimal format for transcription.",
  },
  {
    question: "Which languages are supported for transcription?",
    answer: "Currently, ScribeAI supports English and Afrikaans for AI transcription. We're working on expanding language support.",
  },
  {
    question: "Can I use ScribeAI on my phone?",
    answer: "Yes! ScribeAI is fully responsive and works on all mobile browsers. It includes special optimizations for iOS Safari, including call interruption recovery so you never lose a recording.",
  },
  {
    question: "Does recording work offline?",
    answer: "Yes. ScribeAI uses IndexedDB to store recordings locally when you're offline. When you regain connection, your recordings are automatically synced and ready for processing.",
  },
  {
    question: "How secure is my data?",
    answer: "Your session data is encrypted at rest and in transit. We use secure cloud storage, and all data is isolated per organization in our multi-tenant architecture. You own your data.",
  },
  {
    question: "Can I share ScribeAI with my team?",
    answer: "Yes! ScribeAI supports multi-tenant organizations. Each organization gets their own branded workspace with isolated data, users, and settings.",
  },
  {
    question: "What happens when I cancel my subscription?",
    answer: "You keep access to all your existing sessions, transcripts, and summaries. You can still record and upload new sessions, but AI processing features will require an active subscription.",
  },
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);

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
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Mic className="text-white w-5 h-5" />
              </div>
              <span className={`font-bold text-xl tracking-tight transition-colors ${scrolled ? "text-gray-900" : "text-white"}`} data-testid="landing-logo">
                ScribeAI
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
                  className={`text-sm font-medium transition-colors hover:text-amber-500 ${scrolled ? "text-gray-600" : "text-white/80"}`}
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
                <Button className="bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/25" data-testid="nav-get-started">
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
                    className="block w-full text-left px-3 py-2 text-gray-700 hover:text-amber-500 font-medium capitalize"
                    data-testid={`mobile-nav-${id}`}
                  >
                    {id.replace(/-/g, " ")}
                  </button>
                ))}
                <hr className="my-2" />
                <Link href="/login" className="block px-3 py-2 text-gray-700 font-medium" data-testid="mobile-nav-sign-in">Sign In</Link>
                <Link href="/register">
                  <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white mt-1" data-testid="mobile-nav-get-started">Start Free Trial</Button>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden bg-[#0f1724]" data-testid="hero-section">
        <div className="absolute inset-0">
          <img
            src="https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/6966282312b5b12ce0e89f07_fd0594781ebf9b9b5ea63a330706ec38_the_north_face-image.avif"
            alt=""
            className="w-full h-full object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#0f1724] via-[#0f1724]/95 to-[#0f1724]/80" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 lg:py-40">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 mb-6" data-testid="hero-badge">
                1 Month Free Trial — No credit card required
              </Badge>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight" data-testid="hero-heading">
                AI-powered session
                <span className="text-amber-400"> transcription</span> &amp; analysis
              </h1>
              <p className="mt-6 text-lg text-gray-300 leading-relaxed max-w-xl" data-testid="hero-subheading">
                Record or upload your sessions and let AI handle the rest — accurate transcripts, smart summaries, action items, and topic analysis. All in one platform.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link href="/register">
                  <Button size="lg" className="bg-amber-500 hover:bg-amber-600 text-white shadow-xl shadow-amber-500/25 px-8 h-12 text-base" data-testid="hero-cta-primary">
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
                  src="https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/684837080b4af31dff6e8a2a_express-shopify-setup.avif"
                  alt="ScribeAI Dashboard"
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
                From recording to insights, ScribeAI handles every step of your session workflow.
              </p>
            </div>
          </FadeInSection>

          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feat, idx) => (
              <FadeInSection key={feat.title} delay={idx * 0.1}>
                <div className="group relative bg-gray-50 rounded-2xl p-6 hover:bg-gray-100 transition-colors cursor-default border border-gray-100 hover:border-gray-200" data-testid={`feature-card-${idx}`}>
                  <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center mb-4">
                    <feat.icon className="w-6 h-6 text-amber-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{feat.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{feat.description}</p>
                  <div className="mt-4 rounded-xl overflow-hidden">
                    <img src={feat.image} alt={feat.title} className="w-full h-32 object-cover rounded-xl" />
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
                      className={`w-full text-left p-4 rounded-xl transition-all ${
                        activeFeature === idx
                          ? "bg-amber-50 border-2 border-amber-200"
                          : "bg-gray-50 border-2 border-transparent hover:bg-gray-100"
                      }`}
                      data-testid={`showcase-tab-${idx}`}
                    >
                      <h4 className={`font-semibold ${activeFeature === idx ? "text-amber-700" : "text-gray-900"}`}>
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
                      src={analysisFeatures[activeFeature].image}
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
                  Why ScribeAI?
                </h2>
                <p className="mt-4 text-gray-400 text-lg">
                  Built for professionals who value their time.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {whyCards.map((card, idx) => (
                  <FadeInSection key={card.number} delay={idx * 0.08}>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/[0.08] transition-colors" data-testid={`why-card-${idx}`}>
                      <span className="text-amber-400 font-bold text-sm">{card.number}</span>
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
                image: "https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/69663b84fc504f0df1534ed6_branded-checkout.avif",
              },
              {
                step: "2",
                icon: Brain,
                title: "AI Processes",
                description: "Our AI transcribes the audio, generates a summary, extracts action items, and analyzes topics.",
                image: "https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/696e302cb8add1529a839450_express-checkout.avif",
              },
              {
                step: "3",
                icon: BarChart3,
                title: "Review & Act",
                description: "Access your complete session breakdown with transcripts, summaries, tasks, and topic insights.",
                image: "https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/69a05952570b7e2e468fe3c1_rest-mockup.avif",
              },
            ].map((item, idx) => (
              <FadeInSection key={item.step} delay={idx * 0.15}>
                <div className="text-center" data-testid={`step-card-${idx}`}>
                  <div className="relative rounded-2xl overflow-hidden shadow-lg border border-gray-200 mb-6">
                    <img src={item.image} alt={item.title} className="w-full h-48 object-cover" />
                    <div className="absolute top-3 left-3 w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center text-sm font-bold shadow-lg">
                      {item.step}
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <item.icon className="w-5 h-5 text-amber-500" />
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
                    src="https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/69a032b28b63023b38615aad_subscriptions-mockup.avif"
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
                  ScribeAI is designed to work anywhere, even without an internet connection.
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
                      <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                        <item.icon className="w-4 h-4 text-amber-600" />
                      </div>
                      <span className="text-gray-700 font-medium">{item.text}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-8">
                  <Link href="/register">
                    <Button className="bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/25" data-testid="mobile-cta">
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
                  Your session data is sensitive. ScribeAI is built with security-first principles to keep your information safe.
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
                      <Shield className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="text-gray-600">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl overflow-hidden shadow-2xl border border-gray-200">
                <img
                  src="https://cdn.prod.website-files.com/670a67727905d0e6bd612d79/68484eb295961514ce7dd0d8_express-security-and-privacy-2.avif"
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
              <div className="bg-[#0f1724] rounded-2xl border-2 border-amber-500/30 p-8 shadow-xl relative" data-testid="pricing-pro">
                <div className="absolute -top-3 right-6">
                  <Badge className="bg-amber-500 text-white border-0 shadow-lg">1 Month Free Trial</Badge>
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
                      <Check className="w-4 h-4 text-amber-400 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/register">
                  <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/25" data-testid="pricing-pro-cta">
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
                  <a href="mailto:support@fant-app.com" className="text-amber-500 hover:text-amber-600 font-medium">
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
                <Button size="lg" className="bg-amber-500 hover:bg-amber-600 text-white shadow-xl shadow-amber-500/25 px-8 h-12 text-base" data-testid="cta-primary">
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
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                  <Mic className="text-white w-5 h-5" />
                </div>
                <span className="text-white font-bold text-xl">ScribeAI</span>
              </div>
              <p className="text-sm leading-relaxed max-w-sm">
                AI-powered session transcription and analysis platform. Record, transcribe, summarize, and extract insights from every session.
              </p>
            </div>

            <div>
              <h4 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><button onClick={() => scrollToSection("features")} className="hover:text-amber-400 transition-colors" data-testid="footer-features">Features</button></li>
                <li><button onClick={() => scrollToSection("pricing")} className="hover:text-amber-400 transition-colors" data-testid="footer-pricing">Pricing</button></li>
                <li><button onClick={() => scrollToSection("faq")} className="hover:text-amber-400 transition-colors" data-testid="footer-faq">FAQ</button></li>
                <li><Link href="/login" className="hover:text-amber-400 transition-colors" data-testid="footer-sign-in">Sign In</Link></li>
                <li><Link href="/register" className="hover:text-amber-400 transition-colors" data-testid="footer-get-started">Get Started</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/privacy-policy" className="hover:text-amber-400 transition-colors" data-testid="footer-privacy">Privacy Policy</Link></li>
                <li><Link href="/terms-of-use" className="hover:text-amber-400 transition-colors" data-testid="footer-terms-of-use">Website Terms of Use</Link></li>
                <li><Link href="/terms-and-conditions" className="hover:text-amber-400 transition-colors" data-testid="footer-tcs">Ts&amp;Cs</Link></li>
                <li><Link href="/paia-manual" className="hover:text-amber-400 transition-colors" data-testid="footer-paia">PAIA Manual</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm">&copy; {new Date().getFullYear()} ScribeAI. All rights reserved.</p>
            <div className="flex items-center gap-6 text-sm">
              <Link href="/privacy-policy" className="hover:text-amber-400 transition-colors">Privacy Policy</Link>
              <Link href="/terms-of-use" className="hover:text-amber-400 transition-colors">Website Terms of Use</Link>
              <Link href="/terms-and-conditions" className="hover:text-amber-400 transition-colors">Ts&amp;Cs</Link>
              <Link href="/paia-manual" className="hover:text-amber-400 transition-colors">PAIA Manual</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
