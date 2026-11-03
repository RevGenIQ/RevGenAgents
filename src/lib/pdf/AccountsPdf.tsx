/**
 * The client-facing research PDF: a cover with the account summary, then one
 * page per account (firmographics, buying signals with sources, why fit, what
 * to pitch, persona cards for each contact) and a closing page about the plan.
 * Uses the built-in Helvetica fonts, so text is mapped to Latin-1 first.
 */

import React from "react";
import { Document, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { RunAccount, SignalBuckets } from "../accounts/runAccount";

const INK = "#0f172a";
const MUTED = "#64748b";
const LINE = "#e2e8f0";
const ACCENT = "#4f46e5";

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 48, paddingHorizontal: 40, fontFamily: "Helvetica", fontSize: 9.5, color: INK, lineHeight: 1.4 },
  brand: { fontSize: 9, color: ACCENT, fontFamily: "Helvetica-Bold", letterSpacing: 0.5 },
  h1: { fontSize: 22, fontFamily: "Helvetica-Bold", marginTop: 6 },
  h2: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  h3: { fontSize: 10.5, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  muted: { color: MUTED },
  row: { flexDirection: "row" },
  pill: { fontSize: 8.5, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 3, backgroundColor: "#eef2ff", color: ACCENT, marginLeft: 4 },
  section: { marginTop: 14 },
  facts: { flexDirection: "row", flexWrap: "wrap", borderTopWidth: 1, borderTopColor: LINE, marginTop: 10 },
  fact: { width: "25%", paddingVertical: 6, paddingRight: 8, borderBottomWidth: 1, borderBottomColor: LINE },
  factLabel: { fontSize: 7.5, color: MUTED, marginBottom: 1 },
  box: { flex: 1, padding: 10, borderRadius: 4, backgroundColor: "#f8fafc" },
  signal: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: LINE },
  link: { color: ACCENT, textDecoration: "none", fontSize: 8 },
  cards: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  card: { width: "50%", padding: 4 },
  cardInner: { borderWidth: 1, borderColor: LINE, borderRadius: 4, padding: 9 },
  tableHead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: INK, paddingBottom: 4, marginTop: 18, fontFamily: "Helvetica-Bold", fontSize: 8.5 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: LINE, paddingVertical: 5 },
  footer: { position: "absolute", bottom: 22, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: MUTED },
});

/** Helvetica in PDFs covers Latin-1 only: map common typography and drop the rest. */
export function pdfSafe(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/[‐-―−]/g, "-")
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”‟]/g, '"')
    .replace(/…/g, "...")
    .replace(/[•·]/g, "-")
    .replace(/ /g, " ")
    .replace(/[^\u0009\u000A\u000D -ÿ]/g, "")
    .trim();
}

const SIGNAL_LABEL: Record<keyof SignalBuckets, string> = {
  icp: "ICP",
  hiring: "Hiring",
  funding_partnership: "Funding / partnership",
  news: "News",
  social: "Social",
};

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.fact}>
      <Text style={s.factLabel}>{label}</Text>
      <Text>{pdfSafe(value) || "-"}</Text>
    </View>
  );
}

function Footer({ company }: { company: string }) {
  return (
    <View style={s.footer} fixed>
      <Text>RevGen IQ research for {pdfSafe(company)}</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function AccountPage({ a, clientName }: { a: RunAccount; clientName: string }) {
  const groups = (Object.keys(SIGNAL_LABEL) as Array<keyof SignalBuckets>).flatMap((k) => a.signals[k].map((sig) => ({ ...sig, group: SIGNAL_LABEL[k] })));
  return (
    <Page size="A4" style={s.page}>
      <View style={[s.row, { justifyContent: "space-between", alignItems: "flex-start" }]}>
        <View>
          <Text style={s.h2}>{pdfSafe(a.name)}</Text>
          <Link src={`https://${a.domain}`} style={s.link}>{a.domain}</Link>
        </View>
        <View style={s.row}>
          {a.icpScore !== null && <Text style={s.pill}>ICP score {a.icpScore}</Text>}
          {a.priority ? <Text style={s.pill}>{pdfSafe(a.priority)}</Text> : null}
          {a.dataConfidence !== null && <Text style={s.pill}>Data {a.dataConfidence}%</Text>}
        </View>
      </View>
      {a.description ? <Text style={[s.section, s.muted]}>{pdfSafe(a.description).slice(0, 600)}</Text> : null}

      <View style={s.facts}>
        <Fact label="Industry" value={a.industry} />
        <Fact label="Employees" value={a.employees} />
        <Fact label="Headquarters" value={a.hqLocation || [a.city, a.country].filter(Boolean).join(", ")} />
        <Fact label="Founded" value={a.foundedYear} />
        <Fact label="Company type" value={a.companyType} />
        <Fact label="Revenue" value={a.revenue} />
        <Fact label="Total funding" value={a.totalFunding} />
        <Fact label="Latest round" value={[a.latestFundingRound, a.latestFundingAmount, a.lastRaisedAt].filter(Boolean).join(" - ")} />
        <Fact label="NAICS" value={a.naics.replace(/^NAICS\s*/, "")} />
        <Fact label="SIC" value={a.sic.replace(/^SIC Division\s*/, "")} />
        <Fact label="Email / phone" value={a.emailPhone} />
        <Fact label="Tech stack" value={a.techStack.slice(0, 6).join(", ")} />
      </View>

      {(a.whyIcpFit || a.whatToPitch) && (
        <View style={[s.row, s.section, { gap: 8 }]}>
          {a.whyIcpFit ? (
            <View style={s.box}>
              <Text style={s.h3}>Why they fit your ICP</Text>
              <Text>{pdfSafe(a.whyIcpFit)}</Text>
            </View>
          ) : null}
          {a.whatToPitch ? (
            <View style={[s.box, { backgroundColor: "#eef2ff" }]}>
              <Text style={s.h3}>What to pitch</Text>
              <Text>{pdfSafe(a.whatToPitch)}</Text>
            </View>
          ) : null}
        </View>
      )}

      <View style={s.section}>
        <Text style={s.h3}>Buying signals ({groups.length})</Text>
        {groups.length === 0 ? <Text style={s.muted}>No dated signals were found.</Text> : null}
        {groups.slice(0, 10).map((sig, i) => (
          <View key={i} style={s.signal} wrap={false}>
            <Text style={{ width: 62, color: MUTED }}>{sig.date}</Text>
            <Text style={{ width: 90, color: MUTED }}>{sig.group}</Text>
            <View style={{ flex: 1 }}>
              <Text>{pdfSafe(sig.title)}</Text>
              <Link src={sig.url} style={s.link}>{pdfSafe(sig.url).slice(0, 90)}</Link>
            </View>
          </View>
        ))}
      </View>

      {a.contacts.length > 0 && (
        <View style={s.section}>
          <Text style={s.h3}>Decision-makers</Text>
          <View style={s.cards}>
            {a.contacts.slice(0, 6).map((c, i) => {
              const str = (k: string) => pdfSafe(c[k] === undefined || c[k] === null ? "" : String(c[k]));
              return (
                <View key={i} style={s.card} wrap={false}>
                  <View style={s.cardInner}>
                    <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10 }}>{str("name") || `${str("firstName")} ${str("lastName")}`}</Text>
                    <Text style={s.muted}>{[str("title"), str("seniority")].filter(Boolean).join(" - ")}</Text>
                    {str("email") ? <Text style={{ marginTop: 4 }}>{str("email")}{str("emailStatus") ? `  (${str("emailStatus")})` : ""}</Text> : null}
                    {str("phone") || str("workDirectPhone") || str("mobilePhone") ? <Text>{str("workDirectPhone") || str("phone") || str("mobilePhone")}</Text> : null}
                    {str("location") ? <Text style={s.muted}>{str("location")}</Text> : null}
                    {str("linkedinUrl") ? <Link src={str("linkedinUrl")} style={s.link}>LinkedIn profile</Link> : null}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}
      <Footer company={clientName} />
    </Page>
  );
}

export function AccountsPdf({ accounts, clientName, generatedAt }: { accounts: RunAccount[]; clientName: string; generatedAt: string }) {
  return (
    <Document title={`RevGen IQ accounts for ${pdfSafe(clientName)}`} author="RevGen IQ">
      <Page size="A4" style={s.page}>
        <Text style={s.brand}>REVGEN IQ</Text>
        <Text style={s.h1}>Account research for {pdfSafe(clientName)}</Text>
        <Text style={[s.muted, { marginTop: 4 }]}>
          {accounts.length} account{accounts.length === 1 ? "" : "s"} - prepared {generatedAt}. Every fact and signal links to its source.
        </Text>
        <View style={s.tableHead}>
          <Text style={{ flex: 3 }}>Company</Text>
          <Text style={{ flex: 3 }}>Industry</Text>
          <Text style={{ flex: 2 }}>Employees</Text>
          <Text style={{ flex: 2 }}>HQ</Text>
          <Text style={{ flex: 1, textAlign: "right" }}>Score</Text>
        </View>
        {accounts.map((a) => (
          <View key={a.id} style={s.tableRow} wrap={false}>
            <Text style={{ flex: 3, fontFamily: "Helvetica-Bold" }}>{pdfSafe(a.name)}</Text>
            <Text style={{ flex: 3 }}>{pdfSafe(a.industry).slice(0, 40) || "-"}</Text>
            <Text style={{ flex: 2 }}>{pdfSafe(a.employees) || "-"}</Text>
            <Text style={{ flex: 2 }}>{pdfSafe(a.country || a.hqLocation).slice(0, 30) || "-"}</Text>
            <Text style={{ flex: 1, textAlign: "right" }}>{a.icpScore ?? "-"}</Text>
          </View>
        ))}
        <View style={[s.box, { marginTop: 24 }]}>
          <Text style={s.h3}>What the plan delivers</Text>
          <Text>35 accounts a month matched to your ICP, each researched by the agent and then enriched and checked by your dedicated Humagent, with up to 3 decision-makers per account. Reply in your workspace channel to talk to us.</Text>
        </View>
        <Footer company={clientName} />
      </Page>
      {accounts.map((a) => (
        <AccountPage key={a.id} a={a} clientName={clientName} />
      ))}
    </Document>
  );
}

/** Renders the accounts PDF to bytes (server only). */
export async function renderAccountsPdf(accounts: RunAccount[], clientName: string, generatedAt: string): Promise<ArrayBuffer> {
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const buffer = await renderToBuffer(<AccountsPdf accounts={accounts} clientName={clientName} generatedAt={generatedAt} />);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}
