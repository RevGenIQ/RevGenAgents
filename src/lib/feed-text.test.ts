import { describe, expect, it } from "vitest";
import {
  decodeHtmlEntities,
  extractXmlTag,
  feedFragmentToText,
  hostFromUrl,
} from "./feed-text";

describe("decodeHtmlEntities", () => {
  it("decodes named entities including nbsp", () => {
    expect(decodeHtmlEntities("Tom&nbsp;&amp;&nbsp;Jerry &quot;hi&quot;")).toBe(
      'Tom & Jerry "hi"'
    );
  });

  it("decodes decimal and hex numeric entities", () => {
    expect(decodeHtmlEntities("&#123;x&#125; &#x41;&#X42;")).toBe("{x} AB");
  });

  it("leaves unknown or invalid entities untouched", () => {
    expect(decodeHtmlEntities("&bogus; &#0; &#x110000;")).toBe(
      "&bogus; &#0; &#x110000;"
    );
  });

  it("resolves double-escaped input", () => {
    expect(decodeHtmlEntities("&amp;lt;p&amp;gt;")).toBe("<p>");
  });
});

describe("feedFragmentToText", () => {
  it("strips tags that arrive entity-escaped", () => {
    expect(
      feedFragmentToText("&lt;p&gt;Ship&nbsp;faster&lt;/p&gt;&lt;p&gt;today&lt;/p&gt;")
    ).toBe("Ship faster today");
  });

  it("strips tags that arrive double-escaped", () => {
    expect(
      feedFragmentToText(
        "&amp;lt;p&amp;gt;AI notes &amp;amp; docs&amp;lt;/p&amp;gt;"
      )
    ).toBe("AI notes & docs");
  });

  it("unwraps CDATA and collapses whitespace", () => {
    expect(
      feedFragmentToText("<![CDATA[<p>Hello</p>\n\n  <a href=\"x\">world</a>]]>")
    ).toBe("Hello world");
  });
});

describe("extractXmlTag", () => {
  it("returns plain text for a Product Hunt style entry", () => {
    const entry = `<title>Acme - Fast &amp; simple</title>
      <content type="html">&lt;p&gt;Discussion | &lt;a href="https://x"&gt;Link&lt;/a&gt;&lt;/p&gt;</content>`;
    expect(extractXmlTag(entry, "title")).toBe("Acme - Fast & simple");
    expect(extractXmlTag(entry, "content")).toBe("Discussion | Link");
    expect(extractXmlTag(entry, "missing")).toBe("");
  });
});

describe("hostFromUrl", () => {
  it("returns the host without www", () => {
    expect(hostFromUrl("https://www.Example.com/path?q=1")).toBe("example.com");
  });

  it("returns empty string for missing or invalid urls", () => {
    expect(hostFromUrl(undefined)).toBe("");
    expect(hostFromUrl("not a url")).toBe("");
  });
});
