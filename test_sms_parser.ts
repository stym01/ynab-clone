const SENT_REGEX = /Sent Rs\.([\d,.]+) from Kotak Bank AC X(\d+) to (.+?) on (\d{2}-\d{2}-\d{2})\.UPI Ref\s*:?\s*(\d+)/i;
const RECEIVED_REGEX = /Received Rs\.([\d,.]+) in your Kotak Bank AC X(\d+) from (.+?) on (\d{2}-\d{2}-\d{2})\.UPI Ref\s*:?\s*(\d+)/i;

const messages = [
  "Sent Rs.11.00 from Kotak Bank AC X6065 to paytm-8736701@ptybl on 19-04-26.UPI Ref 204369019015. Not you, https://kotak.com/KBANKT/Fraud",
  "Sent Rs.500.00 from Kotak Bank AC X6065 to suhanisinghbaghel0@okaxis on 26-05-26.UPI Ref 614698635720. Not you, https://kotak.com/KBANKT/Fraud",
  "Received Rs.1500.00 in your Kotak Bank AC X6065 from 7054540707@ptyes on 20-05-26.UPI Ref:606490487209.",
  "Sent Rs.5.00 from Kotak Bank AC X6065 to 7054911784@pthdfc on 29-05-26.UPI Ref 614969466457. Not you, https://kotak.com/KBANKT/Fraud",
  "Received Rs.469.00 in your Kotak Bank AC X6065 from flipkart.hypg@yespay on 28-05-26.UPI Ref:614821946978."
];

for (const text of messages) {
  let match = text.match(SENT_REGEX);
  if (match) {
    console.log("SENT:", match[1], match[2], match[3], match[4], match[5]);
  } else {
    match = text.match(RECEIVED_REGEX);
    if (match) {
      console.log("RECEIVED:", match[1], match[2], match[3], match[4], match[5]);
    } else {
      console.log("FAILED:", text);
    }
  }
}
