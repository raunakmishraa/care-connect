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

type ListingCounts = { caregivers: number; careHomes: number };

function answerFromPublicRecords(question: string, rows: PublicListing[], counts?: ListingCounts) {
  const q = question.toLowerCase().trim();
  if (/^(hello|hi|hey|namaste|नमस्ते)\b/.test(q)) {
    return "Namaste! I can help you explore published caregiver and care-home listings, answer questions about their services and areas, count available listings, and explain how requests and provider applications work.";
  }
  if (/\b(password|change my password|reset my password)\b/.test(q)) {
    return "To change your password, sign in and open My profile, then use the Change password section. You can also use Forgot password on the sign-in form if you cannot sign in.";
  }
  if (/\b(apply|register|become a caregiver|list (a )?care home|verification|provider application)\b/.test(q)) {
    return "To apply, create an account or sign in, then choose the caregiver or care-home application. You can browse public listings without an account. Provider applications and verification documents are private to the applicant and authorized reviewers; applying does not automatically publish a listing.";
  }
  if (/\b(privacy|personal data|role|admin|private messages|account details)\b/.test(q)) {
    return "I only use public, published listing information. I cannot access private applications, account roles, messages, personal contact details, or unpublished listings.";
  }
  if (/\b(book|booking|request care|hire a caregiver|contact a caregiver|how do i arrange care|how does (the )?booking work)\b/.test(q)) {
    return "Browse the public caregiver directory and choose View profile or Request care. You will be asked to sign in or create an account before opening a profile or sending a request. A provider may ask for clarification; a booking is confirmed only after the family agrees to the details and confirms it.";
  }
  if (/\b(what can you do|how can you help|what can i ask|who are you|help|support|what do you know)\b/.test(q)) {
    return "I can answer questions about approved, published caregiver and care-home listings; count the public listings; compare services, areas and displayed rates; and explain how to request care or apply as a provider. Try “How many caregivers are there?” or ask about companionship, mobility support, Kathmandu, or care homes.";
  }

  const asksCount = /\b(how many|number of|count|total number|total)\b/.test(q);
  const mentionsCaregivers = /\b(caregiver|caregivers|carer|carers|care worker|care workers)\b/.test(q);
  const mentionsHomes = /\b(care home|care homes|facility|facilities|nursing home|nursing homes)\b/.test(q);
  if (asksCount && counts) {
    if (mentionsCaregivers && mentionsHomes) {
      const total = counts.caregivers + counts.careHomes;
      return `The public directory currently has ${counts.caregivers} approved, published caregiver ${counts.caregivers === 1 ? "listing" : "listings"} and ${counts.careHomes} approved, published care-home ${counts.careHomes === 1 ? "listing" : "listings"} — ${total} listings in total.`;
    }
    if (mentionsCaregivers) {
      return `There ${counts.caregivers === 1 ? "is" : "are"} currently ${counts.caregivers} approved, published caregiver ${counts.caregivers === 1 ? "listing" : "listings"} in the public directory.`;
    }
    if (mentionsHomes) {
      return `There ${counts.careHomes === 1 ? "is" : "are"} currently ${counts.careHomes} approved, published care-home ${counts.careHomes === 1 ? "listing" : "listings"} in the public directory.`;
    }
    return `The public directory currently has ${counts.caregivers} caregiver ${counts.caregivers === 1 ? "listing" : "listings"} and ${counts.careHomes} care-home ${counts.careHomes === 1 ? "listing" : "listings"} — ${counts.caregivers + counts.careHomes} in total.`;
  }

  const wantsHomes = /care home|care homes|facility|facilities|residential|nursing home|monthly|room/.test(q);
  const wantsCaregivers = /caregiver|carer|hour|companion|mobility|daily living|overnight|home care|personal care|elder care/.test(q);
  const area = q.match(/\b(kathmandu|lalitpur|bhaktapur|bharatpur|chitwan|pokhara|baneshwor|jawalakhel)\b/)?.[0];
  const asksListingQuestion = wantsHomes || wantsCaregivers || !!area ||
    /\b(service|services|rate|rates|price|prices|cost|available|availability|listings|listing|find|show me|search)\b/.test(q);
  if (!asksListingQuestion) {
    return "I can help with published caregiver and care-home listings, listing counts, services, areas and displayed rates, plus guidance on how to request care or apply as a provider. For example, ask “How many caregivers are there?” or “Find companionship support in Kathmandu.”";
  }

  const words = q.split(/\s+/).filter((word) => word.length > 3 && !/^(caregiver|caregivers|carehome|carehomes|facility|facilities|please|show|find|listings|listing|available|availability|service|services|where|which|with|from|there|about|tell|what|have|does|that|this|their|nearby)$/.test(word));
  const matches = rows.filter((r) => {
    if (wantsHomes && r.listing_type !== "care_home") return false;
    if (wantsCaregivers && !wantsHomes && r.listing_type !== "caregiver") return false;
    const haystack = [r.name, r.description, r.facility_type, ...(r.areas || []), ...(r.services || [])].join(" ").toLowerCase();
    return (!area || haystack.includes(area)) &&
      (!words.length || words.some((word) => haystack.includes(word)) || (!wantsHomes && !wantsCaregivers && !area));
  }).slice(0, 4);
  if (!matches.length) {
    return "I couldn't find a matching approved, published listing for those details. Try a broader service or area such as companionship, mobility support, Kathmandu, or care homes. I only use public listing records.";
  }
  return "Here is what I found in approved, published listings:\n" + matches.map((r) => {
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
      if (!supabase) throw new Error("Supabase is not configured.");
      // This read-only view contains only approved, published listing fields.
      const { data, error } = await supabase
        .from("support_chatbot_public_listings")
        .select("listing_type,listing_id,name,description,areas,experience_years,rate_amount,rate_unit,facility_type,services")
        .limit(250);
      if (error) throw error;
      const rows = (data || []) as PublicListing[];
      let counts: ListingCounts | undefined;
      if (/\b(how many|number of|count|total number|total)\b/i.test(text)) {
        const [caregivers, careHomes] = await Promise.all([
          supabase.from("support_chatbot_public_listings").select("listing_id", { count: "exact", head: true }).eq("listing_type", "caregiver"),
          supabase.from("support_chatbot_public_listings").select("listing_id", { count: "exact", head: true }).eq("listing_type", "care_home"),
        ]);
        if (caregivers.error) throw caregivers.error;
        if (careHomes.error) throw careHomes.error;
        counts = { caregivers: caregivers.count ?? 0, careHomes: careHomes.count ?? 0 };
      }
      const reply = answerFromPublicRecords(text, rows, counts);
      setMessages((old) => [...old, { from: "bot", text: reply }]);
    } catch (error) {
      console.warn("Public support listing lookup failed:", error instanceof Error ? error.message : error);
      setMessages((old) => [...old, { from: "bot", text: "I can't access public listing records right now. The directory may be temporarily unavailable; please try again later. I won't guess listing counts or availability." }]);
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
