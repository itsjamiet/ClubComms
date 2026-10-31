// Privacy policy and terms of use. Public pages: ?page=privacy and ?page=terms
// DRAFT: have a solicitor review before launch. Set CONTACT_EMAIL below.
const CONTACT_EMAIL = ""; // e.g. "support@yourdomain.com"
const UPDATED = "28 October 2026";

function Section({ title, children }) {
  return (
    <section className="mb-6">
      <h2 className="font-display text-lg mb-2">{title}</h2>
      <div className="text-sm space-y-2" style={{ color: "var(--white)", lineHeight: 1.6 }}>{children}</div>
    </section>
  );
}

function Contact() {
  return CONTACT_EMAIL ? (
    <>email us at <a href={`mailto:${CONTACT_EMAIL}`} style={{ textDecoration: "underline" }}>{CONTACT_EMAIL}</a></>
  ) : (
    <>contact your club administrator, who will pass your request on</>
  );
}

function Privacy() {
  return (
    <>
      <h1 className="font-display text-2xl tracking-wide mb-1">Privacy policy</h1>
      <p className="text-xs mb-6" style={{ color: "var(--muted)" }}>Last updated {UPDATED}</p>

      <Section title="Who we are">
        <p>ClubComms is an app that helps grassroots football clubs run their teams: calendars, match days, announcements, documents and player information. Each club decides what information it puts into the app and who can see it. ClubComms provides the tools to do that.</p>
      </Section>

      <Section title="What information we hold">
        <p><b>Accounts:</b> your name, email address and password (stored securely, never in readable form), and whether you are a club admin, coach or parent.</p>
        <p><b>Players (children):</b> name, date of birth, photo, shirt number, match statistics, awards and training notes. This is added by coaches, or by a parent for their own child.</p>
        <p><b>Club content:</b> calendar events and replies, match day line-ups and reports, announcements, documents and the club emblem.</p>
      </Section>

      <Section title="How it is used">
        <p>Only to run the club's teams inside the app: showing the right people the right information, sending in-app alerts and publishing match reports. We do not sell personal information, we do not show adverts and we do not use it to track you across other apps or websites.</p>
      </Section>

      <Section title="Who can see what">
        <p>Parents see their own child's details and their team's squad, calendar, announcements and published match reports. Coaches see their teams. Club admins see their whole club. Photos and documents are only visible to people in the same club.</p>
      </Section>

      <Section title="Where it is stored">
        <p>Information is stored with our database and hosting providers (Supabase and Netlify), who process it on our behalf under their own security and data protection commitments.</p>
      </Section>

      <Section title="Keeping and deleting your information">
        <p>Information is kept while your account and your club are active. You can delete your account at any time in Settings. When a parent deletes their account, their child stays on the team list with their shirt number and match statistics. If that parent was the child's only linked parent, the child's photo, name and date of birth are removed. Coaches and club admins can edit or delete player details at any time.</p>
      </Section>

      <Section title="Your rights">
        <p>You can ask to see, correct or delete the information held about you or your child, or object to how it is used. To do this, {" "}<Contact />. If you are unhappy, you can complain to the Information Commissioner's Office (ico.org.uk).</p>
      </Section>

      <Section title="Children">
        <p>The app holds information about children, entered by their coach or parent/guardian. Children do not create accounts. Only add a child's photo if you have permission from their parent or guardian.</p>
      </Section>

      <Section title="Changes">
        <p>If this policy changes we will update the date above.</p>
      </Section>
    </>
  );
}

function Terms() {
  return (
    <>
      <h1 className="font-display text-2xl tracking-wide mb-1">Terms of use</h1>
      <p className="text-xs mb-6" style={{ color: "var(--muted)" }}>Last updated {UPDATED}</p>

      <Section title="Using ClubComms">
        <p>ClubComms is for the running of football clubs, teams and their families. By creating an account you agree to use it for that purpose, to keep your login details private and to give accurate information.</p>
      </Section>

      <Section title="Your content">
        <p>You are responsible for what you add to the app. Only upload photos, documents and information you have the right to share, and for children, only with the permission of their parent or guardian. Do not add anything unlawful, abusive or inappropriate.</p>
      </Section>

      <Section title="Clubs, coaches and parents">
        <p>Club admins decide who joins their club and can remove people or content. Coaches and parents should treat other people's information, especially children's, with care and not share it outside the club.</p>
      </Section>

      <Section title="Availability">
        <p>We work to keep the app running but cannot promise it will always be available or error-free. Please keep your own copies of anything important.</p>
      </Section>

      <Section title="Ending your account">
        <p>You can delete your account in Settings at any time. We may suspend accounts that break these terms.</p>
      </Section>

      <Section title="Contact">
        <p>For questions about these terms, <Contact />.</p>
      </Section>
    </>
  );
}

export default function Legal({ page }) {
  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <a href={window.location.pathname} className="text-sm" style={{ color: "var(--accent)" }}>← Back to ClubComms</a>
        <div className="mt-4">{page === "terms" ? <Terms /> : <Privacy />}</div>
      </div>
    </div>
  );
}
