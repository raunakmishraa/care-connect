import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Clock3, FileCheck2, HeartHandshake, House, ShieldCheck } from "lucide-react";
import { supabase } from "./lib";

type ApplicationType = "caregiver" | "care_home";
type ExistingApplication = { id: string; status: string; created_at: string; reviewer_notes: string | null };

const caregiverServices = [
  "Companionship",
  "Daily living support",
  "Mobility assistance",
  "Light household support",
  "Overnight care",
];

const statusCopy: Record<string, string> = {
  submitted: "Your application has been received and is waiting for review.",
  under_review: "The AashrayaCare team is reviewing your application.",
  action_required: "The team needs more information. Please contact support and quote your application ID.",
  approved: "Your application has been approved. Provider workspace access and listing publication must still be confirmed by the AashrayaCare team.",
  rejected: "This application was not approved. You may submit a revised application.",
};

export default function ProviderApplication({
  type,
  onNotify,
}: {
  type: ApplicationType;
  onNotify: (message: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState("");
  const [existing, setExisting] = useState<ExistingApplication | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceArea, setServiceArea] = useState("");
  const [experience, setExperience] = useState("0");
  const [services, setServices] = useState<string[]>([]);
  const [rate, setRate] = useState("");
  const [rateUnit, setRateUnit] = useState("hour");
  const [facilityName, setFacilityName] = useState("");
  const [facilityType, setFacilityType] = useState("Residential care");
  const [facilityAddress, setFacilityAddress] = useState("");
  const [facilityDescription, setFacilityDescription] = useState("");
  const [facilityServices, setFacilityServices] = useState("");
  const [capacity, setCapacity] = useState("");
  const [monthlyFee, setMonthlyFee] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!supabase) {
        if (active) setLoading(false);
        return;
      }
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !authData.user) {
        setLoading(false);
        return;
      }
      const user = authData.user;
      setUserId(user.id);
      setName(String(user.user_metadata?.full_name || ""));
      setEmail(String(user.email || ""));
      const { data: userProfile } = await supabase
        .from("users")
        .select("full_name, phone, email")
        .eq("id", user.id)
        .maybeSingle();
      if (!active) return;
      if (userProfile?.full_name) setName(String(userProfile.full_name));
      if (userProfile?.phone) setPhone(String(userProfile.phone));
      if (userProfile?.email) setEmail(String(userProfile.email));
      const { data: rows, error } = await supabase
        .from("provider_applications")
        .select("id, status, created_at, reviewer_notes")
        .eq("user_id", user.id)
        .eq("application_type", type)
        .order("created_at", { ascending: false })
        .limit(1);
      if (!active) return;
      if (!error && rows?.[0]) {
        const latest = rows[0] as ExistingApplication;
        if (latest.status !== "rejected") setExisting(latest);
      }
      setLoading(false);
    })().catch((error) => {
      console.error("Unable to load provider application:", error);
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [type]);

  const toggleService = (service: string) => {
    setServices((current) =>
      current.includes(service) ? current.filter((item) => item !== service) : [...current, service],
    );
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !userId) {
      onNotify("Please sign in again before submitting your application.");
      return;
    }
    if (!name.trim() || !email.trim() || !phone.trim()) {
      onNotify("Enter your name, email and contact phone number.");
      return;
    }
    if (type === "caregiver" && !serviceArea.trim()) {
      onNotify("Enter the area where you can provide care.");
      return;
    }
    if (type === "caregiver" && services.length === 0) {
      onNotify("Choose at least one care service.");
      return;
    }
    if (type === "care_home" && (!facilityName.trim() || !facilityAddress.trim())) {
      onNotify("Enter your care home's name and full address.");
      return;
    }
    setSaving(true);
    const payload = {
      user_id: userId,
      application_type: type,
      applicant_name: name.trim(),
      contact_email: email.trim(),
      contact_phone: phone.trim(),
      service_area: type === "caregiver" ? serviceArea.trim() : null,
      years_experience: type === "caregiver" ? Number(experience || 0) : null,
      services: type === "caregiver" ? services : [],
      rate_amount: type === "caregiver" && rate ? Number(rate) : null,
      rate_unit: type === "caregiver" ? rateUnit : null,
      facility_name: type === "care_home" ? facilityName.trim() : null,
      facility_type: type === "care_home" ? facilityType : null,
      facility_address: type === "care_home" ? facilityAddress.trim() : null,
      facility_description: type === "care_home" ? facilityDescription.trim() || null : null,
      facility_services: type === "care_home"
        ? facilityServices.split(",").map((item) => item.trim()).filter(Boolean)
        : [],
      facility_capacity: type === "care_home" && capacity ? Number(capacity) : null,
      monthly_fee: type === "care_home" && monthlyFee ? Number(monthlyFee) : null,
      registration_number: type === "care_home" ? registrationNumber.trim() || null : null,
      additional_notes: notes.trim() || null,
      status: "submitted",
    };
    const { data, error } = await supabase
      .from("provider_applications")
      .insert(payload)
      .select("id, status, created_at, reviewer_notes")
      .single();
    setSaving(false);
    if (error) {
      console.error("Provider application submission failed:", error.message);
      onNotify(error.code === "23505"
        ? "An active application already exists for this provider type. Check the application status below."
        : "We couldn't submit your application. Please try again or contact support.");
      return;
    }
    setExisting(data as ExistingApplication);
    onNotify("Application submitted. Your account has not been granted provider access.");
  };

  const isCaregiver = type === "caregiver";
  const title = isCaregiver ? "Become a caregiver" : "List a care home";
  if (loading) return <main className="page-container info-page"><p>Loading your application…</p></main>;

  if (!supabase || !userId) {
    return (
      <main className="page-container info-page">
        <div className="info-hero">
          <span className="eyebrow">PROVIDER ONBOARDING</span>
          <h1>{title}</h1>
          <p>Sign in to submit and track a provider application. A family account can apply without creating a second login.</p>
        </div>
      </main>
    );
  }

  if (existing) {
    return (
      <main className="page-container info-page provider-application-page">
        <div className="info-hero">
          <span className="eyebrow">PROVIDER ONBOARDING</span>
          <h1>{title}</h1>
          <p>Your application status is shown below. Submitting an application does not grant provider permissions or publish a listing.</p>
        </div>
        <section className="panel application-status-card">
          <span className="application-status-icon"><Clock3 size={22} /></span>
          <span className="eyebrow">APPLICATION STATUS</span>
          <h2>{existing.status.replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase())}</h2>
          <p>{statusCopy[existing.status] || "Contact support if you need help with this application."}</p>
          <p className="muted tiny">Application ID: {existing.id}</p>
          {existing.reviewer_notes && <div className="inline-note">{existing.reviewer_notes}</div>}
          {existing.status === "approved" && <div className="inline-note"><ShieldCheck size={17} /> Approval is not a substitute for the platform's role assignment and listing publication checks.</div>}
        </section>
      </main>
    );
  }

  return (
    <main className="page-container info-page provider-application-page">
      <div className="info-hero">
        <span className="eyebrow">PROVIDER ONBOARDING</span>
        <h1>{title}</h1>
        <p>{isCaregiver
          ? "Tell families about the care you can safely provide. Your profile remains unpublished while your application is reviewed."
          : "Share details about your care home so the team can review the facility before any public listing goes live."}</p>
      </div>
      <div className="application-guidance">
        <ShieldCheck size={19} />
        <p><strong>Review before publication.</strong> We use these details to review your application. Do not submit sensitive medical records or original identity documents in this form. The team will explain any required verification steps separately.</p>
      </div>
      <form className="form-panel provider-application-form" onSubmit={submit}>
        <h2><HeartHandshake size={21} /> Contact details</h2>
        <div className="application-fields">
          <label>Full name <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={160} required /></label>
          <label>Email address <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
          <label>Contact phone <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" maxLength={30} required placeholder="+977 ..." /></label>
        </div>
        {isCaregiver ? (
          <>
            <h2><FileCheck2 size={21} /> Caregiver details</h2>
            <div className="application-fields">
              <label>Service area <input value={serviceArea} onChange={(event) => setServiceArea(event.target.value)} required placeholder="e.g. Bharatpur, Chitwan" /></label>
              <label>Years of relevant experience <input type="number" min="0" max="80" value={experience} onChange={(event) => setExperience(event.target.value)} /></label>
              <label>Expected rate (NPR, optional) <input type="number" min="0" value={rate} onChange={(event) => setRate(event.target.value)} placeholder="e.g. 700" /></label>
              <label>Rate basis <select value={rateUnit} onChange={(event) => setRateUnit(event.target.value)}><option value="hour">Per hour</option><option value="visit">Per visit</option><option value="night">Per night</option><option value="day">Per day</option></select></label>
            </div>
            <fieldset className="application-services"><legend>Services you can provide</legend>
              {caregiverServices.map((service) => <label key={service}><input type="checkbox" checked={services.includes(service)} onChange={() => toggleService(service)} /> {service}</label>)}
            </fieldset>
          </>
        ) : (
          <>
            <h2><House size={21} /> Care-home details</h2>
            <div className="application-fields">
              <label>Care-home / facility name <input value={facilityName} onChange={(event) => setFacilityName(event.target.value)} required maxLength={180} /></label>
              <label>Facility type <select value={facilityType} onChange={(event) => setFacilityType(event.target.value)}><option>Residential care</option><option>Assisted living</option><option>Nursing care</option><option>Day care</option><option>Other</option></select></label>
              <label className="application-field-wide">Full facility address <input value={facilityAddress} onChange={(event) => setFacilityAddress(event.target.value)} required placeholder="Street / ward, municipality, district" /></label>
              <label>Approximate capacity <input type="number" min="0" value={capacity} onChange={(event) => setCapacity(event.target.value)} placeholder="Number of residents" /></label>
              <label>Indicative monthly fee (NPR) <input type="number" min="0" value={monthlyFee} onChange={(event) => setMonthlyFee(event.target.value)} placeholder="Optional" /></label>
              <label>Registration / licence number <input value={registrationNumber} onChange={(event) => setRegistrationNumber(event.target.value)} maxLength={120} placeholder="If applicable" /></label>
              <label className="application-field-wide">Services and amenities <input value={facilityServices} onChange={(event) => setFacilityServices(event.target.value)} placeholder="Comma-separated, e.g. meals, mobility support, nursing" /></label>
              <label className="application-field-wide">Facility description <textarea rows={4} value={facilityDescription} onChange={(event) => setFacilityDescription(event.target.value)} maxLength={3000} placeholder="Describe the care environment and services." /></label>
            </div>
          </>
        )}
        <label className="application-notes">Additional information (optional) <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} placeholder="Anything else the review team should know?" /></label>
        <div className="application-submit-row">
          <p className="muted tiny">By submitting, you confirm these details are accurate and agree that the team may contact you about this application.</p>
          <button className="button button-primary" type="submit" disabled={saving}>{saving ? "Submitting…" : "Submit application"} <ArrowRight size={16} /></button>
        </div>
      </form>
      <p className="fineprint">Your application is private to you and authorized reviewers. Approval and provider-role assignment are handled separately by AashrayaCare staff.</p>
    </main>
  );
}
