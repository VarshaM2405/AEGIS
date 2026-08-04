import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Shield, MapPin, Bell, Users, Activity, Radio, Navigation,
  ChevronDown, Phone, Globe, Clock, Award, Heart, ArrowRight,
  Check, Siren, Eye, HandHeart, ShieldCheck, Zap
} from "lucide-react";

/* ---------------------------------------------------------
   Design tokens (from brief)
   bg #FDF8F9  primary #D81B60  secondary #E5B2B9
   heading #4A2E35  body #9E7A80  muted #DDA7A5
--------------------------------------------------------- */

const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=Outfit:wght@300;400;500;600;700&display=swap');
`;

function useReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.unobserve(el);
        }
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

function Reveal({ children, delay = 0, className = "" }) {
  const [ref, visible] = useReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0px)" : "translateY(28px)",
        transition: `opacity 0.9s cubic-bezier(.22,1,.36,1) ${delay}ms, transform 0.9s cubic-bezier(.22,1,.36,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ---------------------------------------------------------
   Shield mark — two counter-rotating octagons + serif A
--------------------------------------------------------- */
function octagonPoints(cx, cy, r, rotationDeg) {
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const angle = ((-90 + rotationDeg + i * 45) * Math.PI) / 180;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return pts.join(" ");
}

function ShieldMark({ size = 96 }) {
  const octA = octagonPoints(50, 50, 44, 0);
  const octB = octagonPoints(50, 50, 44, 22.5);
  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        style={{
          position: "absolute",
          inset: 0,
          animation: "spin-cw 13s linear infinite",
        }}
      >
        <polygon
          points={octA}
          fill="none"
          stroke="url(#g1)"
          strokeWidth="1"
          strokeLinejoin="round"
        />
        <defs>
          <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E5B2B9" />
            <stop offset="100%" stopColor="#D81B60" />
          </linearGradient>
        </defs>
      </svg>
      <svg
        viewBox="0 0 100 100"
        style={{
          position: "absolute",
          inset: 0,
          animation: "spin-ccw 19s linear infinite",
        }}
      >
        <polygon
          points={octB}
          fill="none"
          stroke="url(#g2)"
          strokeWidth="1"
          strokeLinejoin="round"
        />
        <defs>
          <linearGradient id="g2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#F1AFC2" />
            <stop offset="100%" stopColor="#F7CCDA" />
          </linearGradient>
        </defs>
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          fontFamily: "Cinzel, serif",
          fontWeight: 600,
          fontSize: size * 0.34,
          color: "#D81B60",
        }}
      >
        A
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   Small building blocks
--------------------------------------------------------- */
function GlassCard({ children, className = "", style = {} }) {
  return (
    <div
      className={`rounded-2xl ${className}`}
      style={{
        background: "rgba(255,255,255,0.65)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: "1px solid rgba(255,255,255,0.6)",
        boxShadow: "0 8px 32px rgba(74,46,53,0.08)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function MagneticButton({ children, primary = false, onClick, className = "", disabled = false, type = "button" }) {
  const btnRef = useRef(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const onMove = (e) => {
    if (disabled) return;
    const rect = btnRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) * 0.18;
    const y = (e.clientY - rect.top - rect.height / 2) * 0.28;
    setPos({ x, y });
  };
  const onLeave = () => setPos({ x: 0, y: 0 });
  return (
    <button
      type={type}
      ref={btnRef}
      onClick={onClick}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      disabled={disabled}
      className={`px-8 py-4 rounded-full font-medium text-[15px] tracking-wide transition-shadow duration-300 ${className}`}
      style={{
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        transition: "transform 0.15s ease-out, box-shadow 0.3s ease",
        fontFamily: "Outfit, sans-serif",
        ...(primary
          ? {
              background: "linear-gradient(135deg,#E5B2B9,#D81B60)",
              color: "#FDF8F9",
              boxShadow: "0 10px 30px rgba(216,27,96,0.35)",
            }
          : {
              background: "rgba(255,255,255,0.7)",
              color: "#4A2E35",
              border: "1px solid rgba(74,46,53,0.15)",
            }),
      }}
    >
      {children}
    </button>
  );
}

/* ---------------------------------------------------------
   Main page
--------------------------------------------------------- */
export default function AegisLanding() {
  const [demoStep, setDemoStep] = useState(0);
  const [mapLayer, setMapLayer] = useState("heatmap");
  const [openFaq, setOpenFaq] = useState(0);
  const [regStep, setRegStep] = useState(0);
  const [regData, setRegData] = useState({
    name: "", phone: "", location: "", latitude: "", longitude: "", availability: "", radius: "2", training: false,
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const mapContainerRef = useRef(null);
  const leafletMapRef = useRef(null);
  const volunteerMarkerRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setDemoStep((s) => (s + 1) % 5), 2200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current) {
      return;
    }

    const syncMarker = (map) => {
      if (!window?.L || !map || !regData.latitude || !regData.longitude) {
        return;
      }
      const L = window.L;
      const latLng = L.latLng(Number(regData.latitude), Number(regData.longitude));
      if (!latLng.lat || !latLng.lng) {
        return;
      }
      if (volunteerMarkerRef.current) {
        volunteerMarkerRef.current.setLatLng(latLng);
      } else {
        volunteerMarkerRef.current = L.marker(latLng, { draggable: true }).addTo(map);
        volunteerMarkerRef.current.on("dragend", () => {
          const pos = volunteerMarkerRef.current.getLatLng();
          setRegData((d) => ({ ...d, latitude: pos.lat, longitude: pos.lng }));
        });
      }
      map.panTo(latLng);
    };

    const initializeMap = () => {
      if (!window?.L || !mapContainerRef.current || leafletMapRef.current) {
        return;
      }
      const L = window.L;
      const defaultCenter = [12.9716, 77.5946];
      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 12,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      const placeMarker = (lat, lng) => {
        const latLng = L.latLng(lat, lng);
        if (volunteerMarkerRef.current) {
          volunteerMarkerRef.current.setLatLng(latLng);
        } else {
          volunteerMarkerRef.current = L.marker(latLng, { draggable: true }).addTo(map);
          volunteerMarkerRef.current.on("dragend", () => {
            const pos = volunteerMarkerRef.current.getLatLng();
            setRegData((d) => ({ ...d, latitude: pos.lat, longitude: pos.lng }));
          });
        }
        map.panTo(latLng);
      };

      map.on("click", (e) => {
        const { lat, lng } = e.latlng;
        setRegData((d) => ({ ...d, latitude: lat, longitude: lng }));
        placeMarker(lat, lng);
      });

      if (regData.latitude && regData.longitude) {
        placeMarker(Number(regData.latitude), Number(regData.longitude));
      }

      map.whenReady(() => {
        try {
          map.invalidateSize();
        } catch (error) {
          // ignore map invalidation failures until Leaflet is fully ready
        }
      });
      window.setTimeout(() => {
        try {
          map.invalidateSize();
        } catch (error) {
          // ignore map invalidation failures until Leaflet is fully ready
        }
      }, 300);

      leafletMapRef.current = map;
    };

    if (regStep === 1 && window?.L && !leafletMapRef.current) {
      initializeMap();
    }

    let interval = null;
    if (regStep === 1 && !leafletMapRef.current) {
      interval = window.setInterval(() => {
        if (window?.L && !leafletMapRef.current) {
          initializeMap();
          window.clearInterval(interval);
        }
      }, 200);
    }

    if (leafletMapRef.current) {
      syncMarker(leafletMapRef.current);
    }

    return () => {
      if (interval) {
        window.clearInterval(interval);
      }
      if (leafletMapRef.current) {
        leafletMapRef.current.off();
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [regStep, regData.latitude, regData.longitude]);

  const canUseGeolocation = () => {
    if (!navigator.geolocation) {
      return false;
    }
    const host = window.location.hostname;
    return window.isSecureContext || window.location.protocol === "https:" || host === "localhost" || host === "127.0.0.1";
  };

  const captureLiveLocation = () => {
    if (isLocating) {
      return;
    }
    if (!navigator.geolocation) {
      setSubmitError("Live location is not supported by your browser.");
      return;
    }
    if (!canUseGeolocation()) {
      setSubmitError("Location access is blocked because the page is not secure. Use HTTPS or pin your location manually.");
      return;
    }

    setSubmitError("");
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setRegData((d) => ({ ...d, latitude, longitude }));
        setIsLocating(false);
        if (leafletMapRef.current && window?.L) {
          const L = window.L;
          const latLng = L.latLng(latitude, longitude);
          if (volunteerMarkerRef.current) {
            volunteerMarkerRef.current.setLatLng(latLng);
          } else {
            volunteerMarkerRef.current = L.marker(latLng, { draggable: true }).addTo(leafletMapRef.current);
            volunteerMarkerRef.current.on("dragend", () => {
              const pos = volunteerMarkerRef.current.getLatLng();
              setRegData((d) => ({ ...d, latitude: pos.lat, longitude: pos.lng }));
            });
          }
          leafletMapRef.current.setView(latLng, 14);
          setTimeout(() => leafletMapRef.current.invalidateSize(), 200);
        }
      },
      (error) => {
        setIsLocating(false);
        if (error.code === 1) {
          setSubmitError("Location permission denied. Allow location access in your browser settings.");
        } else if (error.code === 2) {
          setSubmitError("Location not available. Try again or choose your spot on the map.");
        } else if (error.code === 3) {
          setSubmitError("Location request timed out. Please try again.");
        } else {
          setSubmitError(error.message || "Could not retrieve live location.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  const submitVolunteer = async () => {
    setSubmitError("");
    if (!regData.name || !regData.phone || !regData.location || !regData.availability || !regData.latitude || !regData.longitude) {
      setSubmitError("Please complete all required fields and select your exact location on the map.");
      return;
    }

    const host = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? "http://localhost:8000"
      : `${window.location.protocol}//${window.location.hostname}:8000`;

    setIsSubmitting(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch(`${host}/api/volunteers/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: regData.name,
          phone: regData.phone,
          location_name: regData.location,
          latitude: Number(regData.latitude),
          longitude: Number(regData.longitude),
          availability: regData.availability,
          radius: Number(regData.radius),
          training: regData.training,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to register volunteer.");
      }
      setSubmitted(true);
    } catch (err) {
      if (err.name === 'AbortError') {
        setSubmitError('Registration request timed out. Please check your backend or network and try again.');
      } else {
        setSubmitError(err instanceof Error ? err.message : "Unable to register at this time.");
      }
      console.error('Volunteer registration failed:', err, 'host:', host);
    } finally {
      window.clearTimeout(timeout);
      setIsSubmitting(false);
    }
  };

  const demoLabels = [
    { icon: Siren, text: "SOS triggered" },
    { icon: Radio, text: "AI locates nearby guardians" },
    { icon: Users, text: "Guardians notified" },
    { icon: ShieldCheck, text: "Nearest police station alerted" },
    { icon: Phone, text: "Emergency contacts informed" },
  ];

  const features = [
    { icon: Navigation, title: "AI Safe Routing", desc: "Routes ranked by predicted safety, not just speed." },
    { icon: Activity, title: "Crime Prediction", desc: "Learns patterns from historical incident data." },
    { icon: MapPin, title: "Crime Heatmap", desc: "See risk concentration across Bengaluru in real time." },
    { icon: Siren, title: "SOS Alerts", desc: "One tap reaches guardians, contacts, and police." },
    { icon: ShieldCheck, title: "Nearest Police Notification", desc: "Automatic alert to the closest station." },
    { icon: Phone, title: "Emergency Contacts", desc: "Your circle is looped in the moment it matters." },
    { icon: Users, title: "Community Guardians", desc: "A living network of people ready to help." },
    { icon: Bell, title: "Real-Time Notifications", desc: "Instant, precise, and only when it counts." },
  ];

  const steps = [
    { title: "Register", desc: "Tell us who you are and where you can help.", icon: Heart },
    { title: "Stay Available", desc: "Turn on availability whenever you're nearby.", icon: Clock },
    { title: "Receive Nearby SOS", desc: "Get notified the moment someone near you needs help.", icon: Bell },
    { title: "Help Until Authorities Arrive", desc: "Be the presence that makes waiting less frightening.", icon: HandHeart },
  ];

  const faqs = [
    { q: "Do I need to download an app?", a: "No. Everything — registration, availability, and alerts — works directly from this website." },
    { q: "What happens when I receive an alert?", a: "You'll see the location, distance, and a simple map. You choose whether you're able to respond." },
    { q: "Is this a replacement for the police?", a: "No. Guardians support the gap between an emergency and when authorities arrive — never a replacement." },
    { q: "Can I set how far I'm willing to travel?", a: "Yes, you set a preferred radius during registration and can change it anytime." },
    { q: "Is my information safe?", a: "Your location is only shared with the system during an active SOS near you, never sold or broadcast publicly." },
  ];

  const updateReg = (k, v) => setRegData((d) => ({ ...d, [k]: v }));
  const regFields = [
    { key: "name", label: "Your name", type: "text", placeholder: "Ananya Rao" },
    { key: "phone", label: "Phone number", type: "tel", placeholder: "+91 98xxxxxxx" },
    { key: "location", label: "Neighbourhood", type: "text", placeholder: "Indiranagar, Bengaluru" },
  ];

  return (
    <div
      style={{
        background: "#FDF8F9",
        color: "#4A2E35",
        fontFamily: "Outfit, sans-serif",
        minHeight: "100vh",
        overflowX: "hidden",
      }}
    >
      <style>{`
        ${FONT_IMPORT}
        @keyframes spin-cw { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }
        @keyframes spin-ccw { from { transform: rotate(0deg);} to { transform: rotate(-360deg);} }
        @keyframes float-blob {
          0%,100% { transform: translate(0,0) scale(1); }
          33% { transform: translate(20px,-30px) scale(1.05); }
          66% { transform: translate(-15px,15px) scale(0.97); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.6); opacity: 0.9; }
          100% { transform: scale(2.6); opacity: 0; }
        }
        @keyframes gentle-bob {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .shimmer-text {
          background: linear-gradient(90deg, #4A2E35 0%, #D81B60 25%, #4A2E35 50%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: shimmer 5s linear infinite;
        }
        .hover-card { transition: transform .35s cubic-bezier(.22,1,.36,1), box-shadow .35s ease; }
        .hover-card:hover { transform: translateY(-6px); box-shadow: 0 20px 45px rgba(74,46,53,0.14); }
        input[type=range] { accent-color: #D81B60; }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
        }
      `}</style>

      {/* ambient floating blobs */}
      <div className="fixed inset-0 pointer-events-none -z-0" style={{ zIndex: 0 }}>
        <div style={{
          position: "absolute", top: "5%", left: "-10%", width: 420, height: 420, borderRadius: "50%",
          background: "linear-gradient(135deg,#E5B2B9,#D81B60)", opacity: 0.12, filter: "blur(60px)",
          animation: "float-blob 16s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", top: "40%", right: "-8%", width: 380, height: 380, borderRadius: "50%",
          background: "linear-gradient(135deg,#E0B0FF,#C71585)", opacity: 0.10, filter: "blur(70px)",
          animation: "float-blob 20s ease-in-out infinite reverse",
        }} />
      </div>

      {/* NAV */}
      <nav className="sticky top-0 z-50" style={{ background: "rgba(253,248,249,0.75)", backdropFilter: "blur(10px)", borderBottom: "1px solid rgba(74,46,53,0.08)" }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <ShieldMark size={36} />
            <span style={{ fontFamily: "Cinzel, serif", fontWeight: 600, letterSpacing: "0.05em" }}>AEGIS</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm" style={{ color: "#9E7A80" }}>
            <a href="#how" className="hover:text-[#D81B60] transition-colors">How it works</a>
            <a href="#map" className="hover:text-[#D81B60] transition-colors">Coverage</a>
            <a href="#features" className="hover:text-[#D81B60] transition-colors">Features</a>
            <a href="#faq" className="hover:text-[#D81B60] transition-colors">FAQ</a>
          </div>
          <MagneticButton primary onClick={() => document.getElementById("register")?.scrollIntoView({ behavior: "smooth" })} className="!px-5 !py-2.5 text-sm">
            Become a Guardian
          </MagneticButton>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-20 pb-28 text-center">
        <Reveal>
          <div className="flex justify-center mb-8" style={{ animation: "gentle-bob 6s ease-in-out infinite" }}>
            <ShieldMark size={120} />
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h1
            className="shimmer-text text-5xl md:text-7xl leading-[1.05] mb-6"
            style={{ fontFamily: "Cinzel, serif", fontWeight: 600 }}
          >
            Protect Your City.<br />One Alert Away.
          </h1>
        </Reveal>
        <Reveal delay={220}>
          <p className="max-w-xl mx-auto text-lg mb-10" style={{ color: "#9E7A80" }}>
            Join the AEGIS Community Guardian Network and help people near you during emergencies — no app required.
          </p>
        </Reveal>
        <Reveal delay={320}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <MagneticButton primary onClick={() => document.getElementById("register")?.scrollIntoView({ behavior: "smooth" })}>
              Become a Guardian
            </MagneticButton>
            <MagneticButton onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}>
              Learn More
            </MagneticButton>
          </div>
        </Reveal>
      </section>

      {/* LIVE DEMO */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pb-28">
        <Reveal>
          <p className="text-center text-sm uppercase tracking-[0.2em] mb-2" style={{ color: "#D81B60" }}>Watch it happen</p>
          <h2 className="text-center text-3xl md:text-4xl mb-12" style={{ fontFamily: "Cinzel, serif" }}>When someone presses SOS</h2>
        </Reveal>
        <GlassCard className="p-8 md:p-12">
          <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
            {demoLabels.map((d, i) => {
              const Icon = d.icon;
              const active = i === demoStep;
              const done = i < demoStep;
              return (
                <div key={i} className="flex md:flex-col items-center gap-3 md:gap-4 text-center flex-1">
                  <div className="relative flex items-center justify-center">
                    {active && (
                      <span
                        className="absolute rounded-full"
                        style={{
                          width: 56, height: 56,
                          border: "2px solid #D81B60",
                          animation: "pulse-ring 1.6s cubic-bezier(0,0,.2,1) infinite",
                        }}
                      />
                    )}
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500"
                      style={{
                        background: active || done ? "linear-gradient(135deg,#E5B2B9,#D81B60)" : "#F3E2E4",
                        color: active || done ? "#fff" : "#9E7A80",
                        transform: active ? "scale(1.1)" : "scale(1)",
                      }}
                    >
                      <Icon size={22} />
                    </div>
                  </div>
                  <span className="text-sm max-w-[120px]" style={{ color: active ? "#4A2E35" : "#9E7A80", fontWeight: active ? 600 : 400 }}>
                    {d.text}
                  </span>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </section>

      {/* WHY COMMUNITY MATTERS */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-28">
        <Reveal>
          <h2 className="text-center text-3xl md:text-4xl mb-4" style={{ fontFamily: "Cinzel, serif" }}>Why community matters</h2>
          <p className="text-center max-w-lg mx-auto mb-14" style={{ color: "#9E7A80" }}>
            Technology finds the danger. People make the difference in the minutes that follow.
          </p>
        </Reveal>
        <div className="grid md:grid-cols-4 gap-6">
          {[
            { icon: Zap, title: "Faster response", desc: "Someone nearby can reach a person in danger long before authorities arrive." },
            { icon: Eye, title: "Extra eyes", desc: "More attentive people means fewer emergencies go unnoticed." },
            { icon: Users, title: "Communities protect communities", desc: "Safety grows stronger when neighbours look out for one another." },
            { icon: ShieldCheck, title: "Support, not replace", desc: "Guardians stand beside authorities — never in their place." },
          ].map((c, i) => (
            <Reveal key={i} delay={i * 100}>
              <GlassCard className="hover-card p-6 h-full">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: "linear-gradient(135deg,#E5B2B9,#D81B60)" }}>
                  <c.icon size={20} color="#fff" />
                </div>
                <h3 className="font-medium mb-2">{c.title}</h3>
                <p className="text-sm" style={{ color: "#9E7A80" }}>{c.desc}</p>
              </GlassCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="relative z-10 max-w-5xl mx-auto px-6 pb-28">
        <Reveal>
          <h2 className="text-center text-3xl md:text-4xl mb-14" style={{ fontFamily: "Cinzel, serif" }}>How it works</h2>
        </Reveal>
        <div className="relative">
          <div className="hidden md:block absolute top-8 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg,#E5B2B9,#D81B60)" }} />
          <div className="grid md:grid-cols-4 gap-10">
            {steps.map((s, i) => (
              <Reveal key={i} delay={i * 140}>
                <div className="flex flex-col items-center text-center">
                  <div className="relative w-16 h-16 rounded-full flex items-center justify-center mb-5" style={{ background: "#FDF8F9", border: "2px solid #D81B60" }}>
                    <s.icon size={24} color="#D81B60" />
                  </div>
                  <h3 className="font-medium mb-2">{s.title}</h3>
                  <p className="text-sm" style={{ color: "#9E7A80" }}>{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* COVERAGE MAP */}
      <section id="map" className="relative z-10 max-w-5xl mx-auto px-6 pb-28">
        <Reveal>
          <h2 className="text-center text-3xl md:text-4xl mb-4" style={{ fontFamily: "Cinzel, serif" }}>Coverage — Bengaluru</h2>
          <p className="text-center mb-10" style={{ color: "#9E7A80" }}>A living view of safety across the city.</p>
        </Reveal>
        <GlassCard className="p-4 md:p-6">
          <div className="flex flex-wrap gap-2 justify-center mb-6">
            {[
              { key: "heatmap", label: "Heatmap" },
              { key: "routes", label: "Safe Routes" },
              { key: "guardians", label: "Volunteer Network" },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setMapLayer(t.key)}
                className="px-4 py-2 rounded-full text-sm transition-all duration-300"
                style={{
                  background: mapLayer === t.key ? "linear-gradient(135deg,#E5B2B9,#D81B60)" : "rgba(255,255,255,0.6)",
                  color: mapLayer === t.key ? "#fff" : "#4A2E35",
                  border: "1px solid rgba(74,46,53,0.1)",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="relative rounded-xl overflow-hidden" style={{ height: 340, background: "linear-gradient(160deg,#FBEDEF,#F3DCE0)" }}>
            <svg width="100%" height="100%" viewBox="0 0 600 340" preserveAspectRatio="none">
              {[...Array(6)].map((_, i) => (
                <path key={i} d={`M ${i * 90} 0 C ${i * 90 + 60} 100, ${i * 90 - 40} 240, ${i * 90 + 30} 340`} stroke="#DDA7A5" strokeWidth="1.4" fill="none" opacity="0.5" />
              ))}
              {mapLayer === "heatmap" &&
                [[120, 90, 46], [340, 150, 60], [220, 240, 34], [460, 100, 38], [480, 250, 30]].map((p, i) => (
                  <circle key={i} cx={p[0]} cy={p[1]} r={p[2]} fill="url(#heat)" opacity="0.55" />
                ))}
              {mapLayer === "routes" &&
                [[[40, 300], [200, 180], [340, 200], [520, 60]]].map((path, i) => (
                  <polyline key={i} points={path.map((p) => p.join(",")).join(" ")} fill="none" stroke="#D81B60" strokeWidth="3" strokeDasharray="8 6" strokeLinecap="round" />
                ))}
              {mapLayer === "guardians" &&
                [[90, 80], [180, 220], [280, 130], [360, 260], [430, 90], [500, 190], [150, 150]].map((p, i) => (
                  <g key={i}>
                    <circle cx={p[0]} cy={p[1]} r="5" fill="#D81B60" />
                    <circle cx={p[0]} cy={p[1]} r="12" fill="none" stroke="#D81B60" strokeWidth="1" opacity="0.5" />
                  </g>
                ))}
              <defs>
                <radialGradient id="heat">
                  <stop offset="0%" stopColor="#D81B60" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#D81B60" stopOpacity="0" />
                </radialGradient>
              </defs>
            </svg>
          </div>
        </GlassCard>
      </section>

      {/* FEATURES GRID */}
      <section id="features" className="relative z-10 max-w-6xl mx-auto px-6 pb-28">
        <Reveal>
          <h2 className="text-center text-3xl md:text-4xl mb-14" style={{ fontFamily: "Cinzel, serif" }}>Everything AEGIS does</h2>
        </Reveal>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-5">
          {features.map((f, i) => (
            <Reveal key={i} delay={(i % 4) * 90}>
              <GlassCard className="hover-card p-6 h-full">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ background: "#F6DCE1" }}>
                  <f.icon size={18} color="#D81B60" />
                </div>
                <h3 className="font-medium mb-1.5 text-[15px]">{f.title}</h3>
                <p className="text-[13px]" style={{ color: "#9E7A80" }}>{f.desc}</p>
              </GlassCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* REGISTRATION */}
      <section id="register" className="relative z-10 max-w-2xl mx-auto px-6 pb-28">
        <Reveal>
          <h2 className="text-center text-3xl md:text-4xl mb-4" style={{ fontFamily: "Cinzel, serif" }}>Become a Guardian</h2>
          <p className="text-center mb-10" style={{ color: "#9E7A80" }}>It takes two minutes. It could matter for a lifetime.</p>
        </Reveal>
        <GlassCard className="p-8">
          {submitted ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center" style={{ background: "linear-gradient(135deg,#E5B2B9,#D81B60)" }}>
                <Check size={28} color="#fff" />
              </div>
              <h3 className="text-xl mb-2" style={{ fontFamily: "Cinzel, serif" }}>Welcome, Guardian.</h3>
              <p style={{ color: "#9E7A80" }}>You're part of the network now. We'll reach you the moment someone nearby needs help.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-8">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-1.5 flex-1 rounded-full overflow-hidden" style={{ background: "#F3E2E4" }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: regStep >= i ? "100%" : "0%", background: "linear-gradient(90deg,#E5B2B9,#D81B60)" }}
                    />
                  </div>
                ))}
              </div>

              {regStep === 0 && (
                <div className="space-y-5">
                  {regFields.slice(0, 2).map((f) => (
                    <FloatField key={f.key} field={f} value={regData[f.key]} onChange={updateReg} />
                  ))}
                </div>
              )}
              {regStep === 1 && (
                <div className="space-y-5">
                  <FloatField key="location" field={regFields[2]} value={regData.location} onChange={updateReg} />
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={captureLiveLocation}
                      disabled={isLocating}
                      className="px-4 py-3 rounded-2xl text-sm font-medium"
                      style={{
                        background: "linear-gradient(135deg,#E5B2B9,#D81B60)",
                        color: "#fff",
                        border: "none",
                        opacity: isLocating ? 0.8 : 1,
                        cursor: isLocating ? "wait" : "pointer",
                        touchAction: "manipulation",
                      }}
                      type="button"
                    >
                      {isLocating ? "Locating…" : "Use my live location"}
                    </button>
                    <span className="text-xs" style={{ color: "#9E7A80" }}>
                      Tap to let the browser capture your current position automatically.
                    </span>
                    {submitError && (
                      <p className="text-sm" style={{ color: "#D81B60" }} aria-live="polite">
                        {submitError}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm block mb-2" style={{ color: "#9E7A80" }}>
                      Pin your exact volunteer position on the map
                    </label>
                    <div
                      ref={mapContainerRef}
                      id="guardian-location-map"
                      className="rounded-2xl overflow-hidden"
                      style={{ width: "100%", height: 320, background: "#F3E2E4" }}
                    />
                    <p className="mt-3 text-sm" style={{ color: "#9E7A80" }}>
                      Selected coordinates: {regData.latitude ? Number(regData.latitude).toFixed(6) : "-"} , {regData.longitude ? Number(regData.longitude).toFixed(6) : "-"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm block mb-2" style={{ color: "#9E7A80" }}>Availability</label>
                    <div className="flex gap-2 flex-wrap">
                      {["Mornings", "Evenings", "Nights", "Always"].map((a) => (
                        <button
                          key={a}
                          onClick={() => updateReg("availability", a)}
                          className="px-4 py-2 rounded-full text-sm transition-all"
                          style={{
                            background: regData.availability === a ? "linear-gradient(135deg,#E5B2B9,#D81B60)" : "#FDF8F9",
                            color: regData.availability === a ? "#fff" : "#4A2E35",
                            border: "1px solid rgba(74,46,53,0.12)",
                          }}
                        >
                          {a}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {regStep === 2 && (
                <div className="space-y-6">
                  <div>
                    <label className="text-sm block mb-2" style={{ color: "#9E7A80" }}>
                      Preferred radius — {regData.radius} km
                    </label>
                    <input
                      type="range" min="1" max="10" value={regData.radius}
                      onChange={(e) => updateReg("radius", e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox" checked={regData.training}
                      onChange={(e) => updateReg("training", e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm" style={{ color: "#4A2E35" }}>I have emergency / first-aid training (optional)</span>
                  </label>
                  {submitError && (
                    <p className="text-sm" style={{ color: "#D81B60" }}>{submitError}</p>
                  )}
                </div>
              )}

              <div className="flex justify-between mt-8">
                <button
                  onClick={() => setRegStep((s) => Math.max(0, s - 1))}
                  className="text-sm px-4 py-2"
                  style={{ color: "#9E7A80", visibility: regStep === 0 ? "hidden" : "visible" }}
                >
                  Back
                </button>
                {regStep < 2 ? (
                  <MagneticButton primary onClick={() => setRegStep((s) => s + 1)} className="!px-6 !py-2.5 text-sm">
                    Continue <ArrowRight size={15} className="inline ml-1" />
                  </MagneticButton>
                ) : (
                  <MagneticButton primary onClick={submitVolunteer} disabled={isSubmitting} className="!px-6 !py-2.5 text-sm">
                    {isSubmitting ? 'Joining...' : 'Join the Network'}
                  </MagneticButton>
                )}
              </div>
            </>
          )}
        </GlassCard>
      </section>

      {/* TESTIMONIALS */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pb-28">
        <Reveal>
          <h2 className="text-center text-3xl md:text-4xl mb-14" style={{ fontFamily: "Cinzel, serif" }}>From guardians</h2>
        </Reveal>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { q: "I received an alert just two streets away and stayed with the victim until police arrived.", n: "Guardian, Koramangala" },
            { q: "I registered mostly out of curiosity. The first time I got an alert, I realised how much it mattered to just be there.", n: "Guardian, HSR Layout" },
            { q: "Knowing there are people like me nearby changes how I feel walking home at night — on both sides of it.", n: "Guardian, Whitefield" },
          ].map((t, i) => (
            <Reveal key={i} delay={i * 110}>
              <GlassCard className="hover-card p-6 h-full flex flex-col justify-between">
                <p className="text-[15px] mb-6" style={{ color: "#4A2E35" }}>&ldquo;{t.q}&rdquo;</p>
                <p className="text-sm" style={{ color: "#D81B60" }}>{t.n}</p>
              </GlassCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative z-10 max-w-2xl mx-auto px-6 pb-28">
        <Reveal>
          <h2 className="text-center text-3xl md:text-4xl mb-10" style={{ fontFamily: "Cinzel, serif" }}>Questions</h2>
        </Reveal>
        <div className="space-y-3">
          {faqs.map((f, i) => (
            <GlassCard key={i} className="overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                className="w-full flex items-center justify-between px-6 py-4 text-left"
              >
                <span className="font-medium text-[15px]">{f.q}</span>
                <ChevronDown
                  size={18}
                  style={{ transform: openFaq === i ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.3s ease", color: "#D81B60" }}
                />
              </button>
              <div
                style={{
                  maxHeight: openFaq === i ? 200 : 0,
                  overflow: "hidden",
                  transition: "max-height 0.4s ease",
                }}
              >
                <p className="px-6 pb-5 text-sm" style={{ color: "#9E7A80" }}>{f.a}</p>
              </div>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 pb-28 text-center">
        <GlassCard className="p-14" style={{ background: "linear-gradient(135deg, rgba(229,178,185,0.5), rgba(216,27,96,0.12))" }}>
          <div className="flex justify-center mb-6">
            <ShieldMark size={70} />
          </div>
          <h2 className="text-3xl md:text-5xl mb-6" style={{ fontFamily: "Cinzel, serif" }}>
            Cities become safer<br />when people care.
          </h2>
          <MagneticButton primary onClick={() => document.getElementById("register")?.scrollIntoView({ behavior: "smooth" })}>
            Become a Guardian Today
          </MagneticButton>
        </GlassCard>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 border-t" style={{ borderColor: "rgba(74,46,53,0.08)" }}>
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldMark size={28} />
            <span style={{ fontFamily: "Cinzel, serif", fontWeight: 600 }}>AEGIS</span>
          </div>
          <div className="flex gap-6 text-sm" style={{ color: "#9E7A80" }}>
            <a href="#" className="hover:text-[#D81B60]">Privacy</a>
            <a href="#" className="hover:text-[#D81B60]">Safety Guidelines</a>
            <a href="#" className="hover:text-[#D81B60]">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FloatField({ field, value, onChange }) {
  const [focused, setFocused] = useState(false);
  const hasValue = value && value.length > 0;
  return (
    <div className="relative">
      <input
        type={field.type}
        value={value}
        onChange={(e) => onChange(field.key, e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={focused ? field.placeholder : ""}
        className="w-full px-4 pt-6 pb-2 rounded-xl outline-none text-[15px]"
        style={{
          background: "#FDF8F9",
          border: `1.5px solid ${focused ? "#D81B60" : "rgba(74,46,53,0.15)"}`,
          color: "#4A2E35",
          transition: "border-color 0.25s ease",
        }}
      />
      <label
        className="absolute left-4 pointer-events-none transition-all duration-200"
        style={{
          top: focused || hasValue ? 6 : "50%",
          transform: focused || hasValue ? "translateY(0) scale(0.78)" : "translateY(-50%) scale(1)",
          transformOrigin: "left center",
          color: focused ? "#D81B60" : "#9E7A80",
        }}
      >
        {field.label}
      </label>
    </div>
  );
}
