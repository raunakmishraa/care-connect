import { useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { supabase } from "./lib";

type PublicListing = {
  listing_type: "caregiver" | "care_home";
  listing_id: string;
  name: string;
  description: string | null;
  areas: string[] | null;
  experience_years: number | null;
  rate_amount: number | null;
  rate_unit: string | null;
  facility_type: string | null;
  services: string[] | null;
};

type ChatMessage = { from: "bot" | "user"; text: string };

const money = (value: number, unit: string | null) =>
  `NPR ${new Intl.NumberFormat("en-NP", { maximumFractionDigits: 0 }).format(value)}${unit ? ` per ${unit}` : ""}`;

function answerFromPublicRecords(question: string, rows: PublicListing[]) {
  const q = question.toLowerCase();
  if (/hello|hi\b|namaste|नमस्ते/.test(q)) {
    return "Namaste! I can help you find published caregivers and care homes, understand the information shown on listings, and explain how to apply as a provider.";
  }
  if (/apply|register|become a caregiver|list (a )?care home|verification/.test(q)) {
    return "To apply, sign in and choose the caregiver or care-home application. Submitted documents are private to you and authorized reviewers. Applying does not automatically grant provider access or publish a listing.";
  }
  if (/privacy|data|role|admin|account|password/.test(q)) {
    return "I only look up public, published listing information. I cannot access account roles, private applications, messages, contact details, or unpublished listings.";
  }
  const wantsHomes = /care home|facility|residential|nursing home|monthly|room/.test(q);
  const wantsCaregivers = /caregiver|carer|hour|companion|mobility|daily living|overnight/.test(q);
  const area = q.match(/\b(kathmandu|lalitpur|bhaktapur|bharatpur|chitwan|pokhara|baneshwor|jawalakhel)\b/)?.[0];
  let matches = rows.filter((r) => {
    if (wantsHomes && r.listing_type !== "care_home") return false;
    if (wantsCaregivers && !wantsHomes && r.listing_type !== "caregiver") return false;
    const haystack = [r.name, r.description, r.facility_type, ...(r.areas || []), ...(r.services || [])].join(" ").toLowerCase();
    return (!area || haystack.includes(area)) &&
      (q.length < 8 || q.split(/\s+/).some((word) => word.length > 3 && haystack.includes(word)) || (!wantsHomes && !wantsCaregivers));
  }).slice(0, 4);
  if (!matches.length) {
    return "I couldn't find a matching published listing in the available public records. Try a service or area such as companionship, mobility support, Kathmandu, or care homes. I only use published listings and cannot see private or role-restricted records.";
  }
  return "Here is what I found in published listings:\n" + matches.map((r) => {
    const details = [
      r.listing_type === "caregiver" ? "Caregiver" : (r.facility_type || "Care home"),
      r.areas?.filter(Boolean).join(", "),
      r.experience_years != null ? `${r.experience_years} years' experience` : null,
      r.rate_amount != null ? money(r.rate_amount, r.rate_unit) : null,
      r.services?.length ? `Services: ${r.services.join(", ")}` : null,
      r.description,
    ].filter(Boolean);
    return `• ${r.name}: ${details.join(" · ")}`;
  }).join("\n");
}

export default function SupportChatbot() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { from: "bot", text: "Hello! Ask me about published caregiver or care-home listings, services, areas, or how to apply." },
  ]);

  const send = async () => {
    const text = question.trim();
    if (!text || busy) return;
    setQuestion("");
    setMessages((old) => [...old, { from: "user", text }]);
    setBusy(true);
    try {
      let rows: PublicListing[] = [];
      if (supabase) {
        // This is the only database source queried by the chatbot. It contains
        // published listing fields only; no roles, applications, profiles, or messages.
        const { data, error } = await supabase
          .from("support_chatbot_public_listings")
          .select("listing_type,listing_id,name,description,areas,experience_years,rate_amount,rate_unit,facility_type,services")
          .limit(100);
        if (error) console.warn("Public support listing lookup failed:", error.message);
        else rows = (data || []) as PublicListing[];
      }
      const reply = answerFromPublicRecords(text, rows);
      setMessages((old) => [...old, { from: "bot", text: reply }]);
    } catch {
      setMessages((old) => [...old, { from: "bot", text: "I can't retrieve public listing information right now. Please try again later or use the site's support contact option." }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="support-chatbot">
      {open && (
        <section className="support-chat-panel" aria-label="AashrayaCare support chatbot">
          <header><div><strong>Care support</strong><small>Automated help · public information only</small></div><button type="button" onClick={() => setOpen(false)} aria-label="Close chat"><X size={18} /></button></header>
          <div className="support-chat-messages" aria-live="polite">
            {messages.map((message, index) => <p key={index} className={`support-chat-message ${message.from}`}>{message.text}</p>)}
            {busy && <p className="support-chat-message bot">Looking up published listings…</p>}
          </div>
          <form onSubmit={(event) => { event.preventDefault(); void send(); }}>
            <input value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={400} placeholder="Ask about care options…" aria-label="Message support chatbot" />
            <button type="submit" disabled={busy || !question.trim()} aria-label="Send message"><Send size={17} /></button>
          </form>
        </section>
      )}
      <button className="support-chat-launcher" type="button" onClick={() => setOpen((value) => !value)} aria-label={open ? "Close support chat" : "Open support chat"}>
        {open ? <X size={22} /> : <MessageCircle size={22} />}<span>{open ? "Close" : "Support"}</span>
      </button>
    </div>
  );
}
