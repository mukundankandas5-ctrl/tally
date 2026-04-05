const { cleanString, toFixedAmount, toIsoDate } = require("./normalizers");

function escapeXml(value) {
  return cleanString(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function tallyDate(value) {
  const iso = toIsoDate(value);
  return iso ? iso.replace(/-/g, "") : "";
}

function amount(value) {
  return toFixedAmount(value).toFixed(2);
}

function tag(name, value) {
  return `<${name}>${escapeXml(value)}</${name}>`;
}

function rawTag(name, value) {
  return `<${name}>${value}</${name}>`;
}

function wrapEnvelope(messages, companyName) {
  const staticVariables = companyName
    ? `
          <STATICVARIABLES>
            ${tag("SVCURRENTCOMPANY", companyName)}
          </STATICVARIABLES>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>${staticVariables}
      </REQUESTDESC>
      <REQUESTDATA>
${messages.join("\n")}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

module.exports = {
  amount,
  escapeXml,
  rawTag,
  tag,
  tallyDate,
  wrapEnvelope,
};
