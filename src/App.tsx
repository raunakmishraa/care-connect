import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Compass,
  Heart,
  HeartHandshake,
  HelpCircle,
  Home,
  House,
  Languages,
  Leaf,
  ListFilter,
  LockKeyhole,
  LogIn,
  Menu,
  MessageCircle,
  Moon,
  MoreHorizontal,
  Search,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  UserRound,
  Users,
  Wallet,
  X,
  Bookmark,
  MapPin,
  HandHeart,
  ClipboardList,
  FileCheck2,
  Stethoscope,
  CircleHelp,
  AlertTriangle,
  Send,
  Star,
  Eye,
  EyeOff,
  LayoutDashboard,
  Settings,
  LogOut,
} from "lucide-react";
import { formatNPR, supabase } from "./lib";
import { decryptMessage, encryptMessage, ensureMessageIdentity } from "./lib/secure-messages";
import ProviderApplication from "./ProviderApplication";
import SupportChatbot from "./SupportChatbot";

const authErrorMessage = (message: string) => {
  if (
    /no api key found|api key.{0,20}(missing|invalid)|invalid api key/i.test(
      message,
    )
  ) {
    return "Supabase did not receive a valid public API key. Check that VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY) are set for this deployment and belong to the same project, then rebuild and redeploy.";
  }
  return message;
};

type CaregiverReviewProfile = {
  id: string;
  user_id: string;
  public_name: string;
  verification_status: string;
  is_published: boolean;
  accepting_requests: boolean;
};

type ProviderApplicationRecord = {
  id: string;
  user_id: string;
  application_type: "caregiver" | "care_home";
  status: "submitted" | "under_review" | "action_required" | "approved" | "rejected";
  applicant_name: string;
  contact_email: string;
  contact_phone: string;
  service_area: string | null;
  years_experience: number | null;
  services: string[];
  rate_amount: number | null;
  rate_unit: string | null;
  facility_name: string | null;
  facility_type: string | null;
  facility_address: string | null;
  facility_description: string | null;
  facility_services: string[];
  facility_capacity: number | null;
  monthly_fee: number | null;
  registration_number: string | null;
  additional_notes: string | null;
  reviewer_notes: string | null;
  created_at: string;
};

type Caregiver = {
  id: string;
  name: string;
  initials: string;
  role: string;
  area: string;
  years: number;
  rate: number;
  unit: string;
  languages: string[];
  services: string[];
  verified: string;
  availability: string;
  acceptingRequests: boolean;
  bio: string;
  color: string;
  reviews: number;
  rating: number;
};
const EMPTY_CAREGIVERS: Caregiver[] = [];
type FacilityListing = {
  id: string;
  managerUserId: string;
  monthlyFee: number;
  name: string;
  area: string;
  type: string;
  price: string;
  services: string[];
  updated: string;
  initials: string;
  color: string;
  desc: string;
};
const facilities: FacilityListing[] = [];

const en = {
  home: "Home",
  caregivers: "Find caregivers",
  homes: "Care homes",
  how: "How it works",
  safety: "Safety & trust",
  help: "Help",
  signIn: "Sign in",
  getStarted: "Get started",
  find: "Find a caregiver",
  explore: "Explore care homes",
  heroTitle: "Care at home, with more confidence.",
  heroSub:
    "Find thoughtful in-home support for someone you love, or explore care homes around Kathmandu Valley.",
  trust: "Care that starts with clarity",
  browse: "Browse caregivers",
  seeAll: "See all caregivers",
  services: "Support for everyday life",
  stepTitle: "A clearer way to find care",
  stepSub: "You stay in control at every step.",
  step1: "Tell us what you need",
  step1s: "Choose support, timing and location that work for your family.",
  step2: "Compare your options",
  step2s: "Review experience, services, rates and what verification covers.",
  step3: "Request, then agree",
  step3s:
    "The caregiver responds. Your booking is confirmed only after terms are agreed.",
  featured: "Caregivers to get to know",
  featuredSub:
    "Only approved, published caregiver profiles appear here.",
  homesTitle: "Looking into residential care?",
  homesSub:
    "Explore facilities, understand their services and ask questions before arranging a visit.",
  safetyTitle: "Trust is built with clear information.",
  safetySub:
    "Verification is one signal—not a guarantee of safety. Understand what was checked and how to raise a concern.",
  learnSafety: "Explore safety & trust",
  ctaTitle: "Care begins with a conversation.",
  ctaSub:
    "Whether you need support at home or are exploring options, take the next step at your own pace.",
};
const ne: Record<keyof typeof en, string> = {
  home: "गृहपृष्ठ",
  caregivers: "हेरचाहकर्ता खोज्नुहोस्",
  homes: "केयर होमहरू",
  how: "कसरी काम गर्छ",
  safety: "सुरक्षा र विश्वास",
  help: "सहयोग",
  signIn: "लग इन",
  getStarted: "सुरु गर्नुहोस्",
  find: "हेरचाहकर्ता खोज्नुहोस्",
  explore: "केयर होमहरू हेर्नुहोस्",
  heroTitle: "घरमै हेरचाह, अझ बढी विश्वासका साथ।",
  heroSub:
    "आफ्नो प्रियजनका लागि घरमै सहयोग खोज्नुहोस् वा काठमाडौं उपत्यकाका केयर होमहरू हेर्नुहोस्।",
  trust: "स्पष्ट जानकारीबाट सुरु हुने हेरचाह",
  browse: "हेरचाहकर्ता हेर्नुहोस्",
  seeAll: "सबै हेरचाहकर्ता हेर्नुहोस्",
  services: "दैनिक जीवनका लागि सहयोग",
  stepTitle: "हेरचाह खोज्ने अझ स्पष्ट तरिका",
  stepSub: "हरेक चरणमा निर्णय तपाईंको हातमा हुन्छ।",
  step1: "आफ्नो आवश्यकता बताउनुहोस्",
  step1s: "परिवारलाई उपयुक्त सहयोग, समय र स्थान छान्नुहोस्।",
  step2: "विकल्पहरू तुलना गर्नुहोस्",
  step2s: "अनुभव, सेवा, शुल्क र प्रमाणीकरणबारे जानकारी हेर्नुहोस्।",
  step3: "अनुरोध गर्नुहोस्, त्यसपछि सहमति जनाउनुहोस्",
  step3s:
    "हेरचाहकर्ताले जवाफ दिन्छन्। सर्तहरू सहमत भएपछि मात्र बुकिङ पुष्टि हुन्छ।",
  featured: "चिन्न सकिने हेरचाहकर्ताहरू",
  featuredSub:
    "यहाँ स्वीकृत र प्रकाशित हेरचाहकर्ताका प्रोफाइल मात्र देखिन्छन्।",
  homesTitle: "आवासीय हेरचाह खोज्दै हुनुहुन्छ?",
  homesSub:
    "संस्थाहरू हेर्नुहोस्, सेवा बुझ्नुहोस् र भ्रमण मिलाउनुअघि प्रश्न सोध्नुहोस्।",
  safetyTitle: "स्पष्ट जानकारीले विश्वास बनाउँछ।",
  safetySub:
    "प्रमाणीकरण एउटा संकेत मात्र हो—सुरक्षाको ग्यारेन्टी होइन। के जाँचिएको हो र चिन्ता कसरी राख्ने भन्ने बुझ्नुहोस्।",
  learnSafety: "सुरक्षा र विश्वासबारे जान्नुहोस्",
  ctaTitle: "हेरचाह संवादबाट सुरु हुन्छ।",
  ctaSub:
    "घरमै सहयोग चाहिएको होस् वा विकल्पहरू बुझ्दै हुनुहोस्, आफ्नै गतिमा अर्को कदम चाल्नुहोस्.",
};
function App() {
  const [lang, setLang] = useState<"en" | "ne">(
    () => (localStorage.getItem("cc-lang") as "en" | "ne") || "en",
  );
  const [theme, setTheme] = useState<"light" | "dark" | "system">(
    () => (localStorage.getItem("cc-theme") as any) || "system",
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [role, setRole] = useState<
    "family" | "caregiver" | "facility" | "admin" | null
  >(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authFullName, setAuthFullName] = useState("");
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [authConfirmPassword, setAuthConfirmPassword] = useState("");
  const [signupAccountType, setSignupAccountType] = useState<"family" | "caregiver" | "care_home">("family");
  const [authMode, setAuthMode] = useState<
    "signin" | "signup" | "forgot" | "reset"
  >("signin");
  const [authBusy, setAuthBusy] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [caregivers, setCaregivers] = useState<Caregiver[]>(EMPTY_CAREGIVERS);
  const [caregiversLoading, setCaregiversLoading] = useState(false);
  const [caregiversError, setCaregiversError] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [searchText, setSearchText] = useState("");
  const [serviceFilter, setServiceFilter] = useState("All services");
  const [sort, setSort] = useState("Recommended");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<
    "signin" | "request" | "enquiry" | "incident" | null
  >(null);
  const [selected, setSelected] = useState<
    Caregiver | (typeof facilities)[number] | null
  >(null);
  const [step, setStep] = useState(1);
  const [request, setRequest] = useState({
    recipient: "",
    service: "",
    date: "",
    start: "09:00",
    end: "12:00",
    area: "",
    tasks: "",
    budget: "",
    notes: "",
  });
  const [requests, setRequests] = useState<Array<{id:string;ref:string;name:string;service:string;date:string;status:string;amount:number;caregiverProfileId:string;facilityId:string|null;providerType:"caregiver"|"facility";providerUserId:string;familyUserId:string;recipient:string;area:string;tasks:string;notes:string;start:string;end:string}>>([]);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [requestBusy, setRequestBusy] = useState(false);
  const [clarificationFor, setClarificationFor] = useState<string | null>(null);
  const [requestMessages, setRequestMessages] = useState<Record<string, Array<{message:string;sender_user_id:string;created_at:string;encrypted?:boolean}>>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [facilityListings, setFacilityListings] = useState<FacilityListing[]>([]);
  const [conversationList, setConversationList] = useState<Array<{id:string;requestId:string;ref:string;name:string;partnerUserId:string;service:string;date:string;status:string;amount:number;providerType:"caregiver"|"facility"}>>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>("");
  const [conversationMessages, setConversationMessages] = useState<Array<{id:string;sender_user_id:string;body:string;created_at:string;encrypted:boolean}>>([]);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [newRecipient, setNewRecipient] = useState("");
  const [message, setMessage] = useState("");

  const [facilityEnquiries, setFacilityEnquiries] = useState<string[]>([]);
  const [incidentType, setIncidentType] = useState("Safety concern");
  const [incidentText, setIncidentText] = useState("");
  const [activeTab, setActiveTab] = useState("All");
  const [providerApplications, setProviderApplications] = useState<ProviderApplicationRecord[]>([]);
  const [providerApplicationsLoading, setProviderApplicationsLoading] = useState(false);
  const [providerApplicationNotes, setProviderApplicationNotes] = useState<Record<string, string>>({});
  const [caregiverReviewProfiles, setCaregiverReviewProfiles] = useState<CaregiverReviewProfile[]>([]);
  const [caregiverReviewProfilesLoading, setCaregiverReviewProfilesLoading] = useState(false);
  const [publishingCaregiverId, setPublishingCaregiverId] = useState<string | null>(null);
  const [ownCaregiverStatus, setOwnCaregiverStatus] = useState<{ id: string; verificationStatus: string; isPublished: boolean; acceptingRequests: boolean } | null>(null);
  const [caregiverStatusLoading, setCaregiverStatusLoading] = useState(false);
  const [caregiverStatusSaving, setCaregiverStatusSaving] = useState(false);
  const t = lang === "en" ? en : ne;
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  useEffect(() => {
    localStorage.setItem("cc-lang", lang);
    document.documentElement.lang = lang;
  }, [lang]);
  useEffect(() => {
    localStorage.setItem("cc-theme", theme);
    const dark =
      theme === "dark" ||
      (theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [theme]);
  useEffect(() => {
    if (toast) {
      const id = window.setTimeout(() => setToast(""), 3500);
      return () => clearTimeout(id);
    }
  }, [toast]);
  useEffect(() => setMobileOpen(false), [path]);
  useEffect(() => {
    if(!supabase||!authUserId||!signedIn||!userRoles.includes("family")){setRecipients([]);return;}
    let active=true;
    void supabase.from("family_care_recipients").select("full_name,relationship").eq("family_user_id",authUserId).order("created_at")
      .then(({data,error})=>{if(!active)return;if(error){notify("Couldn't load recipients: "+error.message);setRecipients([]);return;}setRecipients((data||[]).map((x:any)=>`${x.full_name} · ${x.relationship||"Recipient"}`));});
    return()=>{active=false;};
  },[authUserId,signedIn,userRoles.join(",")]);
  useEffect(() => {
    if(!supabase||!authUserId||!signedIn)return;
    void ensureMessageIdentity(supabase,authUserId).catch((error)=>console.warn("Secure messaging identity setup did not complete:",error));
  },[authUserId,signedIn]);

  useEffect(() => {
    if(!supabase||!authUserId||!signedIn){setRequests([]);return;}
    const familyView=userRoles.includes("family")&&path.startsWith("/app");
    const caregiverView=userRoles.includes("caregiver")&&(path==="/caregiver/requests"||path==="/caregiver");
    const facilityView=userRoles.includes("facility_manager")&&(path==="/facility/requests"||path==="/facility");
    if(!familyView&&!caregiverView&&!facilityView)return;
    let active=true;
    void(async()=>{
      let query=supabase.from("care_requests").select("id,reference_code,family_user_id,provider_type,caregiver_profile_id,facility_id,recipient_name,service,service_date,start_time,end_time,service_area,tasks,notes,budget_amount,status,caregiver_profiles!care_requests_caregiver_profile_id_fkey(public_name,user_id),care_facilities!care_requests_facility_id_fkey(name,manager_user_id)").order("created_at",{ascending:false});
      if(familyView)query=query.eq("family_user_id",authUserId);
      const {data,error}=await query;if(!active)return;
      if(error){notify("Couldn't load requests: "+error.message);setRequests([]);return;}
      const one=(v:any)=>Array.isArray(v)?v[0]:v;
      setRequests((data||[]).filter((row:any)=>{
        const type=String(row.provider_type||(row.facility_id?"facility":"caregiver")),cg=one(row.caregiver_profiles),facility=one(row.care_facilities);
        return familyView||(caregiverView&&type==="caregiver"&&cg?.user_id===authUserId)||(facilityView&&type==="facility"&&facility?.manager_user_id===authUserId);
      }).map((row:any)=>{
        const cg=one(row.caregiver_profiles),facility=one(row.care_facilities),providerType=String(row.provider_type||(row.facility_id?"facility":"caregiver")) as "caregiver"|"facility";
        return {id:String(row.id),ref:String(row.reference_code||"Care request"),name:String(providerType==="facility"?facility?.name||"Care facility":cg?.public_name||"Caregiver"),service:String(row.service||"Care request"),date:`${row.service_date} · ${String(row.start_time).slice(0,5)}–${String(row.end_time).slice(0,5)}`,status:String(row.status).replace(/_/g," "),amount:Number(row.budget_amount||0),caregiverProfileId:String(row.caregiver_profile_id||""),facilityId:row.facility_id?String(row.facility_id):null,providerType,providerUserId:String(providerType==="facility"?facility?.manager_user_id||"":cg?.user_id||""),familyUserId:String(row.family_user_id),recipient:String(row.recipient_name||"Care recipient"),area:String(row.service_area||""),tasks:String(row.tasks||""),notes:String(row.notes||""),start:String(row.start_time||"09:00").slice(0,5),end:String(row.end_time||"12:00").slice(0,5)};
      }));
    })();
    return()=>{active=false;};
  },[path,authUserId,signedIn,userRoles.join(",")]);

  useEffect(() => {
    const client=supabase;
    if(!client||!authUserId||!signedIn||!userRoles.includes("family")||!requests.length||!path.startsWith("/app")){setRequestMessages({});return;}
    let active=true;const ids=requests.map((r)=>r.id);
    const load=async()=>{
      const {data,error}=await client.from("care_request_messages").select("request_id,message,ciphertext,iv,sender_user_id,created_at").in("request_id",ids).order("created_at");
      if(!active)return;if(error){console.error("Unable to load request messages",error.message);return;}
      const grouped:Record<string,Array<{message:string;sender_user_id:string;created_at:string;encrypted?:boolean}>>={};
      for(const row of data||[]){
        let body=String(row.message||""),encrypted=false;
        if(row.ciphertext&&row.iv){try{body=await decryptMessage(client,authUserId,String(row.sender_user_id),String(row.ciphertext),String(row.iv));encrypted=true;}catch{body="Encrypted message unavailable on this device.";encrypted=true;}}
        (grouped[String(row.request_id)]||=[]).push({message:body,sender_user_id:String(row.sender_user_id),created_at:String(row.created_at),encrypted});
      }
      if(active)setRequestMessages(grouped);
    };
    void load();const timer=window.setInterval(()=>void load(),4000);
    return()=>{active=false;window.clearInterval(timer);};
  },[requests.map((r)=>r.id+":"+r.status).join(","),path,authUserId,signedIn,userRoles.join(",")]);

  useEffect(() => {
    const client=supabase;
    if(!client||(path!=="/care-homes"&&!path.startsWith("/care-homes/")&&path!=="/"))return;
    let active=true;
    void client.from("care_facilities").select("id,manager_user_id,name,area,facility_type,description,services,indicative_monthly_fee,availability_note").eq("verification_status","approved").eq("is_published",true).order("created_at",{ascending:false}).then(({data,error})=>{
      if(!active)return;
      if(error){console.error("Unable to load care facilities:",error.message);setFacilityListings([]);return;}
      setFacilityListings((data||[]).map((row:any,index:number)=>{
        const name=String(row.name||"Care facility");
        return {id:String(row.id),managerUserId:String(row.manager_user_id),monthlyFee:Number(row.indicative_monthly_fee||0),name,area:String(row.area||"Area not provided"),type:String(row.facility_type||"Residential care"),price:row.indicative_monthly_fee?formatNPR(Number(row.indicative_monthly_fee))+" / month":"Fee on enquiry",services:Array.isArray(row.services)?row.services.map(String):[],updated:String(row.availability_note||"Ask for current availability"),initials:name.split(/\s+/).slice(0,2).map((p:string)=>p[0]?.toUpperCase()||"").join(""),color:["mint","blue","rose"][index%3],desc:String(row.description||"Contact this approved facility to discuss care options and availability.")};
      }));
    });
    return()=>{active=false;};
  },[path]);

  useEffect(() => {
    const client=supabase;
    if(!client||!authUserId||!signedIn||!["/app/messages","/caregiver/messages","/facility/messages"].includes(path)){setConversationList([]);setConversationMessages([]);return;}
    let active=true;setConversationLoading(true);
    void(async()=>{
      const {data,error}=await client.from("conversations").select("id,request_id,created_at,care_requests!conversations_request_id_fkey(id,reference_code,family_user_id,provider_type,caregiver_profile_id,facility_id,service,service_date,start_time,end_time,budget_amount,status,caregiver_profiles!care_requests_caregiver_profile_id_fkey(public_name,user_id),care_facilities!care_requests_facility_id_fkey(name,manager_user_id))").not("request_id","is",null).order("created_at",{ascending:false});
      if(!active)return;
      if(error){console.error("Unable to load request conversations:",error.message);setConversationList([]);setConversationLoading(false);return;}
      const one=(v:any)=>Array.isArray(v)?v[0]:v;
      const mapped=(data||[]).map((convo:any)=>{
        const req=one(convo.care_requests);if(!req)return null;
        const cg=one(req.caregiver_profiles),facility=one(req.care_facilities),providerType=String(req.provider_type||(req.facility_id?"facility":"caregiver")) as "caregiver"|"facility",isFamily=String(req.family_user_id)===authUserId;
        const partnerUserId=isFamily?String(providerType==="facility"?facility?.manager_user_id||"":cg?.user_id||""):String(req.family_user_id||"");
        const partnerName=isFamily?String(providerType==="facility"?facility?.name||"Care facility":cg?.public_name||"Caregiver"):"Family · "+String(req.reference_code||"Care request");
        return {id:String(convo.id),requestId:String(req.id),ref:String(req.reference_code||"Care request"),name:partnerName,partnerUserId,service:String(req.service||"Care request"),date:`${req.service_date} · ${String(req.start_time).slice(0,5)}–${String(req.end_time).slice(0,5)}`,status:String(req.status).replace(/_/g," "),amount:Number(req.budget_amount||0),providerType};
      }).filter(Boolean) as Array<{id:string;requestId:string;ref:string;name:string;partnerUserId:string;service:string;date:string;status:string;amount:number;providerType:"caregiver"|"facility"}>;
      setConversationList(mapped);setActiveConversationId((current)=>mapped.some((x)=>x.id===current)?current:(mapped[0]?.id||""));setConversationLoading(false);
    })();
    return()=>{active=false;};
  },[path,authUserId,signedIn,userRoles.join(",")]);

  useEffect(() => {
    const client=supabase;
    if(!client||!authUserId||!activeConversationId||!["/app/messages","/caregiver/messages","/facility/messages"].includes(path)){setConversationMessages([]);return;}
    let active=true;
    const load=async(initial=false)=>{
      if(initial)setConversationLoading(true);
      const {data,error}=await client.from("messages").select("id,sender_user_id,body,ciphertext,iv,created_at").eq("conversation_id",activeConversationId).order("created_at",{ascending:true});
      if(!active)return;
      if(error){console.error("Unable to load conversation messages:",error.message);setConversationMessages([]);setConversationLoading(false);return;}
      const decoded=await Promise.all((data||[]).map(async(row:any)=>{
        if(row.ciphertext&&row.iv){try{return {id:String(row.id),sender_user_id:String(row.sender_user_id),body:await decryptMessage(client,authUserId,String(row.sender_user_id),String(row.ciphertext),String(row.iv)),created_at:String(row.created_at),encrypted:true};}catch{return {id:String(row.id),sender_user_id:String(row.sender_user_id),body:"Encrypted message unavailable on this device.",created_at:String(row.created_at),encrypted:true};}}
        return {id:String(row.id),sender_user_id:String(row.sender_user_id),body:row.body?String(row.body)+" (legacy message; sent before client-side encryption)":"This legacy message cannot be displayed securely.",created_at:String(row.created_at),encrypted:false};
      }));
      if(active){setConversationMessages(decoded);setConversationLoading(false);}
    };
    void load(true);const timer=window.setInterval(()=>void load(false),3500);
    return()=>{active=false;window.clearInterval(timer);};
  },[activeConversationId,authUserId,path]);

  useEffect(() => {
    if (!["/caregiver", "/caregiver/profile"].includes(path) || !supabase || !authUserId || !userRoles.includes("caregiver")) {
      setOwnCaregiverStatus(null);
      return;
    }
    let active = true;
    setCaregiverStatusLoading(true);
    void supabase
      .rpc("caregiver_get_own_listing_status")
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error("Unable to load own caregiver availability:", error);
          notify("Couldn't load your listing status: " + error.message);
          setOwnCaregiverStatus(null);
          return;
        }
        const row = Array.isArray(data) ? data[0] : data;
        setOwnCaregiverStatus(row ? {
          id: String(row.id),
          verificationStatus: String(row.verification_status || "pending"),
          isPublished: Boolean(row.is_published),
          acceptingRequests: Boolean(row.accepting_requests),
        } : null);
      })
      .finally(() => { if (active) setCaregiverStatusLoading(false); });
    return () => { active = false; };
  }, [path, authUserId, userRoles.join(",")]);

  useEffect(() => {
    if (!supabase) {
      setCaregivers([]);
      setCaregiversError("Caregiver listings are unavailable because Supabase is not configured.");
      return;
    }
    const shouldLoadDirectory =
      path === "/" ||
      path === "/caregivers" ||
      /^\/caregivers\/[^/]+\/?$/.test(path);
    if (!shouldLoadDirectory) return;
    let active = true;
    setCaregiversLoading(true);
    setCaregiversError(null);
    void (async () => {
      const { data: profiles, error } = await supabase
        .from("caregiver_profiles")
        .select("id, public_name, headline, years_experience, service_areas, rate_amount, rate_unit, accepting_requests, verification_status, is_published")
        .eq("verification_status", "approved")
        .eq("is_published", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const profileRows = profiles || [];
      if (!profileRows.length) {
        if (active) setCaregivers([]);
        return;
      }
      const profileIds = profileRows.map((profile: any) => profile.id);
      const { data: serviceRows, error: serviceError } = await supabase
        .from("caregiver_services")
        .select("caregiver_id, service_categories(name_en)")
        .in("caregiver_id", profileIds);
      if (serviceError) console.warn("Unable to load caregiver service labels:", serviceError.message);
      const servicesByProfile = new Map<string, string[]>();
      (serviceRows || []).forEach((row: any) => {
        const relation = row.service_categories;
        const categoryName = Array.isArray(relation) ? relation[0]?.name_en : relation?.name_en;
        if (!categoryName) return;
        const current = servicesByProfile.get(row.caregiver_id) || [];
        current.push(String(categoryName));
        servicesByProfile.set(row.caregiver_id, current);
      });
      const mapped: Caregiver[] = profileRows.map((profile: any, index: number) => {
        const name = String(profile.public_name || "Caregiver");
        const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part: string) => part[0].toUpperCase()).join("") || "C";
        const areas = Array.isArray(profile.service_areas) ? profile.service_areas : [];
        const headline = String(profile.headline || "Care and daily living support");
        const rawServices = servicesByProfile.get(profile.id) || [];
        return {
          id: String(profile.id), name, initials, role: headline,
          area: areas.join(", ") || "Service area not specified",
          years: Number(profile.years_experience || 0),
          rate: Number(profile.rate_amount || 0), unit: String(profile.rate_unit || "hour"),
          languages: [], services: rawServices.length ? rawServices : ["Daily living support"],
          verified: "Verified",
          availability: profile.accepting_requests ? "Accepting requests" : "Currently unavailable",
          acceptingRequests: Boolean(profile.accepting_requests),
          bio: headline, color: ["sage", "blue", "gold", "rose"][index % 4],
          reviews: 0, rating: 0,
        };
      });
      if (active) setCaregivers(mapped);
    })().catch((error: any) => {
      console.error("Unable to load public caregiver listings:", error);
      if (active) {
        setCaregivers([]);
        const detail = error instanceof Error ? error.message : String(error?.message || error || "Unknown Supabase error");
        setCaregiversError("We couldn't load caregiver listings right now. " + detail);
      }
    }).finally(() => {
      if (active) setCaregiversLoading(false);
    });
    return () => { active = false; };
  }, [path]);
  useEffect(() => {
    let active = true;
    const applySession = async (session: any) => {
      if (!active) return;
      if (!session?.user) {
        setSignedIn(false);
        setAuthUserId(null);
        setUserRoles([]);
        setRole(null);
        setAuthLoading(false);
        return;
      }
      setSignedIn(true);
      setAuthUserId(session.user.id);
      // Do not re-block the page for auth events when the session is already available.
      if (!supabase) {
        setUserRoles([]);
        setRole(null);
        setAuthLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);
      if (!active) return;
      const roles = error ? [] : (data || []).map((r: any) => String(r.role));
      setUserRoles(roles);
      const chosen = roles.includes("admin")
        ? "admin"
        : roles.includes("caregiver")
          ? "caregiver"
          : roles.includes("facility_manager")
            ? "facility"
            : roles.includes("family")
              ? "family"
              : null;
      setRole(chosen);
      setAuthLoading(false);
    };
    if (!supabase) {
      setAuthLoading(false);
      return () => {
        active = false;
      };
    }
    supabase.auth
      .getSession()
      .then(({ data }) => applySession(data.session))
      .catch(() => {
        if (active) {
          setSignedIn(false);
          setAuthLoading(false);
        }
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Token refreshes do not change identity or roles; avoid re-running role checks
      // and toggling protected pages into a visible loading state for these events.
      if (event === "TOKEN_REFRESHED") return;
      if (event === "PASSWORD_RECOVERY") {
        setAuthMode("reset");
        setModal("signin");
        setAuthPassword("");
        setAuthConfirmPassword("");
      }
      window.setTimeout(() => {
        void applySession(session);
      }, 0);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Re-read the signed-in user's roles when navigating between pages.
  // This handles roles assigned or corrected while an existing session is active.
  useEffect(() => {
    const needsWorkspaceRole =
      path === "/app" ||
      path.startsWith("/app/") ||
      path === "/caregiver" ||
      path.startsWith("/caregiver/") ||
      path === "/facility" ||
      path.startsWith("/facility/") ||
      path === "/admin" ||
      path.startsWith("/admin/");
    if (!supabase || !needsWorkspaceRole) return;

    let active = true;
    const refreshWorkspaceRoles = async () => {
      // Revalidate permissions in the background without blocking/remounting the page.
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      if (!active) return;
      if (sessionError || !sessionData.session?.user) {
        setUserRoles([]);
        setRole(null);
        setAuthLoading(false);
        return;
      }

      const userId = sessionData.session.user.id;
      setSignedIn(true);
      setAuthUserId(userId);
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (!active) return;
      if (error) {
        console.error("Unable to refresh account roles:", error.message);
        setUserRoles([]);
        setRole(null);
        setAuthLoading(false);
        return;
      }

      const roles = (data || [])
        .map((row: { role: string }) => String(row.role).trim().toLowerCase());
      setUserRoles(roles);
      const chosen = roles.includes("admin")
        ? "admin"
        : roles.includes("caregiver")
          ? "caregiver"
          : roles.includes("facility_manager")
            ? "facility"
            : roles.includes("family")
              ? "family"
              : null;
      setRole(chosen);
      setAuthLoading(false);
    };

    void refreshWorkspaceRoles().catch((error) => {
      if (!active) return;
      console.error("Unable to refresh account roles:", error);
      setUserRoles([]);
      setRole(null);
      setAuthLoading(false);
    });

    return () => {
      active = false;
    };
  }, [path]);

  useEffect(() => {
    if (!supabase || !authUserId || !signedIn) {
      setProfileName("");
      setProfilePhone("");
      setProfileEmail("");
      return;
    }
    let active = true;
    void (async () => {
      const [{ data: authData }, { data, error }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("users").select("full_name, phone, email").eq("id", authUserId).maybeSingle(),
      ]);
      if (!active) return;
      const authUser = authData.user;
      const name = String(data?.full_name || authUser?.user_metadata?.full_name || authUser?.email?.split("@")[0] || "");
      setProfileName(name);
      setProfilePhone(String(data?.phone || ""));
      setProfileEmail(String(authUser?.email || data?.email || ""));
    })().catch((error) => console.error("Unable to load profile:", error));
    return () => { active = false; };
  }, [authUserId, signedIn]);

  useEffect(() => {
    if (path !== "/admin/verifications" || !supabase || !userRoles.includes("admin")) return;
    let active = true;
    setProviderApplicationsLoading(true);
    void supabase
      .from("provider_applications")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error("Unable to load provider applications:", error.message);
          notify("Could not load provider applications. Check the migration and admin table permissions.");
          setProviderApplications([]);
        } else {
          setProviderApplications((data || []) as ProviderApplicationRecord[]);
        }
        setProviderApplicationsLoading(false);
      });
    return () => { active = false; };
  }, [path, userRoles]);

  useEffect(() => {
    if (path !== "/admin/verifications" || !supabase || !userRoles.includes("admin")) return;
    let active = true;
    setCaregiverReviewProfilesLoading(true);
    void supabase
      .from("caregiver_profiles")
      .select("id, user_id, public_name, verification_status, is_published, accepting_requests")
      .eq("is_published", false)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error("Unable to load caregiver verification queue:", error.message);
          notify("Could not load caregiver profiles for verification: " + error.message);
          setCaregiverReviewProfiles([]);
        } else {
          setCaregiverReviewProfiles((data || []) as CaregiverReviewProfile[]);
        }
        setCaregiverReviewProfilesLoading(false);
      });
    return () => { active = false; };
  }, [path, userRoles]);

  const publishCaregiverProfile = async (profile: CaregiverReviewProfile) => {
    if (!supabase || !userRoles.includes("admin")) {
      notify("Only an administrator can publish caregiver profiles.");
      return;
    }
    const applicationApproved = providerApplications.some(
      (application) => application.user_id === profile.user_id &&
        application.application_type === "caregiver" &&
        application.status === "approved",
    );
    if (!applicationApproved) {
      notify("Approve the caregiver application before completing verification.");
      return;
    }
    setPublishingCaregiverId(profile.id);
    const { error } = await supabase.rpc("admin_publish_caregiver_profile", {
      p_profile_id: profile.id,
    });
    setPublishingCaregiverId(null);
    if (error) {
      console.error("Unable to publish caregiver profile:", error);
      notify("Publication failed: " + error.message);
      return;
    }
    setCaregiverReviewProfiles((current) => current.filter((item) => item.id !== profile.id));
    notify("Caregiver verified and published. The public directory will show this profile.");
  };

  const saveProfile = async () => {
    if (!supabase || !authUserId) return;
    const name = profileName.trim();
    if (!name) {
      notify("Please enter your full name.");
      return;
    }
    setProfileSaving(true);
    const { error } = await supabase
      .from("users")
      .update({ full_name: name, phone: profilePhone.trim() || null, updated_at: new Date().toISOString() })
      .eq("id", authUserId);
    setProfileSaving(false);
    if (error) {
      console.error("Unable to save profile:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      const detail = [error.message, error.details, error.hint]
        .filter(Boolean)
        .join(" ");
      if (error.code === "42501" || /permission denied|row-level security|not allowed/i.test(detail)) {
        notify("Supabase blocked this profile update. Apply the profile permissions migration, then sign out and back in.");
      } else if (/no api key found|no apikey|api key/i.test(detail)) {
        notify("The app is missing its Supabase public API key. Check VITE_SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_KEY in deployment settings, then rebuild.");
      } else {
        notify(`We couldn't save your profile: ${error.message || "Unknown database error"}${error.code ? ` (${error.code})` : ""}`);
      }
      return;
    }
    if (supabase) {
      const { error: authError } = await supabase.auth.updateUser({ data: { full_name: name } });
      if (authError) console.warn("Profile saved, but auth metadata was not updated:", authError.message);
    }
    notify("Profile information updated.");
  };

  const updateOwnCaregiverStatus = async (changes: { acceptingRequests?: boolean; isPublished?: boolean }) => {
    if (!supabase || !authUserId || !userRoles.includes("caregiver") || !ownCaregiverStatus) {
      notify("Only the signed-in caregiver can change their own listing status.");
      return;
    }
    setCaregiverStatusSaving(true);
    const { error } = await supabase.rpc("caregiver_update_own_listing_status", {
      p_accepting_requests: changes.acceptingRequests ?? ownCaregiverStatus.acceptingRequests,
      p_is_published: changes.isPublished ?? ownCaregiverStatus.isPublished,
    });
    setCaregiverStatusSaving(false);
    if (error) {
      console.error("Unable to update caregiver listing status:", {
        message: error.message, code: error.code, details: error.details, hint: error.hint,
      });
      notify("Couldn't update your listing status: " + error.message);
      return;
    }
    setOwnCaregiverStatus(current => current ? {
      ...current,
      acceptingRequests: changes.acceptingRequests ?? current.acceptingRequests,
      isPublished: changes.isPublished ?? current.isPublished,
    } : current);
    notify("Your caregiver listing preferences have been updated.");
  };

  const displayName = profileName.trim() || authFullName.trim() || profileEmail.split("@")[0] || "";
  const profileInitials = displayName
    .split(/\\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "U";

  const notify = (s: string) => setToast(s);
  const go = (p: string) => navigate(p);
  const reviewProviderApplication = async (
    application: ProviderApplicationRecord,
    status: ProviderApplicationRecord["status"],
  ) => {
    if (!supabase || !authUserId || !userRoles.includes("admin")) {
      notify("Only an authenticated administrator can review applications.");
      return;
    }
    const notes = (providerApplicationNotes[application.id] || "").trim();
    if (status === "action_required" && !notes) {
      notify("Add a note explaining what information is required.");
      return;
    }
    const { error } = await supabase.rpc("admin_review_provider_application", {
      p_application_id: application.id,
      p_status: status,
      p_reviewer_notes: notes || null,
    });
    if (error) {
      console.error("Unable to review provider application:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      const errorText = [error.message, error.details, error.hint]
        .filter(Boolean)
        .join(" ");
      if (/admin_review_provider_application.*(not found|does not exist)|could not find the function|schema cache/i.test(errorText)) {
        notify("Provider review database function is missing. Apply supabase/migrations/202610230001_provider_applications.sql in the Supabase SQL Editor, then retry.");
      } else if (/administrator access required|permission denied|row-level security|42501/i.test(errorText) || error.code === "42501") {
        notify("Supabase rejected this review for permissions. Confirm this signed-in user's public.user_roles row has role = 'admin', then sign out and back in.");
      } else {
        notify(`Review failed: ${error.message || "Unknown Supabase error"}${error.code ? ` (code ${error.code})` : ""}`);
      }
      return;
    }
    const { data, error: refreshError } = await supabase
      .from("provider_applications")
      .select("*")
      .eq("id", application.id)
      .single();
    if (refreshError || !data) {
      notify("The review decision was saved, but the refreshed application could not be loaded.");
      return;
    }
    setProviderApplications((current) => current.map((item) => item.id === application.id ? data as ProviderApplicationRecord : item));
    notify(status === "approved"
      ? "Application approved. Provider workspace access was assigned; the draft listing remains unpublished pending verification."
      : "Application review status updated.");
  };
  const openAuth = (mode: "signin" | "signup") => {
    setAuthMode(mode);
    setModal("signin");
  };
  const signIn = async () => {
    if (!supabase) {
      notify(
        "Authentication is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY) before signing in.",
      );
      return;
    }
    if (!authEmail.trim() || !authPassword) {
      notify("Enter your email and password.");
      return;
    }
    setAuthBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: authEmail.trim(),
      password: authPassword,
    });
    if (error || !data.user) {
      setAuthBusy(false);
      notify(authErrorMessage(error?.message || "Unable to sign in."));
      return;
    }
    const { data: roleRows, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const roles = roleError
      ? []
      : (roleRows || []).map((r: any) => String(r.role));
    setSignedIn(true);
    setAuthUserId(data.user.id);
    setUserRoles(roles);
    const chosen = roles.includes("admin")
      ? "admin"
      : roles.includes("caregiver")
        ? "caregiver"
        : roles.includes("facility_manager")
          ? "facility"
          : roles.includes("family")
            ? "family"
            : null;
    setRole(chosen);
    setAuthLoading(false);
    setAuthBusy(false);
    setModal(null);
    setAuthPassword("");
    const isDetail = /^\/(caregivers|care-homes)\/[^/]+\/?$/.test(path);
    const requestedApplication = data.user.user_metadata?.account_type;
    if (isDetail) {
      go(path);
    } else if (path.startsWith("/apply/") && roles.includes("family")) {
      go(path);
    } else if (path === "/" && roles.includes("family") && requestedApplication === "caregiver") {
      go("/apply/caregiver");
    } else if (path === "/" && roles.includes("family") && requestedApplication === "care_home") {
      go("/apply/care-home");
    } else if (path.startsWith("/admin") && roles.includes("admin"))
      go("/admin");
    else if (path.startsWith("/caregiver") && roles.includes("caregiver"))
      go("/caregiver");
    else if (path.startsWith("/facility") && roles.includes("facility_manager"))
      go("/facility");
    else if (path.startsWith("/app") && roles.includes("family")) go("/app");
    else if (chosen === "admin") go("/admin");
    else if (chosen === "caregiver") go("/caregiver");
    else if (chosen === "facility") go("/facility");
    else if (chosen === "family") go("/app");
    notify(
      roles.length
        ? "Signed in. Access is based on your assigned account role."
        : "Signed in, but no application role is assigned. Contact an administrator.",
    );
  };
  const signUp = async () => {
    if (!supabase) {
      notify(
        "Authentication is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY) before creating an account.",
      );
      return;
    }
    if (!authFullName.trim()) {
      notify("Enter your full name.");
      return;
    }
    if (!authEmail.trim()) {
      notify("Enter your email address.");
      return;
    }
    if (authPassword.length < 8) {
      notify("Choose a password with at least 8 characters.");
      return;
    }
    if (authPassword !== authConfirmPassword) {
      notify("The passwords do not match.");
      return;
    }
    setAuthBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: authEmail.trim(),
      password: authPassword,
      options: {
        data: { full_name: authFullName.trim(), account_type: signupAccountType },
        emailRedirectTo: window.location.origin + "/",
      },
    });
    setAuthBusy(false);
    if (error) {
      notify(authErrorMessage(error.message));
      return;
    }
    setAuthPassword("");
    setAuthConfirmPassword("");
    if (data.session && data.user) {
      setModal(null);
      if (signupAccountType === "caregiver") {
        go("/apply/caregiver");
        notify("Your account is ready. Complete the caregiver application for review.");
      } else if (signupAccountType === "care_home") {
        go("/apply/care-home");
        notify("Your account is ready. Complete the care-home listing application for review.");
      } else {
        go("/app");
        notify("Your family account is ready. You can browse care options now.");
      }
    } else {
      notify(
        signupAccountType === "family"
          ? "Account created. If email confirmation is enabled, confirm your email and sign in to continue."
          : "Account created. Confirm your email if requested, then sign in to continue your provider application. Provider access is only granted after review."
      );
      setAuthMode("signin");
    }
  };
  const sendPasswordReset = async () => {
    if (!supabase) {
      notify("Authentication is not configured.");
      return;
    }
    if (!authEmail.trim()) {
      notify("Enter your email address first.");
      return;
    }
    setAuthBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(
      authEmail.trim(),
      { redirectTo: window.location.origin + "/" },
    );
    setAuthBusy(false);
    if (error) {
      notify(authErrorMessage(error.message));
      return;
    }
    notify(
      "If an account exists for that email, a password-reset link has been sent. Check your inbox and spam folder.",
    );
  };
  const resendConfirmation = async () => {
    if (!supabase) {
      notify("Authentication is not configured.");
      return;
    }
    if (!authEmail.trim()) {
      notify("Enter the email address you used to create your account.");
      return;
    }
    setAuthBusy(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: authEmail.trim(),
      options: { emailRedirectTo: window.location.origin + "/" },
    });
    setAuthBusy(false);
    if (error) {
      notify(authErrorMessage(error.message));
      return;
    }
    notify(
      "If this address has a pending confirmation, a new confirmation email has been requested. Check spam and promotions folders too.",
    );
  };
  const updatePassword = async () => {
    if (!supabase) {
      notify("Authentication is not configured.");
      return;
    }
    if (authPassword.length < 8) {
      notify("Choose a password with at least 8 characters.");
      return;
    }
    if (authPassword !== authConfirmPassword) {
      notify("The passwords do not match.");
      return;
    }
    setAuthBusy(true);
    const { error } = await supabase.auth.updateUser({
      password: authPassword,
    });
    setAuthBusy(false);
    if (error) {
      notify(authErrorMessage(error.message));
      return;
    }
    setAuthPassword("");
    setAuthConfirmPassword("");
    setModal(null);
    setAuthMode("signin");
    notify(
      "Your password has been updated. You can now sign in with your new password.",
    );
  };
  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    setSignedIn(false);
    setAuthUserId(null);
    setUserRoles([]);
    setRole(null);
    go("/");
    notify("You have signed out.");
  };
  const isWorkspace =
    path === "/profile" ||
    path === "/app" ||
    path.startsWith("/app/") ||
    path === "/caregiver" ||
    path.startsWith("/caregiver/") ||
    path === "/facility" ||
    path.startsWith("/facility/") ||
    path === "/admin" ||
    path.startsWith("/admin/");
  const isCaregiverDetail = /^\/caregivers\/[^/]+\/?$/.test(path);
  const isCareHomeDetail = /^\/care-homes\/[^/]+\/?$/.test(path);
  const requiredRole =
    path === "/admin" || path.startsWith("/admin/")
      ? "admin"
      : path === "/caregiver" || path.startsWith("/caregiver/")
        ? "caregiver"
        : path === "/facility" || path.startsWith("/facility/")
          ? "facility_manager"
          : path === "/app" || path.startsWith("/app/")
            ? "family"
            : null;
  const isProviderApplication = path === "/apply/caregiver" || path === "/apply/care-home";
  const routeNeedsAuth =
    path === "/profile" || !!requiredRole || isCaregiverDetail || isCareHomeDetail || isProviderApplication;
  const hasRequiredRole = !requiredRole || userRoles.includes(requiredRole);
  const routeAuthorized =
    !routeNeedsAuth || (signedIn && !authLoading && hasRequiredRole);
  const workspaceRole = path.startsWith("/admin")
    ? "admin"
    : path.startsWith("/caregiver")
      ? "caregiver"
      : path.startsWith("/facility")
        ? "facility"
        : role || "family";
  const filtered = useMemo(
    () =>
      caregivers
        .filter(
          (c) =>
            (!searchText ||
              `${c.name} ${c.area} ${c.services.join(" ")}`
                .toLowerCase()
                .includes(searchText.toLowerCase())) &&
            (serviceFilter === "All services" ||
              c.services.includes(serviceFilter)),
        )
        .sort((a, b) =>
          sort === "Price: low to high"
            ? a.rate - b.rate
            : sort === "Experience"
              ? b.years - a.years
              : b.rating - a.rating,
        ),
    [caregivers, searchText, serviceFilter, sort],
  );
  const requestCare = (c: Caregiver | FacilityListing) => {
    if (!signedIn) {
      openAuth("signin");
      notify("Sign in to continue your care request.");
      return;
    }
    if (!userRoles.includes("family")) {
      notify("Only an account with the assigned family role can request care.");
      return;
    }
    const isFacility = "managerUserId" in c;
    setSelected(c);
    setRequest((current) => ({ ...current, area: c.area || current.area, service: isFacility ? "Residential care placement" : current.service, budget: isFacility && c.monthlyFee ? String(c.monthlyFee) : current.budget }));
    setStep(1);
    setModal("request");
  };
  const submitRequest = async () => {
    const client=supabase;
    if(!client||!authUserId||!userRoles.includes("family")){notify("Sign in with a family account to submit a care request.");return;}
    const target=selected as Caregiver|FacilityListing|null;
    const isFacility=!!target&&"managerUserId" in target;
    if(!target?.id||!request.recipient||!request.date||!request.area.trim()){notify("Choose a recipient, date and service location.");return;}
    if(request.end<=request.start){notify("End time must be later than start time.");return;}
    setRequestBusy(true);
    const now=new Date(), ref="AC-"+now.getFullYear().toString().slice(-2)+(now.getMonth()+1).toString().padStart(2,"0")+"-"+Math.floor(1000+Math.random()*8999);
    const minutes=(Number(request.end.split(":")[0])*60+Number(request.end.split(":")[1]||0))-(Number(request.start.split(":")[0])*60+Number(request.start.split(":")[1]||0));
    const payload={reference_code:ref,family_user_id:authUserId,provider_type:isFacility?"facility":"caregiver",caregiver_profile_id:isFacility?null:target.id,facility_id:isFacility?target.id:null,recipient_name:request.recipient,service:request.service||(isFacility?"Residential care placement":"Daily living support"),service_date:request.date,start_time:request.start,end_time:request.end,service_area:request.area.trim(),tasks:request.tasks.trim(),notes:request.notes.trim(),budget_amount:Number(request.budget||0)*(isFacility?1:Math.max(1,minutes/60)),status:"pending_response"};
    const {data,error}=await client.from("care_requests").insert(payload).select("id").single();
    setRequestBusy(false);
    if(error||!data){notify("Request wasn't saved: "+(error?.message||"Try again."));return;}
    setModal(null);setStep(1);setRequest({recipient:"",service:"",date:"",start:"09:00",end:"12:00",area:"",tasks:"",budget:"",notes:""});
    go("/app/requests");notify(`Request ${ref} submitted and saved. The provider can respond before a booking is confirmed.`);
  };

  const acceptCareRequest = async (item:(typeof requests)[number]) => {
    const client=supabase;
    if(!client||!authUserId||!(userRoles.includes("caregiver")||userRoles.includes("facility_manager"))){notify("Sign in with the assigned provider account to respond.");return;}
    setRequestBusy(true);const {data,error}=await client.rpc("care_request_accept",{p_request_id:item.id});setRequestBusy(false);
    if(error||!data){notify("Request could not be accepted: "+(error?.message||"Please refresh and try again."));return;}
    setRequests(current=>current.map(x=>x.id===item.id?{...x,status:"accepted pending terms"}:x));
    notify("Request accepted. The family has been notified and a private conversation is available. Confirm only after reviewing the details together.");
    if(path.endsWith("/messages"))setActiveConversationId(String(data));
  };

  const confirmCareRequest = async (item:(typeof requests)[number]) => {
    const client=supabase;
    if(!client||!authUserId||!userRoles.includes("family")){notify("Sign in with the requesting family account to confirm this booking.");return;}
    setRequestBusy(true);const {data,error}=await client.rpc("care_request_confirm",{p_request_id:item.id});setRequestBusy(false);
    if(error||data!==true){notify("Booking could not be confirmed: "+(error?.message||"Review the request status and try again."));return;}
    setRequests(current=>current.map(x=>x.id===item.id?{...x,status:"confirmed"}:x));notify("Booking confirmed. Both parties can continue coordinating in Messages.");
  };

  const sendRequestMessage = async (item:(typeof requests)[number]) => {
    const client=supabase,draft=(replyDrafts[item.id]||"").trim();
    if(!client||!authUserId||!draft)return;
    if(!item.providerUserId){notify("The assigned provider account could not be found.");return;}
    setRequestBusy(true);
    try {
      const encrypted=await encryptMessage(client,authUserId,item.providerUserId,draft);
      const {error}=await client.from("care_request_messages").insert({request_id:item.id,sender_user_id:authUserId,message:null,ciphertext:encrypted.ciphertext,iv:encrypted.iv});
      if(error)throw new Error(error.message);
      setRequestMessages(current=>({...current,[item.id]:[...(current[item.id]||[]),{message:draft,sender_user_id:authUserId,created_at:new Date().toISOString(),encrypted:true}]}));
      setReplyDrafts(current=>({...current,[item.id]:""}));notify("Encrypted reply sent to the provider.");
    } catch(error){notify(error instanceof Error?error.message:"The secure message could not be sent.");}
    finally{setRequestBusy(false);}
  };

  const sendChatMessage = async (event:import("react").FormEvent<HTMLFormElement>) => {
    event.preventDefault();const client=supabase,active=conversationList.find(c=>c.id===activeConversationId),draft=message.trim();
    if(!client||!authUserId||!active||!draft)return;
    if(!active.partnerUserId){notify("The other party's account could not be identified.");return;}
    setRequestBusy(true);
    try {
      const encrypted=await encryptMessage(client,authUserId,active.partnerUserId,draft);
      const {error}=await client.from("messages").insert({conversation_id:active.id,sender_user_id:authUserId,body:null,ciphertext:encrypted.ciphertext,iv:encrypted.iv});
      if(error)throw new Error(error.message);setMessage("");notify("Encrypted message sent.");
    } catch(error){notify(error instanceof Error?error.message:"The secure message could not be sent.");}
    finally{setRequestBusy(false);}
  };
  const publicNav = [
    ["/", t.home],
    ["/caregivers", t.caregivers],
    ["/care-homes", t.homes],
    ["/how-it-works", t.how],
    ["/safety", t.safety],
  ];
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="nav-inner">
          <Link to="/" className="brand">
            <span className="brand-mark">
              <HeartHandshake size={23} />
            </span>
            <span>
              Aashraya<span className="brand-connect">Care</span>
              <small>Care, closer to home</small>
            </span>
          </Link>
          <nav className="desktop-nav">
            {publicNav.map(([p, label]) => (
              <NavLink
                key={p}
                to={p}
                end={p === "/"}
                className={({ isActive }) =>
                  isActive ? "nav-link active" : "nav-link"
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="top-actions">
            <button
              className="icon-button language"
              onClick={() => setLang(lang === "en" ? "ne" : "en")}
              aria-label="Change language"
            >
              <Languages size={17} />
              <span>{lang === "en" ? "नेपाली" : "English"}</span>
            </button>
            <button
              className="icon-button theme-toggle"
              aria-label="Change theme"
              onClick={() =>
                setTheme(
                  theme === "light"
                    ? "dark"
                    : theme === "dark"
                      ? "system"
                      : "light",
                )
              }
            >
              {theme === "dark" ? (
                <Moon size={17} />
              ) : theme === "light" ? (
                <Sun size={17} />
              ) : (
                <Sparkles size={17} />
              )}
            </button>
            {signedIn ? (
              <button
                className="avatar-btn"
                onClick={() => go("/profile")}
                aria-label="Edit profile"
                title="Edit profile"
              >
                {profileInitials}
              </button>
            ) : (
              <button
                className="text-button signin"
                onClick={() => openAuth("signin")}
              >
                {t.signIn}
              </button>
            )}
            {!signedIn && (
              <button
                className="button button-primary header-cta"
                onClick={() => openAuth("signup")}
              >
                {t.getStarted}
                <ArrowRight size={16} />
              </button>
            )}
            <button
              className="icon-button mobile-menu"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <nav className="mobile-nav" aria-label="Mobile navigation">
            {publicNav.map(([p, label]) => (
              <Link key={p} to={p} onClick={() => setMobileOpen(false)}>
                {label}
                <ChevronRight size={16} />
              </Link>
            ))}
            {signedIn ? (
              <>
                <Link to="/profile" onClick={() => setMobileOpen(false)}>
                  Edit profile
                  <ChevronRight size={16} />
                </Link>
                <Link
                  to={role === "admin" ? "/admin" : role === "caregiver" ? "/caregiver" : role === "facility" ? "/facility" : "/app"}
                  onClick={() => setMobileOpen(false)}
                >
                  My dashboard
                  <ChevronRight size={16} />
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    void signOut();
                  }}
                >
                  <span>Sign out</span>
                  <LogOut size={16} />
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => { setMobileOpen(false); openAuth("signin"); }}>{t.signIn}</button>
                <button type="button" onClick={() => { setMobileOpen(false); openAuth("signup"); }}>
                  Create an account
                  <ArrowRight size={16} />
                </button>
              </>
            )}
          </nav>
        )}
      </header>
      {routeNeedsAuth && !routeAuthorized && !authLoading && (
        <main className="page-container info-page">
          <div className="info-hero">
            <span className="eyebrow">RESTRICTED AREA</span>
            <h1>
              {authLoading
                ? "Checking your access…"
                : !signedIn
                  ? "Please sign in to continue"
                  : "You do not have permission to view this page."}
            </h1>
            <p>
              {authLoading
                ? "We are verifying your session and assigned permissions."
                : !signedIn
                  ? "This page requires an authenticated account. Workspace access is granted by the role assigned to your account."
                  : "Your account is authenticated, but it does not have the role required for this page. If you believe this is an error, contact an administrator."}
            </p>
          </div>
          <div className="info-action">
            <div>
              <h2>{!signedIn ? "Sign in required" : "Access restricted"}</h2>
              <p>
                {isCaregiverDetail
                  ? "Caregiver profiles are visible only to signed-in users."
                  : isCareHomeDetail
                    ? "Care-home details are visible only to signed-in users."
                    : requiredRole === "admin"
                      ? "Only accounts with the assigned admin role can access operations pages."
                      : requiredRole === "caregiver"
                        ? "Only the signed-in caregiver account with the caregiver role can access this workspace."
                        : requiredRole === "facility_manager"
                          ? "Only the assigned facility manager account can access this workspace."
                          : "This workspace requires an assigned family role."}
              </p>
            </div>
            {!signedIn && !authLoading ? (
              <button
                className="button button-primary"
                onClick={() => openAuth("signin")}
              >
                Sign in <LogIn size={16} />
              </button>
            ) : (
              <button
                className="button button-secondary"
                onClick={() => go("/")}
              >
                Return home <ArrowRight size={16} />
              </button>
            )}
          </div>
        </main>
      )}
      {isWorkspace && routeAuthorized && (
        <div className="workspace-shell">
          <aside className="sidebar">
            <div className="workspace-label">
              <span className="eyebrow">WORKSPACE</span>
              <span className="role-switch">
                {workspaceRole === "family"
                  ? "Family space"
                  : workspaceRole === "caregiver"
                    ? "Caregiver space"
                    : workspaceRole === "facility"
                      ? "Facility space"
                      : "Operations"}
                <ShieldCheck size={14} />
              </span>
            </div>
            <div className="sidebar-links">
              {(workspaceRole === "family"
                ? [
                    ["/app", LayoutDashboard, "Overview"],
                    ["/caregivers", Search, "Find care"],
                    ["/app/requests", ClipboardList, "Requests & bookings"],
                    ["/app/recipients", Users, "Care recipients"],
                    ["/app/enquiries", House, "Care-home enquiries"],
                    ["/app/messages", MessageCircle, "Messages"],
                    ["/app/profile", UserRound, "My profile"],
                  ]
                : workspaceRole === "caregiver"
                  ? [
                      ["/caregiver", LayoutDashboard, "Overview"],
                      ["/caregiver/requests", ClipboardList, "Requests"],
                      ["/caregiver/schedule", CalendarDays, "Schedule"],
                      ["/caregiver/profile", UserRound, "Services & rates"],
                      ["/caregiver/messages", MessageCircle, "Messages"],
                      ["/profile", UserRound, "My profile"],
                    ]
                  : workspaceRole === "facility"
                    ? [
                        ["/facility", LayoutDashboard, "Overview"],
                        ["/facility/listing", House, "Facility listing"],
                        ["/facility/requests", ClipboardList, "Care requests"],
                        ["/facility/messages", MessageCircle, "Messages"],
                        ["/facility/enquiries", MessageCircle, "Enquiries"],
                      ]
                    : [
                        ["/admin", LayoutDashboard, "Operations overview"],
                        [
                          "/admin/verifications",
                          FileCheck2,
                          "Verification queue",
                        ],
                        ["/admin/incidents", Shield, "Safety incidents"],
                        ["/admin/support", HelpCircle, "Support cases"],
                        ["/profile", UserRound, "My profile"],                      ]
              ).map(([p, Icon, label]: any) => (
                <NavLink
                  to={p}
                  key={p}
                  end={
                    p === "/app" ||
                    p === "/caregiver" ||
                    p === "/facility" ||
                    p === "/admin"
                  }
                  className={({ isActive }) =>
                    isActive ? "side-link selected" : "side-link"
                  }
                >
                  <Icon size={18} />
                  {label}
                </NavLink>
              ))}
            </div>
            <div className="sidebar-bottom">
              <div className="help-mini">
                <span className="help-icon">
                  <ShieldCheck size={18} />
                </span>
                <b>Need a hand?</b>
                <p>Our support team can help you understand the next step.</p>
                <button onClick={() => setModal("incident")}>
                  Get support <ArrowUpRight size={14} />
                </button>
              </div>
              <button className="side-link" onClick={signOut}>
                <LogOut size={18} />
                Sign out
              </button>
            </div>
          </aside>
          <main className="workspace-main">{renderWorkspace()}</main>
        </div>
      )}
      {!isWorkspace && routeAuthorized && (
        <>
          {path === "/" && (
            <HomePage
              t={t}
              caregivers={caregivers}
              onFind={() => go("/caregivers")}
              onHomes={() => go("/care-homes")}
              onSafety={() => go("/safety")}
              onHow={() => go("/how-it-works")}
              onRequest={requestCare}
              saved={saved}
              toggleSaved={(id) =>
                setSaved((s) =>
                  s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
                )
              }
              onProfile={(c) => {
                setSelected(c);
                go("/caregivers/" + c.id);
              }}
            />
          )}
          {path === "/caregivers" && (
            <CaregiverDirectory
              list={filtered}
              loading={caregiversLoading}
              loadError={caregiversError}
              searchText={searchText}
              setSearchText={setSearchText}
              serviceFilter={serviceFilter}
              setServiceFilter={setServiceFilter}
              sort={sort}
              setSort={setSort}
              saved={saved}
              toggleSaved={(id) =>
                setSaved((s) =>
                  s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
                )
              }
              onRequest={requestCare}
              onProfile={(c) => {
                setSelected(c);
                go("/caregivers/" + c.id);
              }}
            />
          )}
          {path.startsWith("/caregivers/") && (
            <CaregiverProfile
              caregiver={
                caregivers.find((c) => String(c.id) === path.split("/")[2]) ||
                caregivers[0]
              }
              onRequest={requestCare}
              onBack={() => go("/caregivers")}
              saved={saved}
              toggleSaved={(id) =>
                setSaved((s) =>
                  s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
                )
              }
            />
          )}
          {path === "/care-homes" && (
            <CareHomeDirectory facilities={facilityListings} onOpen={(f: FacilityListing) => { setSelected(f); go("/care-homes/" + f.id); }} />
          )}
          {path.startsWith("/care-homes/") && (
            <FacilityDetail
              facility={facilityListings.find((f) => path.endsWith(f.id) || path.includes(f.name.toLowerCase().replaceAll(" ", "-"))) || facilityListings[0]}
              onBack={() => go("/care-homes")}
              onRequest={(f: FacilityListing) => requestCare(f)}
              onEnquire={(f: FacilityListing) => { setSelected(f); setModal("enquiry"); }}
            />
          )}
          {path === "/how-it-works" && (
            <InfoPage type="how" onAction={() => go("/caregivers")} />
          )}
          {path === "/safety" && (
            <InfoPage type="safety" onAction={() => setModal("incident")} />
          )}
          {path === "/help" && (
            <InfoPage type="help" onAction={() => setModal("incident")} />
          )}
          {path === "/apply/caregiver" && (
            <ProviderApplication type="caregiver" onNotify={notify} />
          )}
          {path === "/apply/care-home" && (
            <ProviderApplication type="care_home" onNotify={notify} />
          )}
        </>
      )}
      {!isWorkspace && (!routeNeedsAuth || routeAuthorized) && (
        <footer className="footer">
          <div className="footer-top">
            <div className="footer-brand">
              <Link to="/" className="brand">
                <span className="brand-mark">
                  <HeartHandshake size={22} />
                </span>
                <span>
                  Aashraya<span className="brand-connect">Care</span>
                  <small>Care, closer to home</small>
                </span>
              </Link>
              <p>Thoughtful care starts with clear choices.</p>
            </div>
            <div>
              <b>Explore</b>
              <Link to="/caregivers">Find caregivers</Link>
              <Link to="/care-homes">Care homes</Link>
              <Link to="/how-it-works">How it works</Link>
            </div>
            <div>
              <b>Offer care</b>
              <Link to="/apply/caregiver">Become a caregiver</Link>
              <Link to="/apply/care-home">List a care home</Link>
            </div>
            <div>
              <b>Trust & support</b>
              <Link to="/safety">Safety & trust</Link>
              <Link to="/help">Help centre</Link>
              <button onClick={() => setModal("incident")}>
                Report a concern
              </button>
            </div>
            <div className="footer-note">
              <ShieldCheck size={20} />
              <b>Clear by design</b>
              <p>
                Verification tells you what was checked. It does not guarantee
                safety.
              </p>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2026 AashrayaCare · Kathmandu Valley, Nepal</span>
            <span>English · नेपाली</span>
            <span>Privacy · Terms</span>
          </div>
        </footer>
      )}
      <SupportChatbot />
      {modal && (
        <Modal
          title={
            modal === "signin"
              ? authMode === "signup"
                ? "Create your AashrayaCare account"
                : authMode === "forgot"
                  ? "Reset your password"
                  : authMode === "reset"
                    ? "Choose a new password"
                    : "Welcome to AashrayaCare"
              : modal === "request"
                ? "Request care"
                : modal === "enquiry"
                  ? "Enquire about this facility"
                  : "Report a concern"
          }
          onClose={() => setModal(null)}
        >
          {modal === "signin" ? (
            <div className="modal-form">
              {authMode === "forgot" ? (
                <>
                  <p className="muted">
                    Enter the email address associated with your account. If it
                    exists, we’ll send a secure password-reset link.
                  </p>
                  <label>
                    Email address
                    <input
                      type="email"
                      autoComplete="email"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </label>
                  <button
                    className="button button-primary full"
                    disabled={!supabase || authBusy}
                    onClick={sendPasswordReset}
                  >
                    {authBusy
                      ? "Sending reset link…"
                      : "Send password-reset link"}{" "}
                    <ArrowRight size={16} />
                  </button>
                  <p className="auth-switch">
                    <button type="button" onClick={() => setAuthMode("signin")}>
                      Back to sign in
                    </button>
                  </p>
                </>
              ) : authMode === "reset" ? (
                <>
                  <p className="muted">
                    Choose a new password for your AashrayaCare account.
                  </p>
                  <label>
                    New password
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="At least 8 characters"
                    />
                  </label>
                  <label>
                    Confirm new password
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={authConfirmPassword}
                      onChange={(e) => setAuthConfirmPassword(e.target.value)}
                      placeholder="Re-enter your password"
                    />
                  </label>
                  <button
                    className="button button-primary full"
                    disabled={!supabase || authBusy}
                    onClick={updatePassword}
                  >
                    {authBusy ? "Updating password…" : "Save new password"}{" "}
                    <ArrowRight size={16} />
                  </button>
                </>
              ) : (
                <>
                  <p className="muted">
                    {authMode === "signup"
                      ? "Create a regular account to explore care options. No caregiver or care-home verification is required unless you separately apply for one of those roles."
                      : "Sign in with your account. Workspace access is determined by roles assigned in the database; you cannot select or grant yourself a role."}
                  </p>
                  {authMode === "signup" && (
                    <div className="signup-account-types" role="group" aria-label="How would you like to use AashrayaCare?">
                      <span className="form-label-title">I want to…</span>
                      {([
                        ["family", "Find care", "I’m looking for care for myself or someone I support."],
                        ["caregiver", "Offer care", "I’m an individual caregiver applying to list my services."],
                        ["care_home", "List a care home", "I represent a care home or care facility."],
                      ] as const).map(([value, title, description]) => (
                        <button
                          key={value}
                          type="button"
                          className={signupAccountType === value ? "signup-type-card selected" : "signup-type-card"}
                          aria-pressed={signupAccountType === value}
                          onClick={() => setSignupAccountType(value)}
                        >
                          <strong>{title}</strong>
                          <span>{description}</span>
                        </button>
                      ))}
                      {signupAccountType !== "family" && (
                        <p className="inline-note"><ShieldCheck size={16} /> You’ll create a normal account first, then submit an application. This selection does not grant provider access or publish a listing.</p>
                      )}
                    </div>
                  )}
                  {authMode === "signup" && (
                    <label>
                      Full name
                      <input
                        type="text"
                        autoComplete="name"
                        value={authFullName}
                        onChange={(e) => setAuthFullName(e.target.value)}
                        placeholder="Your full name"
                      />
                    </label>
                  )}
                  <label>
                    Email address
                    <input
                      type="email"
                      autoComplete="email"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </label>
                  <label>
                    Password
                    <input
                      type="password"
                      autoComplete={
                        authMode === "signup"
                          ? "new-password"
                          : "current-password"
                      }
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder={
                        authMode === "signup"
                          ? "At least 8 characters"
                          : "Your password"
                      }
                    />
                  </label>
                  {authMode === "signup" && (
                    <label>
                      Confirm password
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={authConfirmPassword}
                        onChange={(e) => setAuthConfirmPassword(e.target.value)}
                        placeholder="Re-enter your password"
                      />
                    </label>
                  )}
                  {!supabase && (
                    <div className="alert-note">
                      <LockKeyhole size={18} />
                      <span>
                        Authentication is not configured. Set VITE_SUPABASE_URL
                        and VITE_SUPABASE_ANON_KEY (or
                        VITE_SUPABASE_PUBLISHABLE_KEY) in .env.local to enable
                        secure account access. Private workspaces remain locked.
                      </span>
                    </div>
                  )}
                  {authMode === "signin" && (
                    <div className="inline-note">
                      <LockKeyhole size={16} /> Admin access must be granted by
                      an authorized administrator. Caregiver and facility roles
                      require a separate application and review.
                    </div>
                  )}
                  <button
                    className="button button-primary full"
                    disabled={!supabase || authBusy}
                    onClick={authMode === "signup" ? signUp : signIn}
                  >
                    {authBusy
                      ? authMode === "signup"
                        ? "Creating account…"
                        : "Signing in…"
                      : authMode === "signup"
                        ? "Create account"
                        : "Sign in securely"}{" "}
                    <ArrowRight size={16} />
                  </button>
                  {authMode === "signin" && (
                    <div className="auth-help-links">
                      <button
                        type="button"
                        disabled={authBusy}
                        onClick={() => setAuthMode("forgot")}
                      >
                        Forgot password?
                      </button>
                      <button
                        type="button"
                        disabled={authBusy}
                        onClick={resendConfirmation}
                      >
                        Resend confirmation email
                      </button>
                    </div>
                  )}
                  <p className="auth-switch">
                    {authMode === "signup"
                      ? "Already have an account?"
                      : "New to AashrayaCare?"}{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode(
                          authMode === "signup" ? "signin" : "signup",
                        );
                        setAuthPassword("");
                        setAuthConfirmPassword("");
                      }}
                    >
                      {authMode === "signup" ? "Sign in" : "Create an account"}
                    </button>
                  </p>
                  <p className="fineprint">
                    New accounts start as regular users. Applying to become a
                    caregiver or list a care home is a separate process and may
                    require verification. If an email does not arrive, check
                    spam/junk and confirm the Supabase email settings.
                  </p>
                </>
              )}
            </div>
          ) : modal === "request" ? (
            <RequestWizard
              step={step}
              setStep={setStep}
              request={request}
              setRequest={setRequest}
              recipientOptions={recipients}
              caregiver={selected}
              providerType={selected && "managerUserId" in selected ? "facility" : "caregiver"}
              onSubmit={submitRequest}
              onClose={() => setModal(null)}
            />
          ) : modal === "enquiry" ? (
            <div className="modal-form">
              <p className="muted">
                Ask the facility about services, fees or arranging a visit. An
                enquiry does not guarantee admission.
              </p>
              <label>
                Your question
                <textarea
                  rows={4}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="I'd like to understand room options and monthly fees…"
                />
              </label>
              <label>
                Preferred contact
                <select>
                  <option>Phone call</option>
                  <option>Message</option>
                  <option>Email</option>
                </select>
              </label>
              <button
                className="button button-primary full"
                onClick={() => {
                  setFacilityEnquiries((e) => [
                    `${(selected as any)?.name || "Facility"} · Enquiry sent`,
                    ...e,
                  ]);
                  setModal(null);
                  setQuery("");
                  notify(
                    "This enquiry could not be sent because live enquiry submission is not configured.",
                  );
                }}
              >
                Send enquiry <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <div className="modal-form">
              <div className="alert-note">
                <AlertTriangle size={18} />
                <span>
                  If anyone is in immediate danger, contact local emergency
                  services. AashrayaCare is not an emergency response service.
                </span>
              </div>
              <label>
                What is this about?
                <select
                  value={incidentType}
                  onChange={(e) => setIncidentType(e.target.value)}
                >
                  <option>Safety concern</option>
                  <option>Booking or care issue</option>
                  <option>Payment dispute</option>
                  <option>General support</option>
                </select>
              </label>
              <label>
                Tell us what happened
                <textarea
                  rows={4}
                  value={incidentText}
                  onChange={(e) => setIncidentText(e.target.value)}
                  placeholder="Share only the details needed for us to understand the concern."
                />
              </label>
              <button
                className="button button-primary full"
                onClick={() => {
                  setModal(null);
                  setIncidentText("");
                  notify(
                    "Incident reporting is not available right now because the secure reporting service is not configured.",
                  );
                }}
              >
                Submit report <ArrowRight size={16} />
              </button>
              <p className="fineprint">
                In production, incident details are restricted to authorized
                staff and assigned responders.
              </p>
            </div>
          )}
        </Modal>
      )}
      {clarificationFor && <Modal title="Ask the family for details" onClose={()=>setClarificationFor(null)}><div className="modal-form"><p className="muted">Your question is encrypted on this device before it is saved.</p><label>Question<textarea id="clarification-message" rows={4} maxLength={1500}/></label><button className="button button-primary full" disabled={requestBusy} onClick={()=>void(async()=>{const msg=(document.getElementById("clarification-message") as HTMLTextAreaElement|null)?.value.trim()||"";const item=requests.find(x=>x.id===clarificationFor);const client=supabase;if(!msg||!item||!client||!authUserId){notify("Enter a question before sending.");return;}setRequestBusy(true);try{const encrypted=await encryptMessage(client,authUserId,item.familyUserId,msg);const {error}=await client.from("care_request_messages").insert({request_id:item.id,sender_user_id:authUserId,message:null,ciphertext:encrypted.ciphertext,iv:encrypted.iv});if(error)throw new Error(error.message);if(item.status==="pending response"){const {error:statusError}=await client.from("care_requests").update({status:"clarification_requested"}).eq("id",item.id).eq("status","pending_response");if(statusError)throw new Error(statusError.message);}setRequests(xs=>xs.map(x=>x.id===item.id?{...x,status:"clarification requested"}:x));setRequestMessages(xs=>({...xs,[item.id]:[...(xs[item.id]||[]),{message:msg,sender_user_id:authUserId,created_at:new Date().toISOString(),encrypted:true}]}));setClarificationFor(null);notify("Encrypted question sent to the family.");}catch(error){notify(error instanceof Error?error.message:"The question could not be sent securely.");}finally{setRequestBusy(false);}})()}>Send question <Send size={16}/></button></div></Modal>}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
          <button onClick={() => setToast("")} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
  function renderWorkspace() {
    if (path === "/profile" || path === "/app/profile") {
      return (
        <>
          <PageHeader
            eyebrow="ACCOUNT SETTINGS"
            title="My profile"
            subtitle="View and update the personal information associated with your AashrayaCare account."
          />
          <section className="panel" style={{ maxWidth: 760, padding: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
              <div className="avatar-btn" style={{ width: 64, height: 64, minWidth: 64, fontSize: 20, display: "grid", placeItems: "center" }} aria-hidden="true">{profileInitials}</div>
              <div>
                <h2 style={{ margin: 0 }}>{displayName || "Your profile"}</h2>
                <p className="muted" style={{ margin: "4px 0 0" }}>{userRoles.includes("admin") ? "Administrator account" : userRoles.includes("caregiver") ? "Caregiver account" : userRoles.includes("facility_manager") ? "Care facility account" : "Family account"}</p>
              </div>
            </div>
            <form style={{ display: "grid", gap: 18 }} onSubmit={(event) => { event.preventDefault(); void saveProfile(); }}>
              <label style={{ display: "grid", gap: 7, fontWeight: 600 }}>
                <span>Full name</span>
                <input style={{ width: "100%", padding: "12px 14px", border: "1px solid var(--border, #d5ddd8)", borderRadius: 10, font: "inherit", boxSizing: "border-box" }} value={profileName} onChange={(event) => setProfileName(event.target.value)} autoComplete="name" required maxLength={160} placeholder="Enter your full name" />
              </label>
              <label className="form-field">
                <span>Email address</span>
                <input style={{ width: "100%", padding: "12px 14px", border: "1px solid var(--border, #d5ddd8)", borderRadius: 10, font: "inherit", boxSizing: "border-box" }} type="email" value={profileEmail} readOnly disabled />
                <small className="muted">Email changes require a separate email verification process.</small>
              </label>
              <label className="form-field">
                <span>Phone number</span>
                <input style={{ width: "100%", padding: "12px 14px", border: "1px solid var(--border, #d5ddd8)", borderRadius: 10, font: "inherit", boxSizing: "border-box" }} type="tel" value={profilePhone} onChange={(event) => setProfilePhone(event.target.value)} autoComplete="tel" maxLength={30} placeholder="Add a contact number (optional)" />
              </label>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <button className="button button-primary" type="submit" disabled={profileSaving}>
                  {profileSaving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </section>
          {path === "/caregiver/profile" && userRoles.includes("caregiver") && (
            <section className="panel caregiver-self-service" style={{ maxWidth: 760, padding: 28, marginTop: 20 }}>
              <PageHeader
                eyebrow="LISTING CONTROLS"
                title="Your public availability"
                subtitle="Manage requests and directory visibility yourself. These preferences do not change your approval status."
              />
              {caregiverStatusLoading ? (
                <p className="muted">Loading your caregiver listing status…</p>
              ) : !ownCaregiverStatus ? (
                <p className="muted">No caregiver profile was found for this account. If you recently applied, check your application status.</p>
              ) : (
                <>
                  <div className="caregiver-status-summary">
                    <span>Verification status</span>
                    <strong>{ownCaregiverStatus.verificationStatus.replace(/_/g, " ")}</strong>
                    <span>Directory listing</span>
                    <strong>{ownCaregiverStatus.isPublished ? "Visible to families" : "Hidden from families"}</strong>
                    <span>Requests</span>
                    <strong>{ownCaregiverStatus.acceptingRequests ? "Accepting requests" : "Not accepting requests"}</strong>
                  </div>
                  {ownCaregiverStatus.verificationStatus === "approved" ? (
                    <div className="caregiver-self-service-actions">
                      <button
                        className="button button-secondary"
                        type="button"
                        disabled={caregiverStatusSaving}
                        onClick={() => void updateOwnCaregiverStatus({ acceptingRequests: !ownCaregiverStatus.acceptingRequests })}
                      >
                        {ownCaregiverStatus.acceptingRequests ? "Pause new requests" : "Start accepting requests"}
                      </button>
                      <button
                        className="button button-primary"
                        type="button"
                        disabled={caregiverStatusSaving}
                        onClick={() => void updateOwnCaregiverStatus({ isPublished: !ownCaregiverStatus.isPublished })}
                      >
                        {ownCaregiverStatus.isPublished ? "Hide from listing page" : "List my profile again"}
                      </button>
                    </div>
                  ) : (
                    <p className="muted">Self-service availability controls become available after an administrator approves your profile. Changing these preferences later will not require another approval.</p>
                  )}
                  <p className="muted caregiver-status-note">Hiding your profile removes it from the public directory but does not revoke admin approval. You can list it again whenever you are ready.</p>
                </>
              )}
            </section>
          )}
        </>
      );
    }
    if (path === "/app/requests/new") {
      return (
        <RequestWizardPage
          recipients={recipients}
          request={request}
          setRequest={setRequest}
          onSubmit={submitRequest}
          onBack={() => go("/app")}
        />
      );
    }
    if (path === "/app/requests") {
      const visible = requests.filter(
        (r) =>
          activeTab === "All" ||
          (activeTab === "Requests" && r.status !== "confirmed") ||
          (activeTab === "Upcoming" && r.status === "confirmed") ||
          (activeTab === "Past" && r.status === "completed") ||
          (activeTab === "Cancelled" && r.status === "cancelled"),
      );
      return (
        <>
          <PageHeader
            eyebrow="YOUR CARE"
            title="Requests & bookings"
            subtitle="Follow every request from first response to completed care."
            action={
              <button
                className="button button-primary"
                onClick={() => go("/app/requests/new")}
              >
                <span>+</span> New request
              </button>
            }
          />
          <div className="tabs">
            {["All", "Requests", "Upcoming", "Past", "Cancelled"].map((tab) => (
              <button
                key={tab}
                className={activeTab === tab ? "tab active" : "tab"}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="request-list">
            {visible.map((r) => (
              <div className="request-row" key={r.ref}>
                <div className="request-icon">
                  <ClipboardList size={20} />
                </div>
                <div className="request-info">
                  <span className="eyebrow">{r.ref}</span>
                  <h3>{r.name}</h3>
                  <p>{r.service}</p>
                  {requestMessages[r.id]?.map((entry,index)=><div className="inline-note" key={entry.created_at+index}><MessageCircle size={15}/>{entry.sender_user_id===authUserId?" You: ":r.providerType==="facility"?" Facility: ":" Caregiver: "}{entry.message}{!entry.encrypted&&<small> · legacy message</small>}</div>)}
                  {(r.status === "clarification requested" || r.status === "accepted pending terms" || r.status === "confirmed") && <div className="request-reply"><label htmlFor={"reply-"+r.id}>Reply to {r.providerType === "facility" ? "facility" : "caregiver"}</label><textarea id={"reply-"+r.id} rows={2} maxLength={1500} value={replyDrafts[r.id]||""} onChange={(event)=>setReplyDrafts(current=>({...current,[r.id]:event.target.value}))} placeholder="Write a reply…"/><button className="button button-secondary small" disabled={requestBusy||!(replyDrafts[r.id]||"").trim()} onClick={()=>void sendRequestMessage(r)}>Send encrypted reply <Send size={14}/></button></div>}
                  <div className="request-meta">
                    <span>
                      <CalendarDays size={14} />
                      {r.date}
                    </span>
                    <span>
                      <MapPin size={14} />
                      {r.area}
                    </span>
                  </div>
                </div>
                <div className="request-side">
                  <StatusPill status={r.status} />
                  <strong>{formatNPR(r.amount)}</strong>
                  <span className="muted tiny">Estimate · not a payment</span>
                  {r.status === "accepted pending terms" && <button className="button button-primary small" disabled={requestBusy} onClick={()=>void confirmCareRequest(r)}>Confirm booking <CheckCircle2 size={14}/></button>}
                  <button className="text-link" onClick={() => { const chat = conversationList.find((conversation) => conversation.requestId === r.id); if (chat) { setActiveConversationId(chat.id); go("/app/messages"); } else notify("Messaging opens once the provider accepts this request."); }}>
                    {["accepted pending terms","confirmed","completed"].includes(r.status) ? "Open conversation" : "View request"} <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {visible.length === 0 && (
            <EmptyState
              icon={<CalendarDays />}
              title="Nothing here just yet"
              text="Requests and bookings will appear here as you move through the care process."
              action="Find care"
              onClick={() => go("/caregivers")}
            />
          )}
          <div className="inline-note wide">
            <ShieldCheck size={17} /> A caregiver accepting your request does
            not automatically confirm a booking. Review any changed terms first.
          </div>
        </>
      );
    }
    if (path === "/app/recipients") {
      return (
        <>
          <PageHeader
            eyebrow="FAMILY DETAILS"
            title="Care recipients"
            subtitle="Manage the people you coordinate care for."
            action={
              <button
                className="button button-primary"
                onClick={() =>
                  document.getElementById("add-recipient")?.focus()
                }
              >
                + Add recipient
              </button>
            }
          />
          <div className="recipient-grid">
            {recipients.map((r, i) => (
              <div className="recipient-card" key={r}>
                <div className="recipient-avatar">
                  {(r.split(" ")[0] || "M").slice(0, 1)}
                </div>
                <div>
                  <h3>{r.split(" · ")[0]}</h3>
                  <p className="muted">
                    {r.split(" · ")[1] || "Care recipient"}
                  </p>
                  <span className="soft-chip">Care preferences saved</span>
                </div>
                <button
                  className="icon-button"
                  aria-label="Edit recipient"
                  onClick={() =>
                    notify(
                      "Recipient editing can be connected to the family profile API.",
                    )
                  }
                >
                  <MoreHorizontal />
                </button>
              </div>
            ))}
          </div>
          <div className="form-panel narrow">
            <h3>Add a recipient</h3>
            <p className="muted">
              Only add information you are authorized to share. Sensitive notes
              are not shown in public profiles.
            </p>
            <label htmlFor="add-recipient">Preferred name</label>
            <input
              id="add-recipient"
              value={newRecipient}
              onChange={(e) => setNewRecipient(e.target.value)}
              placeholder="e.g. Dad"
            />
            <label>Relationship</label>
            <select>
              <option>Parent</option>
              <option>Partner</option>
              <option>Relative</option>
              <option>Other / authorized coordinator</option>
            </select>
            <label className="check-label">
              <input type="checkbox" /> I have permission to submit this
              person's information.
            </label>
            <button
              className="button button-primary"
              disabled={requestBusy}
              onClick={async()=>{
                if(!supabase||!authUserId||!userRoles.includes("family")){notify("Sign in with a family account.");return;}
                if(!newRecipient.trim()){notify("Enter a preferred name.");return;}
                setRequestBusy(true);
                const {data,error}=await supabase.from("family_care_recipients").insert({family_user_id:authUserId,full_name:newRecipient.trim(),relationship:"Recipient"}).select("full_name,relationship").single();
                setRequestBusy(false);if(error||!data){notify("Recipient wasn't saved: "+(error?.message||"Try again."));return;}
                setRecipients(xs=>[...xs,`${data.full_name} · ${data.relationship}`]);setRequest(x=>({...x,recipient:data.full_name}));setNewRecipient("");notify("Care recipient saved to your family account.");
              }}
            >
              Save recipient <Check size={16} />
            </button>
          </div>
        </>
      );
    }
    if (path === "/app/messages" || path === "/caregiver/messages" || path === "/facility/messages") {
      const activeConversation = conversationList.find((conversation) => conversation.id === activeConversationId) || null;
      return <>
        <PageHeader eyebrow="COMMUNICATION" title="Messages" subtitle="Real conversations linked to care requests accepted by the provider."/>
        <div className="messages-layout">
          <aside className="conversation-list">
            {conversationLoading&&conversationList.length===0&&<p className="muted" style={{padding:16}}>Loading conversations…</p>}
            {conversationList.map((conversation)=><button key={conversation.id} className={conversation.id===activeConversationId?"conversation active":"conversation"} onClick={()=>setActiveConversationId(conversation.id)}>
              <div className="mini-avatar blue">{conversation.name.split(/\s+/).slice(0,2).map((word)=>word[0]||"").join("").toUpperCase()}</div>
              <span><b>{conversation.name}</b><small>{conversation.ref} · {conversation.service}</small><small className="muted">{conversation.status}</small></span>
            </button>)}
            {!conversationLoading&&conversationList.length===0&&<div className="empty-inline" style={{padding:18}}>No conversations yet. Chats appear after a caregiver or facility accepts a care request.</div>}
          </aside>
          {activeConversation ? <section className="chat-panel">
            <div className="chat-head"><div className="mini-avatar blue">{activeConversation.name.split(/\s+/).slice(0,2).map((word)=>word[0]||"").join("").toUpperCase()}</div><div><b>{activeConversation.name}</b><small><span className="online-dot"/> {activeConversation.ref} · {activeConversation.status}</small></div><button className="button button-secondary small" onClick={()=>go(userRoles.includes("family")?"/app/requests":userRoles.includes("facility_manager")?"/facility/requests":"/caregiver/requests")}>View request</button></div>
            <div className="chat-context"><CalendarDays size={16}/><span><b>{activeConversation.service}</b><small>{activeConversation.date} · {formatNPR(activeConversation.amount)} indicative</small></span>{userRoles.includes("family")&&activeConversation.status==="accepted pending terms"&&<button onClick={()=>{const item=requests.find((row)=>row.id===activeConversation.requestId);if(item)void confirmCareRequest(item);else notify("Open Requests & bookings to confirm this request.");}}>Confirm booking <ArrowRight size={13}/></button>}</div>
            <div className="chat-body">
              {conversationLoading&&conversationMessages.length===0&&<p className="muted">Loading messages…</p>}
              {conversationMessages.map((m)=><div className={m.sender_user_id===authUserId?"message-bubble sent":"message-bubble"} key={m.id}><small>{m.sender_user_id===authUserId?"You":activeConversation.name} · {new Date(m.created_at).toLocaleString()}</small><p>{m.body}</p></div>)}
              {!conversationLoading&&conversationMessages.length===0&&<div className="empty-inline">Conversation opened. Discuss any changes to care, dates, availability or terms here.</div>}
            </div>
            <form className="chat-compose" onSubmit={sendChatMessage}><input value={message} onChange={(event)=>setMessage(event.target.value)} placeholder="Write a secure message…" aria-label="Write a message" maxLength={5000}/><button className="button button-primary" aria-label="Send message" disabled={requestBusy||!message.trim()}><Send size={17}/></button></form>
            <p className="fineprint">New messages are encrypted in this browser before storage. Your private key stays in this browser profile; clearing its site data or switching devices may make existing encrypted messages unreadable. Older pre-migration messages, if any, are marked as legacy.</p>
          </section> : <section className="chat-panel"><EmptyState icon={<MessageCircle/>} title="No conversation selected" text="A conversation will appear here after a provider accepts a request." action="View requests" onClick={()=>go(userRoles.includes("family")?"/app/requests":userRoles.includes("facility_manager")?"/facility/requests":"/caregiver/requests")}/></section>}
        </div>
      </>;
    }
    if (path === "/app/enquiries") {
      return (
        <>
          <PageHeader
            eyebrow="FACILITY DISCOVERY"
            title="Care-home enquiries"
            subtitle="Track your questions and any proposed visits."
            action={
              <button
                className="button button-secondary"
                onClick={() => go("/care-homes")}
              >
                Explore care homes
              </button>
            }
          />
          {facilityEnquiries.length ? (
            facilityEnquiries.map((e, i) => (
              <div className="request-row" key={i}>
                <div className="request-icon">
                  <House />
                </div>
                <div className="request-info">
                  <h3>{e.split(" · ")[0]}</h3>
                  <p>Facility information request</p>
                </div>
                <StatusPill status="Submitted" />
                <span className="muted">Awaiting follow-up</span>
              </div>
            ))
          ) : (
            <EmptyState
              icon={<House />}
              title="No enquiries yet"
              text="When you ask a care home a question, its status and next steps will show here."
              action="Explore care homes"
              onClick={() => go("/care-homes")}
            />
          )}
        </>
      );
    }
    if (path === "/caregiver/requests" || path === "/facility/requests") {
      const facilityWorkspace=path==="/facility/requests";
      return <>
        <PageHeader eyebrow={facilityWorkspace?"FACILITY SPACE":"CAREGIVER SPACE"} title={facilityWorkspace?"Incoming care requests":"Incoming requests"} subtitle={facilityWorkspace?"Review family requests for your facility and respond as its authorized manager.":"Review requested care and respond only when the details work for you."}/>
        <div className="notice-bar"><ShieldCheck size={18}/> Accepting a request opens a private encrypted conversation. A booking is confirmed only after the family reviews and confirms the requested terms.</div>
        {requests.map((r)=><div className="request-row" key={r.id}>
          <div className="request-icon">{facilityWorkspace?<House/>:<ClipboardList/>}</div>
          <div className="request-info"><span className="eyebrow">{r.ref}</span><h3>{r.recipient} · {r.service}</h3><p>{r.date}</p><p className="muted">Requested by a family · {r.area} · {r.tasks||"No additional task details provided."}</p>{r.notes&&<p>{r.notes}</p>}</div>
          <div className="request-side"><StatusPill status={r.status}/><strong>{formatNPR(r.amount)}{facilityWorkspace?" / month (indicative)":""}</strong>
            <div className="button-row">
              {["pending response","clarification requested"].includes(r.status)&&<button className="button button-secondary small" onClick={()=>setClarificationFor(r.id)} disabled={requestBusy}>Ask details</button>}
              {["pending response","clarification requested"].includes(r.status)&&<button className="button button-primary small" disabled={requestBusy} onClick={()=>void acceptCareRequest(r)}>Accept request</button>}
              {["accepted pending terms","confirmed","completed"].includes(r.status)&&<button className="button button-secondary small" onClick={()=>{const chat=conversationList.find((c)=>c.requestId===r.id);if(chat){setActiveConversationId(chat.id);go(facilityWorkspace?"/facility/messages":"/caregiver/messages");}else go(facilityWorkspace?"/facility/messages":"/caregiver/messages");}}>Open conversation <MessageCircle size={14}/></button>}
            </div>
            {r.status==="accepted pending terms"&&<p className="muted tiny">Accepted; waiting for the family to confirm.</p>}
            {r.status==="confirmed"&&<p className="muted tiny">Booking confirmed by the family.</p>}
          </div>
        </div>)}
        {requests.length===0&&<EmptyState icon={<ClipboardList/>} title="No incoming requests" text={facilityWorkspace?"Requests for your facility will appear here when families send them.":"New family requests will appear here when families request your services."} action="Open messages" onClick={()=>go(facilityWorkspace?"/facility/messages":"/caregiver/messages")}/>}
      </>;
    }
    if (path === "/caregiver/schedule") {
      return (
        <>
          <PageHeader
            eyebrow="YOUR WORK"
            title="Schedule"
            subtitle="A simple chronological view of upcoming visits."
          />
          <div className="notice-bar">
            <CalendarDays size={18} /> No live calendar sync in this prototype.
            Confirm times in each booking before travelling.
          </div>
          <div className="schedule-day">
            <span className="day-badge">
              FRI
              <br />
              <b>16</b>
            </span>
            <div className="schedule-line">
              <b>9:00 AM – 12:00 PM</b>
              <h3>Daily living support</h3>
              <p className="muted">Lalitpur · Request pending</p>
              <StatusPill status="Pending response" />
            </div>
          </div>
          <div className="empty-inline">
            Your confirmed visits will appear here.
          </div>
        </>
      );
    }
    if (path === "/caregiver/profile") {
      return (
        <>
          <PageHeader
            eyebrow="YOUR PUBLIC PROFILE"
            title="Services & rates"
            subtitle="Keep your service scope, pricing basis and availability clear."
          />
          <div className="form-panel narrow">
            <label>
              Profile headline
              <input defaultValue="Experienced home caregiver" />
            </label>
            <label>
              Services offered
              <select defaultValue="Daily living support">
                <option>Daily living support</option>
                <option>Companionship</option>
                <option>Mobility assistance</option>
                <option>Light household support</option>
                <option>Overnight care</option>
              </select>
            </label>
            <label>
              Hourly rate (NPR)
              <input type="number" defaultValue="700" min="0" />
            </label>
            <label>
              Service area
              <input defaultValue="Kathmandu Valley" />
            </label>
            <div className="inline-note">
              <FileCheck2 size={17} />
              Verification status: <b>{ownCaregiverStatus?.verificationStatus.replace(/_/g, " ") || (caregiverStatusLoading ? "Loading…" : "Status unavailable")}</b>.
              {ownCaregiverStatus?.verificationStatus === "approved"
                ? " Your profile is approved; listing and request availability can be changed below."
                : " Unapproved profiles are not published."}
            </div>
            <button
              className="button button-primary"
              onClick={() =>
                notify(
                  "Public profile editing is not connected yet. Your account information can be edited from My profile.",
                )
              }
            >
              Save profile
            </button>
          </div>
          <section className="panel caregiver-self-service" style={{ maxWidth: 760, padding: 28, marginTop: 20 }}>
            <PageHeader
              eyebrow="LISTING CONTROLS"
              title="Your public availability"
              subtitle="Change whether families can find your profile and whether you are accepting requests. These settings do not change your approval status."
            />
            {caregiverStatusLoading ? (
              <p className="muted">Loading your caregiver listing status…</p>
            ) : !ownCaregiverStatus ? (
              <p className="muted">We couldn't load your caregiver profile status. Refresh the page or contact support if this continues.</p>
            ) : (
              <>
                <div className="caregiver-status-summary">
                  <span>Verification status</span>
                  <strong>{ownCaregiverStatus.verificationStatus.replace(/_/g, " ")}</strong>
                  <span>Directory listing</span>
                  <strong>{ownCaregiverStatus.isPublished ? "Visible to families" : "Hidden from families"}</strong>
                  <span>Requests</span>
                  <strong>{ownCaregiverStatus.acceptingRequests ? "Accepting requests" : "Not accepting requests"}</strong>
                </div>
                {ownCaregiverStatus.verificationStatus === "approved" ? (
                  <div className="caregiver-self-service-actions">
                    <button
                      className="button button-secondary"
                      type="button"
                      disabled={caregiverStatusSaving}
                      onClick={() => void updateOwnCaregiverStatus({ acceptingRequests: !ownCaregiverStatus.acceptingRequests })}
                    >
                      {caregiverStatusSaving ? "Saving…" : ownCaregiverStatus.acceptingRequests ? "Not accepting requests" : "Start accepting requests"}
                    </button>
                    <button
                      className="button button-primary"
                      type="button"
                      disabled={caregiverStatusSaving}
                      onClick={() => void updateOwnCaregiverStatus({ isPublished: !ownCaregiverStatus.isPublished })}
                    >
                      {caregiverStatusSaving ? "Saving…" : ownCaregiverStatus.isPublished ? "Hide from listing page" : "List my profile again"}
                    </button>
                  </div>
                ) : (
                  <p className="muted">Self-service controls become available after an administrator approves your profile. Changing these preferences later will not require another approval.</p>
                )}
                <p className="muted caregiver-status-note">You keep your approved status when you hide your profile or pause requests. You can turn either setting back on yourself when you return.</p>
              </>
            )}
          </section>
        </>
      );
    }
    if (path === "/facility/listing") {
      return (
        <>
          <PageHeader
            eyebrow="FACILITY SPACE"
            title="Facility listing"
            subtitle="Review the public information families see."
          />
          <div className="form-panel narrow">
            <label>
              Facility name
              <input defaultValue="Himalayan Care Residence" />
            </label>
            <label>
              Services and amenities
              <textarea
                rows={3}
                defaultValue="24-hour assistance, shared rooms, garden"
              />
            </label>
            <label>
              Indicative monthly fees (NPR)
              <input defaultValue="38000" type="number" />
            </label>
            <div className="inline-note">
              <Clock3 size={17} /> Listing status: <b>Under review</b>. Only
              approved facilities can be published.
            </div>
            <button
              className="button button-primary"
              onClick={() =>
                notify(
                  "Draft saved locally. Evidence submission and approval require the backend.",
                )
              }
            >
              Save draft
            </button>
          </div>
        </>
      );
    }
    if (path === "/facility/enquiries") {
      return (
        <>
          <PageHeader
            eyebrow="FAMILY QUESTIONS"
            title="Enquiries"
            subtitle="Respond to questions and arrange visits where your team can confirm them."
          />
          <EmptyState
            icon={<MessageCircle />}
            title="No new enquiries"
            text="New family questions will appear here once your facility is published and the enquiry API is connected."
            action="Manage listing"
            onClick={() => go("/facility/listing")}
          />
        </>
      );
    }
    if (path === "/admin/verifications") {
      const pendingApplications = providerApplications.filter((application) => ["submitted", "under_review", "action_required"].includes(application.status));
      return (
        <>
          <PageHeader
            eyebrow="OPERATIONS"
            title="Provider application review"
            subtitle="Review caregiver and care-home submissions. Decisions are recorded in the database."
          />
          <div className="notice-bar">
            <LockKeyhole size={18} /> Applicant details are restricted to administrators. Approving an application through the admin-only database function assigns the appropriate provider workspace role and creates an unpublished draft profile. A separate verification and publication decision is still required before families can see the listing.
          </div>
          {providerApplicationsLoading ? (
            <div className="panel"><p>Loading provider applications…</p></div>
          ) : providerApplications.length === 0 ? (
            <EmptyState
              icon={<FileCheck2 />}
              title="No provider applications yet"
              text="New caregiver and care-home applications will appear here after the provider-applications database migration has been applied."
              action="Refresh queue"
              onClick={() => {
                setProviderApplicationsLoading(true);
                void supabase?.from("provider_applications").select("*").order("created_at", { ascending: false }).then(({ data, error }) => {
                  setProviderApplicationsLoading(false);
                  if (error) notify("Could not refresh the review queue.");
                  else setProviderApplications((data || []) as ProviderApplicationRecord[]);
                });
              }}
            />
          ) : (
            <div className="provider-review-list">
              {providerApplications.map((application) => (
                <article className="panel provider-review-card" key={application.id}>
                  <div className="provider-review-heading">
                    <div>
                      <span className="eyebrow">{application.application_type === "caregiver" ? "INDIVIDUAL CAREGIVER" : "CARE-HOME REPRESENTATIVE"}</span>
                      <h2>{application.application_type === "caregiver" ? application.applicant_name : application.facility_name}</h2>
                      <p className="muted">{application.contact_email} · {application.contact_phone}</p>
                    </div>
                    <StatusPill status={application.status.replaceAll("_", " ")} />
                  </div>
                  <div className="provider-review-details">
                    {application.application_type === "caregiver" ? (
                      <>
                        <p><b>Service area:</b> {application.service_area || "Not provided"}</p>
                        <p><b>Experience:</b> {application.years_experience ?? 0} years</p>
                        <p><b>Services:</b> {application.services?.join(", ") || "Not provided"}</p>
                        <p><b>Expected rate:</b> {application.rate_amount == null ? "Not provided" : formatNPR(Number(application.rate_amount)) + " / " + (application.rate_unit || "hour")}</p>
                      </>
                    ) : (
                      <>
                        <p><b>Facility type:</b> {application.facility_type || "Not provided"}</p>
                        <p><b>Address:</b> {application.facility_address || "Not provided"}</p>
                        <p><b>Services:</b> {application.facility_services?.join(", ") || "Not provided"}</p>
                        <p><b>Capacity:</b> {application.facility_capacity ?? "Not provided"} · <b>Monthly fee:</b> {application.monthly_fee == null ? "Not provided" : formatNPR(Number(application.monthly_fee))}</p>
                        <p><b>Registration / licence:</b> {application.registration_number || "Not provided"}</p>
                        {application.facility_description && <p><b>Description:</b> {application.facility_description}</p>}
                      </>
                    )}
                    {application.additional_notes && <p><b>Applicant notes:</b> {application.additional_notes}</p>}
                    <p className="muted tiny">Submitted {new Date(application.created_at).toLocaleString()} · ID {application.id}</p>
                  </div>
                  <label className="provider-review-notes">Review notes (required when requesting more information)
                    <textarea rows={2} value={providerApplicationNotes[application.id] ?? application.reviewer_notes ?? ""} onChange={(event) => setProviderApplicationNotes((current) => ({ ...current, [application.id]: event.target.value }))} placeholder="Record the reason or next steps for the applicant." />
                  </label>
                  <div className="button-row provider-review-actions">
                    <button className="button button-secondary small" disabled={!["submitted", "under_review", "action_required"].includes(application.status)} onClick={() => void reviewProviderApplication(application, "action_required")}>Request information</button>
                    <button className="button button-secondary small" disabled={!["submitted", "under_review", "action_required"].includes(application.status)} onClick={() => void reviewProviderApplication(application, "rejected")}>Reject</button>
                    <button className="button button-primary small" disabled={!["submitted", "under_review", "action_required"].includes(application.status)} onClick={() => void reviewProviderApplication(application, "approved")}>Approve application</button>
                  </div>
                  {application.status === "approved" && <p className="inline-note"><ShieldCheck size={16} /> Provider workspace access has been assigned. The listing remains unpublished until verification is complete.</p>}
                </article>
              ))}
            </div>
          )}
          {providerApplications.length > pendingApplications.length && <p className="muted tiny">{pendingApplications.length} application(s) still need a decision.</p>}
          <div className="panel" style={{ marginTop: 24 }}>
            <h2>Caregiver verification and publication</h2>
            <p className="muted">Only publish after reviewing the required identity and qualification evidence. Publishing marks the profile approved and makes it visible in the public directory.</p>
            {caregiverReviewProfilesLoading ? (
              <p>Loading unpublished caregiver profiles…</p>
            ) : caregiverReviewProfiles.length === 0 ? (
              <p className="muted">No unpublished caregiver profiles need verification.</p>
            ) : (
              <div className="provider-review-list">
                {caregiverReviewProfiles.map((profile) => {
                  const applicationApproved = providerApplications.some((application) =>
                    application.user_id === profile.user_id &&
                    application.application_type === "caregiver" &&
                    application.status === "approved"
                  );
                  return (
                    <article className="provider-review-card" key={profile.id}>
                      <div>
                        <h3>{profile.public_name}</h3>
                        <p className="muted">Verification status: {profile.verification_status.replaceAll("_", " ")} · Requests: {profile.accepting_requests ? "enabled" : "disabled"}</p>
                        <p className="tiny muted">Profile ID: {profile.id}</p>
                      </div>
                      <button
                        className="button button-primary small"
                        disabled={!applicationApproved || publishingCaregiverId === profile.id}
                        onClick={() => void publishCaregiverProfile(profile)}
                      >
                        {publishingCaregiverId === profile.id ? "Publishing…" : "Verify & publish"}
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </>
      );
    }
    if (path === "/admin/incidents") {
      return (
        <>
          <PageHeader
            eyebrow="RESTRICTED OPERATIONS"
            title="Safety incidents"
            subtitle="Incidents need a monitored owner, documented actions and an escalation path."
          />
          <div className="alert-note">
            <AlertTriangle size={18} /> Critical and high-severity reports must
            be monitored by a named responder before launch.
          </div>
          <EmptyState
            icon={<Shield />}
            title="No incident records"
            text="No incident reports are available for your account."
            action="Review safety guidance"
            onClick={() => go("/safety")}
          />
        </>
      );
    }
    if (path === "/admin/support") {
      return (
        <>
          <PageHeader
            eyebrow="OPERATIONS"
            title="Support cases"
            subtitle="Track ownership, status, private notes and user-facing replies."
          />
          <EmptyState
            icon={<HelpCircle />}
            title="No open support cases"
            text="Cases will appear when the support backend is connected."
            action="Open help centre"
            onClick={() => go("/help")}
          />
        </>
      );
    }
    if (path === "/admin") {
      return (
        <>
          <PageHeader
            eyebrow="OPERATIONS OVERVIEW"
            title="Good evening, operations team"
            subtitle="A concise view of the work that needs attention."
          />
          <div className="stats-grid">
            <Stat
              label="Caregiver reviews"
              value={String(caregivers.length).padStart(2, "0")}
              icon={<UserRound />}
              tone="sage"
              note="3 need more info"
            />
            <Stat
              label="Facility reviews"
              value={String(facilities.length).padStart(2, "0")}
              icon={<House />}
              tone="blue"
              note="1 updated today"
            />
            <Stat
              label="Open support cases"
              value={String(requests.length).padStart(2, "0")}
              icon={<HelpCircle />}
              tone="gold"
              note="2 unassigned"
            />
            <Stat
              label="Safety incidents"
              value="00"
              icon={<Shield />}
              tone="rose"
              note="Queue must be monitored"
            />
          </div>
          <div className="panel">
            <h3>Priority queue</h3>
            {[
              "Caregiver evidence review",
              "Facility listing approval",
              "Booking exception follow-up",
            ].map((x, i) => (
              <div className="priority-row" key={x}>
                <span className="priority-num">0{i + 1}</span>
                <span>
                  <b>{x}</b>
                  <small>
                    {
                      [
                        "Identity evidence awaiting review",
                        "Facility details need approval",
                        "Check request status history",
                      ][i]
                    }
                  </small>
                </span>
                <button
                  className="text-link"
                  onClick={() =>
                    go(i === 1 ? "/admin/verifications" : "/admin/support")
                  }
                >
                  Review <ArrowRight size={14} />
                </button>
              </div>
            ))}
          </div>
        </>
      );
    }
    if (path === "/caregiver") {
      return (
        <>
          <PageHeader
            eyebrow="CAREGIVER SPACE"
            title="Your care overview"
            subtitle="Manage requests, schedule and profile readiness."
            action={
              <button
                className="button button-primary"
                onClick={() => go("/caregiver/requests")}
              >
                View requests <ArrowRight size={16} />
              </button>
            }
          />
          <div className="notice-bar">
            <Clock3 size={18} />
            {ownCaregiverStatus ? (
              <>
                Verification: <b>{ownCaregiverStatus.verificationStatus.replace(/_/g, " ")}</b>
                {" · "}
                Listing: <b>{ownCaregiverStatus.isPublished ? "Visible to families" : "Hidden from families"}</b>
                {" · "}
                Requests: <b>{ownCaregiverStatus.acceptingRequests ? "Accepting requests" : "Not accepting requests"}</b>
              </>
            ) : caregiverStatusLoading ? (
              "Loading your caregiver verification and listing status…"
            ) : (
              "Your current verification and listing status could not be loaded. Open My profile to review listing controls."
            )}
            {" "}
            <button className="text-link" onClick={() => go("/caregiver/profile")}>Manage listing <ArrowRight size={14} /></button>
          </div>
          {ownCaregiverStatus?.verificationStatus === "approved" && (
            <div className="caregiver-self-service-actions caregiver-dashboard-status-actions">
              <button
                className="button button-secondary"
                type="button"
                disabled={caregiverStatusSaving}
                onClick={() => void updateOwnCaregiverStatus({ acceptingRequests: !ownCaregiverStatus.acceptingRequests })}
              >
                {caregiverStatusSaving ? "Saving…" : ownCaregiverStatus.acceptingRequests ? "Pause new requests" : "Start accepting requests"}
              </button>
              <button
                className="button button-primary"
                type="button"
                disabled={caregiverStatusSaving}
                onClick={() => void updateOwnCaregiverStatus({ isPublished: !ownCaregiverStatus.isPublished })}
              >
                {caregiverStatusSaving ? "Saving…" : ownCaregiverStatus.isPublished ? "Hide from listing page" : "List my profile again"}
              </button>
            </div>
          )}
          <div className="stats-grid">
            <Stat
              label="New requests"
              value={String(providerApplications.length).padStart(2, "0")}
              icon={<ClipboardList />}
              tone="sage"
              note="Needs your response"
            />
            <Stat
              label="Upcoming visits"
              value="00"
              icon={<CalendarDays />}
              tone="blue"
              note="No confirmed visits"
            />
            <Stat
              label="Profile completeness"
              value="72%"
              icon={<UserRound />}
              tone="gold"
              note="Add availability"
            />
          </div>
          <div className="panel">
            <h3>Next steps</h3>
            {[
              "Complete your availability",
              "Check verification status",
              "Review incoming request",
            ].map((x, i) => (
              <div className="priority-row" key={x}>
                <span className="step-check">
                  {i === 2 ? <Clock3 size={16} /> : <Check size={16} />}
                </span>
                <span>
                  <b>{x}</b>
                  <small>
                    {
                      [
                        "Tell families when you can help",
                        "Submit requested evidence privately",
                        "Read tasks, schedule and rate before responding",
                      ][i]
                    }
                  </small>
                </span>
                <button
                  className="text-link"
                  onClick={() =>
                    go(i === 2 ? "/caregiver/requests" : "/caregiver/profile")
                  }
                >
                  Open <ArrowRight size={14} />
                </button>
              </div>
            ))}
          </div>
        </>
      );
    }
    if (path === "/facility") {
      return (
        <>
          <PageHeader
            eyebrow="FACILITY SPACE"
            title="Your facility overview"
            subtitle="Keep listing details current and follow up on family enquiries."
          />
          <div className="notice-bar">
            <Clock3 size={18} /> Listing status: Under review · Unpublished
            until approved.
          </div>
          <div className="stats-grid">
            <Stat
              label="Listing status"
              value="Review"
              icon={<House />}
              tone="gold"
              note="Not public yet"
            />
            <Stat
              label="New enquiries"
              value="00"
              icon={<MessageCircle />}
              tone="blue"
              note="No action needed"
            />
            <Stat
              label="Last updated"
              value="Today"
              icon={<Clock3 />}
              tone="sage"
              note="Draft changes"
            />
          </div>
          <div className="panel">
            <h3>Keep your listing ready</h3>
            <p className="muted">
              Complete your service information, indicative fees, amenities,
              availability date and evidence before submitting for review.
            </p>
            <button
              className="button button-primary"
              onClick={() => go("/facility/listing")}
            >
              Manage listing <ArrowRight size={16} />
            </button>
          </div>
        </>
      );
    }
    const greetingName = displayName.split(/\s+/).filter(Boolean)[0] || "there";
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    return (
      <>
        <PageHeader
          eyebrow="YOUR CARE SPACE"
          title={`${greeting}, ${greetingName}`}
          subtitle="Here is what needs your attention today."
          action={
            <button
              className="button button-primary"
              onClick={() => go("/app/requests/new")}
            >
              Request care <ArrowRight size={16} />
            </button>
          }
        />
        <div className="welcome-banner">
          <div>
            <span className="eyebrow">YOUR NEXT STEP</span>
            <h2>Care that fits your family's routine.</h2>
            <p>
              Find thoughtful support for everyday life, on a schedule that
              works for you.
            </p>
            <button
              className="button button-primary"
              onClick={() => go("/caregivers")}
            >
              Find care <ArrowRight size={16} />
            </button>
          </div>
          <div className="welcome-art">
            <div className="art-circle">
              <HeartHandshake size={50} />
            </div>
            <span className="art-leaf leaf-one">
              <Leaf />
            </span>
            <span className="art-leaf leaf-two">
              <Heart />
            </span>
          </div>
        </div>
        <div className="section-heading compact">
          <div>
            <h2>Your care at a glance</h2>
            <p>Updates for your family space</p>
          </div>
        </div>
        <div className="stats-grid">
          <Stat
            label="Active requests"
            value={String(requests.length).padStart(2, "0")}
            icon={<ClipboardList />}
            tone="sage"
            note="Awaiting caregiver response"
          />
          <Stat
            label="Upcoming bookings"
            value="00"
            icon={<CalendarDays />}
            tone="blue"
            note="No confirmed visits yet"
          />
          <Stat
            label="Saved caregivers"
            value={String(saved.length).padStart(2, "0")}
            icon={<Heart />}
            tone="rose"
            note="Your shortlist"
          />
        </div>
        <div className="dashboard-columns">
          <section className="panel">
            <div className="panel-head">
              <div>
                <h3>Recent requests</h3>
                <p>Keep track of responses and next steps.</p>
              </div>
              <button className="text-link" onClick={() => go("/app/requests")}>
                View all <ArrowRight size={14} />
              </button>
            </div>
            {requests.slice(0, 2).map((r) => (
              <div className="recent-request" key={r.ref}>
                <div className="mini-avatar rose">
                  {r.name
                    .split(" ")
                    .map((x) => x[0])
                    .join("")}
                </div>
                <div className="recent-info">
                  <b>{r.name}</b>
                  <small>{r.service}</small>
                  <small className="muted">{r.date}</small>
                </div>
                <StatusPill status={r.status} />
              </div>
            ))}
            <button
              className="button button-secondary full"
              onClick={() => go("/app/requests/new")}
            >
              Start a new request <ArrowRight size={15} />
            </button>
          </section>
          <section className="panel saved-panel">
            <div className="panel-head">
              <div>
                <h3>Saved caregivers</h3>
                <p>Profiles you want to revisit.</p>
              </div>
              <Heart size={18} className="muted-icon" />
            </div>
            {caregivers
              .filter((c) => saved.includes(c.id))
              .map((c) => (
                <div className="saved-row" key={c.id}>
                  <div className={`mini-avatar ${c.color}`}>{c.initials}</div>
                  <div>
                    <b>{c.name}</b>
                    <small>{c.area}</small>
                  </div>
                  <button
                    className="icon-button"
                    aria-label={`View ${c.name}`}
                    onClick={() => {
                      setSelected(c);
                      go("/caregivers/" + c.id);
                    }}
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              ))}
            {!saved.length && (
              <p className="muted">Save a profile to find it here again.</p>
            )}
            <button className="text-link" onClick={() => go("/caregivers")}>
              Discover caregivers <ArrowRight size={14} />
            </button>
          </section>
        </div>
        <div className="safety-strip">
          <span>
            <ShieldCheck size={21} />
          </span>
          <div>
            <b>Know what verification means</b>
            <p>
              See what has been reviewed and what still needs your own
              judgement.
            </p>
          </div>
          <button className="text-link" onClick={() => go("/safety")}>
            Learn more <ArrowRight size={14} />
          </button>
        </div>
      </>
    );
  }
}
function HomePage({
  t,
  caregivers,
  onFind,
  onHomes,
  onSafety,
  onHow,
  onRequest,
  saved,
  toggleSaved,
  onProfile,
}: any) {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="hero-kicker">
            <span className="kicker-dot" /> {t.trust}
          </div>
          <h1>{t.heroTitle}</h1>
          <p className="hero-sub">{t.heroSub}</p>
          <div className="hero-buttons">
            <button
              className="button button-primary button-large"
              onClick={onFind}
            >
              {t.find}
              <ArrowRight size={17} />
            </button>
            <button
              className="button button-outline button-large"
              onClick={onHomes}
            >
              {t.explore}
              <ArrowUpRight size={16} />
            </button>
          </div>
          <div className="hero-trust">
            <div className="trust-avatars">
              <span>MS</span>
              <span>SK</span>
              <span>LG</span>
            </div>
            <div>
              <b>Clear choices. Thoughtful care.</b>
              <small>Compare services, rates and verification scope.</small>
            </div>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-image-wrap">
            <img
              src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=900&q=85"
              alt="Smiling caregiver in a calm, bright setting"
            />
            <div className="image-tint" />
            <div className="hero-photo-caption">
              <span className="caption-icon">
                <HeartHandshake size={19} />
              </span>
              <span>
                <b>Care, on your terms</b>
                <small>Find the support that fits</small>
              </span>
            </div>
          </div>
          <div className="floating-note note-top">
            <span className="note-check">
              <Check size={15} />
            </span>
            <span>
              <b>Clear verification</b>
              <small>Know what was checked</small>
            </span>
          </div>
          <div className="floating-note note-bottom">
            <span className="note-calendar">
              <CalendarDays size={17} />
            </span>
            <span>
              <b>Request to book</b>
              <small>You choose. Caregiver responds.</small>
            </span>
          </div>
          <div className="hero-decoration deco-one" />
          <div className="hero-decoration deco-two" />
        </div>
      </section>
      <div className="trust-strip">
        <div>
          <ShieldCheck size={19} />
          <span>
            <b>Transparent checks</b>
            <small>Verification, explained</small>
          </span>
        </div>
        <div>
          <Heart size={19} />
          <span>
            <b>Family-led choices</b>
            <small>No automatic assignments</small>
          </span>
        </div>
        <div>
          <CalendarDays size={19} />
          <span>
            <b>Clear next steps</b>
            <small>Request before confirmation</small>
          </span>
        </div>
        <div>
          <Wallet size={19} />
          <span>
            <b>No online checkout</b>
            <small>Payment records only in MVP</small>
          </span>
        </div>
      </div>
      <section className="section service-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">CARE THAT FITS REAL LIFE</span>
            <h2>{t.services}</h2>
            <p>
              Start with the kind of support that would make each day easier.
            </p>
          </div>
          <button className="text-link" onClick={onFind}>
            {t.browse}
            <ArrowRight size={15} />
          </button>
        </div>
        <div className="service-grid">
          {[
            {
              icon: <HeartHandshake />,
              title: "Companionship",
              sub: "Conversation, activities and connection",
              tone: "sage",
            },
            {
              icon: <HandHeart />,
              title: "Daily living",
              sub: "Support with everyday routines",
              tone: "rose",
            },
            {
              icon: <Activity />,
              title: "Mobility assistance",
              sub: "Practical support within competence",
              tone: "blue",
            },
            {
              icon: <House />,
              title: "Light household help",
              sub: "Meals, tidying and daily tasks",
              tone: "gold",
            },
          ].map((s) => (
            <button className="service-card" key={s.title} onClick={onFind}>
              <span className={`service-icon ${s.tone}`}>{s.icon}</span>
              <span>
                <b>{s.title}</b>
                <small>{s.sub}</small>
              </span>
              <ArrowUpRight size={16} className="service-arrow" />
            </button>
          ))}
        </div>
      </section>
      <section className="section steps-section">
        <div className="section-heading centered">
          <span className="eyebrow">SIMPLE BY DESIGN</span>
          <h2>{t.stepTitle}</h2>
          <p>{t.stepSub}</p>
        </div>
        <div className="steps-grid">
          {[
            { n: "01", icon: <Search />, title: t.step1, sub: t.step1s },
            { n: "02", icon: <Users />, title: t.step2, sub: t.step2s },
            { n: "03", icon: <CheckCircle2 />, title: t.step3, sub: t.step3s },
          ].map((s, i) => (
            <div className="step-card" key={s.n}>
              <div className="step-top">
                <span className="step-icon">{s.icon}</span>
                <span className="step-num">{s.n}</span>
              </div>
              <h3>{s.title}</h3>
              <p>{s.sub}</p>
              {i < 2 && (
                <span className="step-connector">
                  <ArrowRight size={17} />
                </span>
              )}
            </div>
          ))}
        </div>
      </section>
      <section className="section featured-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">MEET YOUR OPTIONS</span>
            <h2>{t.featured}</h2>
            <p>{t.featuredSub}</p>
          </div>
          <button className="button button-secondary" onClick={onFind}>
            {t.seeAll}
            <ArrowRight size={15} />
          </button>
        </div>
        <div className="caregiver-grid">
          {caregivers.slice(0, 3).map((c: Caregiver) => (
            <CaregiverCard
              key={c.id}
              c={c}
              saved={saved.includes(c.id)}
              onSave={() => toggleSaved(c.id)}
              onProfile={() => onProfile(c)}
              onRequest={() => onRequest(c)}
            />
          ))}
        </div>
      </section>
      <section className="home-teaser">
        <div className="home-teaser-copy">
          <span className="eyebrow">MORE WAYS TO EXPLORE CARE</span>
          <h2>{t.homesTitle}</h2>
          <p>{t.homesSub}</p>
          <button className="button button-outline" onClick={onHomes}>
            {t.explore}
            <ArrowRight size={16} />
          </button>
          <small>
            Facility availability is provided by the facility and may not be
            live. An enquiry is not an admission.
          </small>
        </div>
        <div className="home-teaser-art">
          <img
            src="https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=850&q=80"
            alt="People spending time together outdoors"
          />
          <div className="home-art-label">
            <House size={18} />
            <span>
              <b>Explore at your pace</b>
              <small>Ask questions before arranging a visit</small>
            </span>
          </div>
        </div>
      </section>
      <section className="safety-feature">
        <div className="safety-art">
          <div className="safety-shield">
            <ShieldCheck size={54} />
          </div>
          <span className="safety-orbit orbit-one" />
          <span className="safety-orbit orbit-two" />
          <span className="safety-mini mini-one">
            <Check size={16} />
          </span>
          <span className="safety-mini mini-two">
            <Eye size={16} />
          </span>
        </div>
        <div className="safety-copy">
          <span className="eyebrow">TRUST, WITHOUT OVERPROMISING</span>
          <h2>{t.safetyTitle}</h2>
          <p>{t.safetySub}</p>
          <ul>
            <li>
              <Check size={16} /> Clear labels that say what was checked
            </li>
            <li>
              <Check size={16} /> Private documents stay private
            </li>
            <li>
              <Check size={16} /> A visible path to raise a concern
            </li>
          </ul>
          <button className="button button-primary" onClick={onSafety}>
            {t.learnSafety}
            <ArrowRight size={16} />
          </button>
        </div>
      </section>
      <section className="closing-cta">
        <div className="closing-icon">
          <HeartHandshake size={30} />
        </div>
        <div>
          <h2>{t.ctaTitle}</h2>
          <p>{t.ctaSub}</p>
        </div>
        <button className="button button-primary button-large" onClick={onFind}>
          {t.find}
          <ArrowRight size={16} />
        </button>
      </section>
    </>
  );
}
function CaregiverCard({ c, saved, onSave, onProfile, onRequest }: any) {
  return (
    <article className="caregiver-card">
      <div className="caregiver-card-top">
        <div className={`caregiver-avatar ${c.color}`}>{c.initials}</div>
        <button
          className={`save-button ${saved ? "saved" : ""}`}
          onClick={onSave}
          aria-label={saved ? "Remove from saved" : "Save caregiver"}
        >
          <Heart size={17} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="caregiver-name-row">
        <h3>{c.name}</h3>
        {c.rating > 0 && <span className="rating">
          <Star size={14} fill="currentColor" />
          {c.rating.toFixed(1)}
        </span>}
      </div>
      <p className="caregiver-role">{c.role}</p>
      <div className="caregiver-area">
        <MapPin size={14} />
        {c.area}
      </div>
      <div className="verified-line">
        <BadgeCheck size={15} />
        <span>{c.verified}</span>
        <button
          className="info-dot"
          title="Verification is one trust signal, not a guarantee."
        >
          i
        </button>
      </div>
      <div className="caregiver-tags">
        {c.services.slice(0, 2).map((s: string) => (
          <span className="tag" key={s}>
            {s}
          </span>
        ))}
        <span className="tag subtle">
          +{Math.max(0, c.services.length - 2)}
        </span>
      </div>
      <div className="caregiver-card-bottom">
        <div className="rate">
          <b>{c.rate > 0 ? formatNPR(c.rate) : "Rate not specified"}</b>
          {c.rate > 0 && <span>/ {c.unit || "hour"}</span>}
          <small>{c.years} years' experience</small>
        </div>
        <button
          className="circle-arrow"
          onClick={onProfile}
          aria-label={`View ${c.name}`}
        >
          <ArrowUpRight size={18} />
        </button>
      </div>
      <div className="caregiver-card-actions">
        <button className="button button-secondary" onClick={onProfile}>
          View profile
        </button>
        {c.acceptingRequests === false ? (
          <button className="button button-secondary caregiver-unavailable-status" type="button" disabled aria-label="This caregiver is not accepting requests">Not accepting requests</button>
        ) : (
          <button className="button button-primary" onClick={onRequest}>Request care</button>
        )}
      </div>
    </article>
  );
}
function CaregiverDirectory({
  list,
  loading = false,
  loadError = null,
  searchText,
  setSearchText,
  serviceFilter,
  setServiceFilter,
  sort,
  setSort,
  saved,
  toggleSaved,
  onRequest,
  onProfile,
}: any) {
  const [showFilters, setShowFilters] = useState(false);
  return (
    <main className="page-container directory-page">
      <div className="breadcrumb">
        <Link to="/">Home</Link>
        <ChevronRight size={13} /> Find caregivers
      </div>
      <div className="directory-title">
        <div>
          <span className="eyebrow">KATHMANDU VALLEY</span>
          <h1>Find thoughtful care.</h1>
          <p>
            Explore profiles, compare services and understand what verification
            covers.
          </p>
        </div>
        <div className="results-summary">
          <b>{list.length} caregivers</b>
          <small>Approved public listings</small>
        </div>
      </div>
      <div className="search-panel">
        <label className="search-field">
          <MapPin size={18} />
          <span>
            <small>Area or locality</small>
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="e.g. Lalitpur, Baneshwor"
            />
          </span>
          <button
            className="search-submit"
            onClick={() => setShowFilters(!showFilters)}
            aria-label="Open filters"
          >
            <SlidersHorizontal size={18} />
          </button>
        </label>
        <div className="search-divider" />
        <label className="search-field service-select">
          <Compass size={18} />
          <span>
            <small>Type of support</small>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
            >
              <option>All services</option>
              {[
                "Companionship",
                "Daily living",
                "Mobility support",
                "Light household support",
                "Overnight care",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </span>
        </label>
        <button
          className="button button-primary"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Search size={17} /> Search
        </button>
      </div>
      {showFilters && (
        <div className="filter-panel">
          <div>
            <label>Service</label>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
            >
              <option>All services</option>
              {[
                "Companionship",
                "Daily living",
                "Mobility support",
                "Light household support",
                "Overnight care",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Sort by</label>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option>Recommended</option>
              <option>Price: low to high</option>
              <option>Experience</option>
            </select>
          </div>
          <div className="filter-actions">
            <button
              className="text-link"
              onClick={() => {
                setSearchText("");
                setServiceFilter("All services");
                setSort("Recommended");
              }}
            >
              Clear filters
            </button>
            <button
              className="button button-primary"
              onClick={() => setShowFilters(false)}
            >
              Apply filters
            </button>
          </div>
        </div>
      )}
      <div className="directory-toolbar">
        <div className="filter-chips">
          <span>Filters:</span>
          {serviceFilter !== "All services" && (
            <button
              className="filter-chip"
              onClick={() => setServiceFilter("All services")}
            >
              {serviceFilter}
              <X size={13} />
            </button>
          )}
          {searchText && (
            <button className="filter-chip" onClick={() => setSearchText("")}>
              {searchText}
              <X size={13} />
            </button>
          )}
          {serviceFilter === "All services" && !searchText && (
            <span className="muted">No filters applied</span>
          )}
        </div>
        <label className="sort-control">
          Sort by{" "}
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option>Recommended</option>
            <option>Price: low to high</option>
            <option>Experience</option>
          </select>
        </label>
      </div>
      {loading ? (
        <div className="empty-inline" role="status">Loading approved caregiver listings…</div>
      ) : loadError ? (
        <EmptyState icon={<AlertTriangle />} title="Caregiver listings unavailable" text={loadError} action="Retry" onClick={() => window.location.reload()} />
      ) : list.length ? (
        <div className="caregiver-grid directory-grid">
          {list.map((c: Caregiver) => (
            <CaregiverCard
              key={c.id}
              c={c}
              saved={saved.includes(c.id)}
              onSave={() => toggleSaved(c.id)}
              onProfile={() => onProfile(c)}
              onRequest={() => onRequest(c)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Search />}
          title="No published caregivers yet"
          text="Approved caregiver profiles appear after verification and publication. Try again later or clear your filters."
          action="Clear filters"
          onClick={() => {
            setSearchText("");
            setServiceFilter("All services");
          }}
        />
      )}
      <div className="directory-safety">
        <ShieldCheck size={18} />
        <p>
          <b>About verification</b> Each label describes specific evidence
          reviewed. Verification is not a guarantee of safety or clinical
          competence.
        </p>
        <Link to="/safety">
          Read our approach <ArrowRight size={14} />
        </Link>
      </div>
    </main>
  );
}
function CaregiverProfile({
  caregiver: c,
  onRequest,
  onBack,
  saved,
  toggleSaved,
}: any) {
  return (
    <main className="page-container profile-page">
      <div className="breadcrumb">
        <button onClick={onBack}>
          <ArrowLeft size={14} /> Back to results
        </button>
        <ChevronRight size={13} />
        <span>Caregiver profile</span>
      </div>
      <div className="profile-layout">
        <section className="profile-main">
          <div className="profile-cover">
            <div className={`profile-avatar ${c.color}`}>{c.initials}</div>
            <div className="profile-title">
              <span className="eyebrow">CAREGIVER PROFILE</span>
              <h1>{c.name}</h1>
              <p>{c.role}</p>
              <span className="caregiver-area">
                <MapPin size={15} />
                {c.area}
              </span>
            </div>
            <button
              className={`save-button profile-save ${saved.includes(c.id) ? "saved" : ""}`}
              onClick={() => toggleSaved(c.id)}
            >
              <Heart
                size={17}
                fill={saved.includes(c.id) ? "currentColor" : "none"}
              />
              {saved.includes(c.id) ? "Saved" : "Save profile"}
            </button>
          </div>
          <div className="profile-section">
            <h2>About {c.name.split(" ")[0]}</h2>
            <p>{c.bio}</p>
            <div className="profile-facts">
              <div>
                <span className="fact-icon">
                  <Clock3 />
                </span>
                <b>{c.years} years</b>
                <small>Experience</small>
              </div>
              <div>
                <span className="fact-icon">
                  <MessageCircle />
                </span>
                <b>{c.languages.join(", ")}</b>
                <small>Languages</small>
              </div>
              <div>
                <span className="fact-icon">
                  <Star />
                </span>
                <b>
                  {c.rating.toFixed(1)} · {c.reviews} reviews
                </b>
                <small>Eligible feedback</small>
              </div>
            </div>
          </div>
          <div className="profile-section">
            <h2>Services offered</h2>
            <div className="profile-tags">
              {c.services.map((s: string) => (
                <span className="tag" key={s}>
                  {s}
                </span>
              ))}
            </div>
            <div className="inline-note">
              <InfoIcon /> Service scope depends on the caregiver's stated
              experience and agreed tasks. Clinical care is not implied.
            </div>
          </div>
          <div className="profile-section">
            <h2>Verification & trust</h2>
            <div className="verification-item">
              <span className="verified-badge">
                <BadgeCheck size={18} />
              </span>
              <div>
                <b>{c.verified}</b>
                <p>
                  Evidence categories reviewed by the platform. This does not
                  guarantee safety and does not certify any qualification that
                  has not been specifically reviewed.
                </p>
              </div>
            </div>
            <div className="verification-item">
              <span className="verified-badge neutral">
                <ShieldCheck size={18} />
              </span>
              <div>
                <b>Safety is a shared responsibility</b>
                <p>
                  Discuss tasks, access, schedule and expectations before
                  confirming. Use the report option if something concerns you.
                </p>
                <Link to="/safety">
                  Read safety guidance <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>
          <div className="profile-section">
            <h2>Reviews & feedback</h2>
            <div className="review-row">
              <span className="review-star">
                <Star size={17} fill="currentColor" />
              </span>
              <div>
                <b>{c.rating.toFixed(1)} out of 5</b>
                <p className="muted">
                  {c.reviews} eligible reviews in this sample profile.
                </p>
              </div>
              <span className="soft-chip">Moderated feedback</span>
            </div>
          </div>
        </section>
        <aside className="profile-aside">
          <div className="booking-card">
            <span className="eyebrow">INDICATIVE RATE</span>
            <div className="profile-rate">
              {formatNPR(c.rate)} <small>/ hour</small>
            </div>
            <p className="muted">
              Confirm the final rate and any additional costs before accepting
              changed terms.
            </p>
            <div className="availability">
              <span className="availability-dot" />
              <span>
                <b>{c.availability}</b>
                <small>Indicative · reconfirm with caregiver</small>
              </span>
            </div>
            <button
              className="button button-primary full"
              onClick={() => onRequest(c)}
            >
              Request care <ArrowRight size={16} />
            </button>
            <button
              className="button button-secondary full"
              onClick={() => onRequest(c)}
            >
              Ask a question
            </button>
            <div className="booking-safety">
              <ShieldCheck size={17} />
              <span>
                Request first. Your booking is not confirmed until the caregiver
                accepts and terms are agreed.
              </span>
            </div>
          </div>
          <button
            className="report-link"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("cc-open-incident"))
            }
          >
            <Shield size={15} /> Report a concern
          </button>
        </aside>
      </div>
    </main>
  );
}
function CareHomeDirectory({ onOpen, facilities: facilityRows }: any) {
  const [area, setArea] = useState("");
  const [type, setType] = useState("All facility types");
  const list = facilityRows.filter(
    (f) =>
      (!area ||
        `${f.name} ${f.area}`.toLowerCase().includes(area.toLowerCase())) &&
      (type === "All facility types" || f.type === type),
  );
  return (
    <main className="page-container directory-page">
      <div className="breadcrumb">
        <Link to="/">Home</Link>
        <ChevronRight size={13} /> Care homes
      </div>
      <div className="directory-title">
        <div>
          <span className="eyebrow">KATHMANDU VALLEY</span>
          <h1>Explore care homes.</h1>
          <p>
            Understand services, amenities and indicative fees. Ask questions
            before arranging a visit.
          </p>
        </div>
      </div>
      <div className="search-panel home-search">
        <label className="search-field">
          <MapPin size={18} />
          <span>
            <small>Area or facility</small>
            <input
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="Search Kathmandu Valley"
            />
          </span>
        </label>
        <div className="search-divider" />
        <label className="search-field">
          <House size={18} />
          <span>
            <small>Facility type</small>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option>All facility types</option>
              <option>Residential care</option>
              <option>Assisted living</option>
            </select>
          </span>
        </label>
        <button className="button button-primary">
          <Search size={17} /> Search
        </button>
      </div>
      <div className="facility-grid">
        {list.map((f) => (
          <article className="facility-card" key={f.name}>
            <div className={`facility-art ${f.color}`}>
              <div className="facility-art-mark">
                <House size={36} />
              </div>
              <span className="facility-type">{f.type}</span>
            </div>
            <div className="facility-content">
              <span className="eyebrow">FACILITY LISTING</span>
              <h3>{f.name}</h3>
              <div className="caregiver-area">
                <MapPin size={14} />
                {f.area}
              </div>
              <p>{f.desc}</p>
              <div className="facility-tags">
                {f.services.map((s) => (
                  <span className="tag" key={s}>
                    {s}
                  </span>
                ))}
              </div>
              <div className="facility-price">
                <b>{f.price}</b>
                <small>
                  <Clock3 size={13} />
                  {f.updated}
                </small>
              </div>
              <div className="facility-actions">
                <button
                  className="button button-secondary"
                  onClick={() => onOpen(f)}
                >
                  View details
                </button>
                <button
                  className="button button-primary"
                  onClick={() => onOpen(f)}
                >
                  Enquire <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!list.length && (
        <EmptyState
          icon={<House />}
          title="No facilities match that search"
          text="Try a broader locality or another facility type."
          action="Clear search"
          onClick={() => {
            setArea("");
            setType("All facility types");
          }}
        />
      )}
      <div className="directory-safety">
        <InfoIcon />
        <p>
          <b>Availability is not guaranteed.</b> Facility details and vacancy
          information are supplied by the facility and may not be current. An
          enquiry is not an admission.
        </p>
      </div>
    </main>
  );
}
function FacilityDetail({ facility: f, onBack, onEnquire, onRequest }: any) {
  return (
    <main className="page-container profile-page">
      <div className="breadcrumb">
        <button onClick={onBack}>
          <ArrowLeft size={14} /> Back to care homes
        </button>
        <ChevronRight size={13} />
        <span>Facility details</span>
      </div>
      <div className="facility-detail-hero">
        <div className={`facility-art large ${f.color}`}>
          <div className="facility-art-mark">
            <House size={58} />
          </div>
          <span className="facility-type">{f.type}</span>
        </div>
        <div className="facility-detail-copy">
          <span className="eyebrow">FACILITY-PROVIDED INFORMATION</span>
          <h1>{f.name}</h1>
          <p className="caregiver-area">
            <MapPin size={15} />
            {f.area}
          </p>
          <p>{f.desc}</p>
          <div className="facility-tags">
            {f.services.map((s: string) => (
              <span className="tag" key={s}>
                {s}
              </span>
            ))}
          </div>
          <div className="facility-detail-price">
            <b>{f.price}</b>
            <small>Availability {f.updated.toLowerCase()}</small>
          </div>
          <div className="button-row"><button className="button button-primary button-large" onClick={() => onRequest(f)}>Request placement <ArrowRight size={16}/></button><button className="button button-secondary" onClick={() => onEnquire(f)}>Ask a question</button></div>
          <p className="fineprint">
            An enquiry is not a confirmed placement. Ask the facility to confirm
            current availability and terms.
          </p>
        </div>
      </div>
      <div className="profile-section">
        <h2>Before you decide</h2>
        <div className="profile-facts">
          <div>
            <span className="fact-icon">
              <MessageCircle />
            </span>
            <b>Ask questions</b>
            <small>Services, fees and routines</small>
          </div>
          <div>
            <span className="fact-icon">
              <CalendarDays />
            </span>
            <b>Arrange a visit</b>
            <small>Confirm directly with the facility</small>
          </div>
          <div>
            <span className="fact-icon">
              <ShieldCheck />
            </span>
            <b>Review details</b>
            <small>Know what is verified</small>
          </div>
        </div>
      </div>
    </main>
  );
}
function InfoPage({ type, onAction }: any) {
  const data =
    type === "how"
      ? {
          eyebrow: "A SIMPLE, CLEAR PROCESS",
          title: "Care decisions, one step at a time.",
          sub: "You choose who to contact. A request starts a conversation; it does not instantly create a confirmed booking.",
          items: [
            [
              "01",
              "Explore your options",
              "Browse approved caregiver profiles or published care-home listings. Compare services, service area, indicative fees and what evidence has been reviewed.",
            ],
            [
              "02",
              "Share only what is needed",
              "Tell us about the support, schedule and location. Information about another person should only be submitted with appropriate permission.",
            ],
            [
              "03",
              "Request and review",
              "The caregiver can accept, decline or ask for clarification. If terms change, review them before confirming the booking.",
            ],
            [
              "04",
              "Stay informed",
              "Follow status updates, coordinate through messages and review visit summaries and manual payment records when available.",
            ],
          ],
          cta: "Find a caregiver",
        }
      : type === "safety"
        ? {
            eyebrow: "SAFETY & TRUST",
            title: "Clear information. Thoughtful choices.",
            sub: "AashrayaCare helps you compare options and communicate clearly. No marketplace check can guarantee a person or service is safe.",
            items: [
              [
                "01",
                "Understand each check",
                "Verification labels should state the evidence category reviewed. An identity check does not prove clinical competence, and an incomplete or expired check must not appear approved.",
              ],
              [
                "02",
                "Keep private details private",
                "Identity documents, private references, recipient safety notes and incident descriptions should only be accessible to authorized people.",
              ],
              [
                "03",
                "Agree the details",
                "Before confirming, review tasks, boundaries, schedule, rate basis, extra costs and cancellation terms. An accepted request is not yet a confirmed booking.",
              ],
              [
                "04",
                "Raise a concern",
                "Use the report path for safeguarding concerns, separate from ordinary reviews or support. If someone is in immediate danger, contact local emergency services.",
              ],
            ],
            cta: "Report a concern",
          }
        : {
            eyebrow: "WE ARE HERE TO HELP",
            title: "A little help with the next step.",
            sub: "Find care, understand a request or raise a concern. Contact support if you need assistance.",
            items: [
              [
                "Find care",
                "Compare profiles",
                "Use filters to explore service types, locality, languages and indicative rates.",
              ],
              [
                "Understand a request",
                "Follow the status",
                "A request remains pending until the caregiver responds. Confirmed bookings require agreement on terms.",
              ],
              [
                "Payment records",
                "No online checkout",
                "The MVP tracks manual payment arrangements and recorded amounts only. It does not process online payments.",
              ],
              [
                "Safety concerns",
                "Separate reporting path",
                "Production incident reports need restricted access and a monitored escalation owner.",
              ],
            ],
            cta: "Contact support",
          };
  return (
    <main className="info-page">
      <div className="info-hero">
        <span className="eyebrow">{data.eyebrow}</span>
        <h1>{data.title}</h1>
        <p>{data.sub}</p>
      </div>
      <div className="info-steps">
        {data.items.map((it: any, i: number) => (
          <div className="info-step" key={it[0]}>
            <span className="info-number">
              {type === "help" ? <HelpCircle size={20} /> : it[0]}
            </span>
            <div>
              <h2>{it[1]}</h2>
              <p>{it[2]}</p>
            </div>
            <span className="info-check">
              <Check size={17} />
            </span>
          </div>
        ))}
      </div>
      <div className="info-callout">
        <ShieldCheck size={24} />
        <div>
          <b>One important distinction</b>
          <p>
            Verification, booking status and payment status are separate. A
            profile badge is not a safety guarantee; caregiver acceptance is not
            booking confirmation; and a payment record is not an online
            transaction.
          </p>
        </div>
      </div>
      <div className="info-action">
        <div>
          <h2>
            {type === "safety"
              ? "Have a concern?"
              : type === "help"
                ? "Still need a hand?"
                : "Ready to explore your options?"}
          </h2>
          <p>
            {type === "safety"
              ? "Reports should be handled by authorized staff and a monitored escalation process."
              : "Take the next step when you are ready."}
          </p>
        </div>
        <button className="button button-primary" onClick={onAction}>
          {data.cta}
          <ArrowRight size={16} />
        </button>
      </div>
    </main>
  );
}
function RequestWizard({
  step,
  setStep,
  request,
  setRequest,
  recipientOptions,
  caregiver,
  providerType,
  onSubmit,
  onClose,
}: any) {
  const set = (k: string, v: string) =>
    setRequest((r: any) => ({ ...r, [k]: v }));
  return (
    <div className="wizard">
      <div className="wizard-progress">
        <div className="wizard-progress-top">
          <span>STEP {step} OF 4</span>
          <span>{Math.round((step / 4) * 100)}% complete</span>
        </div>
        <div className="progress-track">
          <span style={{ width: `${(step / 4) * 100}%` }} />
        </div>
        <div className="wizard-steps">
          {["Recipient", "Support", "Schedule", "Review"].map((s, i) => (
            <div
              className={
                step === i + 1 ? "current" : step > i + 1 ? "done" : ""
              }
              key={s}
            >
              <span>{step > i + 1 ? <Check size={13} /> : i + 1}</span>
              {s}
            </div>
          ))}
        </div>
      </div>
      {step === 1 && (
        <div className="wizard-content">
          <h3>Who needs care?</h3>
          <p className="muted">
            Choose the person you are coordinating care for.
          </p>
          <label>
            Care recipient
            <select
              value={request.recipient}
              onChange={(e) => set("recipient", e.target.value)}
            >
              <option value="">Choose a care recipient</option>
              {recipientOptions.map((r: string) => <option key={r} value={r.split(" · ")[0]}>{r}</option>)}
            </select>
          </label>
          <button type="button" className="text-link" onClick={()=>{onClose();window.location.assign("/app/recipients");}}>+ Add a care recipient <ArrowRight size={14}/></button>
          {recipientOptions.length===0&&<p className="muted">No recipients saved yet. Add one on the Care recipients page first.</p>}
          <div className="inline-note">
            <LockKeyhole size={16} /> Only share another person's information
            when you have permission to do so.
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="wizard-content">
          <h3>{providerType === "facility" ? "What type of placement do you need?" : "What support is needed?"}</h3>
          <p className="muted">
            Choose a service and describe the tasks that matter. Avoid adding
            unnecessary sensitive details.
          </p>
          <label>
            {providerType === "facility" ? "Placement type" : "Type of support"}
            <select value={request.service} onChange={(e) => set("service", e.target.value)}>
              {(providerType === "facility" ? ["Residential care placement", "Assisted living placement", "Long-term care placement", "Short-term respite placement"] : ["Companionship", "Daily living support", "Mobility assistance", "Light household support", "Overnight care"]).map((service) => <option key={service}>{service}</option>)}
            </select>
          </label>
          <label>
            Tasks and preferences
            <textarea
              rows={4}
              value={request.tasks}
              onChange={(e) => set("tasks", e.target.value)}
              maxLength={1000}
            />
            <small className="field-hint">
              {request.tasks.length}/1000 characters
            </small>
          </label>
          <label>
            Optional message
            <textarea
              rows={2}
              value={request.notes}
              onChange={(e) => set("notes", e.target.value)}
              maxLength={500}
              placeholder="Anything else the caregiver should know?"
            />
          </label>
        </div>
      )}
      {step === 3 && (
        <div className="wizard-content">
          <h3>When and where?</h3>
          <p className="muted">
            All times are shown in Nepal time (Asia/Kathmandu).
          </p>
          <label>
            Start date
            <input
              type="date"
              min={new Date().toISOString().slice(0, 10)}
              value={request.date}
              onChange={(e) => set("date", e.target.value)}
              required
            />
          </label>
          <div className="two-fields">
            <label>
              Start time
              <input
                type="time"
                value={request.start}
                onChange={(e) => set("start", e.target.value)}
              />
            </label>
            <label>
              End time
              <input
                type="time"
                value={request.end}
                onChange={(e) => set("end", e.target.value)}
              />
            </label>
          </div>
          <label>
            Service location / locality
            <input
              value={request.area}
              onChange={(e) => set("area", e.target.value)}
              placeholder="e.g. Jawalakhel, Lalitpur"
              required
            />
          </label>
          <label>
            Indicative budget per hour (NPR)
            <input
              type="number"
              min="0"
              value={request.budget}
              onChange={(e) => set("budget", e.target.value)}
            />
          </label>
        </div>
      )}
      {step === 4 && (
        <div className="wizard-content">
          <h3>Review before sending</h3>
          <p className="muted">
            Check the details below. The caregiver may ask questions or propose
            changes.
          </p>
          <div className="review-summary">
            <div className="review-person">
              <div className={`mini-avatar ${caregiver.color}`}>
                {caregiver.initials}
              </div>
              <div>
                <b>{caregiver.name}</b>
                <small>{caregiver.verified}</small>
              </div>
              <span className="soft-chip">Request to book</span>
            </div>
            {[
              ["Care recipient", request.recipient],
              ["Support", request.service],
              ["Tasks", request.tasks],
              [
                "Schedule",
                request.date
                  ? `${request.date}, ${request.start}–${request.end}`
                  : "Date not selected",
              ],
              ["Location", request.area],
              [
                "Indicative rate",
                `${formatNPR(Number(request.budget || 0))} / hour`,
              ],
            ].map(([k, v]: any) => (
              <div className="review-detail" key={k}>
                <span>{k}</span>
                <b>{v}</b>
              </div>
            ))}
          </div>
          <div className="alert-note">
            <InfoIcon />
            <span>
              <b>
                This sends a request. The booking is not confirmed until the
                caregiver accepts and the booking is confirmed.
              </b>{" "}
              Online payments are not processed in this MVP. Review cancellation
              terms before confirming.
            </span>
          </div>
          <label className="check-label">
            <input type="checkbox" id="terms-ack" /> I have reviewed the request
            details and agree to review the cancellation policy before
            confirmation.
          </label>
        </div>
      )}
      <div className="wizard-actions">
        <button
          className="button button-secondary"
          onClick={() => (step === 1 ? onClose() : setStep(step - 1))}
        >
          {step === 1 ? (
            "Save & exit"
          ) : (
            <>
              <ArrowLeft size={15} /> Back
            </>
          )}
        </button>
        {step < 4 ? (
          <button
            className="button button-primary"
            onClick={() => {
              if (
                step === 3 &&
                (!request.date ||
                  request.end <= request.start ||
                  !request.area.trim())
              )
                return;
              setStep(step + 1);
            }}
          >
            Continue <ArrowRight size={15} />
          </button>
        ) : (
          <button
            className="button button-primary"
            onClick={() => {
              const ack = document.getElementById(
                "terms-ack",
              ) as HTMLInputElement;
              if (!ack?.checked) {
                alert("Please acknowledge the request details before sending.");
                return;
              }
              onSubmit();
            }}
          >
            Send request <ArrowRight size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
function RequestWizardPage({
  recipients,
  request,
  setRequest,
  onSubmit,
  onBack,
}: any) {
  const [step, setStep] = useState(1);
  return (
    <>
      <div className="breadcrumb">
        <button onClick={onBack}>
          <ArrowLeft size={14} /> Dashboard
        </button>
        <ChevronRight size={13} />
        <span>New request</span>
      </div>
      <PageHeader
        eyebrow="REQUEST CARE"
        title="Let's find the right support."
        subtitle="A few details help you make a clear request. You can review everything before sending."
      />
      <div className="wizard-page-card">
        <RequestWizard
          step={step}
          setStep={setStep}
          request={request}
          setRequest={setRequest}
          recipientOptions={recipients}
          caregiver={caregivers[0]}
          onSubmit={onSubmit}
          onClose={onBack}
        />
      </div>
    </>
  );
}
function PageHeader({ eyebrow, title, subtitle, action }: any) {
  return (
    <div className="page-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action && <div className="page-header-action">{action}</div>}
    </div>
  );
}
function StatusPill({ status }: any) {
  const tone =
    status.toLowerCase().includes("confirm") ||
    status.toLowerCase().includes("complete") ||
    status.toLowerCase().includes("paid")
      ? "success"
      : status.toLowerCase().includes("declin") ||
          status.toLowerCase().includes("cancel") ||
          status.toLowerCase().includes("disput")
        ? "danger"
        : "warning";
  return (
    <span className={`status-pill ${tone}`}>
      <span />
      {status}
    </span>
  );
}
function Stat({ label, value, icon, tone, note }: any) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`}>{icon}</div>
      <span className="stat-label">{label}</span>
      <b className="stat-value">{value}</b>
      <small>{note}</small>
    </div>
  );
}
function EmptyState({ icon, title, text, action, onClick }: any) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <button className="button button-secondary" onClick={onClick}>
          {action}
          <ArrowRight size={15} />
        </button>
      )}
    </div>
  );
}
function Modal({ title, onClose, children }: any) {
  useEffect(() => {
    const listener = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <h2 id="modal-title">{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function InfoIcon() {
  return <CircleHelp size={17} className="inline-info-icon" />;
}

export default App;
