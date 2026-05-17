/**
 * Sends ePOS-Print SOAP XML directly from the browser to the printer.
 * Must be called from client components only.
 *
 * PREREQUISITE: On each device, open Chrome → Site settings for this site →
 * "Insecure content" → Allow. This one-time setting lets an HTTPS page reach
 * the printer's HTTP endpoint on the local network.
 */
export async function sendToPrinter(printerUrl: string, xml: string): Promise<void> {
  // no-cors bypasses CORS headers; the browser sends the request and ignores
  // the opaque response. Mixed-content blocking is handled by the Chrome site
  // setting above.
  await fetch(printerUrl, {
    method: "POST",
    mode: "no-cors",
    // Must be a plain string — no-cors strips non-safelisted Content-Type
    // headers (including text/xml from Blob), leaving no Content-Type at all.
    // text/plain is CORS-safelisted so Chrome preserves it, and ePOS-Print
    // parses the XML body regardless of Content-Type.
    body: xml,
  });
}
